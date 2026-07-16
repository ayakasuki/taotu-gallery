export async function up(knex) {
  const hasStrategies = await knex.schema.hasTable('storage_strategies');
  const hasGroups = await knex.schema.hasTable('user_groups');
  if (!hasStrategies || !hasGroups) return;

  const hasJoinTable = await knex.schema.hasTable('storage_strategy_groups');
  if (!hasJoinTable) {
    await knex.schema.createTable('storage_strategy_groups', (table) => {
      table.increments('id').primary();
      table.integer('storage_strategy_id').notNullable().index();
      table.integer('user_group_id').notNullable().index();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['storage_strategy_id', 'user_group_id']);
    });
  }

  const strategies = await knex('storage_strategies').select('id', 'user_group_id');
  for (const strategy of strategies) {
    if (!strategy.user_group_id) continue;
    const group = await knex('user_groups').where({ id: strategy.user_group_id }).first();
    if (!group) continue;
    await knex('storage_strategy_groups')
      .insert({ storage_strategy_id: strategy.id, user_group_id: strategy.user_group_id })
      .onConflict(['storage_strategy_id', 'user_group_id'])
      .ignore();
  }
}

export async function down(knex) {
  const hasJoinTable = await knex.schema.hasTable('storage_strategy_groups');
  if (hasJoinTable) await knex.schema.dropTable('storage_strategy_groups');
}
