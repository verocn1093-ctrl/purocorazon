import '@fontsource/bebas-neue';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
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

// Past experiences carousel: buttons, end states, mouse drag (touch scrolls natively)
const track = $('#ctrack');
const cprev = $('#cprev');
const cnext = $('#cnext');
const step = () => { const c = track.firstElementChild; return c ? c.getBoundingClientRect().width + 8 : 300; };
const carouselState = () => {
  cprev.disabled = track.scrollLeft < 4;
  cnext.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
};
cprev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
cnext.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
track.addEventListener('scroll', carouselState, { passive: true });
track.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') track.scrollBy({ left: step() });
  if (e.key === 'ArrowLeft') track.scrollBy({ left: -step() });
});
let down = false, sx = 0, sl = 0;
track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = track.scrollLeft; track.classList.add('drag'); });
window.addEventListener('pointermove', (e) => { if (down) track.scrollLeft = sl - (e.clientX - sx); });
window.addEventListener('pointerup', () => { if (!down) return; down = false; track.classList.remove('drag'); });
window.addEventListener('resize', carouselState);
carouselState();

// Reveal on scroll
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.15 });
  $$('.menu__title, .menu__grid, .past__head, .pcard, .story__txt, .story__fig, .book__intro, .book__cols, .book__btn, .book__right, .footer__nav a').forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io.observe(el);
  });
}

// Scroll-driven: nav slide-in, bottom bar, floating images in the pinned section
const nav = $('#nav');
const bar = $('#bar');
const about = $('.about');
const floats = $$('.float').map((el, i) => ({ el, from: el.dataset.from.split(',').map(Number), s: +el.dataset.s, start: 0.04 + i * 0.12 }));
const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
let ticking = false;
const update = () => {
  const y = window.scrollY;
  const vh = window.innerHeight;
  nav.classList.toggle('show', y > vh * 0.6);
  bar.classList.toggle('show', y > vh * 0.8);
  if (!reduce) {
    const r = about.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - vh));
    floats.forEach(({ el, from, s, start }) => {
      const t = ease(clamp((p - start) / 0.2));
      const out = ease(clamp((p - 0.86) / 0.14));
      el.style.opacity = t * (1 - out);
      el.style.transform = `translate(${from[0] * (1 - t)}%, ${from[1] * (1 - t)}%) scale(${s + (1 - s) * t})`;
    });
  }
  ticking = false;
};
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
window.addEventListener('resize', update);
update();
