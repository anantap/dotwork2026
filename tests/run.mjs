// Cross-browser smoke + risk-area test for Roll a Month.
//
//   npx serve . -l 3000            (in another terminal, from the repo root)
//   node tests/run.mjs              (all engines that are installed)
//   node tests/run.mjs --engines chromium,webkit --base http://localhost:3000/
//   node tests/run.mjs --three-dir /path/to/three/package   (serve three.js r147 locally when jsDelivr is unreachable)
//
// Output: tests/out/<engine>-<device>/*.png and tests/out/report.json
import { chromium, firefox, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/';
const ENGINES = (args.engines || 'chromium,firefox,webkit').split(',');
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'out');
const THREE_DIR = args['three-dir'];
const FPS_MS = +(args['fps-ms'] || 5000);

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  'iphone-14': devices['iPhone 14'],
  'pixel-7': devices['Pixel 7'],
};
const ENGINE = { chromium, firefox, webkit };

// Test-only hook: keep a handle on three's scene and camera so the script can find tiles on screen.
// The page itself is not modified.
const HOOK = () => {
  window.__errs = [];
  addEventListener('error', e => window.__errs.push('error: ' + (e.message || e.target?.src || e.target?.href)), true);
  addEventListener('unhandledrejection', e => window.__errs.push('unhandledrejection: ' + e.reason));
  let T;
  Object.defineProperty(window, 'THREE', {
    configurable: true,
    get: () => T,
    set(v) {
      T = v; let WR;
      Object.defineProperty(v, 'WebGLRenderer', {
        configurable: true, enumerable: true,
        get: () => WR,
        set(C) {
          WR = class extends C {
            constructor(...a) {
              super(...a); window.__rr = this; const r = this.render;
              this.render = (s, c) => { window.__scene = s; window.__camera = c; window.__frames = (window.__frames || 0) + 1; return r.call(this, s, c); };
            }
          };
        },
      });
    },
  });
  window.__tileXY = pickFn => {
    const out = [];
    for (const o of window.__scene.children) {
      const f = o.userData && o.userData.f; if (!f) continue;
      const v = o.position.clone().project(window.__camera);
      out.push({ id: f.id, real: f.real, inF: f.inF, order: f.order, op: o.material.opacity, x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z, front: o.position.clone().normalize().dot(window.__camera.position.clone().normalize()) });
    }
    return out;
  };
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fpsFor = (page, ms) => page.evaluate(ms => new Promise(res => {
  const times = []; const t0 = performance.now();
  const f = t => { times.push(t); if (t - t0 < ms) requestAnimationFrame(f); else {
    const d = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
    res({ fps: +(1000 * (times.length - 1) / (times.at(-1) - times[0])).toFixed(1), p95ms: +d[Math.floor(d.length * 0.95)].toFixed(1), worstMs: +d.at(-1).toFixed(1) });
  } };
  requestAnimationFrame(f);
}), ms);

// Count lit pixels in a screenshot (decoded in the page, so no PNG library is needed)
const litShare = (page, buf) => page.evaluate(async b64 => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data; let lit = 0, blueish = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 30) lit++; if (d[i + 2] > 40 && d[i + 2] > d[i] * 1.4) blueish++; }
  return { lit: +(lit / (d.length / 4)).toFixed(4), blue: +(blueish / (d.length / 4)).toFixed(4) };
}, buf.toString('base64'));

async function runOne(engineName, devName) {
  const r = { engine: engineName, device: devName, console: [], pageErrors: [], failedRequests: [], steps: {}, issues: [] };
  const dir = path.join(OUT, `${engineName}-${devName}`); fs.mkdirSync(dir, { recursive: true });
  const shot = async (name) => { const buf = await page.screenshot({ path: path.join(dir, name + '.png') }); return buf; };
  let ctxOpts = { ...DEVICES[devName] };
  if (engineName === 'firefox') delete ctxOpts.isMobile; // Firefox has no isMobile emulation
  const browser = await ENGINE[engineName].launch(engineName === 'chromium' ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {});
  const context = await browser.newContext(ctxOpts);
  await context.addInitScript(HOOK);
  if (THREE_DIR) await context.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', route => {
    const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.147.0/', '');
    route.fulfill({ path: path.join(THREE_DIR, rel), contentType: 'text/javascript' });
  });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') r.console.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => r.pageErrors.push(String(e)));
  page.on('requestfailed', q => r.failedRequests.push(`${q.url().slice(0, 120)} ${q.failure()?.errorText}`));
  try {
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__frames > 30 && !/^0 frames/.test(document.getElementById('status').textContent), null, { timeout: 30000 });
    await sleep(2500); // tiles grow in
    r.env = await page.evaluate(() => {
      const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
      const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return {
        webgl: !!gl, webgl2: !!document.createElement('canvas').getContext('webgl2'), threeWebGL2: window.__rr?.capabilities?.isWebGL2,
        gpu: gl ? (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null,
        innerWidth, innerHeight, dpr: devicePixelRatio, hoverNone: matchMedia('(hover: none)').matches, coarse: matchMedia('(pointer: coarse)').matches,
        viewportMeta: document.querySelector('meta[name=viewport]')?.content || null, compatMode: document.compatMode,
        geistPixel: document.fonts.check('16px "Geist Pixel"'), geist: document.fonts.check('16px "Geist"'),
        pixelFontFaces: [...document.fonts].filter(f => f.family.includes('Geist Pixel')).map(f => f.status),
        mobileLayout: getComputedStyle(document.querySelector('.top')).flexDirection === 'column',
      };
    });
    const g = await shot('1-globe');
    r.steps.globe = await litShare(page, g);
    if (r.steps.globe.lit < 0.01) r.issues.push('globe looks blank');

    // Mouse hover over a frame shows its card (desktop only)
    if (!ctxOpts.hasTouch) {
      const ft = await page.evaluate(() => window.__tileXY().filter(t => t.front > 0.8 && t.op > 0.3 && t.x > 40 && t.x < innerWidth - 40 && t.y > 40 && t.y < innerHeight - 40 && document.elementFromPoint(t.x, t.y)?.tagName === 'CANVAS').sort((a, b) => (b.real - a.real) || (b.front - a.front))[0]);
      if (ft) {
        await page.mouse.move(ft.x, ft.y); await sleep(400);
        r.steps.hoverCard = await page.evaluate(() => ({ op: getComputedStyle(document.getElementById('tip')).opacity, code: document.querySelector('#tip .code')?.textContent }));
        if (+r.steps.hoverCard.op < 0.5) r.issues.push('hovering a frame shows no card');
        await page.mouse.move(5, (ctxOpts.viewport?.height || 800) - 5); await sleep(300);
      }
    }

    // Tag view
    const chip = page.locator('.chip', { hasText: /^interior/ }).first();
    await chip.click();
    await sleep(2200);
    r.steps.tagView = { view: await page.evaluate(() => document.body.dataset.view), title: await page.textContent('#fTitle') };
    await shot('2-tag-interior');
    // Is the first scan tile clickable, or does UI sit on top of it?
    const tile = (await page.evaluate(() => window.__tileXY())).filter(t => t.inF).sort((a, b) => a.order - b.order)[0];
    r.steps.tagView.firstTile = tile && { x: Math.round(tile.x), y: Math.round(tile.y), real: tile.real };
    r.steps.tagView.topElementAtTile = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e && (e.id || e.className || e.tagName); }, tile);
    if (r.steps.tagView.topElementAtTile !== '' && r.steps.tagView.topElementAtTile !== 'CANVAS') r.issues.push(`first tile covered by ${r.steps.tagView.topElementAtTile}`);
    // Any contact-sheet tiles that sit under (invisible) UI and so can't be clicked?
    r.steps.tagView.coveredTiles = await page.evaluate(() => window.__tileXY().filter(t => t.inF).map(t => ({ t, e: document.elementFromPoint(t.x, t.y) })).filter(({ e }) => e && e.tagName !== 'CANVAS').map(({ t, e }) => `#${t.order}→${e.className || e.tagName}`));
    if (r.steps.tagView.coveredTiles.length) r.issues.push(`${r.steps.tagView.coveredTiles.length} tag-view tiles under UI: ${r.steps.tagView.coveredTiles.slice(0, 4).join(', ')}`);
    r.fpsTag = await fpsFor(page, FPS_MS);

    // Detail view
    if (ctxOpts.hasTouch) await page.touchscreen.tap(tile.x, tile.y); else await page.mouse.click(tile.x, tile.y);
    await sleep(900);
    r.steps.detail = await page.evaluate(() => ({ open: !document.getElementById('detail').hidden, code: document.getElementById('dCode').textContent, imgOpacity: getComputedStyle(document.getElementById('dImg')).opacity, imgW: document.getElementById('dImg').getBoundingClientRect().width, src: document.getElementById('dImg').currentSrc.split('/').slice(-2).join('/') }));
    await shot('3-detail');
    if (!r.steps.detail.open) r.issues.push('tap/click on first tile did not open detail');
    if (r.steps.detail.open && +r.steps.detail.imgOpacity < 0.99) r.issues.push(`detail image stuck at opacity ${r.steps.detail.imgOpacity}`);

    // Keyboard: → then Esc, Esc (with a pause, like a person would)
    await page.keyboard.press('ArrowRight'); await sleep(500);
    r.steps.afterRight = await page.textContent('#dPos');
    await shot('4-detail-next');
    // Light box layout: the photo must not overlap the caption, and must not start above the screen
    r.steps.detailLayout = await page.evaluate(() => { const i = document.getElementById('dImg').getBoundingClientRect(), c = document.querySelector('.d-info').getBoundingClientRect(); return { imgTop: Math.round(i.top), imgBottom: Math.round(i.bottom), imgLeft: Math.round(i.left), imgRight: Math.round(i.right), infoTop: Math.round(c.top), infoLeft: Math.round(c.left) }; });
    { const L = r.steps.detailLayout; if (L.imgTop < 0 || (L.infoTop < L.imgBottom - 1 && L.infoLeft < L.imgRight - 1)) r.issues.push('light box photo overlaps caption ' + JSON.stringify(L)); }
    await page.keyboard.press('Escape'); await sleep(250);
    await page.keyboard.press('Escape'); await sleep(1600);
    r.steps.afterEscEsc = await page.evaluate(() => ({ view: document.body.dataset.view, detailHidden: document.getElementById('detail').hidden }));
    await shot('5-back-to-globe');
    if (r.steps.afterEscEsc.view !== 'globe' || !r.steps.afterEscEsc.detailHidden) r.issues.push(`Esc,Esc did not return to globe: ${JSON.stringify(r.steps.afterEscEsc)}`);
    await sleep(1000);
    r.fpsGlobe = await fpsFor(page, FPS_MS);
    r.pageErrors.push(...await page.evaluate(() => window.__errs));
  } catch (e) {
    r.issues.push('script error: ' + e.message.split('\n')[0]);
    await page.screenshot({ path: path.join(dir, 'error.png') }).catch(() => {});
  }
  await browser.close();
  return r;
}

const results = [];
for (const eng of ENGINES) {
  for (const dev of Object.keys(DEVICES)) {
    process.stdout.write(`${eng} × ${dev} … `);
    try { const r = await runOne(eng, dev); results.push(r); console.log(r.issues.length ? r.issues.join('; ') : 'ok', '| globe fps', r.fpsGlobe?.fps, '| tag fps', r.fpsTag?.fps); }
    catch (e) { results.push({ engine: eng, device: dev, issues: ['could not launch: ' + e.message.split('\n')[0]] }); console.log('could not launch:', e.message.split('\n')[0]); }
  }
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
console.log('wrote', path.join(OUT, 'report.json'));
