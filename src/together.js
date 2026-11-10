// Play Together: up to 4 players (a host and 3 friends) in the host's world.
//
// Safety: everything goes through our own small relay (server/rooms.mjs), so players never
// connect to each other directly. The host lets each player in. Players are named from a
// picked list ("Blue Fox"), never typed, and talk only with emoji. Everything a guest
// receives is treated as untrusted data and checked before use.
//
// Shape: guests only talk to the host; the host passes changes on to everyone.
//   host -> guest: snap (world, in parts), e (block edits), pl (players), m (animals), t (time), emo, roster, give
//   guest -> host: me (position), e (block edits), emo, mob (pat / feed / shear / sit / wear)
import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { nameTag } from './mobs.js';

export const COLORS = [
  ['Red', '#e5484d'], ['Orange', '#f2862e'], ['Yellow', '#f5c518'], ['Green', '#4caf50'],
  ['Blue', '#3b82f6'], ['Purple', '#9b5de5'], ['Pink', '#f472b6'], ['Teal', '#14b8a6'],
];
export const ANIMALS = ['Fox', 'Panda', 'Otter', 'Koala', 'Tiger', 'Bunny', 'Owl', 'Frog', 'Penguin', 'Turtle', 'Lion', 'Whale'];
export const EMOJI = ['👋', '❤️', '😂', '👍', '🎉', '😮', '❓', '🙏'];
const MAX_EDITS = 400;          // per message
const PART = 60 * 1024;         // snapshot part size
const PROFILE_KEY = 'minicrafter:profile';

const colorOf = (name) => COLORS.find(([n]) => n === name) || null;
export const isProfile = (p) => p && colorOf(p.color) && ANIMALS.includes(p.animal);
export const profileName = (p) => `${p.color} ${p.animal}`;

export function loadProfile() {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY)); if (isProfile(p)) return p; } catch { /* ignore */ }
  return { color: COLORS[Math.floor(Math.random() * COLORS.length)][0], animal: ANIMALS[Math.floor(Math.random() * ANIMALS.length)] };
}
export function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* ignore */ } }

// Online features (Play Together, and accounts later) only run on our own hosted site.
// ./site-config.json says whether they're on: the copy in Git (and so on GitHub Pages) says
// off, and tools/deploy-site.sh uploads an "on" version to our own site.
export const SITE = { online: false, rooms: '', accounts: false, insights: false, onlineUrl: '' };
const isDev = () => ['localhost', '127.0.0.1'].includes(location.hostname);

export async function loadSiteConfig() {
  try {
    const r = await fetch('./site-config.json', { cache: 'no-cache' });
    if (r.ok) {
      const c = await r.json();
      if (c && typeof c.onlineUrl === 'string' && /^https:\/\/[\w.-]+\/$/.test(c.onlineUrl)) SITE.onlineUrl = c.onlineUrl; // free edition: where the online one is
      if (c && c.online === true && typeof c.rooms === 'string' && /^\/[\w/-]*$/.test(c.rooms)) { SITE.online = true; SITE.rooms = c.rooms; SITE.accounts = c.accounts === true; SITE.insights = c.insights === true; }
    }
  } catch { /* offline or no config: free edition */ }
  if (isDev() || new URLSearchParams(location.search).has('rooms')) SITE.online = true; // development and tests
  return SITE;
}

/** Where the relay lives: the same site (path from site-config.json). ?rooms=ws://host:port overrides it for testing. */
export function roomsURL() {
  const q = new URLSearchParams(location.search).get('rooms');
  if (q && /^wss?:\/\/[\w.:-]+(\/[\w-]*)?\/?$/.test(q)) return q;
  if (isDev() && !SITE.rooms) return `ws://${location.hostname}:8787`; // plain static dev server: separate relay
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${SITE.rooms || '/rooms'}`;
}

// ---------- avatars ----------
function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
  return m;
}
function buildAvatar(profile) {
  const shirt = new THREE.Color(colorOf(profile.color)?.[1] || '#888');
  const g = new THREE.Group();
  const legs = [box(0.2, 0.7, 0.22, 0x2d3a5a), box(0.2, 0.7, 0.22, 0x2d3a5a)];
  legs.forEach((l, i) => { l.geometry.translate(0, -0.35, 0); l.position.set(i ? 0.12 : -0.12, 0.7, 0); g.add(l); });
  const body = box(0.5, 0.65, 0.28, shirt); body.position.y = 1.03; g.add(body);
  const arms = [box(0.16, 0.6, 0.18, shirt), box(0.16, 0.6, 0.18, shirt)];
  arms.forEach((a, i) => { a.geometry.translate(0, -0.27, 0); a.position.set(i ? 0.34 : -0.34, 1.32, 0); g.add(a); });
  const head = new THREE.Group(); head.position.y = 1.6; g.add(head);
  head.add(box(0.44, 0.44, 0.44, 0xf1c9a5));
  const hair = box(0.46, 0.12, 0.46, shirt.clone().multiplyScalar(0.6)); hair.position.y = 0.2; head.add(hair);
  for (const x of [-0.1, 0.1]) { const e = box(0.07, 0.07, 0.02, 0x1b2433); e.position.set(x, 0.02, 0.225); head.add(e); }
  const tag = nameTag(profileName(profile)); tag.position.y = 2.15; g.add(tag);
  return { group: g, head, legs, arms, tag, phase: 0 };
}

function emojiSprite(e) {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const ctx = c.getContext('2d');
  ctx.font = '72px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, 48, 54);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(0.7, 0.7, 1);
  return s;
}

export class Together {
  /**
   * @param {object} h hooks: scene, getWorld(), getPlayer(), mobs, getTime(), setTime(t), getMode(),
   *   snapshot() -> {seed, mode, time, edits}, startGuest(snap), endGuest(reason), onStatus(), onKnock(id, profile),
   *   onMobAction(id, act, extra, from), onGive(item, n), toast(text), sfx
   */
  constructor(h) {
    Object.assign(this, h);
    this.role = null;      // null | 'host' | 'guest' | 'connecting' | 'waiting'
    this.ws = null;
    this.code = '';
    this.myId = -1;
    this.peers = new Map(); // id -> { profile, avatar, pos, yaw, pitch, target }
    this.knocks = new Map(); // id -> profile (waiting at the door)
    this.out = [];          // queued block edits
    this.applying = false;  // true while applying edits that came from the network
    this.locked = false;
    this.parts = null;
    this.tSend = 0; this.tMobs = 0; this.tTime = 0; this.tBeat = 0;
    this.profile = loadProfile();
  }

  get active() { return this.role === 'host' || this.role === 'guest'; }
  get isGuest() { return this.role === 'guest'; }
  get isHost() { return this.role === 'host'; }
  get count() { return this.active ? this.peers.size + 1 : 0; }

  // ---------- connection ----------
  connect(onOpen) {
    this.leave(true);
    this.role = 'connecting';
    this.onStatus?.();
    let ws;
    try { ws = new WebSocket(roomsURL()); } catch { this.fail("Couldn't reach Play Together. Are you online?"); return; }
    this.ws = ws;
    const timer = setTimeout(() => { if (ws.readyState !== 1) { ws.close(); this.fail("Couldn't reach Play Together. Are you online?"); } }, 8000);
    ws.onopen = () => { clearTimeout(timer); onOpen(); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.onServer(m); };
    ws.onclose = () => {
      clearTimeout(timer);
      if (this.ws !== ws) return;
      const was = this.role;
      this.ws = null;
      if (was === 'guest') this.endGuest?.('The game ended (the connection was lost).');
      if (was === 'connecting') this.fail("Couldn't reach Play Together. Are you online?");
      else this.reset();
    };
  }

  host() {
    if (!['creative', 'survival'].includes(this.getMode())) { this.toast?.('Play Together works in Creative and Survival worlds.'); return; }
    this.connect(() => this.raw({ t: 'host' }));
  }

  join(code) {
    const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 4) { this.toast?.('Room codes have 4 letters and numbers'); return; }
    this.connect(() => this.raw({ t: 'join', code: c, name: profileName(this.profile), color: this.profile.color }));
  }

  /** Leave the room (as host this ends it for everyone). */
  leave(silent = false) {
    const wasGuest = this.role === 'guest' || this.role === 'waiting';
    const ws = this.ws;
    this.ws = null;
    if (ws) try { ws.close(); } catch { /* ignore */ }
    this.reset();
    if (wasGuest && !silent) this.endGuest?.('You left the game.');
  }

  reset() {
    for (const p of this.peers.values()) this.scene.remove(p.avatar.group);
    this.peers.clear(); this.knocks.clear();
    this.role = null; this.code = ''; this.myId = -1; this.out = []; this.parts = null; this.locked = false;
    if (this.mobs) this.mobs.puppet = false;
    this.onStatus?.();
  }

  fail(text) { this.reset(); this.error = text; this.toast?.(text); this.onStatus?.(); }

  raw(obj) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  send(d, to) { this.raw(to == null ? { t: 'msg', d } : { t: 'msg', d, to }); }

  admit(id, ok) {
    if (!this.isHost) return;
    this.knocks.delete(id);
    this.raw({ t: 'admit', id, ok: !!ok });
    this.onStatus?.();
  }
  kick(id) { if (this.isHost) this.raw({ t: 'kick', id }); }
  setLocked(on) { this.locked = !!on; this.raw({ t: 'lock', on: this.locked }); this.onStatus?.(); }

  // ---------- server messages ----------
  onServer(m) {
    const WHY = {
      'no-room': "There's no game with that code. Check the letters and try again.",
      full: 'That game is full (4 players).', locked: 'That game is locked.', declined: 'The host said not right now.',
      removed: 'The host removed you from the game.', busy: 'Play Together is very busy. Try again soon.',
      'slow-down': 'Too many wrong codes. Wait a minute and try again.',
    };
    switch (m.t) {
      case 'room': this.role = 'host'; this.code = m.code; this.myId = 0; this.error = ''; this.onStatus?.(); break;
      case 'waiting': this.role = 'waiting'; this.code = m.code; this.onStatus?.(); break;
      case 'welcome': this.myId = m.you; this.parts = []; this.onStatus?.(); break; // the world arrives next
      case 'knock': {
        const p = this.profileFrom(m);
        if (!p) { this.admit(m.id, false); break; }
        this.knocks.set(m.id, p);
        this.onKnock?.(m.id, p);
        this.onStatus?.();
        break;
      }
      case 'knock-gone': this.knocks.delete(m.id); this.onStatus?.(); break;
      case 'peer': { // the host let someone in: send them the world
        const p = this.profileFrom(m);
        if (!p) break;
        this.addPeer(m.id, p);
        this.sendSnapshot(m.id);
        this.sendRoster();
        this.toast?.(`👋 ${profileName(p)} joined!`);
        this.sfx?.pop?.();
        break;
      }
      case 'left': {
        const p = this.peers.get(m.id);
        if (p) { this.scene.remove(p.avatar.group); this.peers.delete(m.id); this.toast?.(`${profileName(p.profile)} left`); }
        this.sendRoster();
        this.onStatus?.();
        break;
      }
      case 'closed': { const was = this.role; this.ws = null; this.reset(); if (was === 'guest') this.endGuest?.('The host ended the game.'); break; }
      case 'error': {
        const was = this.role;
        this.ws?.close(); this.ws = null;
        this.reset();
        this.error = WHY[m.why] || 'Something went wrong.';
        if (was === 'guest') this.endGuest?.(this.error); else this.toast?.(this.error);
        this.onStatus?.();
        break;
      }
      case 'msg': if (m.d && typeof m.d.k === 'string') (this.isHost ? this.fromGuest(m.from, m.d) : this.fromHost(m.d)); break;
      default: break;
    }
  }

  profileFrom(m) {
    const [color, ...rest] = String(m.name || '').split(' ');
    const p = { color, animal: rest.join(' ') };
    return isProfile(p) && m.color === color ? p : null;
  }

  addPeer(id, profile) {
    if (this.peers.has(id)) return this.peers.get(id);
    const avatar = buildAvatar(profile);
    avatar.group.visible = false;
    this.scene.add(avatar.group);
    const peer = { profile, avatar, pos: new THREE.Vector3(), yaw: 0, pitch: 0, target: null };
    this.peers.set(id, peer);
    this.onStatus?.();
    return peer;
  }

  sendRoster() {
    if (!this.isHost) return;
    const list = [[0, profileName(this.profile), this.profile.color], ...[...this.peers].map(([id, p]) => [id, profileName(p.profile), p.profile.color])];
    this.send({ k: 'roster', list });
  }

  // ---------- world snapshot ----------
  sendSnapshot(to) {
    const snap = this.snapshot();
    const text = JSON.stringify(snap);
    const n = Math.ceil(text.length / PART) || 1;
    for (let i = 0; i < n; i++) this.send({ k: 'snap', i, n, part: text.slice(i * PART, (i + 1) * PART) }, to);
  }

  // ---------- host: messages from guests ----------
  fromGuest(id, d) {
    const peer = this.peers.get(id);
    if (!peer) return;
    switch (d.k) {
      case 'me': {
        const v = [d.x, d.y, d.z, d.yaw, d.pitch];
        if (!v.every(Number.isFinite)) return;
        peer.target = new THREE.Vector3(d.x, d.y, d.z); peer.yaw = d.yaw; peer.pitch = d.pitch;
        break;
      }
      case 'e': { // a guest built or broke blocks: apply here, then pass on to everyone
        const edits = this.cleanEdits(d.b);
        if (!edits.length) return;
        this.applyEdits(edits);
        this.send({ k: 'e', b: edits });
        break;
      }
      case 'emo': if (EMOJI[d.e]) { this.showEmoji(peer, d.e); this.send({ k: 'emo', id, e: d.e }); } break;
      case 'mob': if (Number.isInteger(d.id) && ['pat', 'feed', 'shear', 'sit', 'wear', 'gear'].includes(d.act)) this.onMobAction?.(d.id, d.act, d.acc, id, peer); break;
      default: break;
    }
  }

  // ---------- guest: messages from the host ----------
  fromHost(d) {
    switch (d.k) {
      case 'snap': {
        if (!this.parts || !Number.isInteger(d.i) || !Number.isInteger(d.n) || d.n > 400 || typeof d.part !== 'string') return;
        this.parts[d.i] = d.part;
        if (this.parts.filter((x) => x != null).length === d.n) {
          let snap = null;
          try { snap = JSON.parse(this.parts.join('')); } catch { /* ignore */ }
          this.parts = null;
          if (!snap || snap.seed == null || !['creative', 'survival'].includes(snap.mode)) { this.fail('That world could not be loaded.'); return; }
          this.role = 'guest';
          this.mobs.puppet = true;
          this.startGuest?.(snap);
          this.onStatus?.();
        }
        break;
      }
      case 'e': if (this.isGuest) this.applyEdits(this.cleanEdits(d.b)); break;
      case 'pl': {
        if (!this.isGuest || !Array.isArray(d.p)) return;
        for (const a of d.p.slice(0, 4)) {
          if (!Array.isArray(a) || !a.slice(0, 6).every(Number.isFinite) || a[0] === this.myId) continue;
          const peer = this.peers.get(a[0]);
          if (!peer) continue;
          peer.target = new THREE.Vector3(a[1], a[2], a[3]); peer.yaw = a[4]; peer.pitch = a[5];
        }
        break;
      }
      case 'roster': {
        if (!Array.isArray(d.list)) return;
        const keep = new Set();
        for (const [id, name, color] of d.list.slice(0, 4)) {
          if (!Number.isInteger(id) || id === this.myId) continue;
          const p = this.profileFrom({ name, color });
          if (!p) continue;
          keep.add(id);
          this.addPeer(id, p);
        }
        for (const [id, p] of [...this.peers]) if (!keep.has(id)) { this.scene.remove(p.avatar.group); this.peers.delete(id); }
        this.onStatus?.();
        break;
      }
      case 'm': if (this.isGuest) this.mobs.applyNet(d.m); break;
      case 't': if (Number.isFinite(d.v)) this.setTime?.(((d.v % 1) + 1) % 1); break;
      case 'emo': { const p = this.peers.get(d.id); if (p && EMOJI[d.e]) this.showEmoji(p, d.e); break; }
      case 'give': if (Number.isInteger(d.item) && Number.isInteger(d.n) && d.n > 0 && d.n <= 8) this.onGive?.(d.item, d.n); break;
      default: break;
    }
  }

  // ---------- block edits ----------
  /** Called for every local block change (from main's world.onChange). */
  queueEdit(x, y, z, id) {
    if (!this.active || this.applying) return;
    this.out.push([x, y, z, id]);
  }

  cleanEdits(b) {
    if (!Array.isArray(b)) return [];
    const out = [];
    for (const e of b.slice(0, MAX_EDITS)) {
      if (!Array.isArray(e) || e.length !== 4 || !e.every(Number.isInteger)) continue;
      const [x, y, z, id] = e;
      if (y < 1 || y > 95 || Math.abs(x) > 1e6 || Math.abs(z) > 1e6) continue;
      if (id !== 0 && !BLOCKS[id]) continue;
      out.push(e);
    }
    return out;
  }

  applyEdits(edits) {
    const W = this.getWorld();
    this.applying = true;
    try { for (const [x, y, z, id] of edits) W.setBlock(x, y, z, id); } finally { this.applying = false; }
    W.flushDirty();
  }

  flushEdits() {
    while (this.out.length) {
      const b = this.out.splice(0, MAX_EDITS);
      this.send({ k: 'e', b });
    }
  }

  // ---------- emoji ----------
  emote(i) {
    if (!this.active || !EMOJI[i]) return;
    if (this.isHost) this.send({ k: 'emo', id: 0, e: i });
    else this.send({ k: 'emo', e: i });
    this.toast?.(`You: ${EMOJI[i]}`);
  }

  showEmoji(peer, i) {
    const a = peer.avatar;
    if (a.emoji) a.group.remove(a.emoji);
    a.emoji = emojiSprite(EMOJI[i]);
    a.emoji.position.y = 2.6;
    a.group.add(a.emoji);
    a.emojiTime = 3;
    this.sfx?.pop?.();
  }

  // ---------- every frame ----------
  update(dt) {
    if (!this.active || this.ws?.readyState !== 1) return;
    const P = this.getPlayer();
    this.tSend -= dt; this.tMobs -= dt; this.tTime -= dt; this.tBeat -= dt;
    this.flushEdits();
    if (this.tSend <= 0) {
      this.tSend = 0.1;
      const r = (v) => Math.round(v * 100) / 100;
      if (this.isGuest) this.send({ k: 'me', x: r(P.pos.x), y: r(P.pos.y), z: r(P.pos.z), yaw: r(P.yaw), pitch: r(P.pitch) });
      else if (this.peers.size) {
        const p = [[0, r(P.pos.x), r(P.pos.y), r(P.pos.z), r(P.yaw), r(P.pitch)]];
        for (const [id, peer] of this.peers) if (peer.target) p.push([id, r(peer.target.x), r(peer.target.y), r(peer.target.z), r(peer.yaw), r(peer.pitch)]);
        this.send({ k: 'pl', p });
      }
    }
    if (this.isHost && this.peers.size) {
      if (this.tMobs <= 0) {
        this.tMobs = 0.2;
        const centers = [P.pos, ...[...this.peers.values()].map((p) => p.target).filter(Boolean)];
        this.send({ k: 'm', m: this.mobs.netState(centers) });
      }
      if (this.tTime <= 0) { this.tTime = 2; this.send({ k: 't', v: this.getTime() }); }
    }
    if (this.tBeat <= 0) { this.tBeat = 20; this.raw({ t: 'ping' }); } // keeps the connection alive
    // Avatars glide to their latest positions.
    for (const peer of this.peers.values()) {
      const a = peer.avatar;
      if (!peer.target) continue;
      a.group.visible = true;
      const before = peer.pos.clone();
      if (peer.pos.distanceTo(peer.target) > 6) peer.pos.copy(peer.target); else peer.pos.lerp(peer.target, Math.min(1, dt * 12));
      const moved = Math.hypot(peer.pos.x - before.x, peer.pos.z - before.z);
      a.phase += moved * 5;
      const swing = Math.sin(a.phase) * Math.min(0.8, moved / Math.max(dt, 1e-3) * 0.15);
      a.legs[0].rotation.x = swing; a.legs[1].rotation.x = -swing;
      a.arms[0].rotation.x = -swing; a.arms[1].rotation.x = swing;
      a.group.position.copy(peer.pos);
      a.group.rotation.y = peer.yaw + Math.PI;
      a.head.rotation.x = -peer.pitch * 0.8;
      if (a.emoji && (a.emojiTime -= dt) <= 0) { a.group.remove(a.emoji); a.emoji = null; }
    }
  }
}
