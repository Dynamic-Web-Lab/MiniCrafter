// On-screen controls for tablets and phones.
// Left: virtual joystick to walk. Right: drag to look around.
// Quick tap = place / use (like right click). Press and hold = mine (like left click).
const HOLD_MS = 280;
const TAP_MOVE = 12; // px a finger can drift and still count as a tap/hold

export function isTouchDevice() {
  const forced = new URLSearchParams(location.search).get('touch');
  if (forced === '1') return true;
  if (forced === '0') return false;
  return matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
}

export class TouchControls {
  /**
   * @param {object} cb callbacks: look(dx,dy), tap(), holdStart(), holdEnd(),
   *   button(name, down) for 'jump' | 'down' | 'fly' | 'inventory' | 'pause'
   */
  constructor(cb) {
    this.cb = cb;
    this.move = { x: 0, y: 0 }; // joystick: x = strafe (-1..1), y = forward (-1..1)
    this.root = document.getElementById('touch');
    this.root.classList.remove('hidden');
    this.stick = document.getElementById('stick');
    this.knob = document.getElementById('stick-knob');
    this.stickId = null;
    this.looks = new Map(); // touchId -> { x, y, sx, sy, t, moved, holdTimer, holding }
    this.enabled = false;

    const area = document.getElementById('touch-look');
    area.addEventListener('touchstart', (e) => this.lookStart(e), { passive: false });
    area.addEventListener('touchmove', (e) => this.lookMove(e), { passive: false });
    area.addEventListener('touchend', (e) => this.lookEnd(e), { passive: false });
    area.addEventListener('touchcancel', (e) => this.lookEnd(e), { passive: false });

    this.stick.addEventListener('touchstart', (e) => this.stickStart(e), { passive: false });
    this.stick.addEventListener('touchmove', (e) => this.stickMove(e), { passive: false });
    this.stick.addEventListener('touchend', (e) => this.stickEnd(e), { passive: false });
    this.stick.addEventListener('touchcancel', (e) => this.stickEnd(e), { passive: false });

    for (const btn of this.root.querySelectorAll('[data-btn]')) {
      const name = btn.dataset.btn;
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); btn.classList.add('down'); cb.button(name, true); }, { passive: false });
      const up = (e) => { e.preventDefault(); btn.classList.remove('down'); cb.button(name, false); };
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('touchcancel', up, { passive: false });
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.root.classList.toggle('active', on);
    if (!on) this.reset();
  }

  reset() {
    this.move.x = this.move.y = 0;
    this.knob.style.transform = '';
    this.stickId = null;
    for (const l of this.looks.values()) { clearTimeout(l.holdTimer); if (l.holding) this.cb.holdEnd(); }
    this.looks.clear();
  }

  // ---------- joystick ----------
  stickStart(e) {
    e.preventDefault();
    if (this.stickId !== null) return;
    const t = e.changedTouches[0];
    this.stickId = t.identifier;
    this.stickMove(e);
  }

  stickMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== this.stickId) continue;
      const r = this.stick.getBoundingClientRect();
      const R = r.width / 2;
      let dx = t.clientX - (r.left + R), dy = t.clientY - (r.top + R);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // small dead zone, then full range
      const nx = dx / R, ny = dy / R, mag = Math.hypot(nx, ny);
      const k = mag < 0.15 ? 0 : Math.min(1, (mag - 0.15) / 0.75) / mag;
      this.move.x = nx * k;
      this.move.y = -ny * k;
    }
  }

  stickEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== this.stickId) continue;
      this.stickId = null;
      this.move.x = this.move.y = 0;
      this.knob.style.transform = '';
    }
  }

  // ---------- look / tap / hold ----------
  lookStart(e) {
    e.preventDefault();
    if (!this.enabled) return;
    for (const t of e.changedTouches) {
      const l = { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t: performance.now(), moved: false, holding: false };
      l.holdTimer = setTimeout(() => {
        if (!l.moved) { l.holding = true; this.cb.holdStart(); }
      }, HOLD_MS);
      this.looks.set(t.identifier, l);
    }
  }

  lookMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const l = this.looks.get(t.identifier);
      if (!l) continue;
      const dx = t.clientX - l.x, dy = t.clientY - l.y;
      l.x = t.clientX; l.y = t.clientY;
      if (!l.moved && Math.hypot(l.x - l.sx, l.y - l.sy) > TAP_MOVE) l.moved = true;
      if (l.moved || l.holding) this.cb.look(dx, dy);
    }
  }

  lookEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const l = this.looks.get(t.identifier);
      if (!l) continue;
      this.looks.delete(t.identifier);
      clearTimeout(l.holdTimer);
      if (l.holding) this.cb.holdEnd();
      else if (!l.moved && performance.now() - l.t < HOLD_MS) this.cb.tap();
    }
  }
}
