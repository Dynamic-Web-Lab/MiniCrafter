// Survival inventory: 36 slots (0–8 are the hotbar). Each slot is {id, count} or null.
import { ITEMS } from './items.js';

export const SLOTS = 36;

export class Inventory {
  constructor() { this.slots = new Array(SLOTS).fill(null); }

  maxStack(id) { return ITEMS.get(id)?.stack ?? 64; }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  /** Adds items; returns how many did not fit. Fills existing stacks, then hotbar, then backpack. */
  add(id, count = 1) {
    const max = this.maxStack(id);
    for (const s of this.slots) {
      if (count <= 0) break;
      if (s && s.id === id && s.count < max) {
        const n = Math.min(count, max - s.count);
        s.count += n; count -= n;
      }
    }
    for (let i = 0; i < SLOTS && count > 0; i++) {
      if (this.slots[i]) continue;
      const n = Math.min(count, max);
      this.slots[i] = { id, count: n };
      count -= n;
    }
    return count;
  }

  /** Removes up to `count` of id (backpack first so the hotbar stays stocked). */
  remove(id, count = 1) {
    const order = [...Array(SLOTS).keys()].reverse();
    for (const i of order) {
      const s = this.slots[i];
      if (count <= 0) break;
      if (!s || s.id !== id) continue;
      const n = Math.min(count, s.count);
      s.count -= n; count -= n;
      if (s.count <= 0) this.slots[i] = null;
    }
    return count === 0;
  }

  takeFromSlot(i, count = 1) {
    const s = this.slots[i];
    if (!s) return false;
    s.count -= count;
    if (s.count <= 0) this.slots[i] = null;
    return true;
  }

  /** Space check for crafting output (ignores ingredients that will be freed). */
  canFit(id, count) {
    const max = this.maxStack(id);
    let room = 0;
    for (const s of this.slots) {
      if (!s) room += max;
      else if (s.id === id) room += max - s.count;
      if (room >= count) return true;
    }
    return false;
  }

  toJSON() { return this.slots.map((s) => (s ? [s.id, s.count] : 0)); }

  static fromJSON(arr) {
    const inv = new Inventory();
    if (Array.isArray(arr)) arr.slice(0, SLOTS).forEach((s, i) => {
      if (Array.isArray(s) && ITEMS.has(s[0]) && s[1] > 0) inv.slots[i] = { id: s[0], count: Math.min(s[1], inv.maxStack(s[0])) };
    });
    return inv;
  }
}
