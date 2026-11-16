import test from 'node:test';
import assert from 'node:assert/strict';
import { MY_TAG_GROUP_ID, isMyTagGroup } from '../utils/privateTagGroup.js';

test('my private tags use a reserved nonnumeric ID distinct from the existing system group', () => {
  assert.equal(MY_TAG_GROUP_ID, '__my_tags__');
  assert.equal(isMyTagGroup(MY_TAG_GROUP_ID), true);
  assert.equal(isMyTagGroup('__system'), false);
  assert.equal(isMyTagGroup(1), false);
  assert.equal(isMyTagGroup('1'), false);
});
