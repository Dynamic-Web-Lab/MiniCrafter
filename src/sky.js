// Day/night cycle: sky colour, square sun & moon, stars and drifting blocky clouds.
import * as THREE from 'three';
import { mulberry32, smoothstep } from './noise.js';

const DAY = new THREE.Color(0x87ceeb);
const NIGHT = new THREE.Color(0x0b1026);
const SUNSET = new THREE.Color(0xf08a4b);

export class Sky {
  constructor(scene) {
    this.color = new THREE.Color();
    const mk = (size, color) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ color, fog: false, transparent: true, depthWrite: false }));
      m.renderOrder = -1;
      scene.add(m);
      return m;
    };
    this.sun = mk(60, 0xfff3a0);
    this.moon = mk(40, 0xdfe6f0);

    // Stars
    const rng = mulberry32(42);
    const pts = [];
    for (let i = 0; i < 900; i++) {
      const u = rng() * 2 - 1, th = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pts.push(r * Math.cos(th) * 450, Math.abs(u) * 450, r * Math.sin(th) * 450);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: 0xffffff, fog: false, transparent: true, depthWrite: false }));
    this.stars.renderOrder = -2;
    scene.add(this.stars);

    // Clouds: a pixelated noise texture on a big plane that follows the camera.
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(64, 64);
    const cr = mulberry32(7);
    const grid = Array.from({ length: 64 * 64 }, () => cr());
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      // box blur for blobby shapes (wrapping)
      let s = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += grid[((y + dy + 64) % 64) * 64 + ((x + dx + 64) % 64)];
      const on = s / 25 > 0.565;
      const i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = on ? 220 : 0;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    this.cloudTex = tex;
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1536, 1536),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0.85 }));
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.renderOrder = 2;
    scene.add(this.clouds);
    this.cloudOffset = 0;
  }

  /** @returns light level 0..1 to multiply into world materials */
  update(t, camera, dt) {
    const a = t * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.25).normalize();
    const sunH = dir.y;
    const day = smoothstep(-0.15, 0.2, sunH);
    const light = 0.2 + 0.8 * day;

    this.color.copy(NIGHT).lerp(DAY, day);
    const dusk = Math.max(0, 1 - Math.abs(sunH) / 0.28);
    this.color.lerp(SUNSET, dusk * 0.45);

    const cp = camera.position;
    this.sun.position.copy(cp).addScaledVector(dir, 400);
    this.sun.lookAt(cp);
    this.moon.position.copy(cp).addScaledVector(dir, -400);
    this.moon.lookAt(cp);
    this.sun.material.opacity = smoothstep(-0.25, 0.0, sunH);
    this.moon.material.opacity = smoothstep(-0.25, 0.0, -sunH);

    this.stars.position.copy(cp);
    this.stars.rotation.z = a;
    this.stars.material.opacity = 1 - smoothstep(-0.2, 0.15, sunH);

    // Clouds at a fixed height, texture scrolls; plane recentres on the camera.
    this.cloudOffset += dt * 1.2;
    const scale = 1536 / 4 / 64; // world units per cloud pixel
    this.clouds.position.set(cp.x, 112, cp.z);
    this.cloudTex.offset.set((cp.x + this.cloudOffset) / (scale * 64), -cp.z / (scale * 64));
    this.clouds.material.color.setScalar(0.1 + 0.9 * day);
    this.clouds.material.opacity = 0.45 + 0.4 * day;
    return light;
  }
}
