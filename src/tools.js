// Creative "power tools" for fast building, plus undo / redo.
// Shapes are computed as lists of cells; the game applies them in one action
// (capped so tablets stay smooth and saves stay small).
import * as THREE from 'three';

export const MAX_CELLS = 2000;
export const MAX_SPHERE_R = 8;

/** Straight line of cells from a to b (inclusive): bridges, poles, slides. */
export function lineCells(a, b) {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
  const out = [];
  const seen = new Set();
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const c = [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
    const k = c.join(',');
    if (!seen.has(k)) { seen.add(k); out.push(c); }
  }
  return out;
}

const bounds = (a, b) => [0, 1, 2].map((i) => [Math.min(a[i], b[i]), Math.max(a[i], b[i])]);
const volume = (a, b) => bounds(a, b).reduce((v, [lo, hi]) => v * (hi - lo + 1), 1);

/** Filled box between two corners. Returns null if it would be too big. */
export function boxCells(a, b) {
  if (volume(a, b) > MAX_CELLS * 4) return null;
  const [[x0, x1], [y0, y1], [z0, z1]] = bounds(a, b);
  const out = [];
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push([x, y, z]);
  return out;
}

/** House walls: a hollow box with a floor and no roof (so kids can walk in). */
export function wallsCells(a, b) {
  if (volume(a, b) > MAX_CELLS * 20) return null;
  const [[x0, x1], [y0, y1], [z0, z1]] = bounds(a, b);
  const out = [];
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (y === y0 || x === x0 || x === x1 || z === z0 || z === z1) out.push([x, y, z]);
  }
  return out;
}

/** Hollow sphere shell centred on `c` with the radius set by the second point. */
export function sphereCells(c, p) {
  const r = Math.min(MAX_SPHERE_R, Math.max(1, Math.round(Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]))));
  const out = [];
  for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y, z);
    if (d <= r + 0.5 && d > r - 0.5) out.push([c[0] + x, c[1] + y, c[2] + z]);
  }
  return out;
}

/** Bounding box (min corner, max corner) for the live preview of a shape. */
export function previewBounds(kind, a, b) {
  if (kind === 'sphere') {
    const r = Math.min(MAX_SPHERE_R, Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))));
    return [[a[0] - r, a[1] - r, a[2] - r], [a[0] + r, a[1] + r, a[2] + r]];
  }
  const bb = bounds(a, b);
  return [bb.map((v) => v[0]), bb.map((v) => v[1])];
}

export const SHAPES = { line: lineCells, box: boxCells, walls: wallsCells, sphere: sphereCells };

// ---------- live preview ----------
export class ToolPreview {
  constructor(scene) {
    const mk = (color) => {
      const m = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }));
      m.renderOrder = 20; m.visible = false; scene.add(m);
      return m;
    };
    this.anchor = mk(0xffe27a);
    this.box = mk(0x7cf0ff);
    // A soft see-through fill makes the shape easy to see (WebGL lines are always 1px thin).
    this.fill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x7cf0ff, transparent: true, opacity: 0.18, depthWrite: false, fog: false }));
    this.fill.renderOrder = 19; this.fill.visible = false; scene.add(this.fill);
  }

  show(a, min, max, erase) {
    this.anchor.visible = true;
    this.anchor.position.set(a[0] + 0.5, a[1] + 0.5, a[2] + 0.5);
    this.anchor.scale.setScalar(1.02);
    if (!min) { this.box.visible = false; this.fill.visible = false; return; }
    const col = erase ? 0xff6b6b : 0x7cf0ff;
    for (const m of [this.box, this.fill]) {
      m.visible = true;
      m.material.color.set(col);
      m.position.set((min[0] + max[0] + 1) / 2, (min[1] + max[1] + 1) / 2, (min[2] + max[2] + 1) / 2);
      m.scale.set(max[0] - min[0] + 1.02, max[1] - min[1] + 1.02, max[2] - min[2] + 1.02);
    }
  }

  hide() { this.anchor.visible = false; this.box.visible = false; this.fill.visible = false; }
}

// ---------- undo / redo ----------
export class History {
  constructor(limit = 50) { this.limit = limit; this.undoStack = []; this.redoStack = []; this.current = null; this.applying = false; }

  begin() { if (!this.applying) this.current = []; }

  /** Called for every block change while an action is open. */
  record(x, y, z, from, to) { if (this.current && !this.applying) this.current.push([x, y, z, from, to]); }

  commit() {
    const a = this.current;
    this.current = null;
    if (!a || !a.length) return;
    this.undoStack.push(a);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** Reverts the last action with `set(x,y,z,id)`. Returns the number of blocks changed. */
  undo(set) {
    const a = this.undoStack.pop();
    if (!a) return 0;
    this.applying = true;
    for (let i = a.length - 1; i >= 0; i--) set(a[i][0], a[i][1], a[i][2], a[i][3]);
    this.applying = false;
    this.redoStack.push(a);
    return a.length;
  }

  redo(set) {
    const a = this.redoStack.pop();
    if (!a) return 0;
    this.applying = true;
    for (const c of a) set(c[0], c[1], c[2], c[4]);
    this.applying = false;
    this.undoStack.push(a);
    return a.length;
  }

  clear() { this.undoStack.length = 0; this.redoStack.length = 0; this.current = null; }
}
