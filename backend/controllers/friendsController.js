const db = require('../db');

class FriendsController {
  async getFriends(req, res) {
    try {
      const userId = req.user.id;
      
      const friends = await db('friendships')
        .join('users', function() {
          this.on('friendships.friend_id', '=', 'users.id')
              .andOn('friendships.user_id', '=', userId);
        })
        .orJoin('users', function() {
          this.on('friendships.user_id', '=', 'users.id')
              .andOn('friendships.friend_id', '=', userId);
        })
        .where('friendships.status', 'accepted')
        .andWhere('users.id', '!=', userId)
        .select([
          'users.id',
          'users.username',
          'users.display_name',
          'users.avatar_url',
          'users.status',
          'users.last_seen',
          'users.is_online',
          'friendships.created_at as friendship_date'
        ]);

      res.json(friends);
    } catch (error) {
      console.error('Error fetching friends:', error);
      res.status(500).json({ message: 'Error fetching friends', error: error.message });
    }
  }

  async searchUsers(req, res) {
    try {
      const { query } = req.query;
      const userId = req.user.id;

      if (!query || query.length < 2) {
        return res.status(400).json({ message: 'Query must be at least 2 characters' });
      }

      const users = await db('users')
        .where('username', 'ilike', `%${query}%`)
        .orWhere('display_name', 'ilike', `%${query}%`)
        .andWhere('id', '!=', userId)
        .select(['id', 'username', 'display_name', 'avatar_url', 'is_online'])
        .limit(10);

      // Check friendship status for each user
      const userIds = users.map(user => user.id);
      const friendships = await db('friendships')
        .where(function() {
          this.whereIn('user_id', userIds).andWhere('friend_id', userId);
        })
        .orWhere(function() {
          this.whereIn('friend_id', userIds).andWhere('user_id', userId);
        })
        .select(['user_id', 'friend_id', 'status']);

      const friendRequests = await db('friend_requests')
        .where(function() {
          this.whereIn('requester_id', userIds).andWhere('requestee_id', userId);
        })
        .orWhere(function() {
          this.whereIn('requestee_id', userIds).andWhere('requester_id', userId);
        })
        .select(['requester_id', 'requestee_id', 'status']);

      // Add friendship status to each user
      const usersWithStatus = users.map(user => {
        const friendship = friendships.find(f => 
          (f.user_id === user.id && f.friend_id === userId) ||
          (f.friend_id === user.id && f.user_id === userId)
        );
        
        const request = friendRequests.find(r => 
          (r.requester_id === user.id && r.requestee_id === userId) ||
          (r.requestee_id === user.id && r.requester_id === userId)
        );

        let relationshipStatus = 'none';
        if (friendship) {
          relationshipStatus = friendship.status;
        } else if (request) {
          if (request.requester_id === userId) {
            relationshipStatus = 'request_sent';
          } else {
            relationshipStatus = 'request_received';
          }
        }

        return {
          ...user,
          relationship_status: relationshipStatus
        };
      });

      res.json(usersWithStatus);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ message: 'Error searching users', error: error.message });
    }
  }

  async sendFriendRequest(req, res) {
    try {
      const requesterId = req.user.id;
      const { requesteeId, message } = req.body;

      if (!requesteeId) {
        return res.status(400).json({ message: 'Requestee ID is required' });
      }

      if (requesterId === requesteeId) {
        return res.status(400).json({ message: 'Cannot send friend request to yourself' });
      }

      // Check if friendship already exists
      const existingFriendship = await db('friendships')
        .where(function() {
          this.where({ user_id: requesterId, friend_id: requesteeId })
              .orWhere({ user_id: requesteeId, friend_id: requesterId });
        })
        .first();

      if (existingFriendship) {
        return res.status(400).json({ message: 'Friendship already exists' });
      }

      // Check if request already exists
      const existingRequest = await db('friend_requests')
        .where(function() {
          this.where({ requester_id: requesterId, requestee_id: requesteeId })
              .orWhere({ requester_id: requesteeId, requestee_id: requesterId });
        })
        .first();

      if (existingRequest) {
        return res.status(400).json({ message: 'Friend request already exists' });
      }

      // Create friend request
      const [request] = await db('friend_requests')
        .insert({
          requester_id: requesterId,
          requestee_id: requesteeId,
          message: message || null
        })
        .returning('*');

      res.status(201).json({ message: 'Friend request sent', request });
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ message: 'Error sending friend request', error: error.message });
    }
  }

  async respondToFriendRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { response } = req.body; // 'accepted' or 'declined'
      const userId = req.user.id;

      if (!['accepted', 'declined'].includes(response)) {
        return res.status(400).json({ message: 'Invalid response. Must be "accepted" or "declined"' });
      }

      const request = await db('friend_requests')
        .where({ id: requestId, requestee_id: userId })
        .first();

      if (!request) {
        return res.status(404).json({ message: 'Friend request not found' });
      }

      // Update request status
      await db('friend_requests')
        .where({ id: requestId })
        .update({ status: response, updated_at: new Date() });

      if (response === 'accepted') {
        // Create friendship
        await db('friendships').insert({
          user_id: Math.min(request.requester_id, userId),
          friend_id: Math.max(request.requester_id, userId),
          status: 'accepted'
        });
      }

      res.json({ message: `Friend request ${response}` });
    } catch (error) {
      console.error('Error responding to friend request:', error);
      res.status(500).json({ message: 'Error responding to friend request', error: error.message });
    }
  }

  async getPendingRequests(req, res) {
    try {
      const userId = req.user.id;

      const requests = await db('friend_requests')
        .join('users', 'friend_requests.requester_id', 'users.id')
        .where('friend_requests.requestee_id', userId)
        .andWhere('friend_requests.status', 'pending')
        .select([
          'friend_requests.id',
          'friend_requests.message',
          'friend_requests.created_at',
          'users.id as requester_id',
          'users.username as requester_name',
          'users.display_name as requester_display_name',
          'users.avatar_url as requester_avatar'
        ]);

      res.json(requests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      res.status(500).json({ message: 'Error fetching pending requests', error: error.message });
    }
  }

  async removeFriend(req, res) {
    try {
      const userId = req.user.id;
      const { friendId } = req.params;

      const result = await db('friendships')
        .where(function() {
          this.where({ user_id: userId, friend_id: friendId })
              .orWhere({ user_id: friendId, friend_id: userId });
        })
        .del();

      if (result === 0) {
        return res.status(404).json({ message: 'Friendship not found' });
      }

      res.json({ message: 'Friend removed successfully' });
    } catch (error) {
      console.error('Error removing friend:', error);
      res.status(500).json({ message: 'Error removing friend', error: error.message });
    }
  }

  async blockUser(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      // Remove existing friendship if any
      await db('friendships')
        .where(function() {
          this.where({ user_id: userId, friend_id: targetUserId })
              .orWhere({ user_id: targetUserId, friend_id: userId });
        })
        .del();

      // Remove any pending friend requests
      await db('friend_requests')
        .where(function() {
          this.where({ requester_id: userId, requestee_id: targetUserId })
              .orWhere({ requester_id: targetUserId, requestee_id: userId });
        })
        .del();

      // Create block record
      await db('friendships')
        .insert({
          user_id: userId,
          friend_id: targetUserId,
          status: 'blocked'
        });

      res.json({ message: 'User blocked successfully' });
    } catch (error) {
      console.error('Error blocking user:', error);
      res.status(500).json({ message: 'Error blocking user', error: error.message });
    }
  }

  async unblockUser(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      const result = await db('friendships')
        .where({ user_id: userId, friend_id: targetUserId, status: 'blocked' })
        .del();

      if (result === 0) {
        return res.status(404).json({ message: 'User is not blocked' });
      }

      res.json({ message: 'User unblocked successfully' });
    } catch (error) {
      console.error('Error unblocking user:', error);
      res.status(500).json({ message: 'Error unblocking user', error: error.message });
    }
  }

  async getBlockedUsers(req, res) {
    try {
      const userId = req.user.id;

      const blockedUsers = await db('friendships')
        .join('users', 'friendships.friend_id', 'users.id')
        .where('friendships.user_id', userId)
        .andWhere('friendships.status', 'blocked')
        .select([
          'users.id',
          'users.username',
          'users.display_name',
          'users.avatar_url',
          'friendships.created_at as blocked_date'
        ]);

      res.json(blockedUsers);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      res.status(500).json({ message: 'Error fetching blocked users', error: error.message });
    }
  }
}

module.exports = new FriendsController();