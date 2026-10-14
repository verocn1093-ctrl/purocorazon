# Puro Corazón UK — website

Single-page site (Vite + vanilla JS/CSS). `npm run dev` · `npm run build`.

## Brand sources
Identity taken from the Instagram posters/photos supplied by the owner (fuchsia `#ec008c`, lemon yellow `#fffb0b`, flag red `#d32051`, white condensed caps, dashed yellow boxes, flag bunting). Fonts are look-alikes (Bebas Neue + Barlow), not the brand's own.
Layout and behaviour follow the supplied Framer reference section by section (measured from its DOM): 40/60 hero with loading curtain and right-aligned headline, hide/show nav with hamburger, pinned text + scroll-triggered floating images, 3-column menu (round ↑↓ buttons · card · category list; tabs on mobile), draggable card carousel (reviews → past experiences), centred booking column + round button + tall image, huge footer links, and a bottom CTA card on mobile. Its colours/type are not used.
Instagram/Facebook/Eventbrite could not be read directly (login/bot walls), so nothing was scraped.

## Assets in `public/assets/brand/`
- `poster-*`, `art-*`, `photo-vauxhall-garden`, `banner-peruvian-grill`: crops of owner-supplied images (low resolution). `art-*` have the event dates cropped out so past events never look current. `poster-*` appear only under "Past experiences".
- Replace with originals/high-res exports when available. Header wordmark is live text, not the real logo (`logo-banner-crop.webp` is a low-res crop of the banner, unused).

## Still needed from the owner
- Vector logo, original brand fonts, hi-res food photos (anticuchos, wings, potatoes, sauces).
- Confirm the Eventbrite link is a live listing (it redirects to `eventbrite.co.uk/e/peruvian-tasting-experience-food-drink-tickets-318374094487`).
- Permission to publish the WhatsApp booking number seen on a past poster, and whether extra menu items (costillas anticucheras, picarones, tres leches, marcianos, Inca Kola, etc.) should be listed.

## Two published versions
- Dark/fuchsia (default): hero black, events and testimonials fuchsia.
- Light: same code built with VITE_THEME=light (adds the theme-light class): hero, events and testimonials white. Set that variable in the second Vercel project.

## Events managed from a Google Sheet (client-editable)
"Upcoming & past events" is fed by a published Google Sheet; photos come from Google Drive.

**Files**
- `api/events.js` – `GET /api/events`: reads the CSV, returns JSON (CDN cache 5 min + stale-while-revalidate).
- `api/img.js` – `GET /api/img?id=<DriveID>&w=400|800|1600`: downloads the Drive photo on the server, resizes (max 1600px) to WebP and serves it from our own domain (long CDN cache). No hotlinking to Drive.
- `api/_lib/csv.js` (RFC4180 parser, column mapping, date/status/order), `api/_lib/drive.js` (ID extraction + Google host allow-list), `api/_lib/events.js` (load + last-good cache + fallback).
- `api/_data/events-fallback.json` – bundled events shown if the sheet is unreachable and nothing is cached.
- `src/events.js` – renders the section (text via `textContent`, lazy thumbnails, alt = event name, placeholder on failed images).
- `public/assets/brand/placeholder.svg` – brand placeholder. `docs/events-sheet-template.csv` – sheet template. `scripts/local-test.mjs` – local test bench (`node scripts/local-test.mjs`).

**Environment variable** (Vercel → Project → Settings → Environment Variables, then redeploy; set it in BOTH projects)
- `EVENTS_CSV_URL` = Google Sheets → File → Share → Publish to web → CSV link. If unset, the fallback data is shown.

**Rules**: the nearest upcoming event is the main one; other upcoming ones and past events (newest → oldest) go in the thumbnails; empty or untitled rows are ignored; empty link → no Eventbrite button; image URLs must be Google domains (drive.google.com, lh3.googleusercontent.com), anything else becomes the placeholder. Photos must be shared as "Anyone with the link".
