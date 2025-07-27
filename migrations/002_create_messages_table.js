exports.up = async function(knex) {
  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE');
    table.enum('role', ['user', 'assistant', 'system']).notNullable();
    table.text('content').notNullable();
    table.string('platform_message_id').nullable();
    table.jsonb('platform_data').nullable();
    table.integer('token_count').nullable();
    table.string('ai_provider').nullable();
    table.string('ai_model').nullable();
    table.decimal('ai_cost', 10, 6).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['conversation_id', 'created_at']);
    table.index(['platform_message_id']);
    table.index(['role']);
    table.index(['ai_provider']);
    table.index(['created_at']);
  });
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('messages');
};