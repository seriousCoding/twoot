# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Test Commands (ALWAYS RUN AFTER MAKING CHANGES)
- `npm test` - Complete test: build + start server for 10 seconds to verify changes work
- `npm run test:quick` - Quick test: build only to check for compilation errors  
- `npm run build:all` - Build both frontend and backend for production

**IMPORTANT**: Always run `npm test` or `npm run test:quick` after making ANY changes to verify the code still works correctly. This ensures we catch build errors and runtime issues immediately.

### Development Principles
- Always test the goddamn app. No matter what change gets made
- App should always be running after any changes

### Development
- `npm run dev` - Start both frontend and backend in development mode (uses concurrently)
- `npm install` - Install dependencies for root, backend, and frontend

### Frontend (React TypeScript)
- `cd frontend && npm start` - Start React development server on port 3000
- `cd frontend && npm run build` - Build React app for production
- `cd frontend && npm test` - Run React tests using Jest and React Testing Library

### Backend (Express.js)
- `cd backend && npm run dev` - Start backend with nodemon (auto-restart)
- `cd backend && npm start` - Start backend in production mode
- `cd backend && npm run start:prod` - Start backend in production mode

### Database
- `npm run seed` - Seed database with admin user (run from backend directory)
- Database migrations are in `backend/migrations/`

### Production
- `npm run build:all` - Build both frontend and backend for production

## Architecture

### Project Structure
- **Monorepo**: Root package.json orchestrates frontend and backend
- **Frontend**: React TypeScript app in `frontend/` directory
- **Backend**: Express.js API in `backend/` directory
- **Database**: PostgreSQL with Knex.js migrations and query builder

### Frontend Architecture
- **Framework**: React 19 with TypeScript
- **Routing**: React Router DOM v7
- **UI Framework**: Material-UI (MUI) v7 with custom theme
- **State Management**: React Context for authentication
- **Games**: Phaser.js for game development (Chess, Pacman, etc.)
- **Pages**: Login, Register, Dashboard, and various game pages (Chat, Chess, CodeSeek, Draw, Video, Pacman)

### Backend Architecture
- **Framework**: Express.js with standard middleware (helmet, cors, morgan)
- **Database**: PostgreSQL with Knex.js for migrations and queries
- **Authentication**: JWT tokens with bcryptjs for password hashing
- **Real-time**: Socket.io for real-time features
- **Environment**: dotenv for configuration management
- **Security**: Helmet for security headers, CORS configured for frontend origin

### Key Features
- **Authentication**: Email/password with JWT tokens stored in localStorage
- **Real-time Communication**: Video, audio, and text chat
- **Games**: Chess, Code & Seek, collaborative drawing, Pacman
- **Family-friendly**: Kid-friendly UI and secure communication

### Environment Configuration
- Uses `.env` files for environment variables
- Database connection via `DATABASE_URL` or individual PostgreSQL config variables
- `CLIENT_ORIGIN` for CORS configuration
- Production mode serves frontend build from backend

### Database Schema
- Users table with email/password authentication
- Migrations managed through Knex.js
- Seed file creates admin user for initial setup