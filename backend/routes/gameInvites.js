const express = require('express');
const router = express.Router();
const gameInvitesController = require('../controllers/gameInvitesController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Send a game invitation
router.post('/invite', gameInvitesController.sendGameInvite);

// Get received game invitations
router.get('/received', gameInvitesController.getReceivedInvites);

// Get sent game invitations
router.get('/sent', gameInvitesController.getSentInvites);

// Respond to a game invitation (accept/decline)
router.put('/invite/:inviteId', gameInvitesController.respondToInvite);

// Cancel a sent game invitation
router.delete('/invite/:inviteId', gameInvitesController.cancelInvite);

// Get active game rooms from friends
router.get('/active-rooms', gameInvitesController.getActiveGameRooms);

// Join an active game room
router.post('/join/:roomId', gameInvitesController.joinGameRoom);

module.exports = router;