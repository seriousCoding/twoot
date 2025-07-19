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

// Block user
router.put('/block/:userId', authenticateToken, friendsController.blockUser);

// Unblock user
router.delete('/block/:userId', authenticateToken, friendsController.unblockUser);

// Get blocked users
router.get('/blocked', authenticateToken, friendsController.getBlockedUsers);

module.exports = router;