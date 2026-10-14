import '@fontsource/bebas-neue';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import './styles.css';
import { initEvents } from './events.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

if (import.meta.env.VITE_THEME) document.documentElement.classList.add(`theme-${import.meta.env.VITE_THEME}`);

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

// Hero photos: change every 2 seconds, loop, dots to pick one by hand
const slides = $$('.hero__slide');
const heroDots = $$('.hero__dots button');
let slideNow = 0;
let slideTimer = null;
const showSlide = (i) => {
  slideNow = (i + slides.length) % slides.length;
  slides.forEach((el, k) => el.classList.toggle('is-active', k === slideNow));
  heroDots.forEach((el, k) => { el.classList.toggle('is-active', k === slideNow); el.setAttribute('aria-current', String(k === slideNow)); });
};
const startSlides = () => { stopSlides(); if (!reduce && slides.length > 1) slideTimer = setInterval(() => showSlide(slideNow + 1), 2000); };
const stopSlides = () => { if (slideTimer) { clearInterval(slideTimer); slideTimer = null; } };
heroDots.forEach((el, i) => el.addEventListener('click', () => { showSlide(i); startSlides(); }));
document.addEventListener('visibilitychange', () => { if (document.hidden) stopSlides(); else startSlides(); });
startSlides();

// Events section: built-in markup + live data from the Google Sheet (see src/events.js and api/events.js)
initEvents();

// Reveal on scroll
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.15 });
  $$('.menu__title, .menu__grid, .past__head, .footer__nav a').forEach((el, i) => {
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
const phone = window.matchMedia('(max-width: 600px)');
if ('IntersectionObserver' in window) {
  const fio = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); fio.unobserve(en.target); } }), { threshold: 0.2 });
  floats.forEach((el) => fio.observe(el));
} else { floats.forEach((el) => el.classList.add('in')); }
const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
let ticking = false;
const update = () => {
  const y = window.scrollY;
  const vh = window.innerHeight;
  nav.classList.toggle('show', y > vh * 0.6);
  bar.classList.toggle('show', y > vh * 0.8);
  if (phone.matches) {
    floats.forEach((el) => { el.style.opacity = ''; el.style.transform = ''; });
  } else if (!reduce) {
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
