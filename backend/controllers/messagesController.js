const knex = require('../db');

const messagesController = {
  // Get conversations for the authenticated user
  getConversations: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const conversations = await knex('conversations')
        .select(
          'conversations.id',
          'conversations.created_at',
          'conversations.updated_at',
          'u1.id as participant1_id',
          'u1.username as participant1_username',
          'u1.display_name as participant1_display_name',
          'u1.avatar_url as participant1_avatar',
          'u2.id as participant2_id',
          'u2.username as participant2_username',
          'u2.display_name as participant2_display_name',
          'u2.avatar_url as participant2_avatar',
          'pm.content as last_message_content',
          'pm.created_at as last_message_time',
          'pm.sender_id as last_message_sender_id',
          knex.raw('COUNT(CASE WHEN pm_unread.is_read = false AND pm_unread.receiver_id = ? THEN 1 END) as unread_count', [userId])
        )
        .join('users as u1', 'u1.id', 'conversations.participant1_id')
        .join('users as u2', 'u2.id', 'conversations.participant2_id')
        .leftJoin('private_messages as pm', function() {
          this.on('pm.conversation_id', '=', 'conversations.id')
              .andOn('pm.created_at', '=', knex.raw('(SELECT MAX(created_at) FROM private_messages WHERE conversation_id = conversations.id)'));
        })
        .leftJoin('private_messages as pm_unread', 'pm_unread.conversation_id', 'conversations.id')
        .where(function() {
          this.where('conversations.participant1_id', userId)
              .orWhere('conversations.participant2_id', userId);
        })
        .groupBy(
          'conversations.id',
          'conversations.created_at',
          'conversations.updated_at',
          'u1.id', 'u1.username', 'u1.display_name', 'u1.avatar_url',
          'u2.id', 'u2.username', 'u2.display_name', 'u2.avatar_url',
          'pm.content', 'pm.created_at', 'pm.sender_id'
        )
        .orderBy('conversations.updated_at', 'desc');

      // Transform the results to show the other participant
      const transformedConversations = conversations.map(conv => {
        const isParticipant1 = conv.participant1_id === userId;
        const otherParticipant = isParticipant1 ? {
          id: conv.participant2_id,
          username: conv.participant2_username,
          display_name: conv.participant2_display_name,
          avatar_url: conv.participant2_avatar
        } : {
          id: conv.participant1_id,
          username: conv.participant1_username,
          display_name: conv.participant1_display_name,
          avatar_url: conv.participant1_avatar
        };

        return {
          id: conv.id,
          other_participant: otherParticipant,
          last_message: {
            content: conv.last_message_content,
            created_at: conv.last_message_time,
            sender_id: conv.last_message_sender_id
          },
          unread_count: parseInt(conv.unread_count) || 0,
          created_at: conv.created_at,
          updated_at: conv.updated_at
        };
      });

      res.json(transformedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  },

  // Get or create a conversation with a specific user
  getOrCreateConversation: async (req, res) => {
    try {
      const userId = req.user.id;
      const { participantId } = req.params;

      // Check if users are friends
      const friendship = await knex('friendships')
        .where(function() {
          this.where('user1_id', userId).andWhere('user2_id', participantId);
        })
        .orWhere(function() {
          this.where('user1_id', participantId).andWhere('user2_id', userId);
        })
        .andWhere('status', 'accepted')
        .first();

      if (!friendship) {
        return res.status(403).json({ error: 'Can only message friends' });
      }

      // Try to find existing conversation
      let conversation = await knex('conversations')
        .where(function() {
          this.where('participant1_id', userId).andWhere('participant2_id', participantId);
        })
        .orWhere(function() {
          this.where('participant1_id', participantId).andWhere('participant2_id', userId);
        })
        .first();

      if (!conversation) {
        // Create new conversation
        const [newConversation] = await knex('conversations')
          .insert({
            participant1_id: Math.min(userId, participantId),
            participant2_id: Math.max(userId, participantId),
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning('*');
        
        conversation = newConversation;
      }

      // Get the other participant info
      const otherParticipant = await knex('users')
        .select('id', 'username', 'display_name', 'avatar_url', 'is_online')
        .where('id', participantId)
        .first();

      res.json({
        id: conversation.id,
        other_participant: otherParticipant,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at
      });
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      res.status(500).json({ error: 'Failed to get/create conversation' });
    }
  },

  // Get messages for a specific conversation
  getMessages: async (req, res) => {
    try {
      const userId = req.user.id;
      const { conversationId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Verify user is part of this conversation
      const conversation = await knex('conversations')
        .where('id', conversationId)
        .andWhere(function() {
          this.where('participant1_id', userId).orWhere('participant2_id', userId);
        })
        .first();

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Get messages
      const messages = await knex('private_messages')
        .select(
          'private_messages.id',
          'private_messages.content',
          'private_messages.sender_id',
          'private_messages.receiver_id',
          'private_messages.is_read',
          'private_messages.created_at',
          'users.username as sender_username',
          'users.display_name as sender_display_name',
          'users.avatar_url as sender_avatar'
        )
        .join('users', 'users.id', 'private_messages.sender_id')
        .where('private_messages.conversation_id', conversationId)
        .orderBy('private_messages.created_at', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      // Mark messages as read
      await knex('private_messages')
        .where('conversation_id', conversationId)
        .andWhere('receiver_id', userId)
        .andWhere('is_read', false)
        .update({ is_read: true });

      res.json(messages.reverse()); // Reverse to show oldest first
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  },

  // Send a message
  sendMessage: async (req, res) => {
    try {
      const userId = req.user.id;
      const { conversationId } = req.params;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      // Verify user is part of this conversation
      const conversation = await knex('conversations')
        .where('id', conversationId)
        .andWhere(function() {
          this.where('participant1_id', userId).orWhere('participant2_id', userId);
        })
        .first();

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Determine receiver
      const receiverId = conversation.participant1_id === userId 
        ? conversation.participant2_id 
        : conversation.participant1_id;

      // Check if users are still friends
      const friendship = await knex('friendships')
        .where(function() {
          this.where('user1_id', userId).andWhere('user2_id', receiverId);
        })
        .orWhere(function() {
          this.where('user1_id', receiverId).andWhere('user2_id', userId);
        })
        .andWhere('status', 'accepted')
        .first();

      if (!friendship) {
        return res.status(403).json({ error: 'Can only message friends' });
      }

      // Create message
      const [message] = await knex('private_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          receiver_id: receiverId,
          content: content.trim(),
          is_read: false,
          created_at: new Date()
        })
        .returning('*');

      // Update conversation timestamp
      await knex('conversations')
        .where('id', conversationId)
        .update({ updated_at: new Date() });

      // Get sender info for the response
      const sender = await knex('users')
        .select('username', 'display_name', 'avatar_url')
        .where('id', userId)
        .first();

      const messageWithSender = {
        ...message,
        sender_username: sender.username,
        sender_display_name: sender.display_name,
        sender_avatar: sender.avatar_url
      };

      // Emit real-time message to receiver
      global.io.to(`user_${receiverId}`).emit('newMessage', messageWithSender);

      res.status(201).json(messageWithSender);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  },

  // Delete a message
  deleteMessage: async (req, res) => {
    try {
      const userId = req.user.id;
      const { messageId } = req.params;

      // Verify user owns this message
      const message = await knex('private_messages')
        .where('id', messageId)
        .andWhere('sender_id', userId)
        .first();

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Delete message
      await knex('private_messages')
        .where('id', messageId)
        .del();

      // Emit real-time message deletion
      global.io.to(`user_${message.receiver_id}`).emit('messageDeleted', messageId);

      res.json({ message: 'Message deleted successfully' });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
};

module.exports = messagesController;