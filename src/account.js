// Optional accounts for the online edition (see server/accounts.mjs).
// Only a private username and a password: no email, no real name. Other players never see
// the username; in Play Together everyone still has a picked colour-and-animal name.
const HEADERS = { 'Content-Type': 'application/json', 'X-Minicrafter': '1' };

const MESSAGES = {
  'bad-username': 'Usernames are 3–20 letters, numbers or _ (no spaces).',
  'bad-password': 'Passwords need at least 8 characters.',
  taken: 'That username is taken. Try another one!',
  wrong: "That username and password don't match.",
  'slow-down': 'Too many tries. Wait a few minutes and try again.',
  'not-logged-in': 'Please log in first.',
  network: "Couldn't reach the server. Are you online?",
};
export const accountMessage = (code) => MESSAGES[code] || 'Something went wrong. Try again.';

export class Account {
  constructor() {
    this.enabled = false;  // set when the site has accounts (site-config.json)
    this.user = null;      // username when logged in
    this.onChange = null;
  }

  set(user) { this.user = user; this.onChange?.(user); }

  async refresh() {
    if (!this.enabled) return null;
    try {
      const r = await fetch('./api/me', { credentials: 'same-origin', cache: 'no-store' });
      if (r.ok) this.set((await r.json()).username || null);
    } catch { /* offline: keep what we knew */ }
    return this.user;
  }

  async post(route, body = {}) {
    try {
      const r = await fetch(`./api/${route}`, { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify(body) });
      let data = {};
      try { data = await r.json(); } catch { /* empty */ }
      return { ok: r.ok, ...data };
    } catch { return { ok: false, error: 'network' }; }
  }

  async register(username, password) { const r = await this.post('register', { username, password }); if (r.ok) this.set(r.username); return r; }
  async login(username, password) { const r = await this.post('login', { username, password }); if (r.ok) this.set(r.username); return r; }
  async logout() { const r = await this.post('logout'); this.set(null); return r; }
  async remove(password) { const r = await this.post('delete', { password }); if (r.ok) this.set(null); return r; }
}
