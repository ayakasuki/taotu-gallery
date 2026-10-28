export const ROOT_ADMIN_ID = 1;

export function isHealthyRootAdmin(user) {
  return Number(user?.id) === ROOT_ADMIN_ID
    && user.role === 'admin'
    && !user.is_disabled
    && !['pending', 'rejected'].includes(user.review_status);
}

export function rootAdminStartupError() {
  const error = new Error('系统保底管理员 ID=1 缺失或状态异常，服务拒绝启动。请运行 `npm run admin:repair-root` 修复；该命令只创建或修复 ID=1，不修改其他用户或管理员。');
  error.statusCode = 503;
  error.code = 'ROOT_ADMIN_UNHEALTHY';
  return error;
}

export function isProtectedRootAdmin(userId) {
  return Number(userId) === ROOT_ADMIN_ID;
}

export function rootAdminRoleChangeError() {
  const error = new Error('系统保底管理员（ID=1）必须保持管理员角色');
  error.statusCode = 400;
  error.code = 'ROOT_ADMIN_PROTECTED';
  return error;
}
