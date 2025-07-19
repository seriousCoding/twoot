const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messagesController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get all conversations for the authenticated user
router.get('/conversations', messagesController.getConversations);

// Get or create a conversation with a specific user
router.get('/conversations/:participantId', messagesController.getOrCreateConversation);

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', messagesController.getMessages);

// Send a message to a conversation
router.post('/conversations/:conversationId/messages', messagesController.sendMessage);

// Delete a message
router.delete('/messages/:messageId', messagesController.deleteMessage);

module.exports = router;