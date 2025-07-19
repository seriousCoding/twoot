const knex = require('../db');

const gameInvitesController = {
  // Send a game invitation
  sendGameInvite: async (req, res) => {
    try {
      const senderId = req.user.id;
      const { receiverId, gameType, roomId, message } = req.body;

      if (!receiverId || !gameType) {
        return res.status(400).json({ error: 'Receiver ID and game type are required' });
      }

      // Check if users are friends
      const friendship = await knex('friendships')
        .where(function() {
          this.where('user1_id', senderId).andWhere('user2_id', receiverId);
        })
        .orWhere(function() {
          this.where('user1_id', receiverId).andWhere('user2_id', senderId);
        })
        .andWhere('status', 'accepted')
        .first();

      if (!friendship) {
        return res.status(403).json({ error: 'Can only invite friends to games' });
      }

      // Check if there's already a pending invitation
      const existingInvite = await knex('game_invites')
        .where('sender_id', senderId)
        .andWhere('receiver_id', receiverId)
        .andWhere('game_type', gameType)
        .andWhere('status', 'pending')
        .first();

      if (existingInvite) {
        return res.status(400).json({ error: 'Game invitation already sent' });
      }

      // Create game invitation
      const [invitation] = await knex('game_invites')
        .insert({
          sender_id: senderId,
          receiver_id: receiverId,
          game_type: gameType,
          room_id: roomId || `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: message || `Join me for a game of ${gameType}!`,
          status: 'pending',
          created_at: new Date(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        })
        .returning('*');

      // Get sender info for the invitation
      const sender = await knex('users')
        .select('username', 'display_name', 'avatar_url')
        .where('id', senderId)
        .first();

      const invitationWithSender = {
        ...invitation,
        sender_username: sender.username,
        sender_display_name: sender.display_name,
        sender_avatar: sender.avatar_url
      };

      // Emit real-time invitation to receiver
      global.io.to(`user_${receiverId}`).emit('gameInvitation', invitationWithSender);

      res.status(201).json(invitationWithSender);
    } catch (error) {
      console.error('Error sending game invitation:', error);
      res.status(500).json({ error: 'Failed to send game invitation' });
    }
  },

  // Get received game invitations
  getReceivedInvites: async (req, res) => {
    try {
      const userId = req.user.id;

      const invitations = await knex('game_invites')
        .select(
          'game_invites.*',
          'users.username as sender_username',
          'users.display_name as sender_display_name',
          'users.avatar_url as sender_avatar'
        )
        .join('users', 'users.id', 'game_invites.sender_id')
        .where('game_invites.receiver_id', userId)
        .andWhere('game_invites.status', 'pending')
        .andWhere('game_invites.expires_at', '>', new Date())
        .orderBy('game_invites.created_at', 'desc');

      res.json(invitations);
    } catch (error) {
      console.error('Error fetching game invitations:', error);
      res.status(500).json({ error: 'Failed to fetch game invitations' });
    }
  },

  // Get sent game invitations
  getSentInvites: async (req, res) => {
    try {
      const userId = req.user.id;

      const invitations = await knex('game_invites')
        .select(
          'game_invites.*',
          'users.username as receiver_username',
          'users.display_name as receiver_display_name',
          'users.avatar_url as receiver_avatar'
        )
        .join('users', 'users.id', 'game_invites.receiver_id')
        .where('game_invites.sender_id', userId)
        .andWhere('game_invites.expires_at', '>', new Date())
        .orderBy('game_invites.created_at', 'desc');

      res.json(invitations);
    } catch (error) {
      console.error('Error fetching sent invitations:', error);
      res.status(500).json({ error: 'Failed to fetch sent invitations' });
    }
  },

  // Respond to a game invitation
  respondToInvite: async (req, res) => {
    try {
      const userId = req.user.id;
      const { inviteId } = req.params;
      const { response } = req.body;

      if (!['accepted', 'declined'].includes(response)) {
        return res.status(400).json({ error: 'Response must be accepted or declined' });
      }

      // Get the invitation
      const invitation = await knex('game_invites')
        .where('id', inviteId)
        .andWhere('receiver_id', userId)
        .andWhere('status', 'pending')
        .andWhere('expires_at', '>', new Date())
        .first();

      if (!invitation) {
        return res.status(404).json({ error: 'Game invitation not found or expired' });
      }

      // Update invitation status
      await knex('game_invites')
        .where('id', inviteId)
        .update({
          status: response,
          responded_at: new Date()
        });

      // Get updated invitation with sender info
      const updatedInvitation = await knex('game_invites')
        .select(
          'game_invites.*',
          'users.username as sender_username',
          'users.display_name as sender_display_name',
          'users.avatar_url as sender_avatar'
        )
        .join('users', 'users.id', 'game_invites.sender_id')
        .where('game_invites.id', inviteId)
        .first();

      // Emit real-time response to sender
      global.io.to(`user_${invitation.sender_id}`).emit('gameInviteResponse', {
        ...updatedInvitation,
        response
      });

      res.json({ message: `Game invitation ${response}`, invitation: updatedInvitation });
    } catch (error) {
      console.error('Error responding to game invitation:', error);
      res.status(500).json({ error: 'Failed to respond to game invitation' });
    }
  },

  // Cancel a sent game invitation
  cancelInvite: async (req, res) => {
    try {
      const userId = req.user.id;
      const { inviteId } = req.params;

      // Get the invitation
      const invitation = await knex('game_invites')
        .where('id', inviteId)
        .andWhere('sender_id', userId)
        .andWhere('status', 'pending')
        .first();

      if (!invitation) {
        return res.status(404).json({ error: 'Game invitation not found' });
      }

      // Update invitation status to cancelled
      await knex('game_invites')
        .where('id', inviteId)
        .update({
          status: 'cancelled',
          responded_at: new Date()
        });

      // Emit real-time cancellation to receiver
      global.io.to(`user_${invitation.receiver_id}`).emit('gameInviteCancelled', inviteId);

      res.json({ message: 'Game invitation cancelled' });
    } catch (error) {
      console.error('Error cancelling game invitation:', error);
      res.status(500).json({ error: 'Failed to cancel game invitation' });
    }
  },

  // Get active game rooms that friends can join
  getActiveGameRooms: async (req, res) => {
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

      // Get active game rooms from friends
      const activeRooms = await knex('game_sessions')
        .select(
          'game_sessions.*',
          'users.username as host_username',
          'users.display_name as host_display_name',
          'users.avatar_url as host_avatar'
        )
        .join('users', 'users.id', 'game_sessions.host_id')
        .whereIn('game_sessions.host_id', friendIds)
        .andWhere('game_sessions.status', 'active')
        .andWhere('game_sessions.is_public', true)
        .andWhere('game_sessions.current_players', '<', knex.raw('game_sessions.max_players'))
        .orderBy('game_sessions.created_at', 'desc');

      res.json(activeRooms);
    } catch (error) {
      console.error('Error fetching active game rooms:', error);
      res.status(500).json({ error: 'Failed to fetch active game rooms' });
    }
  },

  // Join an active game room
  joinGameRoom: async (req, res) => {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;

      // Get the game session
      const gameSession = await knex('game_sessions')
        .where('room_id', roomId)
        .andWhere('status', 'active')
        .andWhere('is_public', true)
        .first();

      if (!gameSession) {
        return res.status(404).json({ error: 'Game room not found or not available' });
      }

      // Check if room is full
      if (gameSession.current_players >= gameSession.max_players) {
        return res.status(400).json({ error: 'Game room is full' });
      }

      // Check if user is already in the room
      const existingPlayer = await knex('game_players')
        .where('session_id', gameSession.id)
        .andWhere('user_id', userId)
        .first();

      if (existingPlayer) {
        return res.status(400).json({ error: 'Already in this game room' });
      }

      // Add player to the game
      await knex('game_players')
        .insert({
          session_id: gameSession.id,
          user_id: userId,
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

      // Emit real-time notification to all players in the room
      global.io.to(`game_room_${roomId}`).emit('playerJoined', {
        user,
        roomId,
        gameType: gameSession.game_type
      });

      res.json({
        message: 'Successfully joined game room',
        roomId,
        gameType: gameSession.game_type,
        redirect: `/${gameSession.game_type}?room=${roomId}`
      });
    } catch (error) {
      console.error('Error joining game room:', error);
      res.status(500).json({ error: 'Failed to join game room' });
    }
  }
};

module.exports = gameInvitesController;