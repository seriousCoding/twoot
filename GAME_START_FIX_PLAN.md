# Game Start Fix Plan

## Problem
- Games (e.g., Chess, Pacman) are integrated into the dashboard and can be launched via GameLauncher, but do not start immediately or require a second click on a Start button.
- Game logic (single player, multiplayer, AI) may not initialize correctly from dashboard navigation.
- Multiplayer/AI games may not auto-join or auto-create rooms as expected.

## Goal
- When a user clicks "Start Game" in the GameLauncher, the game should start immediately in the correct mode, without requiring a second click.
- The game page should handle the query params and start the game logic (single, multiplayer, AI) as soon as it loads.
- The UI should update to show the game board and controls immediately.

## Steps
1. **Audit GameLauncher navigation:**
   - GameLauncher navigates to the game page with query params (e.g., `/chess?mode=single&player=...`).
   - The game page should read these params and start the game accordingly.
2. **Fix Chess.tsx:**
   - On mount, if `mode` param is present, immediately start the game in the correct mode (single, multiplayer, AI).
   - If multiplayer/AI and no room is specified, generate a new room and auto-join.
   - Only show the setup dialog if no params are present.
3. **Fix Pacman.tsx:**
   - On mount, if `mode` param is present, immediately start the game in the correct mode.
   - If multiplayer and no room is specified, generate a new room and auto-join.
   - Only show the setup dialog if no params are present.
4. **Test and verify:**
   - Launch games from the dashboard and verify that the game starts immediately in the correct mode.
   - Ensure the UI updates and the game logic works (single, multiplayer, AI).
5. **Repeat for other games as needed.**

## Implementation Notes
- Use `useEffect` to read query params and trigger game start logic on mount.
- For multiplayer, if no room is specified, generate a random room ID and auto-join.
- Reset game state on navigation to ensure a fresh game each time.
- Remove unnecessary setup dialogs when params are present. 