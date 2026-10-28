import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuotaPeriods,
  consumeTokenQuota,
  hasTokenPermission,
  ipCidrMatch,
  isSourceAllowed,
  matchesRefererRule,
  normalizeTokenLabel,
  quotaReached,
  requiredTokenPermission
} from '../utils/apiTokenPolicy.js';

test('referer allowlist supports origin, wildcard subdomains and ports', () => {
  assert.equal(matchesRefererRule('taotu.ayakasuki.com', 'https://taotu.ayakasuki.com/api-docs'), true);
  assert.equal(matchesRefererRule('taotu.ayakasuki.com', 'https://taotu.ayakasuki.com:443/'), true);
  assert.equal(matchesRefererRule('taotu.ayakasuki.com', 'https://other.ayakasuki.com/'), false);
  assert.equal(matchesRefererRule('*.ayakasuki.com', 'https://blog.ayakasuki.com/'), true);
  assert.equal(matchesRefererRule('*.ayakasuki.com', 'https://ayakasuki.com/'), false);
  assert.equal(matchesRefererRule('i.ayakasuki.com:8880', 'http://i.ayakasuki.com:8880/'), true);
  assert.equal(matchesRefererRule('i.ayakasuki.com:8880', 'https://i.ayakasuki.com/'), false);
  assert.equal(matchesRefererRule('taotu.ayakasuki.com', 'https://taotu.ayakasuki.com:8443/'), false);
});

test('source allowlist accepts either IP or Referer and same-origin without Referer', () => {
  assert.equal(isSourceAllowed({ ip: '203.0.113.9', referer: 'https://blocked.example/' }, ['203.0.113.0/24'], ['allowed.example']), true);
  assert.equal(isSourceAllowed({ ip: '203.0.113.9', referer: 'https://allowed.example/' }, [], ['allowed.example']), true);
  assert.equal(isSourceAllowed({ ip: '198.51.100.2', referer: 'https://blocked.example/' }, ['203.0.113.0/24'], ['allowed.example']), false);
  assert.equal(isSourceAllowed({ ip: '127.0.0.1', fetchSite: 'same-origin', host: 'taotu.ayakasuki.com', protocol: 'https' }, [], ['taotu.ayakasuki.com']), true);
  assert.equal(isSourceAllowed({ ip: '127.0.0.1', fetchSite: 'cross-site', host: 'taotu.ayakasuki.com', protocol: 'https' }, [], ['taotu.ayakasuki.com']), false);
});

test('IPv4 CIDR checks reject malformed addresses', () => {
  assert.equal(ipCidrMatch('203.0.113.9', '203.0.113.0/24'), true);
  assert.equal(ipCidrMatch('203.0.114.9', '203.0.113.0/24'), false);
  assert.equal(ipCidrMatch('203.0.113.9', '203.0.113.999/24'), false);
});

test('API route permissions map to distinct scopes and management scope cannot be granted upward', () => {
  assert.equal(requiredTokenPermission('/api/images/random'), 'images:random');
  assert.equal(requiredTokenPermission('/api/images/42'), 'images:read');
  assert.equal(requiredTokenPermission('/api/albums/random'), 'albums:random');
  assert.equal(requiredTokenPermission('/api/upload/'), 'upload');
  assert.equal(requiredTokenPermission('/api/admin/users'), 'admin:manage');
  assert.equal(requiredTokenPermission('/api/images/random?count=1&tk=secret'), 'images:random');
  assert.equal(hasTokenPermission(['images:random'], 'images:random'), true);
  assert.equal(hasTokenPermission(['images:random'], 'upload'), false);
  assert.equal(hasTokenPermission(['admin:manage'], 'upload'), true);
  assert.equal(hasTokenPermission(['admin:manage'], 'admin:manage'), true);
});

test('token labels preserve entered names on create and edit normalization', () => {
  assert.equal(normalizeTokenLabel('用于相册展示'), '用于相册展示');
  assert.equal(normalizeTokenLabel('test'), 'test');
  assert.equal(normalizeTokenLabel('  test  '), 'test');
  assert.equal(normalizeTokenLabel(''), null);
  assert.equal(normalizeTokenLabel('x'.repeat(120)), 'x'.repeat(100));
});

test('quota periods use server-local calendar boundaries and reject the exact limit', () => {
  const date = new Date(2026, 0, 1, 0, 5, 0);
  assert.deepEqual(buildQuotaPeriods({ daily_limit: 3, monthly_limit: 20, yearly_limit: 100 }, date), [
    { type: 'day', limit: 3, key: '2026-01-01' },
    { type: 'month', limit: 20, key: '2026-01' },
    { type: 'year', limit: 100, key: '2026' }
  ]);
  assert.deepEqual(buildQuotaPeriods({ daily_limit: 0, monthly_limit: 0, yearly_limit: 0 }, date), []);
  assert.equal(quotaReached(2, 3), false);
  assert.equal(quotaReached(3, 3), true);
  assert.equal(quotaReached(100, 0), false);
});

test('quota consumption increments atomically and does not partially consume other periods', async () => {
  const usage = new Map();
  let transactionQueue = Promise.resolve();
  const database = {
    transaction(callback) {
      const run = transactionQueue.then(async () => {
        const working = new Map(usage);
        const trx = (table) => {
          assert.equal(table, 'api_token_usage');
          let criteria = {};
          const query = {
            where(value) { criteria = value; return query; },
            forUpdate() { return query; },
            async first() { return working.get(`${criteria.token_id}:${criteria.period_type}:${criteria.period_key}`) || null; },
            async insert(row) { working.set(`${row.token_id}:${row.period_type}:${row.period_key}`, { ...row }); },
            async increment(column, amount) {
              const key = `${criteria.token_id}:${criteria.period_type}:${criteria.period_key}`;
              const row = working.get(key);
              row[column] += amount;
            }
          };
          return query;
        };
        const result = await callback(trx);
        usage.clear();
        for (const [key, value] of working) usage.set(key, value);
        return result;
      });
      transactionQueue = run.catch(() => {});
      return run;
    }
  };
  const fixedDate = new Date(2026, 0, 1, 10);
  const dailyOnly = { daily_limit: 2, monthly_limit: 0, yearly_limit: 0 };
  assert.equal(await consumeTokenQuota(database, 17, dailyOnly, fixedDate), true);
  assert.equal(await consumeTokenQuota(database, 17, dailyOnly, fixedDate), true);
  assert.equal(await consumeTokenQuota(database, 17, dailyOnly, fixedDate), false);
  assert.equal(usage.get('17:day:2026-01-01').call_count, 2);

  const constrained = { daily_limit: 5, monthly_limit: 1, yearly_limit: 0 };
  assert.equal(await consumeTokenQuota(database, 21, constrained, fixedDate), true);
  assert.equal(await consumeTokenQuota(database, 21, constrained, fixedDate), false);
  assert.equal(usage.get('21:day:2026-01-01').call_count, 1);
  assert.equal(usage.get('21:month:2026-01').call_count, 1);

  const concurrentResults = await Promise.all(Array.from({ length: 8 }, () =>
    consumeTokenQuota(database, 31, dailyOnly, fixedDate)));
  assert.equal(concurrentResults.filter(Boolean).length, 2);
  assert.equal(usage.get('31:day:2026-01-01').call_count, 2);
});
