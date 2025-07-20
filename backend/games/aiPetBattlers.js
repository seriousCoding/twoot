const PET_TYPES = {
  fire: { name: 'Fire Dragon', hp: 100, attack: 25, defense: 15, speed: 20 },
  water: { name: 'Water Turtle', hp: 120, attack: 20, defense: 25, speed: 15 },
  earth: { name: 'Earth Bear', hp: 140, attack: 30, defense: 20, speed: 10 },
  air: { name: 'Air Phoenix', hp: 80, attack: 35, defense: 10, speed: 30 }
};

const MOVES = {
  attack: { name: 'Attack', damage: 1.0, accuracy: 0.9 },
  strongAttack: { name: 'Strong Attack', damage: 1.5, accuracy: 0.7 },
  defend: { name: 'Defend', damage: 0, accuracy: 1.0, defense: 1.5 },
  heal: { name: 'Heal', damage: 0, accuracy: 1.0, heal: 30 }
};

class AIPetBattlersGame {
  constructor() {
    this.games = {};
  }

  createGame(roomId) {
    const game = {
      players: {},
      gameState: 'waiting',
      currentPlayer: null,
      round: 1,
      maxRounds: 10,
      battleLog: []
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
      pets: [],
      activePet: null,
      wins: 0,
      aiCode: ''
    };
    
    // Automatically select a pet for simplicity
    this.selectPet(socket.id, roomId, 'fire');

    if (Object.keys(game.players).length >= 2 && game.gameState === 'waiting') {
        this.startGame(roomId);
    }

    return game;
  }

  handleAction(roomId, playerId, data) {
      switch(data.type) {
          case 'selectPet':
              return this.selectPet(playerId, roomId, data.petType);
          case 'move':
              return this.executeMove(playerId, roomId, data.moveType, data.target);
          case 'updateAI':
              return this.updateAI(playerId, roomId, data.aiCode);
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
          round: game.round,
          battleLog: game.battleLog
      };
  }
  
  leaveRoom(roomId, playerId) {
    const game = this.games[roomId];
    if (game && game.players[playerId]) {
        delete game.players[playerId];
        if (Object.keys(game.players).length < 2) {
            game.gameState = 'waiting';
        } else if (game.currentPlayer === playerId) {
            this.nextTurn(roomId);
        }
    }
  }

  cleanupRoom(roomId) {
      const game = this.games[roomId];
      if (game && Object.keys(game.players).length === 0) {
          delete this.games[roomId];
      }
  }

  selectPet(playerId, roomId, petType) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId]) return;
    
    const player = game.players[playerId];
    if (PET_TYPES[petType]) {
      const pet = {
        ...PET_TYPES[petType],
        type: petType,
        maxHp: PET_TYPES[petType].hp,
        currentHp: PET_TYPES[petType].hp,
        status: 'normal'
      };
      
      player.pets.push(pet);
      if (!player.activePet) {
        player.activePet = pet;
      }
    }
  }

  startGame(roomId) {
    const game = this.games[roomId];
    if (!game) return;
    
    const playerIds = Object.keys(game.players);
    if (playerIds.length < 2) return;
    
    const allHavePets = playerIds.every(id => game.players[id].pets.length > 0);
    if (!allHavePets) return;
    
    game.gameState = 'battling';
    game.currentPlayer = playerIds[0];
    game.battleLog = [];
  }

  executeMove(playerId, roomId, moveType, target) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId] || game.currentPlayer !== playerId) return;
    
    const player = game.players[playerId];
    const pet = player.activePet;
    
    if (!pet || pet.currentHp <= 0) return;
    
    const move = MOVES[moveType];
    if (!move) return;
    
    const result = {
      playerId, move: moveType, success: Math.random() < move.accuracy,
      damage: 0, heal: 0, effects: []
    };
    
    if (result.success) {
      switch (moveType) {
        case 'attack':
        case 'strongAttack':
          const opponentId = Object.keys(game.players).find(id => id !== playerId);
          const opponent = game.players[opponentId];
          const opponentPet = opponent.activePet;
          
          if (opponentPet && opponentPet.currentHp > 0) {
            const baseDamage = pet.attack * move.damage;
            const defense = opponentPet.defense * (opponentPet.defending || 1);
            result.damage = Math.max(1, Math.floor(baseDamage - defense));
            opponentPet.currentHp = Math.max(0, opponentPet.currentHp - result.damage);
            
            if (opponentPet.currentHp <= 0) {
              result.effects.push(`${opponentPet.name} fainted!`);
              opponent.activePet = opponent.pets.find(p => p.currentHp > 0) || null;
            }
          }
          break;
        case 'defend':
          pet.defending = move.defense;
          result.effects.push(`${pet.name} is defending!`);
          break;
        case 'heal':
          const healAmount = Math.min(move.heal, pet.maxHp - pet.currentHp);
          pet.currentHp += healAmount;
          result.heal = healAmount;
          result.effects.push(`${pet.name} healed ${healAmount} HP!`);
          break;
      }
    } else {
      result.effects.push('Move missed!');
    }
    
    game.battleLog.push(result);
    if (pet.defending && moveType !== 'defend') pet.defending = 1;
    this.nextTurn(roomId);
  }

  nextTurn(roomId) {
    const game = this.games[roomId];
    if (!game) return;

    const activePlayers = Object.keys(game.players).filter(id => game.players[id].pets.some(p => p.currentHp > 0));
    
    if (activePlayers.length <= 1) {
      game.gameState = 'finished';
      if (activePlayers.length === 1) {
        game.players[activePlayers[0]].wins++;
      }
    } else {
      const playerIds = Object.keys(game.players);
      const currentIndex = playerIds.indexOf(game.currentPlayer);
      game.currentPlayer = playerIds[(currentIndex + 1) % playerIds.length];
    }
  }

  updateAI(playerId, roomId, aiCode) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId]) return;
    game.players[playerId].aiCode = aiCode;
  }
}

module.exports = new AIPetBattlersGame();