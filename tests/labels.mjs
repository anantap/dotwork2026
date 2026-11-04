// Tag labels on the globe must not sit on the title or the menu, run off screen, or overlap each other.
//   node tests/labels.mjs [--base http://localhost:3000/] [--three-dir /path/to/three/package]
import { chromium, devices } from 'playwright'; import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/photos/';
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let fail = 0;
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iPhone 14', devices['iPhone 14']], ['Pixel 7', devices['Pixel 7']], ['iPhone 14 landscape', devices['iPhone 14 landscape']]]) {
  const ctx = await b.newContext(opts);
  if (args['three-dir']) await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', r => r.fulfill({ path: path.join(args['three-dir'], new URL(r.request().url()).pathname.replace('/npm/three@0.147.0/', '')), contentType: 'text/javascript' }));
  const p = await ctx.newPage(); await p.goto(BASE); await p.waitForTimeout(3500);
  const bad = new Set();
  for (let k = 0; k < 12; k++) { // sample while the globe turns; the second half with the Subject panel open
    if (k === 6) { await p.locator('.m-bar button[data-sec]').nth(1).click(); await p.waitForTimeout(600); }
    (await p.evaluate(() => {
      const ui = ['.head', '.m-bar', ...(document.getElementById('menu').classList.contains('open') ? ['.m-panel'] : [])].map(s => document.querySelector(s).getBoundingClientRect());
      const ls = [...document.querySelectorAll('.tag-label')].filter(e => +getComputedStyle(e).opacity > 0.5).map(e => ({ n: e.firstChild.textContent, r: e.getBoundingClientRect() }));
      const hit = (a, c) => a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top;
      const out = [];
      ls.forEach((l, i) => {
        if (l.r.left < 0 || l.r.right > innerWidth) out.push(`${l.n} off screen`);
        if (ui.some(u => hit(l.r, u))) out.push(`${l.n} on UI`);
        ls.slice(i + 1).forEach(m => { if (hit(l.r, m.r)) out.push(`${l.n} × ${m.n}`); });
      });
      return out;
    })).forEach(x => bad.add(x));
    await p.waitForTimeout(400);
  }
  console.log(bad.size ? 'FAIL' : 'PASS', name, [...bad].join('; '));
  if (bad.size) fail++;
  await p.screenshot({ path: `tests/out/labels-${name.replace(/\s+/g, '-').toLowerCase()}.png` });
  await ctx.close();
}
await b.close(); process.exitCode = fail ? 1 : 0;
