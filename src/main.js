import * as THREE from 'three';
import { B, BLOCKS, PLACEABLE, SOLID } from './blocks.js';
import { createAtlas } from './textures.js';
import { World, CS, SEA, applyVoxelLighting, lightUniforms } from './world.js';
import { Player, EYE } from './player.js';
import { hashString } from './noise.js';
import { Sky } from './sky.js';
import { Sfx } from './audio.js';
import { Particles } from './particles.js';
import { I, ITEMS, itemIcon, itemName, miningInfo, dropFor, STATION_BLOCK } from './items.js';
import { Inventory } from './inventory.js';
import { Survival, MAX_HEALTH, MAX_AIR } from './survival.js';
import { CraftUI } from './craftui.js';
import { Mobs, TYPES } from './mobs.js';
import { TouchControls, isTouchDevice } from './touch.js';
import { Quests, QUESTS } from './quests.js';
import { Robot, EXAMPLES } from './robot.js';
import { RobotUI } from './robotui.js';
import { WorldStore } from './worlds.js';
import { TRADES, JOB_INFO } from './villages.js';

const SETTINGS_KEY = 'minicrafter:settings:v1';
const REACH = 6;
const ACTION_REPEAT = 0.22;
const DAY_LENGTH = 600; // seconds per full day

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

// ---------- renderer / scene ----------
THREE.ColorManagement.enabled = false; // treat all colours as authored (pixel-art look)
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
$('game').appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87ceeb, 50, 100);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 1000);
camera.rotation.order = 'YXZ';

const atlas = createAtlas();
const materials = {
  solid: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5 }),
  water: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  glow: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5 }),
};
applyVoxelLighting(materials.solid);
applyVoxelLighting(materials.water);

const sky = new Sky(scene);
const sfx = new Sfx();
const particles = new Particles(scene, atlas.avgColors);
const survival = new Survival(scene);
const mobs = new Mobs(scene, sfx);
const quests = new Quests();
const robot = new Robot({
  world: null, scene, sfx, particles,
  getPlayer: () => player,
  resolveBlock: () => { const id = heldItem(); return id != null && ITEMS.get(id)?.block !== undefined ? id : null; },
  breakBlock(x, y, z, id) {
    removeBlock(x, y, z);
    particles.burst(x, y, z, BLOCKS[id].side);
    sfx.dig(id);
    if (isSurvival()) { // Bit hands what it digs to you (it's strong: any tool tier)
      const drop = dropFor(id);
      if (drop != null && !inv.add(drop, 1)) renderHotbar();
    }
    quests.emit('robot', { kind: 'dig', id });
    dirtySave = true;
    return true;
  },
  placeBlock(x, y, z, id) {
    if (SOLID[id] && player.intersectsBlock(x, y, z)) return 'You are standing there!';
    if (isSurvival()) {
      if (inv.count(id) < 1) return `I need more ${itemName(id)}!`;
      inv.remove(id, 1); renderHotbar();
    }
    if (!world.setBlock(x, y, z, id)) return false;
    world.flushDirty();
    sfx.place(id);
    quests.emit('robot', { kind: 'place', id, x, y, z });
    dirtySave = true;
    return true;
  },
  onAction: (a) => {
    robotUI?.highlight(a.id);
    if (a.kind === 'move' && a.to) { quests.emit('robot', { kind: 'move', dir: a.dir }); quests.emit('robotClimb', robot.y - robotRun.startY); }
  },
  onDone: (result) => {
    if (result !== 'done') return;
    sfx.fanfare?.();
    quests.emit('robotDone', { program: robotRun.program, custom: robotRun.custom });
  },
});

// Block selection outline
const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
);
outline.visible = false;
scene.add(outline);

// ---------- settings ----------
const touchMode = isTouchDevice();
if (touchMode) document.body.classList.add('touch');
// Tablets get a lighter default view distance.
const settings = Object.assign({ renderDistance: touchMode ? 5 : 7, sensitivity: 1, fov: 75 }, store.get(SETTINGS_KEY) || {});
function applySettings() {
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  $('rd').value = settings.renderDistance; $('rd-val').textContent = settings.renderDistance;
  $('sens').value = settings.sensitivity; $('sens-val').textContent = settings.sensitivity.toFixed(1);
  $('fov').value = settings.fov; $('fov-val').textContent = settings.fov;
  store.set(SETTINGS_KEY, settings);
}
$('rd').addEventListener('input', (e) => { settings.renderDistance = +e.target.value; applySettings(); });
$('sens').addEventListener('input', (e) => { settings.sensitivity = +e.target.value; applySettings(); });
$('fov').addEventListener('input', (e) => { settings.fov = +e.target.value; applySettings(); });
applySettings();

// ---------- world state ----------
let world, player;
let seedText = '';
let timeOfDay = 0.08;
let mode = 'creative'; // 'creative' | 'survival'
const creativeBar = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.LAMP];
let inv = new Inventory();
let spawnPoint = null;
let selected = 0;
let dirtySave = false;
let shownTips = new Set();

const isSurvival = () => mode === 'survival';

/** Item id held in the selected hotbar slot (or null). */
function heldItem() {
  if (!isSurvival()) return creativeBar[selected];
  return inv.slots[selected]?.id ?? null;
}

function startWorld(seedStr, saved, newMode) {
  if (world) world.dispose();
  seedText = seedStr;
  world = new World(scene, hashString(seedStr), materials);
  world.onEdit = () => { dirtySave = true; };
  player = new Player(world);
  player.onLand = (dist) => { if (isSurvival()) survival.landed(dist); };
  inv = new Inventory();
  survival.reset();
  shownTips = new Set();
  mobs.reset(world);
  robot.world = world;
  robot.remove();
  quests.load(null);
  if (saved) {
    world.loadEdits(saved.edits);
    if (Array.isArray(saved.hotbar) && saved.hotbar.length === 9) saved.hotbar.forEach((id, i) => { if (ITEMS.has(id)) creativeBar[i] = id; });
    mobs.load(saved.mobs);
    robot.load(saved.robot);
    robotUI.setState(saved.robotCode || null);
    quests.load(saved.quests);
    selected = saved.selected | 0;
    timeOfDay = saved.time ?? timeOfDay;
    mode = saved.mode === 'survival' ? 'survival' : 'creative';
    inv = Inventory.fromJSON(saved.inv);
    if (Number.isFinite(saved.health) && saved.health > 0) survival.health = Math.min(MAX_HEALTH, saved.health);
    if (Array.isArray(saved.tips)) shownTips = new Set(saved.tips);
    spawnPoint = Array.isArray(saved.spawn) ? saved.spawn : null;
    const p = saved.player;
    if (p && Number.isFinite(p.x)) {
      player.pos.set(p.x, p.y, p.z);
      player.yaw = p.yaw || 0; player.pitch = p.pitch || 0; player.flying = !!p.flying && !isSurvival();
      if (player.collides()) player.spawnAt(p.x, p.z);
    } else spawn();
  } else {
    timeOfDay = 0.08;
    mode = newMode || mode;
    robotUI.setState(null);
    spawnPoint = null;
    spawn();
  }
  if (!spawnPoint) spawnPoint = findSpawnColumn();
  const meta = worlds.get(currentWorldId);
  $('world-name').textContent = meta?.name || 'My World';
  $('world-info').textContent = `Seed: ${seedStr} · ${mode === 'survival' ? 'Survival' : 'Creative'}`;
  refreshMode();
}

/** Finds a dry-land column near the origin for the world spawn. */
function findSpawnColumn() {
  const T = world.terrain;
  for (let r = 0; r < 400; r += 4) {
    for (let a = 0; a < 8; a++) {
      const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r);
      const { h } = T.column(x, z);
      if (h > SEA + 1 && h < SEA + 25) return [x + 0.5, z + 0.5];
    }
  }
  return [0.5, 0.5];
}

function spawn() {
  if (!spawnPoint) spawnPoint = findSpawnColumn();
  player.spawnAt(spawnPoint[0], spawnPoint[1]);
}

const worlds = new WorldStore();
let currentWorldId = null;

function save() {
  if (!world || !currentWorldId) return;
  const ok = worlds.save(currentWorldId, {
    seed: seedText,
    edits: world.serializeEdits(),
    player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, flying: player.flying },
    hotbar: creativeBar, selected, time: timeOfDay,
    mode, inv: inv.toJSON(), health: survival.health, spawn: spawnPoint, tips: [...shownTips], mobs: mobs.serialize(), quests: quests.toJSON(), robot: robot.toJSON(), robotCode: robotUI.getState(),
  }, { mode, stars: quests.stars });
  if (ok) dirtySave = false;
}
setInterval(() => { if (dirtySave || state === 'playing') save(); }, 5000);
window.addEventListener('pagehide', save);
window.addEventListener('beforeunload', save);

// ---------- UI: hotbar, HUD & creative picker ----------
const icon = (id) => itemIcon(atlas.canvas, id);

function renderHotbar() {
  const el = $('hotbar');
  el.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('div');
    s.className = 'slot' + (i === selected ? ' active' : '');
    let inner = `<span class="num">${i + 1}</span>`;
    if (isSurvival()) {
      const st = inv.slots[i];
      if (st) inner += `<img alt="${itemName(st.id)}" src="${icon(st.id)}">${st.count > 1 ? `<span class="count">${st.count}</span>` : ''}`;
    } else {
      inner += `<img alt="${itemName(creativeBar[i])}" src="${icon(creativeBar[i])}">`;
    }
    s.innerHTML = inner;
    s.addEventListener('click', () => { if (state === 'playing') select(i); });
    el.appendChild(s);
  }
}

function renderStatus() {
  $('status').classList.toggle('hidden', !isSurvival());
  if (!isSurvival()) return;
  let h = '';
  for (let i = 0; i < MAX_HEALTH / 2; i++) {
    const v = survival.health - i * 2;
    h += `<span class="heart ${v >= 2 ? '' : v === 1 ? 'half' : 'empty'}">♥</span>`;
  }
  $('hearts').innerHTML = h;
  const showAir = player?.headInWater || survival.air < MAX_AIR;
  $('bubbles').innerHTML = showAir ? '<span class="bubble">●</span>'.repeat(Math.ceil(survival.air)) : '';
}
survival.onChange = renderStatus;

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1200);
}

let hintTimer;
function hint(text, ms = 5000) {
  const h = $('hint');
  h.textContent = text;
  h.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.remove('show'), ms);
}
/** Show a one-time tip (remembered per world). */
function tip(key, text) {
  if (shownTips.has(key)) return;
  shownTips.add(key);
  hint(text, 6500);
  dirtySave = true;
}

// ---------- quests UI ----------
quests.ctx = {
  towerHeight(d) {
    let h = 1;
    while (h < 64 && world.placedBlock(d.x, d.y - h, d.z)) h++;
    return h;
  },
  squareFill(d) {
    let best = 0;
    for (let ox = -2; ox <= 0; ox++) for (let oz = -2; oz <= 0; oz++) {
      let n = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (SOLID[world.placedBlock(d.x + ox + i, d.y, d.z + oz + j)]) n++;
      best = Math.max(best, n);
    }
    return best;
  },
};

const starStr = (n) => '⭐'.repeat(n);

function renderQuests() {
  $('qt-stars').textContent = `⭐ ${quests.stars}`;
  $('menu-stars').textContent = `(${quests.stars} / ${quests.maxStars})`;
  const list = $('qt-list');
  const act = quests.active();
  list.innerHTML = act.length ? '' : '<div class="q-card">All quests done! You are a MiniCrafter star! 🏆</div>';
  for (const q of act) {
    const p = quests.progress(q);
    const card = document.createElement('div');
    card.className = 'q-card';
    card.innerHTML = `<div class="q-title"><span>${q.icon}</span><span>${q.title}</span></div>
      <div class="q-text">${q.text}</div>
      <div class="q-bar"><i style="width:${Math.round(p / q.count * 100)}%"></i></div>
      <span class="q-count">${p} / ${q.count}</span><div style="clear:both"></div>`;
    list.appendChild(card);
  }
}

function renderQuestBook() {
  const box = $('qb-list');
  box.innerHTML = '';
  const active = new Set(quests.active().map((q) => q.id));
  $('qb-summary').textContent = `You have ${quests.stars} of ${quests.maxStars} stars in ${isSurvival() ? 'Survival' : 'Creative'} mode.`;
  for (const q of QUESTS) {
    const done = quests.done.has(q.id), applies = quests.applies(q);
    const el = document.createElement('div');
    el.className = 'qb-item' + (done ? ' done' : active.has(q.id) ? ' active' : '') + (applies ? '' : ' off');
    const tag = !applies ? '<span class="tag">Survival only</span>' : active.has(q.id) ? `<span class="tag">Now: ${quests.progress(q)} / ${q.count}</span>` : q.track === 'coding' ? '<span class="tag">🤖 Coding</span>' : '';
    el.innerHTML = `<div class="qb-icon">${done ? '✅' : q.icon}</div>
      <div><div class="qb-title">${q.title}${tag}</div><div class="qb-text">${q.text}${done && q.reveal ? ` <b>${q.reveal}</b>` : ''}</div></div>
      <div class="qb-stars">${done ? starStr(q.stars) : '☆'.repeat(q.stars)}</div>`;
    box.appendChild(el);
  }
}

let celebrateTimer;
quests.onComplete = (q) => {
  const c = $('celebrate');
  c.querySelector('.c-name').textContent = `${q.icon} ${q.title}`;
  c.querySelector('.c-stars').textContent = starStr(q.stars);
  c.querySelector('.c-reveal').textContent = q.reveal || '';
  c.classList.add('show');
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => c.classList.remove('show'), 3200);
  sfx.fanfare?.();
  if (q.reward && isSurvival()) {
    inv.add(q.reward[0], q.reward[1]);
    renderHotbar();
    setTimeout(() => toast(`Reward: ${q.reward[1]} × ${itemName(q.reward[0])}`), 1200);
  }
  dirtySave = true;
};
quests.onProgress = renderQuests;

function select(i) {
  selected = (i + 9) % 9;
  renderHotbar();
  const id = heldItem();
  if (id != null) toast(itemName(id));
}

function buildCreativePicker() {
  const grid = $('inv-grid');
  grid.innerHTML = '';
  for (const id of [...PLACEABLE, ...[...ITEMS.keys()].filter((k) => k >= 256)]) {
    const b = document.createElement('button');
    b.className = 'inv-item';
    b.innerHTML = `<img alt="" src="${icon(id)}"><span>${itemName(id)}</span>`;
    b.addEventListener('click', () => {
      creativeBar[selected] = id;
      renderHotbar();
      dirtySave = true;
      closeOverlay(true);
    });
    grid.appendChild(b);
  }
}

function refreshMode() {
  $('mode-creative').classList.toggle('on', !isSurvival());
  $('mode-survival').classList.toggle('on', isSurvival());
  $('mode-desc').textContent = isSurvival()
    ? 'Survival: collect blocks, craft tools and look after your hearts. Gentle: no monsters, no hunger.'
    : 'Creative: unlimited blocks, instant breaking and flying.';
  if (isSurvival()) player.flying = false;
  quests.mode = mode;
  renderQuests();
  updateModeBadge();
  renderHotbar();
  renderStatus();
}

function setMode(m) {
  if (m === mode) return;
  mode = m;
  survival.stopMining();
  if (isSurvival()) survival.health = Math.max(survival.health, 1);
  refreshMode();
  dirtySave = true;
  save();
}
$('mode-creative').addEventListener('click', () => setMode('creative'));
$('mode-survival').addEventListener('click', () => setMode('survival'));

// Survival crafting screen
/** Crafting stations within 4 blocks of the player. */
function stationsNear() {
  const found = new Set();
  const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
  for (let y = py - 4; y <= py + 5; y++) for (let z = pz - 4; z <= pz + 4; z++) for (let x = px - 4; x <= px + 4; x++) {
    const b = world.getBlock(x, y, z);
    if (b === STATION_BLOCK.table) found.add('table');
    if (b === STATION_BLOCK.furnace) found.add('furnace');
  }
  return found;
}
const craftUI = new CraftUI({
  getInv: () => inv,
  atlasCanvas: atlas.canvas,
  stations: stationsNear,
  onCraft: (r) => {
    sfx.craft();
    quests.emit('craft', { id: r.out, count: r.count });
    if (r.out === B.CRAFTING_TABLE) tip('placeTable', 'Put the Crafting Table in your hotbar and right-click to place it. Craft tools next to it!');
  },
  onChange: () => { renderHotbar(); dirtySave = true; },
});

mobs.onTame = (pet) => {
  toast(`${pet.petName} is your new pet! 🐾`);
  sfx.craft();
  quests.emit('tame', { type: pet.type });
  tip('pet', `${pet.petName} will follow you. Right-click (or tap) to make it sit or follow.`);
  dirtySave = true;
};

mobs.onBaby = (baby) => {
  quests.emit('baby', { type: baby.type });
  if (baby.pos.distanceTo(player.pos) < 24) { toast(`A baby ${TYPES[baby.type].name.toLowerCase()} was born!`); sfx.craft(); }
  dirtySave = true;
};

// ---------- game state & pointer lock ----------
let state = 'menu'; // 'menu' | 'locking' | 'playing' | 'inventory' | 'craft' | 'dead'
const keys = new Set();
const mouse = { left: false, right: false, nextAction: 0 };

function lock() {
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => {
      // unadjustedMovement isn't supported everywhere; retry plain.
      const p2 = canvas.requestPointerLock();
      if (p2 && p2.catch) p2.catch(() => { $('lock-note').textContent = 'Could not capture the mouse — wait a second and click Play again.'; });
    });
  } catch { canvas.requestPointerLock(); }
}

function clearInput() {
  keys.clear(); mouse.left = mouse.right = false;
  survival.stopMining();
}

function showMenu() {
  state = 'menu';
  touch?.setEnabled(false);
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('inventory').classList.add('hidden');
  clearInput();
  save();
}

function openOverlay() {
  clearInput();
  touch?.setEnabled(false);
  if (isSurvival()) {
    state = 'craft';
    craftUI.open();
  } else {
    state = 'inventory';
    $('inv-slot').textContent = selected + 1;
    $('inventory').classList.remove('hidden');
  }
  document.exitPointerLock();
}

let bookFromMenu = false;
function openQuestBook(fromMenu) {
  bookFromMenu = fromMenu;
  clearInput();
  touch?.setEnabled(false);
  state = 'questbook';
  renderQuestBook();
  $('questbook').classList.remove('hidden');
  if (!fromMenu) document.exitPointerLock();
}

/** What Bit is currently running (for the coding quests). */
const robotRun = { program: [], custom: false, startY: 0 };
const stripIds = (p) => JSON.stringify(p, (k, v) => (k === 'id' ? undefined : (k === 'else' && Array.isArray(v) && !v.length ? undefined : v)));
const EXAMPLE_KEYS = new Set(EXAMPLES.map((e) => stripIds(e.program)));

const robotUI = new RobotUI({
  getRobot: () => robot,
  onRun: (name, program) => {
    robotRun.program = program;
    robotRun.custom = !EXAMPLE_KEYS.has(stripIds(program));
    robotRun.startY = robot.y;
    dirtySave = true;
  },
  onChange: () => { dirtySave = true; },
  onClose: () => closeOverlay(true),
  onPutAway: () => {
    robot.remove();
    if (isSurvival()) { inv.add(I.ROBOT, 1); renderHotbar(); }
    toast('Bit is back in your inventory');
    dirtySave = true;
    closeOverlay(true);
  },
});

// ---------- villager trading ----------
let tradeWith = null;
function openTrade(mob) {
  clearInput();
  touch?.setEnabled(false);
  state = 'trade';
  tradeWith = mob;
  mobs.voice(mob);
  quests.emit('meetVillager', { job: mob.job });
  renderTrade();
  $('trade').classList.remove('hidden');
  document.exitPointerLock();
}

function renderTrade() {
  const mob = tradeWith;
  const info = JOB_INFO[mob.job];
  $('tr-title').textContent = `🤝 ${mob.villagerName} the ${info.title}`;
  $('tr-note').textContent = isSurvival()
    ? 'Swap your things for theirs. Count carefully!'
    : 'Trading uses your survival inventory. Switch to Survival mode to trade.';
  const box = $('tr-list');
  box.innerHTML = '';
  for (const t of TRADES[mob.job]) {
    const [gid, gn] = t.give, [rid, rn] = t.get;
    const have = isSurvival() ? inv.count(gid) : 0;
    const ok = isSurvival() && have >= gn && inv.canFit(rid, rn);
    const row = document.createElement('div');
    row.className = 'trade' + (ok ? ' ok' : '');
    row.innerHTML = `<div class="side"><img alt="" src="${icon(gid)}"><div>${gn} × ${itemName(gid)}<div class="have ${have < gn ? 'short' : ''}">You have ${have}</div></div></div>
      <span class="arrow">➜</span>
      <div class="side"><img alt="" src="${icon(rid)}"><div>${rn} × ${itemName(rid)}</div></div>
      <button class="go" ${ok ? '' : 'disabled'}>Trade</button>`;
    row.querySelector('button').addEventListener('click', () => {
      if (!(isSurvival() && inv.count(gid) >= gn && inv.canFit(rid, rn))) return;
      inv.remove(gid, gn);
      inv.add(rid, rn);
      sfx.craft();
      mobs.effect(mob, mobs.happyMat);
      renderHotbar();
      quests.emit('trade', { job: mob.job });
      dirtySave = true;
      renderTrade();
    });
    box.appendChild(row);
  }
}
$('tr-done').addEventListener('click', () => closeOverlay(true));

function openRobotPanel() {
  clearInput();
  touch?.setEnabled(false);
  state = 'robot';
  robotUI.open();
  document.exitPointerLock();
  tip('robot', 'Pick a starter program and watch Bit work. Hold a block so Bit can build with it!');
}

function closeOverlay(relock) {
  $('inventory').classList.add('hidden');
  if (state === 'robot') robotUI.close();
  if (state === 'trade') { $('trade').classList.add('hidden'); tradeWith = null; }
  if (state === 'questbook') {
    $('questbook').classList.add('hidden');
    if (bookFromMenu) { state = 'menu'; return; }
  }
  if (state === 'craft') craftUI.close();
  if (relock) enterPlay(); else showMenu();
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    startPlaying();
  } else if (state === 'playing' || state === 'locking') {
    showMenu();
  }
});
document.addEventListener('pointerlockerror', () => {
  if (state !== 'locking') return;
  showMenu();
  $('lock-note').textContent = 'Could not capture the mouse — wait a second and click Play again.';
});

/** Switch to the in-game view (after pointer lock on desktop, immediately on touch). */
function startPlaying() {
  state = 'playing';
  hasPlayed = true;
  $('menu').classList.add('hidden');
  $('inventory').classList.add('hidden');
  $('craft').classList.add('hidden');
  $('death').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('lock-note').textContent = '';
  sfx.resume();
  touch?.setEnabled(true);
  if (isSurvival()) tip('start', touchMode
    ? 'Press and hold on a tree trunk to collect wood. Tap 🎒 to craft!'
    : 'Hold left click on a tree trunk to collect wood. Press E to craft!');
}

function enterPlay() {
  if (touchMode) startPlaying();
  else { state = 'locking'; lock(); }
}

$('btn-play').addEventListener('click', enterPlay);
$('inv-done').addEventListener('click', () => closeOverlay(true));
$('craft-done').addEventListener('click', () => closeOverlay(true));
$('qb-done').addEventListener('click', () => closeOverlay(true));
$('btn-quests').addEventListener('click', () => openQuestBook(true));
$('qt-head').addEventListener('click', () => { if (state === 'playing') openQuestBook(false); });
// ---------- worlds screen ----------
/** Switches to a saved world (saving the current one first). */
function openWorld(id) {
  const meta = worlds.get(id);
  if (!meta) return;
  if (currentWorldId && currentWorldId !== id) save();
  currentWorldId = id;
  worlds.setCurrent(id);
  const data = worlds.load(id);
  if (data && data.seed != null) startWorld(String(data.seed), data);
  else startWorld(meta.seed, null, meta.mode);
  save();
  loadingShown = true;
}

function createWorld(name, seed, newMode) {
  const w = worlds.add({ name, seed: seed || String(Math.floor(Math.random() * 1e9)), mode: newMode });
  openWorld(w.id);
  return w;
}

let newWorldMode = 'creative';
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} days ago`;
};

function renderWorlds() {
  save();
  const box = $('world-list');
  box.innerHTML = '';
  for (const w of worlds.sorted()) {
    const el = document.createElement('div');
    el.className = 'w-item' + (w.id === currentWorldId ? ' current' : '');
    el.innerHTML = `<div><div class="w-name"></div><div class="w-meta">${w.mode === 'survival' ? '❤️ Survival' : '🎨 Creative'} · ⭐ ${w.stars || 0} · seed ${String(w.seed).slice(0, 14)} · ${ago(w.played)}</div></div>
      <div class="w-actions">
        ${w.id === currentWorldId ? '<button disabled>Playing</button>' : '<button data-a="play" class="go">▶ Play</button>'}
        <button data-a="rename" title="Rename">✏️</button>
        <button data-a="export" title="Download a copy">⬇</button>
        <button data-a="delete" title="Delete">🗑</button>
      </div>`;
    el.querySelector('.w-name').textContent = w.name; // user text: never as HTML
    el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => worldAction(b.dataset.a, w)));
    box.appendChild(el);
  }
  $('nw-name').placeholder = worlds.suggestName();
  $('nw-creative').classList.toggle('on', newWorldMode === 'creative');
  $('nw-survival').classList.toggle('on', newWorldMode === 'survival');
}

function worldAction(action, w) {
  if (action === 'play') { openWorld(w.id); closeWorlds(); }
  else if (action === 'rename') {
    const name = prompt('New name for this world:', w.name);
    if (name) { worlds.rename(w.id, name); if (w.id === currentWorldId) $('world-name').textContent = worlds.get(w.id).name; renderWorlds(); }
  } else if (action === 'export') {
    save();
    const url = URL.createObjectURL(worlds.exportBlob(w.id));
    const a = document.createElement('a');
    a.href = url; a.download = `${w.name.replace(/[^\w -]+/g, '').trim() || 'world'}.minicrafter.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (action === 'delete') {
    if (!confirm(`Delete "${w.name}" forever? This cannot be undone.`)) return;
    const wasCurrent = w.id === currentWorldId;
    worlds.remove(w.id);
    if (wasCurrent) {
      currentWorldId = null;
      const next = worlds.sorted()[0];
      if (next) openWorld(next.id); else createWorld('', '', 'creative');
    }
    renderWorlds();
  }
}

function openWorlds() { renderWorlds(); $('worlds').classList.remove('hidden'); }
function closeWorlds() { $('worlds').classList.add('hidden'); }

$('btn-worlds').addEventListener('click', openWorlds);
$('w-done').addEventListener('click', closeWorlds);
$('nw-creative').addEventListener('click', () => { newWorldMode = 'creative'; renderWorlds(); });
$('nw-survival').addEventListener('click', () => { newWorldMode = 'survival'; renderWorlds(); });
$('nw-create').addEventListener('click', () => {
  createWorld($('nw-name').value || $('nw-name').placeholder, $('nw-seed').value.trim(), newWorldMode);
  $('nw-name').value = ''; $('nw-seed').value = '';
  closeWorlds();
  toast('New world created!');
});
$('w-import').addEventListener('click', () => $('w-import-file').click());
$('w-import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const w = worlds.importText(await file.text());
    renderWorlds();
    toast(`Imported "${w.name}"`);
  } catch { alert('That file is not a MiniCrafter world.'); }
});

// ---------- damage & death ----------
survival.onDamage = () => {
  sfx.hurt();
  const f = $('damage-flash');
  f.classList.add('on');
  setTimeout(() => f.classList.remove('on'), 120);
};
survival.onDeath = (reason) => {
  state = 'dead';
  clearInput();
  $('death-msg').textContent = reason === 'drown' ? 'You ran out of air.' : reason === 'fall' ? 'That was a big fall!' : 'You fainted.';
  $('death').classList.remove('hidden');
  $('hud').classList.add('hidden');
  touch?.setEnabled(false);
  document.exitPointerLock();
};
$('btn-respawn').addEventListener('click', () => {
  survival.reset();
  spawn();
  $('death').classList.add('hidden');
  enterPlay();
});

// ---------- input ----------
document.addEventListener('keydown', (e) => {
  if (state === 'questbook') {
    if (e.code === 'KeyQ' || e.code === 'Escape') closeOverlay(e.code === 'KeyQ');
    return;
  }
  if (state === 'robot' || state === 'trade') {
    if (e.code === 'Escape') closeOverlay(false);
    return;
  }
  if (state === 'inventory' || state === 'craft') {
    if (e.code === 'KeyE') closeOverlay(true);
    else if (e.code === 'Escape') closeOverlay(false);
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'F3') { e.preventDefault(); $('debug').classList.toggle('hidden'); return; }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) select(n - 1); }
  if (e.code === 'KeyF') toggleFly();
  if (e.code === 'KeyE') openOverlay();
  if (e.code === 'KeyQ') openQuestBook(false);
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', clearInput);

document.addEventListener('mousemove', (e) => {
  if (state !== 'playing') return;
  const k = 0.0022 * settings.sensitivity;
  player.yaw -= e.movementX * k;
  player.pitch -= e.movementY * k;
  player.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, player.pitch));
});
document.addEventListener('mousedown', (e) => {
  if (state !== 'playing') return;
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.right = true;
  if (e.button === 1) { e.preventDefault(); pickBlock(); }
  mouse.nextAction = 0;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) { mouse.left = false; survival.stopMining(); }
  if (e.button === 2) mouse.right = false;
});
document.addEventListener('wheel', (e) => {
  if (state !== 'playing') return;
  select(selected + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());

function toggleFly() {
  if (isSurvival()) { toast('Flying is only in Creative mode'); return; }
  player.flying = !player.flying; player.vel.y = 0;
  updateModeBadge();
  toast(player.flying ? 'Flying on' : 'Flying off');
}

function updateModeBadge() {
  $('mode-badge').classList.toggle('hidden', !player?.flying);
  $('touch').classList.toggle('flying', !!player?.flying);
  $('touch').classList.toggle('survival', isSurvival());
}

// ---------- touch controls ----------
const touchKeys = { jump: false, down: false };
let tapRelease = 0;
const touch = touchMode ? new TouchControls({
  look(dx, dy) {
    if (state !== 'playing') return;
    const k = 0.0055 * settings.sensitivity;
    player.yaw -= dx * k;
    player.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, player.pitch - dy * k));
  },
  tap() { if (state === 'playing') { mouse.right = true; mouse.nextAction = 0; tapRelease = 2; } },
  holdStart() { if (state === 'playing') { mouse.left = true; mouse.nextAction = 0; } },
  holdEnd() { mouse.left = false; survival.stopMining(); },
  button(name, down) {
    if (name === 'jump') touchKeys.jump = down;
    else if (name === 'down') touchKeys.down = down;
    else if (!down) return;
    else if (name === 'fly' && state === 'playing') toggleFly();
    else if (name === 'inventory' && state === 'playing') openOverlay();
    else if (name === 'pause' && state === 'playing') showMenu();
  },
}) : null;

// ---------- interaction ----------
let target = null;
let mobTarget = null;
let robotTarget = false;
const lookDir = new THREE.Vector3();

function pickBlock() {
  if (!target) return;
  const id = target.id;
  if (isSurvival()) {
    const at = inv.slots.findIndex((s, i) => i < 9 && s && s.id === id);
    if (at >= 0) select(at);
    return;
  }
  if (!BLOCKS[id].placeable) return;
  const at = creativeBar.indexOf(id);
  if (at >= 0) select(at);
  else { creativeBar[selected] = id; renderHotbar(); toast(BLOCKS[id].name); }
}

function removeBlock(x, y, z) {
  // Breaking a block next to water lets water flow in (simple, one step).
  const waterNear = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]
    .some(([dx, dy, dz]) => world.getBlock(x + dx, y + dy, z + dz) === B.WATER);
  world.setBlock(x, y, z, waterNear && y <= SEA ? B.WATER : B.AIR);
  world.flushDirty();
}

function placeBlock(id) {
  const px = target.x + target.normal[0], py = target.y + target.normal[1], pz = target.z + target.normal[2];
  const there = world.getBlock(px, py, pz);
  if (there !== B.AIR && there !== B.WATER) return false;
  if (SOLID[id] && player.intersectsBlock(px, py, pz)) return false;
  if (!world.setBlock(px, py, pz, id)) return false;
  world.flushDirty();
  sfx.place(id);
  quests.emit('place', { id, x: px, y: py, z: pz });
  return true;
}

let lastHitSound = 0;
function act(now, dt) {
  if (robotTarget) return actRobot(now);
  if (mobTarget) return actMob(now);
  if (isSurvival()) return actSurvival(now, dt);
  if (!target || now < mouse.nextAction) return;
  if (mouse.left) {
    const { x, y, z, id } = target;
    if (id === B.BEDROCK) return;
    removeBlock(x, y, z);
    particles.burst(x, y, z, BLOCKS[id].side);
    sfx.dig(id);
    quests.emit('mine', { id });
    mouse.nextAction = now + ACTION_REPEAT;
  } else if (mouse.right) {
    const held = creativeBar[selected];
    const def = ITEMS.get(held);
    if (held === I.ROBOT) placeRobot();
    else if (def?.spawns) spawnFromEgg(def.spawns);
    else if (def?.block !== undefined) placeBlock(held);
    mouse.nextAction = now + ACTION_REPEAT;
  }
}

function rayBox(o, d, max, x0, y0, z0, x1, y1, z1) {
  let t0 = 0, t1 = max;
  for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
    if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) return null; continue; }
    let ta = (a - oo) / dd, tb = (b - oo) / dd;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

function actRobot(now) {
  survival.stopMining();
  if (now < mouse.nextAction || !(mouse.left || mouse.right)) return;
  mouse.nextAction = now + 0.4;
  if (mouse.right) { mouse.right = false; openRobotPanel(); }
  else { robot.say(robot.running ? 'Busy working!' : 'Hi! Right-click me to give me a program.', 2); }
}

/** Places Bit on the targeted face, facing the same way as the player. */
function placeRobot() {
  const x = target.x + target.normal[0], y = target.y + target.normal[1], z = target.z + target.normal[2];
  if (SOLID[world.getBlock(x, y, z)]) return false;
  const fwd = [-Math.sin(player.yaw), -Math.cos(player.yaw)];
  const facing = Math.abs(fwd[0]) > Math.abs(fwd[1]) ? (fwd[0] > 0 ? 1 : 3) : (fwd[1] > 0 ? 2 : 0);
  const wasPlaced = robot.placed;
  robot.placeAt(x, y, z, facing);
  robot.say('Hi! I am Bit!', 2);
  quests.emit('robotPlaced', {});
  sfx.craft();
  dirtySave = true;
  return !wasPlaced;
}

function spawnFromEgg(type) {
  const x = target.x + target.normal[0], y = target.y + target.normal[1], z = target.z + target.normal[2];
  if (SOLID[world.getBlock(x, y, z)]) return;
  const mob = mobs.spawn(type, x + 0.5, y, z + 0.5, { kept: true, tamed: TYPES[type].pet });
  if (mob?.tamed) { toast(`Say hi to ${mob.petName}!`); quests.emit('tame', { type }); }
  if (mob) { mobs.voice(mob); dirtySave = true; }
}

/** Interacting with an animal: left = pat, right = feed apple / shear sheep / say hello. */
function actMob(now) {
  survival.stopMining();
  if (now < mouse.nextAction || !(mouse.left || mouse.right)) return;
  const mob = mobTarget;
  const held = heldItem();
  mouse.nextAction = now + 0.45;
  if (mob.type === 'villager') {
    if (mouse.right) { mouse.right = false; openTrade(mob); }
    else { mobs.pat(mob, player); }
    return;
  }
  if (mouse.left) {
    if (mob.tamed) { mob.wag = 2; mobs.effect(mob, mobs.happyMat); mobs.voice(mob); }
    else mobs.pat(mob, player);
    quests.emit('pat', { type: mob.type });
    tip('animals', `${TYPES[mob.type].plural} love apples! Feed two of them and see what happens.`);
    return;
  }
  if (mob.tamed && held !== I.APPLE) {
    const sits = mobs.toggleSit(mob);
    toast(sits ? `${mob.petName} is sitting` : `${mob.petName} is following you`);
    dirtySave = true;
    return;
  }
  if (held === I.APPLE) {
    if (mobs.feed(mob)) {
      if (isSurvival()) { inv.takeFromSlot(selected, 1); renderHotbar(); }
      dirtySave = true;
    } else toast(`This ${TYPES[mob.type].name.toLowerCase()} is not hungry right now`);
    return;
  }
  if (mob.type === 'sheep') {
    const wool = mobs.shear(mob);
    if (wool != null) {
      const n = 1 + Math.floor(Math.random() * 3);
      if (isSurvival()) { inv.add(wool, n); renderHotbar(); }
      sfx.pop(); toast(`+${n} ${itemName(wool)}`);
      quests.emit('shear', { wool });
      particles.burst(Math.floor(mob.pos.x), Math.floor(mob.pos.y), Math.floor(mob.pos.z), BLOCKS[wool].side);
      dirtySave = true;
      return;
    }
    if (mob.sheared) { toast('The wool will grow back soon'); return; }
  }
  mobs.voice(mob);
}

function actSurvival(now, dt) {
  const held = heldItem();
  // Eating works without a target.
  if (mouse.right && now >= mouse.nextAction && held != null && ITEMS.get(held)?.food) {
    if (survival.heal(ITEMS.get(held).food)) {
      inv.takeFromSlot(selected, 1);
      sfx.eat(); renderHotbar(); dirtySave = true;
      quests.emit('eat', {});
    } else toast('Your hearts are already full');
    mouse.nextAction = now + 0.5;
    return;
  }
  if (!target) { survival.stopMining(); return; }

  if (mouse.left) {
    const { x, y, z, id } = target;
    const info = miningInfo(id, held);
    if (!Number.isFinite(info.time)) { survival.stopMining(); return; }
    if (now - lastHitSound > 0.25) { sfx.hit(id); lastHitSound = now; }
    if (survival.mine(target, info.time, dt)) {
      removeBlock(x, y, z);
      particles.burst(x, y, z, BLOCKS[id].side);
      sfx.dig(id);
      quests.emit('mine', { id });
      if (info.canHarvest) {
        const drop = dropFor(id);
        if (drop != null) {
          const left = inv.add(drop, 1);
          if (left) toast('Your inventory is full!');
          else { sfx.pop(); toast(`+1 ${itemName(drop)}`); quests.emit('collect', { id: drop }); }
          renderHotbar();
          if (drop === B.LOG) tip('wood', 'Great! Press E and turn your logs into planks.');
          if (drop === I.COAL) tip('coal', 'Coal! Use it to make lamps and bricks.');
        }
      } else if (info.hint) hint(info.hint, 3000);
      dirtySave = true;
    }
  } else if (mouse.right && now >= mouse.nextAction) {
    survival.stopMining();
    if (held === I.ROBOT) {
      if (placeRobot()) { inv.takeFromSlot(selected, 1); renderHotbar(); }
    } else if (held != null && ITEMS.get(held)?.block !== undefined) {
      if (placeBlock(held)) { inv.takeFromSlot(selected, 1); renderHotbar(); dirtySave = true; }
    }
    mouse.nextAction = now + ACTION_REPEAT;
  } else survival.stopMining();
}

// ---------- debug ----------
let fps = 0, frames = 0, fpsTime = 0;
const DIRS = ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'];
function updateDebug(pending) {
  if ($('debug').classList.contains('hidden')) return;
  const p = player.pos;
  const yawDeg = ((player.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const facing = DIRS[Math.round(yawDeg / 45) % 8];
  const col = world.terrain.column(Math.floor(p.x), Math.floor(p.z));
  $('debug').textContent = [
    `MiniCrafter  ${fps} fps   ${mode}`,
    `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
    `Chunk: ${Math.floor(p.x / CS)}, ${Math.floor(p.z / CS)}   loaded: ${world.chunks.size}  queued: ${pending}`,
    `Facing: ${facing}   Biome: ${col.desert ? 'desert' : col.h > SEA + 26 ? 'mountains' : world.terrain.forest(p.x, p.z) > 0.12 ? 'forest' : 'plains'}`,
    `Time: ${(((timeOfDay * 24) + 6) % 24).toFixed(1)}h   Seed: ${seedText}`,
    `Target: ${mobTarget ? TYPES[mobTarget.type].name : target ? `${BLOCKS[target.id].name} @ ${target.x}, ${target.y}, ${target.z}` : '-'}   Animals: ${mobs.list.length}`,
    `Draw calls: ${renderer.info.render.calls}  Tris: ${renderer.info.render.triangles}`,
  ].join('\n');
}

// ---------- main loop ----------
let last = performance.now();
let loadingShown = true;
let hasPlayed = false;
let wasHeadInWater = false;
let simTime = 0; // game-clock seconds (drives action repeat timing)
const moveAcc = { walk: 0, swim: 0, timer: 0, slow: 0 };

/** Feeds movement-based quests (walk, swim, jump, height, night) without spamming the UI. */
function trackMovement(dt, input, wasOnGround, dist) {
  if (player.inWater) moveAcc.swim += dist;
  else if (!player.flying) moveAcc.walk += dist;
  if (input.jump && wasOnGround && !player.onGround && player.vel.y > 0 && !player.inWater && !player.flying) quests.emit('jump', {});
  moveAcc.timer += dt;
  if (moveAcc.timer >= 0.5) {
    moveAcc.timer = 0;
    if (moveAcc.walk > 0) { quests.emit('walk', moveAcc.walk); moveAcc.walk = 0; }
    if (moveAcc.swim > 0) { quests.emit('swim', moveAcc.swim); moveAcc.swim = 0; }
    if (++moveAcc.slow >= 2) {
      moveAcc.slow = 0;
      quests.emit('height', player.pos.y);
      if (timeOfDay > 0.56 && timeOfDay < 0.94) quests.emit('night', {});
    }
  }
}

function frame(now, manual = false) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  simTime += dt;

  if (state === 'playing') {
    const input = {
      forward: Math.max(+(keys.has('KeyW') || keys.has('ArrowUp')), Math.max(0, touch?.move.y || 0)),
      back: Math.max(+(keys.has('KeyS') || keys.has('ArrowDown')), Math.max(0, -(touch?.move.y || 0))),
      left: Math.max(+(keys.has('KeyA') || keys.has('ArrowLeft')), Math.max(0, -(touch?.move.x || 0))),
      right: Math.max(+(keys.has('KeyD') || keys.has('ArrowRight')), Math.max(0, touch?.move.x || 0)),
      jump: +(keys.has('Space') || touchKeys.jump),
      down: +(keys.has('ShiftLeft') || keys.has('ShiftRight') || touchKeys.down),
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    };
    if (player.flying) input.sprint = false; // Shift descends while flying
    const wasFlying = player.flying;
    const wasOnGround = player.onGround, px0 = player.pos.x, pz0 = player.pos.z;
    player.update(dt, input);
    trackMovement(dt, input, wasOnGround, Math.hypot(player.pos.x - px0, player.pos.z - pz0));
    if (wasFlying !== player.flying) updateModeBadge();
    if (player.pos.y < -20) { spawn(); toast('You fell out of the world'); }
    if (isSurvival()) {
      survival.update(dt, player);
      if (player.headInWater !== wasHeadInWater) { wasHeadInWater = player.headInWater; renderStatus(); }
    }
    timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
  } else {
    // Slowly orbit the camera on the title screen for a living background.
    if (state === 'menu' && !hasPlayed) player.yaw += dt * 0.05;
  }

  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);

  const pending = world.update(player.pos.x, player.pos.z, settings.renderDistance, state === 'playing' ? 5 : 14);
  if (loadingShown && pending < 6) {
    loadingShown = false;
    $('loading').classList.add('hidden');
    $('btn-play').disabled = false;
  } else if (loadingShown) {
    $('loading').classList.remove('hidden');
    $('btn-play').disabled = true;
  }

  // Target block
  camera.getWorldDirection(lookDir);
  const reach = isSurvival() ? 5 : REACH;
  target = state === 'playing' ? world.raycast(camera.position, lookDir, reach) : null;
  mobTarget = null;
  if (state === 'playing') {
    const hit = mobs.raycast(camera.position, lookDir, reach);
    if (hit && (!target || hit.dist < target.dist)) { mobTarget = hit.mob; target = null; }
    const rd = robot.placed ? rayBox(camera.position, lookDir, reach, robot.x + 0.15, robot.y, robot.z + 0.15, robot.x + 0.85, robot.y + 1.1, robot.z + 0.85) : null;
    robotTarget = rd !== null && (!target || rd < target.dist) && (!hit || rd < hit.dist);
    if (robotTarget) { target = null; mobTarget = null; }
  }
  if (target) { outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5); outline.visible = true; }
  else outline.visible = false;
  if (state === 'playing') act(simTime, dt);
  if (tapRelease > 0 && --tapRelease === 0) mouse.right = false;

  // Sky, fog, light level
  const viewDist = settings.renderDistance * CS;
  const light = sky.update(timeOfDay, camera, dt);
  lightUniforms.uDaylight.value = light;
  if (player.headInWater) {
    scene.fog.color.setRGB(0.1 * light + 0.02, 0.25 * light + 0.04, 0.55 * light + 0.06);
    scene.fog.near = 1; scene.fog.far = 18;
  } else {
    scene.fog.color.copy(sky.color);
    scene.fog.near = viewDist * 0.55; scene.fog.far = viewDist * 0.95;
  }
  scene.background = scene.fog.color;
  $('water-overlay').classList.toggle('hidden', !(player.headInWater && state === 'playing'));

  mobs.update(dt, player, light, state === 'playing' || (state === 'menu' && !hasPlayed));
  robot.update(dt, light);
  particles.update(dt, light);
  renderer.render(scene, camera);

  frames++;
  if (now - fpsTime > 500) { fps = Math.round(frames * 1000 / (now - fpsTime)); frames = 0; fpsTime = now; updateDebug(pending); }
  if (!manual) requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- boot ----------
buildCreativePicker();
// Open the last world played (old single saves were migrated by WorldStore).
const lastId = worlds.currentId && worlds.get(worlds.currentId) ? worlds.currentId : worlds.sorted()[0]?.id;
if (lastId) openWorld(lastId);
else createWorld('', '', 'creative');
$('btn-play').disabled = true;
requestAnimationFrame(frame);

// ---------- offline play & install ----------
// The service worker caches the game so it works without internet once loaded.
// Skipped on localhost so development always sees fresh files (?sw=1 forces it).
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if ('serviceWorker' in navigator && (!isLocal || new URLSearchParams(location.search).has('sw'))) {
  navigator.serviceWorker.register('./sw.js').then(() => {
    $('offline-note').textContent = 'It also works offline once it has loaded.';
  }).catch(() => { /* offline support is optional */ });
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('btn-install').classList.remove('hidden');
});
$('btn-install').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  $('btn-install').classList.add('hidden');
});
window.addEventListener('appinstalled', () => $('btn-install').classList.add('hidden'));

// Expose for debugging in the console.
window.minicrafter = {
  get world() { return world; }, get player() { return player; }, get target() { return target; },
  get inv() { return inv; }, worlds, get currentWorldId() { return currentWorldId; }, openWorld, get mobTarget() { return mobTarget; }, get robotTarget() { return robotTarget; }, survival, mobs, quests, robot, robotUI, keys, mouse, save, setMode,
  select: (i) => select(i),
  openOverlay: () => openOverlay(),
  /** Dev/test helper: enter play mode without pointer lock (for automated testing). */
  forcePlay() {
    state = 'playing'; hasPlayed = true;
    $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
    $('craft').classList.add('hidden'); $('inventory').classList.add('hidden');
  },
  setTime(t) { timeOfDay = t; },
  /** Dev/test helper: advance the game by n frames of `ms` each (works when rAF is paused). */
  step(n = 1, ms = 16) {
    for (let i = 0; i < n; i++) { last = performance.now() - ms; frame(performance.now(), true); }
  },
};
