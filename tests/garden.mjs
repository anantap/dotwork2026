// Project map (garden/): loads, menus open, a tag view and a project light box work, About opens as a node.
//   node tests/garden.mjs [--base http://localhost:3000/garden/] [--three-dir /path/to/three/package]
import { chromium, devices } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/garden/';
const here = path.dirname(fileURLToPath(import.meta.url)); const src = fs.readFileSync(path.join(here, 'run.mjs'), 'utf8');
const HOOK = src.slice(src.indexOf('const HOOK = () => {') + 13, src.indexOf('\n};\n', src.indexOf('const HOOK')) + 2);
const OUT = path.join(here, 'out', 'garden'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let fail = 0; const check = (ok, name, d) => { console.log(ok ? 'PASS' : 'FAIL', name, d ? JSON.stringify(d) : ''); if (!ok) fail++; };
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone-14', devices['iPhone 14']]]) {
  const ctx = await b.newContext(opts); await ctx.addInitScript(`(${HOOK})()`);
  if (args['three-dir']) await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', r => r.fulfill({ path: path.join(args['three-dir'], new URL(r.request().url()).pathname.replace('/npm/three@0.147.0/', '')), contentType: 'text/javascript' }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('requestfailed', q => errs.push('failed ' + q.url()));
  const tap = async loc => opts.hasTouch ? loc.tap() : loc.click();
  await p.goto(BASE); await p.waitForFunction(() => window.__frames > 30); await sleep(3000);
  await p.screenshot({ path: `${OUT}/${name}-1-globe.png` });
  check((await p.textContent('#status')).includes('6 projects'), `${name}: status line`, await p.textContent('#status'));
  const single = await p.evaluate(() => ({
    labels: [...document.querySelectorAll('.tag-label')].filter(e => +getComputedStyle(e).opacity > 0.05 && e.querySelector('small').textContent === '1').map(e => e.firstChild.textContent),
    chips: [...document.querySelectorAll('.m-panel .chip')].filter(e => !e.hidden && e.querySelector('span')?.textContent === '1').map(e => e.firstChild.textContent),
    buttons: [...document.querySelectorAll('.m-bar button')].filter(b => !b.hidden).map(b => b.textContent) }));
  check(!single.labels.length && !single.chips.length && !single.buttons.includes('Type'), `${name}: only categories shared by 2+ projects are nodes`, single);
  await tap(p.locator('.m-bar [data-sec=work]')); await sleep(600); await p.screenshot({ path: `${OUT}/${name}-2-menu-work.png` });
  await tap(p.locator('.chip', { hasText: /^website/ }).first()); await sleep(2200);
  check(await p.textContent('#fTitle') === 'website' && (await p.textContent('#fSub')).startsWith('4 projects'), `${name}: "website" tag view`, await p.textContent('#fSub'));
  await p.screenshot({ path: `${OUT}/${name}-3-tag-website.png` });
  const t = await p.evaluate(() => window.__tileXY().filter(t => t.inF).sort((a, b) => a.order - b.order)[0]);
  if (opts.hasTouch) await p.touchscreen.tap(t.x, t.y); else await p.mouse.click(t.x, t.y);
  await sleep(1000);
  const d = await p.evaluate(() => ({ open: !document.getElementById('detail').hidden, title: document.getElementById('dCode').textContent, text: document.getElementById('dText').textContent.slice(0, 40), img: document.getElementById('dImg').naturalWidth }));
  check(d.open && d.text && d.img > 0, `${name}: project light box`, d);
  await p.screenshot({ path: `${OUT}/${name}-4-detail.png` });
  await p.keyboard.press('Escape'); await sleep(600); await p.keyboard.press('Escape'); await sleep(1500);
  await tap(p.locator('.m-bar [data-sec=projects]')); await sleep(500);
  await tap(p.locator('.chip', { hasText: 'bami.blog' })); await sleep(1200);
  const bd = await p.evaluate(() => ({ title: document.getElementById('dCode').textContent, link: document.getElementById('dLink').hidden ? null : document.getElementById('dLink').href }));
  check(bd.title === 'bami.blog' && bd.link, `${name}: bami.blog from the Projects menu, with its link`, bd);
  await p.screenshot({ path: `${OUT}/${name}-5-bami.png` });
  await p.keyboard.press('Escape'); await sleep(800);
  await tap(p.locator('#mAbout')); await sleep(1200);
  const ab = await p.evaluate(() => ({ open: !document.getElementById('detail').hidden, title: document.getElementById('dCode').textContent, cv: document.querySelectorAll('#dCv li').length, links: [...document.querySelectorAll('#dContact a')].map(a => a.textContent), tags: !document.getElementById('dTagsS').hidden }));
  check(ab.open && ab.title === 'Ananta Mulyono' && ab.cv === 4 && ab.links.length === 2 && !ab.tags, `${name}: About opens as a node with CV and contact`, ab);
  await p.screenshot({ path: `${OUT}/${name}-6-about.png` });
  await p.keyboard.press('Escape'); await sleep(800);
  const lines = await p.evaluate(() => window.__tileXY().length);
  check(lines === 7, `${name}: 7 nodes on the globe (6 projects + About)`, lines);
  check(!errs.length, `${name}: no errors`, errs);
  await ctx.close();
}
await b.close(); process.exitCode = fail ? 1 : 0;
