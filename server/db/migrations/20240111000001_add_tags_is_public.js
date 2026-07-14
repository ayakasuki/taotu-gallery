/**
 * tags 表增加 is_public 字段
 */
export async function up(knex) {
  await knex.schema.alterTable('tags', (table) => {
    table.boolean('is_public').defaultTo(true).comment('是否公共标签');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('tags', (table) => {
    table.dropColumn('is_public');
  });
}
