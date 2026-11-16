import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporaryMediaUrl, verifyTemporaryMedia, temporaryImage } from '../utils/temporaryMedia.js';

const secret = 'test-secret';
const now = Date.UTC(2026, 0, 1);

test('signed random media survives client IP changes and expires after fifteen minutes', () => {
  const url = createTemporaryMediaUrl(42, 'medium', 'images:random', 7, secret, now);
  const parsed = new URL(url, 'https://gallery.example');
  const input = { imageId: 42, size: 'medium', scope: parsed.searchParams.get('scope'), tokenId: parsed.searchParams.get('tid'), expires: parsed.searchParams.get('exp'), sig: parsed.searchParams.get('sig'), secret };
  assert.equal(verifyTemporaryMedia({ ...input, now: now + 899000 }), true);
  assert.equal(verifyTemporaryMedia({ ...input, now: now + 901000 }), false);
  assert.equal(verifyTemporaryMedia({ ...input, imageId: 43, now }), false);
  assert.equal(verifyTemporaryMedia({ ...input, size: 'full', now }), false);
  assert.equal(verifyTemporaryMedia({ ...input, scope: 'albums:random', now }), false);
  assert.equal(verifyTemporaryMedia({ ...input, tokenId: 8, now }), false);
  assert.equal(verifyTemporaryMedia({ ...input, sig: 'invalid', now }), false);
});

test('random token output omits original path and hash URL', () => {
  const image = { id: 42, filename: 'photo.png', path: 'data/uploads/private.png', hash_path: 'image/2026-01-01/hash.png', width: 120, height: 90 };
  const output = temporaryImage(image, 'albums:random', 7, secret);
  assert.equal(output.path, undefined);
  assert.equal(output.hash_path, undefined);
  assert.match(output.url, /^\/api\/random-media\/42\/full\?/);
  assert.match(output.medium_url, /^\/api\/random-media\/42\/medium\?/);
});

test('anonymous public media uses signed token ID zero and cannot be upgraded to an account', () => {
  const parsed = new URL(createTemporaryMediaUrl(42, 'medium', 'images:random', 0, secret, now), 'https://gallery.example');
  const input = { imageId: 42, size: 'medium', scope: 'images:random', tokenId: parsed.searchParams.get('tid'), expires: parsed.searchParams.get('exp'), sig: parsed.searchParams.get('sig'), secret, now };
  assert.equal(verifyTemporaryMedia(input), true);
  assert.equal(verifyTemporaryMedia({ ...input, tokenId: 7 }), false);
  assert.equal(verifyTemporaryMedia({ ...input, userId: 2 }), false);
  assert.equal(verifyTemporaryMedia({ ...input, now: now + 901000 }), false);
});

test('JWT media identity and embed scope are protected by the signature', () => {
  const parsed = new URL(createTemporaryMediaUrl(42, 'full', 'embed', 0, secret, now, 2), 'https://gallery.example');
  const input = { imageId: 42, size: 'full', scope: 'embed', tokenId: '0', userId: parsed.searchParams.get('uid'), expires: parsed.searchParams.get('exp'), sig: parsed.searchParams.get('sig'), secret, now };
  assert.equal(verifyTemporaryMedia(input), true);
  assert.equal(verifyTemporaryMedia({ ...input, userId: 3 }), false);
  assert.equal(verifyTemporaryMedia({ ...input, userId: 0 }), false);
  assert.equal(verifyTemporaryMedia({ ...input, tokenId: 7 }), false);
});
