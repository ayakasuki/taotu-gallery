/**
 * 添加公共字段和 Token 用户关联
 */
exports.up = async function(knex) {
  // images 表增加 is_public
  await knex.schema.alterTable('images', (table) => {
    table.boolean('is_public').defaultTo(false).comment('是否公共图片');
  });

  // albums 表增加 is_public
  await knex.schema.alterTable('albums', (table) => {
    table.boolean('is_public').defaultTo(false).comment('是否公共相册');
  });

  // api_tokens 表增加 user_id
  await knex.schema.alterTable('api_tokens', (table) => {
    table.integer('user_id').comment('关联用户 ID');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('images', (table) => {
    table.dropColumn('is_public');
  });
  await knex.schema.alterTable('albums', (table) => {
    table.dropColumn('is_public');
  });
  await knex.schema.alterTable('api_tokens', (table) => {
    table.dropColumn('user_id');
  });
};
