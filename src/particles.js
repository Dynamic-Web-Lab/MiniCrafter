// Block-break debris: small coloured cubes with gravity, pooled.
import * as THREE from 'three';

const MAX = 160;

export class Particles {
  constructor(scene, avgColors) {
    this.avg = avgColors;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX,
    );
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.items = [];
    this.m = new THREE.Matrix4();
    this.c = new THREE.Color();
  }

  burst(x, y, z, tile) {
    const base = this.avg[tile] || new THREE.Color(0.5, 0.5, 0.5);
    for (let i = 0; i < 14; i++) {
      if (this.items.length >= MAX) this.items.shift();
      const f = 0.75 + Math.random() * 0.4;
      this.items.push({
        p: new THREE.Vector3(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6),
        v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4),
        life: 0.5 + Math.random() * 0.4,
        c: base.clone().multiplyScalar(f),
      });
    }
  }

  update(dt, light) {
    this.items = this.items.filter((it) => (it.life -= dt) > 0);
    this.items.forEach((it, i) => {
      it.v.y -= 18 * dt;
      it.p.addScaledVector(it.v, dt);
      const s = Math.min(1, it.life * 3);
      this.m.makeScale(s, s, s).setPosition(it.p);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.c.copy(it.c).multiplyScalar(light));
    });
    this.mesh.count = this.items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
