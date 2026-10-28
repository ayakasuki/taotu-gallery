export const DEFAULT_TOKEN_PERMISSIONS = ['images:read', 'images:random', 'albums:read', 'albums:random', 'embed', 'upload', 'tags:read'];

export function normalizeTokenLabel(value) {
  return String(value || '').trim().slice(0, 100) || null;
}

export function parseAllowlist(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(String).map((item) => item.trim()).filter(Boolean) : [];
  } catch {
    return String(value || '').split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  }
}

export function getTokenPermissions(record) {
  if (Array.isArray(record.permissions)) return record.permissions;
  try {
    const parsed = JSON.parse(record.permissions || '[]');
    return Array.isArray(parsed) ? parsed : DEFAULT_TOKEN_PERMISSIONS;
  } catch {
    return DEFAULT_TOKEN_PERMISSIONS;
  }
}

export function matchesRefererRule(ruleValue, sourceValue) {
  try {
    const parsed = new URL(sourceValue.includes('://') ? sourceValue : `http://${sourceValue}`);
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    const rule = ruleValue.trim().toLowerCase();
    const match = rule.match(/^(\*\.)?([^:]+)(?::(\d+))?$/);
    if (!match) return false;
    const [, wildcard, expectedHost, expectedPort] = match;
    const hostMatches = wildcard
      ? host !== expectedHost && host.endsWith(`.${expectedHost}`)
      : host === expectedHost;
    return hostMatches && (expectedPort ? port === expectedPort : ['80', '443'].includes(port));
  } catch {
    return false;
  }
}

export function ipCidrMatch(ip, cidr) {
  const [range, prefixText] = cidr.split('/');
  const prefix = Number(prefixText);
  if (ip.includes(':') || range.includes(':') || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const parts = (value) => value.split('.').map(Number);
  const ipParts = parts(ip);
  const rangeParts = parts(range);
  if ([...ipParts, ...rangeParts].some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const toInt = (values) => values.reduce((result, part) => ((result << 8) | part) >>> 0, 0);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (toInt(ipParts) & mask) === (toInt(rangeParts) & mask);
}

export function isSourceAllowed({ ip, referer, origin, fetchSite, host, protocol }, ipRules, refererRules) {
  const ipAllowed = ipRules.some((entry) => entry === ip || (entry.includes('/') && ipCidrMatch(ip, entry)));
  const source = referer || origin;
  const refererAllowed = source && refererRules.some((entry) => matchesRefererRule(entry, source));
  const sameOriginAllowed = !source && fetchSite === 'same-origin' && host
    && refererRules.some((entry) => matchesRefererRule(entry, `${protocol || 'http'}://${host}`));
  return Boolean(ipAllowed || refererAllowed || sameOriginAllowed);
}

export function buildQuotaPeriods(limits, date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return [
    { type: 'day', limit: Number(limits.daily_limit || 0), key: `${year}-${month}-${day}` },
    { type: 'month', limit: Number(limits.monthly_limit || 0), key: `${year}-${month}` },
    { type: 'year', limit: Number(limits.yearly_limit || 0), key: year }
  ].filter((period) => period.limit > 0);
}

export function quotaReached(callCount, limit) {
  return Number(limit) > 0 && Number(callCount) >= Number(limit);
}

export function requiredTokenPermission(path) {
  path = String(path || '').split(/[?#]/, 1)[0];
  if (path.startsWith('/api/upload')) return 'upload';
  if (path.startsWith('/api/embed')) return 'embed';
  if (path.startsWith('/api/albums')) return path.includes('/random') ? 'albums:random' : 'albums:read';
  if (path.startsWith('/api/images')) return path.includes('/random') ? 'images:random' : 'images:read';
  if (path.startsWith('/api/tags') || path.startsWith('/api/tag-groups')) return 'tags:read';
  if (path.startsWith('/api/admin')) return 'admin:manage';
  return null;
}

export function hasTokenPermission(permissions, required) {
  return !required || permissions.includes(required) || (required !== 'admin:manage' && permissions.includes('admin:manage'));
}

export async function consumeTokenQuota(connection, tokenId, limits, date = new Date()) {
  const periods = buildQuotaPeriods(limits, date);
  if (!periods.length) return true;
  return connection.transaction(async (trx) => {
    for (const period of periods) {
      let row = await trx('api_token_usage').where({ token_id: tokenId, period_type: period.type, period_key: period.key }).forUpdate().first();
      if (!row) {
        try {
          await trx('api_token_usage').insert({ token_id: tokenId, period_type: period.type, period_key: period.key, call_count: 0 });
        } catch {}
        row = await trx('api_token_usage').where({ token_id: tokenId, period_type: period.type, period_key: period.key }).forUpdate().first();
      }
      if (quotaReached(row?.call_count || 0, period.limit)) return false;
    }
    for (const period of periods) {
      await trx('api_token_usage').where({ token_id: tokenId, period_type: period.type, period_key: period.key }).increment('call_count', 1);
    }
    return true;
  });
}
