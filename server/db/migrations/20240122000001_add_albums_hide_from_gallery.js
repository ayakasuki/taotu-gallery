export async function up(knex) {
  const hasTable = await knex.schema.hasTable('albums');
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn('albums', 'hide_from_gallery');
  if (!hasColumn) {
    await knex.schema.alterTable('albums', (table) => {
      table.boolean('hide_from_gallery').defaultTo(false).comment('是否在首页图库隐藏该相册图片');
    });
  }
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('albums');
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn('albums', 'hide_from_gallery');
  if (hasColumn) {
    await knex.schema.alterTable('albums', (table) => {
      table.dropColumn('hide_from_gallery');
    });
  }
}
