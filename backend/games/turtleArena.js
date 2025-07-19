const games = {};

const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;

function createGame(roomId) {
  games[roomId] = {
    players: {},
    turtles: {},
    gameState: 'waiting',
    timer: 0,
    maxTime: 180, // 3 minutes
    obstacles: generateObstacles(),
    food: generateFood()
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
    score: 0
  };
  
  game.turtles[socket.id] = {
    id: socket.id,
    x: Math.random() * ARENA_WIDTH,
    y: Math.random() * ARENA_HEIGHT,
    direction: 0,
    energy: 100,
    foodCollected: 0,
    alive: true
  };
  
  return game;
}

function startGame(roomId) {
  const game = games[roomId];
  if (!game) return null;
  
  const playerIds = Object.keys(game.players);
  if (playerIds.length < 1) return null;
  
  game.gameState = 'running';
  game.timer = game.maxTime;
  
  // Reset turtle states
  Object.values(game.turtles).forEach(turtle => {
    turtle.x = Math.random() * ARENA_WIDTH;
    turtle.y = Math.random() * ARENA_HEIGHT;
    turtle.direction = 0;
    turtle.energy = 100;
    turtle.foodCollected = 0;
    turtle.alive = true;
  });
  
  // Start game loop
  startGameLoop(roomId);
  
  return game;
}

function updateCode(socket, roomId, code) {
  const game = games[roomId];
  if (!game || !game.players[socket.id]) return null;
  
  game.players[socket.id].code = code;
  return game;
}

function startGameLoop(roomId) {
  const game = games[roomId];
  if (!game) return;
  
  const interval = setInterval(() => {
    if (game.gameState !== 'running') {
      clearInterval(interval);
      return;
    }
    
    // Execute each turtle's code
    Object.keys(game.turtles).forEach(playerId => {
      const turtle = game.turtles[playerId];
      const player = game.players[playerId];
      
      if (turtle.alive && player.code) {
        executeTurtleCode(turtle, player.code, game);
      }
    });
    
    // Update game state
    updateGameState(game);
    
    game.timer--;
    if (game.timer <= 0) {
      game.gameState = 'finished';
      clearInterval(interval);
    }
  }, 100); // 10 FPS
}

function executeTurtleCode(turtle, code, game) {
  try {
    // Create safe turtle API
    const api = createTurtleAPI(turtle, game);
    
    // Execute user code with turtle API
    const func = new Function('turtle', code);
    func(api);
    
  } catch (error) {
    console.error('Turtle code execution error:', error);
  }
}

function createTurtleAPI(turtle, game) {
  return {
    move: (distance) => {
      if (turtle.energy > 0) {
        const dx = Math.cos(turtle.direction) * distance;
        const dy = Math.sin(turtle.direction) * distance;
        
        let newX = turtle.x + dx;
        let newY = turtle.y + dy;
        
        // Boundary checking
        newX = Math.max(0, Math.min(ARENA_WIDTH, newX));
        newY = Math.max(0, Math.min(ARENA_HEIGHT, newY));
        
        // Collision detection
        if (!checkCollision(newX, newY, game.obstacles)) {
          turtle.x = newX;
          turtle.y = newY;
          turtle.energy -= Math.abs(distance) * 0.1;
        }
      }
    },
    
    turn: (angle) => {
      turtle.direction += angle;
      turtle.direction = turtle.direction % (2 * Math.PI);
    },
    
    scan: () => {
      // Return nearby objects
      const nearby = [];
      
      // Check for food
      game.food.forEach((food, index) => {
        const distance = Math.sqrt(
          Math.pow(turtle.x - food.x, 2) + 
          Math.pow(turtle.y - food.y, 2)
        );
        
        if (distance < 50) {
          nearby.push({
            type: 'food',
            distance,
            angle: Math.atan2(food.y - turtle.y, food.x - turtle.x)
          });
        }
      });
      
      // Check for other turtles
      Object.values(game.turtles).forEach(other => {
        if (other.id !== turtle.id) {
          const distance = Math.sqrt(
            Math.pow(turtle.x - other.x, 2) + 
            Math.pow(turtle.y - other.y, 2)
          );
          
          if (distance < 50) {
            nearby.push({
              type: 'turtle',
              distance,
              angle: Math.atan2(other.y - turtle.y, other.x - turtle.x)
            });
          }
        }
      });
      
      return nearby;
    },
    
    getPosition: () => ({ x: turtle.x, y: turtle.y }),
    getDirection: () => turtle.direction,
    getEnergy: () => turtle.energy,
    getFoodCollected: () => turtle.foodCollected
  };
}

function checkCollision(x, y, obstacles) {
  return obstacles.some(obstacle => {
    return x >= obstacle.x && x <= obstacle.x + obstacle.width &&
           y >= obstacle.y && y <= obstacle.y + obstacle.height;
  });
}

function updateGameState(game) {
  // Check for food collection
  game.food = game.food.filter(food => {
    let collected = false;
    
    Object.values(game.turtles).forEach(turtle => {
      if (turtle.alive) {
        const distance = Math.sqrt(
          Math.pow(turtle.x - food.x, 2) + 
          Math.pow(turtle.y - food.y, 2)
        );
        
        if (distance < 10) {
          turtle.foodCollected++;
          turtle.energy = Math.min(100, turtle.energy + 20);
          collected = true;
        }
      }
    });
    
    return !collected;
  });
  
  // Check for turtle deaths
  Object.values(game.turtles).forEach(turtle => {
    if (turtle.energy <= 0) {
      turtle.alive = false;
    }
  });
  
  // Update scores
  Object.keys(game.players).forEach(playerId => {
    const turtle = game.turtles[playerId];
    if (turtle) {
      game.players[playerId].score = turtle.foodCollected * 10;
    }
  });
  
  // Respawn food occasionally
  if (Math.random() < 0.1 && game.food.length < 10) {
    game.food.push({
      x: Math.random() * ARENA_WIDTH,
      y: Math.random() * ARENA_HEIGHT
    });
  }
}

function generateObstacles() {
  const obstacles = [];
  for (let i = 0; i < 5; i++) {
    obstacles.push({
      x: Math.random() * (ARENA_WIDTH - 50),
      y: Math.random() * (ARENA_HEIGHT - 50),
      width: 50,
      height: 50
    });
  }
  return obstacles;
}

function generateFood() {
  const food = [];
  for (let i = 0; i < 10; i++) {
    food.push({
      x: Math.random() * ARENA_WIDTH,
      y: Math.random() * ARENA_HEIGHT
    });
  }
  return food;
}

function removePlayer(socket, roomId) {
  if (games[roomId]) {
    delete games[roomId].players[socket.id];
    delete games[roomId].turtles[socket.id];
    
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
  removePlayer
};