import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/dm-sans';
import './styles.css';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Mobile menu
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const setMenu = (open) => {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.classList.toggle('menu-open', open);
};
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

// Reveal on scroll
const revealEls = document.querySelectorAll('.reveal');
if (reduce || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.15 });
  revealEls.forEach((el, i) => { el.style.setProperty('--d', `${(i % 4) * 70}ms`); io.observe(el); });
}

// Header state + parallax + sticky CTA
const header = document.querySelector('.site-header');
const sticky = document.getElementById('stickyCta');
const events = document.getElementById('events');
const parallax = [...document.querySelectorAll('[data-parallax]')];
let ticking = false;
const onScroll = () => {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 30);
  const r = events.getBoundingClientRect();
  const inEvents = r.top < window.innerHeight * 0.6 && r.bottom > 0;
  sticky.classList.toggle('show', y > 500 && !inEvents);
  if (!reduce) parallax.forEach((el) => { el.style.transform = `translate3d(0, ${Math.min(y, window.innerHeight) * parseFloat(el.dataset.parallax)}px, 0)`; });
  ticking = false;
};
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

// Active nav link
const links = [...document.querySelectorAll('.nav__list a')];
const secs = links.map((a) => document.querySelector(a.getAttribute('href')));
if ('IntersectionObserver' in window) {
  const so = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${en.target.id}`));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach((s) => s && so.observe(s));
}
