// Block registry. IDs are stored in chunk data (Uint8Array), so keep them < 256
// and never renumber existing IDs (saved worlds reference them).
import { TILE } from './textures.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, LOG: 6, LEAVES: 7, PLANKS: 8,
  GLASS: 9, BRICK: 10, SNOW: 11, COAL_ORE: 12, IRON_ORE: 13, WATER: 14, BEDROCK: 15,
  GRAVEL: 16, CACTUS: 17, GOLD_ORE: 18, SANDSTONE: 19, STONE_BRICK: 20, SNOWY_GRASS: 21,
  WOOL_WHITE: 22, WOOL_RED: 23, WOOL_BLUE: 24, WOOL_YELLOW: 25, WOOL_GREEN: 26, WOOL_BLACK: 27,
  LAMP: 28, DIAMOND_ORE: 29, CRAFTING_TABLE: 30, FURNACE: 31, TORCH: 32,
  TRAMPOLINE: 33, SPEED_STRIP: 34, ICE: 35, FAN: 36,
  NEON_PINK: 37, NEON_CYAN: 38, NEON_LIME: 39, NEON_PURPLE: 40,
  NOTE_1: 41, NOTE_2: 42, NOTE_3: 43, NOTE_4: 44, NOTE_5: 45, NOTE_6: 46, NOTE_7: 47, NOTE_8: 48,
  CONFETTI: 49,
  FLOWER_RED: 50, FLOWER_YELLOW: 51, FLOWER_BLUE: 52, FLOWER_PINK: 53, TALL_GRASS: 54,
  FARMLAND: 55, WHEAT_0: 56, WHEAT_1: 57, WHEAT_2: 58, WHEAT_3: 59,
  LANTERN: 60, STAR: 61, PORTAL_BLUE: 62, PORTAL_ORANGE: 63, PORTAL_GREEN: 64, PORTAL_PURPLE: 65,
};

export const BLOCKS = [];

function def(id, name, tiles, opts = {}) {
  const t = typeof tiles === 'number' ? { top: tiles, bottom: tiles, side: tiles } : tiles;
  BLOCKS[id] = {
    id, name, top: t.top, bottom: t.bottom ?? t.top, side: t.side ?? t.top,
    solid: true, transparent: false, liquid: false, drawSame: false, placeable: true,
    ...opts,
  };
}

def(B.AIR, 'Air', 0, { solid: false, transparent: true, placeable: false });
def(B.GRASS, 'Grass', { top: TILE.GRASS_TOP, bottom: TILE.DIRT, side: TILE.GRASS_SIDE });
def(B.DIRT, 'Dirt', TILE.DIRT);
def(B.STONE, 'Stone', TILE.STONE);
def(B.COBBLE, 'Cobblestone', TILE.COBBLE);
def(B.SAND, 'Sand', TILE.SAND);
def(B.LOG, 'Oak Log', { top: TILE.LOG_TOP, side: TILE.LOG_SIDE });
def(B.LEAVES, 'Leaves', TILE.LEAVES, { transparent: true, drawSame: true });
def(B.PLANKS, 'Planks', TILE.PLANKS);
def(B.GLASS, 'Glass', TILE.GLASS, { transparent: true });
def(B.BRICK, 'Bricks', TILE.BRICK);
def(B.SNOW, 'Snow', TILE.SNOW);
def(B.COAL_ORE, 'Coal Ore', TILE.COAL);
def(B.IRON_ORE, 'Iron Ore', TILE.IRON);
def(B.WATER, 'Water', TILE.WATER, { solid: false, transparent: true, liquid: true });
def(B.BEDROCK, 'Bedrock', TILE.BEDROCK, { placeable: false });
def(B.GRAVEL, 'Gravel', TILE.GRAVEL);
def(B.CACTUS, 'Cactus', { top: TILE.CACTUS_TOP, side: TILE.CACTUS_SIDE });
def(B.GOLD_ORE, 'Gold Ore', TILE.GOLD);
def(B.SANDSTONE, 'Sandstone', TILE.SANDSTONE);
def(B.STONE_BRICK, 'Stone Bricks', TILE.STONE_BRICK);
def(B.SNOWY_GRASS, 'Snowy Grass', { top: TILE.SNOW, bottom: TILE.DIRT, side: TILE.SNOW_SIDE });
def(B.WOOL_WHITE, 'White Wool', TILE.WOOL_WHITE);
def(B.WOOL_RED, 'Red Wool', TILE.WOOL_RED);
def(B.WOOL_BLUE, 'Blue Wool', TILE.WOOL_BLUE);
def(B.WOOL_YELLOW, 'Yellow Wool', TILE.WOOL_YELLOW);
def(B.WOOL_GREEN, 'Green Wool', TILE.WOOL_GREEN);
def(B.WOOL_BLACK, 'Black Wool', TILE.WOOL_BLACK);
def(B.LAMP, 'Lamp', TILE.LAMP, { emissive: true, light: 15 });
def(B.DIAMOND_ORE, 'Diamond Ore', TILE.DIAMOND);
def(B.CRAFTING_TABLE, 'Crafting Table', { top: TILE.CRAFT_TOP, bottom: TILE.PLANKS, side: TILE.CRAFT_SIDE });
def(B.TORCH, 'Torch', TILE.TORCH, { solid: false, transparent: true, emissive: true, shape: 'torch', light: 14 });
def(B.FURNACE, 'Furnace', { top: TILE.FURNACE_TOP, bottom: TILE.FURNACE_TOP, side: TILE.FURNACE_FRONT });

// ---- Phase 1 fun blocks ----
def(B.TRAMPOLINE, 'Trampoline', { top: TILE.TRAMP_TOP, bottom: TILE.TRAMP_SIDE, side: TILE.TRAMP_SIDE }, { bounce: true });
def(B.SPEED_STRIP, 'Speed Strip', { top: TILE.SPEED, bottom: TILE.STONE, side: TILE.STONE }, { speed: true });
def(B.ICE, 'Ice', TILE.ICE, { slippery: true });
def(B.FAN, 'Fan Vent', { top: TILE.FAN_TOP, bottom: TILE.FAN_SIDE, side: TILE.FAN_SIDE }, { fan: true });
def(B.NEON_PINK, 'Pink Neon', TILE.NEON_PINK, { emissive: true, light: 12 });
def(B.NEON_CYAN, 'Cyan Neon', TILE.NEON_CYAN, { emissive: true, light: 12 });
def(B.NEON_LIME, 'Lime Neon', TILE.NEON_LIME, { emissive: true, light: 12 });
def(B.NEON_PURPLE, 'Purple Neon', TILE.NEON_PURPLE, { emissive: true, light: 12 });
// Musical step-stones: do re mi fa sol la ti do (C major, C5..C6).
export const NOTE_NAMES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti', 'High Do'];
export const NOTE_FREQS = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5];
NOTE_NAMES.forEach((n, i) => def(B.NOTE_1 + i, `Music Stone (${n})`, TILE.NOTE_1 + i, { note: i }));
def(B.CONFETTI, 'Confetti Pad', TILE.CONFETTI, { confetti: true });

// ---- Phase 3 garden ----
// 'plant' blocks are drawn as two crossed quads, are walk-through, and need soil below.
const plant = { solid: false, transparent: true, shape: 'plant', plant: true };
def(B.FLOWER_RED, 'Red Flower', TILE.FLOWER_RED, plant);
def(B.FLOWER_YELLOW, 'Yellow Flower', TILE.FLOWER_YELLOW, plant);
def(B.FLOWER_BLUE, 'Blue Flower', TILE.FLOWER_BLUE, plant);
def(B.FLOWER_PINK, 'Pink Flower', TILE.FLOWER_PINK, plant);
def(B.TALL_GRASS, 'Tall Grass', TILE.TALL_GRASS, plant);
def(B.FARMLAND, 'Farmland', { top: TILE.FARMLAND, bottom: TILE.DIRT, side: TILE.DIRT });
[0, 1, 2, 3].forEach((i) => def(B.WHEAT_0 + i, `Wheat (stage ${i + 1})`, TILE.WHEAT_0 + i, { ...plant, crop: i, placeable: false }));
export const FLOWERS = [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_BLUE, B.FLOWER_PINK];
def(B.LANTERN, 'Firefly Lantern', TILE.LANTERN, { emissive: true, light: 13 });
// ---- Phase 4 ----
// Hidden Star: hide it for someone else to find (clicking it celebrates instead of breaking it).
def(B.STAR, 'Hidden Star', TILE.STAR, { emissive: true, light: 10, star: true });
// Portals: walk into one and you pop out of the other portal of the same colour.
const portal = (name) => ({ emissive: true, light: 9, solid: false, transparent: true, portal: name });
def(B.PORTAL_BLUE, 'Blue Portal', TILE.PORTAL_BLUE, portal('blue'));
def(B.PORTAL_ORANGE, 'Orange Portal', TILE.PORTAL_ORANGE, portal('orange'));
def(B.PORTAL_GREEN, 'Green Portal', TILE.PORTAL_GREEN, portal('green'));
def(B.PORTAL_PURPLE, 'Purple Portal', TILE.PORTAL_PURPLE, portal('purple'));

// Fast lookup tables used in hot loops (meshing, physics).
export const SOLID = new Uint8Array(256);
export const OPAQUE = new Uint8Array(256);
export const TRANSPARENT = new Uint8Array(256);
export const LIGHT = new Uint8Array(256); // light emitted (0-15)
BLOCKS.forEach((b) => {
  SOLID[b.id] = b.solid ? 1 : 0;
  OPAQUE[b.id] = b.solid && !b.transparent ? 1 : 0;
  TRANSPARENT[b.id] = b.transparent ? 1 : 0;
  LIGHT[b.id] = b.light || 0;
});

export const PLACEABLE = BLOCKS.filter((b) => b.placeable).map((b) => b.id);
