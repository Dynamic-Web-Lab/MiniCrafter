// One local server for development and tests: the game, accounts (in memory) and the
// Play Together relay on a single address, like the hosted online edition.
// Run: node server/dev.mjs   then open http://localhost:8770/   (PORT to change)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAccounts, MemoryStore } from './accounts.mjs';
import { attachRelay } from './rooms.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const SERVE = ['index.html', 'style.css', 'privacy.html', 'terms.html', 'legal.css', 'features.html', 'features.css', 'llms.txt', 'docs', 'sw.js', 'manifest.webmanifest', 'icons', 'src', 'vendor'];

/** Starts the dev server. Returns { server, port, url }. */
export async function startDevServer(port = 8770) {
  const cfg = { origins: [] };
  const accounts = createAccounts({ store: new MemoryStore(), get origins() { return cfg.origins; }, secureCookie: false });
  const server = http.createServer(async (req, res) => {
    if (await accounts.handle(req, res)) return;
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/site-config.json') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end('{ "online": true, "rooms": "/rooms", "accounts": true }\n');
      }
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(ROOT, p));
      const rel = file.slice(ROOT.length);
      if (!file.startsWith(ROOT) || !SERVE.includes(rel.split(sep)[0])) throw new Error('not served');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  attachRelay(server, { path: '/rooms', get origins() { return cfg.origins; }, verify: (req) => accounts.verifyRequest(req) });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const p = server.address().port;
  cfg.origins = [`http://127.0.0.1:${p}`, `http://localhost:${p}`];
  return { server, port: p, url: `http://127.0.0.1:${p}/` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port } = await startDevServer(Number(process.env.PORT || 8770));
  console.log(`MiniCrafter dev server: http://localhost:${port}/  (game + accounts + Play Together)`);
}
