/**
 * 添加图片哈希路径字段
 */
export async function up(knex) {
  await knex.schema.alterTable('images', (table) => {
    table.string('hash_path', 200).comment('哈希路径，用于对外展示，不暴露本地路径');
    table.index('hash_path', 'idx_hash_path');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('images', (table) => {
    table.dropIndex('hash_path', 'idx_hash_path');
    table.dropColumn('hash_path');
  });
}
