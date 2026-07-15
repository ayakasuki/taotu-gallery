export async function up(knex) {
  const hasTable = await knex.schema.hasTable('custom_paths');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('custom_paths', 'allow_delete');
  if (!hasColumn) {
    await knex.schema.table('custom_paths', (table) => {
      table.boolean('allow_delete').defaultTo(false).comment('图片管理删除时是否同步删除该自定义路径原始文件');
    });
  }
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('custom_paths');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('custom_paths', 'allow_delete');
  if (hasColumn) {
    await knex.schema.table('custom_paths', (table) => {
      table.dropColumn('allow_delete');
    });
  }
}
