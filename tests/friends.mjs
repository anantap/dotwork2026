// Friends: About links to it, it has its own address (/friends/), a shared link opens it, ✕ and Back close it.
//   node tests/friends.mjs [--base http://localhost:3000/]
import { chromium, devices } from 'playwright';
import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/';
const here = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(here, 'out', 'friends'); fs.mkdirSync(OUT, { recursive: true });
const content = JSON.parse(fs.readFileSync(path.join(here, '..', 'content.json'), 'utf8'));
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fails = 0; const check = (ok, msg, extra) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`, extra === undefined ? '' : JSON.stringify(extra)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = p => p.evaluate(() => ({ url: location.pathname, title: document.title, open: document.getElementById('menu').classList.contains('open'),
  friends: !document.querySelector('section[data-sec="friends"]').hidden, names: document.querySelectorAll('#fList li').length }));
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone-14', devices['iPhone 14']]]) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await sleep(3000);
  await p.click('.m-bar button'); await sleep(400);
  await p.click('#aContact a[href="friends/"]'); await sleep(500);
  let s = await state(p); await p.screenshot({ path: `${OUT}/${name}-friends.png` });
  check(s.url === '/friends/' && s.open && s.friends && s.names === content.friends.length && /^Friends · /.test(s.title), `${name}: About → Friends shows all ${content.friends.length} names at /friends/`, s);
  const names = await p.evaluate(() => [...document.querySelectorAll('#fList li')].map(l => l.textContent));
  check(names.join() === [...names].sort((x, y) => x.localeCompare(y, 'nl')).join(), `${name}: names in alphabetical order`);
  check(await p.evaluate(() => [...document.querySelectorAll('#fList a')].every(a => a.target === '_blank' && /^https?:/.test(a.getAttribute('href')))), `${name}: every name links out in a new tab`);
  await p.click('.m-bar button'); await sleep(400); s = await state(p);
  check(s.url === '/' && !s.open, `${name}: ✕ closes it and the address goes back to /`, s);
  await p.goBack(); await sleep(500); s = await state(p);
  check(s.url === '/friends/' && s.open && s.friends, `${name}: Back opens Friends again`, s);
  await p.goto(BASE + 'friends/'); await sleep(3000); s = await state(p);
  check(s.open && s.friends && s.names === content.friends.length, `${name}: a shared /friends/ link opens it`, s);
  check(!errs.length, `${name}: no errors`, errs);
  await ctx.close();
}
await b.close(); process.exit(fails ? 1 : 0);
