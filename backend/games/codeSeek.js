const { v4: uuidv4 } = require('uuid');

class CodeSeekGame {
  constructor() {
    this.games = {};
  }

  createGame(roomId) {
    const game = {
      players: {}, // socketId -> { nickname, x, y, isSeeker, isHidden, score, foundBy }
      seekerId: null,
      started: false,
      gamePhase: 'waiting', // waiting, hiding, seeking, finished
      timer: 0,
      round: 1,
      maxRounds: 3,
      hideTime: 30, // 30 seconds to hide
      seekTime: 60, // 60 seconds to seek
      hidingSpots: this.generateHidingSpots(),
      gameArea: { width: 800, height: 600 },
      roundStartTime: null,
      scores: {},
      winner: null
    };
    this.games[roomId] = game;
    return game;
  }

  generateHidingSpots() {
    const spots = [];
    const spotTypes = [
      { type: 'bush', size: 40, maxPlayers: 2 },
      { type: 'tree', size: 30, maxPlayers: 1 },
      { type: 'rock', size: 35, maxPlayers: 2 },
      { type: 'building', size: 60, maxPlayers: 3 },
      { type: 'barrel', size: 25, maxPlayers: 1 }
    ];
    
    // Generate 15-20 hiding spots randomly placed
    for (let i = 0; i < 18; i++) {
      const spotType = spotTypes[Math.floor(Math.random() * spotTypes.length)];
      const spot = {
        id: uuidv4(),
        x: Math.random() * (800 - spotType.size * 2) + spotType.size,
        y: Math.random() * (600 - spotType.size * 2) + spotType.size,
        ...spotType,
        hiddenPlayers: [],
        discovered: false
      };
      spots.push(spot);
    }
    
    return spots;
  }

  joinGame(socket, playerName, roomId) {
    let game = this.games[roomId];
    if (!game) {
      game = this.createGame(roomId);
    }
    
    if (Object.keys(game.players).length >= 6) {
      // Game is full
      return game;
    }
    
    game.players[socket.id] = {
      id: socket.id,
      nickname: playerName,
      x: Math.random() * 600 + 100,
      y: Math.random() * 400 + 100,
      isSeeker: false,
      isHidden: false,
      score: 0,
      foundBy: null,
      hidingSpot: null,
      timeFound: null
    };
    
    // Initialize score tracking
    if (!game.scores[socket.id]) {
      game.scores[socket.id] = {
        totalScore: 0,
        roundsAsSeeker: 0,
        playersFound: 0,
        roundsHidden: 0,
        timesFound: 0
      };
    }
    
    if (Object.keys(game.players).length >= 3 && !game.started) {
        this.startGame(roomId);
    }

    return game;
  }
  
  handleAction(roomId, playerId, data) {
      switch(data.type) {
          case 'hide':
              return this.hideInSpot(playerId, roomId, data.spotId);
          case 'leaveSpot':
              return this.leaveHidingSpot(playerId, roomId);
          case 'search':
              return this.searchHidingSpot(playerId, roomId, data.spotId);
          default:
              return this.games[roomId];
      }
  }

  getRoomState(roomId) {
      const game = this.games[roomId];
      if (!game) return null;

      return {
          players: game.players,
          seekerId: game.seekerId,
          gamePhase: game.gamePhase,
          timer: game.timer,
          round: game.round,
          hidingSpots: game.hidingSpots.map(spot => ({...spot, hiddenPlayers: spot.hiddenPlayers.map(p => p.id)})),
          scores: game.scores,
          winner: game.winner
      };
  }
  
  leaveRoom(roomId, playerId) {
      const game = this.games[roomId];
      if (game && game.players[playerId]) {
          delete game.players[playerId];
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
    if (playerIds.length < 3) return;
    
    game.started = true;
    this.startRound(game);
  }

  startRound(game) {
    const playerIds = Object.keys(game.players).filter(id => game.players[id]);
    
    // Reset all players
    Object.values(game.players).forEach(player => {
      player.isSeeker = false;
      player.isHidden = false;
      player.foundBy = null;
      player.hidingSpot = null;
      player.timeFound = null;
    });
    
    // Reset hiding spots
    game.hidingSpots.forEach(spot => {
      spot.hiddenPlayers = [];
      spot.discovered = false;
    });
    
    // Choose new seeker (rotate)
    const seekerIndex = (game.round - 1) % playerIds.length;
    game.seekerId = playerIds[seekerIndex];
    game.players[game.seekerId].isSeeker = true;
    game.scores[game.seekerId].roundsAsSeeker++;
    
    // All other players are hiders
    playerIds.forEach(id => {
      if (id !== game.seekerId) {
        game.scores[id].roundsHidden++;
      }
    });
    
    // Start hiding phase
    game.gamePhase = 'hiding';
    game.timer = game.hideTime;
    game.roundStartTime = Date.now();
    
    // Auto-transition to seeking phase after hide time
    setTimeout(() => {
      if (game.gamePhase === 'hiding') {
        this.startSeekingPhase(game);
      }
    }, game.hideTime * 1000);
  }

  startSeekingPhase(game) {
    game.gamePhase = 'seeking';
    game.timer = game.seekTime;
    
    // Auto-end round after seek time
    setTimeout(() => {
      if (game.gamePhase === 'seeking') {
        this.endRound(game);
      }
    }, game.seekTime * 1000);
  }

  endRound(game) {
    game.gamePhase = 'roundEnd';
    
    // Calculate scores for this round
    const roundScores = this.calculateRoundScores(game);
    
    // Apply scores
    Object.entries(roundScores).forEach(([playerId, score]) => {
      if (game.players[playerId]) {
        game.players[playerId].score += score;
        game.scores[playerId].totalScore += score;
      }
    });
    
    game.round++;
    
    // Check if game is finished
    if (game.round > game.maxRounds) {
      this.endGame(game);
    } else {
      // Start next round after delay
      setTimeout(() => {
        if (game.started) {
          this.startRound(game);
        }
      }, 5000);
    }
  }

  endGame(game) {
    game.gamePhase = 'finished';
    
    // Determine winner
    const playerScores = Object.entries(game.scores).map(([playerId, scores]) => ({
      playerId,
      nickname: game.players[playerId]?.nickname || 'Unknown',
      totalScore: scores.totalScore
    }));
    
    playerScores.sort((a, b) => b.totalScore - a.totalScore);
    game.winner = playerScores[0];
    game.finalScores = playerScores;
  }

  calculateRoundScores(game) {
    const scores = {};
    const playerIds = Object.keys(game.players);
    const totalHiders = playerIds.length - 1;
    
    // Initialize scores
    playerIds.forEach(id => {
      scores[id] = 0;
    });
    
    // Seeker scoring
    const seeker = game.players[game.seekerId];
    if (seeker) {
      const playersFound = Object.values(game.players).filter(p => 
        !p.isSeeker && p.foundBy === game.seekerId
      ).length;
      
      // Seeker gets points for each player found
      scores[game.seekerId] = playersFound * 20;
      
      // Bonus for finding everyone
      if (playersFound === totalHiders) {
        scores[game.seekerId] += 50;
      }
      
      game.scores[game.seekerId].playersFound += playersFound;
    }
    
    // Hider scoring
    Object.values(game.players).forEach(player => {
      if (!player.isSeeker) {
        if (!player.foundBy) {
          // Not found - full points
          scores[player.id] += 30;
        } else {
          // Found - partial points based on how long they stayed hidden
          const timeHidden = (player.timeFound - game.roundStartTime) / 1000;
          const maxTime = game.hideTime + game.seekTime;
          const timeBonus = Math.floor((timeHidden / maxTime) * 20);
          scores[player.id] += Math.max(5, timeBonus);
          
          game.scores[player.id].timesFound++;
        }
      }
    });
    
    return scores;
  }

  hideInSpot(playerId, roomId, spotId) {
    const game = this.games[roomId];
    if (!game) return;
    
    const player = game.players[playerId];
    const spot = game.hidingSpots.find(s => s.id === spotId);
    
    if (!player || !spot || player.isSeeker || player.isHidden) return;
    
    if (spot.hiddenPlayers.length < spot.maxPlayers) {
      // Remove from old spot if any
      if (player.hidingSpot) {
        const oldSpot = game.hidingSpots.find(s => s.id === player.hidingSpot);
        if (oldSpot) {
          oldSpot.hiddenPlayers = oldSpot.hiddenPlayers.filter(pId => pId !== playerId);
        }
      }
      
      player.isHidden = true;
      player.hidingSpot = spot.id;
      spot.hiddenPlayers.push(playerId);
    }
  }

  leaveHidingSpot(playerId, roomId) {
    const game = this.games[roomId];
    if (!game) return;
    
    const player = game.players[playerId];
    if (!player || !player.isHidden) return;
    
    const spot = game.hidingSpots.find(s => s.id === player.hidingSpot);
    if (spot) {
      spot.hiddenPlayers = spot.hiddenPlayers.filter(pId => pId !== playerId);
    }
    
    player.isHidden = false;
    player.hidingSpot = null;
  }

  searchHidingSpot(playerId, roomId, spotId) {
    const game = this.games[roomId];
    if (!game) return;
    
    const seeker = game.players[playerId];
    const spot = game.hidingSpots.find(s => s.id === spotId);
    
    if (!seeker || !seeker.isSeeker || !spot || spot.discovered) return;
    
    spot.discovered = true;
    
    if (spot.hiddenPlayers.length > 0) {
      spot.hiddenPlayers.forEach(hiderId => {
        const hider = game.players[hiderId];
        if (hider && !hider.foundBy) {
          hider.foundBy = playerId;
          hider.timeFound = Date.now();
          
          // Force hider to leave spot
          this.leaveHidingSpot(hiderId, roomId);
        }
      });
      
      // Check if all hiders are found
      const allHiders = Object.values(game.players).filter(p => !p.isSeeker);
      const allFound = allHiders.every(p => p.foundBy);
      if (allFound) {
        this.endRound(game);
      }
    }
  }

  checkProximityDetection(roomId) {
    const game = this.games[roomId];
    if (!game || game.gamePhase !== 'seeking') return;
    
    const seeker = game.players[game.seekerId];
    if (!seeker) return;
    
    Object.values(game.players).forEach(hider => {
      if (!hider.isSeeker && !hider.isHidden && !hider.foundBy) {
        const distance = Math.sqrt((seeker.x - hider.x)**2 + (seeker.y - hider.y)**2);
        
        if (distance < 30) { // 30 pixels proximity
          hider.foundBy = game.seekerId;
          hider.timeFound = Date.now();
          
          // Check if all hiders are found
          const allHiders = Object.values(game.players).filter(p => !p.isSeeker);
          const allFound = allHiders.every(p => p.foundBy);
          if (allFound) {
            this.endRound(game);
          }
        }
      }
    });
  }
}

module.exports = new CodeSeekGame();