# Roll a Month

Single-page photo globe (three.js r147 core from jsDelivr, own free-orbit controls, Geist from Google Fonts, Geist Pixel inline).
Static: `index.html`, `thumbs/`, `full/`. No build step.

## Project map (`garden/`)

`garden/` is a second map on the same engine: a globe of the topics in Ananta's work. **Filter** lists the
topics that two or more projects share; picking one pulls those projects forward as images with their titles, and a
project opens as its images and text. **About** and **CV** open as panels from the same bar.

### Adding or changing content

Everything on the page comes from `garden/content.json`; images live in `garden/img/`. On GitHub you can do both in
the browser: open `garden/img`, choose *Add file → Upload files*, then edit `garden/content.json` (pencil icon) and
commit. Vercel publishes the change a minute later.

A project looks like this:

```json
{
  "title": "Kinfill",
  "years": "2020",
  "text": "What you did, in a few sentences. A blank line starts a new paragraph.",
  "images": ["img/kinfill.jpg", "img/kinfill-2.jpg"],
  "tags": ["website", "redesign", "sustainability"],
  "link": "https://kinfill.com"
}
```

- `images`: the first one is the tile in a topic view; all of them show, stacked, when the project opens. Use JPGs of
  about 1200–1600px wide.
- `tags`: the topics. Every topic shows on the globe. One used by a single project is a smaller grey label that opens that
  project directly; once two or more projects share a topic it opens a topic view and appears in Filter, so reuse the
  same words across projects ("website", not "web site" in one and "website" in another).
- `years` and `link` are optional.
- `name`, `role`, `intro`, `photo`, `links` and `cv` at the top fill the title, About and CV.

`garden/index.html` itself is generated from the photo globe's `index.html` (`npm run build:garden`), so engine fixes
carry over; you never need to edit it for content.

## Run locally

Serve over HTTP (textures don't load from `file://`):

```bash
npx serve . -l 3000
```

`serve` prints a **Network** URL (e.g. `http://192.168.1.20:3000`) you can open on a phone on the same Wi-Fi.

## Tests

```bash
npm install
npm run test:install
npm start            # in one terminal
npm test             # in another
```

- `tests/run.mjs`: Chromium, Firefox and WebKit × desktop 1440×900, iPhone 14 and Pixel 7. Loads the globe, opens the
  `interior` tag view through the Subject menu, opens the first scan, then →, Esc, Esc, and measures frame rate. Writes screenshots and
  `report.json` to `tests/out/`.
- `tests/touch.mjs`: tap vs drag (5px threshold), pinch, two-finger tap, long-press preview, ghost clicks, stuck hover (Chromium, CDP touch).
- `tests/safe-area.mjs`: fakes iPhone notch/home-indicator insets and checks the UI stays inside them (Chromium).
- `tests/drag.mjs`: the globe turns freely over the poles, drags starting anywhere (labels included) turn it, labels still hover and open.
- `tests/garden.mjs`: the project map: content.json, blue squares, a topic view with images and titles, the project view, About and CV.
- `tests/labels.mjs`: globe tag labels never sit on the UI, off screen, or on each other (Chromium, 4 sizes).
- `tests/fallback.mjs`: with WebGL off, or three.js unreachable, the page says so without script errors.

Pass `--three-dir <path to three@0.147.0 package>` if jsDelivr is unreachable; the tests then serve three.js locally.
`tests/screenshots/` holds a reduced copy of the last run.
