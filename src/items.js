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
  DOG_EGG: 294, CAT_EGG: 295,
  ROBOT: 300, GLIDER: 301,
  LINE_WAND: 310, BOX_TOOL: 311, WALLS_TOOL: 312, SPHERE_TOOL: 313, PAINT_ROLLER: 314, RAINBOW_BRUSH: 315,
  SEEDS: 320, WHEAT: 321, BREAD: 322, HOE: 323, WATERING_CAN: 324,
  PARTY_HAT: 330, CROWN: 331, SUNGLASSES: 332,
  WOOD_SWORD: 340, STONE_SWORD: 341, IRON_SWORD: 342, DIAMOND_SWORD: 343,
  BOW: 344, ARROW: 345, SHIELD: 346, WOOL_ARMOR: 347, IRON_ARMOR: 348, DIAMOND_ARMOR: 349,
  COZY_PET_COAT: 360, IRON_PET_ARMOR: 361, STAR_PET_ARMOR: 362, PET_BACKPACK: 363,
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
item(I.DOG_EGG, 'Pet Dog Egg', { sprite: 'egg', color: [205, 150, 85], spots: [120, 80, 45], spawns: 'dog', creativeOnly: true });
item(I.CAT_EGG, 'Pet Cat Egg', { sprite: 'egg', color: [235, 150, 60], spots: [190, 100, 35], spawns: 'cat', creativeOnly: true });
item(I.CHICKEN_EGG, 'Chicken Spawn Egg', { sprite: 'egg', color: [245, 245, 245], spots: [210, 40, 40], spawns: 'chicken', creativeOnly: true });

// Bit the code robot: right-click a block to place it, right-click Bit to program it.
item(I.ROBOT, 'Robot Bit', { sprite: 'robot', stack: 1 });
// Hold the umbrella glider and keep jump pressed while falling to float down.
item(I.GLIDER, 'Umbrella Glider', { sprite: 'umbrella', stack: 1, glider: true });

// Garden and farm.
item(I.SEEDS, 'Wheat Seeds', { sprite: 'seeds', color: [140, 170, 60] });
item(I.WHEAT, 'Wheat', { sprite: 'wheat', color: [225, 195, 80] });
item(I.BREAD, 'Bread', { sprite: 'bread', color: [200, 140, 70], food: 5 });
item(I.HOE, 'Hoe', { sprite: 'hoe', color: [150, 115, 65], stack: 1, hoe: true });
item(I.WATERING_CAN, 'Watering Can', { sprite: 'can', color: [90, 160, 230], stack: 1, water: true });

// Adventure combat gear (only useful in Adventure mode, where night creatures roam).
[['WOOD', 'Wooden', [150, 115, 65], 4], ['STONE', 'Stone', [125, 125, 125], 5], ['IRON', 'Iron', [225, 225, 228], 6], ['DIAMOND', 'Diamond', [90, 225, 215], 7]]
  .forEach(([k, n, c, dmg]) => item(I[`${k}_SWORD`], `${n} Sword`, { sprite: 'sword', color: c, stack: 1, damage: dmg }));
item(I.BOW, 'Bow', { sprite: 'bow', color: [150, 105, 60], stack: 1, bow: true });
item(I.ARROW, 'Arrow', { sprite: 'arrow', color: [200, 200, 205] });
item(I.SHIELD, 'Shield', { sprite: 'shield', color: [150, 110, 65], stack: 1, shield: true });
item(I.WOOL_ARMOR, 'Wool Armor', { sprite: 'armor', color: [235, 235, 235], stack: 1, armor: 0.2 });
item(I.IRON_ARMOR, 'Iron Armor', { sprite: 'armor', color: [215, 215, 222], stack: 1, armor: 0.4 });
item(I.DIAMOND_ARMOR, 'Diamond Armor', { sprite: 'armor', color: [90, 225, 215], stack: 1, armor: 0.6 });

// Pet accessories: right-click your pet while holding one.
item(I.PARTY_HAT, 'Party Hat', { sprite: 'partyhat', color: [240, 80, 160], stack: 16, accessory: 'party' });
item(I.CROWN, 'Tiny Crown', { sprite: 'crown', color: [250, 210, 60], stack: 16, accessory: 'crown' });
item(I.SUNGLASSES, 'Sunglasses', { sprite: 'glasses', color: [30, 30, 40], stack: 16, accessory: 'glasses' });

// Pet armor (right-click your pet while holding it) cuts the damage the pet takes; the backpack gives it 9 slots.
// `petArmor` is the share of damage blocked.
item(I.COZY_PET_COAT, 'Cozy Pet Coat', { sprite: 'petarmor', color: [120, 170, 235], stack: 1, petArmor: 0.25 });
item(I.IRON_PET_ARMOR, 'Iron Pet Armor', { sprite: 'petarmor', color: [205, 208, 215], stack: 1, petArmor: 0.5 });
item(I.STAR_PET_ARMOR, 'Starlight Pet Armor', { sprite: 'petarmor', color: [250, 205, 70], stack: 1, petArmor: 0.75 });
item(I.PET_BACKPACK, 'Pet Backpack', { sprite: 'backpack', color: [200, 80, 70], stack: 1, petBackpack: true });
export const PET_BAG_SLOTS = 9;

// Creative power tools. Shape tools: right-click two points to build, left-click two points to erase.
// They build with the last block you held.
item(I.LINE_WAND, 'Bridge Wand', { sprite: 'wand', color: [255, 220, 90], stack: 1, creativeOnly: true, shape: 'line' });
item(I.BOX_TOOL, 'Box Builder', { sprite: 'boxtool', color: [120, 200, 255], stack: 1, creativeOnly: true, shape: 'box' });
item(I.WALLS_TOOL, 'House Walls', { sprite: 'walls', color: [230, 150, 90], stack: 1, creativeOnly: true, shape: 'walls' });
item(I.SPHERE_TOOL, 'Dome Maker', { sprite: 'sphere', color: [190, 130, 255], stack: 1, creativeOnly: true, shape: 'sphere' });
item(I.PAINT_ROLLER, 'Paint Roller', { sprite: 'roller', color: [90, 200, 120], stack: 1, creativeOnly: true, paint: 'block' });
item(I.RAINBOW_BRUSH, 'Rainbow Brush', { sprite: 'brush', color: [255, 120, 180], stack: 1, creativeOnly: true, paint: 'rainbow' });

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
mine([B.TORCH], 0.05);
mine([B.TRAMPOLINE, B.CONFETTI, B.NOTE_1, B.NOTE_2, B.NOTE_3, B.NOTE_4, B.NOTE_5, B.NOTE_6, B.NOTE_7, B.NOTE_8], 0.6);
mine([B.SPEED_STRIP, B.FAN], 1, 'pickaxe');
mine([B.ICE], 0.5, 'pickaxe');
mine([B.NEON_PINK, B.NEON_CYAN, B.NEON_LIME, B.NEON_PURPLE], 0.3);
mine([B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_BLUE, B.FLOWER_PINK, B.TALL_GRASS, B.WHEAT_0, B.WHEAT_1, B.WHEAT_2, B.WHEAT_3], 0.05);
mine([B.FARMLAND], 0.5, 'shovel');
mine([B.LANTERN], 0.3);
mine([B.PORTAL_BLUE, B.PORTAL_ORANGE, B.PORTAL_GREEN, B.PORTAL_PURPLE], 0.4);
mine([B.CACTUS], 0.4);
mine(BLOCKS.filter((b) => b?.spark).map((b) => b.id), 0.3);
mine([B.PET_BED], 0.3);
mine([B.KENNEL], 1.5, 'axe');
mine(BLOCKS.filter((b) => b?.course).map((b) => b.id), 0.3);
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
  if (blockId === B.TALL_GRASS) return rand < 0.3 ? I.SEEDS : null;
  if (blockId === B.WHEAT_3) return I.WHEAT;
  if (blockId >= B.WHEAT_0 && blockId < B.WHEAT_3) return I.SEEDS;
  if (blockId === B.FARMLAND) return B.DIRT;
  if (blockId === B.WATER || blockId === B.BEDROCK || blockId === B.AIR) return null;
  if (BLOCKS[blockId]?.spark) return BLOCKS[blockId].base ?? null; // on/off and facing variants give the plain item back
  if (blockId === B.COIN_TAKEN) return B.COIN;
  return DROPS[blockId] ?? (ITEMS.has(blockId) ? blockId : null);
}

// ---------- crafting ----------
// station: null (anywhere), 'table' (near a Crafting Table), 'furnace' (near a Furnace)
export const RECIPES = [];
const recipe = (out, count, inputs, station = null) => RECIPES.push({ out, count, inputs, station });

recipe(B.PLANKS, 4, [[B.LOG, 1]]);
recipe(I.STICK, 4, [[B.PLANKS, 2]]);
recipe(B.CRAFTING_TABLE, 1, [[B.PLANKS, 4]]);
recipe(I.BREAD, 1, [[I.WHEAT, 3]]);
recipe(I.HOE, 1, [[B.PLANKS, 2], [I.STICK, 2]]);
recipe(I.PARTY_HAT, 1, [[B.WOOL_RED, 1], [B.WOOL_YELLOW, 1]]);
recipe(I.COZY_PET_COAT, 1, [[B.WOOL_BLUE, 3], [B.WOOL_WHITE, 2]]);
recipe(I.IRON_PET_ARMOR, 1, [[I.IRON_INGOT, 5]], 'table');
recipe(I.STAR_PET_ARMOR, 1, [[I.DIAMOND, 2], [I.GOLD_INGOT, 3], [B.STAR, 1]], 'table');
recipe(I.PET_BACKPACK, 1, [[B.WOOL_RED, 3], [I.IRON_INGOT, 1], [I.STICK, 2]], 'table');
recipe(B.PET_BED, 1, [[B.WOOL_RED, 2], [B.PLANKS, 2]]);
recipe(B.KENNEL, 1, [[B.PLANKS, 6], [B.WOOL_RED, 1]], 'table');
recipe(I.CROWN, 1, [[I.GOLD_INGOT, 2]], 'table');
recipe(B.STAR, 1, [[I.GOLD_INGOT, 1], [B.GLASS, 1]], 'table');
recipe(I.WOOD_SWORD, 1, [[B.PLANKS, 2], [I.STICK, 1]], 'table');
recipe(I.STONE_SWORD, 1, [[B.COBBLE, 2], [I.STICK, 1]], 'table');
recipe(I.IRON_SWORD, 1, [[I.IRON_INGOT, 2], [I.STICK, 1]], 'table');
recipe(I.DIAMOND_SWORD, 1, [[I.DIAMOND, 2], [I.STICK, 1]], 'table');
recipe(I.BOW, 1, [[I.STICK, 3], [B.WOOL_WHITE, 1]], 'table');
recipe(I.ARROW, 4, [[I.STICK, 1], [B.COBBLE, 1]], 'table');
recipe(I.SHIELD, 1, [[B.PLANKS, 6], [I.IRON_INGOT, 1]], 'table');
recipe(I.WOOL_ARMOR, 1, [[B.WOOL_WHITE, 8]], 'table');
recipe(I.IRON_ARMOR, 1, [[I.IRON_INGOT, 8]], 'table');
recipe(I.DIAMOND_ARMOR, 1, [[I.DIAMOND, 8]], 'table');
recipe(B.PORTAL_BLUE, 2, [[I.DIAMOND, 1], [B.WOOL_BLUE, 2]], 'table');
recipe(B.PORTAL_ORANGE, 2, [[I.DIAMOND, 1], [B.WOOL_RED, 1], [B.WOOL_YELLOW, 1]], 'table');
recipe(B.PORTAL_GREEN, 2, [[I.DIAMOND, 1], [B.WOOL_GREEN, 2]], 'table');
recipe(B.PORTAL_PURPLE, 2, [[I.DIAMOND, 1], [B.WOOL_BLACK, 1], [B.WOOL_RED, 1]], 'table');
recipe(I.SUNGLASSES, 1, [[B.GLASS, 1], [B.WOOL_BLACK, 1]]);
recipe(I.WATERING_CAN, 1, [[I.IRON_INGOT, 1], [B.PLANKS, 2]], 'table');
recipe(B.TORCH, 4, [[I.STICK, 1], [I.COAL, 1]]);
// Spark circuits
recipe(B.WIRE, 8, [[I.GOLD_INGOT, 1], [I.COAL, 1]], 'table');
// Course Maker
recipe(B.COURSE_START, 1, [[B.PLANKS, 2], [B.WOOL_GREEN, 1]]);
recipe(B.COURSE_CHECK, 1, [[B.PLANKS, 2], [B.WOOL_BLUE, 1]]);
recipe(B.COURSE_FINISH, 1, [[B.PLANKS, 2], [B.WOOL_WHITE, 1], [B.WOOL_BLACK, 1]]);
recipe(B.COIN, 8, [[I.GOLD_INGOT, 1]]);
recipe(B.LEVER, 1, [[I.STICK, 1], [B.COBBLE, 1], [B.WIRE, 1]]);
recipe(B.BUTTON, 1, [[B.STONE, 1], [B.WIRE, 1]]);
recipe(B.PLATE, 1, [[B.PLANKS, 2], [B.WIRE, 1]]);
recipe(B.BATTERY, 1, [[B.WIRE, 4], [I.GOLD_INGOT, 1]], 'table');
recipe(B.INVERTER, 1, [[B.WIRE, 2], [B.TORCH, 1], [B.STONE, 2]], 'table');
recipe(B.DELAY, 1, [[B.WIRE, 2], [B.TORCH, 2], [B.STONE, 2]], 'table');
recipe(B.SPARK_LAMP, 1, [[B.WIRE, 2], [B.GLASS, 2], [B.TORCH, 1]], 'table');
recipe(B.SPARK_DOOR, 1, [[I.IRON_INGOT, 4], [B.WIRE, 1]], 'table');
recipe(B.PISTON, 1, [[B.PLANKS, 3], [B.COBBLE, 4], [I.IRON_INGOT, 1], [B.WIRE, 1]], 'table');
const MATERIAL = [B.PLANKS, B.COBBLE, I.IRON_INGOT, I.DIAMOND];
TIERS.forEach((t, i) => {
  recipe(I[`${t.key}_PICK`], 1, [[MATERIAL[i], 3], [I.STICK, 2]], 'table');
  recipe(I[`${t.key}_AXE`], 1, [[MATERIAL[i], 3], [I.STICK, 2]], 'table');
  recipe(I[`${t.key}_SHOVEL`], 1, [[MATERIAL[i], 1], [I.STICK, 2]], 'table');
});
recipe(B.FURNACE, 1, [[B.COBBLE, 8]], 'table');
recipe(B.TRAMPOLINE, 2, [[B.WOOL_YELLOW, 4], [B.PLANKS, 1]], 'table');
recipe(B.SPEED_STRIP, 4, [[B.STONE, 4], [I.COAL, 1]], 'table');
recipe(B.ICE, 2, [[B.SNOW, 4]]);
recipe(B.FAN, 1, [[I.IRON_INGOT, 1], [B.PLANKS, 4]], 'table');
recipe(B.NEON_PINK, 4, [[B.GLASS, 2], [B.WOOL_RED, 1], [I.COAL, 1]], 'table');
recipe(B.NEON_CYAN, 4, [[B.GLASS, 2], [B.WOOL_BLUE, 1], [I.COAL, 1]], 'table');
recipe(B.NEON_LIME, 4, [[B.GLASS, 2], [B.WOOL_GREEN, 1], [I.COAL, 1]], 'table');
recipe(B.NEON_PURPLE, 4, [[B.GLASS, 2], [B.WOOL_BLACK, 1], [I.COAL, 1]], 'table');
// One recipe gives the whole do-re-mi set.
RECIPES.push({ out: B.NOTE_1, count: 1, extra: [2, 3, 4, 5, 6, 7].map((k) => [B.NOTE_1 + k - 1, 1]).concat([[B.NOTE_8, 1]]), label: 'Music Stones (all 8 notes)', inputs: [[B.PLANKS, 8], [B.GLASS, 1]], station: 'table' });
recipe(B.CONFETTI, 2, [[B.WOOL_WHITE, 2], [I.COAL, 1]], 'table');
recipe(I.GLIDER, 1, [[B.WOOL_WHITE, 3], [I.STICK, 2]], 'table');
recipe(I.ROBOT, 1, [[I.IRON_INGOT, 3], [B.GLASS, 1], [I.COAL, 1]], 'table');
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
  sword: [
    '..............##', '.............###', '............###.', '...........###..', '..........###...', '.........###....',
    '........###.....', '...d...###......', '....d.###.......', '.....d##........', '......dd........', '.....ssdd.......',
    '....ss...d......', '...ss...........', '..ss............', '................',
  ],
  bow: [
    '................', '.......sss......', '......s...d.....', '.....s.....d....', '....s.......d...', '....s.......d...',
    '...s........d...', '...s........d...', '...s........d...', '...s........d...', '....s.......d...', '....s.......d...',
    '.....s.....d....', '......s...d.....', '.......sss......', '................',
  ],
  arrow: [
    '................', '.............##.', '............###.', '...........s##..', '..........s.....', '.........s......',
    '........s.......', '.......s........', '......s.........', '.....s..........', '..dds...........', '..dd............',
    '...d............', '................', '................', '................',
  ],
  shield: [
    '................', '...##########...', '...#ssssssss#...', '...#ssd##dss#...', '...#ssd##dss#...', '...#sssddsss#...',
    '...#ssssssss#...', '...#ssssssss#...', '....#ssssss#....', '....#ssssss#....', '.....#ssss#.....', '......####......',
    '................', '................', '................', '................',
  ],
  armor: [
    '................', '...###....###...', '..#####..#####..', '..############..', '..############..', '...##########...',
    '....########....', '....##dddd##....', '....########....', '....########....', '....########....', '....########....',
    '.....######.....', '................', '................', '................',
  ],
  petarmor: [
    '................', '................', '...#########....', '..###########...', '.####dddddd####.', '.###d######d###.',
    '.###d#yyyy#d###.', '.###d######d###.', '..##dddddddd##..', '..###########...', '...##.#####.##..', '...##.......##..',
    '................', '................', '................', '................',
  ],
  backpack: [
    '................', '.....dddddd.....', '....d######d....', '...d########d...', '...##########...', '...#dddddddd#...',
    '...#d######d#...', '...#d#yyyy#d#...', '...#d######d#...', '...#dddddddd#...', '...##########...', '...d########d...',
    '....dddddddd....', '................', '................', '................',
  ],
  partyhat: [
    '.......dd.......', '.......##.......', '......####......', '......#dd#......', '.....######.....', '.....##dd##.....',
    '....########....', '....###dd###....', '...##########...', '...####dd####...', '..############..', '................',
    '................', '................', '................', '................',
  ],
  crown: [
    '................', '................', '................', '..#....#....#...', '..##..###..##...', '..###.###.###...',
    '..###########...', '..##d##d##d##...', '..###########...', '..###########...', '................', '................',
    '................', '................', '................', '................',
  ],
  glasses: [
    '................', '................', '................', '................', '................', '.##############.',
    '.#####....#####.', '.#####....#####.', '..###......###..', '................', '................', '................',
    '................', '................', '................', '................',
  ],
  seeds: [
    '................', '................', '......#...#.....', '...#.....#...#..', '.....#.#....#...', '..#.........#...',
    '......#..#......', '...#.#.....#....', '.......#..#.....', '..#..#.........#', '.........#..#...', '....#...#.......',
    '................', '................', '................', '................',
  ],
  wheat: [
    '.......#........', '......###.......', '.......#.#......', '......##.##.....', '.....#.#.#......', '......#####.....',
    '.....#.#.#.#....', '.......s........', '.......s........', '......ss........', '......s.........', '.....ss.........',
    '.....s..........', '................', '................', '................',
  ],
  bread: [
    '................', '................', '................', '.....######.....', '...##########...', '..###d###d###...',
    '..############..', '..#####d###d##..', '..############..', '...##########...', '....dddddddd....', '................',
    '................', '................', '................', '................',
  ],
  hoe: [
    '................', '.......#####....', '......######....', '..........ss....', '.........ss.....', '........ss......',
    '.......ss.......', '......ss........', '.....ss.........', '....ss..........', '...ss...........', '..ss............',
    '................', '................', '................', '................',
  ],
  can: [
    '................', '................', '.....######.....', '....#......#....', '...##########.##', '...##########.#.',
    '...###########..', '...##########...', '...##########...', '...##########...', '...##########...', '....########....',
    '................', '................', '................', '................',
  ],
  wand: [
    '................', '.........#......', '.......#.#.#....', '........###.....', '......#######...', '........###.....',
    '.......#.s.#....', '.........s......', '........s.......', '.......s........', '......s.........', '.....s..........',
    '....s...........', '...s............', '................', '................',
  ],
  boxtool: [
    '................', '................', '....########....', '...#.......##...', '..########.#.#..', '..#......#.#.#..',
    '..#......#.#.#..', '..#......#.#.#..', '..#......#.##...', '..#......#.#....', '..########......', '................',
    '................', '................', '................', '................',
  ],
  walls: [
    '................', '................', '..#..#..#..#....', '..##########....', '..#........#....', '..#..dd....#....',
    '..#..dd....#....', '..#........#....', '..#...##...#....', '..#...##...#....', '..##########....', '................',
    '................', '................', '................', '................',
  ],
  sphere: [
    '................', '................', '.....######.....', '....#......#....', '...#........#...', '..#..........#..',
    '..#..........#..', '..##############', '................', '................', '................', '................',
    '................', '................', '................', '................',
  ],
  roller: [
    '................', '..###########...', '..###########...', '..###########...', '.............s..', '.............s..',
    '.......sssssss..', '.......s........', '.......s........', '.......s........', '......ddd.......', '......ddd.......',
    '......ddd.......', '......ddd.......', '................', '................',
  ],
  brush: [
    '................', '...........rr...', '..........yyrr..', '.........ggyy...', '........bbgg....', '.......ssbb.....',
    '......sss.......', '.....sss........', '....sss.........', '...sss..........', '..sss...........', '................',
    '................', '................', '................', '................',
  ],
  umbrella: [
    '................', '......####......', '....########....', '...##########...',
    '..############..', '..############..', '.d.d.d.ss.d.d.d.', '........s.......',
    '........s.......', '........s.......', '........s.......', '........s.......',
    '......s.s.......', '.......s........', '................', '................',
  ],
  robot: [
    '................', '.......r........', '.......d........', '...##########...',
    '...#wwwwwwww#...', '...#wcwwwwcw#...', '...#wwwwwwww#...', '...##########...',
    '....bbbbbbbb....', '..b.bbyyyybb.b..', '..b.bbbbbbbb.b..', '....bbbbbbbb....',
    '.....dd..dd.....', '....dddddddd....', '................', '................',
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
  const col = def.sprite === 'apple' ? [210, 40, 35] : def.sprite === 'robot' ? [223, 230, 238] : def.sprite === 'umbrella' ? [235, 80, 120] : (def.color || [150, 115, 65]);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    let rgb = null;
    if (ch === '#') {
      const shade = 1 + ((x * 7 + y * 13) % 5 - 2) * 0.05 - (y / 16) * 0.15;
      rgb = col.map((v) => Math.round(v * shade));
    } else if (ch === 's') rgb = [120, 85, 45];
    else if (ch === 'd') rgb = col.map((v) => Math.round(v * 0.55));
    else if (ch === 'g') rgb = [70, 150, 50];
    else if (ch === 'r') rgb = [255, 90, 90];
    else if (ch === 'w') rgb = [16, 32, 46];
    else if (ch === 'c') rgb = [124, 240, 255];
    else if (ch === 'b') rgb = [61, 143, 214];
    else if (ch === 'y') rgb = [255, 201, 74];
    if (!rgb) return;
    ctx.fillStyle = `rgb(${rgb.join(',')})`;
    ctx.fillRect(x * px, y * px, px, px);
  }));
  return c.toDataURL();
}

/** Flat pixel-art icon straight from a tile (for torches and other non-cube blocks). */
function flatIcon(atlasCanvas, tile, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlasCanvas, (tile % 8) * 16, Math.floor(tile / 8) * 16, 16, 16, 0, 0, size, size);
  return c.toDataURL();
}

const iconCache = new Map();
export function itemIcon(atlasCanvas, id, size = 64) {
  if (iconCache.has(id)) return iconCache.get(id);
  const def = ITEMS.get(id);
  let url = '';
  if (def && def.block !== undefined && BLOCKS[def.block].shape) url = flatIcon(atlasCanvas, BLOCKS[def.block].side, size);
  else if (def) url = def.block !== undefined ? blockIcon(atlasCanvas, BLOCKS[def.block], size) : spriteIcon(def, size);
  iconCache.set(id, url);
  return url;
}
