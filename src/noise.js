// Seeded noise + hashing helpers. Deterministic for a given seed.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  s = String(s);
  if (/^-?\d+$/.test(s.trim())) return (parseInt(s, 10) >>> 0);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function hash2(x, z, s) {
  let h = s ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function hash3(x, y, z, s) {
  return hash2(x ^ Math.imul(y, 1442695041), z, s);
}

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1],
  [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

export class Perlin {
  constructor(seed) {
    const rng = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise2(x, y) {
    const P = this.perm;
    const X = Math.floor(x), Y = Math.floor(y);
    x -= X; y -= Y;
    const xi = X & 255, yi = Y & 255;
    const u = fade(x), v = fade(y);
    const g = (h, dx, dy) => { const gr = GRAD3[h % 8]; return gr[0] * dx + gr[1] * dy; };
    const aa = P[P[xi] + yi], ab = P[P[xi] + yi + 1];
    const ba = P[P[xi + 1] + yi], bb = P[P[xi + 1] + yi + 1];
    return lerp(
      lerp(g(aa, x, y), g(ba, x - 1, y), u),
      lerp(g(ab, x, y - 1), g(bb, x - 1, y - 1), u),
      v,
    );
  }

  noise3(x, y, z) {
    const P = this.perm;
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const g = (h, dx, dy, dz) => { const gr = GRAD3[h % 12]; return gr[0] * dx + gr[1] * dy + gr[2] * dz; };
    const A = P[xi] + yi, AA = P[A] + zi, AB = P[A + 1] + zi;
    const Bq = P[xi + 1] + yi, BA = P[Bq] + zi, BB = P[Bq + 1] + zi;
    return lerp(
      lerp(
        lerp(g(P[AA], x, y, z), g(P[BA], x - 1, y, z), u),
        lerp(g(P[AB], x, y - 1, z), g(P[BB], x - 1, y - 1, z), u), v),
      lerp(
        lerp(g(P[AA + 1], x, y, z - 1), g(P[BA + 1], x - 1, y, z - 1), u),
        lerp(g(P[AB + 1], x, y - 1, z - 1), g(P[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  }
}

/** Fractal 2D noise, roughly in [-1, 1]. */
export function fbm2(noise, x, y, octaves = 4) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise.noise2(x * freq, y * freq) * amp;
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm * 1.4;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
