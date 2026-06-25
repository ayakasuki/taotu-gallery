/**
 * 添加用户单图大小限制字段
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.bigInteger('max_file_size').defaultTo(0).comment('单张图片最大大小(bytes)，0=使用全局默认');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('max_file_size');
  });
};
