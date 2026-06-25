/**
 * image_tags 支持用户私有标签
 */
exports.up = async function(knex) {
  // image_tags 增加 user_tag_id 和 user_id 字段
  await knex.schema.alterTable('image_tags', (table) => {
    table.integer('user_tag_id').comment('用户私有标签 ID');
    table.integer('tag_user_id').comment('标签所属用户 ID');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('image_tags', (table) => {
    table.dropColumn('user_tag_id');
    table.dropColumn('tag_user_id');
  });
};
