/**
 * 用户私有标签表
 */
export async function up(knex) {
  await knex.schema.createTable('user_tags', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable();
    table.string('name', 100).notNullable();
    table.string('display_name', 200);
    table.boolean('combinable').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'name']);
    table.index('user_id');
  });

  // conditions 表增加 is_public 字段
  await knex.schema.alterTable('conditions', (table) => {
    table.boolean('is_public').defaultTo(false).comment('是否公共条件标签');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('user_tags');
  await knex.schema.alterTable('conditions', (table) => {
    table.dropColumn('is_public');
  });
}
