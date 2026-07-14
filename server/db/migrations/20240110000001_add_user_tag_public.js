/**
 * user_tags 增加 is_public 字段
 */
export async function up(knex) {
  await knex.schema.alterTable('user_tags', (table) => {
    table.boolean('is_public').defaultTo(false).comment('是否已转为公共标签');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('user_tags', (table) => {
    table.dropColumn('is_public');
  });
}
