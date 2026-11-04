// Page weight and load time, measured in a fresh browser (empty cache) on a throttled connection.
//   node tests/perf.mjs --base http://localhost:3000/ [--runs 3]
// Reports, per network profile: bytes over the wire and requests for the home page, the time until the globe is drawn,
// DOMContentLoaded and load, then what opening a topic and a project adds.
import { HOOK } from './hook.mjs'; import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? true]] : acc), []));
const BASE = args.base || 'http://localhost:3000/', RUNS = +(args.runs || 3);
const here = path.dirname(fileURLToPath(import.meta.url));
const PROFILES = { 'slow 4G': { down: 1.6e6 / 8, up: 750e3 / 8, rtt: 150 }, 'fast': { down: 20e6 / 8, up: 5e6 / 8, rtt: 20 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function once(prof) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript(`(${HOOK})()`);
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable'); // a fresh context starts with an empty cache; within the visit the cache works as normal
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: prof.rtt, downloadThroughput: prof.down, uploadThroughput: prof.up });
  let bytes = 0, reqs = 0, last = Date.now(); const byType = {}, open = new Set();
  cdp.on('Network.requestWillBeSent', e => { reqs++; open.add(e.requestId); last = Date.now(); });
  cdp.on('Network.loadingFailed', e => { open.delete(e.requestId); last = Date.now(); });
  const types = new Map(); cdp.on('Network.responseReceived', e => types.set(e.requestId, e.response.mimeType.split('/')[0] === 'image' ? 'images' : /javascript/.test(e.response.mimeType) ? 'js' : /font|woff/.test(e.response.mimeType) ? 'fonts' : /css/.test(e.response.mimeType) ? 'css' : /html/.test(e.response.mimeType) ? 'html' : 'other'));
  cdp.on('Network.loadingFinished', e => { open.delete(e.requestId); bytes += e.encodedDataLength; const k = types.get(e.requestId) || 'other'; byType[k] = (byType[k] || 0) + e.encodedDataLength; last = Date.now(); });
  const idle = async (max = 180000) => { const t0 = Date.now(); while ((open.size || Date.now() - last < 1500) && Date.now() - t0 < max) await sleep(100); return last; };
  const t0 = Date.now(); await p.goto(BASE, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__frames > 1, null, { timeout: 120000, polling: 50 });
  const globe = Date.now() - t0;
  const full = (await idle()) - t0;
  const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  const home = { bytes, reqs, globe, full, ...nav, byType: { ...byType } };
  // open the biggest topic, then the project with the most photos (scrolled to the end, so every photo loads)
  bytes = 0; reqs = 0;
  await p.evaluate(() => [...document.querySelectorAll('.tag-label')].find(e => e.firstChild.textContent === 'photography').click());
  await sleep(500); await p.evaluate(() => { const s = document.getElementById('sheet'); if (s) s.scrollTo(0, 99999); }); await idle();
  const topic = { bytes, reqs };
  bytes = 0; reqs = 0;
  await p.evaluate(() => { const t = [...document.querySelectorAll('#sGrid .s-tile')].find(e => /Concrete/.test(e.textContent)); t.click(); });
  await sleep(800); await p.evaluate(async () => { const d = document.getElementById('detail'); for (let y = 0; y < 40000; y += 600) { d.scrollTo(0, y); document.getElementById('dMedia').scrollTo?.(0, y); await new Promise(r => setTimeout(r, 60)); } });
  await idle(120000);
  const project = { bytes, reqs };
  await ctx.close();
  return { home, topic, project };
}

const kb = n => `${(n / 1024).toFixed(0)} KB`;
const out = {};
for (const [name, prof] of Object.entries(PROFILES)) {
  const runs = []; for (let i = 0; i < (name === 'fast' ? RUNS : Math.min(RUNS, 2)); i++) runs.push(await once(prof));
  const r = { homeBytes: median(runs.map(x => x.home.bytes)), homeReqs: median(runs.map(x => x.home.reqs)), globe: median(runs.map(x => x.home.globe)), dcl: median(runs.map(x => x.home.dcl)), load: median(runs.map(x => x.home.load)), full: median(runs.map(x => x.home.full)),
    topicBytes: median(runs.map(x => x.topic.bytes)), projectBytes: median(runs.map(x => x.project.bytes)), byType: runs[0].home.byType };
  out[name] = r;
  console.log(`${name}: home ${kb(r.homeBytes)} in ${r.homeReqs} requests · globe drawn ${(r.globe / 1000).toFixed(1)}s · DOMContentLoaded ${(r.dcl / 1000).toFixed(1)}s · load ${(r.load / 1000).toFixed(1)}s · fully loaded ${(r.full / 1000).toFixed(1)}s · topic +${kb(r.topicBytes)} · project +${kb(r.projectBytes)}`);
  console.log('   home by type:', Object.fromEntries(Object.entries(r.byType).map(([k, v]) => [k, kb(v)])));
}
if (args.json) fs.writeFileSync(args.json, JSON.stringify(out, null, 2));
await b.close();
