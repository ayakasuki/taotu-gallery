/**
 * 标签分组表
 */
export async function up(knex) {
  const hasTable = await knex.schema.hasTable('tag_groups');
  if (!hasTable) {
    await knex.schema.createTable('tag_groups', (table) => {
      table.increments('id').primary();
      table.string('name', 200).notNullable();
      table.json('subgroups').nullable().comment('子分组数组JSON');
      table.json('tag_ids').nullable().comment('直属标签ID数组JSON');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('tag_groups');
}
