// Block registry. IDs are stored in chunk data (Uint8Array), so keep them < 256
// and never renumber existing IDs (saved worlds reference them).
import { TILE } from './textures.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, LOG: 6, LEAVES: 7, PLANKS: 8,
  GLASS: 9, BRICK: 10, SNOW: 11, COAL_ORE: 12, IRON_ORE: 13, WATER: 14, BEDROCK: 15,
  GRAVEL: 16, CACTUS: 17, GOLD_ORE: 18, SANDSTONE: 19, STONE_BRICK: 20, SNOWY_GRASS: 21,
  WOOL_WHITE: 22, WOOL_RED: 23, WOOL_BLUE: 24, WOOL_YELLOW: 25, WOOL_GREEN: 26, WOOL_BLACK: 27,
  LAMP: 28, DIAMOND_ORE: 29,
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
def(B.LAMP, 'Lamp', TILE.LAMP, { emissive: true });
def(B.DIAMOND_ORE, 'Diamond Ore', TILE.DIAMOND);

// Fast lookup tables used in hot loops (meshing, physics).
export const SOLID = new Uint8Array(256);
export const OPAQUE = new Uint8Array(256);
export const TRANSPARENT = new Uint8Array(256);
BLOCKS.forEach((b) => {
  SOLID[b.id] = b.solid ? 1 : 0;
  OPAQUE[b.id] = b.solid && !b.transparent ? 1 : 0;
  TRANSPARENT[b.id] = b.transparent ? 1 : 0;
});

export const PLACEABLE = BLOCKS.filter((b) => b.placeable).map((b) => b.id);
