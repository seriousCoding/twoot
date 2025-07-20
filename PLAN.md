# Plan to Fix Unplayable Games

This document outlines the step-by-step plan to diagnose and fix the issues preventing the games from being playable. The primary goal is to stabilize the backend, resolve database errors, and ensure all game logic functions correctly.

## 1. Stabilize the Backend Server

The immediate priority is to stop the backend server from crashing. The root cause appears to be a duplicate namespace declaration for `codeRacerNamespace` in `backend/socket.js`.

- **Action:** Read `backend/socket.js` to get its latest content.
- **Action:** Completely remove all code related to the "Code Racer" game from `backend/socket.js`. This will isolate the problem and allow the server to run stably, enabling me to work on the other games.
- **Verification:** Start the backend server and ensure it runs without crashing.

## 2. Run Integration Tests to Isolate Failures

With a stable backend, I can use the existing integration tests to identify the remaining issues for other games.

- **Action:** Execute the `test/socket_integration.test.js` suite.
- **Analysis:** Review the test results to see which games are failing and why. I expect the "Code Racer" tests to fail (as the code is removed), but I need to see the status of Pacman, Chess, and Memory Duel.

## 3. Resolve Database Errors

The logs indicate errors related to incorrect database column names and query methods.

- **Action:** List the contents of the `backend/data` or a similar directory to find the database schema or migration files. This will give me the correct column names.
- **Action:** Read `backend/controllers/friendsController.js` and `backend/controllers/messagesController.js`.
- **Action:** Correct the invalid database queries (e.g., fix `orJoin` and update column names like `user1_id`).
- **Verification:** Rerun the integration tests and check the application logs to ensure database errors are gone.

## 4. Fix Game Logic (Per-Game Basis)

Once the backend is stable and database queries are fixed, I will address the gameplay logic for each game.

- **Action:** Starting with Pacman, I will analyze the frontend/backend event handlers to ensure they align correctly.
- **Action:** I will fix the event names, payloads, and game state logic in the respective game files (`backend/games/*.js`) and in `backend/socket.js`.
- **Verification:** I will incrementally update and run the integration tests for each game until they pass, confirming the game logic is working as expected. I will repeat this process for Chess and Memory Duel.

## 5. Re-introduce Code Racer (Stretch Goal)

If all other games are successfully fixed and tested, I will attempt to re-integrate the Code Racer game.

- **Action:** Carefully add the Code Racer namespace and logic back into `backend/socket.js`, ensuring there are no duplicate declarations.
- **Verification:** Create specific integration tests for Code Racer and ensure they pass without destabilizing the backend.

By following this plan, I will systematically resolve the issues and restore functionality to all the games. 