import '@fontsource/bebas-neue';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import './styles.css';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

$('#year').textContent = new Date().getFullYear();

// Mobile drawer
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

// Menu: tabs, dots and slides share one index
const tabs = $$('.card__tabs button');
const dots = $$('.menu__dots button');
const lists = $$('.items');
const slides = $$('.slide');
const select = (i) => {
  tabs.forEach((el, k) => el.classList.toggle('is-active', k === i));
  dots.forEach((el, k) => el.setAttribute('aria-selected', String(k === i)));
  lists.forEach((el, k) => el.classList.toggle('is-active', k === i));
  slides.forEach((el, k) => el.classList.toggle('is-active', k === i));
};
[...tabs, ...dots].forEach((el) => el.addEventListener('click', () => select(+el.dataset.i)));

// Scroll-driven: nav slide-in, bottom bar, about floating images
const nav = $('#nav');
const bar = $('#bar');
const about = $('.about');
const floats = $$('.float').map((el, i) => ({ el, from: el.dataset.from.split(',').map(Number), s: +el.dataset.s, start: 0.04 + i * 0.1 }));
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
      const t = ease(clamp((p - start) / 0.18));
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
