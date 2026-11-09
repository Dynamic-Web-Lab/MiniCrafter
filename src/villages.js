// Villages: deterministic placement per world region, a simple layout (well,
// houses, gravel paths) stamped into chunks during generation, and the
// villagers' barter trades (counting practice for kids).
import { B } from './blocks.js';
import { I } from './items.js';
import { hash2 } from './noise.js';
import { SEA } from './world.js';

const REGION = 192;      // one possible village per 192x192 area
const CHANCE = 40;       // % of regions with a village (region 0,0 always has one)
const HOUSE_DIST = 11;   // from the well
const HALF = 2;          // houses are 5x5 (centre +-2)

/** Is the land around (x, z) dry, grassy and flat enough for a village? */
function siteOK(T, x, z) {
  const c = T.column(x, z);
  if (c.desert || c.h < SEA + 2 || c.h > SEA + 20) return null;
  let lo = c.h, hi = c.h;
  for (let dz = -16; dz <= 16; dz += 4) for (let dx = -16; dx <= 16; dx += 4) {
    const h = T.column(x + dx, z + dz);
    if (h.desert || h.h <= SEA) return null;
    lo = Math.min(lo, h.h); hi = Math.max(hi, h.h);
    if (hi - lo > 5) return null;
  }
  return c.h;
}

/** Returns the village for a region (or null). Cached on the terrain object. */
export function villageForRegion(T, rx, rz) {
  T.villageCache ??= new Map();
  const key = rx + ',' + rz;
  if (T.villageCache.has(key)) return T.villageCache.get(key);
  let v = null;
  const r = hash2(rx, rz, T.seed + 999);
  if ((rx === 0 && rz === 0) || r % 100 < CHANCE) {
    const tries = [];
    if (rx === 0 && rz === 0) {
      // The home region: look in a ring 40-110 blocks from the world origin so kids find it.
      for (let d = 40; d <= 110; d += 10) for (let a = 0; a < 12; a++) tries.push([Math.round(Math.cos(a * Math.PI / 6 + d) * d), Math.round(Math.sin(a * Math.PI / 6 + d) * d)]);
    } else {
      const ox = rx * REGION + 40 + (r % 110), oz = rz * REGION + 40 + ((r >>> 8) % 110);
      for (let s = 0; s < 6; s++) tries.push([ox + ((r >>> (s * 3)) % 40) - 20, oz + ((r >>> (s * 3 + 7)) % 40) - 20]);
    }
    for (const [x, z] of tries) {
      const h = siteOK(T, x, z);
      if (h != null) { v = makeLayout(x, z, h, r); break; }
    }
  }
  T.villageCache.set(key, v);
  return v;
}

const JOBS = ['farmer', 'builder', 'smith'];

function makeLayout(x, z, y, r) {
  const count = 4 + (r % 3);
  const houses = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (r % 628) / 100;
    const hx = Math.round(x + Math.cos(a) * HOUSE_DIST), hz = Math.round(z + Math.sin(a) * HOUSE_DIST);
    // Door on the side that faces the well.
    const dx = x - hx, dz = z - hz;
    const door = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx) * HALF, 0] : [0, Math.sign(dz) * HALF];
    houses.push({ x: hx, z: hz, door, job: JOBS[i % JOBS.length] });
  }
  return { id: `${x},${z}`, x, z, y, houses };
}

/** All villages whose area may touch the box [x0,x1]x[z0,z1]. */
export function villagesNear(T, x0, z0, x1, z1) {
  const out = [];
  const pad = HOUSE_DIST + HALF + 3;
  for (let rz = Math.floor((z0 - REGION) / REGION); rz <= Math.floor((z1 + REGION) / REGION); rz++)
    for (let rx = Math.floor((x0 - REGION) / REGION); rx <= Math.floor((x1 + REGION) / REGION); rx++) {
      const v = villageForRegion(T, rx, rz);
      if (v && v.x + pad >= x0 && v.x - pad <= x1 && v.z + pad >= z0 && v.z - pad <= z1) out.push(v);
    }
  return out;
}

/**
 * Stamps a village into one chunk. `set(x, y, z, id)` must ignore cells outside
 * the chunk; `groundAt(x, z)` gives the natural terrain height.
 */
export function stampVillage(v, set, groundAt) {
  const Y = v.y;
  // Flatten a plaza around each house and the well: fill below, clear above.
  const flatten = (cx, cz, rad) => {
    for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
      const x = cx + dx, z = cz + dz, g = groundAt(x, z);
      for (let y = g + 1; y < Y; y++) set(x, y, z, B.DIRT);          // fill dips
      set(x, Y, z, B.GRASS);
      for (let y = Y + 1; y <= Math.max(Y + 7, g + 9); y++) set(x, y, z, B.AIR); // clear hills and trees
    }
  };
  // A clearing: no trees inside the village circle.
  const R = HOUSE_DIST + HALF + 3;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dz * dz > R * R) continue;
    const x = v.x + dx, z = v.z + dz, g = groundAt(x, z);
    for (let y = g + 1; y <= g + 9; y++) set(x, y, z, B.AIR);
    if (Math.abs(g - Y) <= 3) set(x, g, z, B.GRASS); // trees left dirt under their trunks
  }
  flatten(v.x, v.z, 3);
  for (const h of v.houses) flatten(h.x, h.z, HALF + 1);

  // Gravel paths from the well to each door.
  for (const h of v.houses) {
    const tx = h.x + h.door[0] * 2, tz = h.z + h.door[1] * 2;
    const steps = Math.max(Math.abs(tx - v.x), Math.abs(tz - v.z));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(v.x + (tx - v.x) * s / steps), z = Math.round(v.z + (tz - v.z) * s / steps);
      const g = groundAt(x, z);
      if (Math.abs(g - Y) <= 2) { set(x, Y, z, B.GRAVEL); for (let y = Y + 1; y <= Y + 3; y++) set(x, y, z, B.AIR); for (let y = g + 1; y < Y; y++) set(x, y, z, B.DIRT); }
    }
  }

  // The well: cobblestone ring with water and a little roof on posts.
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const x = v.x + dx, z = v.z + dz;
    if (dx === 0 && dz === 0) { set(x, Y, z, B.WATER); set(x, Y - 1, z, B.WATER); set(x, Y - 2, z, B.COBBLE); }
    else { set(x, Y, z, B.COBBLE); set(x, Y + 1, z, B.COBBLE); }
    if (Math.abs(dx) === 1 && Math.abs(dz) === 1) { set(x, Y + 2, z, B.LOG); set(x, Y + 3, z, B.LOG); }
    set(x, Y + 4, z, B.STONE_BRICK);
  }

  // Houses: plank walls, log corners, glass windows, door gap, flat roof, lamp inside.
  for (const h of v.houses) {
    for (let dz = -HALF; dz <= HALF; dz++) for (let dx = -HALF; dx <= HALF; dx++) {
      const x = h.x + dx, z = h.z + dz;
      const edge = Math.abs(dx) === HALF || Math.abs(dz) === HALF;
      const corner = Math.abs(dx) === HALF && Math.abs(dz) === HALF;
      set(x, Y, z, B.PLANKS); // floor
      for (let y = Y + 1; y <= Y + 3; y++) {
        let id = B.AIR;
        if (corner) id = B.LOG;
        else if (edge) {
          id = B.PLANKS;
          const mid = dx === 0 || dz === 0;
          if (mid && y === Y + 2) id = B.GLASS;
        }
        set(x, y, z, id);
      }
      set(x, Y + 4, z, edge ? B.STONE_BRICK : B.PLANKS); // roof
    }
    // Door opening (2 high) facing the well, and a lamp in the ceiling.
    set(h.x + h.door[0], Y + 1, h.z + h.door[1], B.AIR);
    set(h.x + h.door[0], Y + 2, h.z + h.door[1], B.AIR);
    set(h.x, Y + 4, h.z, B.LAMP);
  }
}

// ---------- trades ----------
// Each trade: give [item, count] -> get [item, count]. Simple numbers for counting practice.
export const JOB_INFO = {
  farmer: { title: 'Farmer', robe: [150, 105, 60], names: ['Fern', 'Barley', 'Hazel', 'Clover'] },
  builder: { title: 'Builder', robe: [225, 140, 40], names: ['Brick', 'Mason', 'Tilly', 'Rocco'] },
  smith: { title: 'Smith', robe: [110, 110, 120], names: ['Anvil', 'Ingrid', 'Forge', 'Tess'] },
};

export const TRADES = {
  farmer: [
    { give: [B.DIRT, 10], get: [I.APPLE, 2] },
    { give: [B.PLANKS, 6], get: [I.APPLE, 1] },
    { give: [I.APPLE, 3], get: [B.WOOL_WHITE, 4] },
    { give: [B.SAND, 8], get: [B.CACTUS, 2] },
  ],
  builder: [
    { give: [B.COBBLE, 8], get: [B.STONE_BRICK, 4] },
    { give: [B.LOG, 4], get: [B.GLASS, 6] },
    { give: [I.COAL, 2], get: [B.TORCH, 8] },
    { give: [B.SAND, 6], get: [B.BRICK, 3] },
  ],
  smith: [
    { give: [B.COBBLE, 10], get: [I.IRON_INGOT, 1] },
    { give: [I.IRON_INGOT, 3], get: [I.IRON_PICK, 1] },
    { give: [I.IRON_INGOT, 5], get: [I.DIAMOND, 1] },
    { give: [I.COAL, 4], get: [B.LAMP, 1] },
  ],
};
