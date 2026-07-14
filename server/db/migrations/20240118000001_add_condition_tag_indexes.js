/**
 * 为条件标签增量扫描增加索引，避免大图库定时任务反复全表匹配。
 */
export async function up(knex) {
  const database = knex.client.config.connection.database;
  const indexes = await knex('information_schema.statistics')
    .where({
      table_schema: database,
      table_name: 'image_tags',
      index_name: 'idx_condition_tag_lookup'
    })
    .first();

  if (!indexes) {
    await knex.schema.alterTable('image_tags', (table) => {
      table.index(['source', 'tag_id', 'image_id', 'source_detail'], 'idx_condition_tag_lookup');
    });
  }
}

export async function down(knex) {
  const database = knex.client.config.connection.database;
  const indexes = await knex('information_schema.statistics')
    .where({
      table_schema: database,
      table_name: 'image_tags',
      index_name: 'idx_condition_tag_lookup'
    })
    .first();

  if (indexes) {
    await knex.schema.alterTable('image_tags', (table) => {
      table.dropIndex(['source', 'tag_id', 'image_id', 'source_detail'], 'idx_condition_tag_lookup');
    });
  }
}
