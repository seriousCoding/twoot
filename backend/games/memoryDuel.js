const games = {};

function createGame(roomId) {
  games[roomId] = {
    players: {},
    gameState: 'waiting',
    currentPlayer: null,
    board: [],
    flippedCards: [],
    matches: [],
    timer: 0,
    maxTime: 120,
    powers: {}
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
    score: 0,
    powers: ['freeze', 'peek', 'shuffle'],
    powerUsed: {}
  };
  
  return game;
}

function startGame(roomId) {
  const game = games[roomId];
  if (!game) return null;
  
  const playerIds = Object.keys(game.players);
  if (playerIds.length < 2) return null;
  
  game.gameState = 'playing';
  game.currentPlayer = playerIds[0];
  game.timer = game.maxTime;
  game.board = generateBoard();
  game.flippedCards = [];
  game.matches = [];
  
  // Reset player powers
  Object.values(game.players).forEach(player => {
    player.powerUsed = {};
  });
  
  return game;
}

function generateBoard() {
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

function flipCard(socket, roomId, cardId) {
  const game = games[roomId];
  if (!game || !game.players[socket.id] || game.currentPlayer !== socket.id) return null;
  
  const card = game.board.find(c => c.id === cardId);
  if (!card || card.flipped || card.matched) return null;
  
  card.flipped = true;
  game.flippedCards.push(cardId);
  
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
      game.players[socket.id].score += 100;
      
      // Player gets another turn
      game.flippedCards = [];
      
      // Check for game end
      if (game.matches.length === 8) {
        game.gameState = 'finished';
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
      }, 1000);
    }
  }
  
  return game;
}

function usePower(socket, roomId, powerType, target) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  
  if (player.powerUsed[powerType] || !player.powers.includes(powerType)) {
    return null;
  }
  
  player.powerUsed[powerType] = true;
  
  switch (powerType) {
    case 'freeze':
      // Freeze opponent for 10 seconds
      const opponentId = Object.keys(game.players).find(id => id !== socket.id);
      if (opponentId) {
        game.players[opponentId].frozen = true;
        setTimeout(() => {
          if (game.players[opponentId]) {
            game.players[opponentId].frozen = false;
          }
        }, 10000);
      }
      break;
      
    case 'peek':
      // Reveal a card for 3 seconds
      const card = game.board.find(c => c.id === target);
      if (card && !card.matched) {
        card.peeked = true;
        setTimeout(() => {
          if (card) {
            card.peeked = false;
          }
        }, 3000);
      }
      break;
      
    case 'shuffle':
      // Shuffle unmatched cards
      const unmatched = game.board.filter(c => !c.matched);
      const symbols = unmatched.map(c => c.symbol);
      
      // Shuffle symbols
      for (let i = symbols.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
      }
      
      // Reassign symbols
      unmatched.forEach((card, index) => {
        card.symbol = symbols[index];
      });
      break;
  }
  
  return game;
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
  startGame,
  flipCard,
  usePower,
  removePlayer
};