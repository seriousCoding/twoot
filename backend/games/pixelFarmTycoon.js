class PixelFarmTycoonGame {
  constructor() {
    this.games = {};
    this.FARM_WIDTH = 800;
    this.FARM_HEIGHT = 600;
  }

  createGame(roomId) {
    const game = {
      players: {},
      farms: {},
      crops: {},
      gameState: 'playing',
      timer: 0
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
      money: 1000,
      level: 1,
      x: Math.random() * this.FARM_WIDTH,
      y: Math.random() * this.FARM_HEIGHT
    };
    
    // Create personal farm for player
    game.farms[socket.id] = {
      ownerId: socket.id,
      plots: Array(8).fill(null).map(() => Array(8).fill(null)),
      buildings: []
    };
    
    return game;
  }

  handleAction(roomId, playerId, data) {
      switch(data.type) {
          case 'plant':
              return this.plantCrop(playerId, roomId, data.x, data.y, data.cropType);
          case 'harvest':
              return this.harvestCrop(playerId, roomId, data.x, data.y);
          default:
              return this.games[roomId];
      }
  }

  getRoomState(roomId) {
      const game = this.games[roomId];
      if (!game) return null;
      return {
          players: game.players,
          farms: game.farms,
          gameState: game.gameState
      };
  }

  leaveRoom(roomId, playerId) {
    const game = this.games[roomId];
    if (game) {
      delete game.players[playerId];
      delete game.farms[playerId];
    }
  }

  cleanupRoom(roomId) {
      const game = this.games[roomId];
      if (game && Object.keys(game.players).length === 0) {
          delete this.games[roomId];
      }
  }

  plantCrop(playerId, roomId, x, y, cropType) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId]) return;
    
    const player = game.players[playerId];
    const farm = game.farms[playerId];
    
    if (farm.plots[x] && farm.plots[x][y] === null) {
      const cropCost = this.getCropCost(cropType);
      if (player.money >= cropCost) {
        player.money -= cropCost;
        farm.plots[x][y] = {
          type: cropType,
          plantedAt: Date.now(),
          growthTime: this.getCropGrowthTime(cropType)
        };
      }
    }
  }

  harvestCrop(playerId, roomId, x, y) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId]) return;
    
    const player = game.players[playerId];
    const farm = game.farms[playerId];
    
    if (farm.plots[x] && farm.plots[x][y]) {
      const crop = farm.plots[x][y];
      const now = Date.now();
      
      if (now - crop.plantedAt >= crop.growthTime) {
        const value = this.getCropValue(crop.type);
        player.money += value;
        farm.plots[x][y] = null;
      }
    }
  }

  getCropCost(cropType) {
    const costs = { wheat: 50, corn: 100, tomato: 150, carrot: 75 };
    return costs[cropType] || 50;
  }

  getCropGrowthTime(cropType) {
    const times = { wheat: 30000, corn: 60000, tomato: 90000, carrot: 45000 };
    return times[cropType] || 30000;
  }

  getCropValue(cropType) {
    const values = { wheat: 100, corn: 200, tomato: 300, carrot: 150 };
    return values[cropType] || 100;
  }
}

module.exports = new PixelFarmTycoonGame();