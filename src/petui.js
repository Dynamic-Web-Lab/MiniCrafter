// Pet panel: a pet's health, armor and backpack (9 slots), in the same click-to-pick-up style as the
// crafting screen. Opens when you right-click a pet that wears armor or a backpack.
import { ITEMS, I, itemIcon, itemName, PET_BAG_SLOTS } from './items.js';
import { PET_MAX_HP } from './mobs.js';

const $ = (id) => document.getElementById(id);

export class PetUI {
  /**
   * @param {object} o
   * @param {() => import('./inventory.js').Inventory} o.getInv
   * @param {HTMLCanvasElement} o.atlasCanvas
   * @param {() => boolean} o.isSurvival  creative has no inventory, so the bag is filled from the held item
   * @param {() => number} o.getHeld      id of the selected hotbar item (creative)
   * @param {(mob) => string|boolean} o.onSit  toggles sit/follow, returns the new state
   * @param {() => void} o.onChange
   * @param {(text: string) => void} o.toast
   */
  constructor(o) {
    Object.assign(this, o);
    this.mob = null;
    this.cursor = null;
    this.cursorEl = $('cursor-stack');
    $('pet-armor-off').addEventListener('click', () => this.takeOffArmor());
    $('pet-bag-off').addEventListener('click', () => this.takeOffBag());
    $('pet-sit').addEventListener('click', () => { if (this.mob) { this.onSit(this.mob); this.render(); } });
  }

  icon(id) { return itemIcon(this.atlasCanvas, id); }

  open(mob) { this.mob = mob; $('pet').classList.remove('hidden'); this.render(); }

  close() {
    if (this.cursor && this.isSurvival()) { // never lose an item held on the cursor
      let left = this.getInv().add(this.cursor.id, this.cursor.count);
      for (let i = 0; left > 0 && this.mob?.bag && i < PET_BAG_SLOTS; i++) if (!this.mob.bag[i]) { this.mob.bag[i] = { id: this.cursor.id, count: left }; left = 0; }
      this.cursor = left > 0 ? { id: this.cursor.id, count: left } : null;
    }
    this.cursor = null;
    this.cursorEl.classList.add('hidden');
    $('pet').classList.add('hidden');
    this.mob = null;
    this.onChange();
  }

  slotHTML(s) {
    if (!s) return '';
    return `<img alt="${itemName(s.id)}" title="${itemName(s.id)}" src="${this.icon(s.id)}">${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}`;
  }

  render() {
    const m = this.mob;
    if (!m) return;
    $('pet-title').textContent = `${m.petName || 'Your pet'} the ${m.type}`;
    const full = Math.round(m.petHp / 2), total = PET_MAX_HP / 2;
    $('pet-hearts').textContent = '❤️'.repeat(full) + '🤍'.repeat(Math.max(0, total - full)) + (m.petHp < PET_MAX_HP ? '  Resting in a pet bed helps!' : '');
    const def = ITEMS.get(m.armor);
    $('pet-armor-name').textContent = def ? `${def.name} (blocks ${Math.round(def.petArmor * 100)}% of bumps)` : 'No armor. Right-click your pet holding pet armor.';
    $('pet-armor-icon').innerHTML = def ? `<img alt="" src="${this.icon(m.armor)}">` : '';
    $('pet-armor-off').classList.toggle('hidden', !def);
    $('pet-sit').textContent = m.sitting || m.toBed ? 'Come with me' : 'Sit / go to bed';
    $('pet-bag-wrap').classList.toggle('hidden', !m.bag);
    if (m.bag) this.fill($('pet-bag'), m.bag, 0, PET_BAG_SLOTS);
    const surv = this.isSurvival();
    $('pet-inv-wrap').classList.toggle('hidden', !surv || !m.bag);
    if (surv && m.bag) {
      const inv = this.getInv();
      this.fill($('pet-backpack'), inv.slots, 9, 36);
      this.fill($('pet-hotbar'), inv.slots, 0, 9);
    }
    $('pet-note').textContent = !m.bag ? 'Give your pet a Pet Backpack to carry 9 stacks of stuff for you.'
      : surv ? 'Click an item to pick it up, then click a slot to put it down.'
        : 'Creative: click an empty slot to add the item you are holding, or a full slot to clear it.';
    if (this.cursor) { this.cursorEl.innerHTML = this.slotHTML(this.cursor); this.cursorEl.classList.remove('hidden'); } else this.cursorEl.classList.add('hidden');
  }

  fill(container, arr, from, to) {
    container.innerHTML = '';
    for (let i = from; i < to; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.innerHTML = this.slotHTML(arr[i]);
      d.addEventListener('mousedown', (e) => { e.preventDefault(); this.click(arr, i, e.button === 2); });
      container.appendChild(d);
    }
  }

  click(arr, i, right) {
    if (!this.isSurvival()) { // creative: no stock to move around
      if (arr !== this.mob.bag) return;
      if (arr[i]) arr[i] = null;
      else { const id = this.getHeld(); if (ITEMS.has(id)) arr[i] = { id, count: Math.min(ITEMS.get(id).stack ?? 64, 16) }; }
      this.render(); this.onChange();
      return;
    }
    const s = arr[i], c = this.cursor;
    const max = (id) => ITEMS.get(id)?.stack ?? 64;
    if (!c) {
      if (!s) return;
      if (right && s.count > 1) { const half = Math.ceil(s.count / 2); this.cursor = { id: s.id, count: half }; s.count -= half; }
      else { this.cursor = s; arr[i] = null; }
    } else if (!s) {
      if (right) { arr[i] = { id: c.id, count: 1 }; c.count--; if (!c.count) this.cursor = null; }
      else { arr[i] = c; this.cursor = null; }
    } else if (s.id === c.id) {
      const n = Math.min(max(s.id) - s.count, right ? 1 : c.count);
      s.count += n; c.count -= n;
      if (!c.count) this.cursor = null;
    } else { arr[i] = c; this.cursor = s; }
    this.render(); this.onChange();
  }

  takeOffArmor() {
    const m = this.mob;
    if (!m?.armor) return;
    const id = m.armor;
    if (this.isSurvival() && !this.getInv().canFit(id, 1)) { this.toast('Your inventory is full'); return; }
    this.mobs.removeArmor(m);
    if (this.isSurvival()) this.getInv().add(id, 1);
    this.render(); this.onChange();
  }

  takeOffBag() {
    const m = this.mob;
    if (!m?.bag) return;
    const inv = this.getInv(), surv = this.isSurvival();
    if (surv) {
      // Everything has to fit back in your pockets: the pet never drops or loses anything.
      const spare = inv.slots.filter((s) => !s).length;
      const stacks = m.bag.filter(Boolean).length;
      if (spare < stacks + 1 && !(stacks === 0 && inv.canFit(I.PET_BACKPACK, 1))) { this.toast('Make some room in your inventory first'); return; }
      for (let i = 0; i < PET_BAG_SLOTS; i++) { const s = m.bag[i]; if (s) { inv.add(s.id, s.count); m.bag[i] = null; } }
      inv.add(I.PET_BACKPACK, 1);
    }
    this.mobs.setBackpack(m, false);
    this.render(); this.onChange();
  }
}
