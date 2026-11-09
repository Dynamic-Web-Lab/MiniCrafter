// Tiny synthesized sound effects (no audio files). Uses filtered noise bursts.
import { B } from './blocks.js';

const SOFT = new Set([B.GRASS, B.DIRT, B.SAND, B.GRAVEL, B.LEAVES, B.SNOW, B.SNOWY_GRASS,
  B.WOOL_WHITE, B.WOOL_RED, B.WOOL_BLUE, B.WOOL_YELLOW, B.WOOL_GREEN, B.WOOL_BLACK, B.CACTUS]);
const WOOD = new Set([B.LOG, B.PLANKS]);

export class Sfx {
  constructor() { this.ctx = null; this.buf = null; }

  resume() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const len = this.ctx.sampleRate * 0.3;
        this.buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { this.ctx = null; }
  }

  burst(freq, q, dur, gain) {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.buf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq * (0.9 + Math.random() * 0.2); f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  profile(id) {
    if (SOFT.has(id)) return [700, 0.8, 0.16, 0.5];
    if (WOOD.has(id)) return [420, 3, 0.14, 0.7];
    if (id === B.GLASS) return [3200, 6, 0.22, 0.45];
    return [1300, 1.5, 0.12, 0.5];
  }

  dig(id) { const [f, q, d, g] = this.profile(id); this.burst(f, q, d * 1.3, g); }
  place(id) { const [f, q, d, g] = this.profile(id); this.burst(f * 0.8, q, d, g * 0.8); }
}

// Extra cues used by survival mode.
Sfx.prototype.tone = function (freq, dur, type = 'sine', gain = 0.25, slide = 0) {
  const ctx = this.ctx;
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
};
Sfx.prototype.pop = function () { this.tone(520 + Math.random() * 200, 0.09, 'sine', 0.18, 300); };
Sfx.prototype.hurt = function () { this.tone(220, 0.25, 'square', 0.15, -120); };
Sfx.prototype.craft = function () { this.tone(660, 0.08, 'triangle', 0.2); setTimeout(() => this.tone(990, 0.12, 'triangle', 0.2), 70); };
Sfx.prototype.eat = function () { this.burst(900, 1, 0.08, 0.4); setTimeout(() => this.burst(900, 1, 0.08, 0.4), 120); };
Sfx.prototype.hit = function (id) { const [f, q] = this.profile(id); this.burst(f, q, 0.05, 0.25); };
