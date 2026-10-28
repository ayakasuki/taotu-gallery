export async function up(knex) {
  const columns = [
    ['permissions', (table) => table.json('permissions').nullable()],
    ['referer_allowlist', (table) => table.text('referer_allowlist')],
    ['ip_allowlist', (table) => table.text('ip_allowlist')],
    ['yearly_limit', (table) => table.integer('yearly_limit').notNullable().defaultTo(0)],
    ['monthly_limit', (table) => table.integer('monthly_limit').notNullable().defaultTo(0)],
    ['daily_limit', (table) => table.integer('daily_limit').notNullable().defaultTo(0)]
  ];
  for (const [name, addColumn] of columns) {
    if (!(await knex.schema.hasColumn('api_tokens', name))) {
      await knex.schema.alterTable('api_tokens', addColumn);
    }
  }
  await knex('api_tokens').whereNull('permissions').whereIn('user_id', knex('users').select('id').where({ role: 'admin' })).update({
    permissions: JSON.stringify(['images:read', 'images:random', 'albums:read', 'albums:random', 'embed', 'upload', 'tags:read', 'admin:manage'])
  });
  await knex('api_tokens').whereNull('permissions').update({
    permissions: JSON.stringify(['images:read', 'images:random', 'albums:read', 'albums:random', 'embed', 'upload', 'tags:read'])
  });

  if (!(await knex.schema.hasTable('api_token_usage'))) {
    await knex.schema.createTable('api_token_usage', (table) => {
      table.increments('id').primary();
      table.integer('token_id').unsigned().notNullable();
      table.string('period_type', 10).notNullable();
      table.string('period_key', 10).notNullable();
      table.integer('call_count').notNullable().defaultTo(0);
      table.unique(['token_id', 'period_type', 'period_key'], 'api_token_usage_period_unique');
      table.index(['token_id', 'period_type'], 'api_token_usage_token_period_idx');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('api_token_usage');
  for (const column of ['permissions', 'referer_allowlist', 'ip_allowlist', 'yearly_limit', 'monthly_limit', 'daily_limit']) {
    if (await knex.schema.hasColumn('api_tokens', column)) {
      await knex.schema.alterTable('api_tokens', (table) => table.dropColumn(column));
    }
  }
}
