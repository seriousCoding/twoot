# Plan: Fix Games UI Not Working

## 1. Problem Statement
- The games in the app have user interfaces, but the gameplay does not function (e.g., no response to user actions, no game logic, or no multiplayer interaction).

## 2. Initial Hypotheses
- Possible missing or broken connection between frontend and backend (API or WebSocket).
- Game logic may not be triggered or is not implemented.
- Backend endpoints or socket events may be missing or not wired up.
- State/context in frontend may not be updating as expected.

## 3. Research Steps

### 3.1 Frontend Findings
- Most games use Socket.IO for real-time communication, connecting to a specific namespace (e.g., `/pacman`, `/chess`, `/memory-duel`).
- The frontend emits events like `join`, `move`, `start`, `attack`, etc., and listens for events like `state`, `gameState`, `move`, `gameOver`, etc.
- Game state is updated via socket events from the backend.
- On joining a game, the frontend emits a `join` event with player info and room.
- User actions are sent to the backend via socket events.

### 3.2 Backend Findings
- The backend sets up a namespace for each game and listens for events like `join`, `move`, etc.
- The backend emits events like `joined`, `gameUpdate`, etc.
- **Critical mismatch:** Event names and payloads do not match between frontend and backend (e.g., frontend expects `gameState`, backend emits `gameUpdate`).
- **Payload structure mismatch:** Frontend emits just the direction string for `move`, backend expects an object with `roomId` and `direction`.

## 4. Root Cause
- **Frontend and backend are not using the same event names or payload structures.**
- This prevents the games from working, even though the UI loads and sockets connect.

## 5. Action Plan
1. Align event names and payloads between frontend and backend for all games (starting with Pacman).
2. Update either the frontend or backend so that:
   - The frontend emits the correct payloads (`{ roomId, playerName }` for join, `{ roomId, direction }` for move).
   - The backend emits the events the frontend expects (`gameState`, `playerAssigned`, etc.).
3. Test after making these changes.

## 6. Testing
- Test all games for correct gameplay and multiplayer functionality.
- Fix any errors until all games work as intended.

---

*Next: Implement code changes to align event names and payloads for Pacman game, then test and repeat for other games.* 