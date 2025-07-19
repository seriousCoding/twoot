

1. Use email/password authentication for all users.
2. Use PostgreSQL for all data persistence, not MongoDB.
3. All configuration (ports, URLs, secrets) must be via `.env` only, with no hardcoded values anywhere.
4. Scaffold a React frontend and Node.js/Express backend.
5. Remove all MongoDB/Mongoose code and references from the backend.
6. Ensure all backend and frontend ports, URLs, and secrets are set via `.env` only.
7. Implement vibrant, kid-friendly Material-UI design with z-axis/shadow effects throughout the frontend.
8. Implement real-time messaging (chat) with Socket.io.
9. Implement real-time drawing (collaborative canvas) with Socket.io.
10. Implement real-time video chat (FaceTime/Google Meet style) using WebRTC.
11. Implement a main dashboard/menu for navigation between features and games.
12. Implement the game "Code & Seek" (2D Hide and Seek) with backend Socket.io game logic, state, events, and frontend Phaser.js, socket.io-client, and UI.
13. Implement the game "Pixel Farm Tycoon" (multiplayer farming sim with CRUD, state management, backend logic, and full integration with .env config only).
14. Implement the game "Code & Conquer" (strategy board game with code snippets as commands, scripting AI, and full integration with .env config only).
15. Implement the game "Chat & Draw" (multiplayer Pictionary with Canvas API, WebSockets, timers, and full integration with .env config only).
16. Implement the game "Dungeon Builders" (cooperative roguelike with procedural dungeons, Unity/Godot integration, and full .env config).
17. Implement the game "Code Racer" (typing/logic game with Monaco Editor, code to move car, and full .env config integration).
18. Implement the game "Turtle Arena" (competitive logic game with programmable turtles, algorithms, and full .env config integration).
19. Implement the game "Memory Duel" (multiplayer memory card game with twist powers, arrays, DOM events, and full .env config integration).
20. Implement the game "AI Pet Battlers" (turn-based monster battler with programmable pets, OOP, and full .env config integration).
21. Implement the game "Craft & Trade" (text-based economy sim with chat interface, Node.js backend, and full .env config integration).
22. Document every change so that any breakage can be fixed.
23. Nothing is optional unless explicitly stated by the user.
24. Never go outside the scope of explicit instructions.
25. Never stop until all steps are complete and production-ready. 

Set up environment and configuration: ensure all ports, URLs, and secrets are set via .env only (no hardcoded values).
Remove all MongoDB/Mongoose code and dependencies.
Ensure PostgreSQL is the only database used for persistent data.
Implement email/password registration and login (JWT, bcrypt).
Seed admin user.
Store user data securely in PostgreSQL.
Use Material-UI with custom theme (vibrant, z-axis, shadows).
Create reusable UI components (Card, Button, NavBar).
Implement dashboard with navigation for all features.
Integrate Socket.io for all real-time features.
Ensure all users can control the app from their client.
Create backend game controller for Code & Seek (backend/games/codeSeek.js).
Integrate Code & Seek with Socket.io (backend/socket.js).
Create frontend game page for Code & Seek (frontend/src/pages/CodeSeek.tsx).
Add Code & Seek route to app (frontend/src/App.tsx).
Add player sprites to public/ for Code & Seek.
Create backend game controller for Pixel Farm Tycoon (backend/games/pixelFarmTycoon.js).
Integrate Pixel Farm Tycoon with Socket.io (backend/socket.js).
Create frontend game page for Pixel Farm Tycoon (frontend/src/pages/PixelFarmTycoon.tsx).
Add Pixel Farm Tycoon route to app (frontend/src/App.tsx).
Create backend game controller for Code & Conquer (backend/games/codeConquer.js).
Integrate Code & Conquer with Socket.io (backend/socket.js).
Create frontend game page for Code & Conquer (frontend/src/pages/CodeConquer.tsx).
Add Code & Conquer route to app (frontend/src/App.tsx).
Create backend game controller for Chat & Draw (backend/games/chatDraw.js).
Integrate Chat & Draw with Socket.io (backend/socket.js).
Create frontend game page for Chat & Draw (frontend/src/pages/ChatDraw.tsx).
Add Chat & Draw route to app (frontend/src/App.tsx).
Create backend game controller for Dungeon Builders (backend/games/dungeonBuilders.js).
Integrate Dungeon Builders with Socket.io (backend/socket.js).
Create frontend game page for Dungeon Builders (frontend/src/pages/DungeonBuilders.tsx).
Add Dungeon Builders route to app (frontend/src/App.tsx).
Create backend game controller for Code Racer (backend/games/codeRacer.js).
Integrate Code Racer with Socket.io (backend/socket.js).
Create frontend game page for Code Racer (frontend/src/pages/CodeRacer.tsx).
Add Code Racer route to app (frontend/src/App.tsx).
Create backend game controller for Turtle Arena (backend/games/turtleArena.js).
Integrate Turtle Arena with Socket.io (backend/socket.js).
Create frontend game page for Turtle Arena (frontend/src/pages/TurtleArena.tsx).
Add Turtle Arena route to app (frontend/src/App.tsx).
Create backend game controller for Memory Duel (backend/games/memoryDuel.js).
Integrate Memory Duel with Socket.io (backend/socket.js).
Create frontend game page for Memory Duel (frontend/src/pages/MemoryDuel.tsx).
Add Memory Duel route to app (frontend/src/App.tsx).
Create backend game controller for AI Pet Battlers (backend/games/aiPetBattlers.js).
Integrate AI Pet Battlers with Socket.io (backend/socket.js).
Create frontend game page for AI Pet Battlers (frontend/src/pages/AIPetBattlers.tsx).
Add AI Pet Battlers route to app (frontend/src/App.tsx).
Create backend game controller for Craft & Trade (backend/games/craftTrade.js).
Integrate Craft & Trade with Socket.io (backend/socket.js).
Create frontend game page for Craft & Trade (frontend/src/pages/CraftTrade.tsx).
Add Craft & Trade route to app (frontend/src/App.tsx).
Integrate WebRTC for video calls.
Use Socket.io for video call signaling.
Add frontend video call page and UI.
Implement collaborative drawing board.
Ensure all features are accessible to all users (no host lock-in).
Document all code and features before/after changes.
Ensure all code is production-ready, secure, and robust.