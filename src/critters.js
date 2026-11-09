// Tiny ambient critters: butterflies that visit flowers by day, and fireflies
// that blink over the grass at night (click/tap one to catch it in a lantern).
// They are lightweight (one InstancedMesh each) and live only near the player.
import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';

const MAX_BUTTERFLIES = 10;
const MAX_FIREFLIES = 16;
const WING_COLORS = [[255, 140, 40], [80, 170, 255], [255, 220, 60], [230, 90, 200], [255, 255, 255]];

export class Critters {
  constructor(scene) {
    this.scene = scene;
    this.world = null;
    this.time = 0;
    this.spawnTimer = 0;
    this.butterflies = [];
    this.fireflies = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.c = new THREE.Color();
    this.onSpawnButterfly = null; // (b)

    // Butterfly: two flat wings that flap (each wing is one instance).
    const wing = new THREE.PlaneGeometry(0.22, 0.16);
    wing.translate(0.11, 0, 0);
    this.wings = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), MAX_BUTTERFLIES * 2);
    this.wings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BUTTERFLIES * 2 * 3), 3);
    this.wings.count = 0; this.wings.frustumCulled = false;
    scene.add(this.wings);

    // Firefly: a small glowing cube (bright regardless of daylight).
    this.flies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 0.09),
      new THREE.MeshBasicMaterial({ color: 0xfff27a, fog: false }), MAX_FIREFLIES);
    this.flies.count = 0; this.flies.frustumCulled = false;
    scene.add(this.flies);
  }

  reset(world) { this.world = world; this.butterflies = []; this.fireflies = []; }

  /** Finds a flower (day) or grass (night) block near the player to spawn around. */
  findSpot(center, wantFlower) {
    const W = this.world;
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(center.x + (Math.random() - 0.5) * 36), z = Math.floor(center.z + (Math.random() - 0.5) * 36);
      const c = W.chunks.get(`${Math.floor(x / 16)},${Math.floor(z / 16)}`);
      if (!c || !c.meshed) continue;
      const y = W.topSolid(x, z); // the ground (or plant) surface at this column
      if (Math.abs(y - center.y) > 24) continue;
      const id = W.getBlock(x, y, z);
      if (wantFlower ? (BLOCKS[id]?.plant && id !== B.TALL_GRASS && BLOCKS[id].crop === undefined) : (id === B.TALL_GRASS || id === B.GRASS)) return [x + 0.5, y + (wantFlower ? 0.8 : 1.2), z + 0.5];
    }
    return null;
  }

  update(dt, player, daylight, night, allowSpawn) {
    if (!this.world) return;
    this.time += dt;
    this.spawnTimer -= dt;
    const P = player.pos;

    if (allowSpawn && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      if (!night && this.butterflies.length < MAX_BUTTERFLIES) {
        const s = this.findSpot(P, true);
        if (s) {
          const b = { home: s, pos: new THREE.Vector3(...s), phase: Math.random() * 10, col: WING_COLORS[Math.floor(Math.random() * WING_COLORS.length)], life: 60 + Math.random() * 60 };
          this.butterflies.push(b);
          this.onSpawnButterfly?.(b);
        }
      }
      if (night && this.fireflies.length < MAX_FIREFLIES) {
        const s = this.findSpot(P, false);
        if (s) this.fireflies.push({ home: s, pos: new THREE.Vector3(...s), phase: Math.random() * 10, life: 90 + Math.random() * 60 });
      }
    }

    // Leave when far away, at the wrong time of day, or when their time is up.
    const keep = (c, wrongTime) => (c.life -= dt) > 0 && !wrongTime && c.pos.distanceTo(P) < 48;
    this.butterflies = this.butterflies.filter((b) => keep(b, night));
    this.fireflies = this.fireflies.filter((f) => keep(f, !night));

    // Butterflies: lazy loops around their flower, wings flapping.
    this.butterflies.forEach((b, i) => {
      const t = this.time + b.phase;
      b.pos.set(b.home[0] + Math.sin(t * 0.7) * 1.4 + Math.sin(t * 2.1) * 0.3, b.home[1] + 0.5 + Math.sin(t * 1.3) * 0.35, b.home[2] + Math.cos(t * 0.9) * 1.4);
      const yaw = Math.atan2(Math.cos(t * 0.7), -Math.sin(t * 0.9)), flap = Math.sin(t * 18) * 0.9;
      for (let s = 0; s < 2; s++) {
        this.q.setFromEuler(new THREE.Euler(0, yaw + (s ? Math.PI : 0), (s ? -1 : 1) * flap, 'YXZ'));
        this.m.compose(b.pos, this.q, new THREE.Vector3(1, 1, 1));
        this.wings.setMatrixAt(i * 2 + s, this.m);
        this.c.setRGB(b.col[0] / 255 * daylight, b.col[1] / 255 * daylight, b.col[2] / 255 * daylight);
        this.wings.setColorAt(i * 2 + s, this.c);
      }
    });
    this.wings.count = this.butterflies.length * 2;
    this.wings.instanceMatrix.needsUpdate = true;
    if (this.wings.instanceColor) this.wings.instanceColor.needsUpdate = true;

    // Fireflies: slow drifting and blinking.
    this.fireflies.forEach((f, i) => {
      const t = this.time + f.phase;
      f.pos.set(f.home[0] + Math.sin(t * 0.4) * 2.2, f.home[1] + 0.6 + Math.sin(t * 0.9) * 0.5, f.home[2] + Math.cos(t * 0.5) * 2.2);
      const on = Math.sin(t * 2.5) > -0.2 ? 1 : 0.15;
      this.m.makeScale(on, on, on).setPosition(f.pos);
      this.flies.setMatrixAt(i, this.m);
    });
    this.flies.count = this.fireflies.length;
    this.flies.instanceMatrix.needsUpdate = true;
  }

  /** Ray vs fireflies (generous radius so small hands can tap them). Returns { fly, dist }. */
  raycastFirefly(origin, dir, maxDist) {
    let best = null;
    const tmp = new THREE.Vector3();
    for (const f of this.fireflies) {
      tmp.copy(f.pos).sub(origin);
      const t = tmp.dot(dir);
      if (t < 0 || t > maxDist) continue;
      const d2 = tmp.lengthSq() - t * t;
      if (d2 < 0.45 * 0.45 && (!best || t < best.dist)) best = { fly: f, dist: t };
    }
    return best;
  }

  catchFirefly(f) { this.fireflies = this.fireflies.filter((x) => x !== f); }
}
