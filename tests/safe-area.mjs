// Safe-area check (Chromium only): fakes iPhone notch / home-indicator insets via CDP and checks the UI stays inside them.
//   node tests/safe-area.mjs [--base http://localhost:3000/] [--three-dir /path/to/three/package]
import { chromium, devices } from 'playwright';
import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/photos/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'safe-area'); fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const cases = [
  { name: 'portrait', dev: devices['iPhone 14'], insets: { top: 47, bottom: 34, left: 0, right: 0 } },
  { name: 'landscape', dev: devices['iPhone 14 landscape'], insets: { top: 0, bottom: 21, left: 47, right: 47 } },
];
let fail = 0;
for (const c of cases) {
  const ctx = await b.newContext({ ...c.dev });
  if (args['three-dir']) await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', r => r.fulfill({ path: path.join(args['three-dir'], new URL(r.request().url()).pathname.replace('/npm/three@0.147.0/', '')), contentType: 'text/javascript' }));
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: c.insets });
  await p.goto(BASE); await p.waitForTimeout(3000);
  const res = await p.evaluate(ins => {
    const bad = [];
    for (const sel of ['h1', '.status', '.m-bar', '.back']) {
      const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).opacity === '0') continue;
      if (r.top < ins.top || r.left < ins.left || r.right > innerWidth - ins.right || r.bottom > innerHeight - ins.bottom) bad.push(`${sel} ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    return { innerWidth, innerHeight, envTop: getComputedStyle(document.querySelector('.ui')).paddingTop, envLeft: getComputedStyle(document.querySelector('.ui')).paddingLeft, envBottom: getComputedStyle(document.querySelector('.ui')).paddingBottom, bad };
  }, c.insets);
  await p.screenshot({ path: path.join(OUT, `iphone-14-${c.name}.png`) });
  console.log(res.bad.length ? 'FAIL' : 'PASS', c.name, JSON.stringify(res)); if (res.bad.length) fail++;
  await ctx.close();
}
await b.close(); process.exitCode = fail ? 1 : 0;
