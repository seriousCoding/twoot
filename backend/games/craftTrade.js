const ITEMS = {
  wood: { name: 'Wood', basePrice: 10, rarity: 'common' },
  stone: { name: 'Stone', basePrice: 15, rarity: 'common' },
  iron: { name: 'Iron', basePrice: 25, rarity: 'uncommon' },
  gold: { name: 'Gold', basePrice: 50, rarity: 'rare' },
  diamond: { name: 'Diamond', basePrice: 100, rarity: 'epic' },
  sword: { name: 'Sword', basePrice: 75, rarity: 'uncommon', craftable: true },
  pickaxe: { name: 'Pickaxe', basePrice: 40, rarity: 'common', craftable: true },
  potion: { name: 'Potion', basePrice: 30, rarity: 'common', craftable: true }
};

const RECIPES = {
  sword: { iron: 2, wood: 1 },
  pickaxe: { iron: 1, wood: 2 },
  potion: { wood: 1, stone: 1 }
};

class CraftTradeGame {
  constructor() {
    this.games = {};
  }

  createGame(roomId) {
    const game = {
      players: {},
      gameState: 'waiting',
      market: {},
      chatHistory: [],
      tradeOffers: {},
      round: 1,
      maxRounds: 10
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
      inventory: { wood: 5, stone: 3, iron: 1 },
      score: 0
    };
    
    if (Object.keys(game.players).length >= 2 && game.gameState === 'waiting') {
        this.startGame(roomId);
    }

    return game;
  }
  
  handleAction(roomId, playerId, data) {
      switch(data.type) {
          case 'buy':
              return this.buyItem(playerId, roomId, data.itemId, data.quantity);
          case 'sell':
              return this.sellItem(playerId, roomId, data.itemId, data.quantity);
          case 'craft':
              return this.craftItem(playerId, roomId, data.itemId);
          case 'tradeOffer':
              return this.createTradeOffer(playerId, roomId, data.targetPlayerId, data.offerItems, data.requestItems);
          case 'acceptTrade':
              return this.acceptTrade(playerId, roomId, data.tradeId);
          case 'chat':
              return this.sendChatMessage(playerId, roomId, data.message);
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
          market: game.market,
          chatHistory: game.chatHistory,
          tradeOffers: game.tradeOffers
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
    if (!game || Object.keys(game.players).length < 2) return;
    
    game.gameState = 'trading';
    this.generateMarket(game);
  }

  generateMarket(game) {
    game.market = {};
    
    Object.keys(ITEMS).forEach(itemId => {
      const item = ITEMS[itemId];
      const variation = (Math.random() - 0.5) * 0.4; // ±20% price variation
      const price = Math.floor(item.basePrice * (1 + variation));
      
      game.market[itemId] = {
        ...item, currentPrice: price,
        supply: Math.floor(Math.random() * 10) + 5,
        demand: Math.floor(Math.random() * 10) + 5
      };
    });
  }

  buyItem(playerId, roomId, itemId, quantity) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId]) return;
    
    const player = game.players[playerId];
    const marketItem = game.market[itemId];
    
    if (!marketItem || marketItem.supply < quantity) return;
    
    const totalCost = marketItem.currentPrice * quantity;
    if (player.money < totalCost) return;
    
    player.money -= totalCost;
    player.inventory[itemId] = (player.inventory[itemId] || 0) + quantity;
    marketItem.supply -= quantity;
    
    this.updateMarketPrices(game, itemId, 'buy');
  }

  sellItem(playerId, roomId, itemId, quantity) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId]) return;
    
    const player = game.players[playerId];
    const marketItem = game.market[itemId];
    
    if (!marketItem || !player.inventory[itemId] || player.inventory[itemId] < quantity) return;
    
    const totalValue = marketItem.currentPrice * quantity;
    player.money += totalValue;
    player.inventory[itemId] -= quantity;
    marketItem.supply += quantity;
    
    this.updateMarketPrices(game, itemId, 'sell');
  }

  craftItem(playerId, roomId, itemId) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId]) return;
    
    const player = game.players[playerId];
    const recipe = RECIPES[itemId];
    
    if (!recipe) return;
    
    for (const [material, required] of Object.entries(recipe)) {
      if (!player.inventory[material] || player.inventory[material] < required) return;
    }
    
    for (const [material, required] of Object.entries(recipe)) {
      player.inventory[material] -= required;
    }
    
    player.inventory[itemId] = (player.inventory[itemId] || 0) + 1;
  }

  createTradeOffer(playerId, roomId, targetPlayerId, offerItems, requestItems) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId] || !game.players[targetPlayerId]) return;
    
    const player = game.players[playerId];
    
    for (const [itemId, quantity] of Object.entries(offerItems)) {
      if (!player.inventory[itemId] || player.inventory[itemId] < quantity) return;
    }
    
    const tradeId = `${playerId}-${targetPlayerId}-${Date.now()}`;
    game.tradeOffers[tradeId] = {
      id: tradeId, fromPlayer: playerId, toPlayer: targetPlayerId,
      offerItems, requestItems, status: 'pending', createdAt: Date.now()
    };
  }

  acceptTrade(playerId, roomId, tradeId) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId] || !game.tradeOffers[tradeId]) return;
    
    const trade = game.tradeOffers[tradeId];
    if (trade.toPlayer !== playerId || trade.status !== 'pending') return;
    
    const fromPlayer = game.players[trade.fromPlayer];
    const toPlayer = game.players[trade.toPlayer];
    
    for (const [itemId, quantity] of Object.entries(trade.offerItems)) {
      if (!fromPlayer.inventory[itemId] || fromPlayer.inventory[itemId] < quantity) {
        trade.status = 'failed';
        return;
      }
    }
    
    for (const [itemId, quantity] of Object.entries(trade.requestItems)) {
      if (!toPlayer.inventory[itemId] || toPlayer.inventory[itemId] < quantity) {
        trade.status = 'failed';
        return;
      }
    }
    
    for (const [itemId, quantity] of Object.entries(trade.offerItems)) {
      fromPlayer.inventory[itemId] -= quantity;
      toPlayer.inventory[itemId] = (toPlayer.inventory[itemId] || 0) + quantity;
    }
    
    for (const [itemId, quantity] of Object.entries(trade.requestItems)) {
      toPlayer.inventory[itemId] -= quantity;
      fromPlayer.inventory[itemId] = (fromPlayer.inventory[itemId] || 0) + quantity;
    }
    
    trade.status = 'completed';
  }

  sendChatMessage(playerId, roomId, message) {
    const game = this.games[roomId];
    if (!game || !game.players[playerId]) return;
    
    const player = game.players[playerId];
    const chatMessage = {
      id: Date.now(), playerId, nickname: player.nickname,
      message, timestamp: Date.now()
    };
    
    game.chatHistory.push(chatMessage);
    if (game.chatHistory.length > 100) {
      game.chatHistory = game.chatHistory.slice(-100);
    }
  }

  updateMarketPrices(game, itemId, action) {
    const marketItem = game.market[itemId];
    
    if (action === 'buy') {
      marketItem.demand += 1;
      marketItem.currentPrice = Math.floor(marketItem.currentPrice * 1.05);
    } else if (action === 'sell') {
      marketItem.supply += 1;
      marketItem.currentPrice = Math.floor(marketItem.currentPrice * 0.95);
    }
  }

  calculateScore(player) {
    let score = player.money;
    for (const [itemId, quantity] of Object.entries(player.inventory)) {
      score += (ITEMS[itemId]?.basePrice || 0) * quantity;
    }
    return score;
  }

  endRound(roomId) {
    const game = this.games[roomId];
    if (!game) return;
    
    game.round++;
    
    Object.values(game.players).forEach(player => {
        player.score = this.calculateScore(player);
    });

    if (game.round > game.maxRounds) {
      game.gameState = 'finished';
    } else {
      this.generateMarket(game);
    }
  }
}

module.exports = new CraftTradeGame();