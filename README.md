# 🎮 Twoot - Multiplayer Gaming Platform

A modern, real-time multiplayer gaming platform built with Node.js, React, and Socket.IO. Features multiple games, social features, and a robust backend system.

## 🌟 Features

### 🎯 Multiplayer Games
- **Chess** - Classic chess with real-time moves
- **Pacman** - Multiplayer Pacman with ghost interactions
- **CodeRacer** - Competitive coding challenges
- **CodeConquer** - Code-based strategy game
- **CodeSeek** - Code search and find game
- **MemoryDuel** - Memory matching game
- **TurtleArena** - Turtle racing game
- **PixelFarmTycoon** - Farming simulation
- **DungeonBuilders** - Dungeon building game
- **CraftTrade** - Crafting and trading game
- **AIPetBattlers** - AI pet battle system
- **ChatDraw** - Collaborative drawing game

### 👥 Social Features
- **Friends System** - Add, remove, and manage friends
- **Real-time Messaging** - Chat with friends and game players
- **Game Invites** - Send and receive game invitations
- **Game Rooms** - Create and join multiplayer game sessions
- **User Profiles** - View and manage user information

### 🛠 Technical Features
- **Real-time Communication** - Socket.IO for instant updates
- **Authentication System** - Secure user login and registration
- **Database Integration** - SQLite with Knex.js ORM
- **Responsive Design** - Modern UI with Tailwind CSS
- **TypeScript** - Type-safe frontend development
- **Modular Architecture** - Clean, maintainable code structure

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/seriousCoding/twoot.git
   cd twoot
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up the database**
   ```bash
   cd ../backend
   npm run migrate
   npm run seed
   ```

5. **Start the backend server**
   ```bash
   npm start
   ```

6. **Start the frontend development server**
   ```bash
   cd ../frontend
   npm start
   ```

7. **Open your browser**
   Navigate to `http://localhost:3000` to access the application.

## 📁 Project Structure

```
twoot/
├── backend/                 # Node.js/Express server
│   ├── controllers/         # Request handlers
│   ├── games/              # Game logic implementations
│   ├── middleware/          # Authentication middleware
│   ├── migrations/          # Database migrations
│   ├── models/             # Data models
│   ├── routes/             # API routes
│   ├── socket.js           # Socket.IO configuration
│   └── app.js              # Main server file
├── frontend/               # React/TypeScript application
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Page components
│   └── src/                # Source files
└── README.md               # This file
```

## 🎮 Available Games

### Chess
- Real-time multiplayer chess
- Move validation
- Game state synchronization

### Pacman
- Multiplayer Pacman with ghost interactions
- Power pellets and scoring
- Real-time player movement

### CodeRacer
- Competitive coding challenges
- Real-time code execution
- Leaderboard system

### MemoryDuel
- Memory matching game
- Multiplayer competition
- Score tracking

## 👥 Social Features

### Friends System
- Add and remove friends
- View friend status
- Send friend requests

### Messaging
- Real-time chat with friends
- Game-specific chat rooms
- Message history

### Game Invites
- Send invitations to friends
- Accept/decline game invites
- Notification system

## 🛠 Development

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm run migrate      # Run database migrations
npm run seed         # Seed database with sample data
```

### Frontend Development
```bash
cd frontend
npm start           # Start development server
npm run build       # Build for production
npm test            # Run tests
```

### Database
The application uses SQLite with Knex.js for database management:
- **Users table** - User accounts and authentication
- **Friends table** - Friend relationships
- **Messages table** - Chat messages
- **Game invites table** - Game invitations
- **Game rooms table** - Active game sessions

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the backend directory:
```env
PORT=3001
NODE_ENV=development
DB_PATH=./database.sqlite
JWT_SECRET=your-secret-key
```

### Socket.IO Events
The application uses Socket.IO for real-time communication:
- `join_room` - Join a game room
- `leave_room` - Leave a game room
- `game_move` - Send game moves
- `chat_message` - Send chat messages
- `friend_request` - Send friend requests

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Node.js](https://nodejs.org/)
- Frontend powered by [React](https://reactjs.org/) and [TypeScript](https://www.typescriptlang.org/)
- Real-time features with [Socket.IO](https://socket.io/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)
- Database management with [Knex.js](https://knexjs.org/)

## 📞 Support

If you have any questions or need help, please open an issue on GitHub or contact the development team.

---

**Happy Gaming! 🎮** 