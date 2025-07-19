const games = {};

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

function createGame(roomId) {
  games[roomId] = {
    players: {},
    gameState: 'waiting',
    market: {},
    chatHistory: [],
    tradeOffers: {},
    round: 1,
    maxRounds: 10
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
    inventory: {
      wood: 5,
      stone: 3,
      iron: 1
    },
    score: 0
  };
  
  return game;
}

function startGame(roomId) {
  const game = games[roomId];
  if (!game) return null;
  
  const playerIds = Object.keys(game.players);
  if (playerIds.length < 2) return null;
  
  game.gameState = 'trading';
  generateMarket(game);
  
  return game;
}

function generateMarket(game) {
  game.market = {};
  
  Object.keys(ITEMS).forEach(itemId => {
    const item = ITEMS[itemId];
    const variation = (Math.random() - 0.5) * 0.4; // ±20% price variation
    const price = Math.floor(item.basePrice * (1 + variation));
    
    game.market[itemId] = {
      ...item,
      currentPrice: price,
      supply: Math.floor(Math.random() * 10) + 5,
      demand: Math.floor(Math.random() * 10) + 5
    };
  });
}

function buyItem(socket, roomId, itemId, quantity) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  const marketItem = game.market[itemId];
  
  if (!marketItem || marketItem.supply < quantity) return null;
  
  const totalCost = marketItem.currentPrice * quantity;
  if (player.money < totalCost) return null;
  
  player.money -= totalCost;
  player.inventory[itemId] = (player.inventory[itemId] || 0) + quantity;
  marketItem.supply -= quantity;
  
  // Update market prices based on supply/demand
  updateMarketPrices(game, itemId, 'buy');
  
  return game;
}

function sellItem(socket, roomId, itemId, quantity) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  const marketItem = game.market[itemId];
  
  if (!marketItem || !player.inventory[itemId] || player.inventory[itemId] < quantity) return null;
  
  const totalValue = marketItem.currentPrice * quantity;
  player.money += totalValue;
  player.inventory[itemId] -= quantity;
  marketItem.supply += quantity;
  
  // Update market prices based on supply/demand
  updateMarketPrices(game, itemId, 'sell');
  
  return game;
}

function craftItem(socket, roomId, itemId) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  const recipe = RECIPES[itemId];
  
  if (!recipe) return null;
  
  // Check if player has required materials
  for (const [material, required] of Object.entries(recipe)) {
    if (!player.inventory[material] || player.inventory[material] < required) {
      return null;
    }
  }
  
  // Consume materials
  for (const [material, required] of Object.entries(recipe)) {
    player.inventory[material] -= required;
  }
  
  // Add crafted item
  player.inventory[itemId] = (player.inventory[itemId] || 0) + 1;
  
  return game;
}

function createTradeOffer(socket, roomId, targetPlayerId, offerItems, requestItems) {
  const game = games[roomId];
  if (!game || !game.players[socket.id] || !game.players[targetPlayerId]) return null;
  
  const player = game.players[socket.id];
  
  // Check if player has offered items
  for (const [itemId, quantity] of Object.entries(offerItems)) {
    if (!player.inventory[itemId] || player.inventory[itemId] < quantity) {
      return null;
    }
  }
  
  const tradeId = `${socket.id}-${targetPlayerId}-${Date.now()}`;
  game.tradeOffers[tradeId] = {
    id: tradeId,
    fromPlayer: socket.id,
    toPlayer: targetPlayerId,
    offerItems,
    requestItems,
    status: 'pending',
    createdAt: Date.now()
  };
  
  return game;
}

function acceptTrade(socket, roomId, tradeId) {
  const game = games[roomId];
  if (!game || !game.players[socket.id] || !game.tradeOffers[tradeId]) return null;
  
  const trade = game.tradeOffers[tradeId];
  if (trade.toPlayer !== socket.id || trade.status !== 'pending') return null;
  
  const fromPlayer = game.players[trade.fromPlayer];
  const toPlayer = game.players[trade.toPlayer];
  
  // Verify both players still have required items
  for (const [itemId, quantity] of Object.entries(trade.offerItems)) {
    if (!fromPlayer.inventory[itemId] || fromPlayer.inventory[itemId] < quantity) {
      trade.status = 'failed';
      return game;
    }
  }
  
  for (const [itemId, quantity] of Object.entries(trade.requestItems)) {
    if (!toPlayer.inventory[itemId] || toPlayer.inventory[itemId] < quantity) {
      trade.status = 'failed';
      return game;
    }
  }
  
  // Execute trade
  for (const [itemId, quantity] of Object.entries(trade.offerItems)) {
    fromPlayer.inventory[itemId] -= quantity;
    toPlayer.inventory[itemId] = (toPlayer.inventory[itemId] || 0) + quantity;
  }
  
  for (const [itemId, quantity] of Object.entries(trade.requestItems)) {
    toPlayer.inventory[itemId] -= quantity;
    fromPlayer.inventory[itemId] = (fromPlayer.inventory[itemId] || 0) + quantity;
  }
  
  trade.status = 'completed';
  
  return game;
}

function sendChatMessage(socket, roomId, message) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  const chatMessage = {
    id: Date.now(),
    playerId: socket.id,
    nickname: player.nickname,
    message,
    timestamp: Date.now()
  };
  
  game.chatHistory.push(chatMessage);
  
  // Keep only last 100 messages
  if (game.chatHistory.length > 100) {
    game.chatHistory = game.chatHistory.slice(-100);
  }
  
  return game;
}

function updateMarketPrices(game, itemId, action) {
  const marketItem = game.market[itemId];
  
  if (action === 'buy') {
    marketItem.demand += 1;
    marketItem.currentPrice = Math.floor(marketItem.currentPrice * 1.05);
  } else if (action === 'sell') {
    marketItem.supply += 1;
    marketItem.currentPrice = Math.floor(marketItem.currentPrice * 0.95);
  }
  
  // Ensure price doesn't go below 1
  marketItem.currentPrice = Math.max(1, marketItem.currentPrice);
}

function calculateScore(player) {
  let score = player.money;
  
  // Add inventory value
  Object.entries(player.inventory).forEach(([itemId, quantity]) => {
    const item = ITEMS[itemId];
    if (item) {
      score += item.basePrice * quantity;
    }
  });
  
  return score;
}

function endRound(roomId) {
  const game = games[roomId];
  if (!game) return null;
  
  // Update scores
  Object.values(game.players).forEach(player => {
    player.score = calculateScore(player);
  });
  
  game.round++;
  
  if (game.round > game.maxRounds) {
    game.gameState = 'finished';
  } else {
    // Generate new market prices
    generateMarket(game);
  }
  
  return game;
}

function removePlayer(socket, roomId) {
  if (games[roomId]) {
    delete games[roomId].players[socket.id];
    
    // Cancel any pending trades involving this player
    Object.keys(games[roomId].tradeOffers).forEach(tradeId => {
      const trade = games[roomId].tradeOffers[tradeId];
      if (trade.fromPlayer === socket.id || trade.toPlayer === socket.id) {
        delete games[roomId].tradeOffers[tradeId];
      }
    });
    
    if (Object.keys(games[roomId].players).length === 0) {
      delete games[roomId];
    }
  }
}

module.exports = {
  games,
  joinGame,
  startGame,
  buyItem,
  sellItem,
  craftItem,
  createTradeOffer,
  acceptTrade,
  sendChatMessage,
  endRound,
  removePlayer
};