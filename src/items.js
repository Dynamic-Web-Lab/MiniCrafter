// Items, tools, mining rules and crafting recipes for survival mode.
// Item IDs 0–255 are blocks (same IDs as blocks.js). IDs >= 256 are non-block
// items. Saved inventories store these IDs, so never renumber them.
import { B, BLOCKS } from './blocks.js';
import { blockIcon } from './textures.js';

export const I = {
  STICK: 256, COAL: 257, IRON_INGOT: 258, GOLD_INGOT: 259, DIAMOND: 260, APPLE: 261,
  WOOD_PICK: 270, STONE_PICK: 271, IRON_PICK: 272, DIAMOND_PICK: 273,
  WOOD_AXE: 274, STONE_AXE: 275, IRON_AXE: 276, DIAMOND_AXE: 277,
  WOOD_SHOVEL: 278, STONE_SHOVEL: 279, IRON_SHOVEL: 280, DIAMOND_SHOVEL: 281,
  PIG_EGG: 290, COW_EGG: 291, SHEEP_EGG: 292, CHICKEN_EGG: 293,
};

const TIERS = [
  { name: 'Wooden', key: 'WOOD', head: [150, 115, 65], speed: 2 },
  { name: 'Stone', key: 'STONE', head: [125, 125, 125], speed: 4 },
  { name: 'Iron', key: 'IRON', head: [225, 225, 228], speed: 6 },
  { name: 'Diamond', key: 'DIAMOND', head: [90, 225, 215], speed: 8 },
];

export const ITEMS = new Map();

// Every placeable block is also an item.
for (const b of BLOCKS) {
  if (b && b.placeable) ITEMS.set(b.id, { id: b.id, name: b.name, block: b.id, stack: 64 });
}

const item = (id, name, extra = {}) => ITEMS.set(id, { id, name, stack: 64, ...extra });
item(I.STICK, 'Stick', { sprite: 'stick' });
item(I.COAL, 'Coal', { sprite: 'lump', color: [40, 40, 42] });
item(I.IRON_INGOT, 'Iron Ingot', { sprite: 'ingot', color: [220, 220, 224] });
item(I.GOLD_INGOT, 'Gold Ingot', { sprite: 'ingot', color: [250, 210, 60] });
item(I.DIAMOND, 'Diamond', { sprite: 'gem', color: [95, 230, 225] });
item(I.APPLE, 'Apple', { sprite: 'apple', food: 4 });

// Spawn eggs (creative only): right-click a block to place an animal on it.
item(I.PIG_EGG, 'Pig Spawn Egg', { sprite: 'egg', color: [240, 165, 165], spots: [200, 110, 120], spawns: 'pig', creativeOnly: true });
item(I.COW_EGG, 'Cow Spawn Egg', { sprite: 'egg', color: [95, 62, 40], spots: [235, 235, 235], spawns: 'cow', creativeOnly: true });
item(I.SHEEP_EGG, 'Sheep Spawn Egg', { sprite: 'egg', color: [235, 235, 235], spots: [215, 180, 160], spawns: 'sheep', creativeOnly: true });
item(I.CHICKEN_EGG, 'Chicken Spawn Egg', { sprite: 'egg', color: [245, 245, 245], spots: [210, 40, 40], spawns: 'chicken', creativeOnly: true });

TIERS.forEach((t, i) => {
  for (const [kind, label] of [['pickaxe', 'Pickaxe'], ['axe', 'Axe'], ['shovel', 'Shovel']]) {
    const key = `${t.key}_${kind === 'pickaxe' ? 'PICK' : kind.toUpperCase()}`;
    item(I[key], `${t.name} ${label}`, { sprite: kind, color: t.head, stack: 1, tool: { kind, tier: i + 1, speed: t.speed } });
  }
});

export const itemName = (id) => ITEMS.get(id)?.name ?? '?';
export const isBlockItem = (id) => id < 256 && ITEMS.get(id)?.block !== undefined;

// ---------- mining ----------
// hardness: seconds-ish base; tool: preferred tool kind; tier: minimum pickaxe
// tier needed to get a drop (0 = hand is fine).
const MINE = {};
const mine = (ids, hardness, tool = null, tier = 0) => ids.forEach((id) => { MINE[id] = { hardness, tool, tier }; });
mine([B.GRASS, B.SNOWY_GRASS, B.GRAVEL], 0.6, 'shovel');
mine([B.DIRT, B.SAND], 0.5, 'shovel');
mine([B.SNOW], 0.3, 'shovel');
mine([B.STONE, B.STONE_BRICK], 1.5, 'pickaxe', 1);
mine([B.COBBLE, B.BRICK, B.FURNACE], 2, 'pickaxe', 1);
mine([B.SANDSTONE], 0.8, 'pickaxe', 1);
mine([B.COAL_ORE], 2.5, 'pickaxe', 1);
mine([B.IRON_ORE], 3, 'pickaxe', 2);
mine([B.GOLD_ORE, B.DIAMOND_ORE], 3, 'pickaxe', 3);
mine([B.LOG, B.PLANKS], 2, 'axe');
mine([B.CRAFTING_TABLE], 2.5, 'axe');
mine([B.LEAVES], 0.2);
mine([B.GLASS, B.LAMP], 0.3);
mine([B.CACTUS], 0.4);
mine([B.WOOL_WHITE, B.WOOL_RED, B.WOOL_BLUE, B.WOOL_YELLOW, B.WOOL_GREEN, B.WOOL_BLACK], 0.8);

const DROPS = {
  [B.GRASS]: B.DIRT, [B.SNOWY_GRASS]: B.DIRT, [B.STONE]: B.COBBLE,
  [B.COAL_ORE]: I.COAL, [B.IRON_ORE]: I.IRON_INGOT, [B.GOLD_ORE]: I.GOLD_INGOT, [B.DIAMOND_ORE]: I.DIAMOND,
};

const TIER_NAMES = ['', 'Wooden', 'Stone', 'Iron', 'Diamond'];

/**
 * How long (seconds) it takes to break `blockId` holding item `heldId`,
 * and whether it drops anything. Infinity = unbreakable.
 */
export function miningInfo(blockId, heldId) {
  const m = MINE[blockId];
  if (!m) return { time: Infinity, canHarvest: false };
  const tool = ITEMS.get(heldId)?.tool;
  const right = tool && tool.kind === m.tool;
  const canHarvest = m.tier === 0 || (right && tool.tier >= m.tier);
  const time = (m.hardness * (canHarvest ? 1.5 : 5)) / (right ? tool.speed : 1);
  const hint = canHarvest ? '' : `You need a ${TIER_NAMES[m.tier]} Pickaxe or better`;
  return { time: Math.max(0.05, time), canHarvest, hint };
}

/** Returns the item ID dropped by a block (or null). */
export function dropFor(blockId, rand = Math.random()) {
  if (blockId === B.LEAVES) return rand < 0.12 ? I.APPLE : null;
  if (blockId === B.WATER || blockId === B.BEDROCK || blockId === B.AIR) return null;
  return DROPS[blockId] ?? (ITEMS.has(blockId) ? blockId : null);
}

// ---------- crafting ----------
// station: null (anywhere), 'table' (near a Crafting Table), 'furnace' (near a Furnace)
export const RECIPES = [];
const recipe = (out, count, inputs, station = null) => RECIPES.push({ out, count, inputs, station });

recipe(B.PLANKS, 4, [[B.LOG, 1]]);
recipe(I.STICK, 4, [[B.PLANKS, 2]]);
recipe(B.CRAFTING_TABLE, 1, [[B.PLANKS, 4]]);
const MATERIAL = [B.PLANKS, B.COBBLE, I.IRON_INGOT, I.DIAMOND];
TIERS.forEach((t, i) => {
  recipe(I[`${t.key}_PICK`], 1, [[MATERIAL[i], 3], [I.STICK, 2]], 'table');
  recipe(I[`${t.key}_AXE`], 1, [[MATERIAL[i], 3], [I.STICK, 2]], 'table');
  recipe(I[`${t.key}_SHOVEL`], 1, [[MATERIAL[i], 1], [I.STICK, 2]], 'table');
});
recipe(B.FURNACE, 1, [[B.COBBLE, 8]], 'table');
recipe(B.STONE_BRICK, 4, [[B.STONE, 4]], 'table');
recipe(B.SANDSTONE, 1, [[B.SAND, 4]], 'table');
recipe(B.LAMP, 1, [[B.GLASS, 4], [I.COAL, 1]], 'table');
recipe(B.SNOW, 1, [[B.SNOWY_GRASS, 1]], 'table');
recipe(B.GLASS, 1, [[B.SAND, 1]], 'furnace');
recipe(B.STONE, 1, [[B.COBBLE, 1]], 'furnace');
recipe(B.BRICK, 2, [[B.DIRT, 4], [I.COAL, 1]], 'furnace');
recipe(I.COAL, 1, [[B.LOG, 2]], 'furnace');

export const STATION_BLOCK = { table: B.CRAFTING_TABLE, furnace: B.FURNACE };

// ---------- icons ----------
// 16x16 sprites drawn from tiny pixel masks; '#' = main colour, 's' = stick, 'd' = dark outline.
const SPRITES = {
  stick: [
    '................', '................', '.............ss.', '............ss..',
    '...........ss...', '..........ss....', '.........ss.....', '........ss......',
    '.......ss.......', '......ss........', '.....ss.........', '....ss..........',
    '...ss...........', '..ss............', '................', '................',
  ],
  pickaxe: [
    '................', '...#######......', '..##########....', '.##.....ss###...',
    '.#......ss..##..', '........ss...##.', '.......ss.....#.', '......ss.......#',
    '.....ss.........', '....ss..........', '...ss...........', '..ss............',
    '.ss.............', 'ss..............', '................', '................',
  ],
  axe: [
    '................', '.........###....', '........#####...', '.......######...',
    '.......##ss##...', '........ss.##...', '.......ss.......', '......ss........',
    '.....ss.........', '....ss..........', '...ss...........', '..ss............',
    '.ss.............', 'ss..............', '................', '................',
  ],
  shovel: [
    '................', '...........###..', '..........#####.', '..........#####.',
    '...........###..', '..........ss....', '.........ss.....', '........ss......',
    '.......ss.......', '......ss........', '.....ss.........', '....ss..........',
    '...ss...........', '..ss............', '................', '................',
  ],
  ingot: [
    '................', '................', '................', '................',
    '................', '.....########...', '....#########d..', '...##########d..',
    '..###########d..', '..ddddddddddd...', '................', '................',
    '................', '................', '................', '................',
  ],
  lump: [
    '................', '................', '................', '......####......',
    '....########....', '...##########...', '...###########..', '..############..',
    '..###########...', '...##########...', '....########....', '......####......',
    '................', '................', '................', '................',
  ],
  gem: [
    '................', '................', '.....######.....', '....########....',
    '...##########...', '..############..', '...##########...', '....########....',
    '.....######.....', '......####......', '.......##.......', '................',
    '................', '................', '................', '................',
  ],
  egg: [
    '................', '.......##.......', '......####......', '.....##s###.....',
    '.....######.....', '....###s####....', '....########....', '...####s#####...',
    '...##########...', '...###s######...', '...##########...', '....####s###....',
    '.....######.....', '......####......', '................', '................',
  ],
  apple: [
    '................', '........s.......', '.......s.gg.....', '....###s###.....',
    '...##########...', '..############..', '..############..', '..############..',
    '..############..', '..############..', '...##########...', '....########....',
    '.....##..##.....', '................', '................', '................',
  ],
};

function spriteIcon(def, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const px = size / 16;
  const rows = SPRITES[def.sprite];
  const col = def.sprite === 'apple' ? [210, 40, 35] : (def.color || [150, 115, 65]);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    let rgb = null;
    if (ch === '#') {
      const shade = 1 + ((x * 7 + y * 13) % 5 - 2) * 0.05 - (y / 16) * 0.15;
      rgb = col.map((v) => Math.round(v * shade));
    } else if (ch === 's') rgb = [120, 85, 45];
    else if (ch === 'd') rgb = col.map((v) => Math.round(v * 0.55));
    else if (ch === 'g') rgb = [70, 150, 50];
    if (!rgb) return;
    ctx.fillStyle = `rgb(${rgb.join(',')})`;
    ctx.fillRect(x * px, y * px, px, px);
  }));
  return c.toDataURL();
}

const iconCache = new Map();
export function itemIcon(atlasCanvas, id, size = 64) {
  if (iconCache.has(id)) return iconCache.get(id);
  const def = ITEMS.get(id);
  const url = !def ? '' : def.block !== undefined ? blockIcon(atlasCanvas, BLOCKS[def.block], size) : spriteIcon(def, size);
  iconCache.set(id, url);
  return url;
}
