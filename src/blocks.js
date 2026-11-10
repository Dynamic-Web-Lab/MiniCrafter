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
  LOST_CHEST: 66,
  // Spark circuits (A3). Every on/off state and facing is its own ID (chunks store 1 byte per block).
  WIRE: 67, WIRE_ON: 68, LEVER: 69, LEVER_ON: 70, BUTTON: 71, BUTTON_ON: 72, PLATE: 73, PLATE_ON: 74,
  BATTERY: 75, INVERTER: 76, INVERTER_ON: 80, DELAY: 84, DELAY_ON: 88,
  SPARK_LAMP: 92, SPARK_LAMP_ON: 93, SPARK_DOOR: 94, SPARK_DOOR_OPEN: 95,
  PISTON: 96, PISTON_OUT: 101, PISTON_HEAD: 106,
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
// Adventure: when you faint, your things wait for you in this chest (click it to get them back).
def(B.LOST_CHEST, 'Lost Items Chest', { top: TILE.LOST_CHEST_TOP, bottom: TILE.LOST_CHEST_TOP, side: TILE.LOST_CHEST }, { placeable: false, lostChest: true });

// ---- A3 Spark circuits ----
// spark: what the block does in a circuit; base: the item you get back when you break it.
// Facings: 0 north (-z), 1 east (+x), 2 south (+z), 3 west (-x), 4 up (pistons only).
export const SPARK_DIRS = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 1, 0]];
const flat = { solid: false, transparent: true, shape: 'flat' };
def(B.WIRE, 'Spark Wire', TILE.WIRE, { ...flat, spark: 'wire', base: B.WIRE });
def(B.WIRE_ON, 'Spark Wire (on)', TILE.WIRE_ON, { ...flat, emissive: true, spark: 'wire', on: true, base: B.WIRE, placeable: false });
def(B.LEVER, 'Spark Lever', { top: TILE.SPARK_BASE, side: TILE.LEVER }, { spark: 'lever', base: B.LEVER });
def(B.LEVER_ON, 'Spark Lever (on)', { top: TILE.SPARK_BASE, side: TILE.LEVER_ON }, { spark: 'lever', on: true, base: B.LEVER, placeable: false });
def(B.BUTTON, 'Spark Button', { top: TILE.BUTTON, side: TILE.SPARK_BASE }, { spark: 'button', base: B.BUTTON });
def(B.BUTTON_ON, 'Spark Button (on)', { top: TILE.BUTTON_ON, side: TILE.SPARK_BASE }, { spark: 'button', on: true, base: B.BUTTON, placeable: false });
def(B.PLATE, 'Pressure Plate', TILE.PLATE, { ...flat, spark: 'plate', base: B.PLATE });
def(B.PLATE_ON, 'Pressure Plate (on)', TILE.PLATE_ON, { ...flat, spark: 'plate', on: true, base: B.PLATE, placeable: false });
def(B.BATTERY, 'Spark Battery', TILE.BATTERY, { emissive: true, spark: 'battery', on: true, base: B.BATTERY });
for (let d = 0; d < 4; d++) {
  const extra = d === 0 ? {} : { placeable: false };
  def(B.INVERTER + d, 'Spark Inverter', { top: TILE.INVERTER, bottom: TILE.SPARK_BASE, side: TILE.GATE_SIDE }, { spark: 'inverter', dir: d, rot: d, base: B.INVERTER, ...extra });
  def(B.INVERTER_ON + d, 'Spark Inverter (on)', { top: TILE.INVERTER_ON, bottom: TILE.SPARK_BASE, side: TILE.GATE_SIDE }, { spark: 'inverter', dir: d, rot: d, on: true, base: B.INVERTER, placeable: false });
  def(B.DELAY + d, 'Spark Delay', { top: TILE.DELAY, bottom: TILE.SPARK_BASE, side: TILE.GATE_SIDE }, { spark: 'delay', dir: d, rot: d, base: B.DELAY, ...extra });
  def(B.DELAY_ON + d, 'Spark Delay (on)', { top: TILE.DELAY_ON, bottom: TILE.SPARK_BASE, side: TILE.GATE_SIDE }, { spark: 'delay', dir: d, rot: d, on: true, base: B.DELAY, placeable: false });
}
def(B.SPARK_LAMP, 'Spark Lamp', TILE.SPARK_LAMP, { spark: 'lamp', base: B.SPARK_LAMP });
def(B.SPARK_LAMP_ON, 'Spark Lamp (on)', TILE.SPARK_LAMP_ON, { emissive: true, light: 15, spark: 'lamp', on: true, base: B.SPARK_LAMP, placeable: false });
def(B.SPARK_DOOR, 'Spark Door', TILE.SPARK_DOOR, { spark: 'door', base: B.SPARK_DOOR });
def(B.SPARK_DOOR_OPEN, 'Spark Door (open)', TILE.SPARK_DOOR_OPEN, { solid: false, transparent: true, spark: 'door', on: true, base: B.SPARK_DOOR, placeable: false });
for (let d = 0; d < 5; d++) {
  // faces: the pusher on the facing side, a back plate opposite, arrows round the sides.
  const faces = (front) => [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]].map((v) => {
    const [x, y, z] = SPARK_DIRS[d];
    if (v[0] === x && v[1] === y && v[2] === z) return front;
    if (v[0] === -x && v[1] === -y && v[2] === -z) return TILE.PISTON_BACK;
    return TILE.PISTON_SIDE;
  });
  def(B.PISTON + d, 'Spark Piston', { top: TILE.PISTON_FRONT, bottom: TILE.PISTON_BACK, side: TILE.PISTON_SIDE }, { spark: 'piston', dir: d, faces: faces(TILE.PISTON_FRONT), base: B.PISTON, ...(d ? { placeable: false } : {}) });
  def(B.PISTON_OUT + d, 'Spark Piston (pushed out)', { top: TILE.PISTON_INNER, bottom: TILE.PISTON_BACK, side: TILE.PISTON_SIDE }, { spark: 'piston', dir: d, on: true, faces: faces(TILE.PISTON_INNER), base: B.PISTON, placeable: false });
}
def(B.PISTON_HEAD, 'Piston Pusher', TILE.PISTON_FRONT, { spark: 'head', placeable: false });
/** Facing-aware block: turns a placed directional item into the variant facing `dir`. */
export function sparkFacing(id, dir) {
  const b = BLOCKS[id];
  if (!b || b.dir === undefined) return id;
  if (dir === 4 && b.spark !== 'piston') dir = 0;
  return b.base + dir;
}

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
