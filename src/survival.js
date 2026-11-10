// Gentle survival rules: hearts, fall damage, drowning, slow regeneration,
// and timed block mining with a crack overlay. No hunger, no monsters.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export const MAX_HEALTH = 20; // 10 hearts
export const MAX_AIR = 10;    // seconds of breath (generous for kids)
export const MAX_HUNGER = 20; // 10 drumsticks (Adventure mode only)
const REGEN_DELAY = 4;        // seconds after damage before healing starts
const REGEN_EVERY = 2.5;      // seconds per half-heart healed
const STAGES = 8;

function crackTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16 * STAGES;
  const ctx = c.getContext('2d');
  const rng = mulberry32(99);
  // Grow random crack walks; each stage draws everything from earlier stages plus more.
  const walks = Array.from({ length: STAGES * 2 }, () => {
    let x = 4 + rng() * 8, y = 4 + rng() * 8;
    return Array.from({ length: 6 }, () => { x = Math.max(0, Math.min(15, x + rng() * 4 - 2)); y = Math.max(0, Math.min(15, y + rng() * 4 - 2)); return [Math.floor(x), Math.floor(y)]; });
  });
  for (let s = 0; s < STAGES; s++) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    for (let w = 0; w <= s * 2 + 1; w++) {
      const n = Math.min(walks[w].length, 2 + s);
      for (let i = 0; i < n; i++) ctx.fillRect(walks[w][i][0], s * 16 + walks[w][i][1], 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.repeat.set(1, 1 / STAGES);
  return t;
}

export class Survival {
  constructor(scene) {
    this.health = MAX_HEALTH;
    this.air = MAX_AIR;
    this.sinceDamage = 99;
    this.regenTimer = 0;
    this.drownTimer = 0;
    this.onDamage = null;  // (amount, reason)
    this.onDeath = null;   // (reason)
    this.onChange = null;  // HUD refresh
    // Adventure mode: hunger, tougher falls. Off for the gentle modes.
    this.adventure = false;
    this.hunger = MAX_HUNGER;
    this.exhaustion = 0;
    this.starveTimer = 0;

    this.mining = null;    // { x, y, z, id, progress, time }
    this.crackTex = crackTexture();
    this.crack = new THREE.Mesh(
      new THREE.BoxGeometry(1.006, 1.006, 1.006),
      new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
    );
    this.crack.visible = false;
    scene.add(this.crack);
  }

  get dead() { return this.health <= 0; }

  reset() {
    this.health = MAX_HEALTH; this.air = MAX_AIR; this.sinceDamage = 99; this.drownTimer = 0;
    this.hunger = MAX_HUNGER; this.exhaustion = 0; this.starveTimer = 0;
    this.stopMining();
    this.onChange?.();
  }

  damage(amount, reason) {
    if (this.dead || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.sinceDamage = 0;
    this.onDamage?.(amount, reason);
    this.onChange?.();
    if (this.dead) this.onDeath?.(reason);
  }

  heal(amount) {
    if (this.dead) return false;
    const before = this.health;
    this.health = Math.min(MAX_HEALTH, this.health + amount);
    if (this.health !== before) this.onChange?.();
    return this.health !== before;
  }

  /** Called when the player lands. Gentle: falls over 4 blocks hurt a little. Adventure: over 3. */
  landed(dist) {
    const dmg = Math.floor(dist - (this.adventure ? 3 : 4));
    if (dmg > 0) this.damage(dmg, 'fall');
  }

  update(dt, player) {
    if (this.dead) return;
    // Breath
    const prevAirRaw = this.air;
    const prevAir = Math.ceil(this.air);
    if (player.headInWater) {
      this.air = Math.max(0, this.air - dt);
      if (this.air === 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 1) { this.drownTimer = 0; this.damage(1, 'drown'); }
      }
    } else {
      this.air = Math.min(MAX_AIR, this.air + dt * 4);
      this.drownTimer = 0;
    }
    if (Math.ceil(this.air) !== prevAir || (prevAirRaw < MAX_AIR && this.air === MAX_AIR)) this.onChange?.();

    // Hunger (Adventure): you slowly get hungry, faster when sprinting, jumping and mining.
    if (this.adventure) {
      this.exhaust(dt * 0.03);
      if (this.hunger === 0) {
        this.starveTimer += dt;
        // Starving hurts, but never below half a heart: you always get a chance to eat.
        if (this.starveTimer >= 4) { this.starveTimer = 0; if (this.health > 1) this.damage(1, 'hunger'); }
      } else this.starveTimer = 0;
    }

    // Regeneration (Adventure: only while well fed, and it uses up a little food)
    this.sinceDamage += dt;
    const fed = !this.adventure || this.hunger >= 14;
    if (fed && this.sinceDamage > REGEN_DELAY && this.health < MAX_HEALTH) {
      this.regenTimer += dt;
      if (this.regenTimer >= REGEN_EVERY) { this.regenTimer = 0; if (this.heal(1) && this.adventure) this.exhaust(1.2); }
    } else this.regenTimer = 0;
  }

  /** Adds tiredness; every 4 points costs half a drumstick. */
  exhaust(amount) {
    if (!this.adventure || this.dead) return;
    this.exhaustion += amount;
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.hunger > 0) { this.hunger--; this.onChange?.(); }
    }
  }

  /** Eating in Adventure fills the hunger bar. Returns false when already full. */
  eat(food) {
    if (this.hunger >= MAX_HUNGER) return false;
    this.hunger = Math.min(MAX_HUNGER, this.hunger + food);
    this.exhaustion = 0;
    this.onChange?.();
    return true;
  }

  // ---------- mining ----------
  /**
   * Advance mining of `target` by dt. Returns true when the block breaks.
   * `time` is the total seconds needed (from miningInfo).
   */
  mine(target, time, dt) {
    const m = this.mining;
    if (!m || m.x !== target.x || m.y !== target.y || m.z !== target.z || m.id !== target.id) {
      this.mining = { x: target.x, y: target.y, z: target.z, id: target.id, progress: 0, time };
    }
    const cur = this.mining;
    cur.time = time;
    cur.progress += dt / time;
    if (cur.progress >= 1) { this.stopMining(); return true; }
    const stage = Math.min(STAGES - 1, Math.floor(cur.progress * STAGES));
    this.crackTex.offset.set(0, 1 - (stage + 1) / STAGES);
    this.crack.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    this.crack.visible = true;
    return false;
  }

  stopMining() {
    this.mining = null;
    this.crack.visible = false;
  }
}
