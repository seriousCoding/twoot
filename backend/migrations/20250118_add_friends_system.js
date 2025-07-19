exports.up = function(knex) {
  return knex.schema
    // First, extend the users table with additional fields
    .table('users', function(table) {
      table.string('display_name', 100);
      table.string('avatar_url', 255);
      table.string('status', 20).defaultTo('offline');
      table.timestamp('last_seen');
      table.text('bio');
      table.boolean('is_online').defaultTo(false);
    })
    // Create friendships table
    .createTable('friendships', function(table) {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.integer('friend_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('status', 20).defaultTo('accepted'); // accepted, blocked
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['user_id', 'friend_id']);
      table.check('user_id != friend_id');
    })
    // Create friend_requests table
    .createTable('friend_requests', function(table) {
      table.increments('id').primary();
      table.integer('requester_id').references('id').inTable('users').onDelete('CASCADE');
      table.integer('requestee_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('status', 20).defaultTo('pending'); // pending, accepted, declined
      table.text('message');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['requester_id', 'requestee_id']);
      table.check('requester_id != requestee_id');
    })
    // Create user_sessions table for presence tracking
    .createTable('user_sessions', function(table) {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('socket_id', 100).unique();
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('last_activity').defaultTo(knex.fn.now());
    })
    // Create private_messages table
    .createTable('private_messages', function(table) {
      table.increments('id').primary();
      table.integer('sender_id').references('id').inTable('users').onDelete('CASCADE');
      table.integer('recipient_id').references('id').inTable('users').onDelete('CASCADE');
      table.text('message_text').notNullable();
      table.string('message_type', 20).defaultTo('text'); // text, image, game_invite, system
      table.json('metadata'); // For storing additional data like game invites
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('read_at');
      table.timestamp('deleted_at');
    })
    // Create conversations table
    .createTable('conversations', function(table) {
      table.increments('id').primary();
      table.integer('participant_1').references('id').inTable('users').onDelete('CASCADE');
      table.integer('participant_2').references('id').inTable('users').onDelete('CASCADE');
      table.integer('last_message_id').references('id').inTable('private_messages');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['participant_1', 'participant_2']);
      table.check('participant_1 < participant_2');
    })
    // Add indexes for performance
    .raw('CREATE INDEX idx_friendships_user_id ON friendships(user_id)')
    .raw('CREATE INDEX idx_friendships_friend_id ON friendships(friend_id)')
    .raw('CREATE INDEX idx_friend_requests_requestee ON friend_requests(requestee_id)')
    .raw('CREATE INDEX idx_friend_requests_requester ON friend_requests(requester_id)')
    .raw('CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id)')
    .raw('CREATE INDEX idx_users_display_name ON users(display_name)')
    .raw('CREATE INDEX idx_private_messages_sender ON private_messages(sender_id, created_at)')
    .raw('CREATE INDEX idx_private_messages_recipient ON private_messages(recipient_id, read_at)')
    .raw('CREATE INDEX idx_conversations_participants ON conversations(participant_1, participant_2)');
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('conversations')
    .dropTable('private_messages')
    .dropTable('user_sessions')
    .dropTable('friend_requests')
    .dropTable('friendships')
    .table('users', function(table) {
      table.dropColumn('display_name');
      table.dropColumn('avatar_url');
      table.dropColumn('status');
      table.dropColumn('last_seen');
      table.dropColumn('bio');
      table.dropColumn('is_online');
    });
};