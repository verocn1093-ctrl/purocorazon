// Local test bench for the events feature (no Vercel CLI, no real Google needed).
//   node scripts/local-test.mjs            -> runs the checks and exits
//   node scripts/local-test.mjs --serve    -> runs the checks, then keeps the site on http://localhost:5191
// It fakes Google by rewriting requests to docs.google.com / drive.google.com / *.googleusercontent.com
// to a local mock server, so the real allow-list code is exercised with real Google hostnames.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const MOCK = 5190;
const SITE = 5191;
const realFetch = globalThis.fetch;

// ---------- fixtures: three coloured photos, bigger than 1600px so resizing can be checked
const photo = (r, g, b, w = 2400, h = 1600) => sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).jpeg().toBuffer();
const IMG = { GOODCRIOLLA01: await photo(255, 200, 0), GOODSABOR0001: await photo(0, 160, 220), GOODEXTRA0001: await photo(80, 200, 80), GOODEXTRA0002: await photo(220, 60, 60), GOODBBQ000001: await photo(240, 120, 20) };

const q = (s) => `"${s.replace(/"/g, '""')}"`;
const CSV_MAIN = [
  'Evento,Fecha,Estado,Descripción,Link Eventbrite,Foto principal,Fotos extra',
  // past, listed first on purpose: the page must still order it by date
  `${q('Peruvian Social BBQ')},13/09/2025,Pasado,${q('A social barbecue, with "live" music\nand sauces')},,https://drive.google.com/file/d/GOODBBQ000001/view?usp=sharing,`,
  ',,,,,,', // empty row (ignored)
  `,01/01/2026,Pasado,Row without a title (ignored),,,`,
  `${q('Día de la Canción Criolla')},2026-11-20,Próximo,${q('Criolla music at Vauxhall, <script>alert(1)</script> & more')},https://www.eventbrite.com/e/318374094487,https://drive.google.com/open?id=GOODCRIOLLA01,${q('https://drive.google.com/file/d/GOODEXTRA0001/view, https://drive.google.com/uc?id=GOODEXTRA0002')}`,
  // past with an INVALID photo (file that does not exist in Drive) -> brand placeholder
  `${q('Sabor Perú')},2026-05-10,Pasado,Food and music day.,,https://drive.google.com/file/d/BROKENFILEID999/view,`,
].join('\r\n');

// ---------- mock "Google"
const state = { csvStatus: 200, hits: [] };
const mock = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  state.hits.push(`${req.headers['x-orig-host']}${u.pathname}${u.search}`);
  if (u.pathname.startsWith('/spreadsheets/')) {
    res.statusCode = state.csvStatus;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.end(state.csvStatus === 200 ? CSV_MAIN : 'boom');
  }
  if (u.pathname === '/uc') { // Drive download -> redirects to the usercontent host like the real one
    const id = u.searchParams.get('id');
    res.statusCode = 303;
    res.setHeader('Location', `https://drive.usercontent.google.com/download?id=${id}&export=download`);
    return res.end();
  }
  if (u.pathname === '/download') {
    const id = u.searchParams.get('id');
    if (IMG[id]) { res.setHeader('Content-Type', 'image/jpeg'); return res.end(IMG[id]); }
    res.statusCode = 404; return res.end('not found');
  }
  res.statusCode = 404; res.end();
});
await new Promise((r) => mock.listen(MOCK, '127.0.0.1', r));

const GOOGLE = /(^|\.)(google\.com|googleusercontent\.com)$/;
globalThis.fetch = (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (GOOGLE.test(url.hostname)) {
    const headers = { ...(init.headers || {}), 'x-orig-host': url.hostname };
    return realFetch(`http://127.0.0.1:${MOCK}${url.pathname}${url.search}`, { ...init, headers });
  }
  state.hits.push(`NON-GOOGLE ${url.hostname}`); // must never happen
  return realFetch(input, init);
};

process.env.EVENTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/TEST/pub?output=csv';
const events = (await import('../api/events.js')).default;
const img = (await import('../api/img.js')).default;
const lib = await import('../api/_lib/events.js');

// ---------- site: static dist + the real handlers
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png' };
const site = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/events') return events(req, res);
  if (u.pathname === '/api/img') return img(req, res);
  let f = path.join(dist, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('404'); }
  res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => site.listen(SITE, '127.0.0.1', r));
const get = (p) => realFetch(`http://127.0.0.1:${SITE}${p}`);

let pass = 0, fail = 0;
const ok = (cond, msg, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${extra ? '  -> ' + extra : ''}`); };

// 1) events from the sheet
let r = await get('/api/events');
let data = await r.json();
const titles = data.events.map((e) => `${e.status}:${e.title}`);
console.log('\nEvents served (in order):'); data.events.forEach((e) => console.log(`  ${e.status.padEnd(8)} ${String(e.date).padEnd(11)} ${e.title}  [${e.photos.length} photo(s)] link=${e.link || '(none)'}`));
ok(r.headers.get('x-events-source') === 'sheet', 'source is the sheet');
ok(/s-maxage=300/.test(r.headers.get('cache-control')), 'revalidates every 5 minutes (s-maxage=300)', r.headers.get('cache-control'));
ok(data.events.length === 3, 'empty row and row without title ignored (3 events)');
ok(titles[0] === 'next:Día de la Canción Criolla', 'closest upcoming event is the main one');
ok(titles[1] === 'past:Sabor Perú' && titles[2] === 'past:Peruvian Social BBQ', 'past events ordered newest -> oldest');
ok(data.events[0].photos.length === 3, 'main photo + 2 extra photos parsed (open?id=, file/d/ID/view, uc?id= formats)');
ok(data.events[2].description.includes('\n') && data.events[2].description.includes('"live"'), 'quoted comma / newline / escaped quotes parsed');
ok(data.events[0].description.includes('<script>'), 'raw text kept as text (client inserts it with textContent)');
ok(!data.events.some((e) => e.photos.some((p) => /drive\.google|googleusercontent/.test(p.src))), 'no hotlinks to Drive: every photo is served from our own domain');

// 2) image proxy
r = await get(data.events[0].photos[0].src);
let buf = Buffer.from(await r.arrayBuffer());
let meta = await sharp(buf).metadata();
ok(r.headers.get('content-type') === 'image/webp' && meta.format === 'webp', 'image converted to WebP');
ok(meta.width === 1600, 'resized to max 1600px wide (source was 2400px)', `${meta.width}x${meta.height}, ${(buf.length / 1024).toFixed(0)} KB`);
ok(/s-maxage=2592000/.test(r.headers.get('cache-control')), 'image cache headers set', r.headers.get('cache-control'));
r = await get(data.events[0].photos[0].thumb);
meta = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
ok(meta.width === 400, 'thumbnail size 400px');

// 3) ERROR CASE: invalid photo (Drive file that does not exist) -> brand placeholder, page unaffected
const bad = data.events.find((e) => e.title === 'Sabor Perú').photos[0].src;
r = await get(bad);
const body = await r.text();
ok(r.status === 200 && r.headers.get('content-type') === 'image/svg+xml' && body.includes('#ec008c'), 'invalid photo -> pink/yellow brand placeholder', r.headers.get('x-img-fallback'));

// 4) SECURITY
r = await get('/api/img?u=' + encodeURIComponent('https://evil.example.com/x.jpg'));
ok(r.status === 400, 'non-Google image URL rejected (400)');
r = await get('/api/img?id=' + encodeURIComponent('../../etc/passwd'));
ok(r.status === 400, 'malformed Drive id rejected (400)');
r = await get('/api/img?u=' + encodeURIComponent('https://lh3.googleusercontent.com.evil.com/x'));
ok(r.status === 400, 'look-alike host (lh3.googleusercontent.com.evil.com) rejected');
ok(!state.hits.some((h) => h.startsWith('NON-GOOGLE')), 'no request ever left for a non-Google host');

// 5) a photo link that is not Google at all, set in the sheet itself
const { buildEvents } = lib;
const evil = buildEvents('Evento,Fecha,Estado,Descripción,Link Eventbrite,Foto principal,Fotos extra\nX,2026-12-01,Próximo,d,javascript:alert(1),https://evil.example.com/a.jpg,', '2026-10-14')[0];
ok(evil.photos[0].src === '/assets/brand/placeholder.svg', 'sheet photo on a non-Google domain -> placeholder, never fetched');
ok(evil.link === '', 'javascript: link dropped (button would be hidden)');

// 6) ROBUSTNESS: sheet down -> last good version; no cache at all -> built-in fallback data
state.csvStatus = 500;
r = await get('/api/events'); data = await r.json();
ok(r.headers.get('x-events-source') === 'stale-cache' && data.events.length === 3, 'sheet down -> last working version (stale cache)');
lib._resetForTests();
r = await get('/api/events'); data = await r.json();
ok(r.headers.get('x-events-source') === 'fallback' && data.events.length === 4, 'sheet down and no cache -> fallback data from the project', data.events.map((e) => e.title).join(' | '));
state.csvStatus = 200;
process.env.EVENTS_CSV_URL = '';
lib._resetForTests();
r = await get('/api/events'); data = await r.json();
ok(r.headers.get('x-events-source') === 'fallback', 'no EVENTS_CSV_URL configured -> fallback data, page keeps working');
process.env.EVENTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/TEST/pub?output=csv';

console.log(`\n${pass} passed, ${fail} failed`);
if (process.argv.includes('--serve') && fail === 0) {
  lib._resetForTests();
  console.log(`\nSite with the 3-event sheet is running at http://localhost:${SITE}  (Ctrl+C to stop)`);
} else {
  site.close(); mock.close();
  process.exit(fail ? 1 : 0);
}
