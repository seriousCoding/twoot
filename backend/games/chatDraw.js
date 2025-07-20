class ChatDrawGame {
  constructor() {
    this.games = {};
  }

  createGame(roomId) {
    const game = {
      players: {},
      currentDrawer: null,
      currentWord: null,
      words: ['cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'flower', 'bird', 'fish'],
      gameState: 'waiting',
      timer: 0,
      round: 1,
      maxRounds: 5,
      guesses: [],
      scores: {},
      canvas: []
    };
    this.games[roomId] = game;
    return game;
  }

  joinGame(socket, playerName, roomId) {
    let game = this.games[roomId];
    if (!game) {
      game = this.createGame(roomId);
    }
    
    game.players[socket.id] = {
      id: socket.id,
      nickname: playerName || `Player${Math.floor(Math.random() * 1000)}`,
      isDrawing: false,
      hasGuessed: false
    };
    
    game.scores[socket.id] = 0;
    
    if (Object.keys(game.players).length >= 2 && game.gameState === 'waiting') {
        this.startGame(roomId);
    }

    return game;
  }
  
  handleAction(roomId, playerId, data) {
      switch(data.type) {
          case 'draw':
              return this.draw(playerId, roomId, data.drawData);
          case 'guess':
              return this.guess(playerId, roomId, data.guessText);
          default:
              return this.games[roomId];
      }
  }

  getRoomState(roomId) {
      const game = this.games[roomId];
      if (!game) return null;
      // Don't send the word to guessers
      const wordForClient = (player) => player.isDrawing ? game.currentWord : null;

      return {
          players: game.players,
          currentDrawer: game.currentDrawer,
          currentWord: game.currentWord, // This should be filtered on client side
          gameState: game.gameState,
          timer: game.timer,
          round: game.round,
          guesses: game.guesses,
          scores: game.scores,
          canvas: game.canvas
      };
  }

  leaveRoom(roomId, playerId) {
    const game = this.games[roomId];
    if (game) {
        delete game.players[playerId];
        delete game.scores[playerId];
        if (Object.keys(game.players).length < 2) {
            game.gameState = 'waiting';
        } else if (game.currentDrawer === playerId) {
            this.nextRound(roomId);
        }
    }
  }
  
  cleanupRoom(roomId) {
      const game = this.games[roomId];
      if (game && Object.keys(game.players).length === 0) {
          delete this.games[roomId];
      }
  }

  startGame(roomId) {
    const game = this.games[roomId];
    if (!game) return;
    
    const playerIds = Object.keys(game.players);
    if (playerIds.length < 2) return;
    
    game.gameState = 'playing';
    this.nextRound(roomId);
  }

  draw(playerId, roomId, drawData) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId] || !game.players[playerId].isDrawing) return;
    
    game.canvas.push(drawData);
  }

  guess(playerId, roomId, guessText) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId] || game.players[playerId].isDrawing) return;
    
    const player = game.players[playerId];
    if (player.hasGuessed) return;
    
    const guess = {
      playerId: playerId,
      nickname: player.nickname,
      guess: guessText,
      timestamp: Date.now(),
      correct: guessText.toLowerCase() === game.currentWord.toLowerCase()
    };
    
    game.guesses.push(guess);
    
    if (guess.correct) {
      player.hasGuessed = true;
      game.scores[playerId] += 100;
      
      const nonDrawers = Object.values(game.players).filter(p => !p.isDrawing);
      const allGuessed = nonDrawers.every(p => p.hasGuessed);
      
      if (allGuessed) {
        this.nextRound(roomId);
      }
    }
  }

  nextRound(roomId) {
    const game = this.games[roomId];
    if (!game) return;
    
    const playerIds = Object.keys(game.players);
    if (playerIds.length === 0) return;

    const currentIndex = playerIds.indexOf(game.currentDrawer);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    
    if (nextIndex === 0) {
      game.round++;
    }
    
    if (game.round > game.maxRounds) {
      game.gameState = 'finished';
      return;
    }
    
    game.currentDrawer = playerIds[nextIndex];
    game.currentWord = game.words[Math.floor(Math.random() * game.words.length)];
    game.timer = 60;
    game.canvas = [];
    game.guesses = [];
    
    Object.values(game.players).forEach(player => {
      player.isDrawing = false;
      player.hasGuessed = false;
    });
    
    if(game.players[game.currentDrawer]) {
        game.players[game.currentDrawer].isDrawing = true;
    }
  }
}

module.exports = new ChatDrawGame();