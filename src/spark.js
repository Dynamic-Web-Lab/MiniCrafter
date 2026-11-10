// Spark circuits (Adventure A3, but available in every mode: it's building, not fighting).
//
// Sources:  Lever (click to flip), Button (click: on for 1 s), Pressure Plate (on while
//           someone stands on it), Battery (always on).
// Wire:     Spark Wire carries power to everything it touches, and climbs one block up or down.
// Gates:    Inverter (output is ON when its input is OFF), Delay (copies its input 0.4 s later).
//           Gates read the block behind them and power the block their arrow points at.
// Outputs:  Spark Lamp (lights up), Spark Door (opens), Spark Piston (pushes up to 12 blocks).
//
// The world stores one byte per block, so every on/off state and facing is its own block ID.
// Circuit blocks only ever come from edits, so we keep a registry of their positions and run
// a small simulation 10 times a second near the player.
import { B, BLOCKS, SPARK_DIRS } from './blocks.js';

const TICK = 0.1;          // seconds per circuit tick
const BUTTON_TICKS = 10;   // a button stays on for 1 s
const DELAY_TICKS = 4;     // a Delay waits 0.4 s
const PUSH_LIMIT = 12;     // a piston pushes at most 12 blocks
const RANGE = 64;          // only circuits this close to the player run
const MAX_WIRE = 4096;     // safety cap for one wire network
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const key = (x, y, z) => `${x},${y},${z}`;
const IMMOVABLE = new Set([B.BEDROCK, B.LOST_CHEST, B.PISTON_HEAD, B.STAR]);
for (let d = 0; d < 5; d++) IMMOVABLE.add(B.PISTON_OUT + d);

export const isSpark = (id) => !!BLOCKS[id]?.spark;
const kind = (id) => BLOCKS[id]?.spark;
const OMNI = new Set([B.LEVER_ON, B.BUTTON_ON, B.PLATE_ON, B.BATTERY]); // power every neighbour

export class Spark {
  /** @param {object} o { getPlayer(), getMobs(), sfx, onChange(), onEvent(kind) } */
  constructor(o) {
    Object.assign(this, o);
    this.world = null;
    this.nodes = new Map();   // "x,y,z" -> [x, y, z] for every circuit block
    this.timers = new Map();  // buttons: key -> ticks left
    this.pending = new Map(); // delays: key -> { want, t }
    this.doorPower = new Map(); // doors follow power changes (edge), so they can also be clicked
    this.acc = 0;
    this.internal = false;    // true while the circuit itself changes blocks (kept out of undo)
    this.ticks = 0;
  }

  /** New world: find every circuit block in the saved edits. */
  reset(world) {
    this.world = world;
    this.nodes.clear(); this.timers.clear(); this.pending.clear(); this.doorPower.clear();
    this.acc = 0;
    const CS = 16;
    for (const [ck, m] of world.edits) {
      const [cx, cz] = ck.split(',').map(Number);
      for (const [i, id] of m) {
        if (!isSpark(id)) continue;
        const x = i % CS, z = Math.floor(i / CS) % CS, y = Math.floor(i / (CS * CS));
        this.track(cx * CS + x, y, cz * CS + z, 0, id);
      }
    }
  }

  /** Called for every block change in the world. */
  track(x, y, z, from, to) {
    const k = key(x, y, z);
    if (isSpark(to)) this.nodes.set(k, [x, y, z]);
    else if (isSpark(from)) { this.nodes.delete(k); this.timers.delete(k); this.pending.delete(k); this.doorPower.delete(k); }
  }

  /** Changes a block on behalf of the circuit (not an undo step). */
  set(x, y, z, id) {
    this.internal = true;
    try { return this.world.setBlock(x, y, z, id); } finally { this.internal = false; }
  }

  /** Block at (x,y,z) if its chunk is loaded, else -1 (circuits don't load far chunks). */
  get(x, y, z) {
    if (y < 0 || y >= 96) return -1;
    const c = this.world.chunks.get(`${Math.floor(x / 16)},${Math.floor(z / 16)}`);
    if (!c) return -1;
    return c.data[(y * 16 + (z - c.cz * 16)) * 16 + (x - c.cx * 16)];
  }

  /** Right-click on a circuit block. Returns true when it did something. */
  interact(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    const k = kind(id);
    if (k === 'lever') { this.set(x, y, z, id === B.LEVER ? B.LEVER_ON : B.LEVER); this.click(id === B.LEVER ? 900 : 600); }
    else if (k === 'button') { this.set(x, y, z, B.BUTTON_ON); this.timers.set(key(x, y, z), BUTTON_TICKS); this.click(800); }
    else if (k === 'door') { this.set(x, y, z, id === B.SPARK_DOOR ? B.SPARK_DOOR_OPEN : B.SPARK_DOOR); this.click(300); }
    else return false;
    this.world.flushDirty();
    if (!this.passive) this.tick(); // react right away (in Play Together only the host runs circuits)
    return true;
  }

  click(freq) { this.sfx?.tone?.(freq, 0.05, 'square', 0.08); }

  update(dt) {
    if (!this.world || !this.nodes.size) return;
    this.acc = Math.min(this.acc + dt, TICK * 5);
    while (this.acc >= TICK) { this.acc -= TICK; this.tick(); }
  }

  /** One circuit step: work out what is powered from the current states, then update everything at once. */
  tick() {
    this.ticks++;
    const P = this.getPlayer();
    const near = [];
    for (const [k, p] of this.nodes) {
      if (Math.abs(p[0] - P.pos.x) > RANGE || Math.abs(p[2] - P.pos.z) > RANGE) continue;
      const id = this.get(p[0], p[1], p[2]);
      if (id < 0) continue;
      if (!isSpark(id)) { this.nodes.delete(k); continue; } // stale
      near.push([p[0], p[1], p[2], id, k]);
    }
    if (!near.length) return;

    // Who is standing on a pressure plate?
    const standing = new Set();
    const bodies = [P.pos, ...(this.getMobs?.() || []).map((m) => m.pos)];
    for (const b of bodies) standing.add(key(Math.floor(b.x), Math.floor(b.y + 0.05), Math.floor(b.z)));

    const powered = this.wirePower(near);
    const changes = [];
    const want = (n, id) => { if (id !== n[3]) changes.push([n[0], n[1], n[2], id]); };
    for (const n of near) {
      const [x, y, z, id, k] = n;
      const blk = BLOCKS[id];
      switch (blk.spark) {
        case 'wire': want(n, powered.has(k) ? B.WIRE_ON : B.WIRE); break;
        case 'button': {
          const t = this.timers.get(k);
          if (id === B.BUTTON_ON && !(t > 0)) want(n, B.BUTTON);
          else if (t > 0) this.timers.set(k, t - 1);
          break;
        }
        case 'plate': want(n, standing.has(k) ? B.PLATE_ON : B.PLATE); break;
        case 'inverter': {
          const input = this.inputOn(x, y, z, blk.dir, powered);
          want(n, (input ? B.INVERTER : B.INVERTER_ON) + blk.dir);
          break;
        }
        case 'delay': {
          const input = this.inputOn(x, y, z, blk.dir, powered);
          if (input === !!blk.on) { this.pending.delete(k); break; }
          const p = this.pending.get(k);
          if (!p || p.want !== input) this.pending.set(k, { want: input, t: DELAY_TICKS - 1 });
          else if (--p.t <= 0) { this.pending.delete(k); want(n, (input ? B.DELAY_ON : B.DELAY) + blk.dir); }
          break;
        }
        case 'lamp': {
          const on = this.poweredAt(x, y, z, powered);
          if (on && id === B.SPARK_LAMP) this.onEvent?.('lamp');
          want(n, on ? B.SPARK_LAMP_ON : B.SPARK_LAMP);
          break;
        }
        case 'door': {
          const on = this.poweredAt(x, y, z, powered);
          const was = this.doorPower.get(k);
          if (was !== undefined && on !== was) { want(n, on ? B.SPARK_DOOR_OPEN : B.SPARK_DOOR); if (on) this.onEvent?.('door'); }
          this.doorPower.set(k, on);
          break;
        }
        case 'piston': {
          const [dx, dy, dz] = SPARK_DIRS[blk.dir];
          const front = this.get(x + dx, y + dy, z + dz);
          if (blk.on && front !== B.PISTON_HEAD) { want(n, B.PISTON + blk.dir); break; } // its pusher was broken
          const on = this.poweredAt(x, y, z, powered);
          if (on && !blk.on) changes.push(['push', n]);
          else if (!on && blk.on) changes.push(['pull', n]);
          break;
        }
        case 'head': { // a pusher with no extended piston behind it is cleaned up
          let ok = false;
          for (let d = 0; d < 5 && !ok; d++) {
            const [dx, dy, dz] = SPARK_DIRS[d];
            ok = this.get(x - dx, y - dy, z - dz) === B.PISTON_OUT + d;
          }
          if (!ok) want(n, B.AIR);
          break;
        }
        default: break;
      }
    }
    if (!changes.length) return;
    for (const c of changes) {
      if (c[0] === 'push') this.push(c[1]);
      else if (c[0] === 'pull') this.pull(c[1]);
      else this.set(c[0], c[1], c[2], c[3]);
    }
    this.world.flushDirty();
    this.onChange?.();
  }

  /** Does the block at s give power to the cell t? */
  feeds(sx, sy, sz, tx, ty, tz, powered) {
    const id = this.get(sx, sy, sz);
    if (id < 0) return false;
    if (OMNI.has(id)) return true;
    const blk = BLOCKS[id];
    if (blk?.spark === 'wire') return powered.has(key(sx, sy, sz));
    if ((blk?.spark === 'inverter' || blk?.spark === 'delay') && blk.on) {
      const [dx, dy, dz] = SPARK_DIRS[blk.dir];
      return sx + dx === tx && sy + dy === ty && sz + dz === tz;
    }
    return false;
  }

  /** Is any neighbour powering this cell? */
  poweredAt(x, y, z, powered) {
    for (const [dx, dy, dz] of N6) if (this.feeds(x + dx, y + dy, z + dz, x, y, z, powered)) return true;
    return false;
  }

  /** A gate's input is the block behind it. */
  inputOn(x, y, z, dir, powered) {
    const [dx, dy, dz] = SPARK_DIRS[dir];
    return this.feeds(x - dx, y - dy, z - dz, x, y, z, powered);
  }

  /** Which wires carry power: flood out from every wire touching a source or a gate's output. */
  wirePower(near) {
    const powered = new Set();
    const queue = [];
    const none = new Set();
    for (const [x, y, z, id, k] of near) {
      if (kind(id) !== 'wire') continue;
      for (const [dx, dy, dz] of N6) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (kind(this.get(nx, ny, nz)) === 'wire') continue;
        if (this.feeds(nx, ny, nz, x, y, z, none)) { powered.add(k); queue.push([x, y, z]); break; }
      }
    }
    while (queue.length && powered.size < MAX_WIRE) {
      const [x, y, z] = queue.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (const dy of [0, 1, -1]) { // wires climb one block up or down
          const nx = x + dx, ny = y + dy, nz = z + dz, k = key(nx, ny, nz);
          if (!powered.has(k) && kind(this.get(nx, ny, nz)) === 'wire') { powered.add(k); queue.push([nx, ny, nz]); }
        }
      }
      for (const dy of [1, -1]) {
        const k = key(x, y + dy, z);
        if (!powered.has(k) && kind(this.get(x, y + dy, z)) === 'wire') { powered.add(k); queue.push([x, y + dy, z]); }
      }
    }
    return powered;
  }

  /** Piston pushes the row of blocks in front of it one step. */
  push(n) {
    const [x, y, z, id] = n;
    const d = BLOCKS[id].dir;
    const [dx, dy, dz] = SPARK_DIRS[d];
    const line = [];
    let cx = x + dx, cy = y + dy, cz = z + dz;
    for (;;) {
      const b = this.get(cx, cy, cz);
      if (b < 0 || IMMOVABLE.has(b)) return; // can't push that
      if (b === B.AIR || b === B.WATER || (BLOCKS[b]?.plant)) break; // free space (plants get squashed)
      if (line.length >= PUSH_LIMIT) return;
      line.push([cx, cy, cz, b]);
      cx += dx; cy += dy; cz += dz;
    }
    if (cy < 1 || cy >= 95) return;
    for (let i = line.length - 1; i >= 0; i--) { const [lx, ly, lz, b] = line[i]; this.set(lx + dx, ly + dy, lz + dz, b); }
    this.set(x + dx, y + dy, z + dz, B.PISTON_HEAD);
    this.set(x, y, z, B.PISTON_OUT + d);
    // Carry the player (and animals) along: piston elevators!
    const cells = [[x + dx, y + dy, z + dz], ...line.map(([lx, ly, lz]) => [lx + dx, ly + dy, lz + dz])];
    const P = this.getPlayer();
    if (cells.some(([px, py, pz]) => P.intersectsBlock(px, py, pz))) {
      P.pos.x += dx; P.pos.y += dy; P.pos.z += dz;
      if (dy > 0) P.vel.y = Math.max(P.vel.y, 0);
    }
    for (const m of this.getMobs?.() || []) {
      const mx = Math.floor(m.pos.x), my = Math.floor(m.pos.y), mz = Math.floor(m.pos.z);
      if (cells.some(([px, py, pz]) => px === mx && (py === my || py === my + 1) && pz === mz)) { m.pos.x += dx; m.pos.y += dy; m.pos.z += dz; }
    }
    this.sfx?.tone?.(140, 0.12, 'triangle', 0.15, 60);
    if (line.length) this.onEvent?.('piston');
  }

  pull(n) {
    const [x, y, z, id] = n;
    const d = BLOCKS[id].dir;
    const [dx, dy, dz] = SPARK_DIRS[d];
    if (this.get(x + dx, y + dy, z + dz) === B.PISTON_HEAD) this.set(x + dx, y + dy, z + dz, B.AIR);
    this.set(x, y, z, B.PISTON + d);
    this.sfx?.tone?.(110, 0.1, 'triangle', 0.12, -30);
  }

  /** For Bit's sensor: is this block switched on, or getting power? */
  isPowered(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    if (BLOCKS[id]?.on) return true;
    const near = [];
    for (const [k, p] of this.nodes) if (Math.abs(p[0] - x) <= RANGE && Math.abs(p[2] - z) <= RANGE) { const b = this.get(p[0], p[1], p[2]); if (b >= 0) near.push([p[0], p[1], p[2], b, k]); }
    return this.poweredAt(x, y, z, this.wirePower(near));
  }
}
