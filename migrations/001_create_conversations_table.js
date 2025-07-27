exports.up = async function(knex) {
  await knex.schema.createTable('conversations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('platform').notNullable();
    table.string('channel_id').notNullable();
    table.string('user_id').notNullable();
    table.string('title').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('last_message_at').defaultTo(knex.fn.now()).notNullable();
    table.integer('message_count').defaultTo(0).notNullable();
    table.boolean('is_active').defaultTo(true).notNullable();

    table.index(['platform', 'channel_id']);
    table.index(['user_id']);
    table.index(['is_active', 'last_message_at']);
    table.index(['platform', 'channel_id', 'user_id']);
  });
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('conversations');
};