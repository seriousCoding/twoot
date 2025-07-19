const express = require('express');
const router = express.Router();
const gameRoomController = require('../controllers/gameRoomController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Create a new game room
router.post('/create', gameRoomController.createGameRoom);

// Join a game room
router.post('/join/:roomId', gameRoomController.joinGameRoom);

// Leave a game room
router.delete('/leave/:roomId', gameRoomController.leaveGameRoom);

// Get room information
router.get('/info/:roomId', gameRoomController.getRoomInfo);

// Get friend-only rooms
router.get('/friend-rooms', gameRoomController.getFriendRooms);

// Start game in room (host only)
router.post('/start/:roomId', gameRoomController.startGame);

module.exports = router;