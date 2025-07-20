class MemoryDuelGame {
  constructor() {
    this.games = {};
  }

  createGame(roomId) {
    this.games[roomId] = {
      players: {},
      gameState: 'waiting',
      currentPlayer: null,
      board: [],
      flippedCards: [],
      matches: [],
      timer: 0,
      maxTime: 120,
      powers: {},
      aiMode: false,
      aiDifficulty: 'medium',
      aiMemory: new Map(), // AI memory system
      aiStrategies: {
        easy: { memoryAccuracy: 0.3, lookAhead: 1, powerUsage: 0.2 },
        medium: { memoryAccuracy: 0.7, lookAhead: 2, powerUsage: 0.5 },
        hard: { memoryAccuracy: 0.95, lookAhead: 3, powerUsage: 0.8 }
      }
    };
    return this.games[roomId];
  }

  joinGame(socket, playerName, roomId, aiMode = false, aiDifficulty = 'medium') {
    let game = this.games[roomId];
    if (!game) {
      game = this.createGame(roomId);
    }
    
    game.aiMode = aiMode;
    game.aiDifficulty = aiDifficulty;
    
    game.players[socket.id] = {
      id: socket.id,
      nickname: playerName || `Player${Math.floor(Math.random() * 1000)}`,
      score: 0,
      powers: ['freeze', 'peek', 'shuffle'],
      powerUsed: {},
      isAI: false
    };
    
    // Add AI player if in AI mode and only one human player
    if (aiMode && Object.keys(game.players).length === 1) {
      game.players['ai'] = {
        id: 'ai',
        nickname: `AI (${aiDifficulty})`,
        score: 0,
        powers: ['freeze', 'peek', 'shuffle'],
        powerUsed: {},
        isAI: true
      };
    }
    
    if (Object.keys(game.players).length === 2 && game.gameState === 'waiting') {
      this.startGame(roomId);
    }

    return game;
  }

  handleAction(roomId, playerId, data) {
    switch (data.type) {
      case 'flip':
        return this.flipCard(playerId, roomId, data.cardId);
      case 'power':
        return this.usePower(playerId, roomId, data.powerType, data.target);
      default:
        return this.games[roomId];
    }
  }

  getRoomState(roomId) {
    const game = this.games[roomId];
    if (!game) return null;
    return {
      players: game.players,
      gameState: game.gameState,
      currentPlayer: game.currentPlayer,
      board: game.board.map(c => ({...c, symbol: c.flipped || c.matched ? c.symbol : null})),
      matches: game.matches,
      timer: game.timer
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
    if (!game) return game;
    
    const playerIds = Object.keys(game.players);
    if (playerIds.length < 2) return game;
    
    game.gameState = 'playing';
    game.currentPlayer = playerIds[0];
    game.timer = game.maxTime;
    game.board = this.generateBoard();
    game.flippedCards = [];
    game.matches = [];
    game.aiMemory.clear();
    
    // Initialize AI memory with unknown cards
    if (game.aiMode) {
      game.board.forEach(card => {
        game.aiMemory.set(card.id, {
          symbol: null,
          confidence: 0,
          lastSeen: 0,
          position: card.id
        });
      });
    }
    
    // Reset player powers
    Object.values(game.players).forEach(player => {
      player.powerUsed = {};
    });
    
    // If AI goes first, trigger AI move
    if (game.aiMode && game.currentPlayer === 'ai') {
      setTimeout(() => this.makeAIMove(roomId), 1000);
    }
    
    return game;
  }

  generateBoard() {
    const symbols = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮'];
    const pairs = [];
    
    // Create pairs
    for (let i = 0; i < 8; i++) {
      pairs.push(symbols[i], symbols[i]);
    }
    
    // Shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    
    // Create board with positions
    return pairs.map((symbol, index) => ({
      id: index,
      symbol,
      flipped: false,
      matched: false
    }));
  }

  flipCard(playerId, roomId, cardId) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId] || game.currentPlayer !== playerId) return game;
    
    const card = game.board.find(c => c.id === cardId);
    if (!card || card.flipped || card.matched) return game;
    
    card.flipped = true;
    game.flippedCards.push(cardId);
    
    // Update AI memory if AI is playing
    if (game.aiMode) {
      this.updateAIMemory(game, cardId, card.symbol);
    }
    
    // Check for match when 2 cards are flipped
    if (game.flippedCards.length === 2) {
      const [card1Id, card2Id] = game.flippedCards;
      const card1 = game.board.find(c => c.id === card1Id);
      const card2 = game.board.find(c => c.id === card2Id);
      
      if (card1.symbol === card2.symbol) {
        // Match found
        card1.matched = true;
        card2.matched = true;
        game.matches.push([card1Id, card2Id]);
        game.players[playerId].score += 100;
        
        // Player gets another turn
        game.flippedCards = [];
        
        // Check for game end
        if (game.matches.length === 8) {
          game.gameState = 'finished';
        } else if (game.aiMode && game.currentPlayer === 'ai') {
          // AI gets another turn
          setTimeout(() => this.makeAIMove(roomId), 1000);
        }
      } else {
        // No match, flip cards back after delay
        setTimeout(() => {
          card1.flipped = false;
          card2.flipped = false;
          game.flippedCards = [];
          
          // Switch to next player
          const playerIds = Object.keys(game.players);
          const currentIndex = playerIds.indexOf(game.currentPlayer);
          game.currentPlayer = playerIds[(currentIndex + 1) % playerIds.length];
          
          // Trigger AI move if it's AI's turn
          if (game.aiMode && game.currentPlayer === 'ai') {
            setTimeout(() => this.makeAIMove(roomId), 1000);
          }
        }, 1000);
      }
    }
    
    return game;
  }

  makeAIMove(roomId) {
    const game = this.games[roomId];
    if (!game || game.currentPlayer !== 'ai' || game.gameState !== 'playing') return;
    
    const strategy = game.aiStrategies[game.aiDifficulty];
    
    // Consider using a power first
    if (Math.random() < strategy.powerUsage && this.shouldUsePower(game)) {
      const power = this.selectBestPower(game);
      if (power) {
        this.usePower('ai', roomId, power.type, power.target);
        return;
      }
    }
    
    // Select best card to flip
    const cardToFlip = this.selectBestCard(game, strategy);
    if (cardToFlip !== null) {
      this.flipCard('ai', roomId, cardToFlip);
    }
  }

  selectBestCard(game, strategy) {
    const availableCards = game.board.filter(c => !c.flipped && !c.matched);
    
    // If no cards flipped yet, look for known matches first
    if (game.flippedCards.length === 0) {
      const knownMatch = this.findKnownMatch(game, strategy);
      if (knownMatch) return knownMatch;
      
      // Otherwise, explore based on memory confidence
      return this.selectExplorationCard(game, availableCards, strategy);
    }
    
    // If one card is flipped, try to find its match
    if (game.flippedCards.length === 1) {
      const flippedCard = game.board.find(c => c.id === game.flippedCards[0]);
      const match = this.findMatchForSymbol(game, flippedCard.symbol, strategy);
      if (match) return match;
      
      // Fallback to exploration
      return this.selectExplorationCard(game, availableCards, strategy);
    }
    
    return null;
  }

  findKnownMatch(game, strategy) {
    const memory = Array.from(game.aiMemory.values());
    const symbolGroups = {};
    
    // Group known symbols
    memory.forEach(entry => {
      if (entry.symbol && entry.confidence >= strategy.memoryAccuracy) {
        if (!symbolGroups[entry.symbol]) {
          symbolGroups[entry.symbol] = [];
        }
        symbolGroups[entry.symbol].push(entry.position);
      }
    });
    
    // Find pairs
    for (const symbol in symbolGroups) {
      if (symbolGroups[symbol].length >= 2) {
        const positions = symbolGroups[symbol];
        const availablePositions = positions.filter(pos => {
          const card = game.board.find(c => c.id === pos);
          return card && !card.flipped && !card.matched;
        });
        if (availablePositions.length >= 2) {
          return availablePositions[0]; // Return the first card of a known match
        }
      }
    }
    return null;
  }

  findMatchForSymbol(game, symbol, strategy) {
    const memory = Array.from(game.aiMemory.values());
    const potentialMatch = memory.find(entry => 
      entry.symbol === symbol &&
      entry.position !== game.flippedCards[0] &&
      entry.confidence >= strategy.memoryAccuracy
    );
    if (potentialMatch) {
        const card = game.board.find(c => c.id === potentialMatch.position);
        if (card && !card.flipped && !card.matched) {
            return potentialMatch.position;
        }
    }
    return null;
  }

  selectExplorationCard(game, availableCards, strategy) {
    if (Math.random() > strategy.memoryAccuracy) {
      // Make a random move to simulate imperfect memory
      return availableCards[Math.floor(Math.random() * availableCards.length)].id;
    }
    
    // Choose the card with the least confidence
    let leastConfidentCard = null;
    let minConfidence = Infinity;
    
    for (const card of availableCards) {
      const memoryEntry = game.aiMemory.get(card.id);
      if (memoryEntry && memoryEntry.confidence < minConfidence) {
        minConfidence = memoryEntry.confidence;
        leastConfidentCard = card.id;
      }
    }
    return leastConfidentCard !== null ? leastConfidentCard : availableCards[0].id;
  }

  shouldUsePower(game) {
    // Basic logic: use power if losing or if it gives a significant advantage
    const playerScore = game.players['ai'].score;
    const humanPlayer = Object.values(game.players).find(p => !p.isAI);
    if (!humanPlayer) return false;
    
    const humanScore = humanPlayer.score;
    return playerScore < humanScore || (game.board.length - game.matches.length * 2) <= 6;
  }

  selectBestPower(game) {
    const availablePowers = game.players['ai'].powers.filter(p => !game.players['ai'].powerUsed[p]);
    if (availablePowers.length === 0) return null;

    // 'peek' is generally a good power to use
    if (availablePowers.includes('peek')) {
      return { type: 'peek' };
    }
    // 'freeze' can be good to stop a player on a roll
    if (availablePowers.includes('freeze')) {
      const humanPlayer = Object.values(game.players).find(p => !p.isAI);
      return { type: 'freeze', target: humanPlayer.id };
    }
    
    return null;
  }

  updateAIMemory(game, cardId, symbol) {
    const memoryEntry = game.aiMemory.get(cardId);
    if (memoryEntry) {
      memoryEntry.symbol = symbol;
      memoryEntry.confidence = 1; // 100% confident after seeing it
      memoryEntry.lastSeen = game.timer;
    }
    
    // Decay confidence of other cards over time (simplistic)
    for (const entry of game.aiMemory.values()) {
      if (entry.position !== cardId && entry.confidence > 0) {
        entry.confidence *= 0.98;
      }
    }
  }

  usePower(playerId, roomId, powerType, target) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId] || game.players[playerId].powerUsed[powerType]) return;

    game.players[playerId].powerUsed[powerType] = true;

    switch (powerType) {
      case 'freeze':
        // Freeze a target player for one turn (simplified)
        // In a real implementation, you'd need to track frozen status
        const targetPlayer = game.players[target];
        if (targetPlayer) {
            // This is a placeholder for a real freeze mechanic
            console.log(`${targetPlayer.nickname} is frozen!`);
        }
        break;
      case 'peek':
        // Briefly reveal all cards
        game.board.forEach(c => c.flipped = true);
        setTimeout(() => {
          game.board.forEach(c => {
            if (!c.matched) c.flipped = false;
          });
        }, 1500);
        break;
      case 'shuffle':
        // Shuffle the remaining non-matched cards
        const nonMatchedCards = game.board.filter(c => !c.matched);
        const positions = nonMatchedCards.map(c => ({ id: c.id, symbol: c.symbol }));
        
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        nonMatchedCards.forEach((card, index) => {
            card.symbol = positions[index].symbol;
        });

        // Clear AI memory as positions have changed
        if (game.aiMode) game.aiMemory.clear();
        break;
    }
    return game;
  }
}

module.exports = new MemoryDuelGame();