exports.up = async function(knex) {
  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) return;

  const hasReviewStatus = await knex.schema.hasColumn('users', 'review_status');
  if (!hasReviewStatus) {
    await knex.schema.table('users', (table) => {
      table.string('review_status', 24).notNullable().defaultTo('approved').after('is_disabled');
    });
  }

  await knex('users')
    .whereNull('review_status')
    .orWhere('review_status', '')
    .update({ review_status: 'approved' });
};

exports.down = async function(knex) {
  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) return;
  const hasReviewStatus = await knex.schema.hasColumn('users', 'review_status');
  if (hasReviewStatus) {
    await knex.schema.table('users', (table) => {
      table.dropColumn('review_status');
    });
  }
};
