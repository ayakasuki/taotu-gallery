/**
 * 添加 albums.user_id 字段
 */
export async function up(knex) {
  await knex.schema.alterTable('albums', (table) => {
    table.integer('user_id').comment('创建者用户 ID');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('albums', (table) => {
    table.dropColumn('user_id');
  });
}
