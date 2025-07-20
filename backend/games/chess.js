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
      result: null,
      aiMode: false,
      aiDifficulty: 'medium',
      isAiTurn: false
    };
    this.rooms.set(roomId, room);
    return room;
  }

  joinGame(socket, playerName, roomId, aiMode = false, aiDifficulty = 'medium') {
    let room = this.rooms.get(roomId);
    if (!room) {
      console.log(`[Chess] Room ${roomId} not found. Creating new room.`);
      room = this.createRoom(roomId);
    }

    const playerId = socket.id;

    if (room.players[playerId]) {
      return room;
    }

    room.aiMode = aiMode;
    room.aiDifficulty = aiDifficulty;

    const existingColors = Object.values(room.players).map(p => p.color);
    let color = null;
    
    if (!existingColors.includes('white')) {
      color = 'white';
    } else if (!existingColors.includes('black')) {
      color = 'black';
    } else {
      room.spectators.add(playerId);
      return room;
    }

    room.players[playerId] = {
      id: playerId,
      name: playerName,
      color: color,
      connected: true,
      isAI: false
    };

    if (aiMode && Object.keys(room.players).length === 1) {
      const aiColor = color === 'white' ? 'black' : 'white';
      room.players['ai'] = {
        id: 'ai',
        name: `AI (${aiDifficulty})`,
        color: aiColor,
        connected: true,
        isAI: true
      };
    }

    if (Object.keys(room.players).length === 2) {
      room.gameState = 'playing';
      room.timeControl.lastMoveTime = Date.now();
      console.log(`[Chess] Room ${roomId} is now full. Starting game.`);
      
      if (aiMode && room.currentPlayer === 'white' && room.players['ai']?.color === 'white') {
        console.log(`[Chess] AI is white. Making first move in room ${roomId}.`);
        setTimeout(() => this.makeAIMove(roomId), 1000);
      }
    }

    return room;
  }

  handleAction(roomId, playerId, data) {
    switch (data.type) {
      case 'move':
        return this.makeMove(roomId, playerId, data.move);
      case 'resign':
        return this.resign(roomId, playerId);
      default:
        return this.getRoom(roomId);
    }
  }

  makeMove(roomId, playerId, move) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return room;
    }

    const player = room.players[playerId];
    if (!player) {
      return room;
    }

    if (room.gameState !== 'playing') {
      console.error(`[Chess] Move attempted in room ${roomId} but game state is ${room.gameState}`);
      return room;
    }

    if (player.color !== room.currentPlayer) {
      return room;
    }

    try {
      const moveResult = room.chess.move(move);
      if (!moveResult) {
        console.error(`[Chess] Invalid move in room ${roomId}:`, move);
        return room;
      }
      
      const now = Date.now();
      const timeUsed = now - room.timeControl.lastMoveTime;
      room.timeControl[room.currentPlayer] -= timeUsed;
      room.timeControl.lastMoveTime = now;

      room.moves.push({
        move: moveResult,
        timestamp: now,
        timeRemaining: room.timeControl[room.currentPlayer]
      });

      room.currentPlayer = room.currentPlayer === 'white' ? 'black' : 'white';

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
        console.log(`[Chess] Game in room ${roomId} ended. Result: ${room.result.type}`);
      } else if (room.aiMode && room.players['ai']?.color === room.currentPlayer) {
        console.log(`[Chess] Player move complete. Triggering AI move for ${room.currentPlayer} in room ${roomId}.`);
        setTimeout(() => this.makeAIMove(roomId), 500);
      }

      if (room.timeControl[room.currentPlayer] <= 0) {
        room.gameState = 'finished';
        room.result = {
          type: 'timeout',
          winner: room.currentPlayer === 'white' ? 'black' : 'white'
        };
      }

      return room;
    } catch (error) {
      return room;
    }
  }

  makeAIMove(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameState !== 'playing' || !room.aiMode) return;

    const aiPlayer = room.players['ai'];
    if (!aiPlayer || aiPlayer.color !== room.currentPlayer) return;

    console.log(`[Chess] AI (${room.aiDifficulty}) is thinking for room ${roomId}...`);
    // Get AI move using minimax algorithm
    const aiMove = this.getAIMove(room.chess, room.aiDifficulty);
    if (aiMove) {
      console.log(`[Chess] AI in room ${roomId} chose move:`, aiMove);
      this.makeMove(roomId, 'ai', aiMove);
    } else {
      console.error(`[Chess] AI in room ${roomId} failed to find a move.`);
    }
  }

  getAIMove(chess, difficulty) {
    const depth = this.getDepthFromDifficulty(difficulty);
    const move = this.minimax(chess, depth, -Infinity, Infinity, chess.turn() === 'b');
    return move.move;
  }

  getDepthFromDifficulty(difficulty) {
    switch (difficulty) {
      case 'easy': return 1;
      case 'medium': return 3;
      case 'hard': return 5;
      default: return 3;
    }
  }

  minimax(chess, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || chess.isGameOver()) {
      return { score: this.evaluatePosition(chess), move: null };
    }

    const moves = chess.moves({ verbose: true });
    let bestMove = null;

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of moves) {
        chess.move(move);
        const result = this.minimax(chess, depth - 1, alpha, beta, false);
        chess.undo();

        if (result.score > maxScore) {
          maxScore = result.score;
          bestMove = move;
        }

        alpha = Math.max(alpha, result.score);
        if (beta <= alpha) break; // Alpha-beta pruning
      }
      return { score: maxScore, move: bestMove };
    } else {
      let minScore = Infinity;
      for (const move of moves) {
        chess.move(move);
        const result = this.minimax(chess, depth - 1, alpha, beta, true);
        chess.undo();

        if (result.score < minScore) {
          minScore = result.score;
          bestMove = move;
        }

        beta = Math.min(beta, result.score);
        if (beta <= alpha) break; // Alpha-beta pruning
      }
      return { score: minScore, move: bestMove };
    }
  }

  evaluatePosition(chess) {
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -10000 : 10000;
    }
    if (chess.isDraw() || chess.isStalemate()) {
      return 0;
    }

    let score = 0;
    const board = chess.board();

    // Piece values
    const pieceValues = {
      p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
      P: -1, N: -3, B: -3, R: -5, Q: -9, K: 0
    };

    // Position tables for piece placement
    const pawnTable = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [5, 10, 10,-20,-20, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ];

    const knightTable = [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ];

    // Evaluate material and position
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const type = piece.type;
          const color = piece.color;
          const isWhite = color === 'w';
          
          // Material value
          const materialValue = pieceValues[isWhite ? type.toUpperCase() : type];
          score += materialValue * 100;

          // Positional value
          let positionalValue = 0;
          const tableRow = isWhite ? 7 - row : row;
          
          switch (type) {
            case 'p':
              positionalValue = pawnTable[tableRow][col];
              break;
            case 'n':
              positionalValue = knightTable[tableRow][col];
              break;
            case 'b':
              positionalValue = 10; // Basic bishop bonus
              break;
            case 'r':
              positionalValue = 0; // Rook positioning
              break;
            case 'q':
              positionalValue = 0; // Queen positioning
              break;
            case 'k':
              positionalValue = 0; // King safety
              break;
          }

          score += (isWhite ? -positionalValue : positionalValue);
        }
      }
    }

    // Add mobility bonus
    const currentFen = chess.fen();
    const whiteMoves = chess.turn() === 'w' ? chess.moves().length : 0;
    const blackMoves = chess.turn() === 'b' ? chess.moves().length : 0;
    
    // Calculate mobility for both sides if needed
    if (chess.turn() === 'w') {
      // Save current state
      const fenParts = currentFen.split(' ');
      const blackFen = fenParts[0] + ' b ' + fenParts.slice(2).join(' ');
      try {
        const tempChess = new (require('chess.js').Chess)(blackFen);
        const blackMoveCount = tempChess.moves().length;
        score += (blackMoveCount - whiteMoves) * 0.1;
      } catch (e) {
        // If FEN manipulation fails, skip mobility bonus
      }
    } else {
      // Save current state
      const fenParts = currentFen.split(' ');
      const whiteFen = fenParts[0] + ' w ' + fenParts.slice(2).join(' ');
      try {
        const tempChess = new (require('chess.js').Chess)(whiteFen);
        const whiteMoveCount = tempChess.moves().length;
        score += (blackMoves - whiteMoveCount) * 0.1;
      } catch (e) {
        // If FEN manipulation fails, skip mobility bonus
      }
    }

    return score;
  }

  resign(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.players[playerId] || room.gameState !== 'playing') {
      return room;
    }
    const player = room.players[playerId];
    room.gameState = 'finished';
    room.result = {
      type: 'resignation',
      winner: player.color === 'white' ? 'black' : 'white'
    };
    return room;
  }

  offerDraw(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.players[playerId]) {
      return room;
    }

    room.drawOffer = playerId;
    return room;
  }

  acceptDraw(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.players[playerId] || !room.drawOffer) {
      return room;
    }
    if (room.drawOffer === playerId) {
      return room;
    }
    room.gameState = 'finished';
    room.result = {
      type: 'draw_agreement',
      winner: null
    };
    room.drawOffer = null;
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    // Create a serializable version of players
    const players = {};
    for(const id in room.players) {
        players[id] = {
            id: room.players[id].id,
            name: room.players[id].name,
            color: room.players[id].color,
            connected: room.players[id].connected,
            isAI: room.players[id].isAI
        };
    }

    return {
      id: room.id,
      players: players,
      fen: room.chess.fen(),
      gameState: room.gameState,
      currentPlayer: room.currentPlayer,
      spectatorCount: room.spectators.size,
      moves: room.moves.slice(-10), // Send last 10 moves
      timeControl: room.timeControl,
      result: room.result,
      aiMode: room.aiMode
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