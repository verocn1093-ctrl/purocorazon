// "Upcoming & past events": the markup in index.html is the built-in fallback (what visitors see if the API is
// unreachable). When /api/events answers, the section is rebuilt from the Google Sheet.
// Sheet text is always inserted with textContent, never as HTML.

const PLACEHOLDER = '/assets/brand/placeholder.svg';
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== '') n.textContent = text;
  return n;
};

const TAGS = { next: 'Next event', upcoming: 'Upcoming', past: 'Already taken place' };

export function initEvents() {
  const root = $('.events');
  if (!root) return;

  let events = null; // null while the built-in markup is showing
  let current = 0;
  let photo = 0;

  const q = {
    thumbs: () => [...root.querySelectorAll('.events__thumbs button')],
    copy: () => [...root.querySelectorAll('.ev')],
    imgs: () => [...root.querySelectorAll('.events__main img')],
    btn: () => $('.events__btn .circle', root),
    dots: () => $('.events__dots', root),
  };

  const useFallbackImage = (img) => img.addEventListener('error', () => {
    if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = PLACEHOLDER; }
  });

  function paint() {
    q.thumbs().forEach((b, k) => { b.classList.toggle('is-active', k === current); b.setAttribute('aria-selected', String(k === current)); });
    q.copy().forEach((n, k) => n.classList.toggle('is-active', k === current));
    q.imgs().forEach((img) => img.classList.toggle('is-active', Number(img.dataset.i) === current && Number(img.dataset.k || 0) === photo));
    if (!events) return;
    const e = events[current];
    const btn = q.btn();
    if (btn) {
      const has = Boolean(e.link);
      btn.hidden = false;
      btn.classList.toggle('is-hidden', !has);
      btn.setAttribute('aria-hidden', String(!has));
      btn.tabIndex = has ? 0 : -1;
      if (has) btn.href = e.link;
    }
    const dots = q.dots();
    if (dots) {
      dots.replaceChildren();
      if (e.photos.length > 1) {
        e.photos.forEach((_, k) => {
          const d = el('button');
          d.type = 'button';
          d.className = k === photo ? 'is-active' : '';
          d.setAttribute('aria-label', `${e.title}: photo ${k + 1} of ${e.photos.length}`);
          d.addEventListener('click', () => { photo = k; paint(); });
          dots.append(d);
        });
        dots.hidden = false;
      } else dots.hidden = true;
    }
  }

  function pick(i) {
    if (i === current && photo === 0) return;
    current = i; photo = 0; paint();
  }

  function bindThumbs() {
    q.thumbs().forEach((b, i) => {
      b.addEventListener('click', () => pick(i));
      b.addEventListener('mouseenter', () => { if (window.matchMedia('(hover: hover)').matches) pick(i); });
      b.addEventListener('focus', () => pick(i));
    });
    q.imgs().forEach(useFallbackImage);
  }

  function render(list) {
    events = list;
    current = 0; photo = 0;
    const copy = $('.events__copy', root);
    const thumbs = $('.events__thumbs', root);
    const main = $('.events__main', root);
    const dots = el('div', 'events__dots');
    dots.hidden = true;
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Photos of this event');

    copy.replaceChildren(...list.map((e, i) => {
      const box = el('div', `ev${e.status === 'next' ? ' ev--next' : ''}${i === 0 ? ' is-active' : ''}`);
      box.dataset.i = String(i);
      box.append(el('p', 'ev__tag', TAGS[e.status] || TAGS.past), el('h3', '', e.title));
      if (e.date) box.append(el('p', 'ev__date', e.date));
      if (e.description) box.append(el('p', '', e.description));
      return box;
    }));

    thumbs.replaceChildren(...list.map((e, i) => {
      const b = el('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === 0));
      b.dataset.i = String(i);
      b.setAttribute('aria-label', `${TAGS[e.status] || TAGS.past}: ${e.title}`);
      if (i === 0) b.className = 'is-active';
      const img = el('img');
      img.src = e.photos[0].thumb;
      img.alt = e.title;
      img.width = 400; img.height = 502;
      img.loading = 'lazy';
      img.decoding = 'async';
      useFallbackImage(img);
      b.append(img);
      return b;
    }));

    const imgs = [];
    list.forEach((e, i) => e.photos.forEach((p, k) => {
      const img = el('img');
      img.src = p.src;
      img.alt = e.photos.length > 1 ? `${e.title} (photo ${k + 1} of ${e.photos.length})` : e.title;
      img.width = 1600; img.height = 1600;
      img.loading = i === 0 && k === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.dataset.i = String(i); img.dataset.k = String(k);
      useFallbackImage(img);
      imgs.push(img);
    }));
    main.replaceChildren(...imgs, dots);

    bindThumbs();
    paint();
  }

  async function load() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch('/api/events', { signal: ctrl.signal, headers: { accept: 'application/json' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (Array.isArray(data.events) && data.events.length) render(data.events);
    } catch {
      /* keep the built-in markup */
    }
  }

  // main photo: click to see the next photo of the event
  $('.events__main', root).addEventListener('click', () => {
    if (!events) return;
    const n = events[current].photos.length;
    if (n > 1) { photo = (photo + 1) % n; paint(); }
  });

  bindThumbs();
  paint();
  load();
}
