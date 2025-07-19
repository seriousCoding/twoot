const games = {};

function createGame(roomId) {
  games[roomId] = {
    players: {}, // socketId -> { nickname, x, y, hp }
    dungeon: generateDungeon(),
    started: false
  };
}

function generateDungeon() {
  // Simple 10x10 grid with random walls
  const grid = Array(10).fill(null).map(() => Array(10).fill(0));
  for (let i = 0; i < 20; i++) {
    grid[Math.floor(Math.random()*10)][Math.floor(Math.random()*10)] = 1; // wall
  }
  return grid;
}

function joinGame(socket, nickname, roomId) {
  if (!games[roomId]) createGame(roomId);
  const game = games[roomId];
  game.players[socket.id] = { nickname, x: 0, y: 0, hp: 3 };
  socket.join(roomId);
  return game;
}

function movePlayer(socket, roomId, dx, dy) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return;
  const p = game.players[socket.id];
  const nx = p.x + dx;
  const ny = p.y + dy;
  if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && game.dungeon[ny][nx] === 0) {
    p.x = nx;
    p.y = ny;
  }
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
  movePlayer,
  removePlayer
}; 