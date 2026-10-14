// Small RFC 4180 CSV parser: handles quoted fields, commas and line breaks inside quotes,
// escaped quotes ("") and a UTF-8 BOM. Returns an array of rows (arrays of strings).
export function parseCSV(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Sheet header -> internal key. Tolerant of accents, case, spaces and a few synonyms.
const HEADERS = {
  title: ['evento', 'nombre', 'titulo', 'event', 'title', 'name'],
  date: ['fecha', 'date'],
  status: ['estado', 'status'],
  description: ['descripcion', 'description', 'texto'],
  link: ['linkeventbrite', 'eventbrite', 'link', 'enlace', 'url'],
  photo: ['fotoprincipal', 'foto', 'photo', 'mainphoto', 'imagen'],
  extra: ['fotosextra', 'fotosextras', 'extras', 'extraphotos', 'masfotos'],
};

export function mapHeader(headerRow) {
  const idx = {};
  headerRow.forEach((h, i) => {
    const k = clean(h);
    for (const [key, names] of Object.entries(HEADERS)) {
      if (idx[key] === undefined && names.includes(k)) idx[key] = i;
    }
  });
  return idx;
}

const MONTHS = { ene: 0, jan: 0, feb: 1, mar: 2, abr: 3, apr: 3, may: 4, jun: 5, jul: 6, ago: 7, aug: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11, dec: 11 };

// Returns an ISO date (yyyy-mm-dd) or null. Accepts yyyy-mm-dd, d/m/yyyy, d-m-yyyy and "12 Oct 2026" / "12 de octubre de 2026".
export function parseDate(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  let y, m, d, x;
  if ((x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +x[1]; m = +x[2] - 1; d = +x[3]; }
  else if ((x = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) { d = +x[1]; m = +x[2] - 1; y = +x[3]; }
  else if ((x = s.toLowerCase().match(/(\d{1,2})\s*(?:de\s+)?([a-zñáéíóú]{3,})\.?\s*(?:de\s+)?(\d{4})/))) {
    const mon = MONTHS[clean(x[2]).slice(0, 3)];
    if (mon === undefined) return null;
    d = +x[1]; m = mon; y = +x[3];
  } else return null;
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function parseStatus(value) {
  const k = clean(value);
  if (['proximo', 'proxima', 'upcoming', 'next'].includes(k)) return 'upcoming';
  if (['pasado', 'pasada', 'past', 'previous'].includes(k)) return 'past';
  return null;
}

// Only http(s) links are kept (no javascript:, data:, etc.).
export function safeLink(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch { return ''; }
}

const stripControl = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();

// Rows -> raw events (photos still as the original strings). Empty rows and rows without a title are ignored.
export function rowsToEvents(rows, today = new Date().toISOString().slice(0, 10)) {
  if (!rows.length) return [];
  const idx = mapHeader(rows[0]);
  if (idx.title === undefined) return [];
  const get = (r, key) => (idx[key] === undefined ? '' : r[idx[key]] ?? '');
  const out = [];
  for (const r of rows.slice(1)) {
    const title = stripControl(get(r, 'title'));
    if (!title) continue;
    const dateText = stripControl(get(r, 'date'));
    const dateISO = parseDate(dateText);
    const status = parseStatus(get(r, 'status')) ?? (dateISO && dateISO < today ? 'past' : 'upcoming');
    out.push({
      title,
      date: dateText,
      dateISO,
      status,
      description: stripControl(get(r, 'description')),
      link: safeLink(get(r, 'link')),
      photo: stripControl(get(r, 'photo')),
      extra: String(get(r, 'extra')).split(/[,\n;]+/).map((p) => p.trim()).filter(Boolean),
    });
  }
  return out;
}

// Order: closest upcoming event first (it becomes the main one), other upcoming ones by date,
// then past events from newest to oldest. Undated events go last in their group.
export function orderEvents(events, today = new Date().toISOString().slice(0, 10)) {
  const t = Date.parse(today);
  const dist = (e) => (e.dateISO ? Math.abs(Date.parse(e.dateISO) - t) : Infinity);
  const upcoming = events.filter((e) => e.status === 'upcoming').sort((a, b) => {
    const fa = a.dateISO && a.dateISO >= today ? 0 : 1;
    const fb = b.dateISO && b.dateISO >= today ? 0 : 1;
    return fa - fb || dist(a) - dist(b);
  });
  const past = events.filter((e) => e.status === 'past').sort((a, b) => {
    if (a.dateISO && b.dateISO) return b.dateISO.localeCompare(a.dateISO);
    return a.dateISO ? -1 : b.dateISO ? 1 : 0;
  });
  return [...upcoming.map((e, i) => ({ ...e, status: i === 0 ? 'next' : 'upcoming' })), ...past];
}
