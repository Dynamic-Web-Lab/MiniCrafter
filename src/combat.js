// Adventure combat: flying projectiles (the player's arrows and Sporelings'
// spore puffs). Arrows fall with gravity; spores float slowly so they can be
// dodged or blocked with a shield.
import * as THREE from 'three';
import { SOLID } from './blocks.js';

export class Projectiles {
  /**
   * @param {object} o { scene, getWorld(), getPlayer(), mobs, onHitPlayer(dmg, pos), onHitMob(mob, dmg, pos), onHitBlock(kind, pos) }
   */
  constructor(o) {
    Object.assign(this, o);
    this.list = [];
    this.arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.6);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xd8d0c0 });
    this.sporeGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.sporeMat = new THREE.MeshBasicMaterial({ color: 0x9be06a, fog: false });
  }

  /** kind: 'arrow' (from the player) or 'spore' (from a Sporeling). */
  fire(kind, pos, dir, speed, dmg) {
    const mesh = new THREE.Mesh(kind === 'arrow' ? this.arrowGeo : this.sporeGeo, kind === 'arrow' ? this.arrowMat : this.sporeMat);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const vel = dir.clone().normalize().multiplyScalar(speed);
    this.list.push({ kind, mesh, pos: pos.clone(), vel, dmg, life: 5, gravity: kind === 'arrow' ? 14 : 2.5 });
  }

  clear() { for (const p of this.list) this.scene.remove(p.mesh); this.list = []; }

  update(dt) {
    const W = this.getWorld(), P = this.getPlayer();
    const keep = [];
    for (const p of this.list) {
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      const steps = Math.max(1, Math.ceil(p.vel.length() * dt / 0.3));
      let done = p.life <= 0;
      for (let s = 0; s < steps && !done; s++) {
        p.pos.addScaledVector(p.vel, dt / steps);
        if (SOLID[W.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z))]) { this.onHitBlock?.(p.kind, p.pos); done = true; break; }
        if (p.kind === 'spore') {
          const dx = p.pos.x - P.pos.x, dz = p.pos.z - P.pos.z;
          if (Math.abs(dx) < 0.45 && Math.abs(dz) < 0.45 && p.pos.y > P.pos.y && p.pos.y < P.pos.y + 1.85) { this.onHitPlayer?.(p.dmg, p.pos); done = true; }
        } else {
          for (const mob of this.mobs.list) {
            if (!mob.hostile) continue;
            const { hw, h } = this.mobs.size(mob);
            if (Math.abs(p.pos.x - mob.pos.x) < hw + 0.1 && Math.abs(p.pos.z - mob.pos.z) < hw + 0.1 && p.pos.y > mob.pos.y && p.pos.y < mob.pos.y + h) {
              this.onHitMob?.(mob, p.dmg, p.pos); done = true; break;
            }
          }
        }
      }
      if (done) { this.scene.remove(p.mesh); continue; }
      p.mesh.position.copy(p.pos);
      if (p.kind === 'arrow') p.mesh.lookAt(p.pos.x + p.vel.x, p.pos.y + p.vel.y, p.pos.z + p.vel.z);
      else p.mesh.rotation.y += dt * 4;
      keep.push(p);
    }
    this.list = keep;
  }
}
