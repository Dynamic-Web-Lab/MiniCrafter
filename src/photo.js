// Photo Mode: take a picture of your world, add a frame, a filter, stickers and a caption,
// then save it to your device (or share it). Nothing is uploaded anywhere.
export const FRAMES = [['none', 'None'], ['polaroid', 'Polaroid'], ['rainbow', 'Rainbow'], ['stars', 'Starry']];
export const FILTERS = [['normal', 'Normal'], ['warm', 'Sunny'], ['cool', 'Frosty'], ['bw', 'Black & white'], ['retro', 'Retro']];
export const STICKERS = ['⭐', '❤️', '🎉', '🌈', '🏰', '🐶', '🐱', '🐷', '🦋', '🌸', '😎', '👑', '🔥', '💎', '🤖', '🏁'];

const OUT_W = 1280; // saved photo width (the height follows the screen shape)

export class PhotoMode {
  constructor() {
    this.src = null;          // the captured scene (an Image)
    this.frame = 'polaroid';
    this.filter = 'normal';
    this.stickers = [];       // { e, x, y, s } in 0..1 photo coordinates
    this.sticker = STICKERS[0];
    this.caption = '';
    this.canvas = document.createElement('canvas');
  }

  /** Grabs the current 3D view (call right after rendering). */
  capture(glCanvas) {
    const url = glCanvas.toDataURL('image/png');
    this.stickers = [];
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => { this.src = img; res(); };
      img.src = url;
    });
  }

  /** Draws the finished postcard onto this.canvas. */
  draw() {
    const img = this.src;
    if (!img) return this.canvas;
    const ph = Math.round(OUT_W * img.height / img.width); // photo area
    const pad = this.frame === 'none' ? 0 : Math.round(OUT_W * 0.035);
    const bottom = this.frame === 'polaroid' ? Math.round(OUT_W * 0.13) : pad;
    const c = this.canvas;
    c.width = OUT_W + pad * 2; c.height = ph + pad + bottom;
    const ctx = c.getContext('2d');
    // Frame background
    if (this.frame === 'polaroid') { ctx.fillStyle = '#fbfaf5'; ctx.fillRect(0, 0, c.width, c.height); }
    else if (this.frame === 'rainbow') {
      const g = ctx.createLinearGradient(0, 0, c.width, c.height);
      ['#e5484d', '#f2862e', '#f5c518', '#4caf50', '#3b82f6', '#9b5de5'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
      ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    } else if (this.frame === 'stars') {
      ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 90; i++) { const x = (i * 97) % c.width, y = (i * 53 + (i % 7) * 31) % c.height; if (x > pad && x < c.width - pad && y > pad && y < c.height - bottom) continue; ctx.font = `${10 + (i % 4) * 5}px system-ui`; ctx.fillText('✦', x, y); }
    }
    // Photo with filter
    ctx.drawImage(img, pad, pad, OUT_W, ph);
    if (this.filter !== 'normal') this.applyFilter(ctx, pad, pad, OUT_W, ph);
    // Stickers
    for (const s of this.stickers) {
      ctx.font = `${Math.round(OUT_W * 0.07 * s.s)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.e, pad + s.x * OUT_W, pad + s.y * ph);
    }
    // Caption on the Polaroid strip
    if (this.frame === 'polaroid' && this.caption) {
      ctx.fillStyle = '#2b2f3a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(OUT_W * 0.04)}px "Comic Sans MS", "Chalkboard SE", system-ui, sans-serif`;
      ctx.fillText(this.caption.slice(0, 40), c.width / 2, ph + pad + bottom / 2, c.width - pad * 2);
    }
    // A tiny watermark
    ctx.font = `${Math.round(OUT_W * 0.016)}px system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = this.frame === 'polaroid' ? 'rgba(40,40,50,.45)' : 'rgba(255,255,255,.7)';
    ctx.fillText('MiniCrafter', c.width - Math.max(pad, 10), c.height - Math.max(4, (bottom - OUT_W * 0.02) / 4));
    return c;
  }

  applyFilter(ctx, x, y, w, h) {
    const d = ctx.getImageData(x, y, w, h);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      let r = p[i], g = p[i + 1], b = p[i + 2];
      if (this.filter === 'bw') { const v = 0.3 * r + 0.59 * g + 0.11 * b; r = g = b = v; }
      else if (this.filter === 'warm') { r = r * 1.1 + 12; g = g * 1.03 + 4; b = b * 0.88; }
      else if (this.filter === 'cool') { r = r * 0.9; g = g * 1.0 + 4; b = b * 1.12 + 14; }
      else if (this.filter === 'retro') { const v = 0.3 * r + 0.59 * g + 0.11 * b; r = v * 0.6 + r * 0.4 + 30; g = v * 0.6 + g * 0.4 + 14; b = v * 0.6 + b * 0.4 - 10; }
      p[i] = r < 0 ? 0 : r > 255 ? 255 : r; p[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; p[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    if (this.filter === 'retro') { // soft vignette
      ctx.putImageData(d, x, y);
      const v = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,0,0.45)');
      ctx.fillStyle = v; ctx.fillRect(x, y, w, h);
      return;
    }
    ctx.putImageData(d, x, y);
  }

  /** Where on the photo (0..1) a click on the displayed canvas landed, or null if it was on the frame. */
  photoPoint(evt, el) {
    const r = el.getBoundingClientRect();
    const c = this.canvas;
    const pad = this.frame === 'none' ? 0 : Math.round(OUT_W * 0.035);
    const ph = c.height - pad - (this.frame === 'polaroid' ? Math.round(OUT_W * 0.13) : pad);
    const cx = (evt.clientX - r.left) / r.width * c.width, cy = (evt.clientY - r.top) / r.height * c.height;
    const x = (cx - pad) / OUT_W, y = (cy - pad) / ph;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
  }

  addSticker(pt) { if (this.stickers.length < 30) this.stickers.push({ e: this.sticker, x: pt.x, y: pt.y, s: 0.8 + Math.random() * 0.5 }); }

  blob() { return new Promise((res) => this.draw().toBlob(res, 'image/png')); }
}
