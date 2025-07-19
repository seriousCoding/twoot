const games = {};

function createGame(roomId) {
  games[roomId] = {
    players: {},
    currentDrawer: null,
    currentWord: null,
    words: ['cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'flower', 'bird', 'fish'],
    gameState: 'waiting',
    timer: 0,
    round: 1,
    maxRounds: 5,
    guesses: [],
    scores: {},
    canvas: []
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
    isDrawing: false,
    hasGuessed: false
  };
  
  game.scores[socket.id] = 0;
  
  return game;
}

function startGame(roomId) {
  const game = games[roomId];
  if (!game) return null;
  
  const playerIds = Object.keys(game.players);
  if (playerIds.length < 2) return null;
  
  game.gameState = 'playing';
  game.currentDrawer = playerIds[0];
  game.currentWord = game.words[Math.floor(Math.random() * game.words.length)];
  game.timer = 60;
  game.canvas = [];
  
  // Reset player states
  Object.values(game.players).forEach(player => {
    player.isDrawing = false;
    player.hasGuessed = false;
  });
  
  game.players[game.currentDrawer].isDrawing = true;
  
  return game;
}

function draw(socket, roomId, drawData) {
  const game = games[roomId];
  if (!game || !game.players[socket.id] || !game.players[socket.id].isDrawing) return null;
  
  game.canvas.push(drawData);
  return game;
}

function guess(socket, roomId, guessText) {
  const game = games[roomId];
  if (!game || !game.players[socket.id] || game.players[socket.id].isDrawing) return null;
  
  const player = game.players[socket.id];
  if (player.hasGuessed) return null;
  
  const guess = {
    playerId: socket.id,
    nickname: player.nickname,
    guess: guessText,
    timestamp: Date.now(),
    correct: guessText.toLowerCase() === game.currentWord.toLowerCase()
  };
  
  game.guesses.push(guess);
  
  if (guess.correct) {
    player.hasGuessed = true;
    game.scores[socket.id] += 100;
    
    // Check if all players have guessed
    const nonDrawers = Object.values(game.players).filter(p => !p.isDrawing);
    const allGuessed = nonDrawers.every(p => p.hasGuessed);
    
    if (allGuessed) {
      nextRound(roomId);
    }
  }
  
  return game;
}

function nextRound(roomId) {
  const game = games[roomId];
  if (!game) return null;
  
  const playerIds = Object.keys(game.players);
  const currentIndex = playerIds.indexOf(game.currentDrawer);
  const nextIndex = (currentIndex + 1) % playerIds.length;
  
  if (nextIndex === 0) {
    game.round++;
  }
  
  if (game.round > game.maxRounds) {
    game.gameState = 'finished';
    return game;
  }
  
  game.currentDrawer = playerIds[nextIndex];
  game.currentWord = game.words[Math.floor(Math.random() * game.words.length)];
  game.timer = 60;
  game.canvas = [];
  game.guesses = [];
  
  // Reset player states
  Object.values(game.players).forEach(player => {
    player.isDrawing = false;
    player.hasGuessed = false;
  });
  
  game.players[game.currentDrawer].isDrawing = true;
  
  return game;
}

function removePlayer(socket, roomId) {
  if (games[roomId]) {
    delete games[roomId].players[socket.id];
    delete games[roomId].scores[socket.id];
    
    if (Object.keys(games[roomId].players).length === 0) {
      delete games[roomId];
    } else if (games[roomId].currentDrawer === socket.id) {
      nextRound(roomId);
    }
  }
}

module.exports = {
  games,
  joinGame,
  startGame,
  draw,
  guess,
  nextRound,
  removePlayer
};