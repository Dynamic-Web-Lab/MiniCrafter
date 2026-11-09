// Friendly animals: pigs, cows, sheep and chickens. They wander, can be
// patted, fed apples (two in love make a baby), and sheep can be sheared.
// Nothing here can hurt the player and animals can't be hurt either.
import * as THREE from 'three';
import { B, SOLID } from './blocks.js';
import { CS } from './world.js';

const MAX_MOBS = 16;
const SPAWN_MIN = 18, SPAWN_MAX = 42;
const DESPAWN_DIST = 96;
const ACTIVE_DIST = 72;
const GRAVITY = 25;
const GROW_TIME = 150;   // seconds for a baby to grow up
const LOVE_TIME = 12;
const REGROW_TIME = 60;  // sheep wool

export const WOOL = [B.WOOL_WHITE, B.WOOL_RED, B.WOOL_BLUE, B.WOOL_YELLOW, B.WOOL_GREEN, B.WOOL_BLACK];
const WOOL_RGB = {
  [B.WOOL_WHITE]: [235, 235, 235], [B.WOOL_RED]: [180, 50, 45], [B.WOOL_BLUE]: [60, 80, 175],
  [B.WOOL_YELLOW]: [235, 200, 60], [B.WOOL_GREEN]: [95, 140, 45], [B.WOOL_BLACK]: [40, 40, 45],
};

export const TYPES = {
  pig: { name: 'Pig', plural: 'Pigs', hw: 0.35, h: 0.85, speed: 1.3 },
  cow: { name: 'Cow', plural: 'Cows', hw: 0.42, h: 1.3, speed: 1.1 },
  sheep: { name: 'Sheep', plural: 'Sheep', hw: 0.4, h: 1.15, speed: 1.15 },
  dog: { name: 'Dog', plural: 'Dogs', hw: 0.3, h: 0.85, speed: 2.4, pet: true },
  cat: { name: 'Cat', plural: 'Cats', hw: 0.25, h: 0.7, speed: 2.6, pet: true },
  chicken: { name: 'Chicken', plural: 'Chickens', hw: 0.2, h: 0.65, speed: 1.4 },
};

// ---------- model building ----------
const SHADE = [0.8, 0.8, 1.0, 0.55, 0.68, 0.68]; // +x -x +y -y +z -z (BoxGeometry face order)
function box(w, h, d, rgb, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = SHADE[Math.floor(i / 4)] ?? 1;
    col[i * 3] = rgb[0] / 255 * s; col[i * 3 + 1] = rgb[1] / 255 * s; col[i * 3 + 2] = rgb[2] / 255 * s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function merge(geos) {
  // Minimal merge (all geometries are indexed BoxGeometries with position/color).
  let vCount = 0, iCount = 0;
  geos.forEach((g) => { vCount += g.attributes.position.count; iCount += g.index.count; });
  const pos = new Float32Array(vCount * 3), col = new Float32Array(vCount * 3), idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3);
    col.set(g.attributes.color.array, vo * 3);
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
    vo += g.attributes.position.count; io += g.index.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

const BLACK = [20, 20, 20], WHITE = [245, 245, 245];

/** Returns { group, head, legs[], wool? } facing +z. */
function buildModel(type, mat, woolColor, sheared) {
  const group = new THREE.Group();
  const legs = [];
  const add = (geo, px = 0, py = 0, pz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); group.add(m); return m; };
  const leg = (w, h, rgb, x, z, top) => { const m = add(box(w, h, w, rgb, 0, -h / 2, 0), x, top, z); legs.push(m); return m; };
  let head, wool = null, tail = null, collar = null;

  if (type === 'pig') {
    const pink = [240, 165, 165];
    add(merge([box(0.6, 0.5, 0.9, pink, 0, 0.6, 0)]));
    for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]]) leg(0.2, 0.35, pink, x, z, 0.35);
    head = add(merge([
      box(0.5, 0.5, 0.45, pink, 0, 0, 0.2),
      box(0.26, 0.18, 0.08, [225, 120, 130], 0, -0.06, 0.46),
      box(0.07, 0.07, 0.02, BLACK, -0.14, 0.1, 0.43), box(0.07, 0.07, 0.02, BLACK, 0.14, 0.1, 0.43),
    ]), 0, 0.75, 0.42);
  } else if (type === 'cow') {
    const brown = [95, 62, 40];
    add(merge([
      box(0.75, 0.7, 1.1, brown, 0, 0.95, 0),
      box(0.76, 0.35, 0.4, WHITE, 0, 1.05, 0.15), box(0.4, 0.3, 0.3, WHITE, 0.2, 0.85, -0.35),
      box(0.25, 0.12, 0.2, [240, 180, 190], 0, 0.6, -0.1),
    ]));
    for (const [x, z] of [[-0.23, 0.38], [0.23, 0.38], [-0.23, -0.38], [0.23, -0.38]]) leg(0.24, 0.6, brown, x, z, 0.6);
    head = add(merge([
      box(0.5, 0.5, 0.4, brown, 0, 0, 0.15),
      box(0.36, 0.2, 0.1, [235, 200, 190], 0, -0.13, 0.38),
      box(0.08, 0.15, 0.08, [230, 225, 210], -0.3, 0.25, 0.1), box(0.08, 0.15, 0.08, [230, 225, 210], 0.3, 0.25, 0.1),
      box(0.08, 0.08, 0.02, BLACK, -0.15, 0.08, 0.36), box(0.08, 0.08, 0.02, BLACK, 0.15, 0.08, 0.36),
    ]), 0, 1.1, 0.6);
  } else if (type === 'sheep') {
    const face = [215, 190, 170], skin = [225, 205, 190];
    add(merge([box(0.5, 0.45, 0.8, skin, 0, 0.75, 0)]));
    wool = add(merge([box(0.72, 0.62, 1.0, WOOL_RGB[woolColor] || WHITE, 0, 0.78, 0)]));
    wool.visible = !sheared;
    for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]]) leg(0.2, 0.5, face, x, z, 0.5);
    head = add(merge([
      box(0.38, 0.42, 0.42, face, 0, 0, 0.18),
      box(0.46, 0.2, 0.3, WOOL_RGB[woolColor] || WHITE, 0, 0.2, 0.12),
      box(0.07, 0.07, 0.02, BLACK, -0.11, 0.03, 0.4), box(0.07, 0.07, 0.02, BLACK, 0.11, 0.03, 0.4),
    ]), 0, 1.0, 0.45);
  } else if (type === 'dog') {
    const fur = [205, 150, 85], dark = [120, 80, 45], cream = [240, 225, 200];
    add(merge([box(0.4, 0.38, 0.8, fur, 0, 0.55, 0), box(0.3, 0.2, 0.3, cream, 0, 0.45, 0.25)]));
    for (const [x, z] of [[-0.12, 0.28], [0.12, 0.28], [-0.12, -0.28], [0.12, -0.28]]) leg(0.14, 0.38, fur, x, z, 0.38);
    head = add(merge([
      box(0.4, 0.38, 0.36, fur, 0, 0, 0.12),
      box(0.22, 0.16, 0.18, cream, 0, -0.08, 0.36), box(0.08, 0.06, 0.04, BLACK, 0, -0.02, 0.46),
      box(0.1, 0.18, 0.08, dark, -0.17, 0.2, 0.05), box(0.1, 0.18, 0.08, dark, 0.17, 0.2, 0.05),
      box(0.06, 0.06, 0.02, BLACK, -0.1, 0.06, 0.31), box(0.06, 0.06, 0.02, BLACK, 0.1, 0.06, 0.31),
    ]), 0, 0.8, 0.42);
    tail = add(box(0.08, 0.08, 0.32, fur, 0, 0, -0.14), 0, 0.68, -0.4);
    tail.rotation.x = -0.6;
    collar = add(box(0.42, 0.08, 0.1, [210, 40, 40], 0, 0, 0), 0, 0.66, 0.36);
  } else if (type === 'cat') {
    const fur = [235, 150, 60], stripe = [190, 100, 35], pink = [240, 150, 160];
    add(merge([box(0.3, 0.28, 0.66, fur, 0, 0.42, 0), box(0.31, 0.06, 0.5, stripe, 0, 0.53, 0)]));
    for (const [x, z] of [[-0.09, 0.24], [0.09, 0.24], [-0.09, -0.24], [0.09, -0.24]]) leg(0.1, 0.28, fur, x, z, 0.28);
    head = add(merge([
      box(0.32, 0.28, 0.28, fur, 0, 0, 0.08),
      box(0.08, 0.1, 0.06, fur, -0.1, 0.18, 0.06), box(0.08, 0.1, 0.06, fur, 0.1, 0.18, 0.06),
      box(0.06, 0.04, 0.02, pink, 0, -0.04, 0.23),
      box(0.06, 0.07, 0.02, [90, 200, 90], -0.08, 0.04, 0.225), box(0.06, 0.07, 0.02, [90, 200, 90], 0.08, 0.04, 0.225),
    ]), 0, 0.62, 0.36);
    tail = add(box(0.06, 0.06, 0.4, fur, 0, 0, -0.2), 0, 0.5, -0.32);
    tail.rotation.x = -1.0;
    collar = add(box(0.33, 0.06, 0.08, [210, 40, 40], 0, 0, 0), 0, 0.5, 0.3);
  } else {
    const yellow = [235, 175, 40];
    add(merge([
      box(0.35, 0.35, 0.45, WHITE, 0, 0.45, 0),
      box(0.06, 0.25, 0.3, [230, 230, 230], -0.2, 0.47, 0), box(0.06, 0.25, 0.3, [230, 230, 230], 0.2, 0.47, 0),
    ]));
    for (const x of [-0.08, 0.08]) leg(0.06, 0.28, yellow, x, 0, 0.28);
    head = add(merge([
      box(0.24, 0.32, 0.2, WHITE, 0, 0, 0),
      box(0.12, 0.08, 0.12, [240, 150, 40], 0, -0.02, 0.15),
      box(0.06, 0.1, 0.05, [210, 40, 40], 0, -0.12, 0.12),
      box(0.05, 0.05, 0.02, BLACK, -0.08, 0.07, 0.1), box(0.05, 0.05, 0.02, BLACK, 0.08, 0.07, 0.1),
    ]), 0, 0.72, 0.22);
  }
  if (collar) collar.visible = false;
  return { group, head, legs, wool, tail, collar };
}

// ---------- hearts / effect sprites ----------
function heartTexture(rgb) {
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const ctx = c.getContext('2d');
  const rows = ['.##.##..', '#######.', '#######.', '.#####..', '..###...', '...#....'];
  ctx.fillStyle = `rgb(${rgb.join(',')})`;
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x, y + 1, 1, 1); }));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

function nameTag(text) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = 'bold 30px system-ui, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w; c.height = 44;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, 44, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, 23);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(w / 44 * 0.32, 0.32, 1);
  return s;
}

export const PET_NAMES = ['Biscuit', 'Luna', 'Pepper', 'Max', 'Coco', 'Milo', 'Daisy', 'Ziggy', 'Mochi', 'Bean', 'Nala', 'Pip', 'Sunny', 'Toby', 'Waffles', 'Peanut', 'Cookie', 'Rex', 'Misty', 'Buttons'];

// ---------- the herd ----------
export class Mobs {
  constructor(scene, sfx) {
    this.scene = scene;
    this.sfx = sfx;
    this.list = [];
    this.world = null;
    this.spawnTimer = 0;
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.effects = [];
    this.heartMat = new THREE.SpriteMaterial({ map: heartTexture([235, 50, 60]), transparent: true, depthWrite: false });
    this.happyMat = new THREE.SpriteMaterial({ map: heartTexture([120, 220, 90]), transparent: true, depthWrite: false });
    this.onBaby = null; // (mob)
  }

  reset(world) {
    for (const m of this.list) this.scene.remove(m.group);
    this.list = [];
    this.world = world;
    this.spawnTimer = 0;
  }

  // ---------- creation ----------
  spawn(type, x, y, z, opts = {}) {
    if (!TYPES[type]) return null;
    const woolColor = opts.woolColor ?? (type === 'sheep' ? pickWool() : null);
    const model = buildModel(type, this.mat, woolColor, !!opts.sheared);
    const mob = {
      type, ...model,
      pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(),
      yaw: opts.yaw ?? Math.random() * Math.PI * 2, targetYaw: 0,
      walking: false, timer: Math.random() * 3, onGround: false, phase: 0,
      baby: !!opts.baby, age: opts.age ?? 0, love: 0, loveCooldown: 0,
      sheared: !!opts.sheared, regrow: opts.regrow ?? 0, woolColor,
      kept: !!opts.kept, // bred, fed or spawned by the player: never despawns
      soundTimer: 4 + Math.random() * 10, hop: 0,
      tamed: false, sitting: !!opts.sitting, petName: null, tag: null, wag: 0,
    };
    mob.targetYaw = mob.yaw;
    if (opts.tamed) this.tame(mob, opts.petName);
    this.applyScale(mob);
    this.scene.add(mob.group);
    this.list.push(mob);
    return mob;
  }

  applyScale(mob) {
    const s = mob.baby ? 0.55 : 1;
    mob.group.scale.setScalar(s);
    mob.head.scale.setScalar(mob.baby ? 1.35 : 1); // big-headed babies are cuter
  }

  size(mob) {
    const t = TYPES[mob.type], s = mob.baby ? 0.55 : 1;
    return { hw: t.hw * s, h: t.h * s };
  }

  remove(mob) {
    this.scene.remove(mob.group);
    mob.group.traverse((o) => o.geometry?.dispose());
    this.list.splice(this.list.indexOf(mob), 1);
  }

  // ---------- physics ----------
  collides(mob, pos = mob.pos) {
    const { hw, h } = this.size(mob);
    const W = this.world;
    for (let y = Math.floor(pos.y); y <= Math.floor(pos.y + h - 1e-3); y++)
      for (let z = Math.floor(pos.z - hw); z <= Math.floor(pos.z + hw - 1e-3); z++)
        for (let x = Math.floor(pos.x - hw); x <= Math.floor(pos.x + hw - 1e-3); x++)
          if (SOLID[W.getBlock(x, y, z)]) return true;
    return false;
  }

  move(mob, axis, amt) {
    if (!amt) return false;
    const prev = mob.pos[axis];
    mob.pos[axis] += amt;
    if (!this.collides(mob)) return false;
    mob.pos[axis] = prev;
    if (axis === 'y') { if (amt < 0) mob.onGround = true; mob.vel.y = 0; }
    return true;
  }

  isLoaded(x, z) {
    const c = this.world.chunks.get(Math.floor(x / CS) + ',' + Math.floor(z / CS));
    return c && c.meshed;
  }

  // ---------- update ----------
  update(dt, player, light, allowSpawn) {
    if (!this.world) return;
    this.mat.color.setScalar(light);
    const W = this.world;

    // Spawning and despawning around the player
    this.spawnTimer -= dt;
    if (allowSpawn && this.spawnTimer <= 0) {
      this.spawnTimer = 3;
      if (this.list.length < MAX_MOBS) this.trySpawnHerd(player.pos);
    }
    for (const mob of [...this.list]) {
      const d = Math.hypot(mob.pos.x - player.pos.x, mob.pos.z - player.pos.z);
      if (d > DESPAWN_DIST && !mob.kept) this.remove(mob);
    }

    for (const mob of this.list) {
      const d = Math.hypot(mob.pos.x - player.pos.x, mob.pos.z - player.pos.z);
      if (mob.tamed && !mob.sitting && d > 20) this.teleportToPlayer(mob, player);
      if (d > ACTIVE_DIST || !this.isLoaded(mob.pos.x, mob.pos.z)) continue;
      this.think(mob, dt, player);

      // Gravity / water
      const inWater = W.getBlock(Math.floor(mob.pos.x), Math.floor(mob.pos.y + 0.3), Math.floor(mob.pos.z)) === B.WATER;
      if (inWater) { mob.vel.y = Math.min(mob.vel.y + 14 * dt, 2.2); }
      else mob.vel.y = Math.max(mob.vel.y - GRAVITY * dt, -30);

      const t = TYPES[mob.type];
      const speed = mob.walking ? t.speed * (mob.love > 0 ? 1.4 : 1) : 0;
      const dirx = Math.sin(mob.yaw), dirz = Math.cos(mob.yaw);
      mob.vel.x += (dirx * speed - mob.vel.x) * Math.min(1, 8 * dt);
      mob.vel.z += (dirz * speed - mob.vel.z) * Math.min(1, 8 * dt);

      mob.onGround = false;
      this.move(mob, 'y', mob.vel.y * dt);
      const bx = this.move(mob, 'x', mob.vel.x * dt);
      const bz = this.move(mob, 'z', mob.vel.z * dt);
      if ((bx || bz) && mob.walking) {
        // Hop up single blocks, otherwise turn around.
        if (mob.onGround) {
          const ahead = mob.pos.clone(); ahead.x += dirx * 0.5; ahead.z += dirz * 0.5; ahead.y += 1.05;
          if (!this.collides(mob, ahead)) mob.vel.y = 7.2;
          else mob.targetYaw = mob.yaw + Math.PI * (0.5 + Math.random());
        }
      }
      // Gentle push from the player so animals don't stand inside you.
      const px = mob.pos.x - player.pos.x, pz = mob.pos.z - player.pos.z;
      const pd = Math.hypot(px, pz), minD = this.size(mob).hw + 0.35;
      if (pd < minD && pd > 1e-3 && Math.abs(mob.pos.y - player.pos.y) < 1.5) {
        this.move(mob, 'x', px / pd * (minD - pd) * 0.5);
        this.move(mob, 'z', pz / pd * (minD - pd) * 0.5);
      }
      if (mob.pos.y < -10) { this.remove(mob); continue; }

      // Animation
      let dy = mob.targetYaw - mob.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      mob.yaw += dy * Math.min(1, 5 * dt);
      const moving = Math.hypot(mob.vel.x, mob.vel.z);
      mob.phase += moving * dt * 6;
      const swing = Math.sin(mob.phase) * Math.min(0.7, moving * 0.6);
      mob.legs.forEach((l, i) => { l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? 1 : -1) * swing; });
      mob.head.rotation.x = mob.walking ? 0 : Math.sin(performance.now() / 700 + mob.phase) * 0.12 + 0.15;
      mob.group.position.copy(mob.pos);
      mob.group.rotation.y = mob.yaw;
      if (mob.wool) mob.wool.visible = !mob.sheared;
      if (mob.tail) {
        mob.wag = Math.max(0, mob.wag - dt);
        const wagging = mob.wag > 0 || (mob.tamed && Math.hypot(mob.pos.x - player.pos.x, mob.pos.z - player.pos.z) < 4);
        mob.tail.rotation.y = wagging ? Math.sin(performance.now() / 70) * 0.6 : 0;
      }
      // Sitting pose: rear goes down, legs fold.
      if (mob.sitting) {
        mob.group.rotation.x = -0.45;
        mob.group.position.y -= 0.12;
        mob.legs.forEach((l, i) => { l.rotation.x = i >= 2 ? -1.2 : 0.35; });
      } else mob.group.rotation.x = 0;
    }

    // Effects
    this.effects = this.effects.filter((e) => {
      e.life -= dt;
      e.sprite.position.y += dt * 0.8;
      e.sprite.material.opacity = Math.min(1, e.life * 2);
      if (e.life <= 0) { this.scene.remove(e.sprite); return false; }
      return true;
    });
  }

  think(mob, dt, player) {
    mob.timer -= dt;
    mob.loveCooldown = Math.max(0, mob.loveCooldown - dt);
    if (mob.hop > 0) mob.hop -= dt;

    // Growing up
    if (mob.baby) {
      mob.age += dt;
      if (mob.age >= GROW_TIME) {
        mob.baby = false; this.applyScale(mob);
        mob.pos.y += 0.05;
        if (this.collides(mob)) mob.pos.y = Math.floor(mob.pos.y) + 1;
      }
    }
    // Wool regrowth
    if (mob.sheared) { mob.regrow -= dt; if (mob.regrow <= 0) mob.sheared = false; }

    // Love: walk towards the nearest partner in love, then make a baby.
    if (mob.love > 0) {
      mob.love -= dt;
      if (Math.random() < dt * 2) this.effect(mob, this.heartMat);
      const mate = this.list.find((o) => o !== mob && o.type === mob.type && o.love > 0 && !o.baby && o.pos.distanceTo(mob.pos) < 8);
      if (mate) {
        mob.targetYaw = Math.atan2(mate.pos.x - mob.pos.x, mate.pos.z - mob.pos.z);
        mob.walking = mob.pos.distanceTo(mate.pos) > 1.2;
        if (!mob.walking) {
          mob.love = mate.love = 0;
          mob.loveCooldown = mate.loveCooldown = 60;
          const baby = this.spawn(mob.type, (mob.pos.x + mate.pos.x) / 2, mob.pos.y + 0.2, (mob.pos.z + mate.pos.z) / 2,
            { baby: true, kept: true, woolColor: mob.type === 'sheep' ? (Math.random() < 0.5 ? mob.woolColor : mate.woolColor) : null });
          mob.kept = mate.kept = true;
          if (mob.tamed) this.tame(baby);
          for (let i = 0; i < 5; i++) this.effect(baby, this.heartMat);
          this.voice(mob);
          this.onBaby?.(baby);
        }
        return;
      }
    }

    // Pets: sit when asked, otherwise follow their owner.
    if (mob.tamed) {
      if (mob.sitting) { mob.walking = false; return; }
      const d = Math.hypot(player.pos.x - mob.pos.x, player.pos.z - mob.pos.z);
      if (d > 3.2) {
        mob.targetYaw = Math.atan2(player.pos.x - mob.pos.x, player.pos.z - mob.pos.z);
        mob.walking = true; mob.timer = 0.5;
        return;
      }
      if (d < 2) { mob.walking = false; mob.targetYaw = Math.atan2(player.pos.x - mob.pos.x, player.pos.z - mob.pos.z); }
    }

    // Babies follow a nearby grown-up of their kind.
    if (mob.baby && mob.timer <= 0) {
      const parent = this.list.find((o) => o !== mob && o.type === mob.type && !o.baby && o.pos.distanceTo(mob.pos) < 12);
      if (parent && parent.pos.distanceTo(mob.pos) > 2.5) {
        mob.targetYaw = Math.atan2(parent.pos.x - mob.pos.x, parent.pos.z - mob.pos.z);
        mob.walking = true; mob.timer = 1;
        return;
      }
    }

    // Wander
    if (mob.timer <= 0) {
      mob.walking = Math.random() < 0.55;
      mob.targetYaw = mob.yaw + (Math.random() - 0.5) * Math.PI * 1.5;
      mob.timer = mob.walking ? 2 + Math.random() * 4 : 2 + Math.random() * 5;
    }
    // Don't walk off cliffs or into deep water.
    if (mob.walking && mob.onGround) {
      const ax = Math.floor(mob.pos.x + Math.sin(mob.targetYaw) * 0.9), az = Math.floor(mob.pos.z + Math.cos(mob.targetYaw) * 0.9);
      const fy = Math.floor(mob.pos.y);
      const W = this.world;
      let drop = 0;
      while (drop < 4 && !SOLID[W.getBlock(ax, fy - 1 - drop, az)] && W.getBlock(ax, fy - 1 - drop, az) !== B.WATER) drop++;
      if (drop >= 3 || W.getBlock(ax, fy - 1, az) === B.WATER) { mob.targetYaw += Math.PI; mob.timer = 1.5; }
    }
    // Ambient sounds (only when close)
    mob.soundTimer -= dt;
    if (mob.soundTimer <= 0) {
      mob.soundTimer = 8 + Math.random() * 14;
      if (mob.pos.distanceTo(player.pos) < 14) this.voice(mob);
    }
  }

  trySpawnHerd(center) {
    const W = this.world;
    for (let attempt = 0; attempt < 6; attempt++) {
      const a = Math.random() * Math.PI * 2, r = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      const x = Math.floor(center.x + Math.cos(a) * r), z = Math.floor(center.z + Math.sin(a) * r);
      if (!this.isLoaded(x, z)) continue;
      const y = W.topSolid(x, z);
      const ground = W.getBlock(x, y, z);
      if (ground !== B.GRASS && ground !== B.SNOWY_GRASS) continue;
      const roll = Math.random();
      // Now and then a lone dog or cat appears, waiting to be befriended.
      if (ground === B.GRASS && Math.random() < 0.18 && !this.list.some((m) => TYPES[m.type].pet && !m.tamed)) {
        const pet = this.spawn(Math.random() < 0.5 ? 'dog' : 'cat', x + 0.5, y + 1, z + 0.5);
        if (pet && this.collides(pet)) this.remove(pet);
        return;
      }
      const type = ground === B.SNOWY_GRASS ? 'sheep' : roll < 0.3 ? 'sheep' : roll < 0.55 ? 'pig' : roll < 0.8 ? 'cow' : 'chicken';
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n && this.list.length < MAX_MOBS; i++) {
        const ox = x + Math.floor(Math.random() * 5 - 2), oz = z + Math.floor(Math.random() * 5 - 2);
        const oy = W.topSolid(ox, oz);
        if (W.getBlock(ox, oy, oz) !== B.GRASS && W.getBlock(ox, oy, oz) !== B.SNOWY_GRASS) continue;
        const mob = this.spawn(type, ox + 0.5, oy + 1, oz + 0.5, { baby: Math.random() < 0.15 });
        if (mob && this.collides(mob)) this.remove(mob);
      }
      return;
    }
  }

  // ---------- interaction ----------
  /** Ray vs animal boxes. Returns { mob, dist } for the closest hit within maxDist. */
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const mob of this.list) {
      const { hw, h } = this.size(mob);
      const min = [mob.pos.x - hw, mob.pos.y, mob.pos.z - hw], max = [mob.pos.x + hw, mob.pos.y + h, mob.pos.z + hw];
      const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
      let t0 = 0, t1 = maxDist, ok = true;
      for (let i = 0; i < 3 && ok; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < min[i] || o[i] > max[i]) ok = false; continue; }
        let a = (min[i] - o[i]) / d[i], b = (max[i] - o[i]) / d[i];
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) ok = false;
      }
      if (ok && (!best || t0 < best.dist)) best = { mob, dist: t0 };
    }
    return best;
  }

  /** Left click: a friendly pat. The animal hops and makes a happy sound. */
  pat(mob, player) {
    if (mob.onGround) mob.vel.y = 4.5;
    const away = Math.atan2(mob.pos.x - player.pos.x, mob.pos.z - player.pos.z);
    mob.targetYaw = away; mob.walking = true; mob.timer = 1.2;
    this.effect(mob, this.happyMat);
    this.voice(mob);
  }

  /** Feed an apple. Returns true if the animal accepted it. */
  feed(mob) {
    if (TYPES[mob.type].pet && !mob.tamed) {
      this.tame(mob);
      for (let i = 0; i < 4; i++) this.effect(mob, this.heartMat);
      mob.wag = 2;
      this.voice(mob);
      this.onTame?.(mob);
      return true;
    }
    if (mob.baby) { // feeding babies makes them grow faster
      mob.age = Math.min(GROW_TIME, mob.age + GROW_TIME * 0.2);
      for (let i = 0; i < 2; i++) this.effect(mob, this.happyMat);
      this.voice(mob); mob.kept = true;
      return true;
    }
    if (mob.love > 0 || mob.loveCooldown > 0) return false;
    mob.love = LOVE_TIME; mob.kept = true;
    for (let i = 0; i < 3; i++) this.effect(mob, this.heartMat);
    this.voice(mob);
    return true;
  }

  /** Shear a sheep. Returns the wool block id dropped, or null. */
  shear(mob) {
    if (mob.type !== 'sheep' || mob.sheared || mob.baby) return null;
    mob.sheared = true; mob.regrow = REGROW_TIME;
    this.voice(mob);
    return mob.woolColor;
  }

  /** Make a dog or cat your pet: collar, name tag, follows you. */
  tame(mob, name) {
    if (!TYPES[mob.type].pet) return false;
    mob.tamed = true; mob.kept = true;
    const used = new Set(this.list.filter((m) => m.petName).map((m) => m.petName));
    const free = PET_NAMES.filter((n) => !used.has(n));
    const pool = free.length ? free : PET_NAMES;
    mob.petName = name || pool[Math.floor(Math.random() * pool.length)];
    if (mob.collar) mob.collar.visible = true;
    if (mob.tag) mob.group.remove(mob.tag);
    mob.tag = nameTag(mob.petName);
    mob.tag.position.set(0, TYPES[mob.type].h + 0.35, 0);
    mob.group.add(mob.tag);
    return true;
  }

  toggleSit(mob) {
    if (!mob.tamed) return false;
    mob.sitting = !mob.sitting;
    mob.walking = false;
    mob.wag = 1;
    this.voice(mob);
    return mob.sitting;
  }

  teleportToPlayer(mob, player) {
    const W = this.world;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = Math.floor(player.pos.x + Math.cos(a) * 2), z = Math.floor(player.pos.z + Math.sin(a) * 2);
      if (!this.isLoaded(x, z)) continue;
      const y = Math.floor(player.pos.y);
      for (const dy of [0, 1, -1, 2]) {
        const p = new THREE.Vector3(x + 0.5, y + dy, z + 0.5);
        if (!this.collides(mob, p) && SOLID[W.getBlock(x, y + dy - 1, z)]) { mob.pos.copy(p); mob.vel.set(0, 0, 0); return true; }
      }
    }
    return false;
  }

  voice(mob) { this.sfx.animal?.(mob.type, mob.baby); }

  effect(mob, mat) {
    const s = new THREE.Sprite(mat.clone());
    const { h } = this.size(mob);
    s.position.set(mob.pos.x + (Math.random() - 0.5) * 0.6, mob.pos.y + h + 0.1, mob.pos.z + (Math.random() - 0.5) * 0.6);
    s.scale.setScalar(0.35);
    this.scene.add(s);
    this.effects.push({ sprite: s, life: 1.1 });
  }

  // ---------- persistence ----------
  serialize() {
    return this.list.filter((m) => m.kept).map((m) => ({
      t: m.type, x: +m.pos.x.toFixed(2), y: +m.pos.y.toFixed(2), z: +m.pos.z.toFixed(2), yaw: +m.yaw.toFixed(2),
      baby: m.baby, age: Math.round(m.age), sheared: m.sheared, regrow: Math.round(m.regrow), wool: m.woolColor,
      tamed: m.tamed || undefined, sit: m.sitting || undefined, name: m.petName || undefined,
    }));
  }

  load(arr) {
    if (!Array.isArray(arr)) return;
    for (const d of arr.slice(0, 64)) {
      if (!TYPES[d.t] || !Number.isFinite(d.x)) continue;
      this.spawn(d.t, d.x, d.y, d.z, { yaw: d.yaw, baby: d.baby, age: d.age, sheared: d.sheared, regrow: d.regrow, woolColor: d.wool ?? undefined, kept: true, tamed: d.tamed, sitting: d.sit, petName: d.name });
    }
  }
}

function pickWool() {
  const r = Math.random();
  if (r < 0.5) return B.WOOL_WHITE;
  return WOOL[1 + Math.floor(Math.random() * (WOOL.length - 1))];
}
