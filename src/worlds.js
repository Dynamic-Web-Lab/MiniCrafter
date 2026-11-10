// Several saved worlds per browser (for siblings and classrooms).
// Index:  minicrafter:worlds   -> [{ id, name, seed, mode, created, played, stars }]
// Saves:  minicrafter:world:<id> -> full world save (same shape as before)
// Current: minicrafter:current -> id
const INDEX = 'minicrafter:worlds';
const CURRENT = 'minicrafter:current';
const LEGACY = 'minicrafter:save:v1';
const key = (id) => `minicrafter:world:${id}`;

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

export const FUN_NAMES = ['Sunny Valley', 'Crystal Caves', 'Pancake Plains', 'Dragon Peak', 'Rainbow Island', 'Mossy Woods', 'Snowball Hills', 'Pirate Bay', 'Cookie Canyon', 'Starlight Meadow'];

export class WorldStore {
  constructor() {
    this.worlds = Array.isArray(read(INDEX)) ? read(INDEX) : [];
    this.migrateLegacy();
  }

  /** Moves the single pre-worlds save into the list as "My World". */
  migrateLegacy() {
    const legacy = read(LEGACY);
    if (!legacy || legacy.seed == null) return;
    const w = this.add({ name: 'My World', seed: String(legacy.seed), mode: legacy.mode || 'creative' });
    write(key(w.id), legacy);
    drop(LEGACY);
    this.setCurrent(w.id);
  }

  saveIndex() { write(INDEX, this.worlds); }

  add({ name, seed, mode, hardcore }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = Date.now();
    const w = { id, name: (name || '').trim().slice(0, 30) || this.suggestName(), seed: String(seed), mode: ['survival', 'adventure'].includes(mode) ? mode : 'creative', hardcore: mode === 'adventure' && !!hardcore, created: now, played: now, stars: 0 };
    this.worlds.unshift(w);
    this.saveIndex();
    return w;
  }

  get(id) { return this.worlds.find((w) => w.id === id) || null; }
  load(id) { return read(key(id)); }

  save(id, data, meta = {}) {
    const ok = write(key(id), data);
    const w = this.get(id);
    if (w) { Object.assign(w, meta, { played: Date.now() }); this.saveIndex(); }
    return ok;
  }

  rename(id, name) {
    const w = this.get(id);
    if (!w || !name.trim()) return;
    w.name = name.trim().slice(0, 30);
    this.saveIndex();
  }

  remove(id) {
    this.worlds = this.worlds.filter((w) => w.id !== id);
    drop(key(id));
    this.saveIndex();
    if (this.currentId === id) drop(CURRENT);
  }

  get currentId() { try { return localStorage.getItem(CURRENT); } catch { return null; } }
  setCurrent(id) { try { localStorage.setItem(CURRENT, id); } catch { /* ignore */ } }

  /** Most recently played first. */
  sorted() { return [...this.worlds].sort((a, b) => b.played - a.played); }

  suggestName() {
    const used = new Set(this.worlds.map((w) => w.name));
    return FUN_NAMES.find((n) => !used.has(n)) || `World ${this.worlds.length + 1}`;
  }

  /** A downloadable copy of one world (for backups or sharing with a friend). */
  exportBlob(id) {
    const w = this.get(id);
    const data = { minicrafter: 1, world: { name: w.name, seed: w.seed, mode: w.mode }, save: this.load(id) };
    return new Blob([JSON.stringify(data)], { type: 'application/json' });
  }

  /** Imports a file made by exportBlob. Returns the new world entry. */
  importText(text) {
    const data = JSON.parse(text);
    if (!data || data.minicrafter !== 1 || !data.world || data.world.seed == null) throw new Error('Not a MiniCrafter world file');
    const w = this.add({ name: `${data.world.name || 'Imported'}`, seed: data.world.seed, mode: data.world.mode });
    if (data.save) write(key(w.id), data.save);
    return w;
  }
}
