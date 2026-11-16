export const MAX_RANDOM_COUNT = 2000;

export function parseRandomCount(value) {
  return Math.min(MAX_RANDOM_COUNT, Math.max(1, Number.parseInt(value, 10) || 1));
}

export function shouldRedirectRandomImage(value) {
  return value === '' || value === '1' || value === 'true';
}

export function parseRandomExclusions(value) {
  if (value === undefined || value === '') return [];
  const parts = typeof value === 'string' ? value.split(',') : [];
  const ids = parts.map(part => Number(part.trim()));
  if (!parts.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    const error = new Error('exclude 必须为逗号分隔的正整数 ID');
    error.statusCode = 400;
    throw error;
  }
  return [...new Set(ids)];
}
