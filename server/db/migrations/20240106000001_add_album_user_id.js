/**
 * 添加 albums.user_id 字段
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('albums', (table) => {
    table.integer('user_id').comment('创建者用户 ID');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('albums', (table) => {
    table.dropColumn('user_id');
  });
};
