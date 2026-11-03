// Touch risk-area checks (Chromium only: uses CDP to send raw multi-touch events).
//   node tests/touch.mjs [--base http://localhost:3000/] [--three-dir /path/to/three/package] [--device "iPhone 14"]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/';
const DEVICE = args.device || 'Pixel 7'; // Chromium emulation; iPhone 14 works too
const here = path.dirname(fileURLToPath(import.meta.url));
const runSrc = fs.readFileSync(path.join(here, 'run.mjs'), 'utf8');
const HOOK = runSrc.slice(runSrc.indexOf('const HOOK = () => {') + 'const HOOK = '.length, runSrc.indexOf('\n};\n', runSrc.indexOf('const HOOK')) + 2);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ ...devices[DEVICE] });
await ctx.addInitScript(`(${HOOK})()`);
if (args['three-dir']) await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', route => route.fulfill({ path: path.join(args['three-dir'], new URL(route.request().url()).pathname.replace('/npm/three@0.147.0/', '')), contentType: 'text/javascript' }));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
async function gesture(path, steps = 8, hold = 16) { // path: array of frames, each frame = list of [x,y] per finger
  await touch('touchStart', path[0]);
  for (const f of path.slice(1)) { await touch('touchMove', f); await sleep(hold); }
  await touch('touchEnd', []);
}
const lerp = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * k / n, p[1] + (b[i][1] - p[1]) * k / n]));
const state = () => page.evaluate(() => ({ view: document.body.dataset.view, detail: !document.getElementById('detail').hidden, camDist: +window.__camera.position.length().toFixed(2), camX: +window.__camera.position.x.toFixed(3), hlDim: window.__tileXY().filter(t => t.op < 0.1).length }));
async function frontTile() {
  // nearest-facing tile that is not under any UI; scans first
  return page.evaluate(() => window.__tileXY().filter(t => t.front > 0.8 && t.op > 0.3 && t.x > 40 && t.x < innerWidth - 40 && t.y > 40 && t.y < innerHeight - 40)
    .filter(t => document.elementFromPoint(t.x, t.y)?.tagName === 'CANVAS').sort((a, b) => (b.real - a.real) || (b.front - a.front))[0]);
}
async function reload() {
  await page.reload(); await page.waitForFunction(() => window.__frames > 30, null, { timeout: 30000 }); await sleep(3000);
}
async function closeAll() {
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(700); }
}

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', name, detail ? JSON.stringify(detail) : ''); };

await page.goto(BASE);
await page.waitForFunction(() => window.__frames > 30, null, { timeout: 30000 });
await sleep(3000);
const env = await page.evaluate(() => ({ innerWidth, viewport: document.querySelector('meta[name=viewport]')?.content || null }));
check('layout viewport matches device width', env.innerWidth < 500, env);

// 1. Tap on a scan on the globe opens the light box and it stays open
let t = await frontTile();
await gesture([[[t.x, t.y]], [[t.x, t.y]]]);
await sleep(900);
let s = await state();
check('tap on globe tile opens light box and it stays open', s.detail, s);
await closeAll();

// 2. Tap with 3px of finger jitter still counts as a tap
t = await frontTile();
// one jittered move, no pauses: a real tap is ~100ms and 500ms counts as a long press, and each CDP event can take a frame here
const tapStart = Date.now();
await gesture([[[t.x, t.y]], [[t.x + 3, t.y + 1]]], 1, 0);
const tapMs = Date.now() - tapStart;
await sleep(900); s = await state(); s.tapMs = tapMs;
check('tap with 3px jitter opens light box', s.detail, { ...s, tile: t });
await closeAll();

// 3. A 40px drag rotates and does not open anything
t = await frontTile(); const before = await state();
await gesture(lerp([[t.x, t.y]], [[t.x + 40, t.y]], 8));
await sleep(900); s = await state();
check('40px drag rotates, no light box', !s.detail && s.camX !== before.camX, { before: before.camX, after: s.camX, detail: s.detail });
await closeAll();

// 4. Pinch out on the globe zooms in, no light box
t = await frontTile(); let b4 = await state();
const cx = t.x, cy = t.y;
await gesture(lerp([[cx - 30, cy], [cx + 30, cy]], [[cx - 140, cy], [cx + 140, cy]], 10));
await sleep(900); s = await state();
check('pinch-out zooms in (camera distance decreases), no light box', s.camDist < b4.camDist - 1 && !s.detail, { before: b4.camDist, after: s.camDist, detail: s.detail });

await reload();
// 5. Two-finger tap (no movement) with one finger on a tile does not open the light box
t = await frontTile();
await touch('touchStart', [[t.x, t.y]]); await touch('touchStart', [[t.x, t.y], [t.x + 80, t.y + 80]]);
await sleep(60); await touch('touchEnd', [[t.x, t.y]]); await touch('touchEnd', []);
await sleep(900); s = await state();
check('two-finger tap does not open light box', !s.detail, s);
await closeAll();

// 6. Pinch where both fingers lift close to where they landed (a small pinch) does not open the light box
t = await frontTile();
await touch('touchStart', [[t.x, t.y]]); await touch('touchStart', [[t.x, t.y], [t.x + 60, t.y]]);
for (let k = 1; k <= 4; k++) { await touch('touchMove', [[t.x, t.y], [t.x + 60 + k * 2, t.y]]); await sleep(16); }
await touch('touchEnd', [[t.x, t.y]]); await sleep(30); await touch('touchEnd', []);
await sleep(900); s = await state();
check('small pinch with a stationary finger does not open light box', !s.detail, s);
await closeAll();

// 6b. Long press on a tile shows the hover card; releasing doesn't open the light box
await reload();
t = await frontTile();
await touch('touchStart', [[t.x, t.y]]); await sleep(700);
const tipShown = await page.evaluate(() => ({ op: getComputedStyle(document.getElementById('tip')).opacity, text: document.querySelector('#tip .code')?.textContent, rect: document.getElementById('tip').getBoundingClientRect().toJSON() }));
await page.screenshot({ path: path.join(here, 'out', `long-press-${DEVICE.replace(/\s+/g, '-').toLowerCase()}.png`) });
await touch('touchEnd', []); await sleep(900); s = await state();
const tipAfter = await page.evaluate(() => getComputedStyle(document.getElementById('tip')).opacity);
check('long press shows the frame card above the finger', +tipShown.op > 0.5 && tipShown.rect.bottom <= t.y, { ...tipShown, fingerY: Math.round(t.y) });
check('releasing a long press hides the card and opens nothing', +tipAfter < 0.1 && !s.detail, { tipAfter, detail: s.detail });
await closeAll();

// 6c. Dragging across tiles on touch shows no card
t = await frontTile();
await touch('touchStart', [[t.x, t.y]]);
let maxTip = 0;
for (let k = 1; k <= 10; k++) { await touch('touchMove', [[t.x + k * 6, t.y]]); await sleep(30); maxTip = Math.max(maxTip, +await page.evaluate(() => getComputedStyle(document.getElementById('tip')).opacity)); }
await touch('touchEnd', []); await sleep(500);
check('touch drag shows no hover card', maxTip < 0.1, { maxTip });
await closeAll();

// 7. Menu: Subject → interior chip → tag view. Reopen the menu; a tap on the globe closes the menu first (stays in the
//    tag view), the next tap on empty space goes back to the globe. Nothing else may be picked up by the ghost click.
const chip = page.locator('.chip', { hasText: /^interior/ }).first();
const openSubject = async () => { await page.locator('.m-bar [data-sec=subject]').tap(); await sleep(500); };
const enterInterior = async () => { await openSubject(); await chip.tap(); await sleep(2000); };
const menuOpen = () => page.evaluate(() => document.getElementById('menu').classList.contains('open'));
await openSubject();
check('Subject button opens the menu panel', await menuOpen());
await chip.tap(); await sleep(2000);
s = await state(); check('chip tap enters tag view and closes the menu', s.view === 'focus' && !(await menuOpen()), s);
await openSubject();
const emptyPt = await page.evaluate(() => { for (const [fx, fy] of [[0.95, 0.12], [0.05, 0.95], [0.95, 0.95], [0.5, 0.03]]) { const x = innerWidth * fx, y = innerHeight * fy; if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return [x, y]; } return null; });
await page.touchscreen.tap(...emptyPt); await sleep(900);
s = await state(); check('tap on the globe with the menu open closes the menu and stays in the tag view', s.view === 'focus' && !(await menuOpen()), { ...s, at: emptyPt.map(Math.round) });
await page.touchscreen.tap(...emptyPt); await sleep(1800);
s = await state(); check('next tap on empty space returns to the globe', s.view === 'globe' && !(await menuOpen()), s);
await closeAll();

// 8. After returning to the globe on touch, no hover highlight is stuck on
await sleep(1500); s = await state();
check('no stuck highlight after leaving tag view', s.hlDim < 50, { dimmedTiles: s.hlDim });

// 9. In the tag view, tapping the first scan opens the light box and it stays open
await reload();
await enterInterior();
t = await page.evaluate(() => window.__tileXY().filter(t => t.inF).sort((a, b) => a.order - b.order)[0]);
await page.touchscreen.tap(t.x, t.y); await sleep(1000);
s = await state();
check('tap on tag-view tile opens light box and it stays open', s.detail, s);
await closeAll();

// 10. Escape twice in quick succession from the light box returns to the globe
await enterInterior();
t = await page.evaluate(() => window.__tileXY().filter(t => t.inF).sort((a, b) => a.order - b.order)[0]);
await page.touchscreen.tap(t.x, t.y); await sleep(900);
await page.keyboard.press('Escape'); await sleep(150); await page.keyboard.press('Escape'); await sleep(1600);
s = await state();
check('Esc, Esc (150ms apart) from light box returns to globe', s.view === 'globe' && !s.detail, s);

check('no page errors', errors.length === 0, errors);
const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `touch-${DEVICE.replace(/\s+/g, '-').toLowerCase()}.json`), JSON.stringify({ device: DEVICE, results }, null, 2));
await browser.close();
