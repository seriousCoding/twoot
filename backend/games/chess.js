const { Chess } = require('chess.js');

class ChessGame {
  constructor() {
    this.rooms = new Map();
    this.waitingPlayers = [];
  }

  createRoom(roomId) {
    const room = {
      id: roomId,
      players: {},
      chess: new Chess(),
      gameState: 'waiting', // waiting, playing, finished
      currentPlayer: 'white',
      spectators: new Set(),
      moves: [],
      timeControl: {
        white: 600000, // 10 minutes in milliseconds
        black: 600000,
        lastMoveTime: Date.now()
      },
      result: null
    };
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId, playerId, playerName) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }

    // Check if player is already in room
    if (room.players[playerId]) {
      return { success: true, room, color: room.players[playerId].color };
    }

    // Assign player color
    const existingColors = Object.values(room.players).map(p => p.color);
    let color = null;
    
    if (!existingColors.includes('white')) {
      color = 'white';
    } else if (!existingColors.includes('black')) {
      color = 'black';
    } else {
      // Room is full, join as spectator
      room.spectators.add(playerId);
      return { success: true, room, color: 'spectator' };
    }

    room.players[playerId] = {
      id: playerId,
      name: playerName,
      color: color,
      connected: true
    };

    // Start game if both players are present
    if (Object.keys(room.players).length === 2) {
      room.gameState = 'playing';
      room.timeControl.lastMoveTime = Date.now();
    }

    return { success: true, room, color };
  }

  makeMove(roomId, playerId, move) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const player = room.players[playerId];
    if (!player) {
      return { success: false, error: 'Player not in room' };
    }

    if (room.gameState !== 'playing') {
      return { success: false, error: 'Game not in progress' };
    }

    if (player.color !== room.currentPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    try {
      const moveResult = room.chess.move(move);
      if (!moveResult) {
        return { success: false, error: 'Invalid move' };
      }

      // Update time control
      const now = Date.now();
      const timeUsed = now - room.timeControl.lastMoveTime;
      room.timeControl[room.currentPlayer] -= timeUsed;
      room.timeControl.lastMoveTime = now;

      // Add move to history
      room.moves.push({
        move: moveResult,
        timestamp: now,
        timeRemaining: room.timeControl[room.currentPlayer]
      });

      // Switch players
      room.currentPlayer = room.currentPlayer === 'white' ? 'black' : 'white';

      // Check for game end
      if (room.chess.isGameOver()) {
        room.gameState = 'finished';
        if (room.chess.isCheckmate()) {
          room.result = {
            type: 'checkmate',
            winner: room.chess.turn() === 'w' ? 'black' : 'white'
          };
        } else if (room.chess.isStalemate()) {
          room.result = { type: 'stalemate', winner: null };
        } else if (room.chess.isThreefoldRepetition()) {
          room.result = { type: 'repetition', winner: null };
        } else if (room.chess.isInsufficientMaterial()) {
          room.result = { type: 'insufficient_material', winner: null };
        } else {
          room.result = { type: 'draw', winner: null };
        }
      }

      // Check for time control
      if (room.timeControl[room.currentPlayer] <= 0) {
        room.gameState = 'finished';
        room.result = {
          type: 'timeout',
          winner: room.currentPlayer === 'white' ? 'black' : 'white'
        };
      }

      return { success: true, room, move: moveResult };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  resign(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const player = room.players[playerId];
    if (!player) {
      return { success: false, error: 'Player not in room' };
    }

    room.gameState = 'finished';
    room.result = {
      type: 'resignation',
      winner: player.color === 'white' ? 'black' : 'white'
    };

    return { success: true, room };
  }

  offerDraw(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.players[playerId]) {
      return { success: false, error: 'Player not in room' };
    }

    room.drawOffer = playerId;
    return { success: true, room };
  }

  acceptDraw(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.players[playerId]) {
      return { success: false, error: 'Player not in room' };
    }

    if (room.drawOffer && room.drawOffer !== playerId) {
      room.gameState = 'finished';
      room.result = { type: 'draw', winner: null };
      delete room.drawOffer;
      return { success: true, room };
    }

    return { success: false, error: 'No draw offer to accept' };
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      players: room.players,
      gameState: room.gameState,
      currentPlayer: room.currentPlayer,
      fen: room.chess.fen(),
      pgn: room.chess.pgn(),
      moves: room.moves,
      timeControl: room.timeControl,
      result: room.result,
      drawOffer: room.drawOffer,
      isCheck: room.chess.isCheck(),
      isCheckmate: room.chess.isCheckmate(),
      isStalemate: room.chess.isStalemate(),
      isDraw: room.chess.isDraw(),
      spectatorCount: room.spectators.size
    };
  }

  leaveRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (room.players[playerId]) {
      room.players[playerId].connected = false;
      // In a real implementation, you might want to give the player
      // some time to reconnect before ending the game
    }

    room.spectators.delete(playerId);
    return true;
  }

  cleanupRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const activePlayers = Object.values(room.players).filter(p => p.connected);
    if (activePlayers.length === 0 && room.spectators.size === 0) {
      this.rooms.delete(roomId);
      return true;
    }
    return false;
  }
}

module.exports = new ChessGame();