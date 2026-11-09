import * as THREE from 'three';
import { B, BLOCKS, PLACEABLE, SOLID } from './blocks.js';
import { createAtlas, blockIcon } from './textures.js';
import { World, CS, SEA } from './world.js';
import { Player, EYE } from './player.js';
import { hashString } from './noise.js';
import { Sky } from './sky.js';
import { Sfx } from './audio.js';
import { Particles } from './particles.js';

const SAVE_KEY = 'minicrafter:save:v1';
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
  glow: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true }),
};

const sky = new Sky(scene);
const sfx = new Sfx();
const particles = new Particles(scene, atlas.avgColors);

// Block selection outline
const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
);
outline.visible = false;
scene.add(outline);

// ---------- settings ----------
const settings = Object.assign({ renderDistance: 7, sensitivity: 1, fov: 75 }, store.get(SETTINGS_KEY) || {});
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
const hotbar = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.LAMP];
let selected = 0;
let dirtySave = false;

function startWorld(seedStr, saved) {
  if (world) world.dispose();
  seedText = seedStr;
  world = new World(scene, hashString(seedStr), materials);
  world.onEdit = () => { dirtySave = true; };
  player = new Player(world);
  if (saved) {
    world.loadEdits(saved.edits);
    if (Array.isArray(saved.hotbar) && saved.hotbar.length === 9) saved.hotbar.forEach((id, i) => { if (BLOCKS[id]?.placeable) hotbar[i] = id; });
    selected = saved.selected | 0;
    timeOfDay = saved.time ?? timeOfDay;
    const p = saved.player;
    if (p && Number.isFinite(p.x)) {
      player.pos.set(p.x, p.y, p.z);
      player.yaw = p.yaw || 0; player.pitch = p.pitch || 0; player.flying = !!p.flying;
      if (player.collides()) player.spawnAt(p.x, p.z);
    } else spawn();
  } else {
    timeOfDay = 0.08;
    spawn();
  }
  $('seed').value = seedStr;
  $('world-info').textContent = `Seed: ${seedStr}`;
  renderHotbar();
  updateModeBadge();
}

function spawn() {
  // Look for dry land near the origin.
  const T = world.terrain;
  for (let r = 0; r < 400; r += 4) {
    for (let a = 0; a < 8; a++) {
      const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r);
      const { h } = T.column(x, z);
      if (h > SEA + 1 && h < SEA + 25) { player.spawnAt(x, z); return; }
    }
  }
  player.spawnAt(0, 0);
}

function save() {
  if (!world) return;
  const ok = store.set(SAVE_KEY, {
    seed: seedText,
    edits: world.serializeEdits(),
    player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, flying: player.flying },
    hotbar, selected, time: timeOfDay,
  });
  if (ok) dirtySave = false;
}
setInterval(() => { if (dirtySave || state === 'playing') save(); }, 5000);
window.addEventListener('pagehide', save);
window.addEventListener('beforeunload', save);

// ---------- UI: hotbar & inventory ----------
const iconCache = new Map();
const icon = (id) => {
  if (!iconCache.has(id)) iconCache.set(id, blockIcon(atlas.canvas, BLOCKS[id]));
  return iconCache.get(id);
};

function renderHotbar() {
  const el = $('hotbar');
  el.innerHTML = '';
  hotbar.forEach((id, i) => {
    const s = document.createElement('div');
    s.className = 'slot' + (i === selected ? ' active' : '');
    s.innerHTML = `<span class="num">${i + 1}</span><img alt="${BLOCKS[id].name}" src="${icon(id)}">`;
    el.appendChild(s);
  });
}

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1200);
}

function select(i) {
  selected = (i + 9) % 9;
  renderHotbar();
  toast(BLOCKS[hotbar[selected]].name);
}

function buildInventory() {
  const grid = $('inv-grid');
  grid.innerHTML = '';
  for (const id of PLACEABLE) {
    const b = document.createElement('button');
    b.className = 'inv-item';
    b.innerHTML = `<img alt="" src="${icon(id)}"><span>${BLOCKS[id].name}</span>`;
    b.addEventListener('click', () => {
      hotbar[selected] = id;
      renderHotbar();
      dirtySave = true;
      closeInventory(true);
    });
    grid.appendChild(b);
  }
}

// ---------- game state & pointer lock ----------
let state = 'menu'; // 'menu' | 'playing' | 'inventory'
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

function showMenu() {
  state = 'menu';
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('inventory').classList.add('hidden');
  keys.clear(); mouse.left = mouse.right = false;
  save();
}

function openInventory() {
  state = 'inventory';
  $('inv-slot').textContent = selected + 1;
  $('inventory').classList.remove('hidden');
  keys.clear(); mouse.left = mouse.right = false;
  document.exitPointerLock();
}

function closeInventory(relock) {
  $('inventory').classList.add('hidden');
  if (relock) { state = 'locking'; lock(); } else showMenu();
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    state = 'playing';
    hasPlayed = true;
    $('menu').classList.add('hidden');
    $('inventory').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('lock-note').textContent = '';
    sfx.resume();
  } else if (state === 'playing' || state === 'locking') {
    showMenu();
  }
});
document.addEventListener('pointerlockerror', () => {
  if (state !== 'locking') return;
  showMenu();
  $('lock-note').textContent = 'Could not capture the mouse — wait a second and click Play again.';
});

$('btn-play').addEventListener('click', () => { state = 'locking'; lock(); });
$('btn-new').addEventListener('click', () => {
  const s = $('seed').value.trim() || String(Math.floor(Math.random() * 1e9));
  if (world && world.edits.size && !confirm('Start a new world? Your current world will be replaced.')) return;
  store.set(SAVE_KEY, null);
  startWorld(s, null);
  save();
  loadingShown = true;
});

// ---------- input ----------
document.addEventListener('keydown', (e) => {
  if (state === 'inventory') {
    if (e.code === 'KeyE') closeInventory(true);
    else if (e.code === 'Escape') closeInventory(false);
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'F3') { e.preventDefault(); $('debug').classList.toggle('hidden'); return; }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) select(n - 1); }
  if (e.code === 'KeyF') { player.flying = !player.flying; player.vel.y = 0; updateModeBadge(); toast(player.flying ? 'Flying on' : 'Flying off'); }
  if (e.code === 'KeyE') openInventory();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); mouse.left = mouse.right = false; });

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
  if (e.button === 0) mouse.left = false;
  if (e.button === 2) mouse.right = false;
});
document.addEventListener('wheel', (e) => {
  if (state !== 'playing') return;
  select(selected + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());

function updateModeBadge() { $('mode-badge').classList.toggle('hidden', !player?.flying); }

// ---------- interaction ----------
let target = null;
const lookDir = new THREE.Vector3();

function pickBlock() {
  if (!target || !BLOCKS[target.id].placeable) return;
  const at = hotbar.indexOf(target.id);
  if (at >= 0) select(at);
  else { hotbar[selected] = target.id; renderHotbar(); toast(BLOCKS[target.id].name); }
}

function act(now) {
  if (!target || now < mouse.nextAction) return;
  if (mouse.left) {
    const { x, y, z, id } = target;
    if (id === B.BEDROCK) return;
    // Breaking a block next to water lets water flow in (simple, one step).
    const waterNear = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]
      .some(([dx, dy, dz]) => world.getBlock(x + dx, y + dy, z + dz) === B.WATER);
    world.setBlock(x, y, z, waterNear && y <= SEA ? B.WATER : B.AIR);
    world.flushDirty();
    particles.burst(x, y, z, BLOCKS[id].side);
    sfx.dig(id);
    mouse.nextAction = now + ACTION_REPEAT;
  } else if (mouse.right) {
    const id = hotbar[selected];
    const px = target.x + target.normal[0], py = target.y + target.normal[1], pz = target.z + target.normal[2];
    const there = world.getBlock(px, py, pz);
    if (there !== B.AIR && there !== B.WATER) return;
    if (SOLID[id] && player.intersectsBlock(px, py, pz)) return;
    if (world.setBlock(px, py, pz, id)) {
      world.flushDirty();
      sfx.place(id);
    }
    mouse.nextAction = now + ACTION_REPEAT;
  }
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
    `MiniCrafter  ${fps} fps`,
    `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
    `Chunk: ${Math.floor(p.x / CS)}, ${Math.floor(p.z / CS)}   loaded: ${world.chunks.size}  queued: ${pending}`,
    `Facing: ${facing}   Biome: ${col.desert ? 'desert' : col.h > SEA + 26 ? 'mountains' : world.terrain.forest(p.x, p.z) > 0.12 ? 'forest' : 'plains'}`,
    `Time: ${(((timeOfDay * 24) + 6) % 24).toFixed(1)}h   Seed: ${seedText}`,
    `Target: ${target ? `${BLOCKS[target.id].name} @ ${target.x}, ${target.y}, ${target.z}` : '-'}`,
    `Draw calls: ${renderer.info.render.calls}  Tris: ${renderer.info.render.triangles}`,
  ].join('\n');
}

// ---------- main loop ----------
let last = performance.now();
let loadingShown = true;
let hasPlayed = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state === 'playing') {
    const input = {
      forward: +(keys.has('KeyW') || keys.has('ArrowUp')),
      back: +(keys.has('KeyS') || keys.has('ArrowDown')),
      left: +(keys.has('KeyA') || keys.has('ArrowLeft')),
      right: +(keys.has('KeyD') || keys.has('ArrowRight')),
      jump: +keys.has('Space'),
      down: +(keys.has('ShiftLeft') || keys.has('ShiftRight')),
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    };
    if (player.flying) input.sprint = false; // Shift descends while flying
    const wasFlying = player.flying;
    player.update(dt, input);
    if (wasFlying !== player.flying) updateModeBadge();
    if (player.pos.y < -20) { spawn(); toast('You fell out of the world'); }
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
  target = state === 'playing' ? world.raycast(camera.position, lookDir, REACH) : null;
  if (target) { outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5); outline.visible = true; }
  else outline.visible = false;
  if (state === 'playing') act(now / 1000);

  // Sky, fog, light level
  const viewDist = settings.renderDistance * CS;
  const light = sky.update(timeOfDay, camera, dt);
  materials.solid.color.setScalar(light);
  materials.water.color.setScalar(light);
  if (player.headInWater) {
    scene.fog.color.setRGB(0.1 * light + 0.02, 0.25 * light + 0.04, 0.55 * light + 0.06);
    scene.fog.near = 1; scene.fog.far = 18;
  } else {
    scene.fog.color.copy(sky.color);
    scene.fog.near = viewDist * 0.55; scene.fog.far = viewDist * 0.95;
  }
  scene.background = scene.fog.color;
  $('water-overlay').classList.toggle('hidden', !(player.headInWater && state === 'playing'));

  particles.update(dt, light);
  renderer.render(scene, camera);

  frames++;
  if (now - fpsTime > 500) { fps = Math.round(frames * 1000 / (now - fpsTime)); frames = 0; fpsTime = now; updateDebug(pending); }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- boot ----------
buildInventory();
const saved = store.get(SAVE_KEY);
if (saved && saved.seed != null) startWorld(String(saved.seed), saved);
else startWorld(String(Math.floor(Math.random() * 1e9)), null);
$('btn-play').disabled = true;
requestAnimationFrame(frame);

// Expose for debugging in the console.
window.minicrafter = {
  get world() { return world; }, get player() { return player; }, get target() { return target; },
  keys, mouse, save,
  /** Dev/test helper: enter play mode without pointer lock (for automated testing). */
  forcePlay() {
    state = 'playing'; hasPlayed = true;
    $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  },
  setTime(t) { timeOfDay = t; },
};
