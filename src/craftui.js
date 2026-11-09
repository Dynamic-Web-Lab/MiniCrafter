// Survival inventory + recipe-book crafting screen.
// Kid-friendly: click a recipe to craft it (no grid patterns to memorise).
import { ITEMS, RECIPES, itemIcon, itemName } from './items.js';

const $ = (id) => document.getElementById(id);
const STATION_LABEL = { table: 'Crafting Table', furnace: 'Furnace' };

export class CraftUI {
  /**
   * @param {object} o
   * @param {() => import('./inventory.js').Inventory} o.getInv
   * @param {HTMLCanvasElement} o.atlasCanvas
   * @param {() => Set<string>} o.stations  stations within reach ('table', 'furnace')
   * @param {(recipe) => void} o.onCraft
   * @param {() => void} o.onChange
   */
  constructor(o) {
    Object.assign(this, o);
    this.cursor = null; // stack held by the mouse
    this.near = new Set();
    this.cursorEl = $('cursor-stack');
    document.addEventListener('mousemove', (e) => {
      this.cursorEl.style.left = e.clientX + 'px';
      this.cursorEl.style.top = e.clientY + 'px';
    });
  }

  icon(id) { return itemIcon(this.atlasCanvas, id); }

  open() {
    this.near = this.stations();
    $('craft').classList.remove('hidden');
    this.render();
  }

  close() {
    // Never lose an item held on the cursor.
    if (this.cursor) {
      const left = this.getInv().add(this.cursor.id, this.cursor.count);
      // If the inventory is completely full, keep the rest on the cursor for next time.
      this.cursor = left > 0 ? { id: this.cursor.id, count: left } : null;
    }
    this.cursorEl.classList.add('hidden');
    $('craft').classList.add('hidden');
    this.onChange();
  }

  slotHTML(s) {
    if (!s) return '';
    return `<img alt="${itemName(s.id)}" title="${itemName(s.id)}" src="${this.icon(s.id)}">${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}`;
  }

  render() {
    const inv = this.getInv();
    const mk = (container, from, to) => {
      container.innerHTML = '';
      for (let i = from; i < to; i++) {
        const d = document.createElement('div');
        d.className = 'slot';
        d.innerHTML = this.slotHTML(inv.slots[i]);
        d.addEventListener('mousedown', (e) => { e.preventDefault(); this.clickSlot(i, e.button === 2); });
        container.appendChild(d);
      }
    };
    mk($('backpack'), 9, 36);
    mk($('craft-hotbar'), 0, 9);

    // Cursor
    if (this.cursor) {
      this.cursorEl.innerHTML = this.slotHTML(this.cursor);
      this.cursorEl.classList.remove('hidden');
    } else this.cursorEl.classList.add('hidden');

    // Stations note
    const parts = [];
    parts.push(this.near.has('table') ? '✅ Crafting Table nearby' : '❌ No Crafting Table nearby');
    parts.push(this.near.has('furnace') ? '✅ Furnace nearby' : '❌ No Furnace nearby');
    $('station-note').textContent = parts.join('   ');

    // Recipes: craftable first, then the ones you have the station for, then the rest.
    const list = RECIPES.map((r) => ({ r, ...this.check(r) }))
      .sort((a, b) => (b.ok - a.ok) || (b.stationOk - a.stationOk));
    const box = $('recipes');
    box.innerHTML = '';
    for (const { r, ok, stationOk, have } of list) {
      const b = document.createElement('button');
      b.className = 'recipe ' + (ok ? 'ok' : 'no');
      const ins = r.inputs.map(([id, n], k) => `<span class="${have[k] < n ? 'missing' : ''}"><img alt="" src="${this.icon(id)}">${have[k]}/${n} ${itemName(id)}</span>`).join('');
      const badge = r.station ? (stationOk ? `Uses ${STATION_LABEL[r.station]}` : `Needs ${STATION_LABEL[r.station]}`) : 'Craft anywhere';
      b.innerHTML = `<img class="out" alt="" src="${this.icon(r.out)}">
        <div><div class="name">${itemName(r.out)}${r.count > 1 ? ` ×${r.count}` : ''}</div><div class="ins">${ins}</div></div>
        <span class="badge">${badge}</span>`;
      b.disabled = !ok;
      b.addEventListener('click', () => this.craft(r));
      box.appendChild(b);
    }
  }

  check(r) {
    const inv = this.getInv();
    const have = r.inputs.map(([id]) => inv.count(id));
    const stationOk = !r.station || this.near.has(r.station);
    const enough = r.inputs.every(([, n], k) => have[k] >= n);
    return { ok: stationOk && enough, stationOk, have };
  }

  craft(r) {
    const inv = this.getInv();
    if (!this.check(r).ok) return;
    for (const [id, n] of r.inputs) inv.remove(id, n);
    const left = inv.add(r.out, r.count);
    if (left > 0) { // inventory full: hand the rest to the cursor if empty, else give back ingredients
      if (!this.cursor) this.cursor = { id: r.out, count: left };
      else { inv.remove(r.out, r.count - left); for (const [id, n] of r.inputs) inv.add(id, n); return; }
    }
    this.onCraft(r);
    this.render();
    this.onChange();
  }

  clickSlot(i, right) {
    const inv = this.getInv();
    const s = inv.slots[i];
    const c = this.cursor;
    const max = (id) => ITEMS.get(id)?.stack ?? 64;
    if (!c) {
      if (!s) return;
      if (right && s.count > 1) { // pick up half
        const half = Math.ceil(s.count / 2);
        this.cursor = { id: s.id, count: half };
        s.count -= half;
      } else { this.cursor = s; inv.slots[i] = null; }
    } else if (!s) {
      if (right) { inv.slots[i] = { id: c.id, count: 1 }; c.count--; if (!c.count) this.cursor = null; }
      else { inv.slots[i] = c; this.cursor = null; }
    } else if (s.id === c.id) {
      const room = max(s.id) - s.count;
      const n = Math.min(room, right ? 1 : c.count);
      s.count += n; c.count -= n;
      if (!c.count) this.cursor = null;
    } else { // swap
      inv.slots[i] = c; this.cursor = s;
    }
    this.render();
    this.onChange();
  }
}
