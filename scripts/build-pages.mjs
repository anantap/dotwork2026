// Builds the published pages from src/index.html (run everything with `npm run build`):
//  - uses the site's own three.js build (scripts/build-three.mjs) instead of the CDN
//  - lists which photos have light versions (img/opt/manifest.json, from scripts/optimize-images.py)
//  - minifies the page's CSS and JavaScript
//  - writes a page per project and per shared topic (/kinfill/, /photography/ ...) with its own title and link preview,
//    so shared links show the project; the page itself opens the project from its address.
import { transform } from 'esbuild'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))); process.chdir(root);
const MARK = '<meta name="generator" content="build-pages">';
let html = fs.readFileSync('src/index.html', 'utf8');
const content = JSON.parse(fs.readFileSync('content.json', 'utf8'));
const manifest = fs.existsSync('img/opt/manifest.json') ? JSON.parse(fs.readFileSync('img/opt/manifest.json', 'utf8')) : {};
const three = JSON.parse(fs.readFileSync('js/three.json', 'utf8')).file;
const SITE = html.match(/<meta property="og:url" content="([^"]+)">/)[1].replace(/\/$/, '');
const slugOf = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const must = (cond, msg) => { if (!cond) { console.error(msg); process.exit(1); } };

// the current font files (scripts/build-fonts.py)
const fonts = JSON.parse(fs.readFileSync('fonts/fonts.json', 'utf8'));
html = html.replace(/fonts\/geist-pixel-[0-9a-f]{8}\.woff2/g, fonts.pixel).replace(/fonts\/geist-[0-9a-f]{8}\.woff2/g, fonts.sans);
// three.js from the site, fetched early
must(html.includes('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js'), 'three.js script tag not found');
html = html.replace('<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>', `<script src="${three}"></script>`)
  .replace('<link rel="preload" href="content.json"', `<link rel="preload" href="${three}" as="script">\n<link rel="preload" href="content.json"`);
// photos with light versions
must(html.includes('  const IMG = {};'), 'IMG placeholder not found');
html = html.replace('  const IMG = {};', `  const IMG = ${JSON.stringify(manifest)};`);
// minify the inline CSS and scripts
let before = html.length;
for (const m of [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]) html = html.replace(m[0], `<style>${(await transform(m[1], { loader: 'css', minify: true })).code.trim()}</style>`);
for (const m of [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]) html = html.replace(m[0], `<script>${(await transform(m[1], { loader: 'js', minify: true, target: 'es2019' })).code.trim()}</script>`);
html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${MARK}`);
fs.writeFileSync('index.html', html);
console.log(`index.html ${(before / 1024).toFixed(0)} KB -> ${(html.length / 1024).toFixed(0)} KB`);

// a page per project and per shared topic
const reserved = new Set(['admin', 'api', 'img', 'js', 'fonts', 'photos', 'tests', 'scripts', 'node_modules', 'incoming', 'garden']);
const pages = new Map();
const ogOf = p => p && p.images && p.images[0] && manifest[p.images[0]] ? `${SITE}/img/og/${slugOf(p.title)}-${manifest[p.images[0]]}.jpg` : `${SITE}/og.jpg`;
const short = (t, n = 180) => { t = (t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
for (const p of content.projects || []) pages.set(slugOf(p.title), { title: p.title, desc: short(p.text) || p.title, image: ogOf(p) });
const tags = new Map(); for (const p of content.projects || []) for (const t of p.tags || []) tags.set(t, [...(tags.get(t) || []), p]);
for (const [t, ps] of tags) if (ps.length >= 2) {
  const s = slugOf(t); must(!pages.has(s), `topic "${t}" has the same address as a project: /${s}/`);
  pages.set(s, { title: t, desc: `${ps.length} projects: ${ps.map(p => p.title).join(', ')}`, image: ogOf(ps[0]) });
}
for (const s of pages.keys()) must(s && !reserved.has(s), `"/${s}/" can't be used as an address`);
const name = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Ananta Mulyono';
const listFile = 'js/pages.json', old = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile, 'utf8')) : [];
for (const s of old) if (!pages.has(s) && fs.existsSync(`${s}/index.html`) && fs.readFileSync(`${s}/index.html`, 'utf8').includes(MARK)) fs.rmSync(s, { recursive: true });
for (const [s, pg] of pages) {
  const url = `${SITE}/${s}/`, title = `${pg.title} · ${name}`;
  const page = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(pg.desc)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(pg.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(pg.desc)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">\n<link rel="canonical" href="${url}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${pg.image}">`);
  fs.mkdirSync(s, { recursive: true }); fs.writeFileSync(`${s}/index.html`, page);
}
fs.writeFileSync(listFile, JSON.stringify([...pages.keys()].sort(), null, 1));
console.log(`${pages.size} pages: ${[...pages.keys()].map(s => `/${s}/`).join(' ')}`);
