/**
 * 为自定义路径增加扫描后批量公开图片配置
 */
export async function up(knex) {
  const hasTable = await knex.schema.hasTable('custom_paths');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('custom_paths', 'make_public');
  if (!hasColumn) {
    await knex.schema.table('custom_paths', (table) => {
      table.boolean('make_public').defaultTo(false).comment('扫描新增图片后批量设为公开');
    });
  }
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('custom_paths');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('custom_paths', 'make_public');
  if (hasColumn) {
    await knex.schema.table('custom_paths', (table) => {
      table.dropColumn('make_public');
    });
  }
}
