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
  // IMPORTANT: Let Socket.IO handle its own endpoint.
  // If we respond with 404 here, the Socket.IO server never gets a chance to add
  // the proper CORS headers or complete the handshake.
  if (req.url && (req.url === '/socket.io' || req.url.startsWith('/socket.io/'))) {
    return;
  }

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
  // add explicit frontend/app urls (socket server often runs as its own service)
  if (process.env.APP_URL) set.add(process.env.APP_URL.replace(/\/$/, ''));
  if (process.env.NEXT_PUBLIC_APP_URL) set.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''));
  if (process.env.SITE_URL) set.add(process.env.SITE_URL.replace(/\/$/, ''));
  if (process.env.NEXT_PUBLIC_SITE_URL) set.add(process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''));

  // allow a comma-separated list of extra origins (e.g. "https://www.puzzlewarz.com,https://puzzlewarz.com")
  if (process.env.SOCKET_ALLOWED_ORIGINS) {
    const parts = String(process.env.SOCKET_ALLOWED_ORIGINS)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\/$/, ''));
    for (const p of parts) set.add(p);
  }
  // add NEXT_PUBLIC_SOCKET_URL if present (client uses this)
  if (process.env.NEXT_PUBLIC_SOCKET_URL) set.add(process.env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, ''));
  // local dev defaults
  set.add('http://localhost:3000');
  set.add('http://127.0.0.1:3000');

  // Project defaults (helps when socket service env is sparse and NODE_ENV is unset)
  set.add('https://www.puzzlewarz.com');
  set.add('https://puzzlewarz.com');

  try { set.add(new URL(process.env.NEXTAUTH_URL || '').origin); } catch (e) {}
  return Array.from(set).filter(Boolean);
}

const allowedOriginsList = originsFromEnv();
const allowedOriginsSet = new Set(allowedOriginsList.map((o) => String(o).replace(/\/$/, '')));

function isAllowedOrigin(origin) {
  if (!origin) return true; // non-browser clients / health checks
  const normalized = String(origin).replace(/\/$/, '');
  return allowedOriginsSet.has(normalized);
}

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error('origin not allowed'), false);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Ensure Engine.IO always emits CORS headers for allowed origins (esp. long-polling)
try {
  io.engine.on('headers', (headers, req) => {
    const origin = req && req.headers ? req.headers.origin : undefined;
    if (isAllowedOrigin(origin)) {
      if (origin) headers['Access-Control-Allow-Origin'] = String(origin).replace(/\/$/, '');
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Vary'] = 'Origin';
    }
  });
} catch (e) {
  // ignore if engine hook is unavailable
}

console.log('Socket.IO allowed origins:', allowedOriginsList);

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

// Escape-room presence tracking (unique users). Keyed by `${teamId}::${puzzleId}`.
// Value: Map<userId, connectionCount>
const escapeRoomCounts = new Map();
// Per-socket memberships so we can cleanly remove on disconnect.
const socketEscapeMemberships = new Map(); // socketId -> Array<{ teamId, puzzleId, userId }>

const REQUIRED_ESCAPE_PLAYERS = 4;
const JOIN_WAIT_MS = Number(process.env.ESCAPE_JOIN_WAIT_MS) || 20_000;
const DISCONNECT_GRACE_MS = Number(process.env.ESCAPE_DISCONNECT_GRACE_MS) || 5_000;

// Lobby disconnect grace:
// Users often navigate between pages (lobby -> planning -> puzzle), which can briefly drop the socket.
// Treat disconnect as transient for a short window to avoid false "participantLeft" notices.
const LOBBY_DISCONNECT_GRACE_MS = Number(process.env.LOBBY_DISCONNECT_GRACE_MS) || 15_000;

// Key: `${teamId}::${puzzleId}::${userId}` -> Timeout
const lobbyDisconnectTimers = new Map();

const joinWaitTimers = new Map(); // key `${teamId}::${puzzleId}` -> Timeout
const disconnectTimers = new Map(); // key `${teamId}::${puzzleId}` -> Timeout

function escapeKey(teamId, puzzleId) {
  return `${teamId}::${puzzleId}`;
}

function escapeRoomUniqueCount(key) {
  const counts = escapeRoomCounts.get(key);
  return counts ? counts.size : 0;
}

function addEscapeMember(teamId, puzzleId, userId) {
  const key = escapeKey(teamId, puzzleId);
  let counts = escapeRoomCounts.get(key);
  if (!counts) {
    counts = new Map();
    escapeRoomCounts.set(key, counts);
  }
  counts.set(userId, (counts.get(userId) || 0) + 1);
  return counts.size;
}

function removeEscapeMember(teamId, puzzleId, userId) {
  const key = escapeKey(teamId, puzzleId);
  const counts = escapeRoomCounts.get(key);
  if (!counts) return 0;
  const cur = counts.get(userId) || 0;
  if (cur <= 1) counts.delete(userId);
  else counts.set(userId, cur - 1);
  if (counts.size === 0) escapeRoomCounts.delete(key);
  return counts.size;
}

function appBaseUrl() {
  const raw = process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return (raw || '').replace(/\/$/, '');
}

async function callAppServerAbort({ teamId, puzzleId, reason }) {
  try {
    if (!process.env.SOCKET_SECRET) return;
    const url = appBaseUrl() + '/api/team/lobby';
    if (!global.fetch) return;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-socket-secret': process.env.SOCKET_SECRET,
      },
      body: JSON.stringify({ action: 'serverAbort', teamId, puzzleId, reason, skipEmit: true }),
    }).catch(() => null);
  } catch (e) {
    // ignore
  }
}

function clearAbortTimers(key) {
  const jw = joinWaitTimers.get(key);
  if (jw) {
    clearTimeout(jw);
    joinWaitTimers.delete(key);
  }
  const dt = disconnectTimers.get(key);
  if (dt) {
    clearTimeout(dt);
    disconnectTimers.delete(key);
  }
}

async function performEscapeAbort(teamId, puzzleId, reason) {
  const key = escapeKey(teamId, puzzleId);
  const count = escapeRoomUniqueCount(key);
  if (count >= REQUIRED_ESCAPE_PLAYERS) {
    clearAbortTimers(key);
    return;
  }

  // Notify clients in both lobby + escape rooms.
  io.to(key).emit('lobbyDestroyed', { teamId, puzzleId, reason });
  io.to(`escape:${key}`).emit('escapeAborted', { teamId, puzzleId, reason });

  // Best-effort cleanup of socket-server lobby cache.
  try { lobbies.delete(key); } catch (e) {}
  try { clearAbortTimers(key); } catch (e) {}

  // Ask Next.js to destroy its in-memory lobby + reset escape-room progress.
  await callAppServerAbort({ teamId, puzzleId, reason });
}

function scheduleJoinWaitAbort(teamId, puzzleId) {
  const key = escapeKey(teamId, puzzleId);
  if (joinWaitTimers.has(key)) return;

  const t = setTimeout(() => {
    joinWaitTimers.delete(key);
    const count = escapeRoomUniqueCount(key);
    if (count >= REQUIRED_ESCAPE_PLAYERS) return;
    performEscapeAbort(teamId, puzzleId, 'missing_player').catch(() => null);
  }, JOIN_WAIT_MS);
  joinWaitTimers.set(key, t);
}

function scheduleDisconnectAbort(teamId, puzzleId) {
  const key = escapeKey(teamId, puzzleId);

  // If we're already full again, cancel any pending disconnect abort.
  const count = escapeRoomUniqueCount(key);
  if (count >= REQUIRED_ESCAPE_PLAYERS) {
    const dt = disconnectTimers.get(key);
    if (dt) {
      clearTimeout(dt);
      disconnectTimers.delete(key);
    }
    return;
  }

  if (disconnectTimers.has(key)) return;
  const t = setTimeout(() => {
    disconnectTimers.delete(key);
    const after = escapeRoomUniqueCount(key);
    if (after >= REQUIRED_ESCAPE_PLAYERS) return;
    performEscapeAbort(teamId, puzzleId, 'player_disconnected').catch(() => null);
  }, DISCONNECT_GRACE_MS);
  disconnectTimers.set(key, t);
}

// Track connected sockets per userId so server-side code may push notifications
const userSockets = new Map(); // userId -> Set(socketId)

function getState(key) {
  const s = lobbies.get(key) || { participants: {}, ready: {} };
  return { participants: Object.values(s.participants), ready: s.ready };
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  // Escape-room room membership (separate from lobby rooms)
  socket.on('joinEscapeRoom', ({ teamId, puzzleId, userId }) => {
    try {
      if (!teamId || !puzzleId || !userId) return;
      const room = `escape:${teamId}::${puzzleId}`;
      socket.join(room);

      // Track membership for abort logic.
      const list = socketEscapeMemberships.get(socket.id) || [];
      const already = list.some((m) => m.teamId === teamId && m.puzzleId === puzzleId && m.userId === userId);
      if (!already) {
        addEscapeMember(teamId, puzzleId, userId);
        list.push({ teamId, puzzleId, userId });
        socketEscapeMemberships.set(socket.id, list);
      }

      // Start a "missing player" timer once the first player arrives.
      scheduleJoinWaitAbort(teamId, puzzleId);

      // If we've reached quorum, clear any abort timers.
      const key = escapeKey(teamId, puzzleId);
      if (escapeRoomUniqueCount(key) >= REQUIRED_ESCAPE_PLAYERS) {
        clearAbortTimers(key);
      }
    } catch (e) {
      // ignore
    }
  });

  socket.on('leaveEscapeRoom', ({ teamId, puzzleId, userId }) => {
    try {
      if (!teamId || !puzzleId || !userId) return;
      const room = `escape:${teamId}::${puzzleId}`;
      socket.leave(room);

      // Only decrement if this socket previously joined.
      const list = socketEscapeMemberships.get(socket.id) || [];
      const idx = list.findIndex((m) => m.teamId === teamId && m.puzzleId === puzzleId && m.userId === userId);
      if (idx >= 0) {
        list.splice(idx, 1);
        if (list.length > 0) socketEscapeMemberships.set(socket.id, list);
        else socketEscapeMemberships.delete(socket.id);

        removeEscapeMember(teamId, puzzleId, userId);
        scheduleDisconnectAbort(teamId, puzzleId);
      }
    } catch (e) {
      // ignore
    }
  });

  socket.on('joinLobby', ({ teamId, puzzleId, userId, name, isAdmin }) => {
    if (!teamId || !puzzleId || !userId) return;
    const key = `${teamId}::${puzzleId}`;
    socket.join(key);

    // Cancel any pending disconnect removal for this lobby/user.
    try {
      const dk = `${key}::${userId}`;
      const t = lobbyDisconnectTimers.get(dk);
      if (t) {
        clearTimeout(t);
        lobbyDisconnectTimers.delete(dk);
      }
    } catch (e) {
      // ignore
    }

    let state = lobbies.get(key);
    if (!state) {
      state = { participants: {}, ready: {} };
      lobbies.set(key, state);
    }

    const incomingName = typeof name === 'string' ? name.trim() : '';
    const existing = state.participants ? state.participants[userId] : undefined;
    const finalName = incomingName || (existing && typeof existing.name === 'string' ? existing.name : '') || '';

    state.participants[userId] = { userId, name: finalName, socketId: socket.id, isAdmin: !!isAdmin };
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

    // Explicit leave should cancel any pending disconnect removal.
    try {
      const dk = `${key}::${userId}`;
      const t = lobbyDisconnectTimers.get(dk);
      if (t) {
        clearTimeout(t);
        lobbyDisconnectTimers.delete(dk);
      }
    } catch (e) {
      // ignore
    }

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
    // Escape-room presence cleanup + abort scheduling
    try {
      const memberships = socketEscapeMemberships.get(socket.id) || [];
      for (const m of memberships) {
        try {
          removeEscapeMember(m.teamId, m.puzzleId, m.userId);
          scheduleDisconnectAbort(m.teamId, m.puzzleId);
        } catch (e) {
          // ignore
        }
      }
      socketEscapeMemberships.delete(socket.id);
    } catch (e) {
      // ignore
    }

    // Handle disconnect from lobby rooms with a short grace period.
    // This prevents false "left lobby" notices when a user navigates between pages.
    for (const [key, state] of lobbies.entries()) {
      const participant = Object.values(state.participants).find((p) => p.socketId === socket.id);
      if (!participant) continue;

      const teamId = key.split('::')[0];
      const puzzleId = key.split('::')[1];
      const userId = participant.userId;
      const userName = participant.name;

      // Mark as disconnected (but keep in participants until grace expires).
      try {
        state.participants[userId] = { ...participant, socketId: null };
      } catch (e) {
        // ignore
      }

      const timerKey = `${key}::${userId}`;
      if (!lobbyDisconnectTimers.has(timerKey)) {
        const t = setTimeout(() => {
          try {
            lobbyDisconnectTimers.delete(timerKey);
            const current = lobbies.get(key);
            if (!current) return;

            const curP = current.participants && current.participants[userId];
            // If they rejoined (socketId set), do nothing.
            if (curP && curP.socketId) return;

            // Remove participant after grace.
            if (curP) {
              delete current.participants[userId];
              delete current.ready[userId];
              io.to(key).emit('lobbyState', getState(key));
              io.to(key).emit('participantLeft', { teamId, puzzleId, userId, userName });
            }

            if (current.participants && Object.keys(current.participants).length === 0) {
              lobbies.delete(key);
            }
          } catch (e) {
            // ignore
          }
        }, LOBBY_DISCONNECT_GRACE_MS);
        lobbyDisconnectTimers.set(timerKey, t);
      }
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
