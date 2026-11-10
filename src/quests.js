// Learning quests: small goals that teach the controls, animal names, counting,
// colours, shapes and simple maths, plus a survival track from first log to diamond.
// Each quest awards 1–3 stars. Progress is driven by game events (see emit()).
import { B } from './blocks.js';
import { I } from './items.js';
import { WOOL } from './mobs.js';

const WOOL_SET = new Set(WOOL);
const SOFT = new Set([B.DIRT, B.GRASS, B.SNOWY_GRASS]);

// track: 'all' (both modes) | 'survival'
// event + count; optional test(d), amount(d), distinct(d) (count unique keys), value(d, ctx) (keep the max)
export const QUESTS = [
  { id: 'walk', track: 'all', icon: '👣', title: 'First Steps', text: 'Walk 20 blocks. Use W A S D (or the joystick) to move.', event: 'walk', count: 20, amount: (d) => d, stars: 1 },
  { id: 'jump', track: 'all', icon: '🦘', title: 'Hop Hop Hop', text: 'Jump 5 times. Count each hop!', event: 'jump', count: 5, stars: 1 },
  { id: 'wood', track: 'survival', icon: '🪵', title: 'Tree Puncher', text: 'Hold the button on a tree trunk to collect 4 Oak Logs.', event: 'collect', test: (d) => d.id === B.LOG, count: 4, stars: 1, reward: [I.APPLE, 2] },
  { id: 'pat3', track: 'all', icon: '🐷', title: 'Say Hello', text: 'Pat 3 different kinds of animals. Can you name them? Pig, Cow, Sheep, Chicken!', event: 'pat', distinct: (d) => d.type, count: 3, stars: 2 },
  { id: 'table', track: 'survival', icon: '🛠️', title: 'Crafting Time', text: 'Open your inventory and craft a Crafting Table from 4 planks.', event: 'craft', test: (d) => d.id === B.CRAFTING_TABLE, count: 1, stars: 1 },
  { id: 'place10', track: 'all', icon: '🔟', title: 'Count to 10', text: 'Place 10 blocks. Count them out loud: 1, 2, 3…', event: 'place', count: 10, stars: 1 },
  { id: 'tool', track: 'creative', icon: '🪄', title: 'Magic Builder', text: 'Pick a block, then grab the Bridge Wand, Box Builder, House Walls or Dome Maker. Right-click two points to build in a flash!', event: 'tool', test: (d) => d.kind !== 'paint', count: 1, stars: 2 },
  { id: 'undo', track: 'creative', icon: '↶', title: 'Oops, Undo!', text: 'Made a mistake? Press Z (or tap ↶) to undo your last build.', event: 'undo', count: 1, stars: 1 },
  { id: 'pick', track: 'survival', icon: '⛏️', title: 'My First Tool', text: 'Stand next to your Crafting Table and craft a Wooden Pickaxe.', event: 'craft', test: (d) => d.id === I.WOOD_PICK, count: 1, stars: 1 },
  { id: 'bounce', track: 'all', icon: '🦘', title: 'Boing Boing!', text: 'Build a yellow Trampoline and bounce 6 blocks high. Hold jump for a super bounce!', event: 'bounce', value: (d) => Math.floor(d), count: 6, stars: 2 },
  { id: 'song', track: 'all', icon: '🎵', title: 'Little Composer', text: 'Walk over 5 different Music Stones to play a tune. Do, re, mi…', event: 'note', distinct: (d) => d.note, count: 5, stars: 2 },
  { id: 'math1', track: 'all', icon: '➕', title: 'Math Miner', text: 'Break 3 + 4 blocks of dirt or grass. How many is that?', reveal: '3 + 4 = 7', event: 'mine', test: (d) => SOFT.has(d.id), count: 7, stars: 2 },
  { id: 'shear', track: 'all', icon: '🐑', title: 'Woolly Jumper', text: 'Right-click (or tap) a sheep to shear its wool.', event: 'shear', count: 1, stars: 1 },
  { id: 'stone', track: 'survival', icon: '🪨', title: 'Stone Age', text: 'Use your pickaxe to collect 10 Cobblestone.', event: 'collect', test: (d) => d.id === B.COBBLE, count: 10, stars: 2, reward: [I.APPLE, 2] },
  { id: 'tower', track: 'all', icon: '🗼', title: 'Tower Power', text: 'Build a tower 5 blocks tall. Jump and place a block under your feet!', event: 'place', value: (d, ctx) => ctx.towerHeight(d), count: 5, stars: 2 },
  { id: 'eat', track: 'survival', icon: '🍎', title: 'Snack Time', text: 'Eat an apple when you have lost some hearts. Leaves sometimes drop apples!', event: 'eat', count: 1, stars: 1 },
  { id: 'rainbow', track: 'all', icon: '🌈', title: 'Rainbow Builder', text: 'Place wool in 4 different colours. What colours did you use?', event: 'place', test: (d) => WOOL_SET.has(d.id), distinct: (d) => d.id, count: 4, stars: 2 },
  { id: 'furnace', track: 'survival', icon: '🔥', title: 'Hot Stuff', text: 'Craft a Furnace from 8 Cobblestone at your Crafting Table.', event: 'craft', test: (d) => d.id === B.FURNACE, count: 1, stars: 2 },
  { id: 'math2', track: 'all', icon: '✖️', title: 'Glass Times', text: 'Place 2 × 3 glass blocks. How many is that?', reveal: '2 × 3 = 6', event: 'place', test: (d) => d.id === B.GLASS, count: 6, stars: 2 },
  { id: 'glass', track: 'survival', icon: '🪟', title: 'Window Maker', text: 'Make 3 Glass from sand next to a Furnace.', event: 'craft', test: (d) => d.id === B.GLASS, amount: (d) => d.count, count: 3, stars: 2 },
  { id: 'square', track: 'all', icon: '⬛', title: 'Shape Maker', text: 'Build a flat 3 × 3 square floor. That is 9 blocks!', reveal: '3 × 3 = 9', event: 'place', value: (d, ctx) => ctx.squareFill(d), count: 9, stars: 2 },
  { id: 'pet', track: 'all', icon: '🐶', title: 'Best Friend', text: 'Find a dog or cat and feed it an apple to make it your pet. Give it a pat!', event: 'tame', count: 1, stars: 2 },
  { id: 'baby', track: 'all', icon: '🍼', title: 'Animal Family', text: 'Feed apples to two animals of the same kind and watch what happens.', event: 'baby', count: 1, stars: 3 },
  { id: 'torch', track: 'all', icon: '🔦', title: 'Light the Way', text: 'Place 5 torches to light up a dark cave. Make torches from a stick and coal.', event: 'place', test: (d) => d.id === B.TORCH, count: 5, stars: 2 },
  { id: 'village', track: 'all', icon: '🏘️', title: 'Village Visit', text: 'There is a village near where you started. Find it and say hello to a villager (right-click or tap them).', event: 'meetVillager', count: 1, stars: 2 },
  { id: 'swim', track: 'all', icon: '🏊', title: 'Splash!', text: 'Swim 10 blocks in water. Hold jump to float up.', event: 'swim', count: 10, amount: (d) => d, stars: 1 },
  { id: 'climb', track: 'all', icon: '⛰️', title: 'Mountain Top', text: 'Climb up high until you reach height 60. Press F3 to see your height.', event: 'height', value: (d) => Math.floor(d), count: 60, stars: 2 },
  { id: 'night', track: 'all', icon: '⭐', title: 'Star Gazer', text: 'Stay up until night and look at the stars.', event: 'night', count: 1, stars: 1 },
  { id: 'trade3', track: 'survival', icon: '🤝', title: 'Fair Trader', text: 'Make 3 trades with villagers. Count what you give and what you get!', event: 'trade', count: 3, stars: 2 },
  { id: 'iron', track: 'survival', icon: '🔩', title: 'Iron Hunter', text: 'Find Iron Ore in the stone (it has orange spots) and mine it with a Stone Pickaxe.', event: 'collect', test: (d) => d.id === I.IRON_INGOT, count: 1, stars: 2 },
  { id: 'diamond', track: 'survival', icon: '💎', title: 'Diamond Dreams', text: 'Dig deep, deep down and find a Diamond. You need an Iron Pickaxe!', event: 'collect', test: (d) => d.id === I.DIAMOND, count: 1, stars: 3, reward: [I.APPLE, 5] },

  // ---- 🤖 Coding track (Bit the robot) ----
  { id: 'bit1', track: 'coding', icon: '🤖', title: 'Meet Bit', text: 'Get Robot Bit (creative: block picker, survival: craft it) and place it in the world.', event: 'robotPlaced', count: 1, stars: 1 },
  { id: 'bit2', track: 'coding', icon: '▶️', title: 'First Program', text: 'Right-click Bit, press ▶ Run, and let Bit finish a program.', event: 'robotDone', count: 1, stars: 1 },
  { id: 'bit3', track: 'coding', icon: '🔁', title: 'Loop the Loop', text: 'Finish a program that uses a 🔁 repeat block. Loops do things again and again!', event: 'robotDone', test: (d) => usesOp(d.program, 'repeat'), count: 1, stars: 2 },
  { id: 'bit4', track: 'coding', icon: '🧱', title: 'Bit the Builder', text: 'Have Bit place 20 blocks. Tip: hold the block you want Bit to use.', event: 'robot', test: (d) => d.kind === 'place', count: 20, stars: 2 },
  { id: 'bit5', track: 'coding', icon: '🪜', title: 'Up, Up, Up', text: 'In one program, make Bit climb 5 blocks higher than where it started.', event: 'robotClimb', value: (d) => d, count: 5, stars: 2 },
  { id: 'bit6', track: 'coding', icon: '⛏️', title: 'Tunnel Digger', text: 'Have Bit dig 15 blocks.', event: 'robot', test: (d) => d.kind === 'dig', count: 15, stars: 2 },
  { id: 'bit7', track: 'coding', icon: '🎨', title: 'My Own Program', text: 'Build a program that is different from all the starter programs and run it to the end.', event: 'robotDone', test: (d) => d.custom, count: 1, stars: 2 },
  { id: 'bit8', track: 'coding', icon: '🪆', title: 'Loop Inside a Loop', text: 'Finish a program with a repeat block inside another repeat block.', event: 'robotDone', test: (d) => nestedRepeat(d.program), count: 1, stars: 3 },
  { id: 'bit9', track: 'coding', icon: '🧠', title: 'Smart Robot', text: 'Finish a program that uses ❓ if or 🔁 repeat while, so Bit decides what to do by itself.', event: 'robotDone', test: (d) => usesOp(d.program, 'if') || usesOp(d.program, 'while'), count: 1, stars: 3 },
];

/** True if any statement in the program (at any depth) has this op. */
export function usesOp(program, op) {
  const walk = (list) => (list || []).some((s) => s.op === op || walk(s.body) || walk(s.then) || walk(s.else));
  return walk(program);
}

/** True if a repeat block contains another repeat block. */
export function nestedRepeat(program) {
  const walk = (list, inRepeat) => (list || []).some((s) =>
    (s.op === 'repeat' && inRepeat) || walk(s.body, inRepeat || s.op === 'repeat') || walk(s.then, inRepeat) || walk(s.else, inRepeat));
  return walk(program, false);
}

export const ACTIVE_COUNT = 3;

export class Quests {
  constructor() {
    this.done = new Set();
    this.prog = {};      // id -> number
    this.sets = {};      // id -> Set (for distinct quests)
    this.mode = 'creative';
    this.ctx = null;     // { towerHeight(d), squareFill(d) }
    this.onComplete = null; // (quest)
    this.onProgress = null; // ()
  }

  applies(q) { return q.track === 'all' || q.track === 'coding' || q.track === this.mode; }

  get stars() { return QUESTS.reduce((n, q) => n + (this.done.has(q.id) ? q.stars : 0), 0); }
  get maxStars() { return QUESTS.filter((q) => this.applies(q)).reduce((n, q) => n + q.stars, 0); }

  /** The first few unfinished quests for the current mode, plus the next 🤖 coding quest. */
  active() {
    const open = QUESTS.filter((q) => this.applies(q) && !this.done.has(q.id));
    const main = open.filter((q) => q.track !== 'coding').slice(0, ACTIVE_COUNT);
    const code = open.find((q) => q.track === 'coding');
    return code ? [...main, code] : main;
  }

  progress(q) {
    if (this.done.has(q.id)) return q.count;
    if (q.distinct) return this.sets[q.id]?.size ?? 0;
    return Math.min(q.count, Math.floor(this.prog[q.id] ?? 0));
  }

  emit(event, data) {
    let changed = false;
    for (const q of this.active()) {
      if (q.event !== event) continue;
      if (q.test && !q.test(data)) continue;
      if (q.distinct) {
        (this.sets[q.id] ??= new Set()).add(q.distinct(data));
      } else if (q.value) {
        const v = q.value(data, this.ctx);
        if (!(v > (this.prog[q.id] ?? 0))) continue;
        this.prog[q.id] = v;
      } else {
        this.prog[q.id] = (this.prog[q.id] ?? 0) + (q.amount ? q.amount(data) : 1);
      }
      changed = true;
      if (this.progress(q) >= q.count || (q.distinct && this.sets[q.id].size >= q.count)) {
        this.done.add(q.id);
        delete this.prog[q.id]; delete this.sets[q.id];
        this.onComplete?.(q);
      }
    }
    if (changed) this.onProgress?.();
  }

  toJSON() {
    const sets = {};
    for (const [k, v] of Object.entries(this.sets)) sets[k] = [...v];
    return { done: [...this.done], prog: this.prog, sets };
  }

  load(obj) {
    this.done = new Set(Array.isArray(obj?.done) ? obj.done : []);
    this.prog = obj?.prog && typeof obj.prog === 'object' ? { ...obj.prog } : {};
    this.sets = {};
    for (const [k, v] of Object.entries(obj?.sets || {})) if (Array.isArray(v)) this.sets[k] = new Set(v);
  }
}
