const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const MAX_PLAYERS = 8;
const rooms = new Map();

function makeId() {
  return crypto.randomBytes(6).toString('hex');
}
function cleanName(v) {
  return String(v || 'Player').replace(/[^a-zA-Z0-9 _-]/g, '').slice(0,18) || 'Player';
}
function cleanRoom(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
}

const httpServer = http.createServer((req,res)=>{
  res.writeHead(200, {'content-type':'text/plain; charset=utf-8'});
  res.end('NBLJOHN GAME multiplayer relay is online.');
});
const wss = new WebSocketServer({server:httpServer});

function send(ws, packet) {
  if (ws.readyState === 1) ws.send(JSON.stringify(packet));
}
function broadcast(room, packet, except=null) {
  for (const p of room.players.values()) if (p.ws !== except) send(p.ws, packet);
}
function removePlayer(p) {
  const room = rooms.get(p.room);
  if (!room) return;
  room.players.delete(p.id);
  broadcast(room, {kind:'player-left', id:p.id, name:p.name});
  if (p.host) {
    for (const other of room.players.values()) {
      send(other.ws, {kind:'room-closed', message:'The host closed the server.'});
      try { other.ws.close(); } catch {}
    }
    rooms.delete(p.room);
  } else if (room.players.size === 0) {
    rooms.delete(p.room);
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const roomCode = cleanRoom(url.searchParams.get('room'));
  const name = cleanName(url.searchParams.get('name'));
  const wantsHost = url.searchParams.get('host') === '1';

  if (!roomCode) {
    send(ws, {kind:'error', message:'Missing server code.'});
    ws.close(); return;
  }

  let room = rooms.get(roomCode);
  if (wantsHost) {
    if (room) {
      send(ws, {kind:'error', message:'That server code is already in use. Create another server.'});
      ws.close(); return;
    }
    room = {hostId:null, players:new Map()};
    rooms.set(roomCode, room);
  } else if (!room) {
    send(ws, {kind:'error', message:'Server not found. Check the code and try again.'});
    ws.close(); return;
  }

  if (room.players.size >= MAX_PLAYERS) {
    send(ws, {kind:'error', message:'This server is full.'});
    ws.close(); return;
  }
  if (wantsHost && room.hostId) {
    send(ws, {kind:'error', message:'This server already has a host.'});
    ws.close(); return;
  }

  const p = {id:makeId(), ws, room:roomCode, name, host:wantsHost};
  room.players.set(p.id,p);
  if (wantsHost) room.hostId=p.id;
  ws._player=p;

  send(ws, {kind:'welcome', id:p.id, players:[...room.players.values()].map(x=>({id:x.id,name:x.name,host:x.host}))});
  broadcast(room, {kind:'player-joined', player:{id:p.id,name:p.name,host:p.host}}, ws);

  ws.on('message', raw => {
    let packet;
    try { packet=JSON.parse(raw.toString()); } catch { return; }
    if (!packet || typeof packet !== 'object') return;

    if (packet.type === 'close-room') {
      if (!p.host) return;
      for (const other of room.players.values()) {
        if (other.id !== p.id) {
          send(other.ws, {kind:'room-closed', message:'The host disbanded the server.'});
          try { other.ws.close(); } catch {}
        }
      }
      rooms.delete(p.room);
      try { ws.close(); } catch {}
      return;
    } else if (packet.type === 'broadcast') {
      broadcast(room, {kind:'broadcast', from:p.id, data:packet.data}, ws);
    } else if (packet.type === 'target') {
      const target=room.players.get(String(packet.target||''));
      if (target) send(target.ws, {kind:'target', from:p.id, data:packet.data});
    }
  });

  ws.on('close', () => removePlayer(p));
  ws.on('error', () => {});
});

httpServer.listen(PORT, () => console.log(`NBLJOHN relay listening on ${PORT}`));
