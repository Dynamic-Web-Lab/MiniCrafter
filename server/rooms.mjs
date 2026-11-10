// MiniCrafter Rooms: a tiny relay for "Play Together".
//
// Kid-safety by design:
//  - Players never connect to each other directly (no IP addresses shared between kids).
//  - Rooms are private: a short code, and the host must let each player in.
//  - No accounts, no text chat (the game only sends picked names, emoji and game data).
//  - Nothing is stored or logged: rooms live in memory and vanish when the host leaves.
//
// Zero dependencies (Node 18+): a minimal WebSocket server (RFC 6455, text frames only).
// Run: node server/rooms.mjs   (PORT=8787, ALLOWED_ORIGINS=comma,separated,origins, AUTH_URL=accounts service)
// or use attachRelay() inside another server (see server/dev.mjs).
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8765,http://localhost:8766,http://127.0.0.1')
  .split(',').map((s) => s.trim()).filter(Boolean);
const MAX_PLAYERS = 4;             // host + 3 friends
const MAX_ROOMS = 500;
const MAX_MSG = 256 * 1024;        // bytes per message (world snapshots are sent in parts)
const RATE = 120;                  // messages per second per player (burst)
const JOIN_TRIES = 10;             // wrong codes per minute per address before a cool-down
const ALPHABET = 'BCDFGHJKMNPQRSTVWXZ23456789'; // no vowels (no accidental words), no 0/O/1/I
const IDLE_MS = 2 * 60 * 1000;     // drop silent connections

const rooms = new Map();           // code -> { host, players: Map(id -> sock), next, locked }
const tries = new Map();           // address -> { n, reset }

function newCode() {
  for (let i = 0; i < 50; i++) {
    let c = '';
    for (let k = 0; k < 4; k++) c += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}

// ---------- WebSocket plumbing ----------
function send(sock, obj) {
  if (sock.destroyed || sock.closing) return;
  const data = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));
  let head;
  if (data.length < 126) head = Buffer.from([0x81, data.length]);
  else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
  sock.write(Buffer.concat([head, data]));
}

function close(sock, code = 1000) {
  if (sock.closing) return;
  sock.closing = true;
  const b = Buffer.alloc(4); b[0] = 0x88; b[1] = 2; b.writeUInt16BE(code, 2);
  try { sock.end(b); } catch { /* already gone */ }
  setTimeout(() => sock.destroy(), 1000);
}

/** Parses complete frames from sock.buf; calls onText for each text message. */
function readFrames(sock, onText) {
  for (;;) {
    const b = sock.buf;
    if (b.length < 2) return;
    const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > BigInt(MAX_MSG)) return close(sock, 1009); len = Number(big); off = 10; }
    if (!masked) return close(sock, 1002); // browsers always mask
    if (len > MAX_MSG) return close(sock, 1009);
    if (b.length < off + 4 + len) return;
    const mask = b.subarray(off, off + 4);
    const payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    sock.buf = b.subarray(off + 4 + len);
    if (op === 0x8) return close(sock);
    if (op === 0x9) { const h = Buffer.from([0x8a, payload.length]); sock.write(Buffer.concat([h, payload])); continue; } // ping -> pong
    if (op === 0xa) continue; // pong
    if (op === 0x0 || op === 0x1) {
      sock.frag = sock.frag ? Buffer.concat([sock.frag, payload]) : payload;
      if (sock.frag.length > MAX_MSG) return close(sock, 1009);
      if (fin) { const text = sock.frag.toString('utf8'); sock.frag = null; onText(text); }
      continue;
    }
    return close(sock, 1003); // binary or unknown
  }
}

// ---------- rooms ----------
function handle(sock, text) {
  // simple token bucket
  const now = Date.now();
  sock.tokens = Math.min(RATE, sock.tokens + ((now - sock.last) / 1000) * RATE);
  sock.last = now;
  if (sock.tokens < 1) return; // too fast: drop
  sock.tokens -= 1;

  let m;
  try { m = JSON.parse(text); } catch { return; }
  if (!m || typeof m.t !== 'string') return;
  const room = sock.room ? rooms.get(sock.room) : null;

  switch (m.t) {
    case 'host': {
      if (sock.room) return;
      if (rooms.size >= MAX_ROOMS) return send(sock, { t: 'error', why: 'busy' });
      const code = newCode();
      if (!code) return send(sock, { t: 'error', why: 'busy' });
      rooms.set(code, { host: sock, players: new Map([[0, sock]]), next: 1, locked: false });
      sock.room = code; sock.id = 0; sock.admitted = true;
      send(sock, { t: 'room', code, you: 0 });
      break;
    }
    case 'join': {
      if (sock.room) return;
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      const t = tries.get(sock.addr) || { n: 0, reset: now + 60000 };
      if (now > t.reset) { t.n = 0; t.reset = now + 60000; }
      if (t.n >= JOIN_TRIES) return send(sock, { t: 'error', why: 'slow-down' });
      const r = rooms.get(code);
      if (!r) { t.n++; tries.set(sock.addr, t); return send(sock, { t: 'error', why: 'no-room' }); }
      if (r.locked) return send(sock, { t: 'error', why: 'locked' });
      if (r.players.size >= MAX_PLAYERS) return send(sock, { t: 'error', why: 'full' });
      const id = r.next++;
      r.players.set(id, sock);
      sock.room = code; sock.id = id; sock.admitted = false;
      sock.profile = { name: String(m.name || '').slice(0, 24), color: String(m.color || '').slice(0, 16) };
      send(sock, { t: 'waiting', code });
      send(r.host, { t: 'knock', id, ...sock.profile }); // the host decides
      break;
    }
    case 'admit': { // host lets a player in (or says no)
      if (!room || sock !== room.host) return;
      const p = room.players.get(m.id);
      if (!p || p.admitted) return;
      if (m.ok) { p.admitted = true; send(p, { t: 'welcome', you: p.id }); send(sock, { t: 'peer', id: p.id, ...p.profile }); }
      else { send(p, { t: 'error', why: 'declined' }); room.players.delete(p.id); p.room = null; close(p); }
      break;
    }
    case 'kick': {
      if (!room || sock !== room.host || m.id === 0) return;
      const p = room.players.get(m.id);
      if (!p) return;
      room.players.delete(m.id); p.room = null;
      send(p, { t: 'error', why: 'removed' });
      close(p);
      send(sock, { t: 'left', id: m.id });
      break;
    }
    case 'lock': { if (room && sock === room.host) room.locked = !!m.on; break; }
    case 'msg': {
      // Game data. Guests can only talk to the host; the host can talk to one guest or all of them.
      if (!room || !sock.admitted) return;
      const out = JSON.stringify({ t: 'msg', from: sock.id, d: m.d });
      if (sock === room.host) {
        for (const [id, p] of room.players) if (id !== 0 && p.admitted && (m.to == null || m.to === id)) send(p, out);
      } else send(room.host, out);
      break;
    }
    default: break;
  }
}

function leave(sock) {
  const code = sock.room;
  const room = code ? rooms.get(code) : null;
  if (!room) return;
  sock.room = null;
  if (sock === room.host) {
    rooms.delete(code);
    for (const [id, p] of room.players) if (id !== 0) { send(p, { t: 'closed' }); p.room = null; close(p); }
  } else {
    room.players.delete(sock.id);
    if (sock.admitted) send(room.host, { t: 'left', id: sock.id });
    else send(room.host, { t: 'knock-gone', id: sock.id });
  }
}

// ---------- HTTP + upgrade ----------
/**
 * Handles WebSocket upgrades for the relay on any Node HTTP server.
 * @param {object} o { origins: [..], verify(req) -> Promise<user|null> (when set, players must be logged in) }
 */
export function attachRelay(server, o = {}) {
  server.on('upgrade', async (req, sock) => {
    if (o.path && !(req.url || '').startsWith(o.path)) return; // someone else's upgrade
    const origin = req.headers.origin || '';
    const okOrigin = (o.origins || ORIGINS).some((x) => origin === x || (x.endsWith('127.0.0.1') && origin.startsWith('http://127.0.0.1')));
    const key = req.headers['sec-websocket-key'];
    if (!okOrigin || !key || req.headers.upgrade?.toLowerCase() !== 'websocket') { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    let user = null;
    if (o.verify) {
      try { user = await o.verify(req); } catch { user = null; }
      if (!user) { sock.end('HTTP/1.1 401 Unauthorized\r\n\r\n'); return; } // Play Together needs a login
    }
    if (sock.destroyed) return;
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    sock.setNoDelay(true);
    sock.buf = Buffer.alloc(0);
    sock.tokens = RATE; sock.last = Date.now();
    sock.user = user;
    sock.addr = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
    let idle = setTimeout(() => close(sock, 1001), IDLE_MS);
    sock.on('data', (chunk) => {
      clearTimeout(idle); idle = setTimeout(() => close(sock, 1001), IDLE_MS);
      sock.buf = sock.buf.length ? Buffer.concat([sock.buf, chunk]) : chunk;
      if (sock.buf.length > MAX_MSG + 16) return close(sock, 1009);
      readFrames(sock, (text) => handle(sock, text));
    });
    sock.on('close', () => { clearTimeout(idle); leave(sock); });
    sock.on('error', () => { clearTimeout(idle); leave(sock); });
  });
}

export const roomCount = () => rooms.size;

setInterval(() => { const now = Date.now(); for (const [a, t] of tries) if (now > t.reset) tries.delete(a); }, 60000).unref();

/** Asks the accounts service whether the request's login cookie is valid (production). */
function verifyWith(authURL) {
  return async (req) => {
    const m = /(?:^|;\s*)mc_session=([A-Za-z0-9_-]{20,100})/.exec(req.headers.cookie || '');
    if (!m) return null;
    const r = await fetch(`${authURL}/internal/verify`, { headers: { 'x-session': m[1] }, signal: AbortSignal.timeout(3000) });
    return r.ok ? r.json() : null;
  };
}

// Run on its own: node server/rooms.mjs   (AUTH_URL=http://accounts:8788 to require logins)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(`ok ${rooms.size}`); }
    res.writeHead(404); res.end();
  });
  attachRelay(server, { verify: process.env.AUTH_URL ? verifyWith(process.env.AUTH_URL) : null });
  server.listen(PORT, () => console.log(`MiniCrafter Rooms on :${PORT}${process.env.AUTH_URL ? ' (login required)' : ''}`));
}
