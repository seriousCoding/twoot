# Multiplayer Friends System Implementation Plan

## Executive Summary
This plan outlines the implementation of a comprehensive friend system for Twoot, enabling single-player games with multiplayer join-by-request, friend management, online presence tracking, and integrated messaging. The implementation leverages the latest 2024-2025 technologies while maintaining compatibility with the existing React 19 + Express.js + Socket.io + PostgreSQL stack.

## Technology Stack

### Frontend Technologies
- **React 19** with TypeScript and latest hooks patterns
- **Material-UI v7** for UI components with custom theming
- **Socket.io-client v4.8+** for real-time communication
- **React Router DOM v7** for navigation
- **Custom hooks** for Socket.io state management

### Backend Technologies
- **Express.js** with TypeScript
- **Socket.io v4.8+** with namespaces and rooms
- **PostgreSQL** with Row-Level Security (RLS)
- **Redis** for session management and presence tracking
- **JWT** with refresh tokens for authentication
- **bcryptjs** for password hashing

### Database Technologies
- **PostgreSQL** for persistent data storage
- **Redis** for real-time presence and session management
- **Knex.js** for database migrations and queries

## Phase 1: Core Friend System (Week 1-2)

### 1.1 Database Schema Implementation

#### New Tables
```sql
-- Extended users table
ALTER TABLE users 
ADD COLUMN display_name VARCHAR(100),
ADD COLUMN avatar_url VARCHAR(255),
ADD COLUMN status VARCHAR(20) DEFAULT 'offline',
ADD COLUMN last_seen TIMESTAMP,
ADD COLUMN bio TEXT,
ADD COLUMN is_online BOOLEAN DEFAULT false;

-- Friendships table
CREATE TABLE friendships (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  friend_id INT REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'accepted', -- accepted, blocked
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Friend requests table
CREATE TABLE friend_requests (
  id SERIAL PRIMARY KEY,
  requester_id INT REFERENCES users(id) ON DELETE CASCADE,
  requestee_id INT REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, declined
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requester_id, requestee_id),
  CHECK (requester_id != requestee_id)
);

-- User sessions for presence tracking
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  socket_id VARCHAR(100) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friend_requests_requestee ON friend_requests(requestee_id);
CREATE INDEX idx_friend_requests_requester ON friend_requests(requester_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_users_display_name ON users(display_name);
```

#### Row-Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY friendship_policy ON friendships
  FOR ALL TO authenticated_user
  USING (user_id = current_user_id() OR friend_id = current_user_id());

CREATE POLICY friend_request_policy ON friend_requests
  FOR ALL TO authenticated_user
  USING (requester_id = current_user_id() OR requestee_id = current_user_id());

CREATE POLICY user_session_policy ON user_sessions
  FOR ALL TO authenticated_user
  USING (user_id = current_user_id());
```

### 1.2 Backend API Implementation

#### Friend Management Routes
```javascript
// /backend/routes/friends.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const friendsController = require('../controllers/friendsController');

// Get user's friends list
router.get('/', authenticateToken, friendsController.getFriends);

// Search for users
router.get('/search', authenticateToken, friendsController.searchUsers);

// Send friend request
router.post('/request', authenticateToken, friendsController.sendFriendRequest);

// Respond to friend request
router.put('/request/:requestId', authenticateToken, friendsController.respondToFriendRequest);

// Get pending friend requests
router.get('/requests', authenticateToken, friendsController.getPendingRequests);

// Remove friend
router.delete('/:friendId', authenticateToken, friendsController.removeFriend);

// Block/unblock user
router.put('/block/:userId', authenticateToken, friendsController.blockUser);
router.delete('/block/:userId', authenticateToken, friendsController.unblockUser);

module.exports = router;
```

#### Friends Controller
```javascript
// /backend/controllers/friendsController.js
const knex = require('../db');
const { io } = require('../socket');

class FriendsController {
  async getFriends(req, res) {
    try {
      const userId = req.user.id;
      
      const friends = await knex('friendships')
        .join('users', function() {
          this.on('friendships.friend_id', '=', 'users.id')
              .orOn('friendships.user_id', '=', 'users.id');
        })
        .where(function() {
          this.where('friendships.user_id', userId)
              .orWhere('friendships.friend_id', userId);
        })
        .andWhere('friendships.status', 'accepted')
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
      res.status(500).json({ message: 'Error fetching friends', error: error.message });
    }
  }

  async searchUsers(req, res) {
    try {
      const { query } = req.query;
      const userId = req.user.id;

      if (!query || query.length < 3) {
        return res.status(400).json({ message: 'Query must be at least 3 characters' });
      }

      const users = await knex('users')
        .where('username', 'ilike', `%${query}%`)
        .orWhere('display_name', 'ilike', `%${query}%`)
        .andWhere('id', '!=', userId)
        .select(['id', 'username', 'display_name', 'avatar_url'])
        .limit(10);

      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Error searching users', error: error.message });
    }
  }

  async sendFriendRequest(req, res) {
    try {
      const requesterId = req.user.id;
      const { requesteeId, message } = req.body;

      // Check if friendship already exists
      const existingFriendship = await knex('friendships')
        .where(function() {
          this.where({ user_id: requesterId, friend_id: requesteeId })
              .orWhere({ user_id: requesteeId, friend_id: requesterId });
        })
        .first();

      if (existingFriendship) {
        return res.status(400).json({ message: 'Friendship already exists' });
      }

      // Check if request already exists
      const existingRequest = await knex('friend_requests')
        .where({ requester_id: requesterId, requestee_id: requesteeId })
        .first();

      if (existingRequest) {
        return res.status(400).json({ message: 'Friend request already sent' });
      }

      // Create friend request
      const [request] = await knex('friend_requests')
        .insert({
          requester_id: requesterId,
          requestee_id: requesteeId,
          message: message || null
        })
        .returning('*');

      // Notify recipient via Socket.io
      io.emit('friendRequest', {
        requestId: request.id,
        requesterId,
        requesterName: req.user.username,
        message
      });

      res.status(201).json({ message: 'Friend request sent', request });
    } catch (error) {
      res.status(500).json({ message: 'Error sending friend request', error: error.message });
    }
  }

  async respondToFriendRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { response } = req.body; // 'accepted' or 'declined'
      const userId = req.user.id;

      const request = await knex('friend_requests')
        .where({ id: requestId, requestee_id: userId })
        .first();

      if (!request) {
        return res.status(404).json({ message: 'Friend request not found' });
      }

      // Update request status
      await knex('friend_requests')
        .where({ id: requestId })
        .update({ status: response, updated_at: new Date() });

      if (response === 'accepted') {
        // Create friendship
        await knex('friendships').insert({
          user_id: Math.min(request.requester_id, userId),
          friend_id: Math.max(request.requester_id, userId),
          status: 'accepted'
        });

        // Notify requester
        io.emit('friendRequestAccepted', {
          userId: request.requester_id,
          friendId: userId,
          friendName: req.user.username
        });
      }

      res.json({ message: `Friend request ${response}` });
    } catch (error) {
      res.status(500).json({ message: 'Error responding to friend request', error: error.message });
    }
  }

  async getPendingRequests(req, res) {
    try {
      const userId = req.user.id;

      const requests = await knex('friend_requests')
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
      res.status(500).json({ message: 'Error fetching pending requests', error: error.message });
    }
  }

  async removeFriend(req, res) {
    try {
      const userId = req.user.id;
      const { friendId } = req.params;

      await knex('friendships')
        .where(function() {
          this.where({ user_id: userId, friend_id: friendId })
              .orWhere({ user_id: friendId, friend_id: userId });
        })
        .del();

      // Notify friend
      io.emit('friendRemoved', {
        userId: friendId,
        removedBy: userId
      });

      res.json({ message: 'Friend removed successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error removing friend', error: error.message });
    }
  }

  async blockUser(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      // Remove existing friendship if any
      await knex('friendships')
        .where(function() {
          this.where({ user_id: userId, friend_id: targetUserId })
              .orWhere({ user_id: targetUserId, friend_id: userId });
        })
        .del();

      // Create or update block record
      await knex('friendships')
        .insert({
          user_id: userId,
          friend_id: targetUserId,
          status: 'blocked'
        })
        .onConflict(['user_id', 'friend_id'])
        .merge({ status: 'blocked', updated_at: new Date() });

      res.json({ message: 'User blocked successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error blocking user', error: error.message });
    }
  }

  async unblockUser(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      await knex('friendships')
        .where({ user_id: userId, friend_id: targetUserId, status: 'blocked' })
        .del();

      res.json({ message: 'User unblocked successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error unblocking user', error: error.message });
    }
  }
}

module.exports = new FriendsController();
```

### 1.3 Frontend Implementation

#### Custom Hooks for Socket.io
```typescript
// /frontend/src/hooks/useSocket.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketOptions {
  auth?: {
    token?: string;
  };
  autoConnect?: boolean;
}

export const useSocket = (serverUrl: string, options?: SocketOptions) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io(serverUrl, {
      ...options,
      autoConnect: false
    });

    // Connection handlers
    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Disconnected:', reason);
    });

    newSocket.on('connect_error', (error) => {
      setConnectionError(error.message);
      setIsConnected(false);
    });

    setSocket(newSocket);
    newSocket.connect();

    return () => {
      newSocket.disconnect();
    };
  }, [serverUrl]);

  const emit = useCallback((event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  }, [socket, isConnected]);

  return { socket, isConnected, connectionError, emit };
};
```

#### Friends Context Provider
```typescript
// /frontend/src/contexts/FriendsContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../App';

interface Friend {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  status: string;
  last_seen: string;
  is_online: boolean;
  friendship_date: string;
}

interface FriendRequest {
  id: number;
  requester_id: number;
  requester_name: string;
  requester_display_name: string;
  requester_avatar: string;
  message: string;
  created_at: string;
}

interface FriendsState {
  friends: Friend[];
  friendRequests: FriendRequest[];
  onlineUsers: Set<number>;
  loading: boolean;
  error: string | null;
}

interface FriendsContextType {
  state: FriendsState;
  actions: {
    loadFriends: () => Promise<void>;
    loadFriendRequests: () => Promise<void>;
    sendFriendRequest: (userId: number, message?: string) => Promise<void>;
    respondToFriendRequest: (requestId: number, response: 'accepted' | 'declined') => Promise<void>;
    removeFriend: (friendId: number) => Promise<void>;
    searchUsers: (query: string) => Promise<any[]>;
    blockUser: (userId: number) => Promise<void>;
    unblockUser: (userId: number) => Promise<void>;
  };
}

const FriendsContext = createContext<FriendsContextType | null>(null);

const initialState: FriendsState = {
  friends: [],
  friendRequests: [],
  onlineUsers: new Set(),
  loading: false,
  error: null
};

function friendsReducer(state: FriendsState, action: any): FriendsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_FRIENDS':
      return { ...state, friends: action.payload, loading: false };
    case 'SET_FRIEND_REQUESTS':
      return { ...state, friendRequests: action.payload };
    case 'ADD_FRIEND':
      return { ...state, friends: [...state.friends, action.payload] };
    case 'REMOVE_FRIEND':
      return {
        ...state,
        friends: state.friends.filter(friend => friend.id !== action.payload)
      };
    case 'ADD_FRIEND_REQUEST':
      return {
        ...state,
        friendRequests: [...state.friendRequests, action.payload]
      };
    case 'REMOVE_FRIEND_REQUEST':
      return {
        ...state,
        friendRequests: state.friendRequests.filter(req => req.id !== action.payload)
      };
    case 'USER_ONLINE':
      return {
        ...state,
        onlineUsers: new Set([...state.onlineUsers, action.payload]),
        friends: state.friends.map(friend =>
          friend.id === action.payload ? { ...friend, is_online: true } : friend
        )
      };
    case 'USER_OFFLINE':
      return {
        ...state,
        onlineUsers: new Set([...state.onlineUsers].filter(id => id !== action.payload)),
        friends: state.friends.map(friend =>
          friend.id === action.payload ? { ...friend, is_online: false } : friend
        )
      };
    default:
      return state;
  }
}

export const FriendsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(friendsReducer, initialState);
  const { isAuth } = useAuth();
  const { socket } = useSocket(process.env.REACT_APP_API_URL || 'http://localhost:9000', {
    auth: { token: localStorage.getItem('token') }
  });

  useEffect(() => {
    if (!socket || !isAuth) return;

    // Socket event handlers
    socket.on('friendRequest', (request) => {
      dispatch({ type: 'ADD_FRIEND_REQUEST', payload: request });
    });

    socket.on('friendRequestAccepted', (data) => {
      dispatch({ type: 'ADD_FRIEND', payload: data });
    });

    socket.on('friendRemoved', (data) => {
      dispatch({ type: 'REMOVE_FRIEND', payload: data.removedBy });
    });

    socket.on('userOnline', (userId) => {
      dispatch({ type: 'USER_ONLINE', payload: userId });
    });

    socket.on('userOffline', (userId) => {
      dispatch({ type: 'USER_OFFLINE', payload: userId });
    });

    return () => {
      socket.off('friendRequest');
      socket.off('friendRequestAccepted');
      socket.off('friendRemoved');
      socket.off('userOnline');
      socket.off('userOffline');
    };
  }, [socket, isAuth]);

  const actions = {
    loadFriends: async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const response = await fetch('/api/friends', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const friends = await response.json();
        dispatch({ type: 'SET_FRIENDS', payload: friends });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    },

    loadFriendRequests: async () => {
      try {
        const response = await fetch('/api/friends/requests', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const requests = await response.json();
        dispatch({ type: 'SET_FRIEND_REQUESTS', payload: requests });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    },

    sendFriendRequest: async (userId: number, message?: string) => {
      try {
        const response = await fetch('/api/friends/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ requesteeId: userId, message })
        });
        if (!response.ok) throw new Error('Failed to send friend request');
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    },

    respondToFriendRequest: async (requestId: number, response: 'accepted' | 'declined') => {
      try {
        const res = await fetch(`/api/friends/request/${requestId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ response })
        });
        if (!res.ok) throw new Error('Failed to respond to friend request');
        dispatch({ type: 'REMOVE_FRIEND_REQUEST', payload: requestId });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    },

    removeFriend: async (friendId: number) => {
      try {
        const response = await fetch(`/api/friends/${friendId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to remove friend');
        dispatch({ type: 'REMOVE_FRIEND', payload: friendId });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    },

    searchUsers: async (query: string) => {
      try {
        const response = await fetch(`/api/friends/search?query=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        return await response.json();
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        return [];
      }
    },

    blockUser: async (userId: number) => {
      try {
        const response = await fetch(`/api/friends/block/${userId}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to block user');
        dispatch({ type: 'REMOVE_FRIEND', payload: userId });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    },

    unblockUser: async (userId: number) => {
      try {
        const response = await fetch(`/api/friends/block/${userId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to unblock user');
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    }
  };

  return (
    <FriendsContext.Provider value={{ state, actions }}>
      {children}
    </FriendsContext.Provider>
  );
};

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
};
```

## Phase 2: Enhanced Communication (Week 3-4)

### 2.1 Private Messaging System

#### Database Schema
```sql
-- Private messages table
CREATE TABLE private_messages (
  id SERIAL PRIMARY KEY,
  sender_id INT REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INT REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- text, image, game_invite, system
  metadata JSONB, -- For storing additional data like game invites
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL
);

-- Conversations table for better organization
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  participant_1 INT REFERENCES users(id) ON DELETE CASCADE,
  participant_2 INT REFERENCES users(id) ON DELETE CASCADE,
  last_message_id INT REFERENCES private_messages(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant_1, participant_2),
  CHECK (participant_1 < participant_2)
);

-- Indexes for performance
CREATE INDEX idx_private_messages_sender ON private_messages(sender_id, created_at);
CREATE INDEX idx_private_messages_recipient ON private_messages(recipient_id, read_at);
CREATE INDEX idx_conversations_participants ON conversations(participant_1, participant_2);
```

#### Backend Implementation
```javascript
// /backend/controllers/messagesController.js
const knex = require('../db');
const { io } = require('../socket');

class MessagesController {
  async sendMessage(req, res) {
    try {
      const senderId = req.user.id;
      const { recipientId, messageText, messageType = 'text', metadata = {} } = req.body;

      // Verify friendship exists
      const friendship = await knex('friendships')
        .where(function() {
          this.where({ user_id: senderId, friend_id: recipientId })
              .orWhere({ user_id: recipientId, friend_id: senderId });
        })
        .andWhere('status', 'accepted')
        .first();

      if (!friendship) {
        return res.status(403).json({ message: 'Can only message friends' });
      }

      // Create message
      const [message] = await knex('private_messages')
        .insert({
          sender_id: senderId,
          recipient_id: recipientId,
          message_text: messageText,
          message_type: messageType,
          metadata: JSON.stringify(metadata)
        })
        .returning('*');

      // Update or create conversation
      const participant1 = Math.min(senderId, recipientId);
      const participant2 = Math.max(senderId, recipientId);

      await knex('conversations')
        .insert({
          participant_1: participant1,
          participant_2: participant2,
          last_message_id: message.id,
          updated_at: new Date()
        })
        .onConflict(['participant_1', 'participant_2'])
        .merge({
          last_message_id: message.id,
          updated_at: new Date()
        });

      // Send via Socket.io
      io.emit('privateMessage', {
        ...message,
        sender_name: req.user.username
      });

      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: 'Error sending message', error: error.message });
    }
  }

  async getConversation(req, res) {
    try {
      const userId = req.user.id;
      const { friendId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      // Verify friendship
      const friendship = await knex('friendships')
        .where(function() {
          this.where({ user_id: userId, friend_id: friendId })
              .orWhere({ user_id: friendId, friend_id: userId });
        })
        .andWhere('status', 'accepted')
        .first();

      if (!friendship) {
        return res.status(403).json({ message: 'Can only view messages with friends' });
      }

      // Get messages
      const messages = await knex('private_messages')
        .where(function() {
          this.where({ sender_id: userId, recipient_id: friendId })
              .orWhere({ sender_id: friendId, recipient_id: userId });
        })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select('*');

      // Mark messages as read
      await knex('private_messages')
        .where({ sender_id: friendId, recipient_id: userId })
        .whereNull('read_at')
        .update({ read_at: new Date() });

      res.json(messages.reverse());
    } catch (error) {
      res.status(500).json({ message: 'Error fetching conversation', error: error.message });
    }
  }

  async getConversations(req, res) {
    try {
      const userId = req.user.id;

      const conversations = await knex('conversations')
        .where('participant_1', userId)
        .orWhere('participant_2', userId)
        .leftJoin('private_messages', 'conversations.last_message_id', 'private_messages.id')
        .leftJoin('users as other_user', function() {
          this.on(function() {
            this.on('conversations.participant_1', '=', 'other_user.id')
                .andOn('conversations.participant_2', '=', userId);
          }).orOn(function() {
            this.on('conversations.participant_2', '=', 'other_user.id')
                .andOn('conversations.participant_1', '=', userId);
          });
        })
        .select([
          'conversations.id',
          'conversations.updated_at',
          'other_user.id as other_user_id',
          'other_user.username as other_user_name',
          'other_user.display_name as other_user_display_name',
          'other_user.avatar_url as other_user_avatar',
          'other_user.is_online as other_user_online',
          'private_messages.message_text as last_message',
          'private_messages.created_at as last_message_time',
          'private_messages.sender_id as last_message_sender'
        ])
        .orderBy('conversations.updated_at', 'desc');

      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching conversations', error: error.message });
    }
  }
}

module.exports = new MessagesController();
```

### 2.2 Game Invitation System

#### Game Invite Implementation
```javascript
// /backend/controllers/gameInvitesController.js
const knex = require('../db');
const { io } = require('../socket');

class GameInvitesController {
  async sendGameInvite(req, res) {
    try {
      const senderId = req.user.id;
      const { recipientId, gameType, roomId, message } = req.body;

      // Verify friendship
      const friendship = await knex('friendships')
        .where(function() {
          this.where({ user_id: senderId, friend_id: recipientId })
              .orWhere({ user_id: recipientId, friend_id: senderId });
        })
        .andWhere('status', 'accepted')
        .first();

      if (!friendship) {
        return res.status(403).json({ message: 'Can only invite friends' });
      }

      // Create game invite message
      const [inviteMessage] = await knex('private_messages')
        .insert({
          sender_id: senderId,
          recipient_id: recipientId,
          message_text: message || `${req.user.username} invited you to play ${gameType}!`,
          message_type: 'game_invite',
          metadata: JSON.stringify({
            gameType,
            roomId,
            inviteType: 'game',
            status: 'pending'
          })
        })
        .returning('*');

      // Send via Socket.io
      io.emit('gameInvite', {
        ...inviteMessage,
        sender_name: req.user.username,
        game_type: gameType,
        room_id: roomId
      });

      res.status(201).json(inviteMessage);
    } catch (error) {
      res.status(500).json({ message: 'Error sending game invite', error: error.message });
    }
  }

  async respondToGameInvite(req, res) {
    try {
      const { inviteId } = req.params;
      const { response } = req.body; // 'accepted' or 'declined'
      const userId = req.user.id;

      const invite = await knex('private_messages')
        .where({
          id: inviteId,
          recipient_id: userId,
          message_type: 'game_invite'
        })
        .first();

      if (!invite) {
        return res.status(404).json({ message: 'Game invite not found' });
      }

      const metadata = JSON.parse(invite.metadata);
      metadata.status = response;

      await knex('private_messages')
        .where({ id: inviteId })
        .update({
          metadata: JSON.stringify(metadata),
          read_at: new Date()
        });

      if (response === 'accepted') {
        // Join the game room
        io.emit('gameInviteAccepted', {
          userId,
          gameType: metadata.gameType,
          roomId: metadata.roomId,
          inviterId: invite.sender_id
        });
      }

      res.json({ message: `Game invite ${response}` });
    } catch (error) {
      res.status(500).json({ message: 'Error responding to game invite', error: error.message });
    }
  }
}

module.exports = new GameInvitesController();
```

## Phase 3: Social Gaming Features (Week 5-6)

### 3.1 Friend-Only Game Rooms

#### Enhanced Game Room Management
```javascript
// /backend/services/gameRoomService.js
class GameRoomService {
  constructor() {
    this.rooms = new Map();
    this.playerRooms = new Map();
  }

  createFriendRoom(hostId, gameType, friendsOnly = true, maxPlayers = 4) {
    const roomId = this.generateRoomId();
    const room = {
      id: roomId,
      host: hostId,
      players: new Set([hostId]),
      gameType,
      maxPlayers,
      friendsOnly,
      gameState: this.initializeGameState(gameType),
      status: 'waiting',
      invitedFriends: new Set(),
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    this.playerRooms.set(hostId, roomId);
    return room;
  }

  async canJoinRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return { canJoin: false, reason: 'Room not found' };
    
    if (room.players.size >= room.maxPlayers) {
      return { canJoin: false, reason: 'Room full' };
    }

    if (room.status !== 'waiting') {
      return { canJoin: false, reason: 'Game in progress' };
    }

    if (room.friendsOnly && room.host !== playerId) {
      // Check if player is friends with host
      const friendship = await knex('friendships')
        .where(function() {
          this.where({ user_id: room.host, friend_id: playerId })
              .orWhere({ user_id: playerId, friend_id: room.host });
        })
        .andWhere('status', 'accepted')
        .first();

      if (!friendship) {
        return { canJoin: false, reason: 'Friends only room' };
      }
    }

    return { canJoin: true };
  }

  async joinRoom(roomId, playerId) {
    const canJoin = await this.canJoinRoom(roomId, playerId);
    if (!canJoin.canJoin) {
      throw new Error(canJoin.reason);
    }

    const room = this.rooms.get(roomId);
    room.players.add(playerId);
    this.playerRooms.set(playerId, roomId);

    return room;
  }

  inviteFriendsToRoom(roomId, friendIds) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    friendIds.forEach(friendId => {
      room.invitedFriends.add(friendId);
      
      // Send invitation via Socket.io
      io.emit('gameRoomInvite', {
        roomId,
        gameType: room.gameType,
        hostId: room.host,
        invitedUserId: friendId
      });
    });
  }

  getPlayerRoom(playerId) {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  getRoomsByPlayer(playerId) {
    const rooms = [];
    for (const [roomId, room] of this.rooms) {
      if (room.players.has(playerId) || room.invitedFriends.has(playerId)) {
        rooms.push({
          id: roomId,
          gameType: room.gameType,
          playersCount: room.players.size,
          maxPlayers: room.maxPlayers,
          status: room.status,
          isHost: room.host === playerId,
          isInvited: room.invitedFriends.has(playerId)
        });
      }
    }
    return rooms;
  }
}

module.exports = new GameRoomService();
```

### 3.2 Enhanced Game Components

#### Updated Chess Component with Friend Features
```typescript
// /frontend/src/pages/Chess.tsx (Enhanced)
import React, { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, 
  Dialog, DialogTitle, DialogContent, List, ListItem, 
  ListItemText, ListItemButton, Chip, Paper
} from '@mui/material';
import { io, Socket } from 'socket.io-client';
import { useFriends } from '../contexts/FriendsContext';

// ... existing chess interfaces ...

const Chess = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<ChessState>(/* initial state */);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const { state: friendsState, actions: friendsActions } = useFriends();

  useEffect(() => {
    const newSocket = io(`${process.env.REACT_APP_API_URL}/chess`, {
      auth: { token: localStorage.getItem('token') }
    });
    setSocket(newSocket);

    newSocket.on('gameState', (state: ChessState) => {
      setGameState(state);
    });

    newSocket.on('roomCreated', (data: { roomId: string; isHost: boolean }) => {
      setRoomId(data.roomId);
      setIsHost(data.isHost);
    });

    newSocket.on('gameInvite', (data) => {
      // Handle incoming game invitations
      console.log('Received game invite:', data);
    });

    newSocket.on('playerJoined', (data) => {
      console.log('Player joined:', data);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const createFriendRoom = () => {
    if (socket) {
      socket.emit('createFriendRoom', {
        gameType: 'chess',
        friendsOnly: true,
        maxPlayers: 2
      });
    }
  };

  const inviteFriend = (friendId: number) => {
    if (socket && roomId) {
      socket.emit('inviteFriend', {
        roomId,
        friendId,
        gameType: 'chess'
      });
    }
  };

  const joinFriendRoom = (roomId: string) => {
    if (socket) {
      socket.emit('joinRoom', { roomId });
    }
  };

  // ... existing game logic ...

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" p={2}>
      <Card sx={{ maxWidth: 800, width: '100%', bgcolor: 'background.paper' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h4" color="primary">
              Chess Game
            </Typography>
            <Box>
              <Button 
                variant="contained" 
                onClick={createFriendRoom}
                sx={{ mr: 1 }}
              >
                Create Friend Room
              </Button>
              {isHost && (
                <Button 
                  variant="outlined" 
                  onClick={() => setShowInviteDialog(true)}
                >
                  Invite Friends
                </Button>
              )}
            </Box>
          </Box>

          {/* Online Friends List */}
          <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Online Friends
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {friendsState.friends
                .filter(friend => friend.is_online)
                .map(friend => (
                  <Chip
                    key={friend.id}
                    label={friend.display_name || friend.username}
                    color="primary"
                    size="small"
                    onClick={() => isHost && inviteFriend(friend.id)}
                    clickable={isHost}
                  />
                ))}
            </Box>
          </Paper>

          {/* Existing chess board and game logic */}
          {/* ... existing chess component code ... */}

          {/* Friend Invite Dialog */}
          <Dialog 
            open={showInviteDialog} 
            onClose={() => setShowInviteDialog(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Invite Friends to Chess</DialogTitle>
            <DialogContent>
              <List>
                {friendsState.friends
                  .filter(friend => friend.is_online)
                  .map(friend => (
                    <ListItem key={friend.id} disablePadding>
                      <ListItemButton onClick={() => {
                        inviteFriend(friend.id);
                        setShowInviteDialog(false);
                      }}>
                        <ListItemText 
                          primary={friend.display_name || friend.username}
                          secondary={friend.status}
                        />
                        <Chip 
                          label="Online" 
                          size="small" 
                          color="success"
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
              </List>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Chess;
```

## Phase 4: Integration and Testing (Week 7-8)

### 4.1 Updated App.tsx with Friend System

```typescript
// /frontend/src/App.tsx (Updated)
import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { FriendsProvider } from './contexts/FriendsContext';
// ... existing imports ...

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <FriendsProvider>
          <Router>
            <Box minHeight="100vh" display="flex" flexDirection="column" justifyContent="center" alignItems="center" sx={{ background: 'linear-gradient(135deg, #232946 0%, #3b3b58 100%)' }}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardWithLogout /></ProtectedRoute>} />
                <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/messages/:friendId" element={<ProtectedRoute><Conversation /></ProtectedRoute>} />
                {/* ... existing game routes ... */}
                <Route path="*" element={<Navigate to="/login" />} />
              </Routes>
            </Box>
          </Router>
        </FriendsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
```

### 4.2 Enhanced Dashboard with Friend Features

```typescript
// /frontend/src/pages/Dashboard.tsx (Enhanced)
import React, { useState, useEffect } from 'react';
import { 
  AppBar, Toolbar, Typography, Button, Box, Card, CardContent, 
  Tabs, Tab, Grid, Badge, Avatar, List, ListItem, ListItemText,
  ListItemAvatar, Chip, Paper
} from '@mui/material';
import { 
  SportsEsportsIcon, ChatIcon, BrushIcon, VideocamIcon, 
  PeopleIcon, MessageIcon, NotificationsIcon 
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useFriends } from '../contexts/FriendsContext';
import Chat from './Chat';
import Draw from './Draw';
import Video from './Video';
import Friends from './Friends';
import Messages from './Messages';

const features = [
  { label: 'Games', icon: <SportsEsportsIcon />, value: 'games' },
  { label: 'Friends', icon: <PeopleIcon />, value: 'friends' },
  { label: 'Messages', icon: <MessageIcon />, value: 'messages' },
  { label: 'Chat', icon: <ChatIcon />, value: 'chat' },
  { label: 'Draw', icon: <BrushIcon />, value: 'draw' },
  { label: 'Video', icon: <VideocamIcon />, value: 'video' },
];

const Dashboard = () => {
  const [tab, setTab] = useState('games');
  const navigate = useNavigate();
  const { state: friendsState, actions: friendsActions } = useFriends();

  useEffect(() => {
    // Load friends and requests on component mount
    friendsActions.loadFriends();
    friendsActions.loadFriendRequests();
  }, []);

  const games = [
    { name: 'Code & Seek', path: '/code-seek', color: 'success' },
    { name: 'Code & Conquer', path: '/code-conquer', color: 'warning' },
    { name: 'Dungeon Builders', path: '/dungeon-builders', color: 'info' },
    { name: 'Pixel Farm Tycoon', path: '/pixel-farm-tycoon', color: 'success' },
    { name: 'Chat & Draw', path: '/chat-draw', color: 'primary' },
    { name: 'Code Racer', path: '/code-racer', color: 'error' },
    { name: 'Turtle Arena', path: '/turtle-arena', color: 'success' },
    { name: 'Memory Duel', path: '/memory-duel', color: 'secondary' },
    { name: 'AI Pet Battlers', path: '/ai-pet-battlers', color: 'warning' },
    { name: 'Craft & Trade', path: '/craft-trade', color: 'info' },
    { name: 'Chess', path: '/chess', color: 'primary' },
    { name: 'Pacman', path: '/pacman', color: 'secondary' }
  ];

  const onlineFriendsCount = friendsState.friends.filter(f => f.is_online).length;
  const unreadRequestsCount = friendsState.friendRequests.length;

  return (
    <Box minHeight="100vh" bgcolor="background.default">
      <AppBar position="static" color="primary" sx={{ boxShadow: 12, bgcolor: 'rgba(35,41,70,0.85)', backdropFilter: 'blur(8px)', borderRadius: 3, mt: 2 }}>
        <Toolbar>
          <Typography variant="h5" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: 2, color: 'text.primary' }}>
            Twoot
          </Typography>
          
          {/* Notifications */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <Badge badgeContent={unreadRequestsCount} color="error">
              <NotificationsIcon sx={{ color: 'text.primary' }} />
            </Badge>
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{ minHeight: 48, bgcolor: 'transparent', boxShadow: 0 }}
          >
            {features.map(f => (
              <Tab
                key={f.value}
                value={f.value}
                icon={f.value === 'friends' ? (
                  <Badge badgeContent={onlineFriendsCount} color="success">
                    {f.icon}
                  </Badge>
                ) : (
                  f.icon
                )}
                label={f.label}
                sx={{ 
                  fontWeight: 700, 
                  minWidth: 100, 
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)', 
                  borderRadius: 3, 
                  mx: 1, 
                  color: 'text.primary', 
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  transform: 'perspective(1000px) rotateX(0deg) translateZ(0px)',
                  transformStyle: 'preserve-3d',
                  '&:hover': {
                    transform: 'perspective(1000px) rotateX(-8deg) translateZ(8px)',
                    boxShadow: '0 12px 25px rgba(44,182,125,0.2)',
                  },
                  '&.Mui-selected': { 
                    color: 'secondary.main', 
                    background: 'rgba(44,182,125,0.15)', 
                    boxShadow: '0 8px 20px rgba(44,182,125,0.3)',
                  }
                }}
              />
            ))}
          </Tabs>
        </Toolbar>
      </AppBar>

      <Box display="flex" justifyContent="center" alignItems="flex-start" minHeight="80vh" mt={4} px={2}>
        <Card sx={{ 
          minWidth: { xs: '90%', sm: 500, md: 600 }, 
          minHeight: 500, 
          boxShadow: '0 25px 50px rgba(0,0,0,0.25), 0 10px 25px rgba(0,0,0,0.15)', 
          borderRadius: 6, 
          p: 3, 
          bgcolor: 'rgba(255,255,255,0.12)', 
          border: '2px solid rgba(127, 90, 240, 0.3)', 
          backdropFilter: 'blur(20px)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          '&:hover': {
            transform: 'perspective(1000px) rotateX(-2deg) translateZ(10px)',
            boxShadow: '0 35px 60px rgba(127, 90, 240, 0.2)',
          }
        }}>
          <CardContent>
            {tab === 'games' && (
              <Box textAlign="center">
                <Typography variant="h4" color="primary" fontWeight={700} gutterBottom>
                  Choose Your Game
                </Typography>
                
                {/* Online Friends Playing */}
                {onlineFriendsCount > 0 && (
                  <Paper elevation={2} sx={{ p: 2, mb: 3, bgcolor: 'rgba(44,182,125,0.1)' }}>
                    <Typography variant="h6" color="secondary" gutterBottom>
                      Friends Online ({onlineFriendsCount})
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {friendsState.friends
                        .filter(f => f.is_online)
                        .slice(0, 5)
                        .map(friend => (
                          <Chip
                            key={friend.id}
                            avatar={<Avatar sx={{ bgcolor: 'success.main' }}>●</Avatar>}
                            label={friend.display_name || friend.username}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ))}
                    </Box>
                  </Paper>
                )}

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  {games.map((game) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={game.name}>
                      <Button
                        variant="contained"
                        color={game.color as any}
                        fullWidth
                        sx={{ 
                          p: 3, 
                          boxShadow: '0 8px 25px rgba(0,0,0,0.15)', 
                          borderRadius: 4, 
                          fontWeight: 800,
                          minHeight: 100,
                          fontSize: 18,
                          letterSpacing: 1,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: '#fff',
                          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                          transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
                          '&:hover': { 
                            transform: 'perspective(1000px) rotateX(-10deg) rotateY(10deg) translateZ(20px)',
                            boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)',
                            background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                          }
                        }}
                        onClick={() => navigate(game.path)}
                      >
                        {game.name}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
                <Typography sx={{ mt: 4 }} color="text.secondary">
                  All games support friend invitations and private rooms!
                </Typography>
              </Box>
            )}
            {tab === 'friends' && <Friends />}
            {tab === 'messages' && <Messages />}
            {tab === 'chat' && <Chat />}
            {tab === 'draw' && <Draw />}
            {tab === 'video' && <Video />}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Dashboard;
```

## Implementation Timeline

### Week 1-2: Core Friend System
- [ ] Database schema migration
- [ ] Backend API endpoints
- [ ] Basic friend management UI
- [ ] Friend request system
- [ ] User search functionality

### Week 3-4: Enhanced Communication
- [ ] Private messaging system
- [ ] Message persistence
- [ ] Real-time notifications
- [ ] Game invitation system
- [ ] Conversation management

### Week 5-6: Social Gaming Features
- [ ] Friend-only game rooms
- [ ] Game invitation UI
- [ ] Enhanced game components
- [ ] Spectator mode for friends
- [ ] Game history tracking

### Week 7-8: Integration and Testing
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Bug fixes and polish
- [ ] Documentation updates

## Security Considerations

1. **Authentication**: JWT tokens with refresh mechanism
2. **Authorization**: Row-Level Security for data isolation
3. **Input Validation**: Comprehensive server-side validation
4. **Rate Limiting**: Prevent spam and abuse
5. **CORS Configuration**: Proper cross-origin setup
6. **Data Encryption**: Sensitive data encryption at rest
7. **Session Management**: Secure session handling
8. **Privacy Controls**: User privacy and blocking features

## Performance Optimizations

1. **Database Indexing**: Strategic indexes for friend queries
2. **Connection Pooling**: Efficient database connections
3. **Caching Strategy**: Redis for session and presence data
4. **Lazy Loading**: Pagination for large friend lists
5. **Socket.io Optimization**: Efficient room management
6. **Frontend Optimization**: React.memo and useMemo usage
7. **Bundle Optimization**: Code splitting and lazy loading

## Success Metrics

1. **User Engagement**: Friend connections per user
2. **Game Participation**: Friends playing together
3. **Message Volume**: Private messaging usage
4. **Session Duration**: Time spent in friend activities
5. **Retention Rate**: User retention with friend features
6. **Performance**: Response times and uptime
7. **User Satisfaction**: Feedback and ratings

This comprehensive implementation plan provides a robust foundation for building a modern, scalable friend system that integrates seamlessly with the existing Twoot platform while leveraging the latest 2024-2025 technologies and best practices.