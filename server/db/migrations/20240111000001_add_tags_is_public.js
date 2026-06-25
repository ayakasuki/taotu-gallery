/**
 * tags 表增加 is_public 字段
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('tags', (table) => {
    table.boolean('is_public').defaultTo(true).comment('是否公共标签');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('tags', (table) => {
    table.dropColumn('is_public');
  });
};
