export async function up(knex) {
  const hasTable = await knex.schema.hasTable('albums');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('albums', 'all_picture_public');
  if (!hasColumn) {
    await knex.schema.alterTable('albums', (table) => {
      table.boolean('all_picture_public').defaultTo(false).comment('相册图片批量公开开关状态');
    });
  }
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('albums');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('albums', 'all_picture_public');
  if (hasColumn) {
    await knex.schema.alterTable('albums', (table) => {
      table.dropColumn('all_picture_public');
    });
  }
}
