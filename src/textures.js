// Procedurally painted 16x16 pixel-art texture atlas (no image files needed).
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export const T = 16;          // tile size in px
export const COLS = 8;
export const ROWS = 14;
export const ATLAS_W = COLS * T;
export const ATLAS_H = ROWS * T;

export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, LOG_SIDE: 6, LOG_TOP: 7,
  LEAVES: 8, PLANKS: 9, GLASS: 10, BRICK: 11, SNOW: 12, COAL: 13, IRON: 14, WATER: 15,
  BEDROCK: 16, GRAVEL: 17, CACTUS_SIDE: 18, CACTUS_TOP: 19, GOLD: 20, SNOW_SIDE: 21, SANDSTONE: 22, STONE_BRICK: 23,
  WOOL_WHITE: 24, WOOL_RED: 25, WOOL_BLUE: 26, WOOL_YELLOW: 27, WOOL_GREEN: 28, WOOL_BLACK: 29, LAMP: 30, DIAMOND: 31,
  CRAFT_TOP: 32, CRAFT_SIDE: 33, FURNACE_FRONT: 34, FURNACE_TOP: 35, TORCH: 36,
  TRAMP_TOP: 37, TRAMP_SIDE: 38, SPEED: 39, ICE: 40, FAN_TOP: 41, FAN_SIDE: 42,
  NEON_PINK: 43, NEON_CYAN: 44, NEON_LIME: 45, NEON_PURPLE: 46,
  NOTE_1: 47, NOTE_2: 48, NOTE_3: 49, NOTE_4: 50, NOTE_5: 51, NOTE_6: 52, NOTE_7: 53, NOTE_8: 54,
  CONFETTI: 55,
  FLOWER_RED: 56, FLOWER_YELLOW: 57, FLOWER_BLUE: 58, FLOWER_PINK: 59, TALL_GRASS: 60,
  FARMLAND: 61, WHEAT_0: 62, WHEAT_1: 63, WHEAT_2: 64, WHEAT_3: 65, LANTERN: 66,
  STAR: 67, PORTAL_BLUE: 68, PORTAL_ORANGE: 69, PORTAL_GREEN: 70, PORTAL_PURPLE: 71,
  LOST_CHEST: 72, LOST_CHEST_TOP: 73,
  WIRE: 74, WIRE_ON: 75, SPARK_BASE: 76, LEVER: 77, LEVER_ON: 78, BUTTON: 79, BUTTON_ON: 80, PLATE: 81, PLATE_ON: 82,
  BATTERY: 83, GATE_SIDE: 84, INVERTER: 85, INVERTER_ON: 86, DELAY: 87, DELAY_ON: 88,
  SPARK_LAMP: 89, SPARK_LAMP_ON: 90, SPARK_DOOR: 91, SPARK_DOOR_OPEN: 92,
  PISTON_FRONT: 93, PISTON_SIDE: 94, PISTON_BACK: 95, PISTON_INNER: 96,
  COURSE_START: 97, COURSE_CHECK: 98, COURSE_FINISH: 99, COIN: 100, COIN_TAKEN: 101, PAD_SIDE: 102,
};

/** Rainbow colours for the 8 musical step-stones (do re mi fa sol la ti do). */
export const NOTE_COLORS = [[230, 60, 60], [240, 140, 40], [245, 210, 50], [90, 190, 70], [60, 190, 200], [60, 110, 220], [110, 80, 200], [200, 90, 200]];

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

  // ---- Phase 1 fun blocks ----
  paint(TILE.TRAMP_TOP, (x, y) => {
    if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return [40, 40, 45];
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (Math.floor(d) % 3 === 0) return [235, 170, 20];
    return vary([255, 215, 40], 0.08);
  });
  paint(TILE.TRAMP_SIDE, (x, y) => {
    if (y < 3) return vary([255, 215, 40], 0.08);
    if (y > 12) return [45, 45, 50];
    return ((x + y) % 4 < 2) ? [150, 150, 160] : [60, 60, 66]; // springs
  });
  paint(TILE.SPEED, (x, y) => {
    const c = (x + Math.abs(y - 7.5) * 1.0) % 8;           // >> chevrons
    if (c > 1.5 && c < 4 && y > 1 && y < 14) return [255, 230, 70];
    return vary([55, 58, 66], 0.12);
  });
  paint(TILE.ICE, (x, y) => ((x * 3 + y * 5) % 17 === 0 || (x - y + 16) % 13 === 0 ? [240, 250, 255] : vary([150, 200, 245], 0.08)));
  paint(TILE.FAN_TOP, (x, y) => {
    if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return [90, 95, 105];
    const a = Math.atan2(y - 7.5, x - 7.5), d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 1.6) return [200, 205, 215];
    if (d < 7 && Math.sin(a * 4) > 0.2) return [175, 185, 200]; // blades
    return [35, 38, 45];
  });
  paint(TILE.FAN_SIDE, (x, y) => {
    if ((x === 2 || x === 13) && (y === 2 || y === 13)) return [210, 215, 225];
    if (y % 5 === 4) return [95, 100, 110];
    return vary([140, 145, 155], 0.08);
  });
  const neon = (tile, col) => paint(tile, (x, y) => {
    const e = Math.min(x, y, T - 1 - x, T - 1 - y);
    if (e === 0) return col.map((v) => v * 0.6);
    if (e === 1) return [255, 255, 255];
    return vary(col, 0.06);
  });
  neon(TILE.NEON_PINK, [255, 80, 190]);
  neon(TILE.NEON_CYAN, [60, 235, 255]);
  neon(TILE.NEON_LIME, [150, 255, 60]);
  neon(TILE.NEON_PURPLE, [170, 90, 255]);
  // Musical stones: rainbow colour with a white note glyph.
  const glyph = ['..........##....', '..........#.#...', '..........#..#..', '..........#.....', '..........#.....', '..........#.....',
    '..........#.....', '......#####.....', '.....######.....', '.....#####......', '......###.......'];
  NOTE_COLORS.forEach((col, i) => paint(TILE.NOTE_1 + i, (x, y) => {
    const gy = y - 3;
    if (gy >= 0 && gy < glyph.length && glyph[gy][x] === '#') return [255, 255, 255];
    if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return col.map((v) => v * 0.7);
    return vary(col, 0.06);
  }));
  {
    const dots = [[255, 70, 70], [255, 200, 40], [70, 200, 90], [70, 140, 255], [220, 90, 220]];
    paint(TILE.CONFETTI, () => (rng() < 0.22 ? dots[Math.floor(rng() * dots.length)] : vary([245, 245, 250], 0.04)));
  }

  // ---- Phase 3 garden: cross-shaped plants (transparent background) ----
  const stem = (x, y, top) => x === 7 && y >= top;
  const flower = (tile, petal, centre) => paint(tile, (x, y) => {
    const d = Math.hypot(x - 7.5, y - 5);
    if (d < 1.2) return centre;
    if (d < 3.3 && y <= 8) return vary(petal, 0.1);
    if (stem(x, y, 8) || (y === 11 && (x === 6 || x === 8)) || (y === 12 && (x === 5 || x === 9))) return [60, 140, 45];
    return [0, 0, 0, 0];
  });
  flower(TILE.FLOWER_RED, [220, 40, 40], [40, 30, 20]);
  flower(TILE.FLOWER_YELLOW, [250, 215, 40], [230, 150, 30]);
  flower(TILE.FLOWER_BLUE, [80, 120, 230], [250, 240, 200]);
  flower(TILE.FLOWER_PINK, [245, 140, 200], [255, 240, 120]);
  {
    const blades = Array.from({ length: 7 }, () => [1 + Math.floor(rng() * 14), 3 + Math.floor(rng() * 7)]);
    paint(TILE.TALL_GRASS, (x, y) => (blades.some(([bx, top]) => (x === bx || x === bx + (y < 8 ? 1 : 0)) && y >= top) ? vary([90, 160, 55], 0.25) : [0, 0, 0, 0]));
  }
  paint(TILE.FARMLAND, (x, y) => (y % 4 === 0 ? vary([80, 55, 35], 0.15) : vary([110, 78, 50], 0.15)));
  // Wheat: taller and more golden at each stage.
  [[11, [70, 160, 50]], [8, [110, 170, 50]], [5, [170, 175, 60]], [2, [220, 190, 70]]].forEach(([top, col], i) => paint(TILE.WHEAT_0 + i, (x, y) => {
    if (y < top) return [0, 0, 0, 0];
    if ((x % 3 === 1) || (i === 3 && y < top + 3 && x % 3 === 2)) return vary(col, 0.15);
    return [0, 0, 0, 0];
  }));

  // Firefly lantern: dark frame, warm glowing glass with little sparks.
  paint(TILE.LANTERN, (x, y) => {
    if (x <= 1 || x >= T - 2 || y <= 1 || y >= T - 2) return [60, 55, 50];
    if ((x === 5 && y === 6) || (x === 10 && y === 9) || (x === 7 && y === 11)) return [255, 255, 200];
    return vary([255, 205, 90], 0.08);
  });

  // Hidden Star: a golden star on deep blue.
  paint(TILE.STAR, (x, y) => {
    const dx = x - 7.5, dy = y - 7.5, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
    const edge = 3.2 + 3.3 * Math.pow(Math.abs(Math.cos(a * 2.5 + Math.PI / 2)), 3);
    if (r < edge) return r < 2 ? [255, 250, 200] : vary([255, 205, 50], 0.06);
    return vary([40, 50, 120], 0.12);
  });
  // Portals: a swirl in each colour.
  const swirl = (tile, col) => paint(tile, (x, y) => {
    const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const band = Math.sin(a * 2 + r * 0.9);
    if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return col.map((v) => v * 0.45);
    return band > 0.2 ? col.map((v) => Math.min(255, v * 1.25 + 30)) : col.map((v) => v * 0.75);
  });
  swirl(TILE.PORTAL_BLUE, [60, 120, 255]);
  swirl(TILE.PORTAL_ORANGE, [255, 140, 30]);
  swirl(TILE.PORTAL_GREEN, [60, 210, 90]);
  swirl(TILE.PORTAL_PURPLE, [170, 80, 240]);

  // Lost Items Chest (Adventure): where your things wait after you faint.
  paint(TILE.LOST_CHEST, (x, y) => {
    if (x === 0 || x === T - 1 || y === 0 || y === T - 1 || y === 6) return [70, 45, 25];
    if (x >= 6 && x <= 9 && y >= 5 && y <= 9) return (x === 6 || x === 9 || y === 9) ? [150, 120, 30] : [250, 210, 60]; // lock
    return vary(y < 6 ? [150, 95, 50] : [130, 82, 42], 0.1);
  });
  paint(TILE.LOST_CHEST_TOP, (x, y) => (x === 0 || x === T - 1 || y === 0 || y === T - 1 ? [70, 45, 25] : vary([150, 95, 50], 0.1)));

  // ---- Spark circuits (A3): dark slate bases with glowing yellow "spark" parts ----
  const OFF = [120, 70, 40], ON = [255, 225, 60];
  const slate = () => vary([62, 66, 78], 0.1);
  const edge = (x, y) => x === 0 || y === 0 || x === T - 1 || y === T - 1;
  // Wire: a plus-shaped dust trail on a see-through tile (drawn flat on the floor).
  const wire = (tile, c) => paint(tile, (x, y) => ((x >= 6 && x <= 9) || (y >= 6 && y <= 9) ? vary(c, 0.12) : [0, 0, 0, 0]));
  wire(TILE.WIRE, OFF); wire(TILE.WIRE_ON, ON);
  paint(TILE.SPARK_BASE, (x, y) => (edge(x, y) ? [40, 42, 50] : slate()));
  const lever = (tile, up) => paint(tile, (x, y) => {
    if (edge(x, y)) return [40, 42, 50];
    const stickY = up ? y >= 3 && y <= 9 : y >= 7 && y <= 13;
    if (x >= 7 && x <= 8 && stickY) return [150, 115, 65];
    if (x >= 6 && x <= 9 && (up ? y >= 2 && y <= 4 : y >= 12 && y <= 14)) return up ? ON : OFF;
    if (y >= 9 && y <= 10 && x >= 4 && x <= 11) return [90, 92, 100];
    return slate();
  });
  lever(TILE.LEVER, false); lever(TILE.LEVER_ON, true);
  const button = (tile, c) => paint(tile, (x, y) => {
    if (edge(x, y)) return [40, 42, 50];
    const d = Math.hypot(x - 7.5, y - 7.5);
    return d < 4.5 ? (d > 3.5 ? [30, 30, 36] : vary(c, 0.06)) : slate();
  });
  button(TILE.BUTTON, [200, 60, 60]); button(TILE.BUTTON_ON, [255, 150, 150]);
  const plate = (tile, c) => paint(tile, (x, y) => (x < 1 || y < 1 || x > 14 || y > 14 ? [0, 0, 0, 0] : edge(x - 1, y - 1) || x === 14 || y === 14 ? [70, 70, 78] : vary(c, 0.06)));
  plate(TILE.PLATE, [150, 150, 160]); plate(TILE.PLATE_ON, [255, 230, 120]);
  paint(TILE.BATTERY, (x, y) => {
    if (edge(x, y)) return [60, 50, 20];
    const bolt = (y < 8 && x >= 9 - Math.floor(y / 2) && x <= 10 - Math.floor(y / 2) + 1) || (y >= 7 && x >= 9 - Math.floor(y / 2) + 1 && x <= 10 - Math.floor(y / 2) + 2);
    return bolt ? [255, 255, 255] : vary(ON, 0.08);
  });
  paint(TILE.GATE_SIDE, (x, y) => (edge(x, y) ? [40, 42, 50] : y === 4 ? [90, 92, 100] : slate()));
  // Gate tops: an arrow pointing up the tile (the mesher turns it to face the right way).
  const arrow = (x, y) => (y >= 3 && y <= 6 && Math.abs(x - 7.5) <= y - 2.5) || (y > 6 && y <= 12 && x >= 6 && x <= 9);
  const gate = (tile, c, mark) => paint(tile, (x, y) => {
    if (edge(x, y)) return [40, 42, 50];
    if (arrow(x, y)) return c;
    if (mark(x, y)) return [235, 235, 240];
    return slate();
  });
  gate(TILE.INVERTER, OFF, (x, y) => (x === 2 || x === 3) && y >= 9 && y <= 13); // a little "!" bar for NOT
  gate(TILE.INVERTER_ON, ON, (x, y) => (x === 2 || x === 3) && y >= 9 && y <= 13);
  gate(TILE.DELAY, OFF, (x, y) => (y === 9 || y === 12) && x >= 2 && x <= 4); // clock ticks
  gate(TILE.DELAY_ON, ON, (x, y) => (y === 9 || y === 12) && x >= 2 && x <= 4);
  const lampTile = (tile, on) => paint(tile, (x, y) => {
    if (edge(x, y)) return [70, 55, 30];
    if (x % 5 === 2 || y % 5 === 2) return on ? [255, 200, 90] : [80, 70, 55];
    return on ? vary([255, 240, 170], 0.05) : vary([110, 95, 70], 0.1);
  });
  lampTile(TILE.SPARK_LAMP, false); lampTile(TILE.SPARK_LAMP_ON, true);
  paint(TILE.SPARK_DOOR, (x, y) => {
    if (edge(x, y)) return [70, 72, 85];
    if ((x === 7 || x === 8) && y >= 3 && y <= 12) return [40, 42, 50];
    if (x === 11 && y >= 7 && y <= 8) return ON;
    return vary([160, 165, 180], 0.06);
  });
  paint(TILE.SPARK_DOOR_OPEN, (x, y) => (edge(x, y) ? [70, 72, 85] : x === 1 && y === 1 ? [255, 225, 60] : [0, 0, 0, 0]));
  paint(TILE.PISTON_FRONT, (x, y) => (edge(x, y) ? [110, 86, 50] : vary([180, 145, 90], 0.08)));
  paint(TILE.PISTON_SIDE, (x, y) => {
    if (y < 4) return y === 0 || y === 3 ? [110, 86, 50] : vary([168, 135, 82], 0.08);
    if (edge(x, y)) return [50, 52, 60];
    if (x >= 6 && x <= 9 && y <= 9) return [140, 140, 150];
    return vary([110, 112, 120], 0.12);
  });
  paint(TILE.PISTON_BACK, (x, y) => (edge(x, y) ? [50, 52, 60] : Math.hypot(x - 7.5, y - 7.5) < 3 ? [70, 72, 82] : vary([110, 112, 120], 0.12)));
  // ---- Course Maker pads and coins ----
  const padEdge = (x, y) => x === 0 || y === 0 || x === T - 1 || y === T - 1;
  const flag = (tile, base, cloth) => paint(tile, (x, y) => {
    if (padEdge(x, y)) return [235, 235, 240];
    if (x === 5 && y >= 3 && y <= 12) return [80, 60, 40]; // pole
    if (x >= 6 && x <= 11 && y >= 3 && y <= 7 && (x - 6) <= 6 - Math.abs(y - 5) * 0.6) return cloth;
    return vary(base, 0.06);
  });
  flag(TILE.COURSE_START, [70, 170, 80], [255, 255, 255]);
  flag(TILE.COURSE_CHECK, [60, 120, 210], [255, 215, 60]);
  paint(TILE.COURSE_FINISH, (x, y) => (padEdge(x, y) ? [235, 235, 240] : ((x >> 2) + (y >> 2)) % 2 ? [30, 30, 36] : [245, 245, 250]));
  paint(TILE.PAD_SIDE, (x, y) => (y < 3 ? [235, 235, 240] : y === 3 ? [180, 180, 190] : vary([120, 125, 135], 0.08)));
  const coin = (tile, alpha, c) => paint(tile, (x, y) => {
    const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx * 1.25, dy);
    if (r > 6.2) return [0, 0, 0, 0];
    if (r > 5.2) return [c[0] * 0.75, c[1] * 0.75, c[2] * 0.6, alpha];
    if ((x === 7 || x === 8) && y >= 4 && y <= 11) return [c[0] * 0.8, c[1] * 0.78, c[2] * 0.5, alpha]; // a star line on the face
    if (dx < -1 && dy < -1 && r < 3.6) return [255, 255, 235, alpha]; // shine
    return [c[0], c[1], c[2], alpha];
  });
  coin(TILE.COIN, 255, [255, 205, 50]);
  coin(TILE.COIN_TAKEN, 255, [120, 120, 130]);

  paint(TILE.PISTON_INNER, (x, y) => (edge(x, y) ? [50, 52, 60] : x >= 6 && x <= 9 && y >= 6 && y <= 9 ? [140, 140, 150] : vary([60, 62, 70], 0.1)));

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
