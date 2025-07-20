class PacmanGame {
  constructor() {
    this.rooms = new Map();
    this.MAZE_WIDTH = 19;
    this.MAZE_HEIGHT = 21;
    this.PELLET_COUNT = 244;
    
    // Simple maze layout (0 = wall, 1 = pellet, 2 = power pellet, 3 = empty)
    this.baseMaze = [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
      [0,2,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,2,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,1,0],
      [0,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1,0],
      [0,0,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,0,0],
      [3,3,3,0,1,0,1,1,1,1,1,1,1,0,1,0,3,3,3],
      [0,0,0,0,1,0,1,0,0,3,0,0,1,0,1,0,0,0,0],
      [1,1,1,1,1,1,1,0,3,3,3,0,1,1,1,1,1,1,1],
      [0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0],
      [3,3,3,0,1,0,1,1,1,1,1,1,1,0,1,0,3,3,3],
      [0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
      [0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0],
      [0,2,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,2,0],
      [0,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0,0],
      [0,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1,0],
      [0,1,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];

    // Ghost home and corner positions
    this.GHOST_HOME = { x: 9, y: 9 };
    this.CORNERS = {
      'blinky': { x: 18, y: 0 },   // Top right
      'pinky': { x: 0, y: 0 },     // Top left
      'inky': { x: 18, y: 20 },    // Bottom right
      'clyde': { x: 0, y: 20 }     // Bottom left
    };
  }

  createRoom(roomId) {
    const room = {
      id: roomId,
      players: {},
      ghosts: this.createGhosts(),
      maze: this.baseMaze.map(row => [...row]), // Deep copy
      gameState: 'waiting', // waiting, playing, finished
      score: 0,
      lives: 3,
      level: 1,
      pelletsRemaining: this.PELLET_COUNT,
      powerPelletActive: false,
      powerPelletTimer: 0,
      gameTimer: 0,
      spectators: new Set(),
      highScore: 0,
      modeTimer: 0,
      currentMode: 'scatter', // scatter, chase
      modePattern: [7, 20, 7, 20, 5, 20, 5], // seconds for each mode
      modeIndex: 0
    };
    this.rooms.set(roomId, room);
    return room;
  }

  createGhosts() {
    return [
      { 
        id: 'blinky', 
        x: 9, y: 9, 
        direction: 'up', 
        mode: 'scatter', 
        color: 'red',
        targetX: 18, targetY: 0,
        speed: 1,
        personality: 'aggressive'
      },
      { 
        id: 'pinky', 
        x: 9, y: 10, 
        direction: 'down', 
        mode: 'scatter', 
        color: 'pink',
        targetX: 0, targetY: 0,
        speed: 1,
        personality: 'ambusher'
      },
      { 
        id: 'inky', 
        x: 8, y: 10, 
        direction: 'up', 
        mode: 'scatter', 
        color: 'cyan',
        targetX: 18, targetY: 20,
        speed: 1,
        personality: 'flanker'
      },
      { 
        id: 'clyde', 
        x: 10, y: 10, 
        direction: 'down', 
        mode: 'scatter', 
        color: 'orange',
        targetX: 0, targetY: 20,
        speed: 1,
        personality: 'patrol'
      }
    ];
  }

  joinGame(socket, playerName, roomId, aiMode, aiDifficulty) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }
  
    const playerId = socket.id;

    // Check if player is already in room
    if (room.players[playerId]) {
      return room;
    }
  
    // Only allow one player in single-player mode
    if (Object.keys(room.players).length === 0) {
      room.players[playerId] = {
        id: playerId,
        name: playerName,
        x: 9,
        y: 15,
        direction: 'right',
        nextDirection: 'right',
        connected: true
      };
      
      // Start game
      room.gameState = 'playing';
      this.startGameLoop(roomId);
      
      return room;
    } else {
      // Join as spectator
      room.spectators.add(playerId);
      return room;
    }
  }

  handleAction(roomId, playerId, data) {
    if (data.type === 'move') {
      return this.movePlayer(roomId, playerId, data.direction);
    }
    return this.rooms.get(roomId);
  }

  movePlayer(roomId, playerId, direction) {
    const room = this.rooms.get(roomId);
    if (!room || !room.players[playerId] || room.gameState !== 'playing') {
      return { success: false, error: 'Invalid move' };
    }

    const player = room.players[playerId];
    player.nextDirection = direction;
    
    return { success: true, data: room };
  }

  updateGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameState !== 'playing') return;

    room.gameTimer++;

    // Update mode timer and switch between scatter/chase
    room.modeTimer++;
    const currentModeTime = room.modePattern[room.modeIndex] * 20; // Convert to ticks (20 ticks per second)
    
    if (room.modeTimer >= currentModeTime) {
      room.modeTimer = 0;
      room.modeIndex = (room.modeIndex + 1) % room.modePattern.length;
      room.currentMode = room.modeIndex % 2 === 0 ? 'scatter' : 'chase';
      
      // Update ghost modes (except frightened ghosts)
      room.ghosts.forEach(ghost => {
        if (ghost.mode !== 'frightened') {
          ghost.mode = room.currentMode;
        }
      });
    }

    // Update player position
    const playerId = Object.keys(room.players)[0];
    if (playerId) {
      this.updatePlayerPosition(room, playerId);
    }

    // Update ghosts with advanced AI
    this.updateGhostsAdvanced(room);

    // Check collisions
    this.checkCollisions(room);

    // Update power pellet timer
    if (room.powerPelletActive) {
      room.powerPelletTimer--;
      if (room.powerPelletTimer <= 0) {
        room.powerPelletActive = false;
        room.ghosts.forEach(ghost => {
          if (ghost.mode === 'frightened') {
            ghost.mode = room.currentMode;
          }
        });
      }
    }

    // Check win condition
    if (room.pelletsRemaining === 0) {
      room.level++;
      room.maze = this.baseMaze.map(row => [...row]);
      room.pelletsRemaining = this.PELLET_COUNT;
      room.ghosts = this.createGhosts();
      // Reset player position
      const player = room.players[playerId];
      if (player) {
        player.x = 9;
        player.y = 15;
      }
    }

    // Check game over
    if (room.lives <= 0) {
      room.gameState = 'finished';
      if (room.score > room.highScore) {
        room.highScore = room.score;
      }
    }

    return room;
  }

  updatePlayerPosition(room, playerId) {
    const player = room.players[playerId];
    if (!player) return;

    // Try to change direction
    if (player.nextDirection !== player.direction) {
      const newPos = this.getNewPosition(player.x, player.y, player.nextDirection);
      if (this.isValidMove(room, newPos.x, newPos.y)) {
        player.direction = player.nextDirection;
      }
    }

    // Move in current direction
    const newPos = this.getNewPosition(player.x, player.y, player.direction);
    if (this.isValidMove(room, newPos.x, newPos.y)) {
      player.x = newPos.x;
      player.y = newPos.y;

      // Handle tunnel
      if (player.x < 0) player.x = this.MAZE_WIDTH - 1;
      if (player.x >= this.MAZE_WIDTH) player.x = 0;

      // Collect pellets
      const cell = room.maze[player.y][player.x];
      if (cell === 1) {
        room.maze[player.y][player.x] = 3;
        room.score += 10;
        room.pelletsRemaining--;
      } else if (cell === 2) {
        room.maze[player.y][player.x] = 3;
        room.score += 50;
        room.pelletsRemaining--;
        room.powerPelletActive = true;
        room.powerPelletTimer = 200; // ~10 seconds at 20 FPS
        
        // Frighten all ghosts
        room.ghosts.forEach(ghost => {
          ghost.mode = 'frightened';
          // Reverse direction
          ghost.direction = this.reverseDirection(ghost.direction);
        });
      }
    }
  }

  updateGhostsAdvanced(room) {
    const playerId = Object.keys(room.players)[0];
    const player = room.players[playerId];
    if (!player) return;

    room.ghosts.forEach(ghost => {
      // Calculate target based on ghost personality and mode
      this.setGhostTarget(ghost, player, room);
      
      // Find best direction using A* pathfinding
      const nextDirection = this.findBestDirection(ghost, room);
      if (nextDirection) {
        ghost.direction = nextDirection;
      }

      // Move ghost
      const newPos = this.getNewPosition(ghost.x, ghost.y, ghost.direction);
      if (this.isValidMove(room, newPos.x, newPos.y)) {
        ghost.x = newPos.x;
        ghost.y = newPos.y;

        // Handle tunnel
        if (ghost.x < 0) ghost.x = this.MAZE_WIDTH - 1;
        if (ghost.x >= this.MAZE_WIDTH) ghost.x = 0;
      }
    });
  }

  setGhostTarget(ghost, player, room) {
    if (room.powerPelletActive) {
        // Run away! Choose a random valid direction away from player
        ghost.mode = 'frightened';
        // Simple run-away logic: try to move to a tile with greatest distance from player
        // This can be improved with a more robust escape algorithm
        return;
    }
    
    // Switch back to normal mode after being frightened
    if (ghost.mode === 'frightened') {
        ghost.mode = room.currentMode;
    }

    switch(ghost.personality) {
      case 'aggressive': // Blinky targets player directly
        ghost.targetX = player.x;
        ghost.targetY = player.y;
        break;
      case 'ambusher': // Pinky targets 4 tiles ahead of the player
        const targetPos = this.getPositionAhead(player, 4);
        ghost.targetX = targetPos.x;
        ghost.targetY = targetPos.y;
        break;
      case 'flanker': // Inky's target is more complex (Blinky's pos + vector from Blinky to 2 tiles ahead of Pacman)
        const blinky = room.ghosts.find(g => g.id === 'blinky');
        const posAhead = this.getPositionAhead(player, 2);
        if (blinky) {
            ghost.targetX = posAhead.x + (posAhead.x - blinky.x);
            ghost.targetY = posAhead.y + (posAhead.y - blinky.y);
        }
        break;
      case 'patrol': // Clyde targets player if far away, otherwise goes to its corner
        const distance = this.getDistance({x: ghost.x, y: ghost.y}, {x: player.x, y: player.y});
        if (distance > 8) {
          ghost.targetX = player.x;
          ghost.targetY = player.y;
        } else {
          ghost.targetX = this.CORNERS.clyde.x;
          ghost.targetY = this.CORNERS.clyde.y;
        }
        break;
      default:
        // Default to scatter mode target
        ghost.targetX = this.CORNERS[ghost.id].x;
        ghost.targetY = this.CORNERS[ghost.id].y;
    }
  }

  getPositionAhead(player, tiles) {
    let x = player.x;
    let y = player.y;
    
    switch (player.direction) {
      case 'up': y -= tiles; break;
      case 'down': y += tiles; break;
      case 'left': x -= tiles; break;
      case 'right': x += tiles; break;
    }
    
    return { x: Math.max(0, Math.min(this.MAZE_WIDTH - 1, x)), 
             y: Math.max(0, Math.min(this.MAZE_HEIGHT - 1, y)) };
  }

  findBestDirection(ghost, room) {
    const directions = ['up', 'down', 'left', 'right'];
    let bestDirection = ghost.direction;
    let bestScore = Infinity;
    
    // Prevent immediate reversal unless frightened
    const reverseDir = this.reverseDirection(ghost.direction);
    
    directions.forEach(dir => {
      if (dir === reverseDir && ghost.mode !== 'frightened') return;
      
      const newPos = this.getNewPosition(ghost.x, ghost.y, dir);
      if (this.isValidMove(room, newPos.x, newPos.y)) {
        const distance = this.getDistance(newPos, { x: ghost.targetX, y: ghost.targetY });
        
        // Add randomness for frightened mode
        const score = ghost.mode === 'frightened' ? 
          distance + Math.random() * 10 : distance;
        
        if (score < bestScore) {
          bestScore = score;
          bestDirection = dir;
        }
      }
    });
    
    return bestDirection;
  }

  getDistance(pos1, pos2) {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
  }

  reverseDirection(direction) {
    const reverses = {
      'up': 'down',
      'down': 'up',
      'left': 'right',
      'right': 'left'
    };
    return reverses[direction];
  }

  checkCollisions(room) {
    const playerId = Object.keys(room.players)[0];
    const player = room.players[playerId];
    if (!player) return;

    room.ghosts.forEach(ghost => {
      if (ghost.x === player.x && ghost.y === player.y) {
        if (ghost.mode === 'frightened') {
          // Eat ghost
          room.score += 200;
          ghost.x = this.GHOST_HOME.x;
          ghost.y = this.GHOST_HOME.y;
          ghost.mode = room.currentMode;
        } else {
          // Player dies
          room.lives--;
          if (room.lives > 0) {
            // Reset positions
            player.x = 9;
            player.y = 15;
            room.ghosts = this.createGhosts();
          }
        }
      }
    });
  }

  getNewPosition(x, y, direction) {
    switch (direction) {
      case 'up': return { x, y: y - 1 };
      case 'down': return { x, y: y + 1 };
      case 'left': return { x: x - 1, y };
      case 'right': return { x: x + 1, y };
      default: return { x, y };
    }
  }

  isValidMove(room, x, y) {
    if (x < 0 || x >= this.MAZE_WIDTH || y < 0 || y >= this.MAZE_HEIGHT) {
      return false;
    }
    return room.maze[y] && room.maze[y][x] !== 0;
  }

  startGameLoop(roomId) {
    const loop = () => {
      const room = this.updateGame(roomId);
      if (room && room.gameState === 'playing') {
        // Use global io instance to emit game state
        if(global.io) {
          global.io.of('/pacman').to(roomId).emit('gameState', this.getRoomState(roomId));
        }
        setTimeout(() => loop(), 50); // ~20 FPS
      }
    };
    loop();
  }

  getRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
  
    // Create a serializable version of the room state
    const players = {};
    for (const id in room.players) {
      players[id] = { ...room.players[id] };
    }
  
    return {
      id: room.id,
      players: players,
      ghosts: room.ghosts,
      maze: room.maze,
      gameState: room.gameState,
      score: room.score,
      lives: room.lives,
      level: room.level,
      pelletsRemaining: room.pelletsRemaining,
      powerPelletActive: room.powerPelletActive,
      highScore: room.highScore,
      // Spectators can be sent as an array of IDs
      spectators: Array.from(room.spectators)
    };
  }

  leaveRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    delete room.players[playerId];
    room.spectators.delete(playerId);
    return { success: true, data: { message: 'Left room successfully' } };
  }

  cleanupRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (Object.keys(room.players).length === 0 && room.spectators.size === 0) {
      this.rooms.delete(roomId);
      return { success: true, data: { message: 'Room cleaned up' } };
    }
    return { success: false, error: 'Room still has players' };
  }
}

module.exports = new PacmanGame();