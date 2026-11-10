// "What's new": a short card shown once after an update, so returning players hear about
// new things (players never read changelogs). Brand-new players don't see it: everything
// is new to them.
//
// To announce a release: bump VERSION in sw.js, then add an entry at the TOP of NEWS with
// the same number. Small bug-fix releases can skip the news (the card only shows entries
// newer than the last one this player saw).
export const NEWS = [
  {
    v: 31,
    title: 'Pets got upgrades!',
    items: [
      ['🛡️', 'Pet armor: craft a Cozy Pet Coat, Iron or Starlight armor and give it to your dog or cat. It keeps them safe.'],
      ['🎒', 'Pet Backpack: give one to your pet and it carries 9 things for you. Tap your pet to look inside.'],
      ['🛏️', 'Pet Beds and Doghouses: pets nap there and get their hearts back.'],
      ['🔧', 'Fixes: Bit works on iPhone again, and new versions now arrive straight away.'],
    ],
  },
];

const SEEN = 'minicrafter:news-seen';

/** The news this player hasn't seen yet (newest first), or [] for a new player or none. */
export function unseenNews(store = localStorage) {
  const latest = NEWS[0]?.v || 0;
  let seen = null;
  try { seen = Number(store.getItem(SEEN)) || null; } catch { return []; }
  if (seen === null) {
    // First time with news: a returning player already has something saved; a new player doesn't.
    let returning = false;
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith('minicrafter:') && k !== SEEN && k !== 'minicrafter:settings:v1') { returning = true; break; }
      }
    } catch { /* ignore */ }
    if (!returning) { markNewsSeen(store); return []; }
    seen = 0;
  }
  return NEWS.filter((n) => n.v > seen).slice(0, 2);
}

export function markNewsSeen(store = localStorage) {
  try { store.setItem(SEEN, String(NEWS[0]?.v || 0)); } catch { /* private mode: fine */ }
}
