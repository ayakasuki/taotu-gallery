import path from 'path';

const DEFAULT_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'ico'];

async function ensureColumn(knex, tableName, columnName, callback) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) {
    await knex.schema.alterTable(tableName, (table) => callback(table));
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (hasColumn) {
    await knex.schema.alterTable(tableName, (table) => table.dropColumn(columnName));
  }
}

export async function up(knex) {
  const hasUserGroups = await knex.schema.hasTable('user_groups');
  if (!hasUserGroups) {
    await knex.schema.createTable('user_groups', (table) => {
      table.increments('id').primary();
      table.string('name', 120).notNullable().unique();
      table.boolean('is_default').defaultTo(false).index();
      table.decimal('max_file_size_mb', 10, 2).defaultTo(0);
      table.integer('max_concurrent_uploads').defaultTo(0);
      table.integer('upload_limit_minute').defaultTo(0);
      table.integer('upload_limit_hour').defaultTo(0);
      table.integer('upload_limit_day').defaultTo(0);
      table.integer('upload_limit_week').defaultTo(0);
      table.integer('upload_limit_month').defaultTo(0);
      table.string('path_rule', 300).defaultTo('{yyyy}-{mm}-{dd}');
      table.string('filename_rule', 300).defaultTo('{uniqid}');
      table.integer('image_quality').defaultTo(85);
      table.integer('medium_width').defaultTo(1920);
      table.integer('medium_height').defaultTo(1080);
      table.json('allowed_formats');
      table.boolean('image_review_enabled').defaultTo(false);
      table.boolean('nsfw_visible').defaultTo(false);
      table.string('nsfw_engine', 50).defaultTo('nsfwjs');
      table.json('nsfw_config');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  const hasStorageStrategies = await knex.schema.hasTable('storage_strategies');
  if (!hasStorageStrategies) {
    await knex.schema.createTable('storage_strategies', (table) => {
      table.increments('id').primary();
      table.string('name', 160).notNullable();
      table.text('description');
      table.string('type', 40).notNullable().defaultTo('local');
      table.integer('user_group_id').index();
      table.boolean('is_system_default').defaultTo(false).index();
      table.json('config');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  const hasStorageStrategyGroups = await knex.schema.hasTable('storage_strategy_groups');
  if (!hasStorageStrategyGroups) {
    await knex.schema.createTable('storage_strategy_groups', (table) => {
      table.increments('id').primary();
      table.integer('storage_strategy_id').notNullable().index();
      table.integer('user_group_id').notNullable().index();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['storage_strategy_id', 'user_group_id']);
    });
  }

  await ensureColumn(knex, 'users', 'user_group_id', (table) => {
    table.integer('user_group_id').index();
  });
  await ensureColumn(knex, 'images', 'storage_strategy_id', (table) => {
    table.integer('storage_strategy_id').index();
  });
  await ensureColumn(knex, 'images', 'nsfw_status', (table) => {
    table.boolean('nsfw_status').nullable().index().comment('NULL=未审核, 0=合规, 1=不健康内容');
  });
  await ensureColumn(knex, 'images', 'nsfw_checked_at', (table) => {
    table.timestamp('nsfw_checked_at').nullable();
  });
  await ensureColumn(knex, 'images', 'nsfw_engine', (table) => {
    table.string('nsfw_engine', 50).nullable();
  });
  await ensureColumn(knex, 'images', 'nsfw_detail', (table) => {
    table.json('nsfw_detail').nullable();
  });

  let defaultGroup = await knex('user_groups').where({ is_default: true }).first();
  if (!defaultGroup) {
    const existing = await knex('user_groups').where({ name: '系统默认用户组' }).first();
    if (existing) {
      await knex('user_groups').where({ id: existing.id }).update({ is_default: 1, updated_at: knex.fn.now() });
      defaultGroup = { ...existing, is_default: 1 };
    } else {
      const [id] = await knex('user_groups').insert({
        name: '系统默认用户组',
        is_default: 1,
        max_file_size_mb: 0,
        max_concurrent_uploads: 0,
        upload_limit_minute: 0,
        upload_limit_hour: 0,
        upload_limit_day: 0,
        upload_limit_week: 0,
        upload_limit_month: 0,
        path_rule: '{yyyy}-{mm}-{dd}',
        filename_rule: '{uniqid}',
        image_quality: 85,
        medium_width: 1920,
        medium_height: 1080,
        allowed_formats: JSON.stringify(DEFAULT_FORMATS),
        image_review_enabled: 0,
        nsfw_visible: 0,
        nsfw_engine: 'nsfwjs',
        nsfw_config: JSON.stringify({
          nsfwjs: { endpoint: '', thresholds: { Drawing: 100, Hentai: 60, Neutral: 100, Porn: 40, Sexy: 70 } },
          tencent_ims: { endpoint: '', secretId: '', secretKey: '', region: 'ap-guangzhou' }
        })
      });
      defaultGroup = { id };
    }
  }

  await knex('users')
    .whereNull('user_group_id')
    .update({ user_group_id: defaultGroup.id });

  const defaultStrategy = await knex('storage_strategies').where({ is_system_default: true }).first();
  if (!defaultStrategy) {
    const [strategyId] = await knex('storage_strategies').insert({
      name: '默认本地存储',
      description: '系统默认本地上传目录，旧版本升级后继续使用 data/uploads。',
      type: 'local',
      user_group_id: defaultGroup.id,
      is_system_default: 1,
      config: JSON.stringify({ basePath: path.resolve(process.cwd(), 'data/uploads') })
    });
    await knex('storage_strategy_groups')
      .insert({ storage_strategy_id: strategyId, user_group_id: defaultGroup.id })
      .onConflict(['storage_strategy_id', 'user_group_id'])
      .ignore();
  } else if (defaultStrategy.user_group_id) {
    await knex('storage_strategy_groups')
      .insert({ storage_strategy_id: defaultStrategy.id, user_group_id: defaultStrategy.user_group_id })
      .onConflict(['storage_strategy_id', 'user_group_id'])
      .ignore();
  }

  const localStrategy = await knex('storage_strategies').where({ is_system_default: true }).first();
  if (localStrategy) {
    await knex('images')
      .whereNull('storage_strategy_id')
      .update({ storage_strategy_id: localStrategy.id });
  }
}

export async function down(knex) {
  await dropColumnIfExists(knex, 'images', 'nsfw_detail');
  await dropColumnIfExists(knex, 'images', 'nsfw_engine');
  await dropColumnIfExists(knex, 'images', 'nsfw_checked_at');
  await dropColumnIfExists(knex, 'images', 'nsfw_status');
  await dropColumnIfExists(knex, 'images', 'storage_strategy_id');
  await dropColumnIfExists(knex, 'users', 'user_group_id');

  const hasStorageStrategies = await knex.schema.hasTable('storage_strategies');
  const hasStorageStrategyGroups = await knex.schema.hasTable('storage_strategy_groups');
  if (hasStorageStrategyGroups) await knex.schema.dropTable('storage_strategy_groups');
  if (hasStorageStrategies) await knex.schema.dropTable('storage_strategies');
  const hasUserGroups = await knex.schema.hasTable('user_groups');
  if (hasUserGroups) await knex.schema.dropTable('user_groups');
}
