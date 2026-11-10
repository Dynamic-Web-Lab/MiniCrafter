// Course Maker: players build their own obstacle courses and races.
//   Course Start   step on it to start the clock (step on it again to restart)
//   Checkpoint     saves your spot; fall off (or press R) to go back to it
//   Course Finish  stops the clock, celebrates, and remembers your best time
//   Coin           collect them during a run; they come back when the run ends
// Best times are saved with the world, one per Start pad.
import { B, BLOCKS } from './blocks.js';
import { CS } from './world.js';

const COURSE_RANGE = 128;   // coins counted around the Start pad
const MAX_RUN = 30 * 60;    // a run gives up after 30 minutes
const FALL_LIMIT = 24;      // falling this far below the checkpoint sends you back

export const fmtTime = (s) => (s < 60 ? `${s.toFixed(2)} s` : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`);

export class Course {
  /**
   * @param {object} h { getWorld(), getPlayer(), now(), onStart(run), onCheckpoint(), onCoin(run), onFinish(result), onRespawn(), onCancel(reason) }
   */
  constructor(h) {
    Object.assign(this, h);
    this.run = null;
    this.best = new Map(); // "x,y,z" of a Start pad -> best seconds
    this.internal = false; // true while coins change (not an undo step, not shared, not a real edit)
    this.taken = [];       // coins collected this run
  }

  /** New world: any coins left "collected" by a closed tab come back. */
  reset(world, saved) {
    this.run = null; this.taken = [];
    this.best = new Map(Array.isArray(saved) ? saved.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1])).slice(0, 200) : []);
    for (const [x, y, z] of this.find(world, (id) => id === B.COIN_TAKEN)) this.set(world, x, y, z, B.COIN);
  }

  toJSON() { return [...this.best].map(([k, t]) => [k, Math.round(t * 1000) / 1000]); }

  /** Placed blocks matching test (course blocks only come from player edits). */
  find(world, test, near = null) {
    const out = [];
    for (const [ck, m] of world.edits) {
      const [cx, cz] = ck.split(',').map(Number);
      if (near && (Math.abs(cx * CS - near[0]) > COURSE_RANGE + CS || Math.abs(cz * CS - near[2]) > COURSE_RANGE + CS)) continue;
      for (const [i, id] of m) {
        if (!test(id)) continue;
        const x = cx * CS + (i % CS), z = cz * CS + (Math.floor(i / CS) % CS), y = Math.floor(i / (CS * CS));
        if (world.getBlock(x, y, z) !== id) continue;
        if (near && (Math.abs(x - near[0]) > COURSE_RANGE || Math.abs(z - near[2]) > COURSE_RANGE)) continue;
        out.push([x, y, z]);
      }
    }
    return out;
  }

  set(world, x, y, z, id) {
    this.internal = true;
    try { world.setBlock(x, y, z, id); } finally { this.internal = false; }
  }

  restoreCoins() {
    const W = this.getWorld();
    for (const [x, y, z] of this.taken) if (W.getBlock(x, y, z) === B.COIN_TAKEN) this.set(W, x, y, z, B.COIN);
    this.taken = [];
    W.flushDirty();
  }

  start(x, y, z) {
    const W = this.getWorld();
    this.restoreCoins();
    const key = `${x},${y},${z}`;
    const total = this.find(W, (id) => id === B.COIN || id === B.COIN_TAKEN, [x, y, z]).length;
    this.run = { key, t0: this.now(), coins: 0, total, check: [x + 0.5, y + 1, z + 0.5], checkKey: key, finished: false };
    this.onStart?.(this.run);
  }

  finish() {
    const r = this.run;
    const time = this.now() - r.t0;
    const before = this.best.get(r.key);
    const newBest = before == null || time < before;
    if (newBest) this.best.set(r.key, time);
    this.run = null;
    const result = { time, coins: r.coins, total: r.total, best: newBest ? time : before, newBest, beatOld: newBest && before != null };
    setTimeout(() => this.restoreCoins(), 1500);
    this.onFinish?.(result);
  }

  cancel(reason) {
    if (!this.run) return;
    this.run = null;
    this.restoreCoins();
    this.onCancel?.(reason);
  }

  /** Back to the last checkpoint (R key, the ↺ button, or after a big fall). */
  respawn() {
    const r = this.run;
    if (!r) return;
    const P = this.getPlayer();
    P.pos.set(r.check[0], r.check[1], r.check[2]);
    P.vel.set(0, 0, 0);
    this.onRespawn?.();
  }

  /** Called every frame while playing. */
  update() {
    const W = this.getWorld(), P = this.getPlayer();
    const x = Math.floor(P.pos.x), z = Math.floor(P.pos.z);
    // Coins: touch them with your body.
    if (this.run) {
      for (const dy of [0.2, 1.1]) {
        const y = Math.floor(P.pos.y + dy);
        if (W.getBlock(x, y, z) === B.COIN) {
          this.set(W, x, y, z, B.COIN_TAKEN);
          W.flushDirty();
          this.taken.push([x, y, z]);
          this.run.coins++;
          this.onCoin?.(this.run, [x, y, z]);
        }
      }
      if (P.flying) return this.cancel('flying');
      if (this.now() - this.run.t0 > MAX_RUN) return this.cancel('time');
      if (P.pos.y < this.run.check[1] - FALL_LIMIT) this.respawn();
    }
    // Pads: step on them.
    if (!P.onGround) { this.lastPad = ''; return; }
    const y = Math.floor(P.pos.y - 0.05);
    const id = W.getBlock(x, y, z);
    const kind = BLOCKS[id]?.course;
    const key = `${x},${y},${z}`;
    if (!kind || kind === 'coin' || kind === 'taken') { this.lastPad = ''; return; }
    if (key === this.lastPad) return;
    this.lastPad = key;
    if (kind === 'start') this.start(x, y, z);
    else if (kind === 'check' && this.run && this.run.checkKey !== key) {
      this.run.check = [x + 0.5, y + 1, z + 0.5]; this.run.checkKey = key;
      this.onCheckpoint?.(this.run);
    } else if (kind === 'finish' && this.run) this.finish();
  }
}
