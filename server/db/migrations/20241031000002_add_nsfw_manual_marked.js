export async function up(knex) {
  const hasTable = await knex.schema.hasTable('images');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('images', 'nsfw_manual_marked');
  if (!hasColumn) {
    await knex.schema.alterTable('images', table => {
      table.boolean('nsfw_manual_marked').notNullable().defaultTo(false).index().comment('是否由管理员人工标记健康状态');
    });
  }
  await knex('images').where({ nsfw_engine: 'manual' }).update({ nsfw_manual_marked: true });
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('images');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('images', 'nsfw_manual_marked');
  if (hasColumn) await knex.schema.alterTable('images', table => table.dropColumn('nsfw_manual_marked'));
}
