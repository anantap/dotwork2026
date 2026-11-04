// Spinning the globe: a drag must keep turning it in any direction (no stop at the poles), and a drag that
// starts anywhere on the globe (outside the menu) must turn it.
//   node tests/drag.mjs [--base http://localhost:3000/] [--three-dir /path/to/three/package]
import { chromium, devices } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/photos/';
const here = path.dirname(fileURLToPath(import.meta.url)); const src = fs.readFileSync(path.join(here, 'run.mjs'), 'utf8');
const HOOK = src.slice(src.indexOf('const HOOK = () => {') + 13, src.indexOf('\n};\n', src.indexOf('const HOOK')) + 2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let fail = 0; const check = (ok, name, d) => { console.log(ok ? 'PASS' : 'FAIL', name, d ? JSON.stringify(d) : ''); if (!ok) fail++; };
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iPhone 14', devices['iPhone 14']]]) {
  const ctx = await b.newContext(opts); await ctx.addInitScript(`(${HOOK})()`);
  if (args['three-dir']) await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', r => r.fulfill({ path: path.join(args['three-dir'], new URL(r.request().url()).pathname.replace('/npm/three@0.147.0/', '')), contentType: 'text/javascript' }));
  const p = await ctx.newPage(); await p.goto(BASE); await p.waitForFunction(() => window.__frames > 30); await sleep(2500);
  const touch = !!opts.hasTouch, cdp = touch ? await ctx.newCDPSession(p) : null;
  const drag = async (x, y, dx, dy, steps = 10) => {
    if (touch) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); for (let k = 1; k <= steps; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * k / steps, y: y + dy * k / steps }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    else { await p.mouse.move(x, y); await p.mouse.down(); for (let k = 1; k <= steps; k++) await p.mouse.move(x + dx * k / steps, y + dy * k / steps); await p.mouse.up(); }
  };
  const cam = () => p.evaluate(() => window.__camera.position.clone().normalize().toArray());
  const vp = await p.evaluate(() => [innerWidth, innerHeight]);
  // 1. Keep dragging down: the view should go over the top of the globe and keep going
  // two drags of a quarter screen height = half a turn (same speed as before: a full screen height is a full turn),
  // so we should end up looking at the far side, having gone over the top
  const c0 = await cam(); let maxY = -1;
  for (let k = 0; k < 2; k++) { await drag(vp[0] / 2, vp[1] * 0.35, 0, vp[1] * 0.25); await sleep(300); maxY = Math.max(maxY, (await cam())[1]); }
  await sleep(1800); const c1 = await cam();
  const dot = c0[0] * c1[0] + c0[1] * c1[1] + c0[2] * c1[2];
  check(dot < -0.5, `${name}: dragging down goes over the pole and keeps turning`, { start: c0.map(v => +v.toFixed(2)), end: c1.map(v => +v.toFixed(2)), dot: +dot.toFixed(2), maxY: +maxY.toFixed(2) });
  // 2. Drags starting anywhere over the globe turn it (except on the menu itself)
  const stuck = [];
  for (const fx of [0.3, 0.5, 0.7]) for (const fy of [0.25, 0.4, 0.55, 0.7]) {
    const x = vp[0] * fx, y = vp[1] * fy;
    const onMenu = await p.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.menu, .focus-head, #detail'), [x, y]);
    if (onMenu) continue;
    const a = await cam(); await drag(x, y, 30, 0, 5); await sleep(400); const z = await cam();
    if (Math.hypot(a[0] - z[0], a[1] - z[1], a[2] - z[2]) < 0.01) stuck.push([Math.round(x), Math.round(y), await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e.className || e.tagName; }, [x, y])]);
  }
  check(!stuck.length, `${name}: drags anywhere on the globe turn it`, stuck);
  // a fully visible label (few topics on some maps: wait for one to turn to the front)
  const visibleLabel = async () => { for (let k = 0; k < 40; k++) { const v = await p.evaluate(() => { const e = [...document.querySelectorAll('.tag-label')].find(e => +getComputedStyle(e).opacity > 0.9); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, e.firstChild.textContent]; }); if (v) return v; await sleep(500); } throw new Error('no label came into view'); };
  const lab = await visibleLabel();
  { const a = await cam(); await drag(lab[0], lab[1], 30, 0, 5); await sleep(400); const z = await cam(); check(Math.hypot(a[0] - z[0], a[1] - z[1], a[2] - z[2]) > 0.01 && (await p.evaluate(() => document.body.dataset.view)) === 'globe', `${name}: a drag starting on the "${lab[2]}" label turns the globe`); }
  if (!touch) { // mouse over a label highlights its tag on the globe (find it again: the drag above moved it)
    await sleep(1500);
    const lh = await visibleLabel();
    await p.mouse.move(lh[0], lh[1]); await sleep(400);
    const lit = await p.evaluate(() => [...document.querySelectorAll('.tag-label.on')].map(e => e.firstChild.textContent));
    check(lit.length === 1, `${name}: hovering a label highlights its tag`, lit);
    await p.mouse.move(5, 5); await sleep(300);
  }
  // ... and a tap / click on a label still opens that tag
  const lab2 = await visibleLabel();
  if (touch) await p.touchscreen.tap(lab2[0], lab2[1]); else await p.mouse.click(lab2[0], lab2[1]);
  await sleep(1200);
  const fv = await p.evaluate(() => [document.body.dataset.view, document.getElementById('fTitle').textContent]);
  check(fv[0] === 'focus' && fv[1] === lab2[2], `${name}: tapping the "${lab2[2]}" label opens its tag view`, fv);
  await ctx.close();
}
await b.close(); process.exitCode = fail ? 1 : 0;
