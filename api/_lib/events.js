import { parseCSV, rowsToEvents, orderEvents } from './csv.js';
import { photoRef, proxyUrl } from './drive.js';
import fallback from '../_data/events-fallback.json' with { type: 'json' };

const PLACEHOLDER = '/assets/brand/placeholder.svg';
const FETCH_TIMEOUT_MS = 8000;
const MAX_CSV_BYTES = 1_000_000;

// Last version that loaded correctly. It lives as long as the serverless instance, which is enough to ride out short Google outages.
let lastGood = null;

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Raw sheet event -> public event. Invalid or non-Google photo links become the brand placeholder.
function toPublic(e, i) {
  const refs = [e.photo, ...e.extra].map(photoRef);
  const photos = refs.map((ref) => (ref ? { src: proxyUrl(ref, 1600), thumb: proxyUrl(ref, 400) } : null)).filter(Boolean);
  // A bad main photo must not push the extras into first place silently: if the main one is invalid, show the placeholder first.
  if (e.photo && !refs[0]) photos.unshift({ src: PLACEHOLDER, thumb: PLACEHOLDER });
  if (!photos.length) photos.push({ src: PLACEHOLDER, thumb: PLACEHOLDER });
  return {
    id: `${slug(e.title) || 'event'}-${i}`,
    title: e.title,
    date: e.date,
    dateISO: e.dateISO,
    status: e.status,
    description: e.description,
    link: e.link,
    photos,
  };
}

export function buildEvents(csvText, today) {
  const raw = rowsToEvents(parseCSV(csvText), today);
  return orderEvents(raw, today).map(toPublic);
}

async function fetchCsv(url, fetchImpl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, redirect: 'follow', headers: { accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5' } });
    if (!res.ok) throw new Error(`CSV request failed: ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (/text\/html/i.test(type)) throw new Error('CSV url returned an HTML page (is the sheet published as CSV?)');
    const text = await res.text();
    if (text.length > MAX_CSV_BYTES) throw new Error('CSV too large');
    return text;
  } finally { clearTimeout(timer); }
}

// Returns { events, source } where source is 'sheet' | 'stale-cache' | 'fallback'. Never throws and never returns an empty list.
export async function loadEvents({ url = process.env.EVENTS_CSV_URL, fetchImpl = globalThis.fetch, today = new Date().toISOString().slice(0, 10) } = {}) {
  if (url) {
    try {
      const events = buildEvents(await fetchCsv(url, fetchImpl), today);
      if (!events.length) throw new Error('The sheet has no valid events');
      lastGood = events;
      return { events, source: 'sheet' };
    } catch (err) {
      console.error('[events] sheet failed:', err?.message || err, err?.cause?.code || err?.cause?.message || '');
      if (lastGood) return { events: lastGood, source: 'stale-cache' };
    }
  }
  return { events: fallback.events, source: 'fallback' };
}

export const _resetForTests = () => { lastGood = null; };
