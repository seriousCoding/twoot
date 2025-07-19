exports.up = function(knex) {
  return Promise.all([
    // Game invitations table
    knex.schema.createTable('game_invites', function(table) {
      table.increments('id').primary();
      table.integer('sender_id').unsigned().notNullable();
      table.integer('receiver_id').unsigned().notNullable();
      table.string('game_type').notNullable(); // chess, pacman, code-seek, etc.
      table.string('room_id').notNullable();
      table.text('message');
      table.enum('status', ['pending', 'accepted', 'declined', 'cancelled', 'expired']).defaultTo('pending');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').notNullable();
      table.timestamp('responded_at');
      
      table.foreign('sender_id').references('users.id').onDelete('CASCADE');
      table.foreign('receiver_id').references('users.id').onDelete('CASCADE');
      
      table.index(['receiver_id', 'status']);
      table.index(['sender_id', 'status']);
      table.index(['expires_at']);
    }),

    // Game sessions table for active games
    knex.schema.createTable('game_sessions', function(table) {
      table.increments('id').primary();
      table.string('room_id').unique().notNullable();
      table.string('game_type').notNullable();
      table.integer('host_id').unsigned().notNullable();
      table.enum('status', ['waiting', 'active', 'paused', 'completed']).defaultTo('waiting');
      table.boolean('is_public').defaultTo(true);
      table.integer('max_players').defaultTo(4);
      table.integer('current_players').defaultTo(1);
      table.json('game_settings'); // Store game-specific settings
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('started_at');
      table.timestamp('ended_at');
      
      table.foreign('host_id').references('users.id').onDelete('CASCADE');
      
      table.index(['game_type', 'status']);
      table.index(['host_id', 'status']);
      table.index(['is_public', 'status']);
    }),

    // Game players table for tracking who's in each game
    knex.schema.createTable('game_players', function(table) {
      table.increments('id').primary();
      table.integer('session_id').unsigned().notNullable();
      table.integer('user_id').unsigned().notNullable();
      table.enum('role', ['host', 'player', 'spectator']).defaultTo('player');
      table.json('player_data'); // Store player-specific game data
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.timestamp('left_at');
      
      table.foreign('session_id').references('game_sessions.id').onDelete('CASCADE');
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      table.unique(['session_id', 'user_id']);
      table.index(['user_id']);
    }),

    // Game notifications table for various game-related notifications
    knex.schema.createTable('game_notifications', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable();
      table.enum('type', [
        'game_invite', 
        'invite_accepted', 
        'invite_declined', 
        'game_started', 
        'game_ended', 
        'player_joined', 
        'player_left',
        'friend_online'
      ]).notNullable();
      table.string('title').notNullable();
      table.text('message');
      table.json('data'); // Store notification-specific data
      table.boolean('is_read').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('read_at');
      
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      table.index(['user_id', 'is_read']);
      table.index(['created_at']);
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('game_notifications'),
    knex.schema.dropTableIfExists('game_players'),
    knex.schema.dropTableIfExists('game_sessions'),
    knex.schema.dropTableIfExists('game_invites')
  ]);
};