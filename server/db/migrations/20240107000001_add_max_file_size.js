/**
 * 添加用户单图大小限制字段
 */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.bigInteger('max_file_size').defaultTo(0).comment('单张图片最大大小(bytes)，0=使用全局默认');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('max_file_size');
  });
}
