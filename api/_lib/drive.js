// Google Drive / Google image link handling.
// Only Google hosts are ever fetched. The image endpoint receives either a Drive file ID or an lh3 URL.

const ID = /^[A-Za-z0-9_-]{10,120}$/;
const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
const LH3 = 'lh3.googleusercontent.com';

// Hosts that may be contacted: the two the sheet may use, plus the hosts Google redirects downloads to.
export function isAllowedHost(hostname) {
  const h = String(hostname).toLowerCase();
  return (
    h === 'drive.google.com' ||
    h === 'docs.google.com' ||
    h === 'drive.usercontent.google.com' ||
    h === LH3 ||
    /^[a-z0-9-]+\.googleusercontent\.com$/.test(h)
  );
}

export const isAllowedUrl = (u) => {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && !url.username && !url.password && isAllowedHost(url.hostname);
  } catch { return false; }
};

// Extracts a photo reference from any common link shape, or returns null if the link is not a Google one.
//  drive.google.com/file/d/ID/view, /open?id=ID, /uc?id=ID, /thumbnail?id=ID, docs.google.com/.../d/ID, lh3.googleusercontent.com/d/ID
export function photoRef(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let url;
  try { url = new URL(s); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  if (DRIVE_HOSTS.has(host)) {
    const m = url.pathname.match(/\/d\/([A-Za-z0-9_-]+)/);
    const id = m ? m[1] : url.searchParams.get('id');
    return id && ID.test(id) ? { kind: 'drive', id } : null;
  }
  if (host === LH3) {
    const m = url.pathname.match(/^\/d\/([A-Za-z0-9_-]+)/);
    if (m && ID.test(m[1])) return { kind: 'drive', id: m[1] };
    return url.pathname.length > 5 ? { kind: 'lh3', url: url.origin + url.pathname + url.search } : null;
  }
  return null;
}

export const WIDTHS = [400, 800, 1600];

// URL (on our own domain) that serves the optimised image.
export function proxyUrl(ref, width = 1600) {
  const w = WIDTHS.includes(width) ? width : 1600;
  return ref.kind === 'drive' ? `/api/img?id=${encodeURIComponent(ref.id)}&w=${w}` : `/api/img?u=${encodeURIComponent(ref.url)}&w=${w}`;
}

export const isValidId = (id) => ID.test(String(id ?? ''));
export const isLh3Url = (u) => {
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname.toLowerCase() === LH3; } catch { return false; }
};
