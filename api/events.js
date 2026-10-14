import { loadEvents } from './_lib/events.js';

// GET /api/events -> { events, source }
// Vercel's CDN keeps the answer for 5 minutes and, after that, serves the old one while it refreshes in the background
// (stale-while-revalidate), which gives the same effect as ISR without rebuilding the site.
export default async function handler(req, res) {
  const { events, source } = await loadEvents();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Fallback / stale answers are cached only briefly so the sheet takes over again as soon as it is reachable.
  res.setHeader('Cache-Control', source === 'sheet' ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'public, s-maxage=30, stale-while-revalidate=300');
  res.setHeader('X-Events-Source', source);
  res.end(JSON.stringify({ events, source }));
}
