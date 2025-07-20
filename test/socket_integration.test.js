const io = require('socket.io-client');

const games = [
  { name: 'Pacman', ns: '/pacman', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'Chess', ns: '/chess', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'Memory Duel', ns: '/memory-duel', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'Turtle Arena', ns: '/turtle-arena', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'CodeRacer', ns: '/code-racer', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'CodeSeek', ns: '/code-seek', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'CodeConquer', ns: '/code-conquer', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'DungeonBuilders', ns: '/dungeon-builders', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'PixelFarmTycoon', ns: '/pixel-farm-tycoon', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'ChatDraw', ns: '/chat-draw', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'AIPetBattlers', ns: '/ai-pet-battlers', join: { nickname: 'TestUser', room: 'testroom' } },
  { name: 'CraftTrade', ns: '/craft-trade', join: { nickname: 'TestUser', room: 'testroom' } },
];

const API_URL = process.env.TEST_API_URL || 'http://localhost:9000';

function testGame(game) {
  return new Promise((resolve) => {
    const socket = io(API_URL + game.ns, { transports: ['websocket'] });
    let assigned = false;
    let stateReceived = false;
    let timeout = setTimeout(() => {
      socket.disconnect();
      resolve({ game: game.name, success: false, reason: 'Timeout' });
    }, 5000);

    socket.on('connect', () => {
      socket.emit('join', game.join);
    });
    socket.on('playerAssigned', (id) => {
      assigned = true;
    });
    socket.on('gameState', (state) => {
      stateReceived = true;
      clearTimeout(timeout);
      socket.disconnect();
      let reason = '';
      if (!assigned) reason += 'Did not receive playerAssigned. ';
      if (!stateReceived) reason += 'Did not receive gameState.';
      resolve({ game: game.name, success: assigned && stateReceived, reason: reason.trim() });
    });
    socket.on('error', (err) => {
      clearTimeout(timeout);
      socket.disconnect();
      resolve({ game: game.name, success: false, reason: err });
    });
  });
}

(async () => {
  const results = [];
  for (const game of games) {
    const result = await testGame(game);
    results.push(result);
    console.log(`[${game.name}]`, result.success ? 'PASS' : 'FAIL', result.reason || '');
  }
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.error('Some games failed:', failed);
    process.exit(1);
  } else {
    console.log('All games passed basic socket integration test.');
    process.exit(0);
  }
})(); 