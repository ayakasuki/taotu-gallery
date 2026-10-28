import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isHealthyRootAdmin,
  isProtectedRootAdmin,
  rootAdminRoleChangeError,
  rootAdminStartupError
} from '../utils/rootAdminPolicy.js';

test('only an enabled, approved admin at ID 1 is a healthy root admin', () => {
  assert.equal(isHealthyRootAdmin({ id: 1, role: 'admin', is_disabled: 0, review_status: 'approved' }), true);
  assert.equal(isHealthyRootAdmin({ id: 2, role: 'admin', is_disabled: 0, review_status: 'approved' }), false);
  assert.equal(isHealthyRootAdmin({ id: 1, role: 'user', is_disabled: 0, review_status: 'approved' }), false);
  assert.equal(isHealthyRootAdmin({ id: 1, role: 'admin', is_disabled: 1, review_status: 'approved' }), false);
  assert.equal(isHealthyRootAdmin({ id: 1, role: 'admin', is_disabled: 0, review_status: 'pending' }), false);
});

test('ID 1 is protected and startup remediation is documented', () => {
  assert.equal(isProtectedRootAdmin('1'), true);
  assert.equal(isProtectedRootAdmin(2), false);
  assert.equal(rootAdminRoleChangeError().code, 'ROOT_ADMIN_PROTECTED');
  assert.match(rootAdminStartupError().message, /npm run admin:repair-root/);
  assert.equal(rootAdminStartupError().statusCode, 503);
});
