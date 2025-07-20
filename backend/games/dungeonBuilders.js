const { v4: uuidv4 } = require('uuid');

class DungeonBuildersGame {
  constructor() {
    this.games = {};
  }

  createGame(roomId) {
    const game = {
      players: {}, // socketId -> { nickname, x, y, hp, maxHp, level, exp, inventory, stats }
      dungeon: this.generateDungeon(),
      monsters: {},
      items: {},
      started: false,
      turn: null,
      round: 1,
      gamePhase: 'exploration', // exploration, combat, building
      actionPoints: {},
      gameArea: { width: 20, height: 20 },
      difficulty: 1,
      bossSpawned: false,
      winner: null
    };
    this.games[roomId] = game;
    return game;
  }

  generateDungeon() {
    const width = 20;
    const height = 20;
    const grid = Array(height).fill(null).map(() => Array(width).fill(0));
    
    // Generate walls (1) and floors (0)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        grid[y][x] = 1;
      }
    }
    
    const rooms = [];
    const roomCount = Math.floor(Math.random() * 8) + 6;
    
    for (let i = 0; i < roomCount; i++) {
      const roomWidth = Math.floor(Math.random() * 6) + 4;
      const roomHeight = Math.floor(Math.random() * 6) + 4;
      const x = Math.floor(Math.random() * (width - roomWidth - 2)) + 1;
      const y = Math.floor(Math.random() * (height - roomHeight - 2)) + 1;
      
      for (let ry = y; ry < y + roomHeight; ry++) {
        for (let rx = x; rx < x + roomWidth; rx++) {
          if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
            grid[ry][rx] = 0;
          }
        }
      }
      rooms.push({ x, y, width: roomWidth, height: roomHeight });
    }
    
    for (let i = 0; i < rooms.length - 1; i++) {
      const startX = Math.floor(rooms[i].x + rooms[i].width / 2);
      const startY = Math.floor(rooms[i].y + rooms[i].height / 2);
      const endX = Math.floor(rooms[i + 1].x + rooms[i + 1].width / 2);
      const endY = Math.floor(rooms[i + 1].y + rooms[i + 1].height / 2);
      
      for (let x = Math.min(startX, endX); x <= Math.max(startX, endX); x++) {
        if (x >= 0 && x < width && startY >= 0 && startY < height) grid[startY][x] = 0;
      }
      for (let y = Math.min(startY, endY); y <= Math.max(startY, endY); y++) {
        if (endX >= 0 && endX < width && y >= 0 && y < height) grid[y][endX] = 0;
      }
    }
    
    return {
      grid, rooms, width, height,
      startRoom: rooms[0] || { x: 1, y: 1, width: 3, height: 3 },
      endRoom: rooms[rooms.length - 1] || { x: width - 4, y: height - 4, width: 3, height: 3 }
    };
  }

  spawnMonsters(game) {
    const monsterCount = Math.floor(Math.random() * 15) + 10;
    const monsterTypes = [
      { type: 'goblin', hp: 3, attack: 2, defense: 1, exp: 10, loot: ['coin', 'dagger'] },
      { type: 'orc', hp: 6, attack: 4, defense: 2, exp: 20, loot: ['coin', 'sword', 'shield'] }
    ];
    
    for (let i = 0; i < monsterCount; i++) {
      let x, y, attempts = 0;
      do {
        x = Math.floor(Math.random() * game.dungeon.width);
        y = Math.floor(Math.random() * game.dungeon.height);
        attempts++;
      } while ((game.dungeon.grid[y][x] !== 0 || this.isOccupied(game, x, y)) && attempts < 100);
      
      if (attempts < 100) {
        const template = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
        const monster = { id: uuidv4(), x, y, ...template, maxHp: template.hp, alive: true };
        game.monsters[monster.id] = monster;
      }
    }
  }

  spawnItems(game) {
    const itemCount = Math.floor(Math.random() * 20) + 15;
    const itemTypes = [
      { type: 'healing_potion', effect: 'heal', value: 5 },
      { type: 'sword', effect: 'attack', value: 3 }
    ];
    
    for (let i = 0; i < itemCount; i++) {
      let x, y, attempts = 0;
      do {
        x = Math.floor(Math.random() * game.dungeon.width);
        y = Math.floor(Math.random() * game.dungeon.height);
        attempts++;
      } while ((game.dungeon.grid[y][x] !== 0 || this.isOccupied(game, x, y)) && attempts < 100);
      
      if (attempts < 100) {
        const template = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        const item = { id: uuidv4(), x, y, ...template, collected: false };
        game.items[item.id] = item;
      }
    }
  }

  isOccupied(game, x, y) {
    const playerHere = Object.values(game.players).some(p => p.x === x && p.y === y);
    const monsterHere = Object.values(game.monsters).some(m => m.alive && m.x === x && m.y === y);
    return playerHere || monsterHere;
  }

  joinGame(socket, playerName, roomId) {
    let game = this.games[roomId];
    if (!game) game = this.createGame(roomId);
    
    if (Object.keys(game.players).length >= 4) return game;
    
    const startRoom = game.dungeon.startRoom;
    const startX = startRoom.x + Math.floor(startRoom.width / 2);
    const startY = startRoom.y + Math.floor(startRoom.height / 2);
    
    game.players[socket.id] = {
      id: socket.id, nickname: playerName, x: startX, y: startY,
      hp: 10, maxHp: 10, level: 1, exp: 0, expToNext: 50, inventory: [],
      stats: { attack: 2, defense: 1, speed: 1 },
      actionPoints: 3, alive: true, gold: 0
    };
    
    if (Object.keys(game.players).length >= 2 && !game.started) {
      this.startGame(roomId);
    }
    
    return game;
  }

  handleAction(roomId, playerId, data) {
    switch(data.type) {
        case 'move':
            return this.movePlayer(playerId, roomId, data.dx, data.dy);
        case 'attack':
            return this.attackMonster(playerId, roomId, data.monsterId);
        case 'useItem':
            return this.useItem(playerId, roomId, data.itemId);
        default:
            return this.games[roomId];
    }
  }

  getRoomState(roomId) {
      const game = this.games[roomId];
      if (!game) return null;
      return {
          players: game.players,
          dungeon: game.dungeon.grid,
          monsters: game.monsters,
          items: game.items,
          turn: game.turn,
          gamePhase: game.gamePhase
      };
  }

  leaveRoom(roomId, playerId) {
    const game = this.games[roomId];
    if (game && game.players[playerId]) {
        delete game.players[playerId];
        if (game.turn === playerId) {
            this.nextTurn(roomId);
        }
    }
  }

  cleanupRoom(roomId) {
      const game = this.games[roomId];
      if (game && Object.keys(game.players).length === 0) {
          delete this.games[roomId];
      }
  }

  startGame(roomId) {
    const game = this.games[roomId];
    if (!game || Object.keys(game.players).length < 2) return;
    
    this.spawnMonsters(game);
    this.spawnItems(game);
    
    game.started = true;
    game.turn = Object.keys(game.players)[0];
  }

  movePlayer(playerId, roomId, dx, dy) {
    const game = this.games[roomId];
    const player = game.players[playerId];
    if (!game || !player || !player.alive || game.turn !== playerId) return;

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < game.dungeon.width && newY >= 0 && newY < game.dungeon.height && game.dungeon.grid[newY][newX] === 0) {
        player.x = newX;
        player.y = newY;
        this.nextTurn(roomId);
    }
  }

  attackMonster(playerId, roomId, monsterId) {
    const game = this.games[roomId];
    const player = game.players[playerId];
    const monster = game.monsters[monsterId];
    if (!game || !player || !monster || !monster.alive || game.turn !== playerId) return;

    // Simplified combat
    monster.hp -= player.stats.attack;
    if (monster.hp <= 0) {
        monster.alive = false;
        player.exp += monster.exp;
    } else {
        player.hp -= monster.attack;
        if (player.hp <= 0) {
            player.alive = false;
        }
    }
    this.nextTurn(roomId);
  }

  useItem(playerId, roomId, itemId) {
    const game = this.games[roomId];
    const player = game.players[playerId];
    if (!game || !player || game.turn !== playerId) return;
    
    const itemIndex = player.inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    const item = player.inventory[itemIndex];
    if (item.effect === 'heal') {
        player.hp = Math.min(player.maxHp, player.hp + item.value);
    }
    player.inventory.splice(itemIndex, 1);
    this.nextTurn(roomId);
  }

  nextTurn(roomId) {
    const game = this.games[roomId];
    if (!game) return;
    const playerIds = Object.keys(game.players).filter(id => game.players[id].alive);
    if (playerIds.length === 0) {
        game.gamePhase = 'finished';
        return;
    }
    const currentIndex = playerIds.indexOf(game.turn);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    game.turn = playerIds[nextIndex];
  }
}

module.exports = new DungeonBuildersGame();