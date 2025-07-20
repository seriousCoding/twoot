const { Server } = require('socket.io');
const codeSeek = require('./games/codeSeek');
const codeConquer = require('./games/codeConquer');
const dungeonBuilders = require('./games/dungeonBuilders');
const pixelFarmTycoon = require('./games/pixelFarmTycoon');
const chatDraw = require('./games/chatDraw');
const turtleArena = require('./games/turtleArena');
const memoryDuel = require('./games/memoryDuel');
const aiPetBattlers = require('./games/aiPetBattlers');
const craftTrade = require('./games/craftTrade');
const chessGame = require('./games/chess');
const pacmanGame = require('./games/pacman');

function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000" }
  });

  global.io = io;

  const games = [
    { name: 'code-seek', handler: codeSeek, rooms: codeSeek.games },
    { name: 'code-conquer', handler: codeConquer, rooms: codeConquer.games },
    { name: 'dungeon-builders', handler: dungeonBuilders, rooms: dungeonBuilders.games },
    { name: 'pixel-farm-tycoon', handler: pixelFarmTycoon, rooms: pixelFarmTycoon.games },
    { name: 'chat-draw', handler: chatDraw, rooms: chatDraw.games },
    { name: 'turtle-arena', handler: turtleArena, rooms: turtleArena.games },
    { name: 'memory-duel', handler: memoryDuel, rooms: memoryDuel.games },
    { name: 'ai-pet-battlers', handler: aiPetBattlers, rooms: aiPetBattlers.games },
    { name: 'craft-trade', handler: craftTrade, rooms: craftTrade.games },
    { name: 'chess', handler: chessGame, rooms: chessGame.rooms },
    { name: 'pacman', handler: pacmanGame, rooms: pacmanGame.rooms }
  ];

  games.forEach(game => {
    const namespace = io.of(`/${game.name}`);
    namespace.on('connection', (socket) => {
      console.log(`[${game.name}] Player connected:`, socket.id);

      socket.on('join', (data) => {
        console.log(`[${game.name}] Join event received:`, data);
        const { room: roomId, nickname: playerName, aiMode, aiDifficulty } = data;
        
        // Handle both handler-based and direct instance games
        const gameHandler = game.handler || game;
        const room = gameHandler.joinGame(socket, playerName, roomId, aiMode, aiDifficulty);
        socket.join(roomId);
        const roomState = gameHandler.getRoomState(roomId);
        console.log(`[${game.name}] Emitting gameState:`, roomState);
        socket.emit('gameState', roomState);
        socket.emit('playerAssigned', socket.id);
        namespace.to(roomId).emit('playerJoined', { player: room.players[socket.id], room: roomState });
      });

      // Generic handler for any game action
      socket.on('action', (data) => {
        console.log(`[${game.name}] Action event received:`, data);
        const gameHandler = game.handler || game;
        const gameRooms = game.rooms || gameHandler.rooms;
        
        let roomId = null;
        for (const [rid, room] of gameRooms.entries()) {
            if (room.players[socket.id]) {
                roomId = rid;
                break;
            }
        }
        if (!roomId) return;
        const room = gameHandler.handleAction(roomId, socket.id, data);
        const roomState = gameHandler.getRoomState(roomId);
        namespace.to(roomId).emit('gameState', roomState);
      });

      // Handle move events for chess and pacman
      socket.on('move', (data) => {
        console.log(`[${game.name}] Move event received:`, data);
        const gameHandler = game.handler || game;
        const gameRooms = game.rooms || gameHandler.rooms;
        
        let roomId = null;
        for (const [rid, room] of gameRooms.entries()) {
            if (room.players[socket.id]) {
                roomId = rid;
                break;
            }
        }
        if (!roomId) return;
        
        // Convert move data to action format
        const actionData = {
          type: 'move',
          ...data
        };
        
        const room = gameHandler.handleAction(roomId, socket.id, actionData);
        const roomState = gameHandler.getRoomState(roomId);
        namespace.to(roomId).emit('gameState', roomState);
      });

      // Handle chess-specific events
      socket.on('resign', (data) => {
        console.log(`[${game.name}] Resign event received:`, data);
        const gameHandler = game.handler || game;
        const gameRooms = game.rooms || gameHandler.rooms;
        
        let roomId = null;
        for (const [rid, room] of gameRooms.entries()) {
            if (room.players[socket.id]) {
                roomId = rid;
                break;
            }
        }
        if (!roomId) return;
        
        const actionData = {
          type: 'resign',
          ...data
        };
        
        const room = gameHandler.handleAction(roomId, socket.id, actionData);
        const roomState = gameHandler.getRoomState(roomId);
        namespace.to(roomId).emit('gameState', roomState);
      });

      socket.on('offerDraw', (data) => {
        console.log(`[${game.name}] Offer draw event received:`, data);
        const gameHandler = game.handler || game;
        const gameRooms = game.rooms || gameHandler.rooms;
        
        let roomId = null;
        for (const [rid, room] of gameRooms.entries()) {
            if (room.players[socket.id]) {
                roomId = rid;
                break;
            }
        }
        if (!roomId) return;
        
        const actionData = {
          type: 'offerDraw',
          ...data
        };
        
        const room = gameHandler.handleAction(roomId, socket.id, actionData);
        const roomState = gameHandler.getRoomState(roomId);
        namespace.to(roomId).emit('gameState', roomState);
      });

      socket.on('disconnect', () => {
        console.log(`[${game.name}] Player disconnected:`, socket.id);
        const gameHandler = game.handler || game;
        const gameRooms = game.rooms || gameHandler.rooms;
        
        if(gameRooms && gameRooms.forEach){
          gameRooms.forEach((room, roomId) => {
            if (room.players[socket.id] || (room.spectators && room.spectators.has(socket.id))) {
              if(gameHandler.leaveRoom){
                gameHandler.leaveRoom(roomId, socket.id);
              }
              const roomState = gameHandler.getRoomState(roomId);
              console.log(`[${game.name}] Emitting playerLeft:`, roomState);
              namespace.to(roomId).emit('playerLeft', { 
                playerId: socket.id, 
                room: roomState 
              });
              if(gameHandler.cleanupRoom){
                gameHandler.cleanupRoom(roomId);
              }
            }
          });
        }
      });
    });
  });
}

module.exports = setupSocket; 