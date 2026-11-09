// One-click share links: a world's seed + edits, gzip-compressed into the URL
// hash. Shared data is UNTRUSTED: it is size-capped and strictly validated,
// and it is only ever added as a new world (never overwriting one).
import { BLOCKS } from './blocks.js';
import { CS, CH } from './world.js';

export const MAX_LINK_CHARS = 12000;   // longer links get awkward to send
const MAX_DECODED = 2_000_000;         // bytes after decompression
const MAX_EDITS = 200_000;
const CHUNK_CELLS = CS * CS * CH;

const toB64Url = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (str) => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_DECODED) { reader.cancel(); throw new Error('too big'); }
    chunks.push(value);
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
}

/** Builds a share link for a world, or returns { tooBig: true }. */
export async function makeShareLink(meta, save, baseUrl) {
  const payload = { v: 1, name: meta.name, seed: String(meta.seed), mode: meta.mode, edits: save?.edits || {} };
  const data = toB64Url(await gzip(JSON.stringify(payload)));
  const url = `${baseUrl}#w=${data}`;
  return url.length > MAX_LINK_CHARS ? { tooBig: true, length: url.length } : { url };
}

/** Strictly validates a decoded payload. Returns a clean copy or throws. */
export function validateShared(p) {
  if (!p || typeof p !== 'object' || p.v !== 1) throw new Error('not a MiniCrafter link');
  const name = typeof p.name === 'string' ? p.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 30) : '';
  const seed = typeof p.seed === 'string' || typeof p.seed === 'number' ? String(p.seed).slice(0, 40) : null;
  if (seed === null || seed === '') throw new Error('missing seed');
  const mode = p.mode === 'survival' ? 'survival' : 'creative';
  const edits = {};
  let count = 0;
  if (p.edits && typeof p.edits === 'object') {
    for (const [key, list] of Object.entries(p.edits)) {
      if (!/^-?\d{1,6},-?\d{1,6}$/.test(key) || !Array.isArray(list)) throw new Error('bad edits');
      const clean = [];
      for (const e of list) {
        if (!Array.isArray(e) || e.length !== 2) throw new Error('bad edit');
        const [i, id] = e;
        if (!Number.isInteger(i) || i < 0 || i >= CHUNK_CELLS || !Number.isInteger(id) || !BLOCKS[id]) throw new Error('bad edit');
        clean.push([i, id]);
        if (++count > MAX_EDITS) throw new Error('too many edits');
      }
      edits[key] = clean;
    }
  }
  return { name: name || 'Shared world', seed, mode, edits };
}

/** Reads a world from a "#w=..." hash. Returns null if there is none. */
export async function readSharedFromHash(hash) {
  if (!hash || !hash.startsWith('#w=')) return null;
  const data = hash.slice(3);
  if (data.length > MAX_LINK_CHARS * 2 || !/^[A-Za-z0-9_-]+$/.test(data)) throw new Error('bad link');
  const text = await gunzip(fromB64Url(data));
  return validateShared(JSON.parse(text));
}
