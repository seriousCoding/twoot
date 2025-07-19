const { v4: uuidv4 } = require('uuid');

const games = {}; // roomId -> game state

function createGame(roomId) {
  games[roomId] = {
    players: {}, // socketId -> { nickname, x, y, isIt }
    itId: null,
    started: false,
    timer: 60,
    round: 1,
  };
}

function joinGame(socket, nickname, roomId) {
  if (!games[roomId]) createGame(roomId);
  const game = games[roomId];
  game.players[socket.id] = {
    nickname,
    x: Math.random() * 600,
    y: Math.random() * 400,
    isIt: false,
  };
  socket.join(roomId);
  return game;
}

function startGame(roomId) {
  const game = games[roomId];
  if (!game) return;
  const playerIds = Object.keys(game.players);
  if (playerIds.length < 2) return;
  // Randomly pick "it"
  const itIndex = Math.floor(Math.random() * playerIds.length);
  game.itId = playerIds[itIndex];
  Object.values(game.players).forEach((p, i) => p.isIt = (i === itIndex));
  game.started = true;
  game.timer = 60;
}

function movePlayer(socket, roomId, x, y) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return;
  game.players[socket.id].x = x;
  game.players[socket.id].y = y;
}

function checkFound(roomId) {
  const game = games[roomId];
  if (!game) return null;
  const it = game.players[game.itId];
  for (const [id, p] of Object.entries(game.players)) {
    if (id !== game.itId) {
      const dx = it.x - p.x;
      const dy = it.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 30) {
        // Found!
        return id;
      }
    }
  }
  return null;
}

function removePlayer(socket, roomId) {
  const game = games[roomId];
  if (!game) return;
  delete game.players[socket.id];
  if (Object.keys(game.players).length === 0) delete games[roomId];
}

module.exports = {
  games,
  createGame,
  joinGame,
  startGame,
  movePlayer,
  checkFound,
  removePlayer,
}; 