export async function up(knex) {
  if (!(await knex.schema.hasColumn('albums', 'is_private'))) {
    await knex.schema.alterTable('albums', table => {
      table.boolean('is_private').notNullable().defaultTo(false).index();
    });
  }
  await knex('albums').whereIn('cover_image_id', knex('images').select('id').where({ nsfw_status: true }))
    .update({ cover_image_id: null });
}

export async function down(knex) {
  if (await knex.schema.hasColumn('albums', 'is_private')) {
    await knex.schema.alterTable('albums', table => table.dropColumn('is_private'));
  }
}
