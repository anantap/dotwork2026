// Project map (the home page): content from content.json, only topics on the globe, a topic shows images with titles,
// a project opens as images and text, the menu is Filter / About / CV.
//   node tests/garden.mjs [--base http://localhost:3000/] [--three-dir /path/to/three/package]
import { chromium, devices } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/';
const here = path.dirname(fileURLToPath(import.meta.url)); const src = fs.readFileSync(path.join(here, 'run.mjs'), 'utf8');
const HOOK = src.slice(src.indexOf('const HOOK = () => {') + 13, src.indexOf('\n};\n', src.indexOf('const HOOK')) + 2);
const OUT = path.join(here, 'out', 'garden'); fs.mkdirSync(OUT, { recursive: true });
const content = JSON.parse(fs.readFileSync(path.join(here, '..', 'content.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let fail = 0; const check = (ok, name, d) => { console.log(ok ? 'PASS' : 'FAIL', name, d !== undefined ? JSON.stringify(d) : ''); if (!ok) fail++; };
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone-14', devices['iPhone 14']]]) {
  const ctx = await b.newContext(opts); await ctx.addInitScript(`(${HOOK})()`);
  if (args['three-dir']) await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', r => r.fulfill({ path: path.join(args['three-dir'], new URL(r.request().url()).pathname.replace('/npm/three@0.147.0/', '')), contentType: 'text/javascript' }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && !(/\/garden$/.test(BASE) && /404/.test(m.text())) && errs.push(m.text())); // without a trailing slash the first content.json lookup 404s by design p.on('requestfailed', q => errs.push('failed ' + q.url()));
  const tap = async loc => opts.hasTouch ? loc.tap() : loc.click();
  const tiles = () => p.evaluate(() => window.__scene.children.filter(o => o.userData.f).map(o => ({ title: o.userData.f.title, img: !!o.material.map, inF: o.userData.f.inF })));
  await p.goto(BASE); await p.waitForFunction(() => window.__frames > 30); await sleep(3000);
  await p.screenshot({ path: `${OUT}/${name}-1-globe.png` });

  check((await p.textContent('#status')) === `${content.role} · ${content.projects.length} projects`, `${name}: status line from content.json`, await p.textContent('#status'));
  const t0 = await p.evaluate(() => window.__tileXY().map(t => +t.op.toFixed(3)));
  check(t0.length === content.projects.length && t0.every(o => o < 0.02), `${name}: no project tiles on the globe, just topics`, t0);
  const buttons = await p.evaluate(() => [...document.querySelectorAll('.m-bar button')].filter(b => !b.hidden).map(b => b.textContent));
  check(JSON.stringify(buttons) === '["Filter","About","CV"]', `${name}: menu is Filter, About, CV`, buttons);
  // one-off topics: quiet background labels (no count, can't be tapped); only shared topics are chips and open a view
  await sleep(500);
  const lab = await p.evaluate(() => ({
    solo: [...document.querySelectorAll('.tag-label.solo')].filter(e => +getComputedStyle(e).opacity > 0.3).map(e => ({ t: e.textContent, r: e.getBoundingClientRect().toJSON() })),
    soloWithCount: [...document.querySelectorAll('.tag-label.solo small')].length,
    shared: [...document.querySelectorAll('.tag-label:not(.solo)')].filter(e => +getComputedStyle(e).opacity > 0.3).map(e => e.firstChild.textContent),
    chips: [...document.querySelectorAll('.m-panel .chip')].filter(e => !e.hidden && e.querySelector('span')?.textContent === '1').map(e => e.firstChild.textContent) }));
  check(lab.solo.length > 0 && !lab.soloWithCount && !lab.chips.length, `${name}: one-off topics show as quiet labels, not in Filter`, { solo: lab.solo.map(x => x.t), chips: lab.chips });
  const so = lab.solo[0].r;
  if (opts.hasTouch) await p.touchscreen.tap(so.x + so.width / 2, so.y + so.height / 2); else await p.mouse.click(so.x + so.width / 2, so.y + so.height / 2);
  await sleep(900);
  const solo = await p.evaluate(() => ({ view: document.body.dataset.view, detail: !document.getElementById('detail').hidden, title: document.getElementById('dCode').textContent }));
  const owner = content.projects.find(x => x.tags.includes(lab.solo[0].t)).title;
  check(solo.view === 'globe' && solo.detail && solo.title === owner, `${name}: tapping a one-off label ("${lab.solo[0].t}") opens its project directly`, solo);
  await p.keyboard.press('Escape'); await sleep(900);
  await tap(p.locator('.m-bar [data-sec=topics]')); await sleep(600); await p.screenshot({ path: `${OUT}/${name}-2-filter.png` });
  await tap(p.locator('.chip', { hasText: /^website/ }).first()); await sleep(2400);
  const expect = content.projects.filter(x => x.tags.includes('website')).length;
  check(await p.textContent('#fTitle') === 'website' && (await p.textContent('#fSub')) === `${expect} projects`, `${name}: "website" topic view`, await p.textContent('#fSub'));
  const t1 = (await tiles()).filter(t => t.inF);
  check(t1.length === expect && t1.every(t => t.img), `${name}: topic view shows the projects' images`, t1.map(t => t.img));
  const titles = await p.evaluate(() => [...document.querySelectorAll('.p-title')].filter(e => +getComputedStyle(e).opacity > 0.9).map(e => e.textContent));
  check(titles.length === expect, `${name}: titles under the tiles`, titles);
  const overlaps = await p.evaluate(() => {
    const pxu = innerHeight / (2 * Math.tan(window.__camera.fov * Math.PI / 360)), out = [];
    const tiles = window.__scene.children.filter(o => o.userData.f && o.userData.f.inF).map(o => { const v = o.position.clone(), d = v.distanceTo(window.__camera.position); v.project(window.__camera); o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox, k = o.scale.x * pxu / d, x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight; return { t: o.userData.f.title, r: [x + bb.min.x * k, y - bb.max.y * k, x + bb.max.x * k, y - bb.min.y * k] }; });
    for (const e of document.querySelectorAll('.p-title')) { if (+getComputedStyle(e).opacity < 0.5) continue; const b = e.getBoundingClientRect(); for (const t of tiles) if (t.t !== e.textContent && b.left < t.r[2] && b.right > t.r[0] && b.top < t.r[3] && b.bottom > t.r[1]) out.push(`${e.textContent} on ${t.t}`); }
    return out; });
  check(!overlaps.length, `${name}: no title sits on another tile`, overlaps);
  const also = await p.evaluate(() => [...document.querySelectorAll('#fWith .chip')].map(c => c.textContent));
  const shared = t => content.projects.filter(x => x.tags.includes(t)).length >= 2;
  check(also.every(shared), `${name}: "Also" lists shared topics only`, also);
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
  const t3 = await p.evaluate(() => window.__tileXY().map(t => t.op));
  check(await p.evaluate(() => document.body.dataset.view) === 'globe' && t2.every(t => !t.img) && t3.every(o => o < 0.05), `${name}: back on the globe, projects hidden again`);

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
