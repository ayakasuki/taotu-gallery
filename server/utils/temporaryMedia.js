import crypto from 'node:crypto';
export const MEDIA_TTL_SECONDS = 900;

function signature(imageId, size, scope, tokenId, expires, secret, userId = 0) {
  const payload = userId
    ? `random-media:v3:${imageId}:${size}:${scope}:${tokenId}:${expires}:${userId}`
    : `random-media:v2:${imageId}:${size}:${scope}:${tokenId}:${expires}`;
  return crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

export function createTemporaryMediaUrl(imageId, size, scope, tokenId, secret, now = Date.now(), userId = 0) {
  if (!secret) throw new Error('无法为当前请求签发临时媒体链接');
  const expires = Math.floor(now / 1000) + MEDIA_TTL_SECONDS;
  const sig = signature(imageId, size, scope, tokenId, expires, secret, userId);
  return `/api/random-media/${imageId}/${size}?exp=${expires}&tid=${tokenId}${userId ? `&uid=${userId}` : ''}&scope=${scope}&sig=${sig}`;
}

export function verifyTemporaryMedia({ imageId, size, scope, tokenId, expires, sig, secret, userId = 0, now = Date.now() }) {
  if (!Number.isSafeInteger(Number(imageId)) || Number(imageId) <= 0
    || !['full', 'medium', 'thumb'].includes(size)
    || !['images:random', 'albums:random', 'embed'].includes(scope)
    || !Number.isSafeInteger(Number(tokenId)) || Number(tokenId) < 0
    || !Number.isSafeInteger(Number(userId)) || Number(userId) < 0
    || (Number(tokenId) > 0 && Number(userId) > 0)
    || !Number.isSafeInteger(Number(expires)) || Number(expires) < Math.floor(now / 1000)
    || Number(expires) > Math.floor(now / 1000) + MEDIA_TTL_SECONDS
    || !/^[a-f0-9]{64}$/i.test(String(sig || '')) || !secret) return false;
  const actual = Buffer.from(sig, 'hex');
  const expected = Buffer.from(signature(imageId, size, scope, tokenId, expires, secret, userId), 'hex');
  return crypto.timingSafeEqual(actual, expected);
}

export function temporaryImage(image, scope, tokenId, secret, userId = 0) {
  return {
    id: image.id,
    filename: image.filename,
    width: image.width,
    height: image.height,
    mime_type: image.mime_type,
    url: createTemporaryMediaUrl(image.id, 'full', scope, tokenId, secret, Date.now(), userId),
    medium_url: createTemporaryMediaUrl(image.id, 'medium', scope, tokenId, secret, Date.now(), userId),
    thumb_url: createTemporaryMediaUrl(image.id, 'thumb', scope, tokenId, secret, Date.now(), userId)
  };
}
