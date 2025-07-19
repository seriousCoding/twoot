const games = {};

const CODE_CHALLENGES = [
  {
    title: "Hello World",
    description: "Write a function that returns 'Hello, World!'",
    code: "function hello() {\n  // Write your code here\n  \n}",
    solution: "function hello() {\n  return 'Hello, World!';\n}",
    tests: [
      { input: [], expected: "Hello, World!" }
    ]
  },
  {
    title: "Add Two Numbers",
    description: "Write a function that adds two numbers",
    code: "function add(a, b) {\n  // Write your code here\n  \n}",
    solution: "function add(a, b) {\n  return a + b;\n}",
    tests: [
      { input: [2, 3], expected: 5 },
      { input: [10, 20], expected: 30 }
    ]
  },
  {
    title: "Array Sum",
    description: "Write a function that sums all numbers in an array",
    code: "function sum(arr) {\n  // Write your code here\n  \n}",
    solution: "function sum(arr) {\n  return arr.reduce((a, b) => a + b, 0);\n}",
    tests: [
      { input: [[1, 2, 3]], expected: 6 },
      { input: [[10, 20, 30]], expected: 60 }
    ]
  }
];

function createGame(roomId) {
  games[roomId] = {
    players: {},
    currentChallenge: null,
    gameState: 'waiting',
    timer: 0,
    maxTime: 300, // 5 minutes
    leaderboard: []
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
    code: '',
    position: 0,
    completed: false,
    score: 0,
    completionTime: null
  };
  
  return game;
}

function startGame(roomId) {
  const game = games[roomId];
  if (!game) return null;
  
  const playerIds = Object.keys(game.players);
  if (playerIds.length < 1) return null;
  
  game.gameState = 'racing';
  game.currentChallenge = CODE_CHALLENGES[Math.floor(Math.random() * CODE_CHALLENGES.length)];
  game.timer = game.maxTime;
  
  // Reset player states
  Object.values(game.players).forEach(player => {
    player.code = game.currentChallenge.code;
    player.position = 0;
    player.completed = false;
    player.completionTime = null;
  });
  
  return game;
}

function updateCode(socket, roomId, code) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  player.code = code;
  
  // Calculate progress (position in race)
  const progress = calculateProgress(code, game.currentChallenge.solution);
  player.position = progress;
  
  return game;
}

function submitCode(socket, roomId, code) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  const player = game.players[socket.id];
  const challenge = game.currentChallenge;
  
  // Test the code
  const testResults = testCode(code, challenge.tests);
  
  if (testResults.passed) {
    player.completed = true;
    player.completionTime = game.maxTime - game.timer;
    player.score = Math.max(0, 1000 - player.completionTime);
    
    // Update leaderboard
    updateLeaderboard(game);
    
    // Check if all players completed
    const allCompleted = Object.values(game.players).every(p => p.completed);
    if (allCompleted) {
      game.gameState = 'finished';
    }
  }
  
  return { game, testResults };
}

function testCode(code, tests) {
  const results = {
    passed: true,
    errors: [],
    testResults: []
  };
  
  try {
    // Create a safe evaluation environment
    const func = new Function('return ' + code)();
    
    for (let test of tests) {
      try {
        const result = func.apply(null, test.input);
        const passed = result === test.expected;
        
        results.testResults.push({
          input: test.input,
          expected: test.expected,
          actual: result,
          passed
        });
        
        if (!passed) {
          results.passed = false;
        }
      } catch (error) {
        results.passed = false;
        results.errors.push(error.message);
      }
    }
  } catch (error) {
    results.passed = false;
    results.errors.push(error.message);
  }
  
  return results;
}

function calculateProgress(code, solution) {
  // Simple progress calculation based on string similarity
  const similarity = stringSimilarity(code, solution);
  return Math.floor(similarity * 100);
}

function stringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function updateLeaderboard(game) {
  const completed = Object.values(game.players).filter(p => p.completed);
  game.leaderboard = completed.sort((a, b) => b.score - a.score);
}

function removePlayer(socket, roomId) {
  if (games[roomId]) {
    delete games[roomId].players[socket.id];
    
    if (Object.keys(games[roomId].players).length === 0) {
      delete games[roomId];
    }
  }
}

module.exports = {
  games,
  joinGame,
  startGame,
  updateCode,
  submitCode,
  removePlayer
};