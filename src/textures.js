// Procedurally painted 16x16 pixel-art texture atlas (no image files needed).
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export const T = 16;          // tile size in px
export const COLS = 8;
export const ROWS = 6;
export const ATLAS_W = COLS * T;
export const ATLAS_H = ROWS * T;

export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, LOG_SIDE: 6, LOG_TOP: 7,
  LEAVES: 8, PLANKS: 9, GLASS: 10, BRICK: 11, SNOW: 12, COAL: 13, IRON: 14, WATER: 15,
  BEDROCK: 16, GRAVEL: 17, CACTUS_SIDE: 18, CACTUS_TOP: 19, GOLD: 20, SNOW_SIDE: 21, SANDSTONE: 22, STONE_BRICK: 23,
  WOOL_WHITE: 24, WOOL_RED: 25, WOOL_BLUE: 26, WOOL_YELLOW: 27, WOOL_GREEN: 28, WOOL_BLACK: 29, LAMP: 30, DIAMOND: 31,
  CRAFT_TOP: 32, CRAFT_SIDE: 33, FURNACE_FRONT: 34, FURNACE_TOP: 35, TORCH: 36,
};

export function tileUV(tile) {
  const col = tile % COLS, row = Math.floor(tile / COLS);
  const e = 0.05; // inset to avoid bleeding between tiles
  return {
    u0: (col * T + e) / ATLAS_W,
    u1: ((col + 1) * T - e) / ATLAS_W,
    vTop: 1 - (row * T + e) / ATLAS_H,
    vBot: 1 - ((row + 1) * T - e) / ATLAS_H,
  };
}

const c255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

function painter(img, rng) {
  const set = (tile, x, y, r, g, b, a = 255) => {
    const col = tile % COLS, row = Math.floor(tile / COLS);
    const i = ((row * T + y) * ATLAS_W + col * T + x) * 4;
    img.data[i] = c255(r); img.data[i + 1] = c255(g); img.data[i + 2] = c255(b); img.data[i + 3] = c255(a);
  };
  const get = (tile, x, y) => {
    const col = tile % COLS, row = Math.floor(tile / COLS);
    const i = ((row * T + y) * ATLAS_W + col * T + x) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
  };
  const paint = (tile, fn) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const c = fn(x, y);
      if (c) set(tile, x, y, c[0], c[1], c[2], c[3] ?? 255);
    }
  };
  const vary = (base, amt) => { const f = 1 + (rng() - 0.5) * amt; return [base[0] * f, base[1] * f, base[2] * f]; };
  const copy = (from, to) => paint(to, (x, y) => get(from, x, y));
  return { set, get, paint, vary, copy };
}

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W; canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(ATLAS_W, ATLAS_H);
  const rng = mulberry32(1337);
  const { paint, vary, copy, set } = painter(img, rng);

  const grass = [98, 162, 58];
  const dirt = [134, 96, 67];
  const stone = [128, 128, 128];

  paint(TILE.GRASS_TOP, () => (rng() < 0.08 ? vary([70, 130, 45], 0.2) : vary(grass, 0.28)));
  paint(TILE.DIRT, () => (rng() < 0.12 ? vary([105, 74, 52], 0.2) : vary(dirt, 0.25)));
  {
    const depth = Array.from({ length: T }, () => 3 + (rng() < 0.5 ? 1 : 0) + (rng() < 0.2 ? 1 : 0));
    paint(TILE.GRASS_SIDE, (x, y) => (y < depth[x] ? vary(grass, 0.25) : (rng() < 0.12 ? vary([105, 74, 52], 0.2) : vary(dirt, 0.25))));
    paint(TILE.SNOW_SIDE, (x, y) => (y < depth[x] ? vary([240, 245, 250], 0.06) : vary(dirt, 0.25)));
  }
  paint(TILE.STONE, () => (rng() < 0.1 ? vary([105, 105, 105], 0.15) : vary(stone, 0.18)));

  // Cobblestone: wrapped voronoi cells with dark mortar edges.
  {
    const pts = Array.from({ length: 8 }, () => [rng() * T, rng() * T, 0.75 + rng() * 0.45]);
    paint(TILE.COBBLE, (x, y) => {
      let d1 = 1e9, d2 = 1e9, cell = 0;
      pts.forEach((p, i) => {
        for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) {
          const d = Math.hypot(x + 0.5 - p[0] - ox, y + 0.5 - p[1] - oy);
          if (d < d1) { d2 = d1; d1 = d; cell = i; } else if (d < d2) d2 = d;
        }
      });
      if (d2 - d1 < 1.1) return vary([70, 70, 70], 0.15);
      const f = pts[cell][2];
      return vary([125 * f, 125 * f, 125 * f], 0.15);
    });
  }
  paint(TILE.SAND, () => vary([219, 207, 163], 0.1));
  {
    const stripe = Array.from({ length: T }, () => 0.8 + rng() * 0.35);
    paint(TILE.LOG_SIDE, (x) => vary([102 * stripe[x], 81 * stripe[x], 51 * stripe[x]], 0.15));
  }
  paint(TILE.LOG_TOP, (x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 6.6) return vary([102, 81, 51], 0.15);
    const ring = Math.floor(d) % 2 === 0;
    return vary(ring ? [176, 144, 90] : [150, 120, 72], 0.08);
  });
  paint(TILE.LEAVES, () => (rng() < 0.2 ? [0, 0, 0, 0] : vary([58, 128, 42], 0.45)));
  paint(TILE.PLANKS, (x, y) => {
    const band = Math.floor(y / 4);
    const seamX = (band * 5 + 3) % T;
    if (y % 4 === 3 || x === seamX) return vary([110, 86, 50], 0.1);
    return vary([168, 135, 82], 0.1);
  });
  paint(TILE.GLASS, (x, y) => {
    if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return [205, 230, 245, 255];
    const k = x + y;
    if ((k === 6 || k === 7 || k === 9) && x > 2 && y > 2) return [240, 250, 255, 255];
    return [0, 0, 0, 0];
  });
  paint(TILE.BRICK, (x, y) => {
    const row = Math.floor(y / 4);
    if (y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7) return vary([175, 168, 158], 0.08);
    return vary([152, 72, 56], 0.18);
  });
  paint(TILE.SNOW, () => vary([240, 245, 250], 0.06));
  paint(TILE.WATER, () => { const c = vary([48, 98, 205], 0.12); return [c[0], c[1], c[2], 150]; });
  paint(TILE.BEDROCK, () => { const v = 35 + rng() * 90; return [v, v, v]; });
  paint(TILE.GRAVEL, () => (rng() < 0.5 ? vary([140, 128, 120], 0.35) : vary([105, 100, 98], 0.3)));
  paint(TILE.CACTUS_SIDE, (x, y) => {
    if ((x === 2 || x === 13) && y % 4 === 1) return [225, 225, 160];
    if (x % 5 === 0) return vary([40, 105, 35], 0.1);
    return vary([62, 145, 52], 0.12);
  });
  paint(TILE.CACTUS_TOP, (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6.5) return vary([40, 105, 35], 0.1);
    return vary(d < 2 ? [120, 175, 80] : [70, 155, 58], 0.1);
  });
  paint(TILE.SANDSTONE, (x, y) => vary(y < 3 || y > 12 ? [205, 190, 140] : [222, 208, 160], 0.08));
  paint(TILE.STONE_BRICK, (x, y) => {
    const row = Math.floor(y / 8);
    if (y % 8 === 7 || (x + (row % 2) * 8) % 16 === 15) return vary([80, 80, 80], 0.1);
    return vary([125, 125, 125], 0.12);
  });

  const wool = (tile, col) => paint(tile, (x, y) => vary(col, (x + y) % 3 === 0 ? 0.22 : 0.1));
  wool(TILE.WOOL_WHITE, [232, 232, 232]);
  wool(TILE.WOOL_RED, [175, 45, 40]);
  wool(TILE.WOOL_BLUE, [52, 70, 165]);
  wool(TILE.WOOL_YELLOW, [235, 195, 50]);
  wool(TILE.WOOL_GREEN, [85, 125, 35]);
  wool(TILE.WOOL_BLACK, [30, 30, 35]);
  paint(TILE.LAMP, (x, y) => {
    const edge = x === 0 || y === 0 || x === T - 1 || y === T - 1 || x === 7 || y === 7;
    return edge ? vary([150, 110, 60], 0.1) : vary([255, 225, 140], 0.12);
  });

  // Crafting table: plank top with a tool grid; sides show saw + hammer silhouettes.
  paint(TILE.CRAFT_TOP, (x, y) => {
    if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return vary([110, 80, 45], 0.1);
    if (x === 5 || x === 10 || y === 5 || y === 10) return vary([95, 68, 38], 0.1);
    return vary([175, 140, 86], 0.1);
  });
  paint(TILE.CRAFT_SIDE, (x, y) => {
    if (y < 3) return vary([110, 80, 45], 0.1);
    const saw = x >= 3 && x <= 6 && y >= 5 && y <= 12 && (y - 5) % 2 === 0;
    const hammer = (x >= 9 && x <= 13 && y >= 5 && y <= 6) || (x === 11 && y >= 7 && y <= 12);
    if (saw) return [170, 170, 175];
    if (hammer) return [90, 90, 95];
    return vary(y % 4 === 3 ? [130, 100, 60] : [160, 125, 76], 0.1);
  });
  paint(TILE.FURNACE_TOP, (x, y) => (x === 0 || y === 0 || x === T - 1 || y === T - 1 ? vary([95, 95, 95], 0.1) : vary([140, 140, 140], 0.15)));
  paint(TILE.FURNACE_FRONT, (x, y) => {
    if (x >= 4 && x <= 11 && y >= 8 && y <= 13) return y >= 11 ? vary([255, 150, 40], 0.25) : [30, 25, 25];
    if (x >= 4 && x <= 11 && y >= 3 && y <= 5) return [45, 45, 45];
    return vary([125, 125, 125], 0.18);
  });

  // Torch: a stick (columns 7-8, rows 9-15) with a flame on top (rows 6-8). Rest is transparent.
  paint(TILE.TORCH, (x, y) => {
    if (x < 7 || x > 8 || y < 6) return [0, 0, 0, 0];
    if (y <= 6) return [255, 240, 150];
    if (y <= 8) return x === 7 ? [255, 200, 60] : [255, 150, 40];
    return vary([120, 85, 45], 0.15);
  });

  // Ores: stone + clusters of mineral pixels.
  const ore = (tile, color, clusters) => {
    copy(TILE.STONE, tile);
    for (let c = 0; c < clusters; c++) {
      let x = 2 + Math.floor(rng() * 12), y = 2 + Math.floor(rng() * 12);
      for (let i = 0; i < 5; i++) {
        const v = vary(color, 0.25);
        set(tile, x, y, v[0], v[1], v[2]);
        x = Math.max(0, Math.min(T - 1, x + Math.round(rng() * 2 - 1)));
        y = Math.max(0, Math.min(T - 1, y + Math.round(rng() * 2 - 1)));
      }
    }
  };
  ore(TILE.COAL, [35, 35, 35], 4);
  ore(TILE.IRON, [216, 175, 147], 4);
  ore(TILE.GOLD, [250, 215, 60], 3);
  ore(TILE.DIAMOND, [95, 230, 225], 3);

  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  const avgColors = [];
  for (let t = 0; t < COLS * ROWS; t++) {
    let r = 0, g = 0, b = 0, n = 0;
    const col = t % COLS, row = Math.floor(t / COLS);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = ((row * T + y) * ATLAS_W + col * T + x) * 4;
      if (img.data[i + 3] < 128) continue;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
    n = Math.max(n, 1);
    avgColors.push(new THREE.Color(r / n / 255, g / n / 255, b / n / 255));
  }

  return { canvas, texture, avgColors };
}

/** Draws an isometric cube icon for a block onto a new canvas and returns a data URL. */
export function blockIcon(atlasCanvas, block, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const S = size, k = 1 / T;
  const face = (tile, a, b, cc, d, e, f, shade) => {
    const sx = (tile % COLS) * T, sy = Math.floor(tile / COLS) * T;
    ctx.setTransform(a * k, b * k, cc * k, d * k, e, f);
    ctx.drawImage(atlasCanvas, sx, sy, T, T, 0, 0, T, T);
    if (shade > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(0,0,0,${shade})`;
      ctx.fillRect(0, 0, T, T);
      ctx.globalCompositeOperation = 'source-over';
    }
  };
  face(block.top, S / 2, S / 4, -S / 2, S / 4, S / 2, 0, 0);
  face(block.side, S / 2, S / 4, 0, S / 2, 0, S / 4, 0.25);
  face(block.side, S / 2, -S / 4, 0, S / 2, S / 2, S / 2, 0.42);
  return c.toDataURL();
}
