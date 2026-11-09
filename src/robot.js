// "Bit" the code robot: a friendly hovering helper that runs kids' programs
// one visible step at a time. Programs are a small JSON tree (see below) that
// the Blockly editor produces; the interpreter is a generator so the game loop
// can advance it frame by frame (pause/stop any time, no eval, no freezes).
//
// Program format:
//   [ stmt, ... ]
//   stmt = { op: 'move', dir: 'forward'|'back'|'up'|'down', n }
//        | { op: 'turn', dir: 'left'|'right' }
//        | { op: 'dig', dir: 'forward'|'up'|'down' }
//        | { op: 'place', dir: 'forward'|'up'|'down', block }   (block: block id or 'held')
//        | { op: 'repeat', times, body: [...] }
//        | { op: 'while', cond, body: [...] }
//        | { op: 'if', cond, then: [...], else: [...] }
//        | { op: 'say', text }
//   cond = { op: 'detect', dir } | { op: 'is', dir, block } | { op: 'not', a: cond }
import * as THREE from 'three';
import { B, BLOCKS, SOLID } from './blocks.js';

export const FACINGS = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]]; // N E S W
const MAX_ACTIONS = 3000;       // per run
const MAX_EVALS_PER_FRAME = 5000; // guards loops that never do anything
const MAX_RANGE = 64;           // blocks from the player

const DUR = { move: 0.32, turn: 0.22, dig: 0.38, place: 0.28, say: 1.2, fail: 0.6 };

// ---------- model ----------
function box(w, h, d, color, x = 0, y = 0, z = 0, emissive = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z);
  m.userData.emissive = emissive;
  return m;
}

function buildModel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(box(0.62, 0.42, 0.56, 0x3d8fd6, 0, 0.38, 0));        // torso
  body.add(box(0.5, 0.08, 0.06, 0xffc94a, 0, 0.42, 0.29));       // chest stripe
  const head = new THREE.Group();
  head.position.set(0, 0.74, 0);
  head.add(box(0.56, 0.36, 0.5, 0xdfe6ee));                      // head
  head.add(box(0.44, 0.22, 0.02, 0x10202e, 0, 0, 0.26));         // screen
  const eyeL = box(0.08, 0.1, 0.02, 0x7cf0ff, -0.1, 0.02, 0.275, true);
  const eyeR = box(0.08, 0.1, 0.02, 0x7cf0ff, 0.1, 0.02, 0.275, true);
  head.add(eyeL, eyeR);
  head.add(box(0.04, 0.16, 0.04, 0x9aa5b1, 0, 0.26, 0));          // antenna
  const tip = box(0.1, 0.1, 0.1, 0xff5a5a, 0, 0.38, 0, true);
  head.add(tip);
  body.add(head);
  const armL = box(0.12, 0.34, 0.12, 0x2d6fa8, -0.38, 0.38, 0);
  const armR = box(0.12, 0.34, 0.12, 0x2d6fa8, 0.38, 0.38, 0);
  armL.geometry.translate(0, -0.12, 0); armR.geometry.translate(0, -0.12, 0);
  armL.position.y = 0.5; armR.position.y = 0.5;
  body.add(armL, armR);
  body.add(box(0.36, 0.1, 0.36, 0x26313d, 0, 0.12, 0));          // hover base
  const glow = box(0.26, 0.04, 0.26, 0x7cf0ff, 0, 0.06, 0, true);
  body.add(glow);
  return { root, body, head, armL, armR, eyes: [eyeL, eyeR], tip, glow };
}

function bubbleSprite(text) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = 'bold 28px system-ui, sans-serif';
  const w = Math.min(560, Math.ceil(ctx.measureText(text).width) + 36);
  c.width = w; c.height = 64;
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = '#1b2433'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, 52, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b2433'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 18, 29, w - 36);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(w / 64 * 0.5, 0.5, 1);
  s.renderOrder = 10;
  return s;
}

// ---------- robot ----------
export class Robot {
  /**
   * @param {object} hooks { world, scene, getPlayer, sfx, particles,
   *   breakBlock(x,y,z,id) -> bool, placeBlock(x,y,z,blockId) -> bool|string, resolveBlock('held') -> id,
   *   onAction(action), onDone(result) }
   */
  constructor(hooks) {
    Object.assign(this, hooks);
    this.model = buildModel();
    this.model.root.visible = false;
    this.scene.add(this.model.root);
    this.placed = false;
    this.x = 0; this.y = 0; this.z = 0; this.f = 0;
    this.anim = null;         // current animation
    this.gen = null;          // running program generator
    this.actions = 0;
    this.speed = 1;
    this.bubble = null; this.bubbleTime = 0;
    this.status = 'idle';     // idle | running | done | stopped | error
    this.message = '';
    this.time = 0;
  }

  // ---------- placement ----------
  placeAt(x, y, z, facing) {
    this.x = x; this.y = y; this.z = z; this.f = ((facing % 4) + 4) % 4;
    this.placed = true;
    this.model.root.visible = true;
    this.stop('idle');
    this.syncModel();
  }

  remove() { this.placed = false; this.model.root.visible = false; this.stop('idle'); }

  syncModel() {
    this.model.root.position.set(this.x + 0.5, this.y + 0.02, this.z + 0.5);
    this.model.root.rotation.y = this.yawFor(this.f);
  }

  yawFor(f) { const [dx, , dz] = FACINGS[f]; return Math.atan2(dx, dz); }

  /** Cell offset for a direction word relative to the robot. */
  offset(dir) {
    const [fx, , fz] = FACINGS[this.f];
    if (dir === 'forward') return [fx, 0, fz];
    if (dir === 'back') return [-fx, 0, -fz];
    if (dir === 'up') return [0, 1, 0];
    if (dir === 'down') return [0, -1, 0];
    if (dir === 'left') { const [lx, , lz] = FACINGS[(this.f + 3) % 4]; return [lx, 0, lz]; }
    if (dir === 'right') { const [rx, , rz] = FACINGS[(this.f + 1) % 4]; return [rx, 0, rz]; }
    return [0, 0, 0];
  }

  blockAt(dir) {
    const [dx, dy, dz] = this.offset(dir);
    return this.world.getBlock(this.x + dx, this.y + dy, this.z + dz);
  }

  // ---------- running ----------
  run(program) {
    if (!this.placed) return false;
    this.stop('idle');
    this.gen = exec(Array.isArray(program) ? program : [], this);
    this.actions = 0;
    this.status = 'running';
    this.message = '';
    return true;
  }

  stop(status = 'stopped') {
    this.gen = null;
    if (this.anim) this.finishAnim();
    this.status = status;
  }

  get running() { return this.status === 'running'; }

  update(dt, light) {
    if (!this.placed) return;
    this.time += dt;
    // idle hover + blinking
    const m = this.model;
    m.body.position.y = Math.sin(this.time * 2.4) * 0.04;
    const blink = (this.time % 3.2) < 0.12;
    m.eyes.forEach((e) => { e.scale.y = blink ? 0.2 : 1; });
    m.root.traverse((o) => { if (o.material && !o.userData.emissive) o.material.color.setRGB(...hexRGB(o.material.userData.base ??= o.material.color.getHex()).map((v) => v * light)); });
    m.tip.material.color.set(this.running ? (Math.floor(this.time * 4) % 2 ? 0x7dff6a : 0x2a8a20) : 0xff5a5a);

    if (this.bubble) {
      this.bubbleTime -= dt;
      this.bubble.position.set(this.x + 0.5, this.y + 1.55, this.z + 0.5);
      if (this.bubbleTime <= 0) { this.scene.remove(this.bubble); this.bubble = null; }
    }

    let budget = dt * this.speed;
    // Advance the current animation; start new actions when idle.
    for (let guard = 0; guard < 8 && budget > 0; guard++) {
      if (this.anim) {
        const a = this.anim;
        const use = Math.min(budget, a.dur - a.t);
        a.t += use; budget -= use;
        this.animate(a);
        if (a.t >= a.dur) this.finishAnim(); else break;
      }
      if (!this.gen) break;
      const next = this.pull();
      if (!next) break;
      this.startAction(next);
    }
  }

  pull() {
    try {
      const r = this.gen.next();
      if (r.done) { this.gen = null; this.status = 'done'; this.onDone?.('done'); return null; }
      if (++this.actions > MAX_ACTIONS) { this.fail('That program is very long! I stopped after 3000 steps.'); return null; }
      return r.value;
    } catch (e) {
      this.fail(e.kidMessage || 'Oops, something went wrong in the program.');
      if (!e.kidMessage) console.warn(e);
      return null;
    }
  }

  fail(msg) {
    this.gen = null;
    this.status = 'error';
    this.message = msg;
    this.say(msg, 3);
    this.onDone?.('error', msg);
  }

  // ---------- actions ----------
  startAction(act) {
    const a = { ...act, t: 0, dur: (DUR[act.kind] ?? 0.3), from: [this.x, this.y, this.z], fromYaw: this.yawFor(this.f) };
    if (act.kind === 'move') {
      const [dx, dy, dz] = this.offset(act.dir);
      const nx = this.x + dx, ny = this.y + dy, nz = this.z + dz;
      const p = this.getPlayer().pos;
      if (ny < 1 || ny > 94) return this.blocked(a, 'I can\'t go any further that way.');
      if (Math.hypot(nx + 0.5 - p.x, nz + 0.5 - p.z) > MAX_RANGE) return this.blocked(a, 'That is too far from you!');
      if (SOLID[this.world.getBlock(nx, ny, nz)]) return this.blocked(a, `There is ${article(this.world.getBlock(nx, ny, nz))} in the way.`);
      a.to = [nx, ny, nz];
      this.x = nx; this.y = ny; this.z = nz; // logical position updates immediately
    } else if (act.kind === 'turn') {
      this.f = (this.f + (act.dir === 'left' ? 3 : 1)) % 4;
      a.toYaw = this.yawFor(this.f);
    } else if (act.kind === 'dig') {
      const [dx, dy, dz] = this.offset(act.dir);
      const bx = this.x + dx, by = this.y + dy, bz = this.z + dz;
      const id = this.world.getBlock(bx, by, bz);
      if (id === B.AIR || id === B.WATER) { a.kind = 'idleArm'; a.dur = 0.15; }
      else if (id === B.BEDROCK) return this.blocked(a, 'Bedrock is too strong for me!');
      else if (!this.breakBlock(bx, by, bz, id)) return this.blocked(a, 'I could not dig that.');
    } else if (act.kind === 'place') {
      const [dx, dy, dz] = this.offset(act.dir);
      const bx = this.x + dx, by = this.y + dy, bz = this.z + dz;
      const id = act.block === 'held' || act.block == null ? this.resolveBlock() : act.block;
      if (!BLOCKS[id] || !BLOCKS[id].placeable) return this.blocked(a, 'Pick a block for me to place first!');
      const there = this.world.getBlock(bx, by, bz);
      if (there !== B.AIR && there !== B.WATER) { a.kind = 'idleArm'; a.dur = 0.15; }
      else {
        const res = this.placeBlock(bx, by, bz, id);
        if (res !== true) return this.blocked(a, typeof res === 'string' ? res : 'I could not place that.');
      }
    } else if (act.kind === 'say') {
      this.say(act.text, 2.2);
    }
    this.anim = a;
    this.onAction?.(a);
  }

  blocked(a, msg) {
    // Kid-friendly: a blocked step doesn't crash the program, the robot just
    // shakes its head, says why, and carries on with the next step.
    this.say(msg, 2.2);
    this.anim = { ...a, kind: 'fail', dur: DUR.fail, t: 0 };
    this.sfx?.tone?.(180, 0.15, 'square', 0.08, -40);
  }

  animate(a) {
    const k = Math.min(1, a.t / a.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const m = this.model;
    if (a.kind === 'move' && a.to) {
      m.root.position.set(
        a.from[0] + (a.to[0] - a.from[0]) * e + 0.5,
        a.from[1] + (a.to[1] - a.from[1]) * e + 0.02,
        a.from[2] + (a.to[2] - a.from[2]) * e + 0.5);
    } else if (a.kind === 'turn') {
      let d = a.toYaw - a.fromYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      m.root.rotation.y = a.fromYaw + d * e;
    } else if (a.kind === 'dig' || a.kind === 'place' || a.kind === 'idleArm') {
      const s = Math.sin(k * Math.PI);
      const tilt = a.dir === 'up' ? -1.6 : a.dir === 'down' ? -0.4 : -1.1;
      m.armR.rotation.x = tilt * s; m.armL.rotation.x = tilt * s * 0.6;
    } else if (a.kind === 'fail') {
      m.head.rotation.y = Math.sin(k * Math.PI * 4) * 0.35 * (1 - k);
    }
  }

  finishAnim() {
    const m = this.model;
    m.armR.rotation.x = m.armL.rotation.x = 0;
    m.head.rotation.y = 0;
    this.anim = null;
    this.syncModel();
  }

  say(text, secs = 2) {
    if (this.bubble) this.scene.remove(this.bubble);
    this.bubble = bubbleSprite(String(text).slice(0, 60));
    this.bubble.position.set(this.x + 0.5, this.y + 1.55, this.z + 0.5);
    this.scene.add(this.bubble);
    this.bubbleTime = secs;
  }

  // ---------- conditions ----------
  test(cond) {
    if (!cond) return false;
    if (cond.op === 'not') return !this.test(cond.a);
    if (cond.op === 'detect') return SOLID[this.blockAt(cond.dir)] === 1;
    if (cond.op === 'is') return this.blockAt(cond.dir) === cond.block;
    return false;
  }

  // ---------- persistence ----------
  toJSON() { return this.placed ? { x: this.x, y: this.y, z: this.z, f: this.f } : null; }
  load(d) { if (d && Number.isFinite(d.x)) this.placeAt(d.x, d.y, d.z, d.f | 0); else this.remove(); }
}

// ---------- interpreter ----------
function kidError(msg) { const e = new Error(msg); e.kidMessage = msg; return e; }
const clampN = (n, max = 100) => Math.max(0, Math.min(max, Math.floor(Number(n) || 0)));

function* exec(stmts, robot) {
  let evals = 0;
  const tick = () => { if (++evals > MAX_EVALS_PER_FRAME) throw kidError('This loop never makes me do anything!'); };
  function* run(list) {
    for (const s of list || []) {
      tick();
      switch (s.op) {
        case 'move': for (let i = 0; i < clampN(s.n ?? 1, 50); i++) { evals = 0; yield { kind: 'move', dir: s.dir, id: s.id }; } break;
        case 'turn': evals = 0; yield { kind: 'turn', dir: s.dir, id: s.id }; break;
        case 'dig': evals = 0; yield { kind: 'dig', dir: s.dir || 'forward', id: s.id }; break;
        case 'place': evals = 0; yield { kind: 'place', dir: s.dir || 'forward', block: s.block, id: s.id }; break;
        case 'say': evals = 0; yield { kind: 'say', text: String(s.text ?? ''), id: s.id }; break;
        case 'repeat': for (let i = 0; i < clampN(s.times, 1000); i++) { tick(); yield* run(s.body); } break;
        case 'while': { let n = 0; while (robot.test(s.cond)) { tick(); if (++n > 1000) throw kidError('That loop went around 1000 times, so I stopped.'); yield* run(s.body); } break; }
        case 'if': if (robot.test(s.cond)) yield* run(s.then); else yield* run(s.else); break;
        default: break;
      }
    }
  }
  yield* run(stmts);
}

function article(id) {
  const name = (BLOCKS[id]?.name || 'block').toLowerCase();
  return (/^[aeiou]/.test(name) ? 'an ' : 'a ') + name;
}

function hexRGB(hex) { return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; }

// ---------- starter programs ----------
export const EXAMPLES = [
  { id: 'hello', name: 'Say hello', program: [{ op: 'say', text: 'Hi! I am Bit!' }, { op: 'turn', dir: 'left' }, { op: 'turn', dir: 'right' }, { op: 'turn', dir: 'right' }, { op: 'turn', dir: 'left' }] },
  { id: 'square', name: 'Walk a square', program: [{ op: 'repeat', times: 4, body: [{ op: 'move', dir: 'forward', n: 3 }, { op: 'turn', dir: 'right' }] }] },
  { id: 'tower', name: 'Build a tower', program: [{ op: 'repeat', times: 5, body: [{ op: 'move', dir: 'up', n: 1 }, { op: 'place', dir: 'down', block: 'held' }] }, { op: 'say', text: 'Ta-da! A tower!' }] },
  { id: 'wall', name: 'Build a wall', program: [{ op: 'repeat', times: 3, body: [{ op: 'repeat', times: 5, body: [{ op: 'place', dir: 'forward', block: 'held' }, { op: 'turn', dir: 'right' }, { op: 'move', dir: 'forward', n: 1 }, { op: 'turn', dir: 'left' }] }, { op: 'move', dir: 'up', n: 1 }, { op: 'turn', dir: 'left' }, { op: 'move', dir: 'forward', n: 5 }, { op: 'turn', dir: 'right' }] }] },
  { id: 'tunnel', name: 'Dig a tunnel', program: [{ op: 'repeat', times: 8, body: [{ op: 'dig', dir: 'forward' }, { op: 'dig', dir: 'up' }, { op: 'move', dir: 'forward', n: 1 }] }, { op: 'say', text: 'Tunnel done!' }] },
  { id: 'stairs', name: 'Build stairs', program: [{ op: 'repeat', times: 6, body: [{ op: 'place', dir: 'down', block: 'held' }, { op: 'move', dir: 'forward', n: 1 }, { op: 'move', dir: 'up', n: 1 }] }] },
  { id: 'explore', name: 'Walk until something is in the way', program: [{ op: 'while', cond: { op: 'not', a: { op: 'detect', dir: 'forward' } }, body: [{ op: 'move', dir: 'forward', n: 1 }] }, { op: 'say', text: 'Something is in my way!' }] },
];
