// Adventure mode helpers: XP / levels and the grown-up gate.
import { B } from './blocks.js';

/** XP needed to go from `level` to the next one. */
export const xpNeeded = (level) => 10 + level * 5;

/** XP for mining these blocks (Adventure). */
export const MINING_XP = { [B.COAL_ORE]: 1, [B.IRON_ORE]: 3, [B.GOLD_ORE]: 5, [B.DIAMOND_ORE]: 10 };

/** Adds XP to { xp, level }. Returns how many levels were gained. */
export function addXp(st, n) {
  st.xp += n;
  let gained = 0;
  while (st.xp >= xpNeeded(st.level)) { st.xp -= xpNeeded(st.level); st.level++; gained++; }
  return gained;
}

// ---------- grown-up gate ----------
// A speed bump that keeps little kids out of Adventure (monsters, danger, losing
// items). It is not security: older kids can pass it, and that is fine.
const KEY = 'minicrafter:adventure-ok';
const $ = (id) => document.getElementById(id);

export const gateUnlocked = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

let pending = null;
let answer = 0;

export function showGate(onPass, onCancel) {
  if (gateUnlocked()) { onPass(); return; }
  pending = { onPass, onCancel };
  const a = 6 + Math.floor(Math.random() * 7), b = 6 + Math.floor(Math.random() * 7);
  answer = a * b;
  $('gate-q').textContent = `${a} × ${b} = ?`;
  $('gate-a').value = '';
  $('gate-err').textContent = '';
  $('gate').classList.remove('hidden');
  setTimeout(() => $('gate-a').focus(), 50);
}

function check() {
  if (Number($('gate-a').value) === answer) {
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    $('gate').classList.add('hidden');
    const p = pending; pending = null;
    p?.onPass();
  } else {
    $('gate-err').textContent = 'Not quite. Ask a grown-up!';
  }
}

export function initGate() {
  $('gate-ok').addEventListener('click', check);
  $('gate-a').addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); e.stopPropagation(); });
  $('gate-cancel').addEventListener('click', () => {
    $('gate').classList.add('hidden');
    const p = pending; pending = null;
    p?.onCancel?.();
  });
}
