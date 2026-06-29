/**
 * 公告中心与用户通知已读状态。
 */
exports.up = async function(knex) {
  const hasAnnouncements = await knex.schema.hasTable('announcements');
  if (!hasAnnouncements) {
    await knex.schema.createTable('announcements', (table) => {
      table.increments('id').primary();
      table.string('title', 200).notNullable();
      table.string('subtitle', 300).nullable();
      table.text('content').notNullable();
      table.string('cover_url', 500).nullable();
      table.integer('author_id').nullable();
      table.enum('status', ['draft', 'published']).notNullable().defaultTo('draft');
      table.boolean('is_pinned').notNullable().defaultTo(false);
      table.timestamp('published_at').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      table.index(['status', 'is_pinned', 'published_at'], 'idx_announcements_visible');
      table.index('author_id', 'idx_announcements_author');
    });
  }

  const hasReads = await knex.schema.hasTable('announcement_reads');
  if (!hasReads) {
    await knex.schema.createTable('announcement_reads', (table) => {
      table.increments('id').primary();
      table.integer('announcement_id').notNullable();
      table.integer('user_id').notNullable();
      table.timestamp('read_at').notNullable().defaultTo(knex.fn.now());

      table.unique(['announcement_id', 'user_id'], { indexName: 'uk_announcement_user_read' });
      table.index(['user_id', 'read_at'], 'idx_announcement_reads_user');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('announcement_reads');
  await knex.schema.dropTableIfExists('announcements');
};
