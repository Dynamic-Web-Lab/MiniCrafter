// Chunked voxel world: procedural generation, face-culled meshing with ambient
// occlusion, block edits (persisted), raycasting and chunk streaming.
import * as THREE from 'three';
import { Perlin, fbm2, hash2, hash3, smoothstep } from './noise.js';
import { B, BLOCKS, OPAQUE, TRANSPARENT } from './blocks.js';
import { tileUV } from './textures.js';

export const CS = 16;   // chunk size (x, z)
export const CH = 96;   // world height
export const SEA = 30;  // sea level

const ckey = (cx, cz) => cx + ',' + cz;
const idx = (x, y, z) => (y * CS + z) * CS + x;

// Face table: corner positions + uv corners. Triangles are (0,1,2) (2,1,3).
const FACES = [
  { dir: [-1, 0, 0], kind: 'side', shade: 0.8, corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], kind: 'side', shade: 0.8, corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], kind: 'bottom', shade: 0.5, corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], kind: 'top', shade: 1.0, corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], kind: 'side', shade: 0.65, corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], kind: 'side', shade: 0.65, corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const AO_LEVEL = [0.45, 0.62, 0.8, 1.0];

// Precompute UVs per block/face kind.
const UVS = BLOCKS.map((b) => ({ top: tileUV(b.top), bottom: tileUV(b.bottom), side: tileUV(b.side) }));

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.data = new Uint8Array(CS * CS * CH);
    this.meshes = [];
    this.meshed = false;
    this.dirty = false;
  }
}

export class Terrain {
  constructor(seed) {
    this.seed = seed;
    this.p1 = new Perlin(seed);
    this.p2 = new Perlin(seed + 1);
    this.p3 = new Perlin(seed + 2);
    this.p4 = new Perlin(seed + 3);
  }

  column(x, z) {
    const n = fbm2(this.p1, x / 160, z / 160, 5);
    const mf = smoothstep(0.05, 0.45, fbm2(this.p2, x / 420, z / 420, 3));
    const r = 1 - Math.abs(this.p2.noise2(x / 110 + 31.7, z / 110 - 12.3));
    let h = SEA + 3 + n * 13 + r * r * r * 50 * mf;
    h = Math.max(4, Math.min(CH - 14, Math.floor(h)));
    const temp = fbm2(this.p3, x / 350, z / 350, 2);
    const desert = temp > 0.25 && h < SEA + 18 && h > SEA;
    return { h, desert };
  }

  isCave(x, y, z) {
    const a = this.p1.noise3(x / 28, y / 18, z / 28);
    const b = this.p2.noise3(x / 28 + 50, y / 18, z / 28 - 20);
    if (a * a + b * b < 0.0045) return true;
    return y < 26 && this.p3.noise3(x / 40, y / 22, z / 40) > 0.48;
  }

  forest(x, z) {
    return fbm2(this.p4, x / 200, z / 200, 2);
  }
}

export class World {
  constructor(scene, seed, materials) {
    this.scene = scene;
    this.materials = materials;
    this.terrain = new Terrain(seed);
    this.seed = seed;
    this.chunks = new Map();
    this.edits = new Map(); // chunkKey -> Map(localIndex -> blockId)
    this.onEdit = null;
  }

  // ---------- data access ----------
  getChunk(cx, cz) {
    const k = ckey(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = new Chunk(cx, cz);
      this.generate(c);
      this.chunks.set(k, c);
    }
    return c;
  }

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= CH) return B.AIR;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    return c.data[idx(x - cx * CS, y, z - cz * CS)];
  }

  setBlock(x, y, z, id) {
    if (y < 1 || y >= CH) return false;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    const lx = x - cx * CS, lz = z - cz * CS;
    const i = idx(lx, y, lz);
    if (c.data[i] === id) return false;
    c.data[i] = id;
    c.dirty = true;
    const k = ckey(cx, cz);
    if (!this.edits.has(k)) this.edits.set(k, new Map());
    this.edits.get(k).set(i, id);
    // Neighbours share border faces / AO samples.
    const touch = (dx, dz) => { const n = this.chunks.get(ckey(cx + dx, cz + dz)); if (n) n.dirty = true; };
    if (lx === 0) touch(-1, 0);
    if (lx === CS - 1) touch(1, 0);
    if (lz === 0) touch(0, -1);
    if (lz === CS - 1) touch(0, 1);
    if (lx === 0 && lz === 0) touch(-1, -1);
    if (lx === CS - 1 && lz === 0) touch(1, -1);
    if (lx === 0 && lz === CS - 1) touch(-1, 1);
    if (lx === CS - 1 && lz === CS - 1) touch(1, 1);
    this.onEdit?.();
    return true;
  }

  topSolid(x, z) {
    for (let y = CH - 1; y > 0; y--) {
      const b = this.getBlock(x, y, z);
      if (b !== B.AIR && b !== B.WATER) return y;
    }
    return 0;
  }

  // ---------- generation ----------
  generate(chunk) {
    const T = this.terrain, d = chunk.data, seed = this.seed;
    const x0 = chunk.cx * CS, z0 = chunk.cz * CS;

    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const wx = x0 + lx, wz = z0 + lz;
      const { h, desert } = T.column(wx, wz);
      let surface, sub;
      if (h < SEA - 3) { surface = (hash2(wx, wz, seed) & 3) === 0 ? B.GRAVEL : B.DIRT; sub = B.DIRT; }
      else if (h <= SEA + 1) { surface = B.SAND; sub = B.SAND; }
      else if (desert) { surface = B.SAND; sub = B.SANDSTONE; }
      else if (h >= SEA + 40) { surface = B.SNOW; sub = B.STONE; }
      else if (h >= SEA + 33) { surface = B.SNOWY_GRASS; sub = B.DIRT; }
      else if (h >= SEA + 27) { surface = B.STONE; sub = B.STONE; }
      else { surface = B.GRASS; sub = B.DIRT; }

      for (let y = 0; y < CH; y++) {
        let id = B.AIR;
        if (y === 0) id = B.BEDROCK;
        else if (y <= h) {
          const depth = h - y;
          if (y < 3 && (hash3(wx, y, wz, seed) & 1)) id = B.BEDROCK;
          else if (depth === 0) id = surface;
          else if (depth <= 3) id = sub;
          else {
            id = B.STONE;
            const r = hash3(wx, y, wz, seed + 9) % 1000;
            if (r < 12) id = B.COAL_ORE;
            else if (r < 18 && y < 52) id = B.IRON_ORE;
            else if (r < 20 && y < 26) id = B.GOLD_ORE;
            else if (r < 21 && y < 16) id = B.DIAMOND_ORE;
          }
          if (id !== B.BEDROCK && y > 2 && (h > SEA + 2 || depth > 5) && T.isCave(wx, y, wz)) id = B.AIR;
        } else if (y <= SEA) id = B.WATER;
        if (id) d[idx(lx, y, lz)] = id;
      }
    }

    // Trees & cacti. Scan a 2-block margin so trees on neighbouring chunks
    // still contribute their leaves here (deterministic per world column).
    for (let tz = z0 - 2; tz < z0 + CS + 2; tz++) for (let tx = x0 - 2; tx < x0 + CS + 2; tx++) {
      const r = hash2(tx, tz, seed + 77);
      const roll = r % 1000;
      if (roll >= 32) continue;
      const { h, desert } = T.column(tx, tz);
      if (h <= SEA + 1 || h >= SEA + 27) continue;
      if (T.isCave(tx, h, tz)) continue;
      if (desert) {
        if (roll < 5) this.placeCactus(chunk, tx, h, tz, r);
        continue;
      }
      const density = T.forest(tx, tz) > 0.12 ? 32 : 4;
      if (roll < density) this.placeTree(chunk, tx, h, tz, r);
    }

    // Player edits win over generation.
    const e = this.edits.get(ckey(chunk.cx, chunk.cz));
    if (e) for (const [i, id] of e) d[i] = id;
  }

  setLocal(chunk, wx, y, wz, id, onlyAir) {
    const lx = wx - chunk.cx * CS, lz = wz - chunk.cz * CS;
    if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 1 || y >= CH) return;
    const i = idx(lx, y, lz);
    if (onlyAir && chunk.data[i] !== B.AIR) return;
    chunk.data[i] = id;
  }

  placeTree(chunk, tx, h, tz, r) {
    const trunk = 4 + ((r >>> 10) % 3);
    for (let dy = trunk - 2; dy <= trunk + 1; dy++) {
      const rad = dy >= trunk ? 1 : 2;
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        const corner = Math.abs(dx) === rad && Math.abs(dz) === rad;
        if (corner && (rad === 1 ? dy === trunk + 1 : ((r >>> (dx + dz + 16)) & 1))) continue;
        this.setLocal(chunk, tx + dx, h + dy, tz + dz, B.LEAVES, true);
      }
    }
    for (let dy = 1; dy <= trunk; dy++) this.setLocal(chunk, tx, h + dy, tz, B.LOG, false);
    this.setLocal(chunk, tx, h, tz, B.DIRT, false);
  }

  placeCactus(chunk, tx, h, tz, r) {
    const height = 1 + ((r >>> 8) % 3);
    for (let dy = 1; dy <= height; dy++) this.setLocal(chunk, tx, h + dy, tz, B.CACTUS, true);
  }

  // ---------- meshing ----------
  buildMesh(chunk) {
    const { cx, cz } = chunk;
    // 3x3 neighbourhood of chunk data so border lookups are cheap.
    const ns = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      ns.push(dx === 0 && dz === 0 ? chunk.data : this.getChunk(cx + dx, cz + dz).data);
    }
    const get = (x, y, z) => {
      if (y < 0) return B.BEDROCK;
      if (y >= CH) return B.AIR;
      const ox = x < 0 ? -1 : x >= CS ? 1 : 0;
      const oz = z < 0 ? -1 : z >= CS ? 1 : 0;
      return ns[(oz + 1) * 3 + ox + 1][idx(x - ox * CS, y, z - oz * CS)];
    };

    const groups = { solid: newGeo(), water: newGeo(), glow: newGeo() };
    const d = chunk.data;

    for (let y = 0; y < CH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const id = d[idx(x, y, z)];
      if (id === B.AIR) continue;
      const blk = BLOCKS[id];
      const isWater = id === B.WATER;
      const g = isWater ? groups.water : blk.emissive ? groups.glow : groups.solid;
      const waterTop = isWater && get(x, y + 1, z) !== B.WATER;

      for (let f = 0; f < 6; f++) {
        const face = FACES[f];
        const [dx, dy, dz] = face.dir;
        const n = get(x + dx, y + dy, z + dz);
        if (n !== B.AIR) {
          if (!TRANSPARENT[n]) continue;               // hidden behind an opaque block
          if (n === id && !blk.drawSame) continue;     // glass-glass, water-water
          if (isWater) continue;                       // water only shows against air
        }

        const uv = UVS[id][face.kind];
        const base = g.pos.length / 3;
        const ao = [0, 0, 0, 0];
        for (let v = 0; v < 4; v++) {
          const c = face.corners[v];
          let cy = c[1];
          if (waterTop && cy === 1) cy = 0.875;
          g.pos.push(x + c[0], y + cy, z + c[2]);
          g.uv.push(c[3] ? uv.u1 : uv.u0, c[4] ? uv.vTop : uv.vBot);

          let light = 1;
          if (!isWater && !blk.emissive) {
            // vertex AO from the three blocks touching this corner on the face's outer layer
            const ox = x + dx, oy = y + dy, oz = z + dz;
            const sx = c[0] * 2 - 1, sy = c[1] * 2 - 1, sz = c[2] * 2 - 1;
            let s1, s2, cc;
            if (dx !== 0) { s1 = OPAQUE[get(ox, oy + sy, oz)]; s2 = OPAQUE[get(ox, oy, oz + sz)]; cc = OPAQUE[get(ox, oy + sy, oz + sz)]; }
            else if (dy !== 0) { s1 = OPAQUE[get(ox + sx, oy, oz)]; s2 = OPAQUE[get(ox, oy, oz + sz)]; cc = OPAQUE[get(ox + sx, oy, oz + sz)]; }
            else { s1 = OPAQUE[get(ox + sx, oy, oz)]; s2 = OPAQUE[get(ox, oy + sy, oz)]; cc = OPAQUE[get(ox + sx, oy + sy, oz)]; }
            const a = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
            ao[v] = a;
            light = AO_LEVEL[a];
          }
          const l = (blk.emissive ? 1 : face.shade) * light;
          g.col.push(l, l, l);
        }
        if (ao[0] + ao[3] > ao[1] + ao[2]) g.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
        else g.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      }
    }

    this.disposeMeshes(chunk);
    for (const [name, g] of Object.entries(groups)) {
      if (!g.idx.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
      geo.setIndex(g.idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, this.materials[name]);
      mesh.position.set(cx * CS, 0, cz * CS);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      if (name === 'water') mesh.renderOrder = 1;
      this.scene.add(mesh);
      chunk.meshes.push(mesh);
    }
    chunk.meshed = true;
    chunk.dirty = false;
  }

  disposeMeshes(chunk) {
    for (const m of chunk.meshes) { this.scene.remove(m); m.geometry.dispose(); }
    chunk.meshes = [];
  }

  // ---------- streaming ----------
  /** Builds missing/dirty chunk meshes near (px,pz) within a time budget; unloads far chunks. */
  update(px, pz, radius, budgetMs = 6) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    const todo = [];
    const r2 = radius * radius + radius;
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const dd = dx * dx + dz * dz;
      if (dd > r2) continue;
      const c = this.chunks.get(ckey(pcx + dx, pcz + dz));
      if (!c || !c.meshed || c.dirty) todo.push([dd + (c && c.dirty && c.meshed ? -1000 : 0), pcx + dx, pcz + dz]);
    }
    todo.sort((a, b) => a[0] - b[0]);
    const start = performance.now();
    for (const [, cx, cz] of todo) {
      this.buildMesh(this.getChunk(cx, cz));
      if (performance.now() - start > budgetMs) break;
    }

    const keep = (radius + 2) * (radius + 2);
    for (const [k, c] of this.chunks) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (dx * dx + dz * dz > keep) { this.disposeMeshes(c); this.chunks.delete(k); }
    }
    return todo.length;
  }

  /** Rebuild edited chunks right away so edits feel instant. */
  flushDirty() {
    for (const c of this.chunks.values()) if (c.dirty && c.meshed) this.buildMesh(c);
  }

  dispose() {
    for (const c of this.chunks.values()) this.disposeMeshes(c);
    this.chunks.clear();
  }

  // ---------- raycast (voxel DDA) ----------
  raycast(origin, dir, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = sx ? Math.abs(1 / dir.x) : Infinity;
    const tdy = sy ? Math.abs(1 / dir.y) : Infinity;
    const tdz = sz ? Math.abs(1 / dir.z) : Infinity;
    let tmx = sx > 0 ? (x + 1 - origin.x) * tdx : sx < 0 ? (origin.x - x) * tdx : Infinity;
    let tmy = sy > 0 ? (y + 1 - origin.y) * tdy : sy < 0 ? (origin.y - y) * tdy : Infinity;
    let tmz = sz > 0 ? (z + 1 - origin.z) * tdz : sz < 0 ? (origin.z - z) * tdz : Infinity;
    const normal = [0, 0, 0];
    let t = 0;
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      if (id !== B.AIR && id !== B.WATER) return { x, y, z, id, normal: [...normal], dist: t };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; normal[0] = -sx; normal[1] = 0; normal[2] = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; normal[0] = 0; normal[1] = -sy; normal[2] = 0; }
      else { z += sz; t = tmz; tmz += tdz; normal[0] = 0; normal[1] = 0; normal[2] = -sz; }
    }
    return null;
  }

  /** The block the player placed at (x,y,z), or 0 if it is natural terrain / air. */
  placedBlock(x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const id = this.edits.get(ckey(cx, cz))?.get(idx(x - cx * CS, y, z - cz * CS));
    return id && id !== B.WATER ? id : 0;
  }

  // ---------- persistence ----------
  serializeEdits() {
    const out = {};
    for (const [k, m] of this.edits) if (m.size) out[k] = [...m];
    return out;
  }

  loadEdits(obj) {
    this.edits.clear();
    for (const k of Object.keys(obj || {})) this.edits.set(k, new Map(obj[k]));
  }
}

function newGeo() { return { pos: [], uv: [], col: [], idx: [] }; }
