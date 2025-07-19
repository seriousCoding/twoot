const { Server } = require('socket.io');
const codeSeek = require('./games/codeSeek');
const codeConquer = require('./games/codeConquer');
const dungeonBuilders = require('./games/dungeonBuilders');
const pixelFarmTycoon = require('./games/pixelFarmTycoon');
const chatDraw = require('./games/chatDraw');
const codeRacer = require('./games/codeRacer');
const turtleArena = require('./games/turtleArena');
const memoryDuel = require('./games/memoryDuel');
const aiPetBattlers = require('./games/aiPetBattlers');
const craftTrade = require('./games/craftTrade');

function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000" }
  });

  // Make io available to Express app
  global.io = io;

  // ... other namespaces

  // Code & Seek namespace
  const codeSeekNamespace = io.of('/code-seek');
  codeSeekNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = codeSeek.joinGame(socket, nickname, roomId);
      codeSeekNamespace.to(roomId).emit('state', game);
    });

    socket.on('start', () => {
      codeSeek.startGame(roomId);
      codeSeekNamespace.to(roomId).emit('state', codeSeek.games[roomId]);
    });

    socket.on('move', ({ x, y }) => {
      codeSeek.movePlayer(socket, roomId, x, y);
      const foundId = codeSeek.checkFound(roomId);
      if (foundId) {
        codeSeekNamespace.to(roomId).emit('found', { foundId });
        // End round, reset, etc.
      } else {
        codeSeekNamespace.to(roomId).emit('state', codeSeek.games[roomId]);
      }
    });

    socket.on('disconnect', () => {
      codeSeek.removePlayer(socket, roomId);
      codeSeekNamespace.to(roomId).emit('state', codeSeek.games[roomId]);
    });
  });

  const codeConquerNamespace = io.of('/code-conquer');
  codeConquerNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = codeConquer.joinGame(socket, nickname, roomId);
      codeConquerNamespace.to(roomId).emit('state', game);
    });

    socket.on('command', ({ command }) => {
      codeConquer.handleCommand(socket, roomId, command);
      codeConquerNamespace.to(roomId).emit('state', codeConquer.games[roomId]);
    });

    socket.on('disconnect', () => {
      codeConquer.removePlayer(socket, roomId);
      codeConquerNamespace.to(roomId).emit('state', codeConquer.games[roomId]);
    });
  });

  const dungeonNamespace = io.of('/dungeon-builders');
  dungeonNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = dungeonBuilders.joinGame(socket, nickname, roomId);
      dungeonNamespace.to(roomId).emit('state', game);
    });

    socket.on('move', ({ dx, dy }) => {
      dungeonBuilders.movePlayer(socket, roomId, dx, dy);
      dungeonNamespace.to(roomId).emit('state', dungeonBuilders.games[roomId]);
    });

    socket.on('disconnect', () => {
      dungeonBuilders.removePlayer(socket, roomId);
      dungeonNamespace.to(roomId).emit('state', dungeonBuilders.games[roomId]);
    });
  });

  // Pixel Farm Tycoon namespace
  const pixelFarmNamespace = io.of('/pixel-farm-tycoon');
  pixelFarmNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = pixelFarmTycoon.joinGame(socket, nickname, roomId);
      pixelFarmNamespace.to(roomId).emit('state', game);
    });

    socket.on('plant', ({ x, y, cropType }) => {
      const game = pixelFarmTycoon.plantCrop(socket, roomId, x, y, cropType);
      pixelFarmNamespace.to(roomId).emit('state', game);
    });

    socket.on('harvest', ({ x, y }) => {
      const game = pixelFarmTycoon.harvestCrop(socket, roomId, x, y);
      pixelFarmNamespace.to(roomId).emit('state', game);
    });

    socket.on('disconnect', () => {
      pixelFarmTycoon.removePlayer(socket, roomId);
      pixelFarmNamespace.to(roomId).emit('state', pixelFarmTycoon.games[roomId]);
    });
  });

  // Chat & Draw namespace
  const chatDrawNamespace = io.of('/chat-draw');
  chatDrawNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = chatDraw.joinGame(socket, nickname, roomId);
      chatDrawNamespace.to(roomId).emit('state', game);
    });

    socket.on('start', () => {
      const game = chatDraw.startGame(roomId);
      chatDrawNamespace.to(roomId).emit('state', game);
    });

    socket.on('draw', (drawData) => {
      const game = chatDraw.draw(socket, roomId, drawData);
      chatDrawNamespace.to(roomId).emit('draw', drawData);
    });

    socket.on('guess', ({ guess }) => {
      const game = chatDraw.guess(socket, roomId, guess);
      chatDrawNamespace.to(roomId).emit('state', game);
    });

    socket.on('disconnect', () => {
      chatDraw.removePlayer(socket, roomId);
      chatDrawNamespace.to(roomId).emit('state', chatDraw.games[roomId]);
    });
  });

  // Code Racer namespace
  const codeRacerNamespace = io.of('/code-racer');
  codeRacerNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = codeRacer.joinGame(socket, nickname, roomId);
      codeRacerNamespace.to(roomId).emit('state', game);
    });

    socket.on('start', () => {
      const game = codeRacer.startGame(roomId);
      codeRacerNamespace.to(roomId).emit('state', game);
    });

    socket.on('updateCode', ({ code }) => {
      const game = codeRacer.updateCode(socket, roomId, code);
      codeRacerNamespace.to(roomId).emit('state', game);
    });

    socket.on('submitCode', ({ code }) => {
      const result = codeRacer.submitCode(socket, roomId, code);
      codeRacerNamespace.to(roomId).emit('state', result.game);
      socket.emit('testResults', result.testResults);
    });

    socket.on('disconnect', () => {
      codeRacer.removePlayer(socket, roomId);
      codeRacerNamespace.to(roomId).emit('state', codeRacer.games[roomId]);
    });
  });

  // Turtle Arena namespace
  const turtleArenaNamespace = io.of('/turtle-arena');
  turtleArenaNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = turtleArena.joinGame(socket, nickname, roomId);
      turtleArenaNamespace.to(roomId).emit('state', game);
    });

    socket.on('start', () => {
      const game = turtleArena.startGame(roomId);
      turtleArenaNamespace.to(roomId).emit('state', game);
    });

    socket.on('updateCode', ({ code }) => {
      const game = turtleArena.updateCode(socket, roomId, code);
      turtleArenaNamespace.to(roomId).emit('state', game);
    });

    socket.on('disconnect', () => {
      turtleArena.removePlayer(socket, roomId);
      turtleArenaNamespace.to(roomId).emit('state', turtleArena.games[roomId]);
    });
  });

  // Memory Duel namespace
  const memoryDuelNamespace = io.of('/memory-duel');
  memoryDuelNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = memoryDuel.joinGame(socket, nickname, roomId);
      memoryDuelNamespace.to(roomId).emit('state', game);
    });

    socket.on('start', () => {
      const game = memoryDuel.startGame(roomId);
      memoryDuelNamespace.to(roomId).emit('state', game);
    });

    socket.on('flipCard', ({ cardId }) => {
      const game = memoryDuel.flipCard(socket, roomId, cardId);
      memoryDuelNamespace.to(roomId).emit('state', game);
    });

    socket.on('usePower', ({ powerType, target }) => {
      const game = memoryDuel.usePower(socket, roomId, powerType, target);
      memoryDuelNamespace.to(roomId).emit('state', game);
    });

    socket.on('disconnect', () => {
      memoryDuel.removePlayer(socket, roomId);
      memoryDuelNamespace.to(roomId).emit('state', memoryDuel.games[roomId]);
    });
  });

  // AI Pet Battlers namespace
  const aiPetBattlersNamespace = io.of('/ai-pet-battlers');
  aiPetBattlersNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = aiPetBattlers.joinGame(socket, nickname, roomId);
      aiPetBattlersNamespace.to(roomId).emit('state', game);
    });

    socket.on('selectPet', ({ petType }) => {
      const game = aiPetBattlers.selectPet(socket, roomId, petType);
      aiPetBattlersNamespace.to(roomId).emit('state', game);
    });

    socket.on('start', () => {
      const game = aiPetBattlers.startGame(roomId);
      aiPetBattlersNamespace.to(roomId).emit('state', game);
    });

    socket.on('executeMove', ({ moveType, target }) => {
      const game = aiPetBattlers.executeMove(socket, roomId, moveType, target);
      aiPetBattlersNamespace.to(roomId).emit('state', game);
    });

    socket.on('updateAI', ({ aiCode }) => {
      const game = aiPetBattlers.updateAI(socket, roomId, aiCode);
      aiPetBattlersNamespace.to(roomId).emit('state', game);
    });

    socket.on('executeAI', () => {
      const game = aiPetBattlers.executeAI(socket, roomId);
      aiPetBattlersNamespace.to(roomId).emit('state', game);
    });

    socket.on('disconnect', () => {
      aiPetBattlers.removePlayer(socket, roomId);
      aiPetBattlersNamespace.to(roomId).emit('state', aiPetBattlers.games[roomId]);
    });
  });

  // Craft & Trade namespace
  const craftTradeNamespace = io.of('/craft-trade');
  craftTradeNamespace.on('connection', (socket) => {
    let roomId = null;

    socket.on('join', ({ nickname, room }) => {
      roomId = room;
      const game = craftTrade.joinGame(socket, nickname, roomId);
      craftTradeNamespace.to(roomId).emit('state', game);
    });

    socket.on('start', () => {
      const game = craftTrade.startGame(roomId);
      craftTradeNamespace.to(roomId).emit('state', game);
    });

    socket.on('buyItem', ({ itemId, quantity }) => {
      const game = craftTrade.buyItem(socket, roomId, itemId, quantity);
      craftTradeNamespace.to(roomId).emit('state', game);
    });

    socket.on('sellItem', ({ itemId, quantity }) => {
      const game = craftTrade.sellItem(socket, roomId, itemId, quantity);
      craftTradeNamespace.to(roomId).emit('state', game);
    });

    socket.on('craftItem', ({ itemId }) => {
      const game = craftTrade.craftItem(socket, roomId, itemId);
      craftTradeNamespace.to(roomId).emit('state', game);
    });

    socket.on('createTrade', ({ targetPlayerId, offerItems, requestItems }) => {
      const game = craftTrade.createTradeOffer(socket, roomId, targetPlayerId, offerItems, requestItems);
      craftTradeNamespace.to(roomId).emit('state', game);
    });

    socket.on('acceptTrade', ({ tradeId }) => {
      const game = craftTrade.acceptTrade(socket, roomId, tradeId);
      craftTradeNamespace.to(roomId).emit('state', game);
    });

    socket.on('chatMessage', ({ message }) => {
      const game = craftTrade.sendChatMessage(socket, roomId, message);
      craftTradeNamespace.to(roomId).emit('state', game);
    });

    socket.on('disconnect', () => {
      craftTrade.removePlayer(socket, roomId);
      craftTradeNamespace.to(roomId).emit('state', craftTrade.games[roomId]);
    });
  });

  // Main namespace for chat, video, drawing, friends, and messages
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle authentication and user room joining
    socket.on('authenticate', (data) => {
      if (data.token) {
        // Verify JWT token and get user ID
        const jwt = require('jsonwebtoken');
        try {
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
          socket.userId = decoded.id;
          socket.join(`user_${decoded.id}`);
          console.log(`User ${decoded.id} authenticated and joined room`);
        } catch (error) {
          console.error('Socket authentication failed:', error);
          socket.emit('auth_error', 'Authentication failed');
        }
      }
    });

    // Chat messaging
    socket.on('chat message', (data) => {
      io.emit('chat message', data);
    });

    // Collaborative drawing
    socket.on('draw', (data) => {
      socket.broadcast.emit('draw', data);
    });

    // Video chat signaling (WebRTC)
    socket.on('signal', (data) => {
      socket.broadcast.emit('signal', data);
    });

    // Friend system events
    socket.on('friend_request', (data) => {
      io.to(`user_${data.receiverId}`).emit('friendRequest', data);
      // Send notification
      io.to(`user_${data.receiverId}`).emit('notification', {
        type: 'friend_request',
        title: 'Friend Request',
        message: `${data.senderName} wants to be friends`,
        data: data
      });
    });

    socket.on('friend_request_response', (data) => {
      io.to(`user_${data.requesterId}`).emit('friendRequestResponse', data);
      // Send notification
      io.to(`user_${data.requesterId}`).emit('notification', {
        type: 'friend_request_response',
        title: `Friend Request ${data.response}`,
        message: `Your friend request was ${data.response}`,
        data: data
      });
    });

    socket.on('friend_removed', (data) => {
      io.to(`user_${data.removedFriendId}`).emit('friendRemoved', data);
    });

    // User presence tracking
    socket.on('user_online', (userId) => {
      io.emit('userOnline', userId);
    });

    // Game room events
    socket.on('join_game_room', (data) => {
      const { roomId, userId, role } = data;
      socket.join(`game_room_${roomId}`);
      
      // Notify other players in the room
      socket.to(`game_room_${roomId}`).emit('playerJoined', {
        roomId,
        user: data.user,
        role,
        currentPlayers: data.currentPlayers
      });
    });

    socket.on('leave_game_room', (data) => {
      const { roomId, userId, role } = data;
      socket.leave(`game_room_${roomId}`);
      
      // Notify other players in the room
      socket.to(`game_room_${roomId}`).emit('playerLeft', {
        roomId,
        user: data.user,
        role,
        currentPlayers: data.currentPlayers
      });
    });

    socket.on('game_room_created', (data) => {
      // Notify friends about new room if it's friend-only
      if (data.friendsOnly && data.friends) {
        data.friends.forEach(friendId => {
          io.to(`user_${friendId}`).emit('friendGameRoomCreated', {
            roomId: data.roomId,
            gameType: data.gameType,
            hostName: data.hostName,
            roomName: data.roomName
          });
        });
      }
    });

    // Game invitations
    socket.on('game_invite', (data) => {
      io.to(`user_${data.inviteeId}`).emit('gameInvite', data);
      // Send notification
      io.to(`user_${data.inviteeId}`).emit('notification', {
        type: 'game_invite',
        title: 'Game Invitation',
        message: `${data.inviterName} invited you to play ${data.gameType}`,
        data: data
      });
    });

    socket.on('game_invite_response', (data) => {
      io.to(`user_${data.inviterId}`).emit('gameInviteResponse', data);
      // Send notification
      io.to(`user_${data.inviterId}`).emit('notification', {
        type: 'game_invite_response',
        title: `Game Invitation ${data.response}`,
        message: `${data.inviteeName} ${data.response} your game invitation`,
        data: data
      });
    });

    // Private messaging
    socket.on('private_message', (data) => {
      io.to(`user_${data.receiverId}`).emit('privateMessage', data);
      // Send notification
      io.to(`user_${data.receiverId}`).emit('notification', {
        type: 'private_message',
        title: 'New Message',
        message: `${data.senderName}: ${data.message}`,
        data: data
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      if (socket.userId) {
        io.emit('userOffline', socket.userId);
      }
    });
  });

  // Chess game namespace
  const chessGame = require('./games/chess');
  const chessNamespace = io.of('/chess');
  
  chessNamespace.on('connection', (socket) => {
    console.log('Chess player connected:', socket.id);
    
    socket.on('join', (data) => {
      const { roomId, playerName } = data;
      const result = chessGame.joinRoom(roomId, socket.id, playerName);
      
      if (result.success) {
        socket.join(roomId);
        socket.emit('joined', { color: result.color, room: chessGame.getRoomState(roomId) });
        socket.to(roomId).emit('playerJoined', { 
          player: result.room.players[socket.id], 
          room: chessGame.getRoomState(roomId) 
        });
      } else {
        socket.emit('error', result.error);
      }
    });
    
    socket.on('move', (data) => {
      const { roomId, move } = data;
      const result = chessGame.makeMove(roomId, socket.id, move);
      
      if (result.success) {
        chessNamespace.to(roomId).emit('move', {
          move: result.move,
          room: chessGame.getRoomState(roomId)
        });
      } else {
        socket.emit('error', result.error);
      }
    });
    
    socket.on('resign', (data) => {
      const { roomId } = data;
      const result = chessGame.resign(roomId, socket.id);
      
      if (result.success) {
        chessNamespace.to(roomId).emit('gameEnd', {
          room: chessGame.getRoomState(roomId)
        });
      }
    });
    
    socket.on('offerDraw', (data) => {
      const { roomId } = data;
      const result = chessGame.offerDraw(roomId, socket.id);
      
      if (result.success) {
        socket.to(roomId).emit('drawOffer', {
          from: socket.id,
          room: chessGame.getRoomState(roomId)
        });
      }
    });
    
    socket.on('acceptDraw', (data) => {
      const { roomId } = data;
      const result = chessGame.acceptDraw(roomId, socket.id);
      
      if (result.success) {
        chessNamespace.to(roomId).emit('gameEnd', {
          room: chessGame.getRoomState(roomId)
        });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Chess player disconnected:', socket.id);
      // Handle disconnection for all rooms
      chessGame.rooms.forEach((room, roomId) => {
        if (room.players[socket.id] || room.spectators.has(socket.id)) {
          chessGame.leaveRoom(roomId, socket.id);
          socket.to(roomId).emit('playerLeft', { 
            playerId: socket.id, 
            room: chessGame.getRoomState(roomId) 
          });
          chessGame.cleanupRoom(roomId);
        }
      });
    });
  });

  // Pacman game namespace
  const pacmanGame = require('./games/pacman');
  const pacmanNamespace = io.of('/pacman');
  
  pacmanNamespace.on('connection', (socket) => {
    console.log('Pacman player connected:', socket.id);
    
    socket.on('join', (data) => {
      const { roomId, playerName } = data;
      const result = pacmanGame.joinRoom(roomId, socket.id, playerName);
      
      if (result.success) {
        socket.join(roomId);
        socket.emit('joined', { role: result.role, room: pacmanGame.getRoomState(roomId) });
        socket.to(roomId).emit('playerJoined', { 
          player: result.room.players[socket.id], 
          room: pacmanGame.getRoomState(roomId) 
        });
        
        // Start sending game updates
        if (result.role === 'player') {
          const gameUpdateInterval = setInterval(() => {
            const room = pacmanGame.getRoomState(roomId);
            if (room && room.gameState === 'playing') {
              pacmanNamespace.to(roomId).emit('gameUpdate', room);
            } else {
              clearInterval(gameUpdateInterval);
            }
          }, 150);
        }
      } else {
        socket.emit('error', result.error);
      }
    });
    
    socket.on('move', (data) => {
      const { roomId, direction } = data;
      const result = pacmanGame.movePlayer(roomId, socket.id, direction);
      
      if (result.success) {
        // Game updates are sent via the interval, not immediately
      } else {
        socket.emit('error', result.error);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Pacman player disconnected:', socket.id);
      // Handle disconnection for all rooms
      pacmanGame.rooms.forEach((room, roomId) => {
        if (room.players[socket.id] || room.spectators.has(socket.id)) {
          pacmanGame.leaveRoom(roomId, socket.id);
          socket.to(roomId).emit('playerLeft', { 
            playerId: socket.id, 
            room: pacmanGame.getRoomState(roomId) 
          });
          pacmanGame.cleanupRoom(roomId);
        }
      });
    });
  });
}

module.exports = setupSocket; 