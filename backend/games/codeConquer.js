class CodeConquerGame {
  constructor() {
    this.games = {};
  }

  createGame(roomId) {
    const game = {
      players: {}, // socketId -> { nickname, color, territories, armies, resources, isAI }
      board: this.initializeBoard(),
      turn: null,
      started: false,
      round: 1,
      gamePhase: 'deployment', // deployment, attack, fortify
      maxRounds: 20,
      winCondition: 'territory' // territory, elimination
    };
    this.games[roomId] = game;
    return game;
  }

  initializeBoard() {
    // Create a 10x10 grid with different territory types
    const board = Array(10).fill(null).map(() => Array(10).fill(null));
    
    // Initialize territories with different strategic values
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        board[y][x] = {
          x, y,
          owner: null,
          armies: 0,
          type: this.getTerritoryType(x, y),
          resources: Math.floor(Math.random() * 3) + 1,
          fortified: false
        };
      }
    }
    
    return board;
  }

  getTerritoryType(x, y) {
    // Create strategic territory types
    if ((x === 4 || x === 5) && (y === 4 || y === 5)) return 'capital'; // High value center
    if (x === 0 || x === 9 || y === 0 || y === 9) return 'border'; // Strategic borders
    if (Math.random() < 0.2) return 'mountain'; // Defensive bonus
    if (Math.random() < 0.15) return 'forest'; // Ambush bonus
    return 'plains'; // Standard territory
  }

  joinGame(socket, playerName, roomId, isAI = false) {
    let game = this.games[roomId];
    if (!game) {
      game = this.createGame(roomId);
    }
    
    if (Object.keys(game.players).length >= 4) {
      return game;
    }
    
    const colors = ['red', 'blue', 'green', 'yellow'];
    const usedColors = Object.values(game.players).map(p => p.color);
    const availableColor = colors.find(c => !usedColors.includes(c));
    
    game.players[socket.id] = {
      id: socket.id,
      nickname: playerName,
      color: availableColor,
      territories: [],
      armies: 25, // Starting armies
      resources: 10,
      isAI,
      alive: true,
      reinforcements: 0
    };
    
    if (Object.keys(game.players).length >= 2 && !game.started) {
        this.startGame(roomId);
    }
    
    return game;
  }

  handleAction(roomId, playerId, data) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId] || game.turn !== playerId) return game;
  
    switch (data.type) {
      case 'deploy':
        return this.deployArmies(game, playerId, data);
      case 'attack':
        return this.attackTerritory(game, playerId, data);
      case 'fortify':
        return this.fortifyTerritory(game, playerId, data);
      case 'endPhase':
        return this.endPhase(game, playerId);
      case 'endTurn':
        return this.endTurn(game, playerId);
      default:
        return game;
    }
  }

  getRoomState(roomId) {
      const game = this.games[roomId];
      if (!game) return null;
      return {
          players: game.players,
          board: game.board,
          turn: game.turn,
          round: game.round,
          gamePhase: game.gamePhase
      };
  }

  leaveRoom(roomId, playerId) {
    const game = this.games[roomId];
    if (game && game.players[playerId]) {
        // Handle turn if the leaving player was the current player
        if (game.turn === playerId) {
            this.endTurn(game, playerId);
        }
        delete game.players[playerId];
        // Remove player from board
        game.board.forEach(row => row.forEach(cell => {
            if (cell.owner === playerId) {
                cell.owner = null;
                cell.armies = 0;
            }
        }));
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
    
    const playerCount = Object.keys(game.players).length;
    if (playerCount < 2) return;
    
    // Assign starting territories randomly
    this.assignStartingTerritories(game);
    
    game.started = true;
    game.turn = Object.keys(game.players)[0];
    game.gamePhase = 'deployment';
    
    // Calculate initial reinforcements
    Object.values(game.players).forEach(player => {
      player.reinforcements = this.calculateReinforcements(game, player.id);
    });
  }

  assignStartingTerritories(game) {
    const players = Object.keys(game.players);
    const totalTerritories = 100; // 10x10 grid
    const territoriesPerPlayer = Math.floor(totalTerritories / players.length);
    
    // Create array of all territories
    const allTerritories = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        allTerritories.push({ x, y });
      }
    }
    
    // Shuffle and distribute
    this.shuffleArray(allTerritories);
    
    players.forEach((playerId, index) => {
      const player = game.players[playerId];
      const startIndex = index * territoriesPerPlayer;
      const endIndex = startIndex + territoriesPerPlayer;
      
      for (let i = startIndex; i < endIndex; i++) {
        const territory = allTerritories[i];
        if (territory) {
          game.board[territory.y][territory.x].owner = playerId;
          game.board[territory.y][territory.x].armies = 1;
          player.territories.push(`${territory.x},${territory.y}`);
        }
      }
    });
  }

  deployArmies(game, playerId, data) {
    if (game.gamePhase !== 'deployment') return;
    
    const { x, y, armies } = data;
    const territory = game.board[y][x];
    
    if (!territory || territory.owner !== playerId) return;
    
    const player = game.players[playerId];
    if (player.reinforcements < armies) return;
    
    territory.armies += armies;
    player.reinforcements -= armies;
  }

  attackTerritory(game, playerId, data) {
    if (game.gamePhase !== 'attack') return;
    
    const { fromX, fromY, toX, toY, armies } = data;
    const fromTerritory = game.board[fromY][fromX];
    const toTerritory = game.board[toY][toX];
    
    // Validation
    if (!fromTerritory || fromTerritory.owner !== playerId) return;
    if (!toTerritory) return;
    if (toTerritory.owner === playerId) return;
    if (!this.areAdjacent(fromX, fromY, toX, toY)) return;
    if (fromTerritory.armies <= armies) return;
    
    // Combat resolution
    const result = this.resolveCombat(fromTerritory, toTerritory, armies);
    
    if (result.attackerWins) {
      // Transfer territory
      const oldOwner = toTerritory.owner;
      toTerritory.owner = playerId;
      toTerritory.armies = result.attackingArmies;
      fromTerritory.armies -= armies;
      
      // Update player territories
      game.players[playerId].territories.push(`${toX},${toY}`);
      if (oldOwner && game.players[oldOwner]) {
        const index = game.players[oldOwner].territories.indexOf(`${toX},${toY}`);
        if (index > -1) {
          game.players[oldOwner].territories.splice(index, 1);
        }
      }
      
      // Check if player eliminated
      if (oldOwner && game.players[oldOwner] && game.players[oldOwner].territories.length === 0) {
        game.players[oldOwner].alive = false;
      }
    } else {
      // Attacker loses armies
      fromTerritory.armies -= result.attackerLosses;
      toTerritory.armies -= result.defenderLosses;
    }
  }

  resolveCombat(attackingTerritory, defendingTerritory, attackingArmies) {
    const defendingArmies = defendingTerritory.armies;
    
    // Apply terrain bonuses
    let defenseBonus = 0;
    if (defendingTerritory.type === 'mountain') defenseBonus = 1;
    if (defendingTerritory.type === 'forest') defenseBonus = 0.5;
    if (defendingTerritory.fortified) defenseBonus += 1;
    
    // Dice rolling simulation
    const attackRolls = this.rollDice(Math.min(attackingArmies, 3));
    const defenseRolls = this.rollDice(Math.min(defendingArmies + defenseBonus, 2));
    
    attackRolls.sort((a, b) => b - a);
    defenseRolls.sort((a, b) => b - a);
    
    let attackerLosses = 0;
    let defenderLosses = 0;
    
    const comparisons = Math.min(attackRolls.length, defenseRolls.length);
    for (let i = 0; i < comparisons; i++) {
      if (attackRolls[i] > defenseRolls[i]) {
        defenderLosses++;
      } else {
        attackerLosses++;
      }
    }
    
    const attackerWins = (defendingArmies - defenderLosses) <= 0;
    
    return {
      attackerWins,
      attackerLosses,
      defenderLosses,
      attackingArmies: attackerWins ? attackingArmies - attackerLosses : 0
    };
  }

  fortifyTerritory(game, playerId, data) {
    if (game.gamePhase !== 'fortify') return;
    
    const { fromX, fromY, toX, toY, armies } = data;
    const from = game.board[fromY][fromX];
    const to = game.board[toY][toX];
    
    if (!from || from.owner !== playerId || !to || to.owner !== playerId) return;
    if (from.armies <= armies) return;
    
    from.armies -= armies;
    to.armies += armies;
    
    // Player can only fortify once per turn, end phase
    this.endPhase(game, playerId);
  }

  endPhase(game, playerId) {
    if (game.turn !== playerId) return;
    
    switch (game.gamePhase) {
      case 'deployment':
        game.gamePhase = 'attack';
        break;
      case 'attack':
        game.gamePhase = 'fortify';
        break;
      case 'fortify':
        this.endTurn(game, playerId);
        break;
    }
  }

  endTurn(game, playerId) {
    if (game.turn !== playerId) return;
    
    const playerIds = Object.keys(game.players).filter(id => game.players[id].alive);
    const currentIndex = playerIds.indexOf(playerId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    game.turn = playerIds[nextIndex];
    game.gamePhase = 'deployment';
    
    // Calculate reinforcements for next player
    const nextPlayer = game.players[game.turn];
    if (nextPlayer) {
      nextPlayer.reinforcements = this.calculateReinforcements(game, game.turn);
      nextPlayer.resources += this.calculateResources(game, game.turn);
    }
    
    if (game.turn === playerIds[0]) {
      game.round++;
    }
    
    this.checkWinCondition(game);
  }

  calculateReinforcements(game, playerId) {
    const player = game.players[playerId];
    if (!player) return 0;
    const territoryCount = player.territories.length;
    return Math.max(3, Math.floor(territoryCount / 3));
  }

  calculateResources(game, playerId) {
    const player = game.players[playerId];
    if (!player) return 0;
    
    return player.territories.reduce((total, t) => {
      const [x, y] = t.split(',').map(Number);
      return total + game.board[y][x].resources;
    }, 0);
  }

  checkWinCondition(game) {
    const alivePlayers = Object.values(game.players).filter(p => p.alive);
    
    if (alivePlayers.length === 1) {
      game.winner = alivePlayers[0].nickname;
      game.gamePhase = 'finished';
    } else if (game.round > game.maxRounds) {
      // Territory win condition
      const playerScores = alivePlayers.map(p => ({
        nickname: p.nickname,
        score: p.territories.length
      }));
      playerScores.sort((a, b) => b.score - a.score);
      game.winner = playerScores[0].nickname;
      game.gamePhase = 'finished';
    }
  }

  areAdjacent(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1;
  }

  rollDice(count) {
    return Array(Math.floor(count)).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

module.exports = new CodeConquerGame();