// Anonymous usage counts and error reports (online edition only; see server/stats.mjs).
// No cookies and no IDs: the game only says things like "a visit from a phone using Safari"
// or "Play Together was used", at most once per browser session each, plus error messages
// so we can fix problems players hit. The free edition never sends anything.
const ONCE = 'minicrafter:insights'; // sessionStorage: which counts this session already sent
const MAX_ERRORS = 8;               // per session
const FREEZE_MS = 5000;             // the game stopped responding this long (while on screen) = a freeze
export const REPORTS = ['The game got stuck', "Bit isn't working", "Play Together isn't working", 'Something looks wrong', "A button doesn't work", 'Something else'];

function detect() {
  const ua = navigator.userAgent;
  const iPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const os = /iPhone|iPod/.test(ua) || iPad ? 'ios' : /Android/.test(ua) ? 'android' : /CrOS/.test(ua) ? 'chromeos'
    : /Windows/.test(ua) ? 'windows' : /Mac OS X/.test(ua) ? 'mac' : /Linux/.test(ua) ? 'linux' : 'other';
  const device = iPad || (/Android/.test(ua) && !/Mobile/.test(ua)) || /Tablet/.test(ua) ? 'tablet' : /Mobi|iPhone|iPod|Android/.test(ua) ? 'phone' : 'desktop';
  const browser = /SamsungBrowser/.test(ua) ? 'samsung' : /Edg\//.test(ua) ? 'edge' : /Firefox|FxiOS/.test(ua) ? 'firefox'
    : /Chrome|CriOS|Chromium/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'other';
  return { device, os, browser };
}

export class Insights {
  constructor() {
    this.enabled = false;
    this.queue = [];
    this.errors = 0;
    this.steps = [];      // the last few things the player did, to help reproduce a problem
    this.t0 = performance.now();
    this.lastBeat = 0;
    this.ctx = { ...detect(), edition: 'online', version: 'v?' };
    try { this.sent = new Set(JSON.parse(sessionStorage.getItem(ONCE) || '[]')); } catch { this.sent = new Set(); }
  }

  /** Switch on (only where the site config says so) and count the visit. */
  start(edition = 'online') {
    if (this.enabled) return;
    this.enabled = true;
    this.ctx.edition = edition;
    window.caches?.keys().then((keys) => {
      const v = Math.max(0, ...keys.map((k) => Number((/^minicrafter-v(\d+)$/.exec(k) || [])[1] || 0)));
      if (v) this.ctx.version = `v${v}`;
    }).catch(() => {}).finally(() => this.event('visit'));
    window.addEventListener('error', (e) => this.error(e.message || 'error', `${(e.filename || '').split('/').pop()}:${e.lineno || 0}:${e.colno || 0}`));
    window.addEventListener('unhandledrejection', (e) => {
      const r = e.reason;
      const frame = (r && r.stack ? String(r.stack).split('\n').find((l) => /\.js/.test(l)) : '') || '';
      this.error(r && r.message ? r.message : String(r).slice(0, 200), (frame.match(/([\w-]+\.js:\d+:\d+)/) || [])[1] || 'promise');
    });
    setInterval(() => this.flush(), 15000);
    addEventListener('pagehide', () => this.flush(true));
    document.addEventListener('visibilitychange', () => {
      this.lastBeat = 0; // frames pause while hidden: that gap is not a freeze
      if (document.visibilityState === 'hidden') this.flush(true);
    });
    addEventListener('pageshow', () => { this.lastBeat = 0; });
  }

  /** Counts a thing that happened, at most once per browser session. */
  event(name, extra = {}) {
    if (!this.enabled || this.sent.has(name)) return;
    this.sent.add(name);
    try { sessionStorage.setItem(ONCE, JSON.stringify([...this.sent])); } catch { /* ignore */ }
    if (extra.mode) this.ctx.mode = extra.mode;
    this.queue.push(name);
    if (name === 'visit') this.flush();
  }

  /** Remembers a game step, like "opened Bit's panel" (kept in memory, sent only with a problem report). */
  step(text) {
    const t = Math.round((performance.now() - this.t0) / 1000);
    this.steps.push(`${t}s ${text}`);
    if (this.steps.length > 12) this.steps.shift();
  }

  /** Called every frame: notices when the game froze for a while and then recovered. */
  beat(now = performance.now()) {
    if (this.lastBeat && document.visibilityState === 'visible' && now - this.lastBeat > FREEZE_MS) {
      this.problem('freeze', `The game froze for ${Math.round((now - this.lastBeat) / 1000)} s`, 'frame loop');
    }
    this.lastBeat = now;
  }

  screen() {
    const standalone = navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    const touch = navigator.maxTouchPoints > 0;
    return `${innerWidth}x${innerHeight} ${[innerWidth > innerHeight ? 'landscape' : 'portrait', touch ? 'touch' : '', standalone ? 'installed' : ''].filter(Boolean).join(', ')}`;
  }

  error(message, place = '') { this.problem('error', message, place); }

  /** A player pressed "Report a problem" and picked a category. */
  report(category) { return this.problem('report', REPORTS.includes(category) ? category : 'Something else', this.where || 'menu', true); }

  problem(kind, message, place, always = false) {
    if (!this.enabled || (!always && this.errors >= MAX_ERRORS)) return false;
    this.errors++;
    this.step(`problem: ${kind}`);
    this.post('./api/errors', { kind, message: String(message).slice(0, 300), place: String(place).slice(0, 120), steps: this.steps, screen: this.screen(), ctx: this.ctx }, false);
    return true;
  }

  flush(closing = false) {
    if (!this.queue.length) return;
    const events = this.queue.splice(0, 20);
    this.post('./api/events', { events, ctx: this.ctx }, closing);
  }

  post(url, body, closing) {
    const data = JSON.stringify(body);
    try {
      if (closing && navigator.sendBeacon) { navigator.sendBeacon(url, new Blob([data], { type: 'application/json' })); return; }
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true, credentials: 'omit' }).catch(() => {});
    } catch { /* never let reporting break the game */ }
  }
}
