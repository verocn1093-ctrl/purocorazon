import sharp from 'sharp';
import { isAllowedUrl, isValidId, isLh3Url, WIDTHS } from './_lib/drive.js';

// GET /api/img?id=<Drive file id>&w=400|800|1600   (or ?u=<lh3.googleusercontent.com url>&w=...)
// Downloads the image from Google on the server, resizes it (max 1600px wide) to WebP and serves it from our own domain.
// Vercel's CDN caches the result, so Drive is only contacted the first time (and when the cache is refreshed).

const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

const PLACEHOLDER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="#ec008c"/><path fill="#fffb0b" opacity=".92" d="M400 560C250 450 215 390 215 340c0-45 35-75 80-75 45 0 80 22 105 60 25-38 60-60 105-60 45 0 80 30 80 75 0 50-35 110-185 220z"/></svg>';

function placeholder(res, reason) {
  console.error('[img] placeholder served:', reason);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.setHeader('X-Img-Fallback', String(reason).slice(0, 80));
  res.end(PLACEHOLDER_SVG);
}

// Follows redirects by hand so that every hop is checked against the Google allow-list.
async function download(startUrl) {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedUrl(url)) throw new Error(`blocked host: ${new URL(url).hostname}`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; PuroCorazonImageProxy/1.0)' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        url = new URL(r.headers.get('location'), url).toString();
        continue;
      }
      if (!r.ok) throw new Error(`upstream ${r.status}`);
      const type = r.headers.get('content-type') || '';
      if (!/^image\//i.test(type)) throw new Error(`not an image (${type || 'no content-type'}) - is the file shared with "anyone with the link"?`);
      const declared = Number(r.headers.get('content-length') || 0);
      if (declared > MAX_BYTES) throw new Error('image too large');
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error('image too large');
      return buf;
    } finally { clearTimeout(timer); }
  }
  throw new Error('too many redirects');
}

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://localhost').searchParams;
  const w = WIDTHS.includes(Number(q.get('w'))) ? Number(q.get('w')) : 1600;
  const id = q.get('id');
  const u = q.get('u');

  let source;
  if (id && isValidId(id)) source = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  else if (u && isLh3Url(u)) source = u;
  else {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request: expected a valid Drive file id (id) or an lh3.googleusercontent.com url (u).');
    return;
  }

  try {
    const input = await download(source);
    const out = await sharp(input, { limitInputPixels: 120_000_000, failOn: 'error' })
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800');
    res.setHeader('Content-Length', String(out.length));
    res.end(out);
  } catch (err) {
    placeholder(res, err?.message || err);
  }
}
