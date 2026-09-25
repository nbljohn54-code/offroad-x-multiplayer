# NBLJOHN GAME — Internet Multiplayer Relay

This version changes the multiplayer transport from direct browser-to-browser PeerJS connections to a small WebSocket room relay. That means players can join the same room from different internet connections instead of depending on a direct WebRTC path.

## Files
- `index.html` — the game with internet multiplayer support.
- `server.js` — the room relay server.
- `package.json` — Node dependency/start command.

## Deploy
1. Put these three files in a GitHub repository.
2. Create a Node web service on your hosting provider and use the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Copy the public HTTPS service address.
6. In `index.html`, replace `https://YOUR-RENDER-APP.onrender.com` in `WS_RELAY_URL` with the service address, changing `https://` to `wss://`.

The game then uses six-character room codes. The server supports up to 8 players per room.

## Important
The relay is only the signaling/game-message transport. Keep the server running while players are using multiplayer.
