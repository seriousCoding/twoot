const games = {};

const FARM_WIDTH = 800;
const FARM_HEIGHT = 600;

function createGame(roomId) {
  games[roomId] = {
    players: {},
    farms: {},
    crops: {},
    gameState: 'waiting',
    timer: 0
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
    money: 1000,
    level: 1,
    x: Math.random() * FARM_WIDTH,
    y: Math.random() * FARM_HEIGHT
  };
  
  // Create personal farm for player
  game.farms[socket.id] = {
    ownerId: socket.id,
    plots: Array(8).fill(null).map(() => Array(8).fill(null)),
    buildings: []
  };
  
  return game;
}

function plantCrop(socket, roomId, x, y, cropType) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  const farm = game.farms[socket.id];
  
  if (farm.plots[x] && farm.plots[x][y] === null) {
    const cropCost = getCropCost(cropType);
    if (player.money >= cropCost) {
      player.money -= cropCost;
      farm.plots[x][y] = {
        type: cropType,
        plantedAt: Date.now(),
        growthTime: getCropGrowthTime(cropType)
      };
    }
  }
  
  return game;
}

function harvestCrop(socket, roomId, x, y) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  const farm = game.farms[socket.id];
  
  if (farm.plots[x] && farm.plots[x][y]) {
    const crop = farm.plots[x][y];
    const now = Date.now();
    
    if (now - crop.plantedAt >= crop.growthTime) {
      const value = getCropValue(crop.type);
      player.money += value;
      farm.plots[x][y] = null;
    }
  }
  
  return game;
}

function getCropCost(cropType) {
  const costs = {
    wheat: 50,
    corn: 100,
    tomato: 150,
    carrot: 75
  };
  return costs[cropType] || 50;
}

function getCropGrowthTime(cropType) {
  const times = {
    wheat: 30000,    // 30 seconds
    corn: 60000,     // 1 minute
    tomato: 90000,   // 1.5 minutes
    carrot: 45000    // 45 seconds
  };
  return times[cropType] || 30000;
}

function getCropValue(cropType) {
  const values = {
    wheat: 100,
    corn: 200,
    tomato: 300,
    carrot: 150
  };
  return values[cropType] || 100;
}

function removePlayer(socket, roomId) {
  if (games[roomId]) {
    delete games[roomId].players[socket.id];
    delete games[roomId].farms[socket.id];
    
    if (Object.keys(games[roomId].players).length === 0) {
      delete games[roomId];
    }
  }
}

module.exports = {
  games,
  joinGame,
  plantCrop,
  harvestCrop,
  removePlayer
};