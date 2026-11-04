// End-to-end test of /garden/admin/ against a local stand-in for Vercel and GitHub (tests/admin-server.mjs).
//   node tests/admin.mjs
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './admin-server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out', 'admin'); fs.mkdirSync(OUT, { recursive: true });
const SITE = 'http://localhost:3300';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const check = (ok, name, d) => { console.log(ok ? 'PASS' : 'FAIL', name, d !== undefined ? JSON.stringify(d) : ''); if (!ok) fail++; };

const { repo, close } = await start();
const content = () => JSON.parse(repo.read('garden/content.json').toString());
const before = content();
const b = await chromium.launch();

// --- the API refuses what it should
{
  const r1 = await fetch(`${SITE}/api/content`); check(r1.status === 401, 'content without logging in → 401');
  const r2 = await fetch(`${SITE}/api/save`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }); check(r2.status === 403, 'save without the admin header → 403');
  const r3 = await fetch(`${SITE}/api/login`, { method: 'POST', body: JSON.stringify({ password: 'nope' }), headers: { 'content-type': 'application/json', 'x-admin': '1' } }); check(r3.status === 401, 'wrong password → 401');
  const pw = process.env.ADMIN_PASSWORD; process.env.ADMIN_PASSWORD = '';
  const r4 = await fetch(`${SITE}/api/content`); const j4 = await r4.json();
  check(r4.status === 503 && /ADMIN_PASSWORD/.test(j4.error), 'not set up yet → 503 that says what to add', j4.error);
  process.env.ADMIN_PASSWORD = pw;
}

for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['iphone-14', devices['iPhone 14']]]) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage();
  const errs = [], missing = []; p.on('pageerror', e => errs.push(String(e)));
  // 401/409 are expected answers; a 404 is only allowed for images this test uploaded (they live in the fake GitHub, not on disk)
  p.on('response', r => { if (r.status() === 404) (/\/garden\/img\/[a-z]+-[0-9a-f]{6}\.jpg$/.test(r.url()) ? missing : errs).push('404 ' + r.url()); });
  await p.goto(`${SITE}/garden/admin`); await sleep(500);
  check(p.url().endsWith('/garden/admin/') && await p.isVisible('#loginForm'), `${name}: /garden/admin redirects to /garden/admin/ and asks for the password`);
  await p.fill('#pw', 'wrong'); await p.click('#loginForm button[type=submit]'); await sleep(400);
  check(await p.isVisible('#loginErr'), `${name}: wrong password shows an error`, await p.textContent('#loginErr'));
  await p.fill('#pw', 'test'); await p.click('#loginForm button[type=submit]'); await sleep(800);
  const n0 = await p.locator('details.project').count();
  check(n0 === content().projects.length, `${name}: editor lists the projects from GitHub`, n0);
  await p.screenshot({ path: `${OUT}/${name}-1-list.png`, fullPage: true });

  // a new project with a title, years, text, two topics and an image
  await p.click('#addProject'); await sleep(200);
  const card = p.locator('details.project').first();
  const title = `Test project ${name}`;
  await card.locator('input[type=text]').nth(0).fill(title);
  await card.locator('input[type=text]').nth(1).fill('2025');
  await card.locator('textarea').fill('A first paragraph.\n\nA second one.');
  const tagIn = card.locator('.tagadd input');
  await tagIn.fill('website'); await tagIn.press('Enter'); await sleep(150);
  await p.locator('details.project').first().locator('.tagadd input').fill('testing'); await p.locator('details.project').first().locator('.tagadd input').press('Enter'); await sleep(150);
  const chooser = p.waitForEvent('filechooser');
  await p.locator('details.project').first().locator('.drop').click();
  await (await chooser).setFiles([path.join(here, '..', 'garden', 'img', 'nvd.jpg'), path.join(here, '..', 'garden', 'img', 'kinfill.jpg')]);
  await p.waitForFunction(() => document.querySelectorAll('details.project')[0].querySelectorAll('.img img').length === 2, null, { timeout: 10000 }).catch(() => {});
  const thumbs = await p.locator('details.project').first().locator('.img img').count();
  check(thumbs === 2, `${name}: two images added and previewed`, thumbs);
  // move the second image first
  await p.locator('details.project').first().locator('.img').nth(1).locator('[aria-label="Move left"]').click(); await sleep(150);
  await p.screenshot({ path: `${OUT}/${name}-2-new-project.png`, fullPage: true });
  const commitsBefore = repo.commits.size;
  await p.click('#save');
  await p.waitForFunction(() => /Saved|failed|needs|changed|wrong/i.test(document.getElementById('status').textContent), null, { timeout: 15000 });
  const status = await p.textContent('#status');
  check(/^Saved/.test(status), `${name}: save succeeds`, status);
  const after = content(), np = after.projects.find(x => x.title === title);
  check(after.projects.length === n0 + 1 && np && np.years === '2025' && np.tags.join() === 'website,testing' && np.text.includes('\n\n'), `${name}: content.json on GitHub has the new project`, np);
  check(np && np.images.length === 2 && np.images.every(s => /^img\/[a-z0-9-]+\.jpg$/.test(s) && repo.read('garden/' + s)), `${name}: both images committed, paths the map can use`, np?.images);
  check(np && /^img\/kinfill-/.test(np.images[0]), `${name}: image order kept (moved image is the tile)`, np?.images);
  check(repo.commits.size === commitsBefore + 1, `${name}: one save is one commit`, repo.commits.size - commitsBefore);
  check(await p.locator('details.project').first().locator('.img img').first().evaluate(i => i.naturalWidth > 0), `${name}: previews still show right after saving`);
  await p.screenshot({ path: `${OUT}/${name}-3-saved.png`, fullPage: true });

  // someone edits content.json elsewhere → the next save is refused, nothing overwritten
  const edited = content(); edited.intro = 'Edited on GitHub'; repo.externalEdit('garden/content.json', Buffer.from(JSON.stringify(edited, null, 2)));
  await p.fill('#role', 'Designer'); await p.click('#save');
  await p.waitForFunction(() => /changed|Saved/.test(document.getElementById('status').textContent), null, { timeout: 10000 });
  check(/changed somewhere else/.test(await p.textContent('#status')) && content().intro === 'Edited on GitHub', `${name}: a conflicting save is refused, the other edit survives`, await p.textContent('#status'));
  await p.reload(); await sleep(800);
  check(await p.inputValue('#intro') === 'Edited on GitHub', `${name}: reload picks up the latest content`);

  // a project without an image can't be saved
  await p.click('#addProject'); await p.locator('details.project').first().locator('input[type=text]').first().fill('No images yet'); await p.click('#save'); await sleep(300);
  check(/needs at least one image/.test(await p.textContent('#status')), `${name}: a project without images is caught before saving`, await p.textContent('#status'));
  // remove the test project again (two-step delete) and save
  await p.locator('details.project').first().locator('.btn.danger').click(); await p.locator('details.project').first().locator('.btn.danger').click(); await sleep(200);
  const del = p.locator('details.project', { hasText: title });
  await del.locator('summary').click(); await del.locator('.btn.danger').click(); await del.locator('.btn.danger').click(); await sleep(200);
  await p.click('#save'); await p.waitForFunction(() => /^Saved|failed|changed/.test(document.getElementById('status').textContent), null, { timeout: 10000 });
  check(!content().projects.some(x => x.title === title) && content().projects.length === before.projects.length, `${name}: delete + save removes the project`, content().projects.length);

  await p.click('#logout'); await sleep(500);
  check(await p.isVisible('#loginForm'), `${name}: log out`);
  const r = await ctx.request.get(`${SITE}/api/content`); check(r.status() === 401, `${name}: logged out → API refuses`);
  check(!errs.length, `${name}: no errors`, errs);
  await ctx.close();
}
await b.close(); close();
console.log('fake GitHub saw', repo.requests, 'requests');
process.exitCode = fail ? 1 : 0;
