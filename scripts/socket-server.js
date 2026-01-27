const http = require('http');
const { Server } = require('socket.io');
let createAdapter;
let createRedisClient;
try {
  // optional Redis adapter (install `redis` and `@socket.io/redis-adapter` in production)
  createAdapter = require('@socket.io/redis-adapter').createAdapter;
  createRedisClient = require('redis').createClient;
} catch (e) {
  // not installed in all environments; adapter is optional
}

const DEFAULT_PORT = 4000;

function portFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.port) return Number(u.port);
    return u.protocol === 'https:' ? 443 : 80;
  } catch (e) {
    return null;
  }
}

// Prefer platform PORT (e.g. Render sets PORT), then SOCKET_PORT, then NEXT_PUBLIC_SOCKET_URL, then default
const PORT = Number(process.env.PORT) || Number(process.env.SOCKET_PORT) || portFromUrl(process.env.NEXT_PUBLIC_SOCKET_URL) || DEFAULT_PORT;

const server = http.createServer(async (req, res) => {
  // health endpoint for platform health checks (support GET + HEAD and /healthz)
  if ((req.method === 'GET' || req.method === 'HEAD') && (req.url === '/' || req.url === '/health' || req.url === '/healthz')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // For HEAD requests, do not send a body
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // simple admin endpoint for server-side emits: POST /notify { userId, notification }
  if (req.method === 'POST' && req.url === '/notify') {
    try {
      // optional secret protection for admin endpoints
      const secret = process.env.SOCKET_SECRET;
      if (secret) {
        const provided = (req.headers['x-socket-secret'] || '') + '';
        if (provided !== secret) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'forbidden' }));
          return;
        }
      }
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsed = JSON.parse(body || '{}');
      const { userId, notification } = parsed;
      if (!userId || !notification) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'userId and notification required' }));
        return;
      }
      const sockets = userSockets.get(userId) || new Set();
      for (const sid of sockets) {
        const s = io.sockets.sockets.get(sid);
        if (s) s.emit('notification', notification);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'failed to emit notification' }));
      return;
    }
  }

  // admin endpoint to emit arbitrary socket events to a room: POST /emit { room, event, payload }
  if (req.method === 'POST' && req.url === '/emit') {
    try {
      // optional secret protection for admin endpoints
      const secret = process.env.SOCKET_SECRET;
      if (secret) {
        const provided = (req.headers['x-socket-secret'] || '') + '';
        if (provided !== secret) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'forbidden' }));
          return;
        }
      }
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsed = JSON.parse(body || '{}');
      const { room, event, payload } = parsed;
      if (!event) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'event required' }));
        return;
      }

      if (room) {
        io.to(room).emit(event, payload);
      } else {
        io.emit(event, payload);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'failed to emit event' }));
      return;
    }
  }
  // default: 404 for other requests
  res.writeHead(404);
  res.end();
});

function originsFromEnv() {
  const set = new Set();
  // add NEXTAUTH_URL (production) and NEXTAUTH_URL_DEVELOPMENT
  if (process.env.NEXTAUTH_URL) set.add(process.env.NEXTAUTH_URL.replace(/\/$/, ''));
  if (process.env.NEXTAUTH_URL_DEVELOPMENT) set.add(process.env.NEXTAUTH_URL_DEVELOPMENT.replace(/\/$/, ''));
  // add NEXT_PUBLIC_SOCKET_URL if present (client uses this)
  if (process.env.NEXT_PUBLIC_SOCKET_URL) set.add(process.env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, ''));
  // local dev defaults
  set.add('http://localhost:3000');
  set.add('http://127.0.0.1:3000');
  try { set.add(new URL(process.env.NEXTAUTH_URL || '').origin); } catch (e) {}
  return Array.from(set).filter(Boolean);
}

const io = new Server(server, {
  cors: { origin: originsFromEnv(), methods: ['GET', 'POST'] },
});

// If REDIS_URL is set and redis adapter is available, configure adapter so multiple
// socket server instances can share rooms and broadcasts.
(async () => {
  const url = process.env.REDIS_URL;
  if (url && createAdapter && createRedisClient) {
    try {
      const pubClient = createRedisClient({ url });
      const subClient = pubClient.duplicate();
      await pubClient.connect();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.IO Redis adapter configured');
    } catch (err) {
      console.error('Failed to configure Redis adapter:', err);
    }
  }
})();

// In-memory lobby state (lightweight sync). Keyed by `${teamId}::${puzzleId}`
const lobbies = new Map();

// Track connected sockets per userId so server-side code may push notifications
const userSockets = new Map(); // userId -> Set(socketId)

function getState(key) {
  const s = lobbies.get(key) || { participants: {}, ready: {} };
  return { participants: Object.values(s.participants), ready: s.ready };
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('joinLobby', ({ teamId, puzzleId, userId, name, isAdmin }) => {
    if (!teamId || !puzzleId || !userId) return;
    const key = `${teamId}::${puzzleId}`;
    socket.join(key);
    let state = lobbies.get(key);
    if (!state) {
      state = { participants: {}, ready: {} };
      lobbies.set(key, state);
    }
    state.participants[userId] = { userId, name, socketId: socket.id, isAdmin: !!isAdmin };
    // register socket for userId so notifications can be pushed
    if (userId) {
      let set = userSockets.get(userId);
      if (!set) { set = new Set(); userSockets.set(userId, set); }
      set.add(socket.id);
    }
    // default ready false unless already set
    state.ready = state.ready || {};
    io.to(key).emit('lobbyState', getState(key));
  });

  socket.on('leaveLobby', ({ teamId, puzzleId, userId }) => {
    const key = `${teamId}::${puzzleId}`;
    socket.leave(key);
    const state = lobbies.get(key);
    if (state) {
      delete state.participants[userId];
      delete state.ready[userId];
      io.to(key).emit('lobbyState', getState(key));
    }
    // unregister socket for userId
    if (userId) {
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(userId);
      }
    }
  });

  // allow any authenticated client to identify itself so it can receive notifications
  socket.on('identify', ({ userId }) => {
    if (!userId) return;
    let set = userSockets.get(userId);
    if (!set) { set = new Set(); userSockets.set(userId, set); }
    set.add(socket.id);
    // respond with current unread count? Not necessary here
  });

  socket.on('setReady', ({ teamId, puzzleId, userId, ready }) => {
    const key = `${teamId}::${puzzleId}`;
    const state = lobbies.get(key);
    if (!state) return;
    state.ready[userId] = !!ready;
    io.to(key).emit('lobbyState', getState(key));
  });

  socket.on('chatMessage', ({ teamId, puzzleId, message }) => {
    const key = `${teamId}::${puzzleId}`;
    io.to(key).emit('chatMessage', message);
  });

  socket.on('startPuzzle', ({ teamId, puzzleId, userId }) => {
    const key = `${teamId}::${puzzleId}`;
    const state = lobbies.get(key);
    if (!state) return;
    // simple check: all participants marked ready
    const participantIds = Object.keys(state.participants);
    const allReady = participantIds.length > 0 && participantIds.every((id) => !!state.ready[id]);
    if (!allReady) {
      socket.emit('startFailed', { error: 'Not all participants are ready' });
      return;
    }
    // broadcast puzzleStarting so clients can transition to planning
    io.to(key).emit('puzzleStarting', { teamId, puzzleId });
  });

  socket.on('disconnect', () => {
    // remove socket from any lobbies
    for (const [key, state] of lobbies.entries()) {
      const toRemove = Object.values(state.participants).find((p) => p.socketId === socket.id);
      if (toRemove) {
        const removed = toRemove;
        delete state.participants[removed.userId];
        delete state.ready[removed.userId];
        io.to(key).emit('lobbyState', getState(key));
        try {
          const payload = { teamId: key.split('::')[0], puzzleId: key.split('::')[1], userId: removed.userId, userName: removed.name };
          if (removed.isAdmin) {
            // admin left -> destroy lobby for others
            io.to(key).emit('lobbyDestroyed', { teamId: payload.teamId, puzzleId: payload.puzzleId, reason: 'leader_left' });
            lobbies.delete(key);
          } else {
            io.to(key).emit('participantLeft', payload);
          }
        } catch (e) {
          // ignore
        }
      }
      // cleanup empty lobbies
      if (Object.keys(state.participants).length === 0) lobbies.delete(key);
    }
    // remove socket from any user socket registries
    for (const [uid, set] of userSockets.entries()) {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(uid);
      }
    }
  });
});

// Explicitly bind to 0.0.0.0 so platforms like Render can reach the process
server.listen(PORT, '0.0.0.0', () => console.log(`Socket server listening on :${PORT} (0.0.0.0)`));
