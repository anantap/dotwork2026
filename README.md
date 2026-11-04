# Roll a Month

Single-page photo globe (three.js r147 core from jsDelivr, own free-orbit controls, Geist from Google Fonts, Geist Pixel inline).
Static, no build step. `/` is the project map (`index.html`, `content.json`, `img/`, `admin/`, `api/`). The photo globe in
`photos/` is no longer published (see `.vercelignore`); it stays in the repo because `index.html` is generated from it.

## Project map (the home page)

The site's home page is a map on the same engine as the photo globe: a globe of the topics in Ananta's work. **Filter** lists the
topics that two or more projects share; picking one pulls those projects forward as images with their titles, and a
project opens as its images and text. **About** and **CV** open as panels from the same bar.

Link previews (`og:image` and friends) need the site's full address: it is `SITE_URL` at the top of
`scripts/make-garden.py`. Change it when the custom domain goes live, run `npm run build:garden`, and remake `og.jpg`
(a 1200×630 render of the home page) if the map has changed a lot. `favicon.svg`, `apple-touch-icon.png` and
`404.html` live at the root.

### Adding or changing content

**The admin: `/admin/`** (password-protected, works on a phone). Add, edit, reorder and delete projects; drop in
images (they're resized in the browser to 1600px JPGs); edit the About text, photo, links and CV. *Save and publish*
makes one commit to this repository and Vercel republishes about a minute later. If the content was changed somewhere
else in the meantime (say on GitHub), the save is refused instead of overwriting it: reload and redo the change.

One-time setup in Vercel → your project → *Settings → Environment Variables* (then redeploy):

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | the password for the admin; pick a long one |
| `GITHUB_TOKEN` | a fine-grained token: github.com → Settings → Developer settings → Fine-grained tokens → *Generate new token*; Repository access: only `anantap/rollamonth`; Permissions: *Contents → Read and write* |
| `GITHUB_BRANCH` | optional: the branch Vercel deploys as production, if it isn't the one the deployment was built from |

The token stays on the server (`api/`), never in the browser. Until both are set, the admin says so instead of
showing a login.

**By hand**: everything on the page comes from `content.json`; images live in `img/`. On GitHub you can
upload images (*Add file → Upload files*) and edit `content.json` (pencil icon) in the browser.

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

- `images`: the first one is the tile in a topic view; all of them show, stacked, when the project opens.
- `tags`: the topics. Every topic shows on the globe; a topic shared by two or more projects opens a topic view and
  appears in Filter, so reuse the same words across projects.
- `years` and `link` are optional.
- `name`, `role`, `intro`, `photo`, `links` and `cv` at the top fill the title, About and CV.

`index.html` itself is generated from the photo globe's `photos/index.html`, so engine fixes carry over; you never need
to edit it for content.

## Build

```bash
npm install && npm run build
```

`npm run build` makes everything the site serves, in order:

1. `scripts/make-garden.py` writes a readable `index.html` from the engine.
2. `scripts/build-three.mjs` bundles only the parts of three.js the page uses into `js/three-<hash>.js` (no CDN).
3. `scripts/optimize-images.py` makes light WebP versions of every photo in `content.json` (`img/opt/`: square grid
   crops, 800 and 1600px versions) and a 1200x630 link-preview image per project (`img/og/`).
4. `scripts/build-pages.mjs` minifies the page, lists the light photos in it, and writes a page per project and shared
   topic (`/kinfill/`, `/photography/` ...) with its own title and preview.

Fonts are self-hosted and cut down to Latin (`fonts/`, made by `npm run build:fonts` from `scripts/fonts-src/`, needs
`pip install fonttools brotli`); run that only when the fonts or the characters they need change.

Projects added through `/admin/` show up right away using the original photos; run `npm run build` (and commit) to give
them light versions, their own address and a link preview. `npm run perf` measures page weight and load times.

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
- `tests/garden.mjs`: the project map (home page): content.json, blue squares, a topic view with images and titles, the project view, About and CV.
- `tests/admin.mjs`: the admin end to end against a local stand-in for Vercel and GitHub (`tests/admin-server.mjs`):
  login, adding a project with images, one commit per save, conflicts, validation, delete, logout.
- `tests/labels.mjs`: globe tag labels never sit on the UI, off screen, or on each other (Chromium, 4 sizes).
- `tests/fallback.mjs`: with WebGL off, or three.js unreachable, the page says so without script errors.

Pass `--three-dir <path to three@0.147.0 package>` if jsDelivr is unreachable; the tests then serve three.js locally.
`tests/screenshots/` holds a reduced copy of the last run.
