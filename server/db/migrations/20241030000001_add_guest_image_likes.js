export async function up(knex) {
  if (!(await knex.schema.hasTable('image_guest_likes'))) {
    await knex.schema.createTable('image_guest_likes', table => {
      table.increments('id').primary();
      table.integer('image_id').notNullable();
      table.string('visitor_hash', 64).notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['image_id', 'visitor_hash'], { indexName: 'uk_image_guest_like_visitor' });
      table.index(['image_id', 'created_at'], 'idx_image_guest_likes_image');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('image_guest_likes');
}
