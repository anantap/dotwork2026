// Project map (the home page): content from content.json, only topics on the globe, a topic shows images with titles,
// a project opens as images and text, the menu is one About panel (intro, contact, projects, experience).
//   node tests/garden.mjs [--base http://localhost:3000/]
import { HOOK } from './hook.mjs'; import { chromium, devices } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out', 'garden'); fs.mkdirSync(OUT, { recursive: true });
const content = JSON.parse(fs.readFileSync(path.join(here, '..', 'content.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let fail = 0; const check = (ok, name, d) => { console.log(ok ? 'PASS' : 'FAIL', name, d !== undefined ? JSON.stringify(d) : ''); if (!ok) fail++; };
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone-14', devices['iPhone 14']]]) {
  const ctx = await b.newContext(opts); await ctx.addInitScript(`(${HOOK})()`);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && !(/\/garden$/.test(BASE) && /404/.test(m.text())) && errs.push(m.text())); // without a trailing slash the first content.json lookup 404s by design p.on('requestfailed', q => errs.push('failed ' + q.url()));
  const tap = async loc => opts.hasTouch ? loc.tap() : loc.click();
  await p.goto(BASE); await p.waitForFunction(() => window.__frames > 30); await sleep(3000);
  await p.screenshot({ path: `${OUT}/${name}-1-globe.png` });

  await p.waitForFunction(() => document.getElementById('status').textContent.length > 0, null, { timeout: 5000 }).catch(() => {}); // (empty for a moment between two lines)
  const stText = await p.textContent('#status'); // the lines type themselves out, so any start of one counts
  check(!!stText && [].concat(content.status).some(l => l.startsWith(stText)) && await p.evaluate(() => getComputedStyle(document.getElementById('status'), '::before').backgroundColor !== 'rgba(0, 0, 0, 0)'), `${name}: status line from content.json, with its green dot`, stText);
  const meshes = await p.evaluate(() => window.__scene.children.map(o => o.type));
  check(meshes.join() === 'LineSegments', `${name}: the globe is its topic lines only`, meshes);
  const buttons = await p.evaluate(() => [...document.querySelectorAll('.m-bar button')].filter(b => !b.hidden).map(b => b.textContent));
  check(JSON.stringify(buttons) === '["About"]', `${name}: menu is one About button`, buttons);
  // one-off topics: quiet background labels (no count, can't be tapped); only shared topics are chips and open a view
  await sleep(500);
  const lab = await p.evaluate(() => ({
    solo: [...document.querySelectorAll('.tag-label.solo')].filter(e => +getComputedStyle(e).opacity > 0.3).map(e => ({ t: e.textContent, r: e.getBoundingClientRect().toJSON() })),
    soloWithCount: [...document.querySelectorAll('.tag-label.solo small')].length,
    shared: [...document.querySelectorAll('.tag-label:not(.solo)')].filter(e => +getComputedStyle(e).opacity > 0.3).map(e => e.firstChild.textContent),
    chips: [...document.querySelectorAll('.m-panel .chip')].filter(e => !e.hidden && e.querySelector('span')?.textContent === '1').map(e => e.firstChild.textContent) }));
  check(lab.solo.length > 0 && !lab.soloWithCount && !lab.chips.length, `${name}: one-off topics show as labels without a count`, { solo: lab.solo.map(x => x.t), chips: lab.chips });
  const so = lab.solo[0].r;
  if (opts.hasTouch) await p.touchscreen.tap(so.x + so.width / 2, so.y + so.height / 2); else await p.mouse.click(so.x + so.width / 2, so.y + so.height / 2);
  await sleep(900);
  const solo = await p.evaluate(() => ({ view: document.body.dataset.view, detail: !document.getElementById('detail').hidden, title: document.getElementById('dCode').textContent }));
  const owner = content.projects.find(x => x.tags.includes(lab.solo[0].t)).title;
  check(solo.view === 'globe' && solo.detail && solo.title === owner, `${name}: tapping a one-off label ("${lab.solo[0].t}") opens its project directly`, solo);
  await p.keyboard.press('Escape'); await sleep(900);
  // open the "website" topic the way a visitor does: its label on the globe (labels are buttons; they let drags through, so trigger it directly)
  await p.evaluate(() => [...document.querySelectorAll('.tag-label')].find(e => e.firstChild.textContent === 'website').click()); await sleep(2400);
  const expect = content.projects.filter(x => x.tags.includes('website')).length;
  check(await p.textContent('#fTitle') === 'website' && (await p.textContent('#fSub')) === `${expect} projects`, `${name}: "website" topic view`, await p.textContent('#fSub'));
  await sleep(400); check(await p.evaluate(() => getComputedStyle(document.getElementById('menu')).visibility) === 'hidden', `${name}: no About button in a topic`);
  await sleep(800);
  // the topic is a page of its own over the globe: a grid of square photos with titles, 3 columns on wide screens, 2 on phones
  const g = await p.evaluate(() => {
    const ts = [...document.querySelectorAll('#sGrid .s-tile')].map(b => ({ t: b.querySelector('span').textContent, img: b.querySelector('img').getBoundingClientRect().toJSON(), ttl: b.querySelector('span').getBoundingClientRect().toJSON(), loaded: b.querySelector('img').naturalWidth > 0 }));
    const lefts = [...new Set(ts.map(x => Math.round(x.img.left)))], head = document.getElementById('fTitle').getBoundingClientRect();
    const over = []; ts.forEach(a => ts.forEach(b => { if (a !== b && a.ttl.left < b.img.right && a.ttl.right > b.img.left && a.ttl.top < b.img.bottom && a.ttl.bottom > b.img.top) over.push(`${a.t} on ${b.t}`); }));
    return { n: ts.length, loaded: ts.every(x => x.loaded), titles: ts.map(x => x.t), cols: lefts.length, square: ts.every(x => Math.abs(x.img.width - x.img.height) < 1),
      left: Math.round(Math.min(...ts.map(x => x.img.left))), right: Math.round(innerWidth - Math.max(...ts.map(x => x.img.right))), textLeft: Math.round(head.left), over, sheet: getComputedStyle(document.getElementById('sheet')).opacity }; });
  check(g.n === expect && g.loaded && g.square, `${name}: topic page shows each project's photo, square`, { n: g.n, loaded: g.loaded });
  check(g.titles.length === expect, `${name}: titles under the tiles`, g.titles);
  check(g.cols === Math.min(expect, opts.hasTouch ? 2 : 3), `${name}: ${opts.hasTouch ? 2 : 3} columns`, g.cols);
  if (opts.hasTouch) check(g.left === g.textLeft && Math.abs(g.left - g.right) <= 1, `${name}: grid lines up with the text, same margin left and right`, { left: g.left, right: g.right, text: g.textLeft });
  check(!g.over.length, `${name}: no title sits on another tile`, g.over);
  if (opts.hasTouch) { const bk = await p.evaluate(() => { const a = document.getElementById('back').getBoundingClientRect(), m = document.getElementById('mBar').getBoundingClientRect(); return [Math.round(a.top + a.height / 2), Math.round(m.top + m.height / 2), getComputedStyle(document.getElementById('back')).position]; });
    check(bk[2] === 'fixed' && Math.abs(bk[0] - bk[1]) <= 2, `${name}: Return pinned at the bottom, where About sits`, bk); }
  const also = await p.evaluate(() => [...document.querySelectorAll('#fWith .chip')].map(c => c.textContent));
  const shared = t => content.projects.filter(x => x.tags.includes(t)).length >= 2;
  check(also.every(shared), `${name}: "Also" lists shared topics only`, also);
  await p.screenshot({ path: `${OUT}/${name}-3-topic-website.png` });

  await tap(p.locator('#sGrid .s-tile').first());
  await sleep(1100);
  const d = await p.evaluate(() => ({ open: !document.getElementById('detail').hidden, title: document.getElementById('dCode').textContent, text: document.getElementById('dText').textContent.length, img: document.getElementById('dImg').naturalWidth,
    extra: [...document.querySelectorAll('#detail section, #detail dl, #detail .d-nav')].length }));
  check(d.open && d.text > 20 && d.img > 0 && d.extra === 0, `${name}: project view is images and text only`, d);
  const L = await p.evaluate(() => { const i = document.getElementById('dImg').getBoundingClientRect(), c = document.querySelector('.d-info').getBoundingClientRect(); return { imgTop: i.top, imgBottom: i.bottom, imgRight: i.right, infoTop: c.top, infoLeft: c.left }; });
  check(L.imgTop >= 0 && !(L.infoTop < L.imgBottom - 1 && L.infoLeft < L.imgRight - 1), `${name}: image doesn't overlap the text`, L);
  const fx = await p.evaluate(() => document.activeElement.id);
  check(fx === 'detail', `${name}: opened by click or tap, no focus ring on the close button`, fx);
  await p.screenshot({ path: `${OUT}/${name}-4-project.png` });
  await p.keyboard.press('Escape'); await sleep(700); await p.keyboard.press('Escape'); await sleep(1800);
  check(await p.evaluate(() => document.body.dataset.view === 'globe' && document.getElementById('sheet').hidden), `${name}: back on the globe, topic page gone`);

  if (!opts.hasTouch) { // keyboard only: a topic label → a project title → Enter opens it → Esc returns focus to the title
    const focusOn = async (sel, max = 60) => { for (let k = 0; k < max; k++) { if (await p.evaluate(q => document.activeElement?.matches(q), sel)) return true; await p.keyboard.press('Tab'); } return false; };
    await p.mouse.move(5, 5); await p.evaluate(() => document.activeElement?.blur());
    await p.keyboard.press('Escape'); await sleep(1500); // back to the globe
    check(await focusOn('.tag-label:not(.solo)'), `${name}: Tab reaches a shared topic label`);
    const topic = await p.evaluate(() => document.activeElement.firstChild.textContent);
    await p.keyboard.press('Enter'); await sleep(2400);
    check(await focusOn('.s-tile'), `${name}: Tab reaches a project in the "${topic}" page`);
    const ttl = await p.evaluate(() => document.activeElement.querySelector('span').textContent);
    await p.keyboard.press('Enter'); await sleep(1100);
    check(await p.evaluate(t => !document.getElementById('detail').hidden && document.getElementById('dCode').textContent === t, ttl), `${name}: Enter opens "${ttl}"`);
    check(await p.evaluate(() => document.activeElement.id) === 'dClose', `${name}: opened from the keyboard, focus is on the close button`);
    await p.keyboard.press('Escape'); await sleep(900);
    check(await p.evaluate(t => document.activeElement?.classList.contains('s-tile') && document.activeElement.querySelector('span').textContent === t, ttl), `${name}: Esc closes it and focus returns to the project`);
    await p.keyboard.press('Escape'); await sleep(1500);
  }
  { // a project with many photos: all of them stacked, no thumbnails
    const many = content.projects.filter(x => x.images.length > 1).sort((a, b) => b.images.length - a.images.length)[0];
    if (many) {
      const shared = many.tags.find(t => content.projects.filter(x => x.tags.includes(t)).length > 1);
      await p.evaluate(t => [...document.querySelectorAll('.tag-label')].find(e => e.firstChild.textContent === t).click(), shared); await sleep(2600);
      await p.evaluate(t => [...document.querySelectorAll('#sGrid .s-tile')].find(e => e.querySelector('span').textContent === t).click(), many.title); await sleep(1300);
      await p.screenshot({ path: `${OUT}/${name}-4b-many-images.png` });
      // every photo in a stack, no thumbnails; on a phone at full width, on desktop each fitting the screen
      const st = await p.evaluate(() => ({ src: document.getElementById('dImg').getAttribute('src'), thumbs: document.getElementById('dThumbs') ? 'shown' : 'none',
        stack: [...document.querySelectorAll('#dStack img')].map(i => i.getBoundingClientRect()).map(r => [Math.round(r.width), Math.round(r.height)]), big: Math.round(document.getElementById('dImg').getBoundingClientRect().width), vw: innerWidth, vh: innerHeight }));
      const fits = opts.hasTouch ? st.stack.every(([w]) => w > st.vw * 0.85) && st.big > st.vw * 0.85 : st.stack.every(([w, h]) => w > 0 && h <= st.vh);
      check((st.src === many.images[0] || st.src.includes(`/${many.images[0].slice(4).replace(/\.[a-z]+$/i, '')}-`)) && st.thumbs === 'none' && st.stack.length === many.images.length - 1 && fits, `${name}: "${many.title}" shows all ${many.images.length} photos one under the other`, { ...st, stack: st.stack.length });
      if (opts.hasTouch) { // first photo, then the text, then the rest
        const order = await p.evaluate(() => [document.getElementById('dImg'), document.getElementById('dText'), document.querySelector('#dStack img')].map(e => Math.round(e.getBoundingClientRect().top)));
        check(order[0] < order[1] && order[1] < order[2], `${name}: phone order is first photo, text, then the other photos`, order);
      } else { // the text stays beside the photos while they scroll
        const before = await p.evaluate(() => Math.round(document.getElementById('dText').getBoundingClientRect().top));
        await p.mouse.move(1300, 600); await p.mouse.wheel(0, 1500); await sleep(500); // the pointer over the text, not the photos
        const after = await p.evaluate(() => ({ text: Math.round(document.getElementById('dText').getBoundingClientRect().top), scrolled: document.getElementById('detail').scrollTop }));
        check(after.scrolled > 0 && after.text === before, `${name}: scrolling anywhere moves the photos, the text stays put`, { before, ...after });
        const inTopic = content.projects.filter(x => x.tags.includes(shared)), last = inTopic[inTopic.length - 1] === many; // the last one has no next: go back instead
        await p.keyboard.press(last ? 'ArrowLeft' : 'ArrowRight'); await sleep(500);
        const nx = await p.evaluate(() => ({ title: document.getElementById('dCode').textContent, top: document.getElementById('detail').scrollTop }));
        check(nx.title !== many.title && nx.top === 0, `${name}: ${last ? '←' : '→'} goes to the ${last ? 'previous' : 'next'} project, back at its first photo`, nx);
      }
      await p.keyboard.press('Escape'); await sleep(900); await p.keyboard.press('Escape'); await sleep(1600);
    }
  }
  await tap(p.locator('.m-bar [data-sec=about]')); await sleep(700);
  const ab = await p.evaluate(() => { const r = document.querySelector('.m-panel').getBoundingClientRect(), b = document.querySelector('.m-bar [data-sec=about]');
    return { intro: document.getElementById('aIntro').textContent.length, links: [...document.querySelectorAll('#aContact a')].map(a => a.textContent), photo: !!document.getElementById('aPhoto'), heading: !!document.querySelector('.m-panel h3'),
      cv: document.querySelectorAll('#cvList li').length, projectList: !!document.getElementById('aProjects'),
      offCentre: [Math.round(r.left + r.width / 2 - innerWidth / 2), Math.round(r.top + r.height / 2 - innerHeight / 2)], button: b.getAttribute('aria-label'), xShown: getComputedStyle(b.querySelector('.x')).display !== 'none' }; });
  check(await p.evaluate(() => !/@/.test(document.getElementById('aContact').textContent)), `${name}: About shows contact buttons, no bare email address`);
  check(ab.intro > 50 && ab.links.length === content.links.length && !ab.photo && !ab.heading && ab.cv === content.cv.length && !ab.projectList, `${name}: About has intro, contact and experience (no photo, no heading)`, ab);
  check(Math.abs(ab.offCentre[0]) <= 2 && Math.abs(ab.offCentre[1]) <= 2, `${name}: About panel is centred on the page`, ab.offCentre);
  check(ab.button === 'Close' && ab.xShown, `${name}: the About button turns into a close ✕`, ab.button);
  await p.screenshot({ path: `${OUT}/${name}-5-about.png` });
  await tap(p.locator('.m-bar [data-sec=about]')); await sleep(700);
  check(await p.evaluate(() => !document.getElementById('menu').classList.contains('open') && document.querySelector('.m-bar [data-sec=about]').getAttribute('aria-label') === 'About'), `${name}: ✕ closes it and the button reads About again`);
  check(!errs.length, `${name}: no errors`, errs);
  await ctx.close();
}
// The page explains itself if content.json is missing
{
  const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } });
  await ctx.route('**/content.json', r => r.fulfill({ status: 404, body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE); await sleep(1500);
  const st = await p.textContent('#status');
  check(/didn.t load/.test(st) && !errs.length, 'missing content.json: says so, no script error', { st, errs });
  await ctx.close();
}
await b.close(); process.exitCode = fail ? 1 : 0;
