# Twoot

A vibrant, self-hosted, all-in-one communication and games app for families and kids.

## Features
- Video, audio, and text chat
- Real-time collaborative drawing
- Multiplayer games: Chess, Code & Seek, Pacman (placeholder)
- Kid-friendly, beautiful UI
- Secure email/password authentication

## Getting Started

### 1. Clone and Install
```sh
git clone <your-repo-url>
cd Twoot
npm install
```

### 2. Configure Environment
Copy the example env file and fill in your values:
```sh
cp .env.example .env
```

### 3. Seed the Database (Admin User)
```sh
npm run seed
```

### 4. Start in Development
```sh
npm run dev
```
This runs both backend and frontend together. The app will be available at http://localhost:3000

### 5. Build for Production
```sh
cd frontend && npm run build
cd ../backend && npm run start:prod
```

### 6. Docker (Optional)
```sh
docker-compose up --build
```

## Environment Variables
See `.env.example` for all required variables.

## Scripts
- `npm run dev` — Start frontend and backend together (development)
- `npm run seed` — Seed the database with admin user
- `npm run build` — Build frontend for production
- `npm run start:prod` — Start backend in production mode

## License
MIT 