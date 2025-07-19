const knex = require('../db');

const gameRoomController = {
  // Create a new game room
  createGameRoom: async (req, res) => {
    try {
      const hostId = req.user.id;
      const { gameType, isPublic = true, maxPlayers = 4, allowSpectators = true, friendsOnly = false, roomName, gameSettings } = req.body;

      if (!gameType) {
        return res.status(400).json({ error: 'Game type is required' });
      }

      // Generate unique room ID
      const roomId = `${gameType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create game session
      const [gameSession] = await knex('game_sessions')
        .insert({
          room_id: roomId,
          game_type: gameType,
          host_id: hostId,
          status: 'waiting',
          is_public: isPublic && !friendsOnly, // Friend-only rooms are not public
          max_players: maxPlayers,
          current_players: 1,
          game_settings: JSON.stringify({
            ...gameSettings,
            allowSpectators,
            friendsOnly,
            roomName: roomName || `${gameType} Room`
          }),
          created_at: new Date()
        })
        .returning('*');

      // Add host as first player
      await knex('game_players')
        .insert({
          session_id: gameSession.id,
          user_id: hostId,
          role: 'host',
          joined_at: new Date()
        });

      // Get host info
      const host = await knex('users')
        .select('username', 'display_name', 'avatar_url')
        .where('id', hostId)
        .first();

      // Emit room creation to friends if it's a friends-only room
      if (friendsOnly) {
        const friends = await knex('friendships')
          .select(
            knex.raw('CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END as friend_id', [hostId])
          )
          .where(function() {
            this.where('user1_id', hostId).orWhere('user2_id', hostId);
          })
          .andWhere('status', 'accepted');

        const friendIds = friends.map(f => f.friend_id);
        friendIds.forEach(friendId => {
          global.io.to(`user_${friendId}`).emit('friendGameRoomCreated', {
            roomId,
            gameType,
            hostName: host.display_name || host.username,
            roomName: roomName || `${gameType} Room`,
            maxPlayers,
            currentPlayers: 1,
            allowSpectators
          });
        });
      }

      // Join the host to the room
      global.io.sockets.sockets.forEach(socket => {
        if (socket.userId === hostId) {
          socket.join(`game_room_${roomId}`);
        }
      });

      res.status(201).json({
        gameSession: {
          ...gameSession,
          host_username: host.username,
          host_display_name: host.display_name,
          host_avatar: host.avatar_url
        },
        roomId,
        redirectUrl: `/${gameType}?room=${roomId}&host=true`
      });
    } catch (error) {
      console.error('Error creating game room:', error);
      res.status(500).json({ error: 'Failed to create game room' });
    }
  },

  // Join a game room
  joinGameRoom: async (req, res) => {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const { asSpectator = false } = req.body;

      // Get the game session
      const gameSession = await knex('game_sessions')
        .where('room_id', roomId)
        .first();

      if (!gameSession) {
        return res.status(404).json({ error: 'Game room not found' });
      }

      // Parse game settings
      const gameSettings = JSON.parse(gameSession.game_settings || '{}');

      // Check if room is friends-only
      if (gameSettings.friendsOnly) {
        const isFriend = await knex('friendships')
          .where(function() {
            this.where('user1_id', userId).andWhere('user2_id', gameSession.host_id);
          })
          .orWhere(function() {
            this.where('user1_id', gameSession.host_id).andWhere('user2_id', userId);
          })
          .andWhere('status', 'accepted')
          .first();

        if (!isFriend && userId !== gameSession.host_id) {
          return res.status(403).json({ error: 'This is a friends-only room' });
        }
      }

      // Check if joining as spectator
      if (asSpectator) {
        if (!gameSettings.allowSpectators) {
          return res.status(403).json({ error: 'Spectators are not allowed in this room' });
        }

        // Check if already spectating
        const existingSpectator = await knex('game_players')
          .where('session_id', gameSession.id)
          .andWhere('user_id', userId)
          .andWhere('role', 'spectator')
          .first();

        if (existingSpectator) {
          return res.status(400).json({ error: 'Already spectating this room' });
        }

        // Add as spectator
        await knex('game_players')
          .insert({
            session_id: gameSession.id,
            user_id: userId,
            role: 'spectator',
            joined_at: new Date()
          });

        // Get user info
        const user = await knex('users')
          .select('username', 'display_name', 'avatar_url')
          .where('id', userId)
          .first();

        // Emit spectator joined event
        global.io.to(`game_room_${roomId}`).emit('spectatorJoined', {
          user,
          roomId,
          gameType: gameSession.game_type
        });

        // Join socket room
        global.io.sockets.sockets.forEach(socket => {
          if (socket.userId === userId) {
            socket.join(`game_room_${roomId}`);
          }
        });

        return res.json({
          message: 'Successfully joined as spectator',
          roomId,
          gameType: gameSession.game_type,
          role: 'spectator',
          redirectUrl: `/${gameSession.game_type}?room=${roomId}&spectator=true`
        });
      }

      // Joining as player
      if (gameSession.current_players >= gameSession.max_players) {
        return res.status(400).json({ error: 'Game room is full' });
      }

      // Check if already in the room as player
      const existingPlayer = await knex('game_players')
        .where('session_id', gameSession.id)
        .andWhere('user_id', userId)
        .andWhere('role', '!=', 'spectator')
        .first();

      if (existingPlayer) {
        return res.status(400).json({ error: 'Already in this game room' });
      }

      // Add player to the game
      await knex('game_players')
        .insert({
          session_id: gameSession.id,
          user_id: userId,
          role: 'player',
          joined_at: new Date()
        });

      // Update player count
      await knex('game_sessions')
        .where('id', gameSession.id)
        .increment('current_players', 1);

      // Get user info
      const user = await knex('users')
        .select('username', 'display_name', 'avatar_url')
        .where('id', userId)
        .first();

      // Emit player joined event
      global.io.to(`game_room_${roomId}`).emit('playerJoined', {
        user,
        roomId,
        gameType: gameSession.game_type,
        currentPlayers: gameSession.current_players + 1,
        maxPlayers: gameSession.max_players
      });

      // Join socket room
      global.io.sockets.sockets.forEach(socket => {
        if (socket.userId === userId) {
          socket.join(`game_room_${roomId}`);
        }
      });

      res.json({
        message: 'Successfully joined game room',
        roomId,
        gameType: gameSession.game_type,
        role: 'player',
        redirectUrl: `/${gameSession.game_type}?room=${roomId}`
      });
    } catch (error) {
      console.error('Error joining game room:', error);
      res.status(500).json({ error: 'Failed to join game room' });
    }
  },

  // Leave a game room
  leaveGameRoom: async (req, res) => {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;

      // Get the game session
      const gameSession = await knex('game_sessions')
        .where('room_id', roomId)
        .first();

      if (!gameSession) {
        return res.status(404).json({ error: 'Game room not found' });
      }

      // Get player info
      const player = await knex('game_players')
        .where('session_id', gameSession.id)
        .andWhere('user_id', userId)
        .first();

      if (!player) {
        return res.status(404).json({ error: 'Not in this game room' });
      }

      // Remove player from the game
      await knex('game_players')
        .where('id', player.id)
        .del();

      // Update player count if not a spectator
      if (player.role !== 'spectator') {
        await knex('game_sessions')
          .where('id', gameSession.id)
          .decrement('current_players', 1);
      }

      // Get user info
      const user = await knex('users')
        .select('username', 'display_name', 'avatar_url')
        .where('id', userId)
        .first();

      // Emit player left event
      global.io.to(`game_room_${roomId}`).emit('playerLeft', {
        user,
        roomId,
        gameType: gameSession.game_type,
        role: player.role,
        currentPlayers: Math.max(0, gameSession.current_players - (player.role !== 'spectator' ? 1 : 0))
      });

      // Leave socket room
      global.io.sockets.sockets.forEach(socket => {
        if (socket.userId === userId) {
          socket.leave(`game_room_${roomId}`);
        }
      });

      // If host left, transfer ownership or close room
      if (player.role === 'host') {
        const remainingPlayers = await knex('game_players')
          .where('session_id', gameSession.id)
          .andWhere('role', '!=', 'spectator')
          .orderBy('joined_at', 'asc');

        if (remainingPlayers.length > 0) {
          // Transfer host to next player
          await knex('game_players')
            .where('id', remainingPlayers[0].id)
            .update({ role: 'host' });

          // Update session host
          await knex('game_sessions')
            .where('id', gameSession.id)
            .update({ host_id: remainingPlayers[0].user_id });

          // Emit host change event
          global.io.to(`game_room_${roomId}`).emit('hostChanged', {
            newHostId: remainingPlayers[0].user_id,
            roomId
          });
        } else {
          // No players left, close the room
          await knex('game_sessions')
            .where('id', gameSession.id)
            .update({ status: 'completed', ended_at: new Date() });

          // Emit room closed event
          global.io.to(`game_room_${roomId}`).emit('roomClosed', { roomId });
        }
      }

      res.json({ message: 'Successfully left game room' });
    } catch (error) {
      console.error('Error leaving game room:', error);
      res.status(500).json({ error: 'Failed to leave game room' });
    }
  },

  // Get room info
  getRoomInfo: async (req, res) => {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;

      // Get the game session with host info
      const gameSession = await knex('game_sessions')
        .select(
          'game_sessions.*',
          'users.username as host_username',
          'users.display_name as host_display_name',
          'users.avatar_url as host_avatar'
        )
        .join('users', 'users.id', 'game_sessions.host_id')
        .where('game_sessions.room_id', roomId)
        .first();

      if (!gameSession) {
        return res.status(404).json({ error: 'Game room not found' });
      }

      // Get all players and spectators
      const participants = await knex('game_players')
        .select(
          'game_players.*',
          'users.username',
          'users.display_name',
          'users.avatar_url'
        )
        .join('users', 'users.id', 'game_players.user_id')
        .where('game_players.session_id', gameSession.id)
        .orderBy('game_players.joined_at', 'asc');

      const players = participants.filter(p => p.role !== 'spectator');
      const spectators = participants.filter(p => p.role === 'spectator');

      // Check if user is in the room
      const userParticipant = participants.find(p => p.user_id === userId);

      // Parse game settings
      const gameSettings = JSON.parse(gameSession.game_settings || '{}');

      res.json({
        roomId: gameSession.room_id,
        gameType: gameSession.game_type,
        status: gameSession.status,
        host: {
          id: gameSession.host_id,
          username: gameSession.host_username,
          display_name: gameSession.host_display_name,
          avatar_url: gameSession.host_avatar
        },
        players,
        spectators,
        maxPlayers: gameSession.max_players,
        currentPlayers: gameSession.current_players,
        gameSettings,
        userRole: userParticipant?.role || null,
        isParticipant: !!userParticipant,
        createdAt: gameSession.created_at,
        startedAt: gameSession.started_at
      });
    } catch (error) {
      console.error('Error getting room info:', error);
      res.status(500).json({ error: 'Failed to get room info' });
    }
  },

  // Get friend-only rooms
  getFriendRooms: async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user's friends
      const friends = await knex('friendships')
        .select(
          knex.raw('CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END as friend_id', [userId])
        )
        .where(function() {
          this.where('user1_id', userId).orWhere('user2_id', userId);
        })
        .andWhere('status', 'accepted');

      const friendIds = friends.map(f => f.friend_id);

      if (friendIds.length === 0) {
        return res.json([]);
      }

      // Get active friend rooms
      const friendRooms = await knex('game_sessions')
        .select(
          'game_sessions.*',
          'users.username as host_username',
          'users.display_name as host_display_name',
          'users.avatar_url as host_avatar'
        )
        .join('users', 'users.id', 'game_sessions.host_id')
        .whereIn('game_sessions.host_id', friendIds)
        .andWhere('game_sessions.status', 'active')
        .whereRaw("JSON_EXTRACT(game_settings, '$.friendsOnly') = true")
        .orderBy('game_sessions.created_at', 'desc');

      // Add room settings
      const roomsWithSettings = friendRooms.map(room => ({
        ...room,
        gameSettings: JSON.parse(room.game_settings || '{}')
      }));

      res.json(roomsWithSettings);
    } catch (error) {
      console.error('Error fetching friend rooms:', error);
      res.status(500).json({ error: 'Failed to fetch friend rooms' });
    }
  },

  // Start game in room
  startGame: async (req, res) => {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;

      // Get the game session
      const gameSession = await knex('game_sessions')
        .where('room_id', roomId)
        .andWhere('host_id', userId)
        .first();

      if (!gameSession) {
        return res.status(404).json({ error: 'Game room not found or you are not the host' });
      }

      if (gameSession.status !== 'waiting') {
        return res.status(400).json({ error: 'Game has already started' });
      }

      // Update game status
      await knex('game_sessions')
        .where('id', gameSession.id)
        .update({
          status: 'active',
          started_at: new Date()
        });

      // Emit game started event
      global.io.to(`game_room_${roomId}`).emit('gameStarted', {
        roomId,
        gameType: gameSession.game_type,
        startedAt: new Date()
      });

      res.json({ message: 'Game started successfully' });
    } catch (error) {
      console.error('Error starting game:', error);
      res.status(500).json({ error: 'Failed to start game' });
    }
  }
};

module.exports = gameRoomController;