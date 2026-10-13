import '@fontsource/bebas-neue';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import './styles.css';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

$('#year').textContent = new Date().getFullYear();

// Drawer menu (hamburger on every screen size)
const burger = $('#burger');
const drawer = $('#drawer');
const setDrawer = (open) => {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  drawer.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
};
burger.addEventListener('click', () => setDrawer(burger.getAttribute('aria-expanded') !== 'true'));
drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setDrawer(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });

// Menu: ↑↓ buttons, mobile tabs, category list and card share one index
const panels = $$('.card__panel');
const cats = $$('.cat');
const tabs = $$('.menu__tabs button');
const prev = $('#prev');
const next = $('#next');
let current = 0;
const select = (i) => {
  current = Math.max(0, Math.min(panels.length - 1, i));
  panels.forEach((el, k) => el.classList.toggle('is-active', k === current));
  cats.forEach((el, k) => el.classList.toggle('is-active', k === current));
  tabs.forEach((el, k) => { el.classList.toggle('is-active', k === current); el.setAttribute('aria-selected', String(k === current)); });
  prev.disabled = current === 0;
  next.disabled = current === panels.length - 1;
};
prev.addEventListener('click', () => select(current - 1));
next.addEventListener('click', () => select(current + 1));
cats.forEach((el) => el.addEventListener('click', () => select(+el.dataset.i)));
tabs.forEach((el) => el.addEventListener('click', () => select(+el.dataset.i)));
$$('[data-cat]').forEach((a) => a.addEventListener('click', () => select(+a.dataset.cat)));
select(0);

// Carousels (past experiences, testimonials): buttons, end states, mouse drag (touch scrolls natively)
$$('.past__track').forEach((track) => {
  const prevBtn = $(`[data-prev="${track.id}"]`);
  const nextBtn = $(`[data-next="${track.id}"]`);
  const step = () => { const c = track.firstElementChild; return c ? c.getBoundingClientRect().width + 8 : 300; };
  const state = () => {
    prevBtn.disabled = track.scrollLeft < 4;
    nextBtn.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  };
  prevBtn.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
  nextBtn.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
  track.addEventListener('scroll', state, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') track.scrollBy({ left: step() });
    if (e.key === 'ArrowLeft') track.scrollBy({ left: -step() });
  });
  let down = false, sx = 0, sl = 0;
  track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = track.scrollLeft; track.classList.add('drag'); });
  window.addEventListener('pointermove', (e) => { if (down) track.scrollLeft = sl - (e.clientX - sx); });
  window.addEventListener('pointerup', () => { if (!down || !track.classList.contains('drag')) return; down = false; track.classList.remove('drag'); });
  window.addEventListener('resize', state);
  state();
});

// Events: hover or click a thumbnail to change the text and the large photo
const evThumbs = $$('.events__thumbs button');
const evCopy = $$('.ev');
const evImgs = $$('.events__main img');
const pickEvent = (i) => {
  evThumbs.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-selected', String(k === i)); });
  evCopy.forEach((el, k) => el.classList.toggle('is-active', k === i));
  evImgs.forEach((el, k) => el.classList.toggle('is-active', k === i));
};
evThumbs.forEach((b, i) => {
  b.addEventListener('click', () => pickEvent(i));
  b.addEventListener('mouseenter', () => { if (window.matchMedia('(hover: hover)').matches) pickEvent(i); });
  b.addEventListener('focus', () => pickEvent(i));
});

// Reveal on scroll
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.15 });
  $$('.menu__title, .menu__grid, .past__head, .book__intro, .book__cols, .book__btn, .book__right, .footer__nav a').forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io.observe(el);
  });
}

// Scroll-driven: nav slide-in, bottom bar, six images rising from below in the pinned section
const nav = $('#nav');
const bar = $('#bar');
const about = $('.about');
const floats = $$('.float');
const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
let ticking = false;
const update = () => {
  const y = window.scrollY;
  const vh = window.innerHeight;
  nav.classList.toggle('show', y > vh * 0.6);
  bar.classList.toggle('show', y > vh * 0.8);
  if (!reduce) {
    const top0 = about.getBoundingClientRect().top;
    floats.forEach((el) => {
      const top = top0 + el.offsetTop; // position without the transform
      // each image enters at the bottom of the screen a little smaller, then grows to full size as it rises
      const t = ease(clamp((vh - top) / (vh * 0.45)));
      el.style.opacity = clamp(t * 3);
      el.style.transform = `scale(${0.8 + 0.2 * t})`;
    });
  }
  ticking = false;
};
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
window.addEventListener('resize', update);
update();
