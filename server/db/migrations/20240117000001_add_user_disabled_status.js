/**
 * 增加用户启用/禁用状态与最后登录 IP。
 */
export async function up(knex) {
  const hasDisabled = await knex.schema.hasColumn('users', 'is_disabled');
  if (!hasDisabled) {
    await knex.schema.alterTable('users', (table) => {
      table.boolean('is_disabled').defaultTo(false).comment('是否禁用登录');
    });
  }

  const hasLastLoginIp = await knex.schema.hasColumn('users', 'last_login_ip');
  if (!hasLastLoginIp) {
    await knex.schema.alterTable('users', (table) => {
      table.string('last_login_ip', 80).nullable().comment('最后登录 IP');
    });
  }
}

export async function down(knex) {
  const hasLastLoginIp = await knex.schema.hasColumn('users', 'last_login_ip');
  if (hasLastLoginIp) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('last_login_ip');
    });
  }

  const hasDisabled = await knex.schema.hasColumn('users', 'is_disabled');
  if (hasDisabled) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('is_disabled');
    });
  }
}
