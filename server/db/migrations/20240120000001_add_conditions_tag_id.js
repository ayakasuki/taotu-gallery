/**
 * 条件标签与真实 tags 表记录建立稳定关联。
 *
 * 旧版本通过 cond_${type}_${name} 名称回查标签，新版本在 conditions.tag_id
 * 里直接保存 tags.id，避免条件改名或重扫时找不到对应标签。
 */
async function hasIndex(knex, tableName, indexName) {
  const database = knex.client.config.connection.database;
  const row = await knex('information_schema.statistics')
    .where({
      table_schema: database,
      table_name: tableName,
      index_name: indexName
    })
    .first();
  return !!row;
}

function buildConditionTagName(condition) {
  return `cond_${condition.type}_${condition.name}`.slice(0, 100);
}

function normalizeBool(value) {
  return value === true || value === 1 || value === '1';
}

exports.up = async function(knex) {
  const hasTagId = await knex.schema.hasColumn('conditions', 'tag_id');
  if (!hasTagId) {
    await knex.schema.alterTable('conditions', (table) => {
      table.integer('tag_id').nullable().comment('关联的条件标签 tags.id');
    });
  }

  const indexName = 'idx_conditions_tag_id';
  if (!(await hasIndex(knex, 'conditions', indexName))) {
    await knex.schema.alterTable('conditions', (table) => {
      table.index('tag_id', indexName);
    });
  }

  const hasTagIsPublic = await knex.schema.hasColumn('tags', 'is_public');
  const conditions = await knex('conditions').select('*');

  for (const condition of conditions) {
    if (condition.tag_id) continue;

    const tagName = buildConditionTagName(condition);
    let tag = await knex('tags').where({ name: tagName }).first();

    if (!tag) {
      const payload = {
        name: tagName,
        display_name: condition.name,
        combinable: true,
        tag_type: 'condition',
        config: typeof condition.config === 'string'
          ? condition.config
          : JSON.stringify(condition.config || {})
      };
      if (hasTagIsPublic) payload.is_public = normalizeBool(condition.is_public);

      const ids = await knex('tags').insert(payload);
      tag = { id: Array.isArray(ids) ? ids[0] : ids };
    }

    if (tag && tag.id) {
      await knex('conditions').where({ id: condition.id }).update({ tag_id: tag.id });
    }
  }
};

exports.down = async function(knex) {
  const indexName = 'idx_conditions_tag_id';
  if (await hasIndex(knex, 'conditions', indexName)) {
    await knex.schema.alterTable('conditions', (table) => {
      table.dropIndex('tag_id', indexName);
    });
  }

  const hasTagId = await knex.schema.hasColumn('conditions', 'tag_id');
  if (hasTagId) {
    await knex.schema.alterTable('conditions', (table) => {
      table.dropColumn('tag_id');
    });
  }
};
