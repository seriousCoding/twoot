# Full Game Integration & Build Plan

## Problems
- Games do not start or join correctly from the dashboard.
- Most games do not read query params for mode, room, or player.
- Users must manually enter info and click multiple times to start a game.
- UI does not update to show the game board immediately after launch.

## Goals
- All games (Chess, Pacman, MemoryDuel, CodeRacer, AI Pet Battlers, TurtleArena, etc.) must:
  - Read query params (`mode`, `room`, `player`) on mount.
  - Auto-start in the correct mode (single, multiplayer, AI) if params are present.
  - Auto-generate and join a room for multiplayer/AI if not provided.
  - Only show setup dialog if no params are present.
  - Reset game state on navigation.
  - Update UI to show the game board and controls immediately after launch.
- GameLauncher must always generate a room for multiplayer/AI if not provided, and pass all params in the URL.
- All games must be accessible from the dashboard and launch directly into a working game.

## Steps
1. **Frontend Game Page Refactor**
   - For each game page:
     - Read query params on mount.
     - If params are present, auto-start/join the game in the correct mode.
     - If no params, show setup dialog.
     - Reset game state on navigation.
     - Handle all socket events and update UI.
2. **GameLauncher Consistency**
   - Always generate a room for multiplayer/AI if not provided.
   - Always pass player name and mode in the URL.
3. **UI Integration**
   - All games must be accessible from the dashboard and launch directly into a working game.
   - UI must update to show the game board and controls immediately after launch.
4. **Testing**
   - Test each game from the dashboard in all modes (single, multiplayer, AI).
   - Fix any errors or missing features.

## Implementation Order
1. Refactor MemoryDuel as a template for other games.
2. Apply the same pattern to CodeRacer, AI Pet Battlers, TurtleArena, etc.
3. Test and verify all games from the dashboard.
4. Fix any remaining issues. 