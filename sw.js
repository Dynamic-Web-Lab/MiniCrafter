// Service worker: caches the whole game so it works offline once loaded.
// Bump VERSION whenever files change so players get the update.
const VERSION = 'minicrafter-v6';
const CORE = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './vendor/three.module.js', './vendor/blockly.min.js',
  './src/audio.js',
  './src/blocks.js',
  './src/craftui.js',
  './src/inventory.js',
  './src/items.js',
  './src/main.js',
  './src/mobs.js',
  './src/noise.js',
  './src/particles.js',
  './src/player.js',
  './src/quests.js',
  './src/robot.js',
  './src/robotblocks.js',
  './src/robotui.js',
  './src/sky.js',
  './src/survival.js',
  './src/textures.js',
  './src/tools.js',
  './src/touch.js',
  './src/villages.js',
  './src/world.js',
  './src/worlds.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate for our own files: instant (and offline) from the
// cache, refreshed in the background when online.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const network = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  }));
});
