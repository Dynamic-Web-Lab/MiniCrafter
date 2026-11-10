// MiniCrafter accounts (online edition): register, log in, log out, delete account.
//
// Privacy by design (players are often children):
//  - Only a username and a password. No email, no real name, no birthday, no tracking.
//  - The username is private: it is only used to log in. Other players only ever see the
//    picked colour-and-animal name from Play Together.
//  - Passwords are hashed with scrypt; sessions are random tokens stored only as SHA-256 hashes,
//    sent as HttpOnly, Secure, SameSite=Lax cookies.
//  - Deleting an account deletes everything about it straight away.
//
// Storage: Postgres when DATABASE_URL is set (production), otherwise in memory (development, tests).
// Run on its own: node server/accounts.mjs   (PORT=8788, ALLOWED_ORIGINS, DATABASE_URL, SECURE_COOKIE=0 for http dev)
// Routes: POST /api/register, /api/login, /api/logout, /api/delete   GET /api/me
// Internal (never proxied to the internet): GET /internal/verify with header x-session -> { id, username }
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SESSION_DAYS = 30;
const MAX_BODY = 4096;
const USERNAME = /^[a-z0-9_]{3,20}$/;
const COOKIE = 'mc_session';

// ---------- passwords ----------
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return new Promise((res, rej) => crypto.scrypt(pw, salt, 32, SCRYPT, (e, key) => (e ? rej(e) : res(`scrypt$${salt.toString('base64')}$${key.toString('base64')}`))));
}
function checkPassword(pw, stored) {
  const [kind, salt, key] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !key) return Promise.resolve(false);
  const want = Buffer.from(key, 'base64');
  return new Promise((res) => crypto.scrypt(pw, Buffer.from(salt, 'base64'), 32, SCRYPT, (e, k) => res(!e && want.length === k.length && crypto.timingSafeEqual(k, want))));
}
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(32).toString('base64')}`; // same work for unknown users
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

// ---------- storage ----------
export class MemoryStore {
  constructor() { this.users = new Map(); this.byName = new Map(); this.sessions = new Map(); this.next = 1; }
  async init() {}
  async createUser(username, hash) {
    if (this.byName.has(username)) return null;
    const u = { id: this.next++, username, pass_hash: hash, created_at: new Date() };
    this.users.set(u.id, u); this.byName.set(username, u);
    return u;
  }
  async userByName(username) { return this.byName.get(username) || null; }
  async createSession(userId, tokenHash, expires) { this.sessions.set(tokenHash, { user_id: userId, expires_at: expires }); }
  async sessionUser(tokenHash) {
    const s = this.sessions.get(tokenHash);
    if (!s || s.expires_at < new Date()) return null;
    return this.users.get(s.user_id) || null;
  }
  async deleteSession(tokenHash) { this.sessions.delete(tokenHash); }
  async deleteUser(id) {
    const u = this.users.get(id); if (!u) return;
    this.users.delete(id); this.byName.delete(u.username);
    for (const [k, s] of this.sessions) if (s.user_id === id) this.sessions.delete(k);
  }
  async touch() {}
}

export class PgStore {
  constructor(url) { this.url = url; }
  async init() {
    const { default: pg } = await import('pg');
    this.pool = new pg.Pool({ connectionString: this.url, max: 5 });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        pass_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);`);
    setInterval(() => this.pool.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {}), 3600_000).unref();
  }
  async createUser(username, hash) {
    const r = await this.pool.query('INSERT INTO users (username, pass_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING RETURNING id, username', [username, hash]);
    return r.rows[0] || null;
  }
  async userByName(username) { return (await this.pool.query('SELECT id, username, pass_hash FROM users WHERE username = $1', [username])).rows[0] || null; }
  async createSession(userId, tokenHash, expires) { await this.pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expires]); }
  async sessionUser(tokenHash) {
    return (await this.pool.query('SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [tokenHash])).rows[0] || null;
  }
  async deleteSession(tokenHash) { await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); }
  async deleteUser(id) { await this.pool.query('DELETE FROM users WHERE id = $1', [id]); }
  async touch(id) { await this.pool.query('UPDATE users SET last_login = now() WHERE id = $1', [id]); }
}

// ---------- rate limits (in memory) ----------
class Limiter {
  constructor(max, windowMs) { this.max = max; this.win = windowMs; this.m = new Map(); setInterval(() => { const n = Date.now(); for (const [k, v] of this.m) if (n > v.reset) this.m.delete(k); }, 60_000).unref(); }
  hit(key) { const n = Date.now(); const v = this.m.get(key) || { c: 0, reset: n + this.win }; if (n > v.reset) { v.c = 0; v.reset = n + this.win; } v.c++; this.m.set(key, v); return v.c <= this.max; }
  ok(key) { const v = this.m.get(key); return !v || Date.now() > v.reset || v.c < this.max; }
}

/**
 * @param {object} o { store, origins: [..], secureCookie = true }
 * @returns {{ handle(req, res) -> bool, verifyToken(token) -> user|null, verifyRequest(req) -> user|null }}
 */
export function createAccounts(o) {
  const store = o.store;
  const secure = o.secureCookie !== false;
  const regLimit = new Limiter(20, 3600_000);        // new accounts per address per hour (schools share addresses)
  const failIp = new Limiter(30, 15 * 60_000);       // wrong passwords per address
  const failUser = new Limiter(10, 15 * 60_000);     // wrong passwords per username

  const json = (res, code, body, cookie) => {
    const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    if (cookie !== undefined) h['Set-Cookie'] = cookie;
    res.writeHead(code, h); res.end(JSON.stringify(body));
  };
  const cookieFor = (token, maxAge) => `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const tokenOf = (req) => (/(?:^|;\s*)mc_session=([A-Za-z0-9_-]{20,100})/.exec(req.headers.cookie || '') || [])[1] || null;
  const ipOf = (req) => String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');

  async function verifyToken(token) {
    if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
    const u = await store.sessionUser(sha(token));
    return u ? { id: Number(u.id), username: u.username } : null;
  }
  const verifyRequest = (req) => verifyToken(tokenOf(req));

  async function readBody(req) {
    return new Promise((res, rej) => {
      let n = 0; const parts = [];
      req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { rej(new Error('too big')); req.destroy(); } else parts.push(c); });
      req.on('end', () => { try { res(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch { rej(new Error('bad json')); } });
      req.on('error', rej);
    });
  }

  async function startSession(res, user, code = 200) {
    const token = crypto.randomBytes(32).toString('base64url');
    await store.createSession(user.id, sha(token), new Date(Date.now() + SESSION_DAYS * 86400_000));
    await store.touch(user.id).catch(() => {});
    json(res, code, { username: user.username }, cookieFor(token, SESSION_DAYS * 86400));
  }

  /** Returns true if it handled the request. */
  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) return false;
    const route = url.pathname.slice(5);
    try {
      if (req.method === 'GET' && route === 'me') {
        const u = await verifyRequest(req);
        return json(res, 200, { username: u ? u.username : null }), true; // "nobody" is a normal answer, not an error
      }
      if (req.method !== 'POST') return json(res, 405, { error: 'method' }), true;
      // Cross-site protection: same-site cookie, a JSON body, a custom header and an allowed origin.
      if (!(o.origins || []).includes(req.headers.origin || '') || req.headers['x-minicrafter'] !== '1' || !String(req.headers['content-type']).startsWith('application/json')) {
        return json(res, 403, { error: 'forbidden' }), true;
      }
      const body = await readBody(req);
      const ip = ipOf(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (route === 'register') {
        if (!USERNAME.test(username)) return json(res, 400, { error: 'bad-username' }), true;
        if (password.length < 8 || password.length > 200) return json(res, 400, { error: 'bad-password' }), true;
        if (!regLimit.hit(ip)) return json(res, 429, { error: 'slow-down' }), true;
        const user = await store.createUser(username, await hashPassword(password));
        if (!user) return json(res, 409, { error: 'taken' }), true;
        return startSession(res, user, 201), true;
      }
      if (route === 'login') {
        if (!failIp.ok(ip) || !failUser.ok(username)) return json(res, 429, { error: 'slow-down' }), true;
        const user = USERNAME.test(username) ? await store.userByName(username) : null;
        const good = await checkPassword(password, user ? user.pass_hash : DUMMY_HASH);
        if (!user || !good) { failIp.hit(ip); failUser.hit(username); return json(res, 401, { error: 'wrong' }), true; }
        return startSession(res, user), true;
      }
      if (route === 'logout') {
        const t = tokenOf(req);
        if (t) await store.deleteSession(sha(t));
        return json(res, 200, { ok: true }, cookieFor('', 0)), true;
      }
      if (route === 'delete') {
        const me = await verifyRequest(req);
        if (!me) return json(res, 401, { error: 'not-logged-in' }), true;
        const user = await store.userByName(me.username);
        if (!failUser.ok(me.username) || !user || !(await checkPassword(password, user.pass_hash))) { failUser.hit(me.username); return json(res, 401, { error: 'wrong' }), true; }
        await store.deleteUser(user.id);
        return json(res, 200, { ok: true }, cookieFor('', 0)), true;
      }
      return json(res, 404, { error: 'not-found' }), true;
    } catch (e) {
      if (!res.headersSent) json(res, 400, { error: 'bad-request' });
      return true;
    }
  }

  /** Internal endpoint for the relay (never exposed through the public proxy). */
  async function handleInternal(req, res) {
    if (req.url !== '/internal/verify') return false;
    const u = await verifyToken(String(req.headers['x-session'] || '')).catch(() => null);
    json(res, u ? 200 : 401, u || { error: 'no' });
    return true;
  }

  return { handle, handleInternal, verifyToken, verifyRequest };
}

// Run on its own (production): PORT=8788 DATABASE_URL=postgres://... ALLOWED_ORIGINS=https://site
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const store = process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL) : new MemoryStore();
  for (let i = 1; ; i++) { // the database may still be starting up
    try { await store.init(); break; } catch (e) { if (i >= 30) throw e; await new Promise((r) => setTimeout(r, 2000)); }
  }
  const acc = createAccounts({ store, origins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean), secureCookie: process.env.SECURE_COOKIE !== '0' });
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
    if (await acc.handleInternal(req, res)) return;
    if (await acc.handle(req, res)) return;
    res.writeHead(404); res.end();
  });
  server.listen(Number(process.env.PORT || 8788), () => console.log(`MiniCrafter accounts on :${process.env.PORT || 8788} (${process.env.DATABASE_URL ? 'postgres' : 'memory'})`));
}
