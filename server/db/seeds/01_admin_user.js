/**
 * 种子数据：创建默认管理员账号
 * 密码: admin123（请在生产环境修改）
 */
const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // 清空用户表
  await knex('users').del();

  // 创建默认管理员
  const passwordHash = await bcrypt.hash('admin123', 10);
  await knex('users').insert({
    username: 'admin',
    password_hash: passwordHash,
    email: 'admin@example.com',
    role: 'admin'
  });
};
