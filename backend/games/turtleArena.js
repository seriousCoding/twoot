class TurtleArenaGame {
  constructor() {
    this.games = {};
    this.ARENA_WIDTH = 800;
    this.ARENA_HEIGHT = 600;
  }

  createGame(roomId) {
    const game = {
      players: {},
      turtles: {},
      food: [],
      obstacles: this.generateObstacles(),
      gameState: 'waiting',
      gameLoop: null,
      aiMode: false,
      aiDifficulty: 'medium',
      aiBehaviorTrees: new Map(),
      aiStrategies: {
        easy: { reactionTime: 500, efficiency: 0.3, pathOptimization: 0.2 },
        medium: { reactionTime: 200, efficiency: 0.7, pathOptimization: 0.6 },
        hard: { reactionTime: 100, efficiency: 0.95, pathOptimization: 0.9 }
      }
    };
    this.games[roomId] = game;
    
    // Generate initial food
    for (let i = 0; i < 15; i++) {
      this.addRandomFood(game);
    }
    return game;
  }

  generateObstacles() {
    const obstacles = [];
    
    // Add some random obstacles
    for (let i = 0; i < 10; i++) {
      obstacles.push({
        x: Math.random() * (this.ARENA_WIDTH - 100) + 50,
        y: Math.random() * (this.ARENA_HEIGHT - 100) + 50,
        width: 30 + Math.random() * 40,
        height: 30 + Math.random() * 40,
        type: 'rock'
      });
    }
    
    // Add arena boundaries
    obstacles.push(
      { x: -10, y: -10, width: this.ARENA_WIDTH + 20, height: 10, type: 'wall' }, // Top
      { x: -10, y: this.ARENA_HEIGHT, width: this.ARENA_WIDTH + 20, height: 10, type: 'wall' }, // Bottom
      { x: -10, y: -10, width: 10, height: this.ARENA_HEIGHT + 20, type: 'wall' }, // Left
      { x: this.ARENA_WIDTH, y: -10, width: 10, height: this.ARENA_HEIGHT + 20, type: 'wall' } // Right
    );
    
    return obstacles;
  }

  addRandomFood(game) {
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.random() * this.ARENA_WIDTH;
      const y = Math.random() * this.ARENA_HEIGHT;
      
      if (!this.checkCollision(x, y, game.obstacles)) {
        game.food.push({
          x,
          y,
          value: 10 + Math.random() * 20,
          type: Math.random() < 0.8 ? 'normal' : 'power'
        });
        break;
      }
      attempts++;
    }
  }

  joinGame(socket, playerName, roomId, aiMode = false, aiDifficulty = 'medium') {
    let game = this.games[roomId];
    if (!game) {
      game = this.createGame(roomId);
    }
    
    game.aiMode = aiMode;
    game.aiDifficulty = aiDifficulty;
    
    // Add human player
    game.players[socket.id] = {
      id: socket.id,
      nickname: playerName || `Player${Math.floor(Math.random() * 1000)}`,
      score: 0,
      code: '',
      isAI: false
    };
    
    // Create turtle for player
    game.turtles[socket.id] = this.createTurtle(socket.id);
    
    // Add AI players if in AI mode
    if (aiMode && Object.keys(game.players).length === 1) {
      for (let i = 1; i <= 3; i++) {
        const aiId = `ai_${i}`;
        game.players[aiId] = {
          id: aiId,
          nickname: `AI Turtle ${i}`,
          score: 0,
          code: this.generateAICode(game.aiDifficulty),
          isAI: true
        };
        
        game.turtles[aiId] = this.createTurtle(aiId);
        game.aiBehaviorTrees.set(aiId, this.createBehaviorTree(aiId, game.aiDifficulty));
      }
    }

    if (Object.keys(game.players).length > 1 && game.gameState === 'waiting') {
        this.startGame(roomId);
    }
    
    return game;
  }

  handleAction(roomId, playerId, data) {
    if (data.type === 'updateCode') {
        this.updateCode(playerId, roomId, data.code);
    }
    return this.games[roomId];
  }

  getRoomState(roomId) {
      const game = this.games[roomId];
      if (!game) return null;

      return {
          players: game.players,
          turtles: game.turtles,
          food: game.food,
          obstacles: game.obstacles,
          gameState: game.gameState
      };
  }

  leaveRoom(roomId, playerId) {
      const game = this.games[roomId];
      if (game) {
          delete game.players[playerId];
          delete game.turtles[playerId];
      }
  }

  cleanupRoom(roomId) {
      const game = this.games[roomId];
      if (game && Object.keys(game.players).length === 0) {
          if (game.gameLoop) clearInterval(game.gameLoop);
          delete this.games[roomId];
      }
  }

  createTurtle(playerId) {
    return {
      id: playerId,
      x: Math.random() * (this.ARENA_WIDTH - 100) + 50,
      y: Math.random() * (this.ARENA_HEIGHT - 100) + 50,
      direction: Math.random() * Math.PI * 2,
      energy: 100,
      maxEnergy: 100,
      speed: 2,
      size: 15,
      foodCollected: 0,
      alive: true,
      lastUpdate: Date.now(),
      memory: {
        knownFood: [],
        avoidedObstacles: [],
        path: []
      }
    };
  }

  generateAICode(difficulty) {
    const strategies = {
      easy: `
// Basic food collection
const nearby = turtle.scan();
const food = nearby.filter(item => item.type === 'food');
if (food.length > 0) {
  const closest = food.reduce((a, b) => a.distance < b.distance ? a : b);
  turtle.turn(closest.angle - turtle.getDirection());
  turtle.move(5);
} else {
  turtle.turn(0.2);
  turtle.move(3);
}`,
      
      medium: `
// Smart pathfinding and energy management
const nearby = turtle.scan();
const food = nearby.filter(item => item.type === 'food');
const obstacles = nearby.filter(item => item.type === 'obstacle');

if (turtle.getEnergy() < 30 && food.length > 0) {
  // Emergency food seeking
  const closest = food.reduce((a, b) => a.distance < b.distance ? a : b);
  turtle.turn(closest.angle - turtle.getDirection());
  turtle.move(8);
} else if (food.length > 0) {
  // Efficient food collection
  const best = food.reduce((a, b) => 
    (a.distance / (a.value || 10)) < (b.distance / (b.value || 10)) ? a : b
  );
  turtle.turn(best.angle - turtle.getDirection());
  turtle.move(6);
} else {
  // Exploration with obstacle avoidance
  if (obstacles.length > 0) {
    const closest = obstacles.reduce((a, b) => a.distance < b.distance ? a : b);
    turtle.turn(closest.angle - turtle.getDirection() + Math.PI);
  }
  turtle.move(4);
}`,
      
      hard: `
// Advanced AI with memory and strategy
const nearby = turtle.scan();
const food = nearby.filter(item => item.type === 'food');
const obstacles = nearby.filter(item => item.type === 'obstacle');
const turtles = nearby.filter(item => item.type === 'turtle');

// Energy management
const energyRatio = turtle.getEnergy() / 100;

if (energyRatio < 0.2) {
  // Critical energy - find food immediately
  if (food.length > 0) {
    const emergency = food.reduce((a, b) => a.distance < b.distance ? a : b);
    turtle.turn(emergency.angle - turtle.getDirection());
    turtle.move(10);
  }
} else if (food.length > 0) {
  // Strategic food selection
  const powerFood = food.filter(f => f.type === 'power');
  const target = powerFood.length > 0 && powerFood[0].distance < 30 ? 
    powerFood[0] : food.reduce((a, b) => {
      const aScore = (a.value || 10) / Math.max(1, a.distance);
      const bScore = (b.value || 10) / Math.max(1, b.distance);
      return aScore > bScore ? a : b;
    });
  
  // Avoid other turtles
  if (turtles.length > 0) {
    const closeTurtle = turtles.find(t => t.distance < 20);
    if (closeTurtle) {
      turtle.turn(target.angle - turtle.getDirection() + 0.5);
    } else {
      turtle.turn(target.angle - turtle.getDirection());
    }
  } else {
    turtle.turn(target.angle - turtle.getDirection());
  }
  
  turtle.move(energyRatio * 8);
} else {
  // Intelligent exploration
  const currentDir = turtle.getDirection();
  let newDir = currentDir;
  
  if (obstacles.length > 0) {
    const danger = obstacles.filter(o => o.distance < 25);
    if (danger.length > 0) {
      newDir = danger[0].angle + Math.PI + (Math.random() - 0.5) * 0.5;
    }
  }
  
  if (Math.random() < 0.1) {
    newDir += (Math.random() - 0.5) * 0.3;
  }
  
  turtle.turn(newDir);
  turtle.move(3 + energyRatio * 3);
}`
    };
    
    return strategies[difficulty] || strategies.medium;
  }

  createBehaviorTree(aiId, difficulty) {
    const strategy = {
      easy: { updateInterval: 500, decisionComplexity: 1 },
      medium: { updateInterval: 200, decisionComplexity: 2 },
      hard: { updateInterval: 100, decisionComplexity: 3 }
    }[difficulty];
    
    return {
      aiId,
      strategy,
      lastActionTime: 0,
      currentState: 'exploring',
      target: null
    };
  }

  startGame(roomId) {
    const game = this.games[roomId];
    if (!game || Object.keys(game.players).length === 0) return;
    
    game.gameState = 'playing';
    
    game.gameLoop = setInterval(() => {
      this.updateGameState(game);
      if(global.io) {
          global.io.of('/turtle-arena').to(roomId).emit('gameState', this.getRoomState(roomId));
      }
    }, 1000 / 30); // 30 FPS
  }

  updateCode(playerId, roomId, code) {
    const game = this.games[roomId];
    if (game && game.players[playerId]) {
      game.players[playerId].code = code;
    }
  }

  executeCode(playerId, roomId) {
    const game = this.games[roomId];
    const player = game.players[playerId];
    const turtle = game.turtles[playerId];
    if (!game || !player || !turtle || !turtle.alive) return;
    
    try {
      const api = this.createTurtleAPI(turtle, game);
      const func = new Function('turtle', player.code);
      func(api);
    } catch (e) {
      console.error(`Error executing code for player ${playerId}:`, e.message);
      // Optional: notify player of error
    }
  }

  executeAIBehavior(game, aiId) {
    const behaviorTree = game.aiBehaviorTrees.get(aiId);
    if (!behaviorTree || Date.now() - behaviorTree.lastActionTime < behaviorTree.strategy.updateInterval) {
      return;
    }
    
    const turtle = game.turtles[aiId];
    if (!turtle || !turtle.alive) return;
    
    const api = this.createTurtleAPI(turtle, game);
    const nearby = api.scan();
    const food = nearby.filter(item => item.type === 'food');
    const obstacles = nearby.filter(item => item.type === 'obstacle');
    const otherTurtles = nearby.filter(item => item.type === 'turtle');
    
    switch (behaviorTree.strategy.decisionComplexity) {
      case 1: // Easy
        this.emergencyFoodSeek(api, food, behaviorTree.strategy);
        break;
      case 2: // Medium
        this.strategicFoodCollection(api, food, obstacles, otherTurtles, behaviorTree.strategy);
        break;
      case 3: // Hard
        this.intelligentExploration(api, obstacles, behaviorTree, behaviorTree.strategy);
        break;
    }
    
    behaviorTree.lastActionTime = Date.now();
  }

  emergencyFoodSeek(api, food, strategy) {
    if (food.length > 0) {
      const closest = food.reduce((a, b) => a.distance < b.distance ? a : b);
      api.turn(closest.angle - api.getDirection());
      api.move(7);
    } else {
      api.turn(0.3);
      api.move(3);
    }
  }

  strategicFoodCollection(api, food, obstacles, otherTurtles, strategy) {
    if (api.getEnergy() / api.getMaxEnergy() < 0.3) {
      this.emergencyFoodSeek(api, food, strategy);
      return;
    }
    
    if (food.length > 0) {
      const best = food.reduce((a, b) => (a.value / a.distance) > (b.value / b.distance) ? a : b);
      let targetDir = best.angle;
      targetDir = this.avoidObstacles(api.getDirection(), targetDir, obstacles);
      
      api.turn(targetDir);
      api.move(5);
    } else {
      api.turn((Math.random() - 0.5) * 0.4);
      api.move(3);
    }
  }

  intelligentExploration(api, obstacles, behaviorTree, strategy) {
    // A* pathfinding would be implemented here for highest quality AI
    // For now, using a simpler model
    const food = api.scan().filter(i => i.type === 'food');
    
    if (behaviorTree.target && api.getMemory().knownFood.includes(behaviorTree.target)) {
        const targetFood = food.find(f => f.id === behaviorTree.target);
        if (targetFood) {
            let targetDir = targetFood.angle;
            targetDir = this.avoidObstacles(api.getDirection(), targetDir, obstacles);
            api.turn(targetDir);
            api.move(6);
            return;
        }
    }
    
    // If no target, find a new one
    this.strategicFoodCollection(api, food, obstacles, [], strategy);
  }

  avoidObstacles(currentDir, targetDir, obstacles) {
    let adjustedDir = targetDir;
    
    for (const obs of obstacles) {
      if (obs.distance < 30) {
        const angleToObstacle = obs.angle;
        // Simple avoidance: turn away from the obstacle
        adjustedDir += (Math.PI / 2) * Math.sign(angleToObstacle);
      }
    }
    return adjustedDir;
  }

  createTurtleAPI(turtle, game) {
    return {
      getDirection: () => turtle.direction,
      getEnergy: () => turtle.energy,
      getMaxEnergy: () => turtle.maxEnergy,
      getSpeed: () => turtle.speed,
      getPosition: () => ({ x: turtle.x, y: turtle.y }),
      getMemory: () => turtle.memory,

      move: (distance) => {
        const energyCost = distance * 0.1;
        if (turtle.energy > energyCost) {
          turtle.energy -= energyCost;
          
          const newX = turtle.x + Math.cos(turtle.direction) * distance;
          const newY = turtle.y + Math.sin(turtle.direction) * distance;
          
          if (!this.checkCollisionWithRadius(newX, newY, turtle.size, game.obstacles)) {
            turtle.x = newX;
            turtle.y = newY;
          } else {
              turtle.direction += Math.PI / 2;
          }
        }
      },
      
      turn: (angle) => {
        turtle.direction += angle;
        turtle.direction %= (2 * Math.PI);
      },

      scan: (range = 150, fov = Math.PI / 2) => {
        const results = [];
        const startAngle = turtle.direction - fov / 2;
        const endAngle = turtle.direction + fov / 2;
        
        // Scan for food
        for (const f of game.food) {
          const dx = f.x - turtle.x;
          const dy = f.y - turtle.y;
          const distance = Math.sqrt(dx*dx + dy*dy);
          if (distance < range) {
            const angle = Math.atan2(dy, dx);
            if (angle > startAngle && angle < endAngle) {
              results.push({ type: 'food', distance, angle, value: f.value });
            }
          }
        }
        
        // Scan for obstacles
        for (const o of game.obstacles) {
          const dx = o.x - turtle.x;
          const dy = o.y - turtle.y;
          const distance = Math.sqrt(dx*dx + dy*dy) - o.width/2;
          if (distance < range) {
            const angle = Math.atan2(dy, dx);
             if (angle > startAngle && angle < endAngle) {
              results.push({ type: 'obstacle', distance, angle });
            }
          }
        }
        
        // Scan for other turtles
        for (const otherId in game.turtles) {
          if (otherId !== turtle.id) {
            const other = game.turtles[otherId];
            const dx = other.x - turtle.x;
            const dy = other.y - turtle.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < range) {
              const angle = Math.atan2(dy, dx);
              if (angle > startAngle && angle < endAngle) {
                results.push({ type: 'turtle', distance, angle, id: otherId });
              }
            }
          }
        }
        
        return results;
      }
    };
  }

  checkCollision(x, y, obstacles) {
    for (const obs of obstacles) {
      if (x > obs.x && x < obs.x + obs.width && y > obs.y && y < obs.y + obs.height) {
        return true;
      }
    }
    return false;
  }

  checkCollisionWithRadius(x, y, radius, obstacles) {
    for (const obs of obstacles) {
        const closestX = Math.max(obs.x, Math.min(x, obs.x + obs.width));
        const closestY = Math.max(obs.y, Math.min(y, obs.y + obs.height));
        const distance = Math.sqrt(
            (x - closestX) * (x - closestX) +
            (y - closestY) * (y - closestY)
        );
        if (distance < radius) return true;
    }
    return false;
  }

  updateGameState(game) {
    // Execute player and AI code
    for (const playerId in game.players) {
        if(game.players[playerId].isAI) {
            this.executeAIBehavior(game, playerId);
        } else {
            this.executeCode(playerId, game.id);
        }
    }
    
    // Update turtles
    for (const turtleId in game.turtles) {
      const turtle = game.turtles[turtleId];
      if (!turtle.alive) continue;
      
      // Basic energy regen
      turtle.energy = Math.min(turtle.maxEnergy, turtle.energy + 0.05);
      
      // Food collision
      for (let i = game.food.length - 1; i >= 0; i--) {
        const f = game.food[i];
        const dist = Math.sqrt((turtle.x - f.x)**2 + (turtle.y - f.y)**2);
        
        if (dist < turtle.size) {
          turtle.energy = Math.min(turtle.maxEnergy, turtle.energy + f.value);
          game.players[turtle.id].score += Math.round(f.value);
          game.food.splice(i, 1);
          this.addRandomFood(game);
        }
      }
      
      // Turtle collision
      for (const otherId in game.turtles) {
          if (turtleId !== otherId) {
              const other = game.turtles[otherId];
              const dist = Math.sqrt((turtle.x - other.x)**2 + (turtle.y - other.y)**2);
              if (dist < turtle.size + other.size) {
                  // Simple bounce
                  turtle.direction += Math.PI;
              }
          }
      }

      // Check for death
      if (turtle.energy <= 0) {
        turtle.alive = false;
      }
    }
  }
}

module.exports = new TurtleArenaGame();