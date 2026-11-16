import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRandomCount, parseRandomExclusions, shouldRedirectRandomImage } from '../utils/randomRequest.js';

test('random API allows batches above the UI limit and caps them at 2000', () => {
  assert.equal(parseRandomCount('150'), 150);
  assert.equal(parseRandomCount('2000'), 2000);
  assert.equal(parseRandomCount('2001'), 2000);
  assert.equal(parseRandomCount('9999999999'), 2000);
  for (const value of [undefined, '', 'invalid', '0', '-5']) {
    assert.equal(parseRandomCount(value), 1);
  }
});

test('single image redirect is opt-in and accepts a bare jump parameter', () => {
  for (const value of [undefined, '0', 'false', ['1'], {}]) {
    assert.equal(shouldRedirectRandomImage(value), false);
  }
  for (const value of ['', '1', 'true']) {
    assert.equal(shouldRedirectRandomImage(value), true);
  }
});

test('random exclusions deduplicate valid IDs and reject malformed filters', () => {
  assert.deepEqual(parseRandomExclusions(undefined), []);
  assert.deepEqual(parseRandomExclusions(''), []);
  assert.deepEqual(parseRandomExclusions('1, 2,1,3000'), [1, 2, 3000]);
  for (const value of ['0', '-1', '1,broken', '1,', '1.5', '9007199254740992', {}, ['1']]) {
    assert.throws(() => parseRandomExclusions(value), error => error.statusCode === 400);
  }
});
