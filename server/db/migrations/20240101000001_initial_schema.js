/**
 * 初始数据库迁移 — 创建全部 12 张核心表
 */
exports.up = async function(knex) {
  // images: 图片基础信息
  await knex.schema.createTable('images', (table) => {
    table.increments('id').primary();
    table.string('filename', 500).notNullable();
    table.string('path', 1000).notNullable().comment('相对路径，基准为项目根目录');
    table.string('original_path', 1000).comment('原始绝对路径（备份前保留）');
    table.integer('width');
    table.integer('height');
    table.bigInteger('size_bytes');
    table.string('mime_type', 100);
    table.string('avg_color', 20).comment('平均颜色 hex');
    table.json('dominant_colors').comment('主要颜色数组');
    table.enum('orientation', ['landscape', 'portrait', 'square']);
    table.integer('view_count').defaultTo(0);
    table.enum('upload_source', ['local', 'upload', 'api', 'plugin']).defaultTo('local');
    table.integer('uploader_id');
    table.integer('album_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('album_id', 'idx_album');
    table.index('created_at', 'idx_created');
  });

  // albums: 相册
  await knex.schema.createTable('albums', (table) => {
    table.increments('id').primary();
    table.string('name', 200).notNullable();
    table.text('description');
    table.integer('cover_image_id');
    table.integer('image_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // tags: 标签定义
  await knex.schema.createTable('tags', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.string('display_name', 200);
    table.boolean('combinable').defaultTo(true).comment('true=可组合, false=不可组合(互斥)');
    table.integer('mutually_exclusive_with').comment('互斥标签 ID');
    table.enum('tag_type', ['manual', 'ai', 'condition']).defaultTo('manual');
    table.json('config').comment('条件标签的条件配置');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // image_tags: 图片-标签关系
  await knex.schema.createTable('image_tags', (table) => {
    table.increments('id').primary();
    table.integer('image_id').notNullable();
    table.integer('tag_id').notNullable();
    table.enum('source', ['manual', 'ai', 'condition']).notNullable().comment('标签来源');
    table.string('source_detail', 200).comment('AI 模型名或条件名');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['image_id', 'tag_id'], { indexName: 'uk_image_tag' });
    table.index('tag_id', 'idx_tag');
    table.index('source', 'idx_source');
  });

  // album_tags: 相册-标签关系
  await knex.schema.createTable('album_tags', (table) => {
    table.increments('id').primary();
    table.integer('album_id').notNullable();
    table.integer('tag_id').notNullable();
    table.enum('source', ['manual', 'ai', 'condition']).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['album_id', 'tag_id'], { indexName: 'uk_album_tag' });
  });

  // models: AI 模型记录（桩表，暂不实际使用）
  await knex.schema.createTable('models', (table) => {
    table.increments('id').primary();
    table.string('name', 200).notNullable();
    table.enum('type', ['local', 'remote']).defaultTo('local');
    table.string('local_path', 500);
    table.string('remote_url', 500);
    table.string('api_key_encrypted', 500);
    table.enum('status', ['idle', 'loading', 'ready', 'error']).defaultTo('idle');
    table.string('status_detail', 500).comment('错误详情');
    table.json('config');
    table.boolean('is_enabled').defaultTo(false).comment('暂不启用');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // conditions: 条件标签配置
  await knex.schema.createTable('conditions', (table) => {
    table.increments('id').primary();
    table.string('name', 200).notNullable();
    table.enum('type', [
      'path_regex', 'path_exclude', 'avg_color', 'include_color',
      'resolution', 'orientation', 'aspect_ratio', 'plugin'
    ]).notNullable();
    table.json('config').notNullable().comment('条件参数');
    table.boolean('is_enabled').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // api_tokens: API 访问令牌
  await knex.schema.createTable('api_tokens', (table) => {
    table.increments('id').primary();
    table.string('token', 200).notNullable().unique();
    table.string('label', 100);
    table.boolean('is_global').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('last_used_at');
  });

  // users: 用户
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('username', 100).notNullable().unique();
    table.string('password_hash', 200).notNullable();
    table.string('email', 200);
    table.string('avatar', 500);
    table.string('gallery_path', 500).comment('用户默认图库路径');
    table.bigInteger('storage_limit').defaultTo(0).comment('存储上限 bytes');
    table.enum('role', ['admin', 'user']).defaultTo('user');
    table.timestamp('last_login_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // upload_logs: 上传日志
  await knex.schema.createTable('upload_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id');
    table.integer('image_id');
    table.enum('source', ['single', 'batch', 'api', 'plugin']).notNullable();
    table.enum('status', ['success', 'failed']).notNullable();
    table.string('result_url', 1000);
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // api_logs: API 调用日志
  await knex.schema.createTable('api_logs', (table) => {
    table.increments('id').primary();
    table.string('endpoint', 200).notNullable();
    table.string('method', 10);
    table.string('source_ip', 50);
    table.integer('token_id');
    table.integer('status_code');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('created_at', 'idx_created');
    table.index('endpoint', 'idx_endpoint');
  });

  // site_metrics: 网站状态
  await knex.schema.createTable('site_metrics', (table) => {
    table.increments('id').primary();
    table.string('metric_key', 100).notNullable().unique();
    table.json('metric_value').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  const tables = [
    'site_metrics', 'api_logs', 'upload_logs', 'users', 'api_tokens',
    'conditions', 'models', 'album_tags', 'image_tags', 'tags',
    'albums', 'images'
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
};
