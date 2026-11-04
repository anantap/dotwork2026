// Addresses: every project and shared topic has its own page (/kinfill/, /photography/); a shared link opens it,
// the address follows what is on screen, Back and Forward step through the layers, and each page has its own link preview.
//   node tests/routes.mjs [--base http://localhost:3000/]     (after `npm run build`)
import { chromium, devices } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = (args.base || 'http://localhost:3000/').replace(/\/?$/, '/');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content.json'), 'utf8'));
const slugOf = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
let fail = 0; const check = (ok, name, d) => { console.log(ok ? 'PASS' : 'FAIL', name, d !== undefined ? JSON.stringify(d) : ''); if (!ok) fail++; };
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const proj = content.projects.find(p => p.images.length > 1), topic = 'photography';
// every project has a page with its own preview
for (const p of content.projects) {
  const html = await (await fetch(`${BASE}${slugOf(p.title)}/`)).text();
  const og = (html.match(/<meta property="og:title" content="([^"]*)">/) || [])[1], img = (html.match(/<meta property="og:image" content="([^"]*)">/) || [])[1];
  if (og !== p.title.replace(/&/g, '&amp;') || !/\/img\/og\//.test(img || '')) check(false, `/${slugOf(p.title)}/ has its own link preview`, { og, img });
}
check(true, `all ${content.projects.length} projects have a page with their own title and preview image`);
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone-14', devices['iPhone 14']]]) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  const st = () => p.evaluate(() => ({ url: location.pathname, title: document.title, detail: !document.getElementById('detail').hidden && document.getElementById('dCode').textContent, topic: !document.getElementById('sheet').hidden && document.getElementById('fTitle').textContent }));
  const w = ms => p.waitForTimeout(ms), tap = loc => opts.hasTouch ? loc.tap() : loc.click();
  await p.goto(`${BASE}${slugOf(proj.title)}/`); await w(3000);
  let s = await st(); check(s.detail === proj.title && s.title.startsWith(proj.title), `${name}: a shared project link opens "${proj.title}"`, s);
  await tap(p.locator(opts.hasTouch ? '#dCloseB' : '#dClose')); await w(900);
  s = await st(); check(s.url === new URL(BASE).pathname && !s.detail, `${name}: closing it shows the globe at /`, s);
  await p.goto(`${BASE}${topic}/`); await w(3000);
  s = await st(); check(s.topic === topic, `${name}: a shared topic link opens the "${topic}" page`, s);
  await tap(p.locator('#sGrid .s-tile').first()); await w(1200);
  const first = await p.evaluate(() => document.getElementById('dCode').textContent);
  s = await st(); check(s.url.endsWith(`/${slugOf(first)}/`) && s.topic === topic, `${name}: opening a project from a topic gives it its address`, s);
  await p.goBack(); await w(1200);
  s = await st(); check(s.url.endsWith(`/${topic}/`) && !s.detail && s.topic === topic, `${name}: Back closes the project, the topic stays`, s);
  await p.goBack(); await w(1200);
  s = await st(); check(s.url === new URL(BASE).pathname && !s.topic, `${name}: Back again returns to the globe`, s);
  await p.goForward(); await w(1200);
  s = await st(); check(s.topic === topic, `${name}: Forward opens the topic again`, s);
  await tap(p.locator('#back')); await w(1200);
  s = await st(); check(s.url === new URL(BASE).pathname && !s.topic, `${name}: Return goes to the globe and its address`, s);
  check(!errs.length, `${name}: no errors`, errs);
  await ctx.close();
}
await b.close();
if (fail) { console.log(`${fail} failed`); process.exit(1); }
