const games = {};

function createGame(roomId) {
  games[roomId] = {
    players: {}, // socketId -> { nickname, territories, isAI }
    board: Array(10).fill(null).map(() => Array(10).fill(null)),
    turn: null,
    started: false
  };
}

function joinGame(socket, nickname, roomId, isAI = false) {
  if (!games[roomId]) createGame(roomId);
  const game = games[roomId];
  game.players[socket.id] = {
    nickname,
    territories: [],
    isAI
  };
  socket.join(roomId);
  return game;
}

function startGame(roomId) {
  const game = games[roomId];
  if (!game) return;
  game.started = true;
  game.turn = Object.keys(game.players)[0];
}

function handleCommand(socket, roomId, command) {
  // For demo: just echo command and update state
  const game = games[roomId];
  if (!game) return;
  if (!game.players[socket.id]) return;
  // In real game, parse and execute command
  game.lastCommand = { player: socket.id, command };
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
  handleCommand,
  removePlayer
}; 