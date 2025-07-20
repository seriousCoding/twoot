# Game Repair Plan - Chess and Pacman Movement Issues

## Problem Analysis
1. **Chess pieces don't move**: The chess game is properly structured but there are socket integration issues
2. **Ghosts don't move**: The pacman game has the same socket integration problems
3. **Backend crash loop**: Port 9000 is constantly in use, preventing proper testing

## Root Causes Identified
1. **Socket Integration Mismatch**: The socket.js file expects games to have a `handler` property, but chess and pacman export instances directly
2. **Missing Game Loop**: Pacman needs a continuous game loop to update ghost positions
3. **Action Handling**: The frontend actions aren't being properly routed to the game logic

## Solution Plan

### Phase 1: Fix Socket Integration
1. **Update socket.js** to properly handle chess and pacman games
2. **Standardize game interface** across all games
3. **Fix action routing** for move events

### Phase 2: Implement Game Logic
1. **Chess**: Ensure move validation and piece movement work
2. **Pacman**: Implement continuous ghost movement and player controls
3. **Add proper game state updates**

### Phase 3: Testing and Validation
1. **Test chess piece movement**
2. **Test pacman ghost movement**
3. **Verify socket communication**

## Implementation Steps

### Step 1: Fix socket.js Integration
- Update the games array to properly reference chess and pacman
- Fix the action handling to work with both class-based and module-based games
- Ensure proper room state emission

### Step 2: Fix Chess Game
- Verify move validation works
- Ensure piece movement updates the board state
- Test AI moves if enabled

### Step 3: Fix Pacman Game
- Ensure game loop runs continuously
- Fix ghost movement algorithms
- Verify player movement controls

### Step 4: Test Integration
- Start backend without port conflicts
- Test both games through the frontend
- Verify real-time updates work

## Expected Outcome
- Chess pieces should move when valid moves are made
- Pacman ghosts should move continuously with proper AI
- Both games should update in real-time via socket.io
- No more backend crashes or port conflicts 