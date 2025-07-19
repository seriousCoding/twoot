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
      highScore: 0
    };
    this.rooms.set(roomId, room);
    return room;
  }

  createGhosts() {
    return [
      { id: 'blinky', x: 9, y: 9, direction: 'up', mode: 'chase', color: 'red' },
      { id: 'pinky', x: 9, y: 10, direction: 'down', mode: 'chase', color: 'pink' },
      { id: 'inky', x: 8, y: 10, direction: 'up', mode: 'chase', color: 'cyan' },
      { id: 'clyde', x: 10, y: 10, direction: 'down', mode: 'chase', color: 'orange' }
    ];
  }

  joinRoom(roomId, playerId, playerName) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }

    // Check if player is already in room
    if (room.players[playerId]) {
      return { success: true, room, role: 'player' };
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
      
      return { success: true, room, role: 'player' };
    } else {
      // Join as spectator
      room.spectators.add(playerId);
      return { success: true, room, role: 'spectator' };
    }
  }

  movePlayer(roomId, playerId, direction) {
    const room = this.rooms.get(roomId);
    if (!room || !room.players[playerId] || room.gameState !== 'playing') {
      return { success: false, error: 'Invalid move' };
    }

    const player = room.players[playerId];
    player.nextDirection = direction;
    
    return { success: true, room };
  }

  updateGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameState !== 'playing') return;

    room.gameTimer++;

    // Update player position
    const playerId = Object.keys(room.players)[0];
    if (playerId) {
      this.updatePlayerPosition(room, playerId);
    }

    // Update ghosts
    this.updateGhosts(room);

    // Check collisions
    this.checkCollisions(room);

    // Update power pellet timer
    if (room.powerPelletActive) {
      room.powerPelletTimer--;
      if (room.powerPelletTimer <= 0) {
        room.powerPelletActive = false;
        room.ghosts.forEach(ghost => {
          if (ghost.mode === 'frightened') {
            ghost.mode = 'chase';
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
        room.ghosts.forEach(ghost => {
          ghost.mode = 'frightened';
        });
      }
    }
  }

  updateGhosts(room) {
    const playerId = Object.keys(room.players)[0];
    const player = room.players[playerId];
    if (!player) return;

    room.ghosts.forEach(ghost => {
      // Simple AI - move towards player when in chase mode
      if (ghost.mode === 'chase') {
        const directions = ['up', 'down', 'left', 'right'];
        let bestDirection = ghost.direction;
        let bestDistance = Infinity;

        directions.forEach(dir => {
          const newPos = this.getNewPosition(ghost.x, ghost.y, dir);
          if (this.isValidMove(room, newPos.x, newPos.y)) {
            const distance = Math.abs(newPos.x - player.x) + Math.abs(newPos.y - player.y);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestDirection = dir;
            }
          }
        });

        ghost.direction = bestDirection;
      } else if (ghost.mode === 'frightened') {
        // Random movement when frightened
        const directions = ['up', 'down', 'left', 'right'];
        const validDirections = directions.filter(dir => {
          const newPos = this.getNewPosition(ghost.x, ghost.y, dir);
          return this.isValidMove(room, newPos.x, newPos.y);
        });

        if (validDirections.length > 0) {
          ghost.direction = validDirections[Math.floor(Math.random() * validDirections.length)];
        }
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

  checkCollisions(room) {
    const playerId = Object.keys(room.players)[0];
    const player = room.players[playerId];
    if (!player) return;

    room.ghosts.forEach(ghost => {
      if (ghost.x === player.x && ghost.y === player.y) {
        if (ghost.mode === 'frightened') {
          // Eat ghost
          room.score += 200;
          // Reset ghost to center
          ghost.x = 9;
          ghost.y = 9;
          ghost.mode = 'chase';
        } else {
          // Player hit by ghost
          room.lives--;
          // Reset positions
          player.x = 9;
          player.y = 15;
          room.ghosts = this.createGhosts();
          room.powerPelletActive = false;
          room.powerPelletTimer = 0;
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
    // Handle tunnel
    if (x < 0 || x >= this.MAZE_WIDTH) return true;
    if (y < 0 || y >= this.MAZE_HEIGHT) return false;
    
    return room.maze[y][x] !== 0;
  }

  startGameLoop(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const gameLoop = () => {
      if (room.gameState === 'playing') {
        this.updateGame(roomId);
        setTimeout(gameLoop, 150); // ~6-7 FPS for classic feel
      }
    };

    gameLoop();
  }

  getRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      players: room.players,
      ghosts: room.ghosts,
      maze: room.maze,
      gameState: room.gameState,
      score: room.score,
      lives: room.lives,
      level: room.level,
      pelletsRemaining: room.pelletsRemaining,
      powerPelletActive: room.powerPelletActive,
      powerPelletTimer: room.powerPelletTimer,
      gameTimer: room.gameTimer,
      spectatorCount: room.spectators.size,
      highScore: room.highScore
    };
  }

  leaveRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (room.players[playerId]) {
      delete room.players[playerId];
      // End game if no players left
      if (Object.keys(room.players).length === 0) {
        room.gameState = 'finished';
      }
    }

    room.spectators.delete(playerId);
    return true;
  }

  cleanupRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (Object.keys(room.players).length === 0 && room.spectators.size === 0) {
      this.rooms.delete(roomId);
      return true;
    }
    return false;
  }
}

module.exports = new PacmanGame();