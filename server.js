// BASTION Authoritative 1v1 LAN WebSocket Game Server (Clean ES Module)
import http from 'http';
import os from 'os';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 8080;

// Discover Local IPv4 LAN Address
function getLocalLANIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const LAN_IP = getLocalLANIP();

// HTTP Server with CORS & LAN info endpoint
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/lan-info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      lanIp: LAN_IP,
      clientPort: 5173,
      serverPort: PORT,
      lanUrl: `http://${LAN_IP}:5173`,
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'BASTION 1v1 LAN Server Active',
    lanIp: LAN_IP,
    port: PORT,
  }));
});

const wss = new WebSocketServer({ server });

const rooms = new Map();

wss.on('connection', (ws) => {
  let playerRoomCode = null;
  let playerRole = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'JOIN_ROOM') {
        const { roomCode, isHost } = msg;
        playerRoomCode = roomCode;

        let room = rooms.get(roomCode);
        if (!room) {
          room = {
            code: roomCode,
            p1: null,
            p2: null,
            p1Army: [],
            p2Army: [],
            p1Locked: false,
            p2Locked: false,
            phase: 'LOBBY',
          };
          rooms.set(roomCode, room);
        }

        // Assign role
        if (isHost || !room.p1) {
          playerRole = 'p1';
          room.p1 = ws;
        } else if (!room.p2) {
          playerRole = 'p2';
          room.p2 = ws;
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is already full with 2 commanders!' }));
          return;
        }

        ws.send(JSON.stringify({
          type: 'JOINED_SUCCESS',
          role: playerRole,
          roomCode,
          lanIp: LAN_IP,
        }));

        console.log(`[LAN Match] Player joined room "${roomCode}" as ${playerRole.toUpperCase()}`);

        // Broadcast to existing host that Player 2 arrived
        if (room.p1 && room.p2) {
          room.phase = 'ARMY_SELECTION';
          const matchStartPayload = JSON.stringify({
            type: 'MATCH_START',
            roomCode,
            p1Name: 'Commander 1 (Blue HQ)',
            p2Name: 'Commander 2 (Red HQ)',
          });
          room.p1.send(matchStartPayload);
          room.p2.send(matchStartPayload);
          console.log(`[LAN Match] Both commanders connected in room "${roomCode}". Starting Army Selection!`);
        } else if (room.p1 && !room.p2) {
          room.p1.send(JSON.stringify({
            type: 'WAITING_FOR_OPPONENT',
            roomCode,
            lanUrl: `http://${LAN_IP}:5173`,
          }));
        }
      } else if (msg.type === 'LOCK_ARMY') {
        const room = rooms.get(playerRoomCode);
        if (room) {
          if (playerRole === 'p1') {
            room.p1Army = msg.army;
            room.p1Locked = true;
          } else if (playerRole === 'p2') {
            room.p2Army = msg.army;
            room.p2Locked = true;
          }

          // If both have locked their composition
          if (room.p1Locked && room.p2Locked) {
            room.phase = 'BATTLE_PREP';
            const prepPayload = JSON.stringify({
              type: 'START_BATTLE_PREP',
              p1Army: room.p1Army,
              p2Army: room.p2Army,
            });
            room.p1?.send(prepPayload);
            room.p2?.send(prepPayload);
            console.log(`[LAN Match] Both players locked armies in room "${playerRoomCode}". 3s countdown!`);
          }
        }
      } else if (msg.type === 'DEPLOY_UNIT') {
        const room = rooms.get(playerRoomCode);
        if (room) {
          const deployBroadcast = JSON.stringify({
            type: 'UNIT_DEPLOYED',
            owner: playerRole,
            unitClass: msg.unitClass,
            x: msg.x,
            y: msg.y,
          });
          room.p1?.send(deployBroadcast);
          room.p2?.send(deployBroadcast);
        }
      } else if (msg.type === 'UNIT_COMMAND') {
        const room = rooms.get(playerRoomCode);
        if (room) {
          const opponent = playerRole === 'p1' ? room.p2 : room.p1;
          opponent?.send(JSON.stringify({
            type: 'REMOTE_COMMAND',
            owner: playerRole,
            command: msg.command,
          }));
        }
      } else if (msg.type === 'REMATCH_VOTE') {
        const room = rooms.get(playerRoomCode);
        if (room) {
          const opponent = playerRole === 'p1' ? room.p2 : room.p1;
          opponent?.send(JSON.stringify({ type: 'OPPONENT_REQUESTED_REMATCH' }));
        }
      }
    } catch (err) {
      console.error('[LAN Server Error]', err);
    }
  });

  ws.on('close', () => {
    if (playerRoomCode) {
      const room = rooms.get(playerRoomCode);
      if (room) {
        if (room.p1 === ws) room.p1 = null;
        if (room.p2 === ws) room.p2 = null;
        const opponent = room.p1 || room.p2;
        opponent?.send(JSON.stringify({
          type: 'OPPONENT_DISCONNECTED',
          message: 'Opponent disconnected from local match.',
        }));
        if (!room.p1 && !room.p2) {
          rooms.delete(playerRoomCode);
        }
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(`🛡️  BASTION 1v1 LAN Server Online!`);
  console.log(`📡 Local Port: ${PORT}`);
  console.log(`🌐 LAN Address: http://${LAN_IP}:5173`);
  console.log(`👉 Tell your friend on the other PC to visit:`);
  console.log(`   http://${LAN_IP}:5173`);
  console.log(`=================================================\n`);
});
