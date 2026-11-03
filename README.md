# Roll a Month

Single-page photo globe (three.js r147 from jsDelivr, Geist from Google Fonts, Geist Pixel inline).
Static: `index.html`, `thumbs/`, `full/`. No build step.

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
  `interior` tag view, opens the first scan, then →, Esc, Esc, and measures frame rate. Writes screenshots and
  `report.json` to `tests/out/`.
- `tests/touch.mjs`: tap vs drag (5px threshold), pinch, two-finger tap, long-press preview, ghost clicks, stuck hover (Chromium, CDP touch).
- `tests/safe-area.mjs`: fakes iPhone notch/home-indicator insets and checks the UI stays inside them (Chromium).
- `tests/labels.mjs`: globe tag labels never sit on the UI, off screen, or on each other (Chromium, 4 sizes).
- `tests/fallback.mjs`: with WebGL off, or three.js unreachable, the page says so without script errors.

Pass `--three-dir <path to three@0.147.0 package>` if jsDelivr is unreachable; the tests then serve three.js locally.
`tests/screenshots/` holds a reduced copy of the last run.
