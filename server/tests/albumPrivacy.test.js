import test from 'node:test';
import assert from 'node:assert/strict';
import { albumPrivacyUpdates, isUnsafeImage } from '../utils/albumPrivacy.js';

test('enabling private albums overrides existing public flags and locks conflicting changes', () => {
  assert.deepEqual(albumPrivacyUpdates({ is_private: true }, { is_public: true, all_picture_public: true, hide_from_gallery: true }), {
    is_private: true, is_public: false, all_picture_public: false, hide_from_gallery: false
  });
  for (const key of ['is_public', 'all_picture_public', 'hide_from_gallery']) {
    assert.throws(() => albumPrivacyUpdates({ [key]: true }, { is_private: true }), error => error.statusCode === 400);
    assert.throws(() => albumPrivacyUpdates({ is_private: true, [key]: true }), error => error.statusCode === 400);
  }
  assert.equal(albumPrivacyUpdates({ is_private: false, is_public: true }, { is_private: true }).is_public, true);
});

test('album switches reject truthy strings and unsafe cover states are recognized', () => {
  assert.throws(() => albumPrivacyUpdates({ is_private: 'false' }), error => error.statusCode === 400);
  for (const nsfw_status of [true, 1, '1']) assert.equal(isUnsafeImage({ nsfw_status }), true);
  for (const nsfw_status of [null, false, 0, '0', undefined]) assert.equal(isUnsafeImage({ nsfw_status }), false);
});
