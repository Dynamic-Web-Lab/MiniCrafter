// Anonymous usage counts and error reports for the online edition.
//
// Privacy by design (players are often children):
//  - No cookies, no player IDs, no fingerprinting, no IP addresses stored (they are only held in
//    memory for a minute for rate limiting).
//  - Usage is stored as daily counters only ("12 visits from phones today"), never per person.
//  - Error reports keep the message, where in the game it happened, the game version and the
//    browser family, grouped and counted. Kept for 90 days.
//  - Problem reports have three kinds: "error" (a crash), "freeze" (the game stopped responding for a
//    while) and "report" (a player pressed "Report a problem" and picked a category: no free text).
//    Each keeps the last few game steps ("opened Bit's panel", "pressed Run") to help reproduce it.
// Routes: POST /api/events, POST /api/errors (same-site only), GET /api/stats (needs STATS_TOKEN).
const MAX_BODY = 8192;
const COUNTER = /^[a-z0-9_:.-]{1,60}$/;
const CTX = {
  device: ['phone', 'tablet', 'desktop'],
  os: ['ios', 'android', 'windows', 'mac', 'chromeos', 'linux', 'other'],
  browser: ['safari', 'chrome', 'firefox', 'edge', 'samsung', 'other'],
  edition: ['online', 'free', 'dev'],
  mode: ['creative', 'survival', 'adventure'],
};
export const REPORTS = ['The game got stuck', "Bit isn't working", "Play Together isn't working", 'Something looks wrong', "A button doesn't work", 'Something else'];
const EVENTS = new Set(['visit', 'play', 'installed', 'together_host', 'together_join', 'course_finish', 'photo_saved', 'bit_run',
  'account_register', 'account_login', 'adventure', 'circuit', 'quest_done', 'world_new', 'touch']);

export class MemoryStats {
  constructor() { this.counts = new Map(); this.errors = new Map(); }
  async init() {}
  async add(day, keys) { for (const k of keys) { const id = `${day}|${k}`; this.counts.set(id, (this.counts.get(id) || 0) + 1); } }
  async addError(day, e) {
    const id = `${day}|${e.sig}`;
    const old = this.errors.get(id);
    this.errors.set(id, old ? { ...old, count: old.count + 1, last_seen: new Date() } : { day, ...e, count: 1, last_seen: new Date() });
  }
  async summary(days) {
    const since = dayStr(Date.now() - days * 86400_000);
    const counts = [...this.counts].map(([id, n]) => { const [day, key] = id.split('|'); return { day, key, n }; }).filter((r) => r.day >= since);
    const errors = [...this.errors.values()].filter((r) => r.day >= since).sort((a, b) => b.last_seen - a.last_seen);
    return { counts, errors };
  }
}

export class PgStats {
  constructor(pool) { this.pool = pool; }
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS daily_counts (day DATE NOT NULL, key TEXT NOT NULL, n BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (day, key));
      CREATE TABLE IF NOT EXISTS error_reports (
        day DATE NOT NULL, sig TEXT NOT NULL, message TEXT NOT NULL, place TEXT, version TEXT,
        browser TEXT, os TEXT, device TEXT, count INT NOT NULL DEFAULT 1, last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (day, sig));
      ALTER TABLE error_reports ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'error';
      ALTER TABLE error_reports ADD COLUMN IF NOT EXISTS steps TEXT;
      ALTER TABLE error_reports ADD COLUMN IF NOT EXISTS screen TEXT;`);
    setInterval(() => this.pool.query("DELETE FROM error_reports WHERE day < now() - interval '90 days'").catch(() => {}), 6 * 3600_000).unref();
  }
  async add(day, keys) {
    for (const k of keys) await this.pool.query('INSERT INTO daily_counts (day, key, n) VALUES ($1, $2, 1) ON CONFLICT (day, key) DO UPDATE SET n = daily_counts.n + 1', [day, k]);
  }
  async addError(day, e) {
    await this.pool.query(`INSERT INTO error_reports (day, sig, kind, message, place, version, browser, os, device, steps, screen) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (day, sig) DO UPDATE SET count = error_reports.count + 1, last_seen = now(), steps = EXCLUDED.steps, screen = EXCLUDED.screen`,
    [day, e.sig, e.kind, e.message, e.place, e.version, e.browser, e.os, e.device, e.steps, e.screen]);
  }
  async summary(days) {
    const counts = (await this.pool.query("SELECT to_char(day, 'YYYY-MM-DD') AS day, key, n::int AS n FROM daily_counts WHERE day >= current_date - $1::int ORDER BY day", [days])).rows;
    const errors = (await this.pool.query("SELECT to_char(day, 'YYYY-MM-DD') AS day, kind, message, place, version, browser, os, device, steps, screen, count, last_seen FROM error_reports WHERE day >= current_date - $1::int ORDER BY last_seen DESC LIMIT 300", [days])).rows;
    return { counts, errors };
  }
}

const dayStr = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const pick = (v, list) => (list.includes(v) ? v : 'other');
const clean = (s, max) => String(s ?? '').replace(/https?:\/\/[^\s)]+?\/([^/\s)]+)(?=[\s):]|$)/g, '$1').replace(/[\u0000-\u001f]/g, ' ').slice(0, max);

/**
 * @param {object} o { store, origins (getter ok), token }
 * @returns {{ handle(req, res) -> Promise<bool> }}
 */
export function createStats(o) {
  const hits = new Map(); // address -> { n, reset }, for one minute, in memory only
  setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.reset) hits.delete(k); }, 60_000).unref();
  const limited = (req, max) => {
    const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
    const n = Date.now(); const v = hits.get(ip) || { n: 0, reset: n + 60_000 };
    if (n > v.reset) { v.n = 0; v.reset = n + 60_000; }
    v.n++; hits.set(ip, v);
    return v.n > max;
  };
  const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  const read = (req) => new Promise((resolve, reject) => {
    let n = 0; const parts = [];
    req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { reject(new Error('big')); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch { reject(new Error('json')); } });
    req.on('error', reject);
  });
  const ctxOf = (c = {}) => ({ device: pick(c.device, CTX.device), os: pick(c.os, CTX.os), browser: pick(c.browser, CTX.browser), edition: pick(c.edition, CTX.edition), mode: CTX.mode.includes(c.mode) ? c.mode : null, version: /^v\d{1,4}$/.test(c.version) ? c.version : 'v?' });

  async function handle(req, res) {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/api/stats' && req.method === 'GET') {
      const auth = String(req.headers.authorization || '');
      if (!o.token || auth !== `Bearer ${o.token}`) return send(res, 401, { error: 'no' }), true;
      const days = Math.min(365, Math.max(1, Number(new URL(req.url, 'http://x').searchParams.get('days')) || 30));
      return send(res, 200, await o.store.summary(days)), true;
    }
    if (path !== '/api/events' && path !== '/api/errors') return false;
    if (req.method !== 'POST') return send(res, 405, {}), true;
    // Same-site only (sendBeacon can't add custom headers, so the Origin check is the gate).
    if (!(o.origins || []).includes(req.headers.origin || '')) return send(res, 403, {}), true;
    if (limited(req, 120)) return send(res, 429, {}), true;
    let body;
    try { body = await read(req); } catch { return send(res, 400, {}), true; }
    const ctx = ctxOf(body.ctx);
    const day = dayStr();
    try {
      if (path === '/api/events') {
        const names = (Array.isArray(body.events) ? body.events : []).slice(0, 20).filter((e) => EVENTS.has(e));
        const keys = [];
        for (const e of names) {
          keys.push(e);
          if (e === 'visit') keys.push(`device:${ctx.device}`, `os:${ctx.os}`, `browser:${ctx.browser}`, `edition:${ctx.edition}`, `version:${ctx.version}`);
          if (e === 'play' && ctx.mode) keys.push(`mode:${ctx.mode}`);
        }
        await o.store.add(day, keys.filter((k) => COUNTER.test(k)));
      } else {
        const kind = ['error', 'freeze', 'report'].includes(body.kind) ? body.kind : 'error';
        // Player reports are a picked category only (no typing), so nothing personal can slip in.
        const message = kind === 'report' ? (REPORTS.includes(body.message) ? body.message : '') : clean(body.message, 300);
        if (!message) return send(res, 400, {}), true;
        const place = clean(body.place, 120);
        const steps = (Array.isArray(body.steps) ? body.steps : []).slice(-12).map((t) => clean(t, 60).replace(/[^\w .,:+\-#()/'→]/g, '')).join(' → ').slice(0, 900);
        const screen = /^\d{2,5}x\d{2,5}( [a-z, ]{0,40})?$/.test(String(body.screen || '')) ? String(body.screen) : '';
        const sig = `${kind}|${message}|${place}|${ctx.version}|${ctx.browser}|${ctx.device}`.slice(0, 500);
        await o.store.addError(day, { sig, kind, message, place, version: ctx.version, browser: ctx.browser, os: ctx.os, device: ctx.device, steps, screen });
        await o.store.add(day, [kind]);
      }
    } catch { return send(res, 500, {}), true; }
    res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end();
    return true;
  }
  return { handle };
}
