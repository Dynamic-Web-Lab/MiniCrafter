import * as THREE from 'three';
import { B, BLOCKS, PLACEABLE, SOLID, FLOWERS, LIGHT, sparkFacing } from './blocks.js';
import { createAtlas, TILE } from './textures.js';
import { World, CS, SEA, applyVoxelLighting, lightUniforms } from './world.js';
import { Player, EYE } from './player.js';
import { hashString } from './noise.js';
import { Sky } from './sky.js';
import { Sfx } from './audio.js';
import { Particles } from './particles.js';
import { I, ITEMS, itemIcon, itemName, miningInfo, dropFor, STATION_BLOCK } from './items.js';
import { Inventory } from './inventory.js';
import { Survival, MAX_HEALTH, MAX_AIR, MAX_HUNGER } from './survival.js';
import { CraftUI } from './craftui.js';
import { PetUI } from './petui.js';
import { Mobs, TYPES } from './mobs.js';
import { TouchControls, isTouchDevice } from './touch.js';
import { Quests, QUESTS } from './quests.js';
import { Robot, EXAMPLES } from './robot.js';
import { RobotUI } from './robotui.js';
import { WorldStore } from './worlds.js';
import { TRADES, JOB_INFO } from './villages.js';
import { SHAPES, MAX_CELLS, previewBounds, ToolPreview, History } from './tools.js';
import { Critters } from './critters.js';
import { Projectiles } from './combat.js';
import { Spark } from './spark.js';
import { makeShareLink, readSharedFromHash, validateShared } from './share.js';
import { Together, COLORS, ANIMALS, EMOJI, profileName, saveProfile, loadSiteConfig, SITE } from './together.js';
import { Account, accountMessage } from './account.js';
import { Course, fmtTime } from './course.js';
import { PhotoMode, FRAMES, FILTERS, STICKERS } from './photo.js';
import { Insights, REPORTS } from './insights.js';

const insights = new Insights(); // anonymous counts + error reports, online edition only

const account = new Account();
import { IDEAS, ideaOfTheDay } from './ideas.js';
import { xpNeeded, addXp, MINING_XP, showGate, initGate, gateUnlocked } from './adventure.js';

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
/** Leaves pointer lock. iPhones and iPads have no Pointer Lock API, so calling it bare there throws. */
function exitLock() { if (document.pointerLockElement) document.exitPointerLock?.(); }

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
const history = new History();
const critters = new Critters(scene);
critters.onSpawnButterfly = (b) => { if (b.pos.distanceTo(player.pos) < 14) quests.emit('butterfly', {}); };
const toolPreview = new ToolPreview(scene);
const spark = new Spark({
  sfx,
  getPlayer: () => player,
  getMobs: () => mobs.list,
  onChange: () => { dirtySave = true; },
  onEvent: (kind) => quests.emit('spark', { kind }),
});
// ---------- Course Maker ----------
const course = new Course({
  getWorld: () => world,
  getPlayer: () => player,
  now: () => simTime,
  onStart(run) {
    sfx.tone(520, 0.12, 'square', 0.12); setTimeout(() => sfx.tone(780, 0.18, 'square', 0.14), 150);
    toast(run.total ? `🏁 Go! Collect ${run.total} coin${run.total === 1 ? '' : 's'} and reach the Finish!` : '🏁 Go! Reach the Finish pad!');
    renderCourseHud();
    quests.emit('course', { kind: 'start' });
  },
  onCheckpoint() { sfx.tone(880, 0.15, 'triangle', 0.14, 300); toast('🚩 Checkpoint! Fall off and you come back here.'); },
  onCoin(run, [x, y, z]) {
    sfx.tone(1200 + run.coins * 40, 0.08, 'square', 0.1, 600);
    particles.burst(x, y, z, TILE.COIN);
    renderCourseHud();
  },
  onRespawn() { sfx.whoosh?.(); },
  onFinish(r) {
    const p = player.pos;
    for (const tile of [TILE.WOOL_RED, TILE.WOOL_BLUE, TILE.WOOL_YELLOW, TILE.WOOL_GREEN, TILE.COIN]) particles.burst(Math.floor(p.x), Math.floor(p.y) + 1, Math.floor(p.z), tile);
    sfx.fanfare?.(); sfx.yay?.();
    const coins = r.total ? ` · 🪙 ${r.coins}/${r.total}` : '';
    hint(`🏁 Finished in ${fmtTime(r.time)}${coins}${r.newBest ? (r.beatOld ? ' · 🏆 New best time!' : '') : ` · Best ${fmtTime(r.best)}`}`, 4500);
    renderCourseHud();
    quests.emit('course', { kind: 'finish', time: r.time, coins: r.coins, total: r.total, beatOld: r.beatOld });
    insights.event('course_finish');
    dirtySave = true;
  },
  onCancel(reason) {
    toast(reason === 'flying' ? 'Course run stopped: no flying during a run! Step on Start to try again.' : 'Course run stopped.');
    renderCourseHud();
  },
});
function renderCourseHud() {
  const run = course.run;
  $('course-hud').classList.toggle('hidden', !run);
  document.getElementById('t-respawn')?.classList.toggle('hidden', !run);
  if (run) $('course-coins').textContent = run.total ? `🪙 ${run.coins}/${run.total}` : '';
}

// ---------- Photo Mode ----------
const photo = new PhotoMode();
async function openPhoto() {
  insights.step('opened Photo Mode');
  if (state !== 'playing') return;
  renderer.render(scene, camera); // capture a clean frame (the HUD is not part of the 3D view)
  await photo.capture(canvas);
  state = 'photo';
  clearInput();
  touch?.setEnabled(false);
  exitLock();
  sfx.tone(1400, 0.05, 'square', 0.12); setTimeout(() => sfx.tone(900, 0.08, 'square', 0.1), 60); // click!
  $('photo').classList.remove('hidden');
  renderPhoto();
}
function closePhoto() {
  $('photo').classList.add('hidden');
  state = 'menu';
  enterPlay();
}
function renderPhoto() {
  const chips = (box, items, current, pick) => {
    box.innerHTML = '';
    for (const [key, label] of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (key === current ? ' on' : ''); b.textContent = label;
      b.addEventListener('click', () => { pick(key); renderPhoto(); });
      box.appendChild(b);
    }
  };
  chips($('ph-frames'), FRAMES, photo.frame, (k) => { photo.frame = k; });
  chips($('ph-filters'), FILTERS, photo.filter, (k) => { photo.filter = k; });
  chips($('ph-stickers'), STICKERS.map((e) => [e, e]), photo.sticker, (k) => { photo.sticker = k; });
  $('ph-caption-row').classList.toggle('hidden', photo.frame !== 'polaroid');
  const c = photo.draw();
  const box = $('ph-canvas');
  if (c.parentNode !== box) { box.innerHTML = ''; box.appendChild(c); }
}
$('ph-canvas').addEventListener('click', (e) => {
  const pt = photo.photoPoint(e, photo.canvas);
  if (!pt) return;
  photo.addSticker(pt);
  sfx.pop();
  renderPhoto();
});
$('ph-undo').addEventListener('click', () => { photo.stickers.pop(); renderPhoto(); });
$('ph-caption').addEventListener('input', (e) => { photo.caption = e.target.value; renderPhoto(); });
$('ph-caption').addEventListener('keydown', (e) => e.stopPropagation());
$('ph-close').addEventListener('click', closePhoto);
$('ph-save').addEventListener('click', async () => {
  const blob = await photo.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `minicrafter-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('📷 Photo saved!');
  insights.event('photo_saved');
  quests.emit('photo', {});
});
$('ph-share').addEventListener('click', async () => {
  const blob = await photo.blob();
  const file = new File([blob], 'minicrafter.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'My MiniCrafter build' }); quests.emit('photo', {}); } catch { /* cancelled */ }
  } else $('ph-save').click();
});

// ---------- Play Together ----------
let guestReturnId = null; // the world to go back to after visiting a friend's game
const together = new Together({
  scene, mobs, sfx,
  getWorld: () => world,
  getPlayer: () => player,
  getTime: () => timeOfDay,
  setTime: (t) => { timeOfDay = t; },
  getMode: () => mode,
  toast: (t) => toast(t),
  snapshot: () => ({ seed: seedText, mode, time: timeOfDay, edits: world.serializeEdits(), spawn: [player.pos.x + 1.5, player.pos.y, player.pos.z + 1.5] }),
  startGuest(snap) {
    let clean;
    try { clean = validateShared({ v: 1, name: 'Friend', seed: snap.seed, mode: snap.mode, edits: snap.edits }); } catch { together.fail('That world could not be loaded.'); return; }
    if (currentWorldId) { save(); guestReturnId = currentWorldId; }
    currentWorldId = null; // a visitor never saves the host's world
    const sp = Array.isArray(snap.spawn) && snap.spawn.every(Number.isFinite) ? { x: snap.spawn[0], y: snap.spawn[1], z: snap.spawn[2] } : null;
    startWorld(clean.seed, { seed: clean.seed, edits: clean.edits, mode: clean.mode, time: Number.isFinite(snap.time) ? snap.time : 0.3, player: sp }, clean.mode);
    mobs.puppet = true;
    const host = together.peers.get(0);
    $('world-name').textContent = host ? `${profileName(host.profile)}'s world` : "A friend's world";
    $('world-info').textContent = `👫 Playing together · ${MODE_NAMES[mode]}`;
    closeTogether();
    sfx.fanfare?.();
    toast('👫 You joined the game! Press T (or 😊) to wave.');
    insights.event('together_join');
    if (state !== 'playing') enterPlay();
  },
  endGuest(reason) {
    mobs.puppet = false;
    const id = guestReturnId || worlds.currentId;
    guestReturnId = null;
    if (id && worlds.get(id)) openWorld(id);
    else if (worlds.sorted()[0]) openWorld(worlds.sorted()[0].id);
    else createWorld('', '', 'creative');
    showMenu();
    toast(reason || 'You left the game.');
    renderTogether();
  },
  onStatus: () => renderTogether(),
  onKnock: (id, p) => showKnock(id, p),
  onGive(item, n) {
    if (!isSurvival() || !ITEMS.has(item)) return;
    inv.add(item, n); renderHotbar(); sfx.pop(); toast(`+${n} ${itemName(item)}`);
  },
  onMobAction(id, act, acc, from, peer) { // host: a guest touched one of the animals
    const mob = mobs.list.find((m) => m.id === id);
    if (!mob || mob.hostile) return;
    const who = { pos: peer.target || peer.pos };
    if (act === 'pat') mobs.pat(mob, who);
    else if (act === 'feed') mobs.feed(mob);
    else if (act === 'shear') { const wool = mobs.shear(mob); if (wool != null) together.send({ k: 'give', item: wool, n: 1 + Math.floor(Math.random() * 3) }, from); }
    else if (act === 'sit' && mob.tamed) mobs.toggleSit(mob);
    else if (act === 'gear' && mob.tamed) { // a guest put pet armor or a backpack on one of the host's pets
      const g = ITEMS.get(acc);
      if (g?.petArmor) mobs.wearArmor(mob, acc);
      else if (g?.petBackpack && !mob.bag) mobs.setBackpack(mob, true);
    }
    else if (act === 'wear' && mob.tamed && ['party', 'crown', 'glasses'].includes(acc)) mobs.wear(mob, acc);
    dirtySave = true;
  },
});
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
  useBlock(x, y, z) {
    if (!spark.interact(x, y, z)) return false;
    quests.emit('robot', { kind: 'use' });
    return true;
  },
  isPowered: (x, y, z) => spark.isPowered(x, y, z),
  placeBlock(x, y, z, id) {
    if (SOLID[id] && player.intersectsBlock(x, y, z)) return 'You are standing there!';
    if (isSurvival()) {
      if (inv.count(id) < 1) return `I need more ${itemName(id)}!`;
      inv.remove(id, 1); renderHotbar();
    }
    if (!world.setBlock(x, y, z, sparkFacing(id, robot.f))) return false;
    world.flushDirty();
    sfx.place(id);
    quests.emit('robot', { kind: 'place', id, x, y, z });
    dirtySave = true;
    return true;
  },
  onAction: (a) => {
    robotUI?.highlight(a.id);
    if (a.kind === 'move' && a.to) {
      quests.emit('robot', { kind: 'move', dir: a.dir });
      quests.emit('robotClimb', robot.y - robotRun.startY);
      const below = BLOCKS[world.getBlock(robot.x, robot.y - 1, robot.z)];
      if (below?.note !== undefined) { sfx.note(below.note); quests.emit('note', { note: below.note }); } // Bit can play songs!
    }
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
const settings = Object.assign({ renderDistance: touchMode ? 5 : 7, sensitivity: 1, fov: 75, monsters: 'normal' }, store.get(SETTINGS_KEY) || {});
function applySettings() {
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  $('rd').value = settings.renderDistance; $('rd-val').textContent = settings.renderDistance;
  $('sens').value = settings.sensitivity; $('sens-val').textContent = settings.sensitivity.toFixed(1);
  $('fov').value = settings.fov; $('fov-val').textContent = settings.fov;
  $('monsters').value = settings.monsters;
  store.set(SETTINGS_KEY, settings);
}
$('rd').addEventListener('input', (e) => { settings.renderDistance = +e.target.value; applySettings(); });
$('sens').addEventListener('input', (e) => { settings.sensitivity = +e.target.value; applySettings(); });
$('fov').addEventListener('input', (e) => { settings.fov = +e.target.value; applySettings(); });
$('monsters').addEventListener('change', (e) => { settings.monsters = e.target.value; applySettings(); });
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

// Adventure is survival plus hunger, XP, lost-items chests (and later monsters).
const isSurvival = () => mode === 'survival' || mode === 'adventure';
const isAdventure = () => mode === 'adventure';
const MODE_NAMES = { creative: 'Creative', survival: 'Survival', adventure: '⚔️ Adventure' };
const adv = { xp: 0, level: 0, hardcore: false, over: false, graves: new Map(), armor: null }; // graves: "x,y,z" -> inventory JSON

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
  world.onChange = (x, y, z, from, to) => {
    spark.track(x, y, z, from, to);
    if (course.internal) return; // collected coins are only part of this player's run
    together.queueEdit(x, y, z, to); // Play Together: share every change (unless it came from the network)
    if (!spark.internal && !together.applying) history.record(x, y, z, from, to); // circuits switching and friends' edits aren't undo steps
  };
  history.clear();
  tool.anchor = null;
  crops.clear();
  attachFunHooks();
  inv = new Inventory();
  survival.reset();
  adv.xp = 0; adv.level = 0; adv.over = false; adv.graves = new Map(); adv.armor = null;
  projectiles?.clear();
  shownTips = new Set();
  mobs.reset(world);
  critters.reset(world);
  robot.world = world;
  robot.remove();
  quests.load(null);
  if (saved) {
    world.loadEdits(saved.edits);
    if (Array.isArray(saved.hotbar) && saved.hotbar.length === 9) saved.hotbar.forEach((id, i) => { if (ITEMS.has(id)) creativeBar[i] = id; });
    mobs.load(saved.mobs);
    robot.load(saved.robot);
    if (Array.isArray(saved.crops)) for (const c of saved.crops) if (c.length === 4) crops.set(`${c[0]},${c[1]},${c[2]}`, c[3]);
    robotUI.setState(saved.robotCode || null);
    quests.load(saved.quests);
    selected = saved.selected | 0;
    timeOfDay = saved.time ?? timeOfDay;
    mode = ['survival', 'adventure'].includes(saved.mode) ? saved.mode : 'creative';
    adv.xp = saved.xp | 0; adv.level = saved.level | 0; adv.over = !!saved.over;
    adv.armor = ITEMS.get(saved.armor)?.armor ? saved.armor : null;
    if (Number.isFinite(saved.hunger)) survival.hunger = Math.max(0, Math.min(MAX_HUNGER, saved.hunger));
    if (Array.isArray(saved.graves)) for (const [k, items] of saved.graves) adv.graves.set(k, items);
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
  spark.reset(world);
  course.reset(world, saved?.courses);
  renderCourseHud();
  if (!spawnPoint) spawnPoint = findSpawnColumn();
  const meta = worlds.get(currentWorldId);
  adv.hardcore = !!meta?.hardcore;
  if (adv.over) { player.flying = true; }
  $('world-name').textContent = meta?.name || 'My World';
  $('world-info').textContent = `Seed: ${seedStr} · ${MODE_NAMES[mode]}${adv.hardcore ? ' · ☠️ Hardcore' : ''}${adv.over ? ' (game over)' : ''}`;
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
  if (!world || !currentWorldId || together.isGuest) return;
  const ok = worlds.save(currentWorldId, {
    seed: seedText,
    edits: world.serializeEdits(),
    player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, flying: player.flying },
    hotbar: creativeBar, selected, time: timeOfDay,
    mode, inv: inv.toJSON(), health: survival.health, spawn: spawnPoint, tips: [...shownTips], mobs: mobs.serialize(), quests: quests.toJSON(), robot: robot.toJSON(), robotCode: robotUI.getState(),
    crops: [...crops].map(([k, t]) => [...k.split(',').map(Number), Math.round(t)]),
    xp: adv.xp, level: adv.level, hunger: survival.hunger, over: adv.over, graves: [...adv.graves], armor: adv.armor,
    courses: course.toJSON(),
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
  let f = '';
  if (isAdventure()) for (let i = 0; i < MAX_HUNGER / 2; i++) {
    const v = survival.hunger - (MAX_HUNGER / 2 - 1 - i) * 2; // fills from the right like the hearts mirror
    f += `<span class="food ${v >= 2 ? '' : v === 1 ? 'half' : 'empty'}">🍗</span>`;
  }
  $('hunger').innerHTML = f;
  const armor = isAdventure() && adv.armor ? ITEMS.get(adv.armor) : null;
  $('armor-ind').textContent = armor ? `🛡️ ${itemName(adv.armor)} (−${Math.round(armor.armor * 100)}%)` : '';
  renderXp();
}

function renderXp() {
  $('xpbar').classList.toggle('hidden', !isAdventure());
  if (!isAdventure()) return;
  $('xp-fill').style.width = `${Math.round(adv.xp / xpNeeded(adv.level) * 100)}%`;
  $('xp-level').textContent = adv.level;
}

/** Adventure XP: mining ores, harvesting, crafting and quests. */
function gainXp(n) {
  if (!isAdventure() || n <= 0) return;
  const up = addXp(adv, n);
  if (up) {
    sfx.fanfare?.();
    hint(`⬆️ Level up! You are now level ${adv.level}`, 2500);
    quests.emit('level', adv.level);
  }
  renderXp();
  dirtySave = true;
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
  insights.event('quest_done');
  gainXp(q.stars * 5);
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
  noteHeld();
}

/** Remembers the last block you held: power tools build and paint with it. */
function noteHeld() {
  const id = heldItem();
  if (id != null && ITEMS.get(id)?.block !== undefined) tool.block = id;
  tool.anchor = null;
  const def = ITEMS.get(id);
  if (def?.shape || def?.paint === 'block') setTimeout(() => toast(`${itemName(id)}: building with ${itemName(tool.block)}`), 700);
}

// Creative picker tabs, so kids can find things in 100+ blocks and items.
const PICKER_TABS = [
  ['all', '✨ All'], ['build', '🧱 Build'], ['nature', '🌸 Nature'], ['fun', '🎉 Fun'],
  ['spark', '⚡ Spark'], ['tools', '🪄 Tools'], ['friends', '🐾 Friends'], ['items', '🎒 Items'],
];
const NATURE = new Set([B.GRASS, B.DIRT, B.SAND, B.LOG, B.LEAVES, B.SNOW, B.SNOWY_GRASS, B.GRAVEL, B.CACTUS, B.FARMLAND, B.WATER,
  B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.STONE]);
function pickerTab(id) {
  const def = ITEMS.get(id), blk = id < 256 ? BLOCKS[id] : null;
  if (blk) {
    if (blk.spark) return 'spark';
    if (blk.pet) return 'friends';
    if (blk.course) return 'fun';
    if (blk.plant || NATURE.has(id)) return 'nature';
    if (blk.bounce || blk.speed || blk.slippery || blk.fan || blk.note !== undefined || blk.confetti || blk.portal || blk.star || blk.emissive) return 'fun';
    return 'build';
  }
  if (def?.shape || def?.paint || def?.tool || def?.hoe || def?.water || def?.glider || def?.damage || def?.bow || def?.shield || def?.armor) return 'tools';
  if (def?.spawns || def?.accessory || def?.petArmor || def?.petBackpack || id === I.ROBOT) return 'friends';
  return 'items';
}
let pickerFilter = 'all';

function buildCreativePicker() {
  const tabs = $('inv-tabs');
  if (!tabs.childElementCount) {
    for (const [key, label] of PICKER_TABS) {
      const t = document.createElement('button');
      t.type = 'button'; t.textContent = label; t.dataset.tab = key; t.setAttribute('role', 'tab');
      t.addEventListener('click', () => { pickerFilter = key; buildCreativePicker(); });
      tabs.appendChild(t);
    }
  }
  for (const t of tabs.children) { const on = t.dataset.tab === pickerFilter; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); }
  const grid = $('inv-grid');
  grid.innerHTML = '';
  for (const id of [...PLACEABLE, ...[...ITEMS.keys()].filter((k) => k >= 256)]) {
    if (pickerFilter !== 'all' && pickerTab(id) !== pickerFilter) continue;
    const b = document.createElement('button');
    b.className = 'inv-item';
    b.innerHTML = `<img alt="" src="${icon(id)}"><span>${itemName(id)}</span>`;
    b.addEventListener('click', () => {
      creativeBar[selected] = id;
      renderHotbar();
      noteHeld();
      dirtySave = true;
      closeOverlay(true);
    });
    grid.appendChild(b);
  }
}

function refreshMode() {
  for (const m of ['creative', 'survival', 'adventure']) {
    $(`mode-${m}`).classList.toggle('on', mode === m);
    $(`mode-${m}`).disabled = adv.hardcore && m !== mode; // hardcore worlds stay in Adventure
  }
  $('mode-desc').textContent = {
    creative: 'Creative: unlimited blocks, instant breaking and flying.',
    survival: 'Survival: collect blocks, craft tools and look after your hearts. Gentle: no monsters, no hunger.',
    adventure: `⚔️ Adventure (older players): night creatures, swords and bows, hunger, XP levels, and your things drop in a chest where you faint.${adv.hardcore ? ' ☠️ Hardcore: one life only!' : ''}`,
  }[mode];
  survival.adventure = isAdventure();
  if (isSurvival() && !adv.over) player.flying = false;
  quests.mode = mode;
  renderQuests();
  updateModeBadge();
  renderHotbar();
  renderStatus();
}

function setMode(m) {
  insights.step(`mode ${m}`);
  if (m === mode) return;
  if (adv.hardcore) { toast('Hardcore worlds stay in Adventure mode'); return; }
  if (together.isGuest) { toast("The host picks the game mode"); return; }
  if (together.isHost && m === 'adventure') { toast('Play Together works in Creative and Survival. End the game first.'); return; }
  mode = m;
  survival.stopMining();
  if (isSurvival()) survival.health = Math.max(survival.health, 1);
  refreshMode();
  dirtySave = true;
  save();
}
$('mode-creative').addEventListener('click', () => setMode('creative'));
$('mode-survival').addEventListener('click', () => setMode('survival'));
$('mode-adventure').addEventListener('click', () => setMode('adventure'));
initGate();

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
    gainXp(1);
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

const petUI = new PetUI({
  mobs,
  getInv: () => inv,
  atlasCanvas: atlas.canvas,
  isSurvival: () => isSurvival(),
  getHeld: () => heldItem(),
  onSit: (pet) => { const r = mobs.toggleSit(pet); toast(sitMessage(pet, r)); dirtySave = true; return r; },
  onChange: () => { renderHotbar(); dirtySave = true; },
  toast: (t) => toast(t),
});
function sitMessage(pet, r) { return r === 'bed' ? `${pet.petName} is heading to bed 🛏️` : r ? `${pet.petName} is sitting` : `${pet.petName} is following you`; }
let lastPetHurtToast = 0;
mobs.onPetHurt = (pet) => {
  if (performance.now() - lastPetHurtToast < 15000) return;
  lastPetHurtToast = performance.now();
  toast(`${pet.petName} got bumped! Pet armor helps, and a pet bed makes it better 🛏️`);
};
mobs.onPetFaint = (pet, atBed) => {
  toast(atBed ? `${pet.petName} was sleepy and went to its bed 💤` : `${pet.petName} needs a rest. Let it sit and recover 💤`);
  sfx.pop();
  dirtySave = true;
};

mobs.onBaby = (baby) => {
  quests.emit('baby', { type: baby.type });
  if (baby.pos.distanceTo(player.pos) < 24) { toast(`A baby ${TYPES[baby.type].name.toLowerCase()} was born!`); sfx.craft(); }
  dirtySave = true;
};

// ---------- game state & pointer lock ----------
let state = 'menu'; // 'menu' | 'locking' | 'playing' | 'inventory' | 'craft' | 'pet' | 'dead'
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
  insights.step('menu');
  state = 'menu';
  touch?.setEnabled(false);
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('inventory').classList.add('hidden');
  clearInput();
  save();
}

function openOverlay() {
  insights.step('opened inventory');
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
  exitLock();
}

function openPetPanel(mob) {
  insights.step('opened pet panel');
  clearInput();
  touch?.setEnabled(false);
  state = 'pet';
  petUI.open(mob);
  exitLock();
}

let bookFromMenu = false;
function openQuestBook(fromMenu) {
  insights.step('opened quest book');
  bookFromMenu = fromMenu;
  clearInput();
  touch?.setEnabled(false);
  state = 'questbook';
  renderQuestBook();
  $('questbook').classList.remove('hidden');
  if (!fromMenu) exitLock();
}

/** What Bit is currently running (for the coding quests). */
const robotRun = { program: [], custom: false, startY: 0 };
const stripIds = (p) => JSON.stringify(p, (k, v) => (k === 'id' ? undefined : (k === 'else' && Array.isArray(v) && !v.length ? undefined : v)));
const EXAMPLE_KEYS = new Set(EXAMPLES.map((e) => stripIds(e.program)));

const robotUI = new RobotUI({
  getRobot: () => robot,
  onRun: (name, program) => {
    robotRun.program = program;
    insights.event('bit_run');
    insights.step('Bit run');
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
  insights.step('opened trading');
  clearInput();
  touch?.setEnabled(false);
  state = 'trade';
  tradeWith = mob;
  mobs.voice(mob);
  quests.emit('meetVillager', { job: mob.job });
  renderTrade();
  $('trade').classList.remove('hidden');
  exitLock();
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
  insights.step("opened Bit's panel");
  clearInput();
  touch?.setEnabled(false);
  state = 'robot';
  robotUI.open();
  exitLock();
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
  if (state === 'pet') petUI.close();
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
  insights.step(`playing ${mode}${touchMode ? ' (touch)' : ''}`);
  insights.event('play', { mode });
  if (touchMode) insights.event('touch');
  if (isAdventure()) insights.event('adventure');
  if (navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) insights.event('installed');
  state = 'playing';
  hasPlayed = true;
  $('menu').classList.add('hidden');
  $('inventory').classList.add('hidden');
  $('craft').classList.add('hidden');
  $('pet').classList.add('hidden');
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
  insights.step('pressed Play');
  // Adventure worlds sit behind the grown-up gate (once per browser session).
  if (isAdventure() && !gateUnlocked()) { showGate(() => enterPlay(), () => showMenu()); return; }
  if (touchMode && upright.matches) { askSideways(); return; }
  if (touchMode) startPlaying();
  else { state = 'locking'; lock(); }
}

$('btn-play').addEventListener('click', enterPlay);

// Phones held upright: the game view doesn't fit, so pause and ask for the phone to be
// turned sideways, then carry on by itself. (The menus still work upright.)
const upright = matchMedia('(orientation: portrait) and (max-width: 600px)');
let resumeWhenSideways = false;
function askSideways() { resumeWhenSideways = true; $('rotate').classList.remove('hidden'); }
function cancelSideways() { resumeWhenSideways = false; $('rotate').classList.add('hidden'); }
upright.addEventListener('change', () => {
  if (!touchMode) return;
  if (upright.matches && state === 'playing') { showMenu(); askSideways(); }
  else if (!upright.matches && resumeWhenSideways) { cancelSideways(); enterPlay(); }
});
$('rotate-back').addEventListener('click', cancelSideways);
$('inv-done').addEventListener('click', () => closeOverlay(true));
$('craft-done').addEventListener('click', () => closeOverlay(true));
$('pet-done').addEventListener('click', () => closeOverlay(true));
$('qb-done').addEventListener('click', () => closeOverlay(true));
$('btn-quests').addEventListener('click', () => openQuestBook(true));
$('qt-head').addEventListener('click', () => { if (state === 'playing') openQuestBook(false); });
// ---------- Play Together screens ----------
let knockId = null;
let emojiOpen = false;

function openTogether() {
  $('together').classList.remove('hidden');
  if (together.isGuest || together.role === 'waiting') $('tg-code').value = together.code;
  renderTogether();
}
function closeTogether() { $('together').classList.add('hidden'); }

function renderProfilePicker() {
  const p = together.profile;
  $('tg-name').textContent = profileName(p);
  const chips = (box, items, current, key) => {
    box.innerHTML = '';
    for (const [label, color] of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (label === current ? ' on' : ''); b.textContent = label;
      if (color) b.style.setProperty('--chip', color);
      b.disabled = together.active || together.role === 'waiting' || together.role === 'connecting';
      b.addEventListener('click', () => { together.profile = { ...together.profile, [key]: label }; saveProfile(together.profile); renderTogether(); });
      box.appendChild(b);
    }
  };
  chips($('tg-colors'), COLORS, p.color, 'color');
  chips($('tg-animals'), ANIMALS.map((a) => [a]), p.animal, 'animal');
}

function renderTogether() {
  renderProfilePicker();
  const r = together.role;
  const hosting = r === 'host';
  const needLogin = SITE.accounts && !account.user && !r; // Play Together needs an account on our site
  $('tg-login').classList.toggle('hidden', !needLogin);
  $('tg-start').classList.toggle('hidden', needLogin || (!!r && r !== 'connecting'));
  $('tg-room').classList.toggle('hidden', !hosting);
  $('tg-host').disabled = $('tg-join').disabled = r === 'connecting';
  $('tg-status').textContent = r === 'connecting' ? 'Connecting…'
    : r === 'waiting' ? `⏳ Knocking on game ${together.code}… waiting for the host to let you in.`
      : r === 'guest' ? `👫 You're in game ${together.code}.` : (together.error || '');
  $('tg-close').textContent = r === 'waiting' ? 'Cancel' : r === 'guest' ? 'Leave the game' : 'Back';
  if (hosting) {
    insights.event('together_host');
    $('tg-code-big').textContent = together.code;
    $('tg-lock').textContent = together.locked ? '🔒 Room locked' : '🔓 Room open';
    const ul = $('tg-players');
    ul.innerHTML = '';
    const me = document.createElement('li'); me.textContent = `⭐ ${profileName(together.profile)} (you, the host)`; ul.appendChild(me);
    for (const [id, p] of together.peers) {
      const li = document.createElement('li');
      li.textContent = `👤 ${profileName(p.profile)} `;
      const k = document.createElement('button'); k.type = 'button'; k.textContent = 'Remove'; k.className = 'small';
      k.addEventListener('click', () => together.kick(id));
      li.appendChild(k); ul.appendChild(li);
    }
    const kb = $('tg-knocks');
    kb.innerHTML = '';
    for (const [id, p] of together.knocks) {
      const d = document.createElement('div'); d.className = 'tg-knock';
      d.innerHTML = `<span>🚪 <b></b> wants to join</span>`;
      d.querySelector('b').textContent = profileName(p);
      for (const [ok, label] of [[true, 'Let in'], [false, 'Not now']]) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (ok) b.className = 'go';
        b.addEventListener('click', () => { together.admit(id, ok); if (knockId === id) hideKnock(); });
        d.appendChild(b);
      }
      kb.appendChild(d);
    }
  }
  // Menu and HUD
  $('tg-menu-state').textContent = hosting ? `· ${together.code} · ${together.count} 👤` : r === 'guest' ? '· playing' : '';
  const chip = $('tg-chip');
  chip.classList.toggle('hidden', !together.active);
  if (together.active) chip.textContent = `👫 ${together.code} · ${together.count} player${together.count === 1 ? '' : 's'}`;
  document.getElementById('t-emoji')?.classList.toggle('hidden', !together.active);
  if (!together.active) toggleEmojiBar(false);
}

function showKnock(id, p) {
  knockId = id;
  $('knock-text').textContent = `🚪 ${profileName(p)} wants to join`;
  $('knock').classList.remove('hidden');
  sfx.tone?.(660, 0.12, 'triangle', 0.15, 200);
}
function hideKnock() { knockId = null; $('knock').classList.add('hidden'); }
function answerKnock(ok) { if (knockId != null) together.admit(knockId, ok); hideKnock(); }

function toggleEmojiBar(force) {
  emojiOpen = force ?? !emojiOpen;
  const bar = $('emoji-bar');
  if (!bar.childElementCount) {
    EMOJI.forEach((e, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `${e}<small>${i + 1}</small>`;
      b.addEventListener('click', () => { together.emote(i); toggleEmojiBar(false); });
      bar.appendChild(b);
    });
  }
  bar.classList.toggle('hidden', !emojiOpen);
}

$('btn-together').addEventListener('click', openTogether);
// Play Together only shows on our hosted site (see loadSiteConfig); the free copy hides it.
$('btn-together').classList.add('hidden');
loadSiteConfig().then(() => {
  $('btn-together').classList.toggle('hidden', !SITE.online);
  // The free edition links to the online edition for Play Together and accounts.
  if (!SITE.online && SITE.onlineUrl) { $('btn-online').href = SITE.onlineUrl; $('btn-online').classList.remove('hidden'); }
  account.enabled = SITE.accounts;
  if (SITE.online && SITE.insights) { insights.start('online'); $('btn-report').classList.remove('hidden'); }
  $('btn-account').classList.toggle('hidden', !SITE.accounts);
  if (SITE.accounts) account.refresh();
});
$('tg-close').addEventListener('click', () => {
  if (together.role === 'waiting' || together.role === 'connecting') together.leave(true);
  else if (together.isGuest) together.leave();
  closeTogether();
  renderTogether();
});
/** On our site, check the login is still good before starting or joining (the relay checks it too). */
async function withLogin(fn) {
  if (SITE.accounts && !(await account.refresh())) { renderTogether(); openAccount('login'); return; }
  fn();
}
$('tg-host').addEventListener('click', () => (insights.step('Play Together: host'), withLogin(() => { together.error = ''; together.host(); })));
$('tg-join').addEventListener('click', () => (insights.step('Play Together: join'), withLogin(() => { together.error = ''; together.join($('tg-code').value); })));
$('tg-login-btn').addEventListener('click', () => openAccount('login'));
$('tg-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('tg-code').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('tg-join').click(); });
$('tg-lock').addEventListener('click', () => together.setLocked(!together.locked));
$('tg-end').addEventListener('click', () => { together.leave(); toast('Play Together ended'); });
$('tg-play').addEventListener('click', () => { closeTogether(); enterPlay(); });
$('knock-yes').addEventListener('click', () => answerKnock(true));
$('knock-no').addEventListener('click', () => answerKnock(false));
renderTogether();

// ---------- account screen (online edition) ----------
let accMode = 'login';
function openAccount(mode = 'login') {
  accMode = mode;
  $('acc-msg').textContent = '';
  $('acc-pass').value = ''; $('acc-pass2').value = ''; $('acc-del-pass').value = '';
  renderAccount();
  $('account').classList.remove('hidden');
}
function closeAccount() { $('account').classList.add('hidden'); }
function renderAccount() {
  const u = account.user;
  $('acc-menu').textContent = u ? `${u} (your account)` : 'Log in or create an account';
  $('acc-out').classList.toggle('hidden', !!u);
  $('acc-in').classList.toggle('hidden', !u);
  $('acc-name').textContent = u || '';
  const creating = accMode === 'new';
  $('acc-tab-login').classList.toggle('on', !creating);
  $('acc-tab-new').classList.toggle('on', creating);
  $('acc-new-extra').classList.toggle('hidden', !creating);
  $('acc-pass').autocomplete = creating ? 'new-password' : 'current-password';
  $('acc-submit').textContent = creating ? 'Create my account' : 'Log in';
  renderGrownup();
}

// Sign-up: a birth year (only used here, never sent or kept) decides whether a grown-up must help.
const THIS_YEAR = new Date().getFullYear();
{
  const sel = $('acc-year');
  for (let y = THIS_YEAR - 3; y >= THIS_YEAR - 100; y--) { const o = document.createElement('option'); o.value = String(y); o.textContent = String(y); sel.appendChild(o); }
}
let grownupQ = { a: 7, b: 8 };
/** True when the player may be under 13 (by birth year alone we can't tell, so be careful). */
const maybeUnder13 = () => { const y = Number($('acc-year').value); return y > 0 && THIS_YEAR - y <= 13; };
function renderGrownup() {
  const show = accMode === 'new' && maybeUnder13();
  if (show && $('acc-grownup').classList.contains('hidden')) {
    grownupQ = { a: 6 + Math.floor(Math.random() * 7), b: 6 + Math.floor(Math.random() * 7) };
    $('acc-q').textContent = `${grownupQ.a} × ${grownupQ.b}`;
    $('acc-a').value = ''; $('acc-parent').checked = false;
  }
  $('acc-grownup').classList.toggle('hidden', !show);
}
$('acc-year').addEventListener('change', renderGrownup);
account.onChange = () => { renderAccount(); renderTogether(); };
$('btn-account').addEventListener('click', () => openAccount(account.user ? 'login' : 'login'));
$('acc-tab-login').addEventListener('click', () => { accMode = 'login'; $('acc-msg').textContent = ''; renderAccount(); });
$('acc-tab-new').addEventListener('click', () => { accMode = 'new'; $('acc-msg').textContent = ''; renderAccount(); });
$('acc-done').addEventListener('click', closeAccount);
for (const id of ['acc-user', 'acc-pass', 'acc-pass2', 'acc-del-pass', 'acc-a']) $(id).addEventListener('keydown', (e) => e.stopPropagation());
$('acc-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = $('acc-user').value.trim(), pass = $('acc-pass').value;
  const say = (t) => { $('acc-msg').textContent = t; };
  let consent = null;
  if (accMode === 'new') {
    if (pass !== $('acc-pass2').value) return say("The two passwords don't match.");
    if (!$('acc-year').value) return say('Please choose the year you were born.');
    const under13 = maybeUnder13();
    if (under13) {
      if (!$('acc-parent').checked) return say('A parent or guardian needs to tick the grown-up box.');
      if (Number($('acc-a').value) !== grownupQ.a * grownupQ.b) return say("The grown-up check answer isn't right. Ask a grown-up!");
    }
    if (!$('acc-agree').checked) return say('Please tick the box to agree to the Terms of Use and Privacy Policy.');
    consent = { under13, grownup: under13 };
  }
  $('acc-submit').disabled = true;
  say(accMode === 'new' ? 'Creating your account…' : 'Logging in…');
  const r = accMode === 'new' ? await account.register(user, pass, consent) : await account.login(user, pass);
  $('acc-submit').disabled = false;
  $('acc-pass').value = ''; $('acc-pass2').value = '';
  if (!r.ok) { $('acc-msg').textContent = accountMessage(r.error); return; }
  $('acc-msg').textContent = '';
  insights.event(accMode === 'new' ? 'account_register' : 'account_login');
  toast(accMode === 'new' ? `🎉 Welcome, ${r.username}! Your account is ready.` : `👋 Welcome back, ${r.username}!`);
  closeAccount();
  if (!$('together').classList.contains('hidden')) renderTogether();
});
$('acc-logout').addEventListener('click', async () => {
  if (together.active) together.leave();
  await account.logout();
  toast('You logged out');
  closeAccount();
});
$('acc-delete').addEventListener('click', async () => {
  const r = await account.remove($('acc-del-pass').value);
  $('acc-del-pass').value = '';
  if (!r.ok) { $('acc-msg').textContent = accountMessage(r.error); return; }
  if (together.active) together.leave();
  toast('Your account was deleted');
  closeAccount();
});

// Every pop-up panel gets a ✕ that is always on screen, and tapping the dimmed area
// outside a panel closes it too. (Phones have no Escape key, and on a small screen the
// Done button can be scrolled out of sight under a long list.)
for (const [overlay, done] of [['inventory', 'inv-done'], ['craft', 'craft-done'], ['pet', 'pet-done'], ['worlds', 'w-done'], ['trade', 'tr-done'], ['questbook', 'qb-done'], ['together', 'tg-close'], ['account', 'acc-done'], ['gate', 'gate-cancel'], ['photo', 'ph-close'], ['report', 'report-done']]) {
  const ov = $(overlay);
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'x-close'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close');
  x.addEventListener('click', () => $(done).click());
  ov.appendChild(x);
  ov.addEventListener('click', (e) => { if (e.target === ov) $(done).click(); });
}

// Bit's side panel is not a pop-up (taps inside it must not close it), so it only gets the ✕.
{
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'x-close'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close');
  x.addEventListener('click', () => $('rb-close').click());
  $('robot-panel').appendChild(x);
}

// Game version (the offline cache's name), so testers can tell which build a device runs.
window.caches?.keys().then((keys) => {
  const v = Math.max(0, ...keys.map((k) => Number((/^minicrafter-v(\d+)$/.exec(k) || [])[1] || 0)));
  if (v) $('game-version').textContent = `Version ${v}`;
}).catch(() => {});

// ---------- Report a problem (online edition) ----------
{
  const box = $('report-choices');
  for (const label of REPORTS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'wide-btn'; b.textContent = label;
    b.addEventListener('click', () => {
      insights.report(label);
      $('report').classList.add('hidden');
      toast('🐞 Thanks! We got your report and will look into it.');
    });
    box.appendChild(b);
  }
}
$('btn-report').addEventListener('click', () => { insights.where = state; $('report').classList.remove('hidden'); });
$('report-done').addEventListener('click', () => $('report').classList.add('hidden'));

// ---------- today's building idea ----------
$('idea-text').textContent = ideaOfTheDay();
$('btn-idea').addEventListener('click', () => { $('idea-text').textContent = IDEAS[Math.floor(Math.random() * IDEAS.length)]; });

// ---------- worlds screen ----------
/** Switches to a saved world (saving the current one first). */
function openWorld(id) {
  insights.step('opened a world');
  const meta = worlds.get(id);
  if (!meta) return;
  if (together.isHost) { together.leave(); toast('Play Together ended (you switched worlds)'); }
  if (currentWorldId && currentWorldId !== id) save();
  currentWorldId = id;
  worlds.setCurrent(id);
  const data = worlds.load(id);
  if (data && data.seed != null) startWorld(String(data.seed), data);
  else startWorld(meta.seed, null, meta.mode);
  save();
  loadingShown = true;
}

function createWorld(name, seed, newMode, hardcore = false) {
  insights.event('world_new');
  const w = worlds.add({ name, seed: seed || String(Math.floor(Math.random() * 1e9)), mode: newMode, hardcore });
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
    el.innerHTML = `<div><div class="w-name"></div><div class="w-meta">${w.mode === 'adventure' ? (w.hardcore ? '☠️ Hardcore' : '⚔️ Adventure') : w.mode === 'survival' ? '❤️ Survival' : '🎨 Creative'} · ⭐ ${w.stars || 0} · seed ${String(w.seed).slice(0, 14)} · ${ago(w.played)}</div></div>
      <div class="w-actions">
        ${w.id === currentWorldId ? '<button disabled>Playing</button>' : '<button data-a="play" class="go">▶ Play</button>'}
        <button data-a="rename" title="Rename">✏️</button>
        <button data-a="share" title="Copy a share link">🔗</button>
        <button data-a="export" title="Download a copy">⬇</button>
        <button data-a="delete" title="Delete">🗑</button>
      </div>`;
    el.querySelector('.w-name').textContent = w.name; // user text: never as HTML
    el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => worldAction(b.dataset.a, w)));
    box.appendChild(el);
  }
  $('nw-name').placeholder = worlds.suggestName();
  for (const m of ['creative', 'survival', 'adventure']) $(`nw-${m}`).classList.toggle('on', newWorldMode === m);
  $('nw-hardcore-row').classList.toggle('hidden', newWorldMode !== 'adventure');
}

function worldAction(action, w) {
  if (action === 'play') { openWorld(w.id); closeWorlds(); }
  else if (action === 'rename') {
    const name = prompt('New name for this world:', w.name);
    if (name) { worlds.rename(w.id, name); if (w.id === currentWorldId) $('world-name').textContent = worlds.get(w.id).name; renderWorlds(); }
  } else if (action === 'share') {
    save();
    makeShareLink(w, worlds.load(w.id), location.origin + location.pathname).then(async (res) => {
      if (res.tooBig) { alert('This world has too many changes for a link. Use ⬇ Download instead and send the file.'); return; }
      try { await navigator.clipboard.writeText(res.url); toast('Share link copied! Send it to a friend or grandparent.'); }
      catch { prompt('Copy this link and send it:', res.url); }
    }).catch(() => alert('Sorry, this browser cannot make share links. Use ⬇ Download instead.'));
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
$('nw-adventure').addEventListener('click', () => { newWorldMode = 'adventure'; renderWorlds(); });
$('nw-create').addEventListener('click', () => {
  createWorld($('nw-name').value || $('nw-name').placeholder, $('nw-seed').value.trim(), newWorldMode, newWorldMode === 'adventure' && $('nw-hardcore').checked);
  $('nw-hardcore').checked = false;
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
  $('death-msg').textContent = reason === 'drown' ? 'You ran out of air.' : reason === 'fall' ? 'That was a big fall!' : reason === 'hunger' ? 'You were too hungry.' : reason === 'monster' ? 'A night creature got you!' : 'You fainted.';
  $('death-title').textContent = 'Oops!';
  $('btn-respawn').classList.remove('hidden');
  $('btn-spectate').classList.add('hidden');
  if (isAdventure() && adv.hardcore) {
    $('death-title').textContent = '☠️ Game Over';
    $('death-note').textContent = `Hardcore: one life only. You reached level ${adv.level}. You can still fly around and look at your world.`;
    $('btn-respawn').classList.add('hidden');
    $('btn-spectate').classList.remove('hidden');
  } else if (isAdventure()) {
    const where = dropLostItems();
    $('death-note').textContent = where ? `Your things are in a chest where you fainted (${where}). Go and get them back!` : 'You had nothing to drop.';
  } else $('death-note').textContent = "Don't worry, you keep all your items.";
  $('death').classList.remove('hidden');
  $('hud').classList.add('hidden');
  touch?.setEnabled(false);
  exitLock();
};
$('btn-respawn').addEventListener('click', () => {
  survival.reset();
  spawn();
  $('death').classList.add('hidden');
  enterPlay();
});
$('btn-spectate').addEventListener('click', () => {
  adv.over = true;                 // hardcore: the world becomes look-only
  survival.reset();
  player.flying = true;
  $('death').classList.add('hidden');
  dirtySave = true;
  save();
  enterPlay();
});

// ---------- night creatures and combat (Adventure) ----------
/** Approximate light level 0-15 at a cell: open sky (by day) plus nearby torches/lamps. */
function lightLevel(x, y, z) {
  const sky = world.topSolid(x, z) < y ? (isNight() ? 4 : 15) : 0;
  let blk = 0;
  for (let dy = -7; dy <= 7; dy++) for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
    const e = LIGHT[world.getBlock(x + dx, y + dy, z + dz)];
    if (e) blk = Math.max(blk, e - Math.abs(dx) - Math.abs(dy) - Math.abs(dz));
  }
  return Math.max(sky, blk);
}
const isNight = () => timeOfDay > 0.55 && timeOfDay < 0.95;
const difficulty = () => (settings.monsters === 'easy' ? 0.5 : 1);

/** Damage from a night creature: armour and a raised shield soak it up. */
function hurtPlayer(dmg, from) {
  if (!isAdventure() || adv.over || survival.dead) return;
  let d = dmg * difficulty();
  if (adv.armor) d *= 1 - (ITEMS.get(adv.armor)?.armor || 0);
  if (player.blocking && from) {
    const fx = from.x - player.pos.x, fz = from.z - player.pos.z;
    const facing = -Math.sin(player.yaw) * fx - Math.cos(player.yaw) * fz; // > 0 when in front of you
    if (facing > 0) { d *= 0.15; sfx.tone(240, 0.08, 'square', 0.12); }
  }
  if (from) { // knock-back
    const ax = player.pos.x - from.x, az = player.pos.z - from.z, al = Math.hypot(ax, az) || 1;
    player.vel.x += ax / al * 5; player.vel.z += az / al * 5; player.vel.y = Math.max(player.vel.y, 4);
  }
  survival.damage(Math.max(d >= 0.5 ? 1 : 0, Math.round(d)), 'monster');
}

mobs.canSpawnMonster = (x, y, z) => lightLevel(x, y, z) < 7;
mobs.onAttack = (mob) => hurtPlayer(TYPES[mob.type].dmg, mob.pos);
mobs.onShoot = (mob) => {
  const from = mob.pos.clone(); from.y += TYPES[mob.type].h * 0.85;
  const eye = player.eye;
  projectiles.fire('spore', from, eye.clone().sub(from), 7, TYPES[mob.type].dmg);
};
mobs.onPoof = (mob, cause) => {
  for (const tile of [TILE.WOOL_BLACK, TILE.WOOL_WHITE, TILE.NEON_PURPLE]) particles.burst(Math.floor(mob.pos.x), Math.floor(mob.pos.y), Math.floor(mob.pos.z), tile);
  if (cause !== 'player' && cause !== 'arrow') return;
  sfx.tone(520, 0.18, 'triangle', 0.18, -300);
  gainXp(5);
  const drop = mob.type === 'sporeling' ? (Math.random() < 0.6 ? [I.ARROW, 1 + Math.floor(Math.random() * 2)] : null)
    : (Math.random() < 0.3 ? [I.COAL, 1] : Math.random() < 0.15 ? [I.APPLE, 1] : null);
  if (drop) { inv.add(drop[0], drop[1]); renderHotbar(); toast(`+${drop[1]} ${itemName(drop[0])}`); }
  quests.emit('defeat', { type: mob.type, how: cause });
  dirtySave = true;
};
const projectiles = new Projectiles({
  scene, mobs, getWorld: () => world, getPlayer: () => player,
  onHitPlayer: (dmg, pos) => hurtPlayer(dmg, pos),
  onHitMob: (mob, dmg) => { sfx.hit?.(B.WOOL_WHITE); mob.byArrow = true; mobs.hurt(mob, dmg, player.pos); },
  onHitBlock: () => {},
});
// Arrow defeats count as 'arrow' for the Archer quest.
const _poof = mobs.poof.bind(mobs);
mobs.poof = (mob, cause) => _poof(mob, cause === 'player' && mob.byArrow ? 'arrow' : cause);

/** Sword (or fist) attack on a night creature. */
function attackMob(mob, now) {
  const dmg = ITEMS.get(heldItem())?.damage || 1;
  mob.byArrow = false;
  mobs.hurt(mob, dmg, player.pos);
  sfx.hit?.(B.STONE);
  survival.exhaust(0.1);
  mouse.nextAction = now + 0.45;
}

const bow = { charging: false, start: 0 };
/** Bow: hold right-click to draw, let go to shoot. More draw = faster, harder arrows. */
function updateBow(now) {
  const holdingBow = isAdventure() && ITEMS.get(heldItem())?.bow;
  if (holdingBow && mouse.right && !bow.charging) {
    if (inv.count(I.ARROW) < 1) { if (now >= mouse.nextAction) { toast('You need arrows (stick + cobblestone)'); mouse.nextAction = now + 1; } }
    else { bow.charging = true; bow.start = now; }
  }
  const charge = bow.charging ? Math.min(1, (now - bow.start) / 0.9) : 0;
  $('charge').classList.toggle('hidden', !bow.charging);
  $('charge-fill').style.width = `${Math.round(charge * 100)}%`;
  if (bow.charging && (!mouse.right || !holdingBow)) {
    bow.charging = false;
    $('charge').classList.add('hidden');
    if (!holdingBow || !inv.remove(I.ARROW, 1)) return;
    renderHotbar();
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const from = player.eye.clone().addScaledVector(dir, 0.6);
    projectiles.fire('arrow', from, dir, 14 + 18 * charge, Math.round(2 + 6 * charge));
    sfx.tone(300, 0.12, 'triangle', 0.18, 500);
    mouse.nextAction = now + 0.2;
  }
}

/** Adventure: put the whole inventory into a Lost Items Chest where you fainted. Returns "x, y, z". */
function dropLostItems() {
  if (inv.slots.every((s) => !s)) return null;
  let x = Math.floor(player.pos.x), y = Math.max(1, Math.floor(player.pos.y)), z = Math.floor(player.pos.z);
  for (let i = 0; i < 12 && world.getBlock(x, y, z) !== B.AIR && world.getBlock(x, y, z) !== B.WATER; i++) y++;
  world.setBlock(x, y, z, B.LOST_CHEST);
  world.flushDirty();
  adv.graves.set(`${x},${y},${z}`, inv.toJSON());
  inv = new Inventory();
  renderHotbar();
  dirtySave = true;
  save();
  return `${x}, ${y}, ${z}`;
}

/** Clicking a Lost Items Chest gives your things back. */
function openLostChest(now) {
  mouse.nextAction = now + 0.5;
  mouse.left = mouse.right = false;
  survival.stopMining();
  const { x, y, z } = target;
  const key = `${x},${y},${z}`;
  const stored = Inventory.fromJSON(adv.graves.get(key) || []);
  let left = 0;
  for (const st of stored.slots) if (st) left += inv.add(st.id, st.count);
  adv.graves.delete(key);
  world.setBlock(x, y, z, B.AIR);
  world.flushDirty();
  renderHotbar();
  sfx.craft();
  toast(left ? `Got most things back (${left} didn't fit)` : 'You got your things back!');
  quests.emit('recover', {});
  dirtySave = true;
}

// ---------- input ----------
document.addEventListener('keydown', (e) => {
  if (state === 'questbook') {
    if (e.code === 'KeyQ' || e.code === 'Escape') closeOverlay(e.code === 'KeyQ');
    return;
  }
  if (state === 'photo') {
    if (e.code === 'Escape' || e.code === 'KeyP') closePhoto();
    return;
  }
  if (state === 'robot' || state === 'trade' || state === 'pet') {
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
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (emojiOpen && n >= 1 && n <= EMOJI.length) { together.emote(n - 1); toggleEmojiBar(false); return; }
    if (n >= 1 && n <= 9) select(n - 1);
  }
  if (e.code === 'KeyF') toggleFly();
  if (e.code === 'KeyE') openOverlay();
  if (e.code === 'KeyQ') openQuestBook(false);
  if (e.code === 'KeyZ') undoRedo(false);
  if (e.code === 'KeyY') undoRedo(true);
  if (e.code === 'KeyT' && together.active) toggleEmojiBar();
  if (e.code === 'KeyR' && course.run) course.respawn();
  if (e.code === 'KeyP') openPhoto();
  if (e.code === 'KeyL' && knockId != null) answerKnock(true);
  if (e.code === 'KeyN' && knockId != null) answerKnock(false);
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
  holdStart() {
    if (state !== 'playing') return;
    // Holding a bow or shield: press and hold draws the bow / raises the shield (like holding right click).
    const def = ITEMS.get(heldItem());
    if (isAdventure() && (def?.bow || def?.shield)) mouse.right = true;
    else mouse.left = true;
    mouse.nextAction = 0;
  },
  holdEnd() { mouse.left = false; mouse.right = false; survival.stopMining(); },
  button(name, down) {
    if (name === 'jump') touchKeys.jump = down;
    else if (name === 'down') touchKeys.down = down;
    else if (!down) return;
    else if (name === 'fly' && state === 'playing') toggleFly();
    else if (name === 'inventory' && state === 'playing') openOverlay();
    else if (name === 'pause' && state === 'playing') showMenu();
    else if (name === 'undo' && state === 'playing') undoRedo(false);
    else if (name === 'emoji' && state === 'playing') toggleEmojiBar();
    else if (name === 'respawn' && state === 'playing') course.respawn();
    else if (name === 'photo' && state === 'playing') openPhoto();
  },
}) : null;

// ---------- interaction ----------
let target = null;
let mobTarget = null;
let robotTarget = false;
let fireflyTarget = null;
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
  // Plants can't float: a flower or crop on top pops off too.
  if (BLOCKS[world.getBlock(x, y + 1, z)]?.plant) world.setBlock(x, y + 1, z, B.AIR);
  world.flushDirty();
}

// ---------- garden & farm ----------
const crops = new Map(); // "x,y,z" -> seconds until the next growth stage
const SOIL = new Set([B.GRASS, B.DIRT, B.SNOWY_GRASS, B.FARMLAND]);
let cropTick = 0;

function addCrop(x, y, z) { crops.set(`${x},${y},${z}`, 25 + Math.random() * 20); }

/** Wheat grows one stage every ~25-45 s (about 2 minutes from seed to golden wheat). */
function tickCrops(dt) {
  cropTick += dt;
  if (cropTick < 1) return;
  const step = cropTick; cropTick = 0;
  let changed = false;
  for (const [k, t] of crops) {
    const [x, y, z] = k.split(',').map(Number);
    if (!world.chunks.get(`${Math.floor(x / CS)},${Math.floor(z / CS)}`)?.meshed) continue;
    const id = world.getBlock(x, y, z);
    const stage = BLOCKS[id]?.crop;
    if (stage === undefined || stage >= 3) { crops.delete(k); continue; }
    if (t - step > 0) { crops.set(k, t - step); continue; }
    world.setBlock(x, y, z, id + 1);
    changed = true;
    if (stage + 1 >= 3) crops.delete(k); else crops.set(k, 25 + Math.random() * 20);
  }
  if (changed) { world.flushDirty(); dirtySave = true; }
}

/** Watering can: crops grow a stage, grass blooms with flowers, dirt turns green. */
function waterAt(t) {
  const { x, y, z, id } = t;
  particles.burst(x, y + 0.5, z, BLOCKS[B.WATER].side);
  sfx.burst?.(1500, 0.8, 0.2, 0.2);
  const b = BLOCKS[id];
  if (b?.crop !== undefined && b.crop < 3) {
    world.setBlock(x, y, z, id + 1);
    if (b.crop + 1 < 3) addCrop(x, y, z); else crops.delete(`${x},${y},${z}`);
  } else if (id === B.DIRT) world.setBlock(x, y, z, B.GRASS);
  else if (id === B.GRASS || id === B.SNOWY_GRASS || b?.plant) {
    const gy = b?.plant ? y - 1 : y;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      for (let yy = gy + 1; yy >= gy - 1; yy--) {
        const g = world.getBlock(x + dx, yy, z + dz);
        if (g !== B.GRASS && g !== B.SNOWY_GRASS) continue;
        if (world.getBlock(x + dx, yy + 1, z + dz) === B.AIR && Math.random() < 0.4) {
          world.setBlock(x + dx, yy + 1, z + dz, Math.random() < 0.55 ? B.TALL_GRASS : FLOWERS[Math.floor(Math.random() * FLOWERS.length)]);
        }
        break;
      }
    }
    quests.emit('bloom', {});
  }
  world.flushDirty();
  dirtySave = true;
}

/**
 * Right-click with a hoe, seeds or watering can. Returns false if the held item
 * isn't a garden item, 'consume' if one item should be used up (survival), else true.
 */
function useGardenItem(held) {
  const def = ITEMS.get(held);
  if (!def || !(def.hoe || def.water || held === I.SEEDS) || !target) return false;
  const { x, y, z, id } = target;
  const above = world.getBlock(x, y + 1, z);
  const aboveFree = above === B.AIR || (BLOCKS[above]?.plant && BLOCKS[above].crop === undefined);
  if (def.hoe) {
    if ((id === B.GRASS || id === B.DIRT || id === B.SNOWY_GRASS) && aboveFree) {
      if (above !== B.AIR) world.setBlock(x, y + 1, z, B.AIR);
      world.setBlock(x, y, z, B.FARMLAND);
      world.flushDirty();
      sfx.dig(B.DIRT);
      tip('farm', 'Farmland! Now plant Wheat Seeds on it. Break tall grass to find seeds.');
    }
    return true;
  }
  if (held === I.SEEDS) {
    if (id === B.FARMLAND && above === B.AIR) {
      world.setBlock(x, y + 1, z, B.WHEAT_0);
      addCrop(x, y + 1, z);
      world.flushDirty();
      sfx.place(B.GRASS);
      return 'consume';
    }
    hint('Seeds grow on farmland. Use a Hoe on grass first!', 2500);
    return true;
  }
  waterAt(target);
  return true;
}

/** Which way facing blocks (gates, pistons) point when you place them: away from you. */
function placeFacing() {
  if (player.pitch < -0.85) return 4; // looking down: pistons push up
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 1 : 3;
  return fz > 0 ? 2 : 0;
}

function placeBlock(item) {
  const id = sparkFacing(item, placeFacing());
  const px = target.x + target.normal[0], py = target.y + target.normal[1], pz = target.z + target.normal[2];
  const there = world.getBlock(px, py, pz);
  const replaceable = there === B.AIR || there === B.WATER || (BLOCKS[there]?.plant && BLOCKS[there].crop === undefined);
  if (!replaceable) return false;
  if (BLOCKS[id]?.plant && !SOIL.has(world.getBlock(px, py - 1, pz))) { hint('Flowers need grass or dirt to grow on', 2000); return false; }
  if (SOLID[id] && player.intersectsBlock(px, py, pz)) return false;
  if (!world.setBlock(px, py, pz, id)) return false;
  world.flushDirty();
  sfx.place(id);
  quests.emit('place', { id: item, x: px, y: py, z: pz });
  if (BLOCKS[id].spark) insights.event('circuit');
  if (BLOCKS[id].spark) tip('spark', 'Spark circuits! Wire a Lever, Button, Plate or Battery to a Lamp, Door or Piston. Right-click a lever to flip it.');
  return true;
}

let lastHitSound = 0;
function act(now, dt) {
  if (fireflyTarget && (mouse.left || mouse.right) && now >= mouse.nextAction) return catchFirefly(now);
  if (adv.over) return; // hardcore game over: look, don't touch
  if (target?.id === B.STAR && (mouse.left || mouse.right) && now >= mouse.nextAction) return foundStar(now);
  if (target?.id === B.LOST_CHEST && (mouse.left || mouse.right) && now >= mouse.nextAction) return openLostChest(now);
  if (target && mouse.right && now >= mouse.nextAction && ['lever', 'button', 'door'].includes(BLOCKS[target.id]?.spark)) {
    survival.stopMining();
    spark.interact(target.x, target.y, target.z);
    mouse.nextAction = now + 0.3;
    dirtySave = true;
    return;
  }
  if (robotTarget) return actRobot(now);
  if (mobTarget) return actMob(now);
  if (isSurvival()) return actSurvival(now, dt);
  if (!target || now < mouse.nextAction) return;
  // Every creative action is one undo step.
  history.begin();
  actCreative(now);
  history.commit();
}

/** Finding a Hidden Star: big celebration instead of breaking it. */
function foundStar(now) {
  mouse.nextAction = now + 0.8;
  mouse.left = mouse.right = false;
  survival.stopMining();
  const { x, y, z } = target;
  world.setBlock(x, y, z, B.AIR);
  world.flushDirty();
  for (const tile of [TILE.STAR, TILE.WOOL_RED, TILE.WOOL_BLUE, TILE.WOOL_YELLOW, TILE.WOOL_GREEN]) particles.burst(x, y, z, tile);
  sfx.fanfare?.(); sfx.yay?.();
  hint('⭐ You found the Hidden Star! ⭐', 3500);
  if (isSurvival()) { inv.add(B.STAR, 1); renderHotbar(); }
  quests.emit('star', {});
  dirtySave = true;
}

/** Catch a firefly: it goes into a glowing lantern block (survival) with a sparkle. */
function catchFirefly(now) {
  mouse.nextAction = now + 0.4;
  survival.stopMining();
  critters.catchFirefly(fireflyTarget);
  const p = fireflyTarget.pos;
  particles.burst(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), BLOCKS[B.LANTERN].side);
  fireflyTarget = null;
  sfx.sparkle();
  if (isSurvival()) { inv.add(B.LANTERN, 1); renderHotbar(); toast('You caught a firefly! +1 Firefly Lantern'); }
  else toast('You caught a firefly! ✨');
  quests.emit('firefly', {});
  dirtySave = true;
}

// ---------- power tools (creative) ----------
const tool = { block: B.STONE, anchor: null, erase: false, rainbow: 0 };
const RAINBOW = [B.WOOL_RED, B.NEON_PINK, B.WOOL_YELLOW, B.NEON_LIME, B.WOOL_GREEN, B.NEON_CYAN, B.WOOL_BLUE, B.NEON_PURPLE];
const cellOf = (t, erase) => (erase ? [t.x, t.y, t.z] : [t.x + t.normal[0], t.y + t.normal[1], t.z + t.normal[2]]);

/** Returns true if the held tool handled the click. */
function useTool(def, now) {
  if (def.paint) {
    if (!mouse.right) return false;
    const { x, y, z, id } = target;
    if (id === B.BEDROCK || BLOCKS[id]?.shape) return true;
    const paint = def.paint === 'rainbow' ? RAINBOW[tool.rainbow++ % RAINBOW.length] : tool.block;
    if (paint !== id && world.setBlock(x, y, z, paint)) { world.flushDirty(); sfx.place(paint); quests.emit('tool', { kind: 'paint' }); }
    mouse.nextAction = now + 0.12;
    return true;
  }
  const erase = mouse.left;
  const point = cellOf(target, erase);
  mouse.nextAction = now + 0.3;
  if (!tool.anchor || tool.erase !== erase) {
    tool.anchor = point; tool.erase = erase;
    sfx.tone(660, 0.08, 'triangle', 0.15);
    hint(erase ? 'Now left-click the other corner to erase' : `Now right-click the end point (${def.shape === 'sphere' ? 'distance = size' : 'corner'})`, 2500);
    return true;
  }
  let cells = SHAPES[def.shape](tool.anchor, point);
  tool.anchor = null;
  if (!cells || cells.length > MAX_CELLS) { toast(`Too big! Try a smaller shape (max ${MAX_CELLS} blocks)`); return true; }
  let changed = 0;
  for (const [x, y, z] of cells) {
    if (y < 1 || y >= 95) continue;
    const there = world.getBlock(x, y, z);
    if (there === B.BEDROCK) continue;
    if (erase) { if (there !== B.AIR && world.setBlock(x, y, z, B.AIR)) changed++; continue; }
    if (there !== B.AIR && there !== B.WATER) continue;      // build into empty space only
    if (SOLID[tool.block] && player.intersectsBlock(x, y, z)) continue;
    if (world.setBlock(x, y, z, tool.block)) changed++;
  }
  world.flushDirty();
  if (changed) { sfx.craft(); toast(`${erase ? 'Erased' : 'Built'} ${changed} blocks · Z to undo`); quests.emit('tool', { kind: def.shape }); }
  return true;
}

function undoRedo(redo) {
  if (isSurvival()) { toast('Undo works in Creative mode'); return; }
  const n = redo ? history.redo((x, y, z, id) => world.setBlock(x, y, z, id)) : history.undo((x, y, z, id) => world.setBlock(x, y, z, id));
  world.flushDirty();
  if (n) { toast(`${redo ? 'Redid' : 'Undid'} ${n} block${n === 1 ? '' : 's'}`); sfx.tone(redo ? 700 : 500, 0.1, 'triangle', 0.15); if (!redo) quests.emit('undo', {}); dirtySave = true; }
  else toast(redo ? 'Nothing to redo' : 'Nothing to undo');
}

function actCreative(now) {
  const heldDef = ITEMS.get(creativeBar[selected]);
  if ((heldDef?.shape || heldDef?.paint) && (mouse.left || mouse.right)) { useTool(heldDef, now); dirtySave = true; return; }
  if (mouse.left) {
    const { x, y, z, id } = target;
    if (id === B.BEDROCK) return;
    removeBlock(x, y, z);
    particles.burst(x, y, z, BLOCKS[id].side);
    sfx.dig(id);
    quests.emit('mine', { id });
    if (id === B.WHEAT_3) quests.emit('harvest', {});
    mouse.nextAction = now + ACTION_REPEAT;
  } else if (mouse.right) {
    const held = creativeBar[selected];
    const def = ITEMS.get(held);
    if (useGardenItem(held)) { /* hoe, seeds or watering can */ }
    else if (held === I.ROBOT) placeRobot();
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
  insights.step('placed Bit');
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
/** Play Together guest: animals live on the host, so ask the host (and show something right away). */
function guestMobAction(mob, held) {
  const ask = (act, extra = {}) => together.send({ k: 'mob', id: mob.id, act, ...extra });
  if (mob.type === 'villager') { if (mouse.right) { mouse.right = false; openTrade(mob); } else { mobs.effect(mob, mobs.happyMat); ask('pat'); } return; }
  if (mouse.left) { mobs.effect(mob, mobs.happyMat); mobs.voice(mob); ask('pat'); quests.emit('pat', { type: mob.type }); return; }
  const acc = ITEMS.get(held)?.accessory;
  if (mob.tamed && acc) { ask('wear', { acc }); if (isSurvival()) { inv.takeFromSlot(selected, 1); renderHotbar(); } quests.emit('accessory', { kind: acc }); return; }
  const pg = ITEMS.get(held);
  if (mob.tamed && (pg?.petArmor || pg?.petBackpack)) { ask('gear', { acc: held }); if (isSurvival()) { inv.takeFromSlot(selected, 1); renderHotbar(); } quests.emit('petgear', { kind: pg.petArmor ? 'armor' : 'backpack' }); return; }
  if (mob.tamed && held !== I.APPLE) { ask('sit'); return; }
  if (held === I.APPLE) { ask('feed'); mobs.effect(mob, mobs.heartMat); if (isSurvival()) { inv.takeFromSlot(selected, 1); renderHotbar(); } return; }
  if (mob.type === 'sheep' && !mob.sheared) { ask('shear'); quests.emit('shear', {}); }
}

function actMob(now) {
  survival.stopMining();
  if (now < mouse.nextAction || !(mouse.left || mouse.right)) return;
  const mob = mobTarget;
  const held = heldItem();
  mouse.nextAction = now + 0.45;
  if (mob.hostile) { if (mouse.left) attackMob(mob, now); return; }
  if (together.isGuest) { guestMobAction(mob, held); return; }
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
  const acc = ITEMS.get(held)?.accessory;
  if (mob.tamed && acc) {
    if (mobs.wear(mob, acc)) {
      if (isSurvival()) { inv.takeFromSlot(selected, 1); renderHotbar(); }
      toast(`${mob.petName} looks amazing!`);
      quests.emit('accessory', { kind: acc });
      dirtySave = true;
    }
    return;
  }
  const gear = ITEMS.get(held);
  if (mob.tamed && gear?.petArmor) {
    const prev = mobs.wearArmor(mob, held);
    if (isSurvival()) { inv.takeFromSlot(selected, 1); if (prev) inv.add(prev, 1); renderHotbar(); }
    toast(`${mob.petName} looks tough! 🛡️`);
    quests.emit('petgear', { kind: 'armor' });
    tip('petgear', 'Right-click a pet that wears armor or a backpack to open its panel.');
    dirtySave = true;
    return;
  }
  if (mob.tamed && gear?.petBackpack) {
    if (mob.bag) { toast(`${mob.petName} already has a backpack`); return; }
    mobs.setBackpack(mob, true);
    if (isSurvival()) { inv.takeFromSlot(selected, 1); renderHotbar(); }
    toast(`${mob.petName} can carry things for you now! 🎒`);
    quests.emit('petgear', { kind: 'backpack' });
    tip('petgear', 'Right-click a pet that wears armor or a backpack to open its panel.');
    dirtySave = true;
    return;
  }
  if (mob.tamed && held !== I.APPLE && (mob.bag || mob.armor)) { openPetPanel(mob); return; }
  if (mob.tamed && held !== I.APPLE) {
    const sits = mobs.toggleSit(mob);
    toast(sitMessage(mob, sits));
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
    if (isAdventure() ? survival.eat(ITEMS.get(held).food) : survival.heal(ITEMS.get(held).food)) {
      if (isAdventure() && survival.hunger <= MAX_HUNGER / 2 + ITEMS.get(held).food) quests.emit('feast', {});
      inv.takeFromSlot(selected, 1);
      sfx.eat(); renderHotbar(); dirtySave = true;
      quests.emit('eat', {});
    } else toast(isAdventure() ? "You're not hungry right now" : 'Your hearts are already full');
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
      survival.exhaust(0.03);
      if (info.canHarvest) {
        gainXp((MINING_XP[id] || 0) + (id === B.WHEAT_3 ? 1 : 0));
        const drop = dropFor(id);
        if (drop != null) {
          const left = inv.add(drop, 1);
          if (id === B.WHEAT_3) { inv.add(I.SEEDS, 1 + Math.floor(Math.random() * 2)); quests.emit('harvest', {}); }
          if (left) toast('Your inventory is full!');
          else { sfx.pop(); toast(`+1 ${itemName(drop)}`); quests.emit('collect', { id: drop }); }
          renderHotbar();
          if (drop === B.LOG) tip('wood', 'Great! Press E and turn your logs into planks.');
          if (drop === I.COAL) tip('coal', 'Coal! Use it to make lamps and bricks.');
        }
      } else if (info.hint) hint(info.hint, 3000);
      dirtySave = true;
    }
  } else if (mouse.right && now >= mouse.nextAction && (ITEMS.get(held)?.bow || ITEMS.get(held)?.shield)) {
    survival.stopMining(); // bow and shield are handled by updateBow / blocking
  } else if (mouse.right && now >= mouse.nextAction && ITEMS.get(held)?.armor) {
    survival.stopMining();
    if (!isAdventure()) { toast('Armour is for Adventure mode'); mouse.nextAction = now + 1; return; }
    const old = adv.armor;
    adv.armor = held; inv.takeFromSlot(selected, 1);
    if (old) inv.add(old, 1);
    renderHotbar(); renderStatus(); sfx.craft();
    toast(`Wearing ${itemName(held)}`);
    quests.emit('armor', {});
    dirtySave = true;
    mouse.nextAction = now + 0.5;
  } else if (mouse.right && now >= mouse.nextAction) {
    survival.stopMining();
    const garden = useGardenItem(held);
    if (garden) {
      if (garden === 'consume') { inv.takeFromSlot(selected, 1); renderHotbar(); }
      dirtySave = true;
    } else if (held === I.ROBOT) {
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

// ---------- Phase 1 fun blocks: step effects ----------
const fun = { lastStep: '', bounceY: null, peak: 0, confettiAt: 0 };
function attachFunHooks() {
  player.onBounce = () => {
    sfx.boing();
    if (fun.bounceY === null) { fun.bounceY = player.pos.y; fun.peak = player.pos.y; }
  };
}

// ---------- portals ----------
const portalState = { cooldown: 0, lastKey: '', hintAt: 0 };

/** All placed portals of one colour (portals only ever come from player edits). */
function findPortals(id) {
  const out = [];
  for (const [ck, m] of world.edits) {
    const [cx, cz] = ck.split(',').map(Number);
    for (const [i, bid] of m) {
      if (bid !== id) continue;
      const x = i % CS, z = Math.floor(i / CS) % CS, y = Math.floor(i / (CS * CS));
      out.push([cx * CS + x, y, cz * CS + z]);
    }
  }
  return out;
}

function checkPortals(dt) {
  portalState.cooldown = Math.max(0, portalState.cooldown - dt);
  const x = Math.floor(player.pos.x), z = Math.floor(player.pos.z);
  let cell = null;
  for (const dy of [0.1, 1.0]) {
    const y = Math.floor(player.pos.y + dy);
    if (BLOCKS[world.getBlock(x, y, z)]?.portal) { cell = [x, y, z]; break; }
  }
  const key = cell ? cell.join(',') : '';
  if (!cell) { portalState.lastKey = ''; return; }
  if (key === portalState.lastKey || portalState.cooldown > 0) return;
  const id = world.getBlock(...cell);
  const others = findPortals(id).filter((p) => p.join(',') !== key);
  if (!others.length) {
    if (simTime > portalState.hintAt) { hint(`Place a second ${BLOCKS[id].name} to link them!`, 2500); portalState.hintAt = simTime + 4; }
    portalState.lastKey = key;
    return;
  }
  const [tx, ty, tz] = others[others.length - 1]; // the newest other portal of this colour
  player.pos.set(tx + 0.5, ty, tz + 0.5);
  player.vel.set(0, 0, 0);
  player.fallStart = null;
  portalState.lastKey = `${tx},${ty},${tz}`;
  portalState.cooldown = 1;
  particles.burst(tx, ty, tz, BLOCKS[id].side);
  sfx.tone(300, 0.35, 'sine', 0.2, 600);
  quests.emit('portal', {});
}

/** Music stones, confetti pads and bounce-height tracking. */
function funBlocks(dt) {
  checkPortals(dt);
  // Bounce height for the "Boing Boing!" quest (measured from the trampoline top).
  if (fun.bounceY !== null) {
    fun.peak = Math.max(fun.peak, player.pos.y);
    if (player.onGround) {
      quests.emit('bounce', fun.peak - fun.bounceY);
      fun.bounceY = null;
    }
  }
  if (!player.onGround) { fun.lastStep = ''; return; }
  const x = Math.floor(player.pos.x), y = Math.floor(player.pos.y - 0.05), z = Math.floor(player.pos.z);
  const key = `${x},${y},${z}`;
  if (key === fun.lastStep) return;
  fun.lastStep = key;
  const b = BLOCKS[world.getBlock(x, y, z)];
  if (!b) return;
  if (b.note !== undefined) {
    sfx.note(b.note);
    particles.burst(x, y + 0.6, z, b.side);
    quests.emit('note', { note: b.note });
  } else if (b.confetti && simTime > fun.confettiAt) {
    fun.confettiAt = simTime + 0.8;
    for (const tile of [TILE.WOOL_RED, TILE.WOOL_BLUE, TILE.WOOL_YELLOW, TILE.WOOL_GREEN, TILE.WOOL_WHITE]) particles.burst(x, y + 1, z, tile);
    sfx.yay();
    quests.emit('confetti', {});
  } else if (b.speed) sfx.whoosh();
}

/** Feeds movement-based quests (walk, swim, jump, height, night) without spamming the UI. */
function trackMovement(dt, input, wasOnGround, dist) {
  if (player.inWater) moveAcc.swim += dist;
  else if (!player.flying) moveAcc.walk += dist;
  if (input.jump && wasOnGround && !player.onGround && player.vel.y > 0 && player.vel.y < 10 && !player.inWater && !player.flying) { quests.emit('jump', {}); sfx.whoosh(); survival.exhaust(input.sprint ? 0.2 : 0.05); }
  if (!player.flying) survival.exhaust(dist * (input.sprint ? 0.1 : 0.01));
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
  // Ask for the next frame first, so one error can never stop the whole game.
  if (!manual) requestAnimationFrame(frame);
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
    input.glide = input.jump && ITEMS.get(heldItem())?.glider;
    const wasFlying = player.flying;
    const wasOnGround = player.onGround, px0 = player.pos.x, pz0 = player.pos.z;
    player.update(dt, input);
    trackMovement(dt, input, wasOnGround, Math.hypot(player.pos.x - px0, player.pos.z - pz0));
    funBlocks(dt);
    tickCrops(dt);
    if (wasFlying !== player.flying) updateModeBadge();
    if (player.pos.y < -20) { spawn(); toast('You fell out of the world'); }
    if (isSurvival() && !adv.over) {
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
    const fh = critters.fireflies.length ? critters.raycastFirefly(camera.position, lookDir, reach) : null;
    fireflyTarget = fh && (!target || fh.dist < target.dist) ? fh.fly : null;
  } else fireflyTarget = null;
  // Power-tool preview: anchor corner plus the shape's bounding box.
  const toolDef = state === 'playing' && !isSurvival() ? ITEMS.get(creativeBar[selected]) : null;
  if (tool.anchor && toolDef?.shape) {
    if (target) { const [mn, mx] = previewBounds(toolDef.shape, tool.anchor, cellOf(target, tool.erase)); toolPreview.show(tool.anchor, mn, mx, tool.erase); }
    else toolPreview.show(tool.anchor);
  } else toolPreview.hide();
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

  mobs.hostileEnabled = isAdventure() && !adv.over;
  mobs.isDay = !isNight();
  mobs.maxHostile = settings.monsters === 'easy' ? 4 : 8;
  player.blocking = state === 'playing' && isAdventure() && mouse.right && !!ITEMS.get(heldItem())?.shield;
  spark.passive = together.isGuest; // the host runs the circuits; guests see the results
  if (state === 'playing') { updateBow(simTime); projectiles.update(dt); if (!together.isGuest) spark.update(dt); course.update(); }
  if (course.run) $('course-time').textContent = fmtTime(simTime - course.run.t0);
  together.update(dt);
  mobs.update(dt, player, light, state === 'playing' || (state === 'menu' && !hasPlayed));
  critters.update(dt, player, light, timeOfDay > 0.55 && timeOfDay < 0.95, state === 'playing' || (state === 'menu' && !hasPlayed));
  robot.update(dt, light);
  particles.update(dt, light);
  renderer.render(scene, camera);

  insights.beat(now);
  frames++;
  if (now - fpsTime > 500) { fps = Math.round(frames * 1000 / (now - fpsTime)); frames = 0; fpsTime = now; updateDebug(pending); }
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

// Someone sent a share link? Offer to add it as a NEW world (never overwrites anything).
if (location.hash.startsWith('#w=')) {
  readSharedFromHash(location.hash).then((shared) => {
    window.history.replaceState(null, '', location.pathname + location.search); // (not our undo 'history')
    if (!shared) return;
    if (!confirm(`Someone shared a world with you: "${shared.name}". Add it to My worlds?`)) return;
    const w = worlds.add({ name: `${shared.name} (shared)`, seed: shared.seed, mode: shared.mode });
    worlds.save(w.id, { seed: shared.seed, edits: shared.edits, mode: shared.mode });
    openWorld(w.id);
    toast(`Added "${w.name}" to My worlds`);
  }).catch(() => {
    window.history.replaceState(null, '', location.pathname + location.search); // (not our undo 'history')
    alert('Sorry, that share link could not be opened. It may be broken or cut off.');
  });
}
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
  // The saved copy starts first, so right after an update this page is still the old version.
  // When the new version takes over, switch to it if nothing would be lost (still on the start
  // menu with no panel open); otherwise it loads next time.
  const hadVersion = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadVersion) return; // first visit: this page is already the newest version
    const busy = hasPlayed || state !== 'menu' || document.querySelector('.overlay:not(.hidden):not(#menu)') || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (busy) toast('✨ A new version of MiniCrafter is ready. It loads next time you open the game.');
    else location.reload();
  });
}
// Roomy screens show the settings straight away; phones keep them folded.
if (matchMedia('(min-width: 720px) and (min-height: 640px)').matches) $('settings-fold').open = true;
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
window.addEventListener('appinstalled', () => { $('btn-install').classList.add('hidden'); $('install-help').classList.add('hidden'); });

// iPhone and iPad never show an install popup (and Android browsers sometimes don't),
// so the install button opens step-by-step "Add to Home Screen" help instead.
const ua = navigator.userAgent;
const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIOS = isIPad || /iPhone|iPod/.test(ua);
const isAndroid = /Android/.test(ua);
const installed = navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
function installSteps() {
  if (isIOS) {
    const inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok/.test(ua);
    if (inApp) return ["This app's built-in browser can't add games to the Home Screen.", 'Tap ••• or the compass icon and choose <b>Open in Safari</b>, then come back to this button.'];
    const other = /CriOS|FxiOS|EdgiOS/.test(ua);
    return [
      `Tap the <b>Share</b> button <span class="share-icon">⬆</span> ${other ? '(in the address bar or the ⋯ menu)' : (isIPad ? 'at the top right' : 'at the bottom of Safari')}.`,
      'Scroll down and tap <b>Add to Home Screen</b> ➕.',
      'Tap <b>Add</b>. The MiniCrafter icon appears on your Home Screen!',
      ...(other ? ['Don\'t see it? Open this page in <b>Safari</b> and try again.'] : []),
    ];
  }
  return [
    'Open your browser menu <b>⋮</b> (top right in Chrome).',
    'Tap <b>Install app</b> or <b>Add to Home screen</b>.',
    'Tap <b>Install</b>. MiniCrafter appears with your other apps!',
  ];
}
if (!installed && (isIOS || isAndroid)) {
  $('install-steps').innerHTML = installSteps().map((t) => `<li>${t}</li>`).join('');
  // On iPhone/iPad show the button at once; on Android give the real install popup a moment first.
  setTimeout(() => { if (!installPrompt) $('btn-install').classList.remove('hidden'); }, isIOS ? 0 : 4000);
}
$('btn-install').addEventListener('click', () => {
  if (installPrompt) return; // the real install popup handles it
  $('install-help').classList.toggle('hidden');
});

// Expose for debugging in the console.
window.minicrafter = {
  get world() { return world; }, get player() { return player; }, get target() { return target; },
  get inv() { return inv; }, adv, projectiles, spark, together, account, course, photo, insights, openPhoto, closePhoto, get state() { return state; }, placeFacing, lightLevel, hurtPlayer, bow, gainXp, isAdventure, createWorld, history, tool, undoRedo, crops, waterAt, critters, findPortals, get fireflyTarget() { return fireflyTarget; }, worlds, get currentWorldId() { return currentWorldId; }, openWorld, get mobTarget() { return mobTarget; }, openPetPanel, get robotTarget() { return robotTarget; }, survival, mobs, quests, robot, robotUI, keys, mouse, save, setMode,
  select: (i) => select(i),
  openOverlay: () => openOverlay(),
  /** Dev/test helper: enter play mode without pointer lock (for automated testing). */
  forcePlay() {
    state = 'playing'; hasPlayed = true;
    $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
    $('craft').classList.add('hidden'); $('inventory').classList.add('hidden'); $('pet').classList.add('hidden');
    touch?.setEnabled(true);
  },
  setTime(t) { timeOfDay = t; },
  /** Dev/test helper: advance the game by n frames of `ms` each (works when rAF is paused). */
  step(n = 1, ms = 16) {
    for (let i = 0; i < n; i++) { last = performance.now() - ms; frame(performance.now(), true); }
  },
};
