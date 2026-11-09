// First-person player: AABB collision against the voxel grid, walking,
// sprinting, jumping, swimming and creative flight.
import * as THREE from 'three';
import { B, SOLID } from './blocks.js';

export const HALF_W = 0.3;
export const HEIGHT = 1.8;
export const EYE = 1.62;
const GRAVITY = 28;
const JUMP_V = 8.4;
const WALK = 4.3;
const SPRINT = 6.4;
const FLY = 10.5;
const EPS = 1e-4;

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.headInWater = false;
    this.hitWall = false;
    this.fallStart = null; // highest Y since leaving the ground
    this.onLand = null;    // callback(fallDistance)
  }

  get eye() { return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z); }

  collides() {
    const { x, y, z } = this.pos;
    const x0 = Math.floor(x - HALF_W), x1 = Math.floor(x + HALF_W - EPS);
    const y0 = Math.floor(y), y1 = Math.floor(y + HEIGHT - EPS);
    const z0 = Math.floor(z - HALF_W), z1 = Math.floor(z + HALF_W - EPS);
    for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) for (let bx = x0; bx <= x1; bx++) {
      if (SOLID[this.world.getBlock(bx, by, bz)]) return true;
    }
    return false;
  }

  /** True if the unit block at (bx,by,bz) overlaps the player's box. */
  intersectsBlock(bx, by, bz) {
    const { x, y, z } = this.pos;
    return bx < x + HALF_W && bx + 1 > x - HALF_W &&
      by < y + HEIGHT && by + 1 > y &&
      bz < z + HALF_W && bz + 1 > z - HALF_W;
  }

  update(dt, input) {
    const w = this.world;
    this.inWater = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z)) === B.WATER;
    this.headInWater = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE), Math.floor(this.pos.z)) === B.WATER;

    // Desired horizontal direction from yaw.
    const f = input.forward - input.back;
    const s = input.right - input.left;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * f + cos * s;
    let wz = -cos * f - sin * s;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; } // keep analog (joystick) magnitude below 1

    let speed = this.flying ? FLY * (input.sprint ? 1.8 : 1) : input.sprint && f > 0 ? SPRINT : WALK;
    if (this.inWater && !this.flying) speed *= 0.55;
    const accel = this.flying ? 10 : this.onGround ? 14 : this.inWater ? 6 : 3.5;
    const k = Math.min(1, accel * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;

    if (this.flying) {
      const vy = (input.jump - input.down) * speed;
      this.vel.y += (vy - this.vel.y) * Math.min(1, 10 * dt);
    } else if (this.inWater) {
      this.vel.y -= 9 * dt;
      this.vel.y *= Math.max(0, 1 - 2.5 * dt);
      if (input.jump) this.vel.y = Math.max(this.vel.y, this.hitWall ? 5.5 : 3.2);
      this.vel.y = Math.max(this.vel.y, -4);
    } else {
      this.vel.y -= GRAVITY * dt;
      this.vel.y = Math.max(this.vel.y, -55);
      if (input.jump && this.onGround) this.vel.y = JUMP_V;
    }

    this.onGround = false;
    this.hitWall = false;
    const dx = this.vel.x * dt, dy = this.vel.y * dt, dz = this.vel.z * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.35));
    for (let i = 0; i < steps; i++) {
      this.moveAxis('y', dy / steps);
      this.moveAxis('x', dx / steps);
      this.moveAxis('z', dz / steps);
    }
    if (this.flying && this.onGround) this.flying = false; // land to stop flying

    // Fall tracking (for gentle fall damage in survival).
    if (this.flying || this.inWater) this.fallStart = null;
    else if (!this.onGround) this.fallStart = Math.max(this.fallStart ?? this.pos.y, this.pos.y);
    else if (this.fallStart !== null) {
      const dist = this.fallStart - this.pos.y;
      this.fallStart = null;
      this.onLand?.(dist);
    }
  }

  moveAxis(axis, amt) {
    if (!amt) return;
    const prev = this.pos[axis];
    this.pos[axis] += amt;
    if (!this.collides()) return;
    const p = this.pos;
    if (axis === 'y') {
      if (amt < 0) { p.y = Math.floor(p.y) + 1; this.onGround = true; }
      else p.y = Math.floor(p.y + HEIGHT) - HEIGHT - EPS;
      this.vel.y = 0;
    } else {
      if (amt > 0) p[axis] = Math.floor(p[axis] + HALF_W) - HALF_W - EPS;
      else p[axis] = Math.floor(p[axis] - HALF_W) + 1 + HALF_W + EPS;
      this.vel[axis] = 0;
      this.hitWall = true;
    }
    // Safety: if still stuck (e.g. spawned inside terrain), revert this move.
    if (this.collides()) this.pos[axis] = prev;
  }

  /** Puts the player on the surface at column (x, z). */
  spawnAt(x, z) {
    const y = this.world.topSolid(Math.floor(x), Math.floor(z)) + 1;
    this.pos.set(Math.floor(x) + 0.5, y, Math.floor(z) + 0.5);
    let guard = 0;
    while (this.collides() && guard++ < 100) this.pos.y += 1;
    this.vel.set(0, 0, 0);
    this.fallStart = null;
  }
}
