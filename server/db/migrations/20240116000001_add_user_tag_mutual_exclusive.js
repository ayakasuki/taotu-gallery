/**
 * 用户私有标签支持互斥标签 ID（逗号分隔）。
 */
exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('user_tags', 'mutually_exclusive_with');
  if (!hasColumn) {
    await knex.schema.alterTable('user_tags', (table) => {
      table.string('mutually_exclusive_with', 255).nullable().comment('互斥标签 ID，支持 tags.id 或 u 前缀 user_tags.id');
    });
  }
};

exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('user_tags', 'mutually_exclusive_with');
  if (hasColumn) {
    await knex.schema.alterTable('user_tags', (table) => {
      table.dropColumn('mutually_exclusive_with');
    });
  }
};
