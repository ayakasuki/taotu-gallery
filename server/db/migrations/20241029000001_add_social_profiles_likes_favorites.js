export async function up(knex) {
  if (!(await knex.schema.hasColumn('users', 'nickname'))) {
    await knex.schema.alterTable('users', table => table.string('nickname', 100).nullable().after('username'));
  }

  if (!(await knex.schema.hasTable('image_likes'))) {
    await knex.schema.createTable('image_likes', table => {
      table.increments('id').primary();
      table.integer('image_id').notNullable();
      table.integer('user_id').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['image_id', 'user_id'], { indexName: 'uk_image_like_user' });
      table.index(['image_id', 'created_at'], 'idx_image_likes_image');
      table.index(['user_id', 'created_at'], 'idx_image_likes_user');
    });
  }

  if (!(await knex.schema.hasTable('image_favorites'))) {
    await knex.schema.createTable('image_favorites', table => {
      table.increments('id').primary();
      table.integer('image_id').notNullable();
      table.integer('user_id').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['image_id', 'user_id'], { indexName: 'uk_image_favorite_user' });
      table.index(['image_id', 'created_at'], 'idx_image_favorites_image');
      table.index(['user_id', 'created_at'], 'idx_image_favorites_user');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('image_favorites');
  await knex.schema.dropTableIfExists('image_likes');
  if (await knex.schema.hasColumn('users', 'nickname')) {
    await knex.schema.alterTable('users', table => table.dropColumn('nickname'));
  }
}
