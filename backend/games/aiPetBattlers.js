const games = {};

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

function createGame(roomId) {
  games[roomId] = {
    players: {},
    gameState: 'waiting',
    currentPlayer: null,
    round: 1,
    maxRounds: 10,
    battleLog: []
  };
}

function joinGame(socket, nickname, roomId) {
  if (!games[roomId]) {
    createGame(roomId);
  }
  
  const game = games[roomId];
  game.players[socket.id] = {
    id: socket.id,
    nickname: nickname || `Player${Math.floor(Math.random() * 1000)}`,
    pets: [],
    activePet: null,
    wins: 0,
    aiCode: ''
  };
  
  return game;
}

function selectPet(socket, roomId, petType) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
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
  
  return game;
}

function startGame(roomId) {
  const game = games[roomId];
  if (!game) return null;
  
  const playerIds = Object.keys(game.players);
  if (playerIds.length < 2) return null;
  
  // Check if all players have pets
  const allHavePets = playerIds.every(id => game.players[id].pets.length > 0);
  if (!allHavePets) return null;
  
  game.gameState = 'battling';
  game.currentPlayer = playerIds[0];
  game.battleLog = [];
  
  return game;
}

function executeMove(socket, roomId, moveType, target) {
  const game = games[roomId];
  if (!game || !game.players[socket.id] || game.currentPlayer !== socket.id) return null;
  
  const player = game.players[socket.id];
  const pet = player.activePet;
  
  if (!pet || pet.currentHp <= 0) return null;
  
  const move = MOVES[moveType];
  if (!move) return null;
  
  const result = {
    playerId: socket.id,
    move: moveType,
    success: Math.random() < move.accuracy,
    damage: 0,
    heal: 0,
    effects: []
  };
  
  if (result.success) {
    switch (moveType) {
      case 'attack':
      case 'strongAttack':
        const opponentId = Object.keys(game.players).find(id => id !== socket.id);
        const opponent = game.players[opponentId];
        const opponentPet = opponent.activePet;
        
        if (opponentPet && opponentPet.currentHp > 0) {
          const baseDamage = pet.attack * move.damage;
          const defense = opponentPet.defense * (opponentPet.defending || 1);
          result.damage = Math.max(1, Math.floor(baseDamage - defense));
          
          opponentPet.currentHp = Math.max(0, opponentPet.currentHp - result.damage);
          
          if (opponentPet.currentHp <= 0) {
            result.effects.push(`${opponentPet.name} fainted!`);
            // Switch to next pet if available
            const nextPet = opponent.pets.find(p => p.currentHp > 0);
            opponent.activePet = nextPet || null;
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
  
  // Reset defending status
  if (pet.defending && moveType !== 'defend') {
    pet.defending = 1;
  }
  
  // Check for battle end
  const playerIds = Object.keys(game.players);
  const activePlayers = playerIds.filter(id => {
    const player = game.players[id];
    return player.pets.some(pet => pet.currentHp > 0);
  });
  
  if (activePlayers.length === 1) {
    game.gameState = 'finished';
    game.players[activePlayers[0]].wins++;
  } else {
    // Switch to next player
    const currentIndex = playerIds.indexOf(game.currentPlayer);
    game.currentPlayer = playerIds[(currentIndex + 1) % playerIds.length];
  }
  
  return game;
}

function updateAI(socket, roomId, aiCode) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  game.players[socket.id].aiCode = aiCode;
  return game;
}

function executeAI(socket, roomId) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  const aiCode = player.aiCode;
  
  if (!aiCode) return null;
  
  try {
    // Create AI context
    const context = {
      myPet: player.activePet,
      myPets: player.pets,
      opponentPet: null,
      opponentPets: [],
      battleLog: game.battleLog,
      moves: Object.keys(MOVES)
    };
    
    // Get opponent info
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    if (opponentId) {
      const opponent = game.players[opponentId];
      context.opponentPet = opponent.activePet;
      context.opponentPets = opponent.pets;
    }
    
    // Execute AI code
    const aiFunction = new Function('context', aiCode + '\nreturn chooseMove(context);');
    const move = aiFunction(context);
    
    if (MOVES[move]) {
      return executeMove(socket, roomId, move, null);
    }
  } catch (error) {
    console.error('AI execution error:', error);
  }
  
  return null;
}

function removePlayer(socket, roomId) {
  if (games[roomId]) {
    delete games[roomId].players[socket.id];
    
    if (Object.keys(games[roomId].players).length === 0) {
      delete games[roomId];
    } else if (games[roomId].currentPlayer === socket.id) {
      // Switch to next player
      const playerIds = Object.keys(games[roomId].players);
      games[roomId].currentPlayer = playerIds[0];
    }
  }
}

module.exports = {
  games,
  joinGame,
  selectPet,
  startGame,
  executeMove,
  updateAI,
  executeAI,
  removePlayer
};