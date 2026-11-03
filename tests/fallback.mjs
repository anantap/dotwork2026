// The page must explain itself, without script errors, when WebGL is off or three.js fails to load (Chromium).
//   node tests/fallback.mjs [--base http://localhost:3000/] [--three-dir /path/to/three/package]
import { chromium } from 'playwright'; import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/';
let fail = 0;
for (const [name, launchArgs, cdnUp, expect] of [['WebGL off', ['--disable-webgl', '--disable-3d-apis'], true, /needs WebGL/], ['three.js unreachable', [], false, /didn.t load/]]) {
  const b = await chromium.launch({ args: launchArgs }); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', r => !cdnUp ? r.abort() : args['three-dir'] ? r.fulfill({ path: path.join(args['three-dir'], new URL(r.request().url()).pathname.replace('/npm/three@0.147.0/', '')), contentType: 'text/javascript' }) : r.continue());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE); await p.waitForTimeout(1000);
  const status = await p.textContent('#status'), ok = expect.test(status) && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify({ status, errs })); if (!ok) fail++;
  await b.close();
}
process.exitCode = fail ? 1 : 0;
