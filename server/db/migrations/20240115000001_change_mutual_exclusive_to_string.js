/**
 * 支持多个互斥标签 ID（逗号分隔）
 */
export async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('tags', 'mutually_exclusive_with');
  if (hasColumn) {
    await knex.schema.alterTable('tags', (table) => {
      table.string('mutually_exclusive_with', 255).nullable().alter();
    });
  }
}

export async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('tags', 'mutually_exclusive_with');
  if (hasColumn) {
    await knex.schema.alterTable('tags', (table) => {
      table.integer('mutually_exclusive_with').nullable().alter();
    });
  }
}
