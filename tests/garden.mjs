// Project map (garden/): content from content.json, blue squares on the globe, a topic shows images with titles,
// a project opens as images and text, the menu is Filter / About / CV.
//   node tests/garden.mjs [--base http://localhost:3000/garden/] [--three-dir /path/to/three/package]
import { chromium, devices } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/garden/';
const here = path.dirname(fileURLToPath(import.meta.url)); const src = fs.readFileSync(path.join(here, 'run.mjs'), 'utf8');
const HOOK = src.slice(src.indexOf('const HOOK = () => {') + 13, src.indexOf('\n};\n', src.indexOf('const HOOK')) + 2);
const OUT = path.join(here, 'out', 'garden'); fs.mkdirSync(OUT, { recursive: true });
const content = JSON.parse(fs.readFileSync(path.join(here, '..', 'garden', 'content.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let fail = 0; const check = (ok, name, d) => { console.log(ok ? 'PASS' : 'FAIL', name, d !== undefined ? JSON.stringify(d) : ''); if (!ok) fail++; };
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone-14', devices['iPhone 14']]]) {
  const ctx = await b.newContext(opts); await ctx.addInitScript(`(${HOOK})()`);
  if (args['three-dir']) await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', r => r.fulfill({ path: path.join(args['three-dir'], new URL(r.request().url()).pathname.replace('/npm/three@0.147.0/', '')), contentType: 'text/javascript' }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('requestfailed', q => errs.push('failed ' + q.url()));
  const tap = async loc => opts.hasTouch ? loc.tap() : loc.click();
  const tiles = () => p.evaluate(() => window.__scene.children.filter(o => o.userData.f).map(o => ({ title: o.userData.f.title, img: !!o.material.map, inF: o.userData.f.inF })));
  await p.goto(BASE); await p.waitForFunction(() => window.__frames > 30); await sleep(3000);
  await p.screenshot({ path: `${OUT}/${name}-1-globe.png` });

  check((await p.textContent('#status')) === `${content.role} · ${content.projects.length} projects`, `${name}: status line from content.json`, await p.textContent('#status'));
  const t0 = await tiles();
  check(t0.length === content.projects.length && t0.every(t => !t.img), `${name}: globe shows ${content.projects.length} plain squares, no images`, t0.length);
  const buttons = await p.evaluate(() => [...document.querySelectorAll('.m-bar button')].filter(b => !b.hidden).map(b => b.textContent));
  check(JSON.stringify(buttons) === '["Filter","About","CV"]', `${name}: menu is Filter, About, CV`, buttons);
  const single = await p.evaluate(() => ({
    labels: [...document.querySelectorAll('.tag-label')].filter(e => +getComputedStyle(e).opacity > 0.05 && e.querySelector('small').textContent === '1').map(e => e.firstChild.textContent),
    chips: [...document.querySelectorAll('.m-panel .chip')].filter(e => !e.hidden && e.querySelector('span')?.textContent === '1').map(e => e.firstChild.textContent) }));
  check(!single.labels.length && !single.chips.length, `${name}: only topics shared by 2+ projects show`, single);

  await tap(p.locator('.m-bar [data-sec=topics]')); await sleep(600); await p.screenshot({ path: `${OUT}/${name}-2-filter.png` });
  await tap(p.locator('.chip', { hasText: /^website/ }).first()); await sleep(2400);
  const expect = content.projects.filter(x => x.tags.includes('website')).length;
  check(await p.textContent('#fTitle') === 'website' && (await p.textContent('#fSub')) === `${expect} projects`, `${name}: "website" topic view`, await p.textContent('#fSub'));
  const t1 = (await tiles()).filter(t => t.inF);
  check(t1.length === expect && t1.every(t => t.img), `${name}: topic view shows the projects' images`, t1.map(t => t.img));
  const titles = await p.evaluate(() => [...document.querySelectorAll('.p-title')].filter(e => +getComputedStyle(e).opacity > 0.9).map(e => e.textContent));
  check(titles.length === expect, `${name}: titles under the tiles`, titles);
  await p.screenshot({ path: `${OUT}/${name}-3-topic-website.png` });

  const t = await p.evaluate(() => window.__tileXY().filter(t => t.inF).sort((a, b) => a.order - b.order)[0]);
  if (opts.hasTouch) await p.touchscreen.tap(t.x, t.y); else await p.mouse.click(t.x, t.y);
  await sleep(1100);
  const d = await p.evaluate(() => ({ open: !document.getElementById('detail').hidden, title: document.getElementById('dCode').textContent, text: document.getElementById('dText').textContent.length, img: document.getElementById('dImg').naturalWidth,
    extra: [...document.querySelectorAll('#detail section, #detail dl, #detail .d-nav')].length }));
  check(d.open && d.text > 20 && d.img > 0 && d.extra === 0, `${name}: project view is images and text only`, d);
  const L = await p.evaluate(() => { const i = document.getElementById('dImg').getBoundingClientRect(), c = document.querySelector('.d-info').getBoundingClientRect(); return { imgTop: i.top, imgBottom: i.bottom, imgRight: i.right, infoTop: c.top, infoLeft: c.left }; });
  check(L.imgTop >= 0 && !(L.infoTop < L.imgBottom - 1 && L.infoLeft < L.imgRight - 1), `${name}: image doesn't overlap the text`, L);
  await p.screenshot({ path: `${OUT}/${name}-4-project.png` });
  await p.keyboard.press('Escape'); await sleep(700); await p.keyboard.press('Escape'); await sleep(1800);
  const t2 = await tiles();
  check(await p.evaluate(() => document.body.dataset.view) === 'globe' && t2.every(t => !t.img), `${name}: back on the globe, squares again`);

  await tap(p.locator('.m-bar [data-sec=about]')); await sleep(600);
  const ab = await p.evaluate(() => ({ intro: document.getElementById('aIntro').textContent.length, links: [...document.querySelectorAll('#aContact a')].map(a => a.textContent), photo: document.getElementById('aPhoto')?.naturalWidth }));
  check(ab.intro > 50 && ab.links.length === content.links.length && ab.photo > 0, `${name}: About panel`, ab);
  await p.screenshot({ path: `${OUT}/${name}-5-about.png` });
  await tap(p.locator('.m-bar [data-sec=cv]')); await sleep(600);
  check(await p.locator('#cvList li').count() === content.cv.length, `${name}: CV panel`);
  await p.screenshot({ path: `${OUT}/${name}-6-cv.png` });
  check(!errs.length, `${name}: no errors`, errs);
  await ctx.close();
}
// The page explains itself if content.json is missing
{
  const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } });
  if (args['three-dir']) await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', r => r.fulfill({ path: path.join(args['three-dir'], new URL(r.request().url()).pathname.replace('/npm/three@0.147.0/', '')), contentType: 'text/javascript' }));
  await ctx.route('**/content.json', r => r.fulfill({ status: 404, body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE); await sleep(1500);
  const st = await p.textContent('#status');
  check(/didn.t load/.test(st) && !errs.length, 'missing content.json: says so, no script error', { st, errs });
  await ctx.close();
}
await b.close(); process.exitCode = fail ? 1 : 0;
