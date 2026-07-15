export async function up(knex) {
  const hasImages = await knex.schema.hasTable('images');
  const hasStrategies = await knex.schema.hasTable('storage_strategies');
  if (!hasImages || !hasStrategies) return;

  const hasColumn = await knex.schema.hasColumn('images', 'storage_strategy_id');
  if (!hasColumn) return;

  const defaultStrategy = await knex('storage_strategies').where({ is_system_default: true }).first();
  if (!defaultStrategy) return;

  await knex('images')
    .whereNull('storage_strategy_id')
    .update({ storage_strategy_id: defaultStrategy.id });
}

export async function down() {}
