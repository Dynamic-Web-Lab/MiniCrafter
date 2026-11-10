// End-to-end smoke test: boots the real game in headless Chromium (software
// WebGL) and exercises each major feature through window.minicrafter.
// Run locally:  npm i --no-save playwright@1.47.2 && npx playwright install chromium && node tests/smoke.mjs
// (or skip the Chromium download and use Chrome: SMOKE_CHANNEL=chrome node tests/smoke.mjs)
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startDevServer } from '../server/dev.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

let failures = 0;
const ok = (cond, name, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures++;
};

// ---------- static checks ----------
const srcFiles = (await readdir(join(ROOT, 'src'))).filter((f) => f.endsWith('.js')).sort();
const sw = await readFile(join(ROOT, 'sw.js'), 'utf8');
const missing = srcFiles.filter((f) => !sw.includes(`'./src/${f}'`));
ok(missing.length === 0, 'sw.js precaches every src/*.js file', missing.length ? `missing: ${missing.join(', ')}` : `${srcFiles.length} files`);

// ---------- tiny static server ----------
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) throw new Error('outside root');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// SMOKE_CHANNEL=chrome uses your installed Google Chrome instead of Playwright's Chromium.
const browser = await chromium.launch({
  channel: process.env.SMOKE_CHANNEL || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// Privacy: the game must never contact a host outside the one serving it (no CDN, fonts, analytics).
const outside = new Set();
const trackOutside = (page) => page.on('request', (rq) => {
  const u = new URL(rq.url());
  if (/^(https?|wss?):$/.test(u.protocol) && !['localhost', '127.0.0.1'].includes(u.hostname)) outside.add(u.origin);
});

async function openGame(query = '', at = base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  trackOutside(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  // CI runners are slow with software WebGL (and Play Together runs two games at once), so be patient.
  await page.goto(at + query, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.minicrafter && window.minicrafter.world, null, { timeout: 90000 });
  await page.evaluate(() => window.minicrafter.step(40));
  return { page, errors };
}

try {
  // ---------- desktop: core game ----------
  const { page, errors } = await openGame();
  const core = await page.evaluate(() => {
    const m = window.minicrafter;
    const chunk = [...m.world.chunks.values()].find((c) => c.meshed && c.meshes.length);
    return {
      chunks: m.world.chunks.size,
      lit: !!chunk?.meshes[0]?.geometry.attributes.lt,
      worlds: m.worlds.worlds.length,
      hotbar: document.querySelectorAll('#hotbar .slot').length,
    };
  });
  ok(core.chunks > 50, 'world generates chunks', `${core.chunks}`);
  ok(core.lit, 'chunks carry voxel light data');
  ok(core.worlds >= 1, 'a saved world exists');
  ok(core.hotbar === 9, 'hotbar has 9 slots');

  const features = await page.evaluate(async () => {
    const m = window.minicrafter;
    const { QUESTS } = await import('./src/quests.js');
    const { villageForRegion } = await import('./src/villages.js');
    const { miningInfo } = await import('./src/items.js');
    const { EXAMPLES } = await import('./src/robot.js');
    const out = {};
    out.quests = QUESTS.length;
    out.village = !!villageForRegion(m.world.terrain, 0, 0);
    out.handStone = !miningInfo(3, null).canHarvest && !!miningInfo(3, 270).canHarvest; // stone: hand no, wooden pickaxe yes

    // Bit builds a 5-block tower out of stone.
    m.forcePlay(); m.setMode('creative'); m.select(2);
    const p = m.player, W = m.world;
    const x = Math.floor(p.pos.x) + 2, z = Math.floor(p.pos.z) + 2, y = 80;
    for (let h = 0; h < 8; h++) W.setBlock(x, y + h, z, 0);
    m.robot.placeAt(x, y, z, 0);
    m.robot.run(EXAMPLES.find((e) => e.id === 'tower').program);
    for (let i = 0; i < 2000 && m.robot.running; i++) m.step(1, 16.7);
    out.robotStatus = m.robot.status;
    out.tower = [0, 1, 2, 3, 4].every((h) => W.getBlock(x, y + h, z) === 3);

    // Animals: spawn and pat a pig, tame a dog.
    const pig = m.mobs.spawn('pig', p.pos.x + 2, p.pos.y, p.pos.z);
    const dog = m.mobs.spawn('dog', p.pos.x - 2, p.pos.y, p.pos.z);
    m.mobs.feed(dog);
    out.animals = !!pig && dog.tamed && !!dog.petName;

    // Blockly editor loads from vendor/.
    m.robotUI.open();
    const t0 = performance.now();
    while (!m.robotUI.ws && !m.robotUI.blocklyFailed && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 200));
    out.blockly = !!m.robotUI.ws;
    m.robotUI.close();

    // Phase 1 fun blocks: a trampoline bounces you up, and the music set recipe gives all 8 notes.
    const { B } = await import('./src/blocks.js');
    const { RECIPES } = await import('./src/items.js');
    const tx = x + 4;
    for (let h = 1; h < 12; h++) W.setBlock(tx, y + h, z, 0);
    W.setBlock(tx, y, z, B.TRAMPOLINE);
    p.flying = false; p.pos.set(tx + 0.5, y + 4, z + 0.5); p.vel.set(0, 0, 0); p.onGround = false;
    let peak = 0, bounced = false;
    const idle = { forward: 0, back: 0, left: 0, right: 0, jump: 0, down: 0, sprint: false };
    const prevBounce = p.onBounce; p.onBounce = () => { bounced = true; };
    for (let i = 0; i < 180; i++) { p.update(1 / 60, idle); if (bounced) peak = Math.max(peak, p.pos.y - (y + 1)); }
    p.onBounce = prevBounce;
    out.bounce = bounced && peak > 3;
    const music = RECIPES.find((r) => r.label && r.label.startsWith('Music Stones'));
    out.musicSet = !!music && 1 + music.extra.length === 8;

    // Phase 2 power tools: shapes respect the size cap, and undo restores blocks.
    const T = await import('./src/tools.js');
    const line = T.lineCells([0, 0, 0], [5, 0, 0]);
    const tooBig = T.boxCells([0, 0, 0], [40, 40, 40]);
    const dome = T.sphereCells([0, 0, 0], [3, 0, 0]);
    m.setMode('creative');
    const ux = x - 3, uy = y + 2;
    W.setBlock(ux, uy, z, 0);
    m.history.begin(); W.setBlock(ux, uy, z, B.BRICK); m.history.commit();
    const placed = W.getBlock(ux, uy, z) === B.BRICK;
    m.undoRedo(false);
    out.tools = line.length === 6 && tooBig === null && dome.length > 50 && placed && W.getBlock(ux, uy, z) === 0;

    // Phase 3 garden: wildflowers generate, watering grows wheat to golden, harvest works.
    let plants = 0;
    for (const c of W.chunks.values()) if (c.meshed) for (const v of c.data) if (v === B.TALL_GRASS || (v >= B.FLOWER_RED && v <= B.FLOWER_PINK)) plants++;
    const gx = x + 6;
    W.setBlock(gx, y - 1, z, B.FARMLAND); W.setBlock(gx, y, z, B.WHEAT_0);
    for (let i = 0; i < 3; i++) m.waterAt({ x: gx, y, z, id: W.getBlock(gx, y, z) });
    out.garden = plants > 20 && W.getBlock(gx, y, z) === B.WHEAT_3;

    // Phase 3b critters: a frog spawns and hops, a pet can wear a hat, fireflies can be caught.
    const frog = m.mobs.spawn('frog', p.pos.x + 3, p.pos.y, p.pos.z);
    m.mobs.wear(dog, 'party');
    const THREE = await import('three');
    const fly = { home: [p.pos.x, p.pos.y + 1, p.pos.z - 2], pos: new THREE.Vector3(p.pos.x, p.pos.y + 2, p.pos.z - 2), phase: 0, life: 99 };
    m.critters.fireflies.push(fly);
    const hit = m.critters.raycastFirefly(new THREE.Vector3(p.pos.x, p.pos.y + 2, p.pos.z), new THREE.Vector3(0, 0, -1), 5);
    out.critters = !!frog && dog.accessory === 'party' && hit?.fly === fly;

    // Phase 4: share links round-trip and reject bad data; portals are found; daily idea shows.
    const S = await import('./src/share.js');
    const link = await S.makeShareLink({ name: 'CI', seed: 'ci', mode: 'creative' }, { edits: { '0,0': [[100, B.BRICK]] } }, 'http://x/');
    const back = await S.readSharedFromHash(new URL(link.url).hash);
    let rejected = false;
    try { S.validateShared({ v: 1, name: 'x', seed: '1', mode: 'creative', edits: { '0,0': [[5, 999]] } }); } catch { rejected = true; }
    const px = x - 6;
    W.setBlock(px, y + 1, z, B.PORTAL_BLUE); W.setBlock(px - 3, y + 1, z, B.PORTAL_BLUE);
    out.phase4 = back.edits['0,0'][0][1] === B.BRICK && rejected && m.findPortals(B.PORTAL_BLUE).length >= 2
      && document.getElementById('idea-text').textContent.length > 5;

    // Adventure A1: hunger + eating, XP levels, tougher falls, lost-items chest; gentle modes unchanged.
    const A = await import('./src/adventure.js');
    const st = { xp: 0, level: 0 };
    const levels = A.addXp(st, 40);
    m.survival.adventure = true; m.survival.hunger = 4;
    const ate = m.survival.eat(5) && m.survival.hunger === 9;
    m.survival.health = 20; m.survival.landed(6); const advFall = 20 - m.survival.health;
    m.survival.adventure = false; m.survival.health = 20; m.survival.landed(6); const gentleFall = 20 - m.survival.health;
    m.survival.health = 20;
    out.adventure = levels === 2 && ate && advFall === 3 && gentleFall === 2 && !!document.getElementById('gate') && B.LOST_CHEST > 0;

    // Adventure A2: monsters stay out of gentle modes; arrows and sword hits defeat them with a poof.
    const THREE2 = await import('three');
    m.mobs.isDay = false;
    const gentleSpawn = m.mobs.hostileEnabled === false;
    const gl = m.mobs.spawn('gloomling', p.pos.x + 4, p.pos.y + 1, p.pos.z);
    let poofed = null; const prevPoof = m.mobs.onPoof; m.mobs.onPoof = (mob, cause) => { poofed = cause; };
    m.projectiles.fire('arrow', new THREE2.Vector3(p.pos.x + 1, gl.pos.y + 0.4, p.pos.z), new THREE2.Vector3(1, 0, 0), 30, 4);
    for (let i = 0; i < 20; i++) m.projectiles.update(1 / 60);
    const arrowHit = gl.hp === 6;
    m.mobs.hurt(gl, 10, p.pos);
    m.mobs.onPoof = prevPoof;
    out.a2 = gentleSpawn && arrowHit && poofed === 'arrow' && !m.mobs.list.includes(gl) && !!document.getElementById('monsters');

    // Adventure A3: Spark circuits. A lever lights a lamp through wire, an inverter flips it, a piston pushes.
    {
      const SP = m.spark, sx = Math.floor(p.pos.x), sy = Math.min(90, Math.floor(p.pos.y) + 8), sz = Math.floor(p.pos.z);
      for (let i = -1; i <= 6; i++) for (let j = 0; j <= 2; j++) W.setBlock(sx + i, sy, sz + j, 0);
      W.setBlock(sx, sy, sz, B.LEVER); W.setBlock(sx + 1, sy, sz, B.WIRE); W.setBlock(sx + 2, sy, sz, B.SPARK_LAMP);
      SP.interact(sx, sy, sz); SP.tick();
      const lit = W.getBlock(sx + 2, sy, sz) === B.SPARK_LAMP_ON;
      W.setBlock(sx, sy, sz + 1, B.BATTERY); W.setBlock(sx + 1, sy, sz + 1, B.INVERTER + 1); W.setBlock(sx + 2, sy, sz + 1, B.SPARK_LAMP);
      SP.tick(); SP.tick();
      const inverted = W.getBlock(sx + 2, sy, sz + 1) === B.SPARK_LAMP;
      W.setBlock(sx, sy, sz + 2, B.LEVER); W.setBlock(sx + 1, sy, sz + 2, B.PISTON + 1); W.setBlock(sx + 2, sy, sz + 2, B.BRICK);
      SP.interact(sx, sy, sz + 2);
      const pushed = W.getBlock(sx + 3, sy, sz + 2) === B.BRICK && W.getBlock(sx + 2, sy, sz + 2) === B.PISTON_HEAD;
      out.a3 = lit && inverted && pushed;
    }

    // Course Maker: start pad starts a timed run, coins are collected, finish records a best time.
    {
      const C = m.course, cx = Math.floor(p.pos.x), cz = Math.floor(p.pos.z), cy = Math.min(88, Math.floor(p.pos.y) + 10);
      for (let i = -1; i <= 6; i++) { W.setBlock(cx + i, cy, cz, B.STONE); for (let h = 1; h < 4; h++) W.setBlock(cx + i, cy + h, cz, 0); }
      W.setBlock(cx, cy, cz, B.COURSE_START); W.setBlock(cx + 5, cy, cz, B.COURSE_FINISH); W.setBlock(cx + 2, cy + 1, cz, B.COIN);
      W.flushDirty();
      const stand = (i) => { p.flying = false; p.pos.set(cx + i + 0.5, cy + 1, cz + 0.5); p.vel.set(0, 0, 0); m.step(3, 16.7); };
      stand(0); const started = !!C.run && C.run.total === 1;
      stand(1); stand(2); const gotCoin = C.run?.coins === 1 && W.getBlock(cx + 2, cy + 1, cz) === B.COIN_TAKEN;
      stand(5); const finished = !C.run && C.best.size === 1;
      out.course = started && gotCoin && finished;
    }

    // Worlds: create a second world, switch back, save round trip.
    const first = m.currentWorldId;
    const w = m.worlds.add({ name: 'CI World', seed: 'ci', mode: 'survival' });
    m.openWorld(w.id);
    out.switched = m.currentWorldId === w.id;
    m.openWorld(first);
    out.back = m.currentWorldId === first;
    m.save();
    out.saved = !!m.worlds.load(first)?.edits;
    return out;
  });
  ok(features.quests >= 36, 'quests are defined', `${features.quests}`);
  ok(features.village, 'a village exists near spawn');
  ok(features.handStone, 'mining rules: stone needs a pickaxe');
  ok(features.robotStatus === 'done' && features.tower, 'Bit builds a 5-block tower', features.robotStatus);
  ok(features.animals, 'animals spawn and a dog can be tamed');
  ok(features.blockly, 'Blockly code editor loads');
  ok(features.bounce, 'trampolines bounce the player more than 3 blocks');
  ok(features.musicSet, 'music stones recipe gives all 8 notes');
  ok(features.tools, 'power tools: shapes, size cap and undo');
  ok(features.garden, 'wildflowers generate and watering grows wheat');
  ok(features.critters, 'frogs spawn, pets wear hats, fireflies can be targeted');
  ok(features.phase4, 'share links round-trip and reject bad data; portals; daily idea');
  ok(features.adventure, 'adventure: XP levels, hunger, tougher falls (gentle modes unchanged)');
  ok(features.a2, 'adventure A2: no monsters in gentle modes; arrows and swords defeat them');
  ok(features.a3, 'adventure A3: spark wire, inverter and piston work');
  ok(features.course, 'course maker: start, coin, finish and best time');
  ok(features.switched && features.back && features.saved, 'worlds: create, switch and save');
  ok(errors.length === 0, 'no console errors (desktop)', errors.slice(0, 3).join(' | '));
  if (failures) await page.screenshot({ path: 'smoke-desktop.png' });
  await page.close();

  // ---------- tablet: touch controls ----------
  const t = await openGame('?touch=1');
  const touch = await t.page.evaluate(() => {
    document.getElementById('btn-play').disabled = false;
    document.getElementById('btn-play').click();
    return document.getElementById('touch').classList.contains('active');
  });
  ok(touch, 'touch controls appear in touch mode');
  // Phones: turning the phone upright pauses and asks for sideways; turning it back carries on.
  // (Waits for the change itself: CI runners render slowly, so a fixed pause isn't enough.)
  const settle = (fn) => t.page.waitForFunction(fn, null, { timeout: 15000 }).then(() => true).catch(() => false);
  await t.page.setViewportSize({ width: 390, height: 844 });
  const askedUpright = await settle(() => !document.getElementById('rotate').classList.contains('hidden') && document.getElementById('hud').classList.contains('hidden'));
  await t.page.setViewportSize({ width: 844, height: 390 });
  const resumed = await settle(() => document.getElementById('rotate').classList.contains('hidden') && !document.getElementById('hud').classList.contains('hidden'));
  ok(askedUpright && resumed, 'phones: upright pauses and asks to turn sideways, sideways carries on');
  // Phones: the survival crafting panel fits an upright phone (its 9-slot rows used to push it
  // sideways). 360px is a common Android width, and the narrowest that matters.
  await t.page.setViewportSize({ width: 360, height: 740 });
  const craftOverflow = await t.page.evaluate(async () => {
    const m = window.minicrafter; m.setMode('survival'); m.forcePlay(); m.openOverlay();
    await new Promise((r) => setTimeout(r, 300));
    const p = document.querySelector('#craft .panel');
    return p.offsetParent ? p.scrollWidth - p.clientWidth : -1;
  });
  ok(craftOverflow === 0, 'phones: crafting panel fits an upright phone', `${craftOverflow}px sideways`);
  ok(t.errors.length === 0, 'no console errors (touch)', t.errors.slice(0, 3).join(' | '));
  await t.page.close();

  // ---------- Online edition: accounts + Play Together through the dev server ----------
  {
    const dev = await startDevServer(0);
    try {
      // Not logged in: the relay refuses (Play Together needs an account).
      const wsBase = dev.url.replace('http', 'ws');
      const refused = await new Promise((res) => {
        const ws = new WebSocket(`${wsBase}rooms`, { headers: { Origin: dev.url.slice(0, -1) } });
        ws.onopen = () => { ws.close(); res(false); }; ws.onerror = () => res(true);
      });
      const host = await openGame('', dev.url), guest = await openGame('', dev.url);
      // Host creates an account through the menu, like a player would.
      await host.page.click('#btn-account');
      await host.page.click('#acc-tab-new');
      await host.page.fill('#acc-user', 'ci_host');
      await host.page.fill('#acc-pass', 'ci-password-1');
      await host.page.fill('#acc-pass2', 'ci-password-1');
      await host.page.selectOption('#acc-year', String(new Date().getFullYear() - 30));
      await host.page.check('#acc-agree');
      await host.page.click('#acc-submit');
      await host.page.waitForFunction(() => window.minicrafter.account.user === 'ci_host', null, { timeout: 10000 });
      const guestReg = await guest.page.evaluate(() => window.minicrafter.account.register('ci_guest', 'ci-password-2'));
      // Sign-up rules on the server: the Terms must be agreed, and under-13s need a grown-up.
      const signup = (body) => fetch(`${dev.url}api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Minicrafter': '1', Origin: dev.url.slice(0, -1) }, body: JSON.stringify(body) })
        .then(async (r) => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }));
      const noTerms = await signup({ username: 'ci_noterms', password: 'ci-password-3' });
      const kidAlone = await signup({ username: 'ci_kid', password: 'ci-password-4', agree: true, terms: '2026-11-10', under13: true, grownup: false });
      const kidWithGrownup = await signup({ username: 'ci_kid2', password: 'ci-password-5', agree: true, terms: '2026-11-10', under13: true, grownup: true });
      const signupRules = noTerms.error === 'terms' && kidAlone.error === 'grownup' && kidWithGrownup.ok;
      await host.page.evaluate(() => { const m = window.minicrafter; m.setMode('creative'); m.forcePlay(); m.together.host(); });
      await host.page.waitForFunction(() => window.minicrafter.together.role === 'host', null, { timeout: 10000 });
      const code = await host.page.evaluate(() => window.minicrafter.together.code);
      await guest.page.evaluate((c) => { window.minicrafter.forcePlay(); window.minicrafter.together.join(c); }, code);
      await host.page.waitForFunction(() => window.minicrafter.together.knocks.size === 1, null, { timeout: 10000 });
      await host.page.evaluate(() => { const t = window.minicrafter.together; t.admit([...t.knocks.keys()][0], true); });
      await guest.page.waitForFunction(() => window.minicrafter.together.role === 'guest', null, { timeout: 30000 });
      const cell = await host.page.evaluate(() => { const p = window.minicrafter.player.pos; const c = [Math.floor(p.x) + 2, Math.min(90, Math.floor(p.y) + 4), Math.floor(p.z)]; window.minicrafter.world.setBlock(...c, 10); return c; });
      const synced = await guest.page.waitForFunction((c) => window.minicrafter.world.getBlock(...c) === 10, cell, { timeout: 10000 }).then(() => true).catch(() => false);
      await guest.page.evaluate((c) => window.minicrafter.world.setBlock(c[0], c[1] + 1, c[2], 22), cell);
      const back = await host.page.waitForFunction((c) => window.minicrafter.world.getBlock(c[0], c[1] + 1, c[2]) === 22, cell, { timeout: 10000 }).then(() => true).catch(() => false);
      const noSave = await guest.page.evaluate(() => window.minicrafter.currentWorldId === null);
      ok(refused && guestReg.ok, 'accounts: register (menu and API); the relay refuses players who are not logged in');
      ok(signupRules, 'accounts: sign-up needs the Terms agreed, and a grown-up for under-13s');
      const legal = await host.page.evaluate(async () => {
        const [p, t] = await Promise.all(['privacy.html', 'terms.html'].map((f) => fetch(f).then((r) => (r.ok ? r.text() : ''))));
        return [p, t].every((x) => x.includes('Dynamic Web Lab FZE LLC') && x.includes('info@dynamicweblab.com') && x.includes('2026-11-10'));
      });
      ok(legal, 'privacy policy and terms pages are served (company, contact, version)');
      ok(synced && back && noSave, 'play together: host lets a friend in, blocks sync both ways, guest never saves', code);
      ok(host.errors.length + guest.errors.length === 0, 'no console errors (online edition)', [...host.errors, ...guest.errors].slice(0, 3).join(' | '));
      await host.page.close(); await guest.page.close();
    } finally { dev.server.close(); }
  }

  // ---------- offline: service worker ----------
  const s = await openGame('?sw=1');
  const cached = await s.page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50; i++) {
      const keys = await caches.keys();
      if (keys.length) {
        const n = (await (await caches.open(keys[0])).keys()).length;
        if (n > 20) return n;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return 0;
  });
  ok(cached > 20, 'service worker caches the game for offline play', `${cached} files`);
  // Real offline start: cut the network, reload, and the game must still boot and build a world.
  await s.page.evaluate(() => new Promise((r) => (navigator.serviceWorker.controller ? r() : navigator.serviceWorker.addEventListener('controllerchange', r))));
  await s.page.context().setOffline(true);
  const offlineErrors = [];
  s.page.on('requestfailed', (r) => offlineErrors.push(r.url()));
  await s.page.reload();
  const offline = await s.page.waitForFunction(() => {
    const m = window.minicrafter;
    return m && m.world && [...m.world.chunks.values()].some((c) => c.meshed) ? m.world.chunks.size : 0;
  }, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => 0);
  ok(offline > 0 && offlineErrors.length === 0, 'game starts with no network (offline reload)', offlineErrors.slice(0, 3).join(' | ') || `${offline} chunks`);
  await s.page.context().setOffline(false);
  await s.page.close();
} catch (e) {
  ok(false, 'smoke test crashed', e.message);
} finally {
  await browser.close();
  server.close();
}

ok(outside.size === 0, 'privacy: the game never contacts an outside host', [...outside].join(', ') || 'same-origin only');

console.log(failures ? `\n${failures} check(s) failed` : '\nAll smoke checks passed');
process.exit(failures ? 1 : 0);
