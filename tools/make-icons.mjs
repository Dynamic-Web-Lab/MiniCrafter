// Renders the app icons (tools/icon-render.html) in headless Chrome and saves them to icons/.
// Run: npm i --no-save playwright@1.47.2 && node tools/make-icons.mjs
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer(async (req, res) => {
  try {
    const file = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(ROOT)) throw new Error('outside');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: process.env.SMOKE_CHANNEL || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/tools/icon-render.html`);
const icons = await page.waitForFunction(() => window.ICONS, null, { timeout: 30000 }).then((h) => h.jsonValue());
for (const [name, url] of Object.entries(icons)) {
  await writeFile(join(ROOT, 'icons', name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote icons/' + name);
}
await browser.close();
server.close();
