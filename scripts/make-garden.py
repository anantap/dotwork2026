#!/usr/bin/env python3
"""Builds index.html (Ananta's project map, the site's home page) from the photo globe's index.html.

    python3 scripts/make-garden.py photos/index.html index.html

The page's content (projects, about, CV) is not in here: content.json is read when the page loads.
"""
import sys
SRC, OUT = sys.argv[1], sys.argv[2]
s = open(SRC).read()


def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (c, a[:120])
    s = s.replace(a, b)


def cut(start, end):
    """Remove from the line containing `start` up to and including the line containing `end`."""
    global s
    i = s.index(start); i = s.rfind('\n', 0, i) + 1
    j = s.index(end, i); j = s.index('\n', j) + 1
    s = s[:i] + s[j:]


def drop_css(*prefixes):
    global s
    for a in prefixes:
        lines = s.split('\n'); idx = [k for k, l in enumerate(lines) if l.lstrip().startswith(a)]
        assert len(idx) == 1, (a, idx); del lines[idx[0]]; s = '\n'.join(lines)


# ---------------- head ----------------
# The site's own address, for link previews (they need absolute URLs). Change it at launch when the domain is set.
SITE_URL = 'https://rollamonth.vercel.app'
DESC = 'Ananta Mulyono, UX designer: projects on a map, connected by the work they share.'
rep('<title>Roll a Month Map</title>', f'''<title>Ananta Mulyono</title>
<meta name="description" content="{DESC}">
<meta property="og:type" content="website">
<meta property="og:title" content="Ananta Mulyono">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{SITE_URL}/">
<meta property="og:image" content="{SITE_URL}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#000000">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">''')
rep('/* Layout: one black screen, a globe drawn only by the connections between frames, Geist in the corners with Geist Pixel for the HUD. Tag view pulls a contact sheet in front of the globe; detail view is a full-screen light box. Deliberately dark-only. */',
    '/* Layout: one black screen, a globe of projects held together by the work they share, Geist with Geist Pixel for the HUD. A topic pulls its projects in front of the globe; a project opens as images and text. Deliberately dark-only. */')

# ---------------- CSS ----------------
drop_css('.scrub {', '.play {', '.track {', '.track input', '.months {', '.months span {', '#tip .ch {', '#tip .priv {', '.toggle {', '.toggle input',
         '.m-panel .toggle', '.d-ph {', '.d-nav {', '.d-nav button {', '.d-info h3 {', '.d-axis {', '.d-axis dt', '.d-axis dd', '.kv {', '.kv dt', '.kv .pub',
         '.d-rel {', '.d-rel button {', '.d-rel img {', '.d-kind.sample', '.months span:nth-child(even)', '#tip img {')
rep('#detail[hidden], .d-ph[hidden], .d-media img[hidden], #dRelS[hidden] { display: none; }', '''#detail[hidden], #dLink[hidden] { display: none; }
.d-text { margin: 0; font-size: 15px; line-height: 1.55; text-wrap: pretty; white-space: pre-line; }
.d-link, .contact a { display: inline-flex; align-items: center; gap: 6px; font: 400 13px var(--sans); color: var(--ink); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; text-decoration: none; }
.d-link { align-self: flex-start; }
.d-thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.d-thumbs[hidden] { display: none; }
.d-thumbs button { padding: 0; border: 0; background: #111; aspect-ratio: 1; overflow: hidden; border-radius: 3px; cursor: pointer; opacity: .55; transition: opacity .2s; }
.d-thumbs button[aria-current="true"] { opacity: 1; box-shadow: 0 0 0 1px var(--ink); }
.d-thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }
@media (hover: hover) { .d-thumbs button:hover { opacity: 1; } }
@media (max-width: 760px) { .d-thumbs { grid-template-columns: repeat(4, 1fr); } }
.p-title { position: absolute; left: 0; top: 0; font: 400 14px var(--pixel); color: var(--ink); white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .3s; letter-spacing: .02em; }
/* About: one panel with intro, contact, every project and experience */
.m-panel { position: fixed; left: 50%; top: 50%; right: auto; bottom: auto; width: min(560px, calc(100vw - 32px)); max-height: min(78vh, 720px); padding: 22px;
  transform: translate(-50%, calc(-50% + 10px)); z-index: 8; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
.menu.open .m-panel { transform: translate(-50%, -50%); }
.m-bar button .x { display: none; }
.m-bar button[aria-expanded="true"] { width: 32px; height: 32px; padding: 0; display: grid; place-items: center; }
.m-bar button[aria-expanded="true"] .lbl { display: none; }
.m-bar button[aria-expanded="true"] .x { display: block; }
.m-panel section[data-sec="about"] { display: grid; gap: 22px; }
.about { display: grid; grid-template-columns: 120px 1fr; gap: 18px; align-items: start; }
.about img { width: 120px; height: 120px; object-fit: cover; border-radius: 4px; }
.a-text { min-width: 0; }
.about .lede { font-size: 15px; }
.a-block h3 { margin: 0 0 10px; font: 400 12px var(--pixel); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
@media (max-width: 560px) { .about { grid-template-columns: 1fr; } .about img { width: 96px; height: 96px; } .m-panel { padding: 16px; } }
.about .lede { margin: 0; font-size: 14px; line-height: 1.5; text-wrap: pretty; }
.contact { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 12px; }
.contact .addr { flex-basis: 100%; font-size: 12px; color: var(--muted); user-select: all; }
.cv { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.cv li { display: grid; grid-template-columns: 104px 1fr; gap: 10px; align-items: baseline; font-size: 14px; }
.cv .yrs { font: 400 13px var(--pixel); color: var(--muted); font-variant-numeric: tabular-nums; }
.cv .role { display: block; font-size: 12px; color: var(--muted); }
/* the line under the name, with an "online" dot */
.status.online { display: flex; align-items: center; gap: 9px; }
.status.online::before { content: ""; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--live); box-shadow: 0 0 8px var(--live); }''')
# light box: a column of images on the left (scrolls when there are several), title and text on the right
rep('.d-media { min-width: 0; min-height: 0; display: flex; align-items: center; justify-content: center; }',
    '.d-media { min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: safe center; gap: 16px; overflow-y: auto; scrollbar-width: none; }\n.d-media::-webkit-scrollbar { display: none; }')
rep('.d-media img { max-width: 100%; max-height: calc(100vh - 48px); object-fit: contain; display: block; box-shadow: 0 0 0 1px var(--line); }',
    '.d-media img { max-width: 100%; max-height: calc(100vh - 48px); object-fit: contain; display: block; box-shadow: 0 0 0 1px var(--line); border-radius: 4px; flex: none; }')
rep('.d-code { font: 400 20px/1.2 var(--pixel); }', '.d-code { font: 400 24px/1.15 var(--pixel); }')
rep('  .back:hover, .chip:hover, .d-x:hover, .d-nav button:hover:not(:disabled) { border-color: var(--ink); }\n  .d-rel button:hover img { opacity: .75; }',
    '  .back:hover, .chip:hover, .d-x:hover, .d-link:hover, .contact a:hover { border-color: var(--ink); }')
rep('#tip { position: fixed; left: 0; top: 0; pointer-events: none; padding: 8px 10px;', '#tip { position: fixed; left: 0; top: 0; pointer-events: none; padding: 6px 10px;')
rep('font: 400 12px var(--sans); width: 200px; opacity: 0;', 'font: 400 12px var(--sans); width: max-content; max-width: 220px; opacity: 0;')
rep('#tip .code { font: 400 12px var(--pixel); letter-spacing: .06em; color: var(--muted); text-transform: uppercase; }', '#tip .code { font: 400 14px var(--pixel); letter-spacing: .02em; color: var(--ink); }')

# ---------------- HTML ----------------
rep('''        <h1>Roll a Month<sup>*</sup></h1>
        <div class="status" id="status">0 frames</div>''', '''        <h1 id="name">Ananta Mulyono</h1>
        <div class="status" id="status">UX designer</div>''')
cut('<section data-sec="time"', '</section>')
cut('<section data-sec="about"', '</section>')
rep('''      <div class="m-panel" id="mPanel">''', '''      <div class="m-panel" id="mPanel">
        <section data-sec="about" aria-label="About" hidden>
          <div class="about"><img id="aPhoto" alt=""><div class="a-text"><p class="lede" id="aIntro"></p><div class="contact" id="aContact"></div></div></div>
          <div class="a-block"><h3>Experience</h3><ul class="cv" id="cvList"></ul></div>
        </section>''')
rep('''        <button type="button" data-sec="subject" aria-expanded="false" aria-controls="mPanel">Subject</button>
        <button type="button" data-sec="light" aria-expanded="false" aria-controls="mPanel">Light</button>
        <button type="button" data-sec="distance" aria-expanded="false" aria-controls="mPanel">Distance</button>
        <button type="button" data-sec="mood" aria-expanded="false" aria-controls="mPanel">Mood</button>
        <button type="button" data-sec="time" aria-expanded="false" aria-controls="mPanel">Time</button>
        <button type="button" data-sec="about" aria-expanded="false" aria-controls="mPanel">About</button>''',
'''        <button type="button" data-sec="about" aria-expanded="false" aria-controls="mPanel" aria-label="About"><span class="lbl">About</span><svg class="x" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5"/></svg></button>''')
rep('<nav class="menu" id="menu" aria-label="Browse">', '<nav class="menu" id="menu" aria-label="Browse projects">')
rep('<div class="d-media"><img id="dImg" alt=""><div class="d-ph" id="dPh" hidden>Sample frame<br>no scan yet</div></div>', '<div class="d-media" id="dMedia"><img id="dImg" alt=""></div>')
rep('''    <div class="d-nav"><button type="button" id="dPrev" aria-label="Previous frame">←</button><span id="dPos"></span><button type="button" id="dNext" aria-label="Next frame">→</button></div>
    <section><h3>Tags</h3><dl class="d-axis" id="dTags"></dl></section>
    <section><h3>On the site</h3><dl class="kv" id="dVis"></dl></section>
    <section id="dRelS"><h3>Shares the most tags</h3><div class="d-rel" id="dRel"></div></section>''',
'''    <p class="d-text" id="dText"></p>
    <a class="d-link" id="dLink" target="_blank" rel="noopener" hidden></a>
    <div class="d-thumbs" id="dThumbs" hidden></div>''')

# ---------------- load content.json first ----------------
rep("<script>\n(() => {\n", """<script>
// content.json sits next to this page. Opened from a folder without its trailing slash, relative URLs point one folder up, so
// look inside the folder too, and if the content is there, make it the base for every other relative URL (images).
(async () => {
  const get = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };
  let c = await get('content.json');
  if (!c && !/\\/$|\\.[a-z]+$/i.test(location.pathname)) {
    const dir = location.pathname + '/';
    c = await get(dir + 'content.json');
    if (c) { const b = document.createElement('base'); b.href = dir; document.head.prepend(b); }
  }
  return c;
})().then(CONTENT => {
""")
rep("  resize(); recount(); measureUI(); tick();\n})();", "  resize(); recount(); measureUI(); tick();\n});")
rep("  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return cantDraw('This map needs WebGL, which is turned off or unavailable in this browser.');",
    "  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return cantDraw('This map needs WebGL, which is turned off or unavailable in this browser.');\n"
    "  if (!CONTENT || !Array.isArray(CONTENT.projects)) return cantDraw('The projects didn’t load. Reload the page to try again.');")

# ---------------- data: from content.json ----------------
i = s.index("  const MONTHS = ['Jan'"); j = s.index("  const tagList = AXES.flatMap")
s = s[:i] + r"""  // Everything shown comes from content.json: projects (title, years, text, images, tags, link), about, CV
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PROJECTS = CONTENT.projects.filter(p => p && p.title && (p.images || []).length);
  const AXES = ['topics'];
  const TAGS = { topics: [...new Set(PROJECTS.flatMap(p => p.tags || []))] };
  const AXIS_OF = Object.fromEntries(TAGS.topics.map(t => [t, 'topics']));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RAD = 14;
  const MIN_SHARED = 2; // a topic gets a label, a chip and a view of its own only when two or more projects share it

  const prng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rnd = prng(20260601);
  const detailEl = document.getElementById('detail');
  let titlesOn = true, cellPx = 120; // set by the contact-sheet layout
  const frames = PROJECTS.map((p, n) => ({ ...p, n, tags: p.tags || [], real: true, aspect: 1, image: p.images[0] }));
  document.getElementById('name').textContent = CONTENT.name || '';
  document.title = CONTENT.name || document.title;
""" + s[j:]

# ---------------- globe: small light-blue squares; the image shows once a topic pulls the project forward ----------------
rep("  const geoL = twoFaced(plane.clone()), geoP = twoFaced(new THREE.PlaneGeometry(0.41, 0.62));", "  const geoS = twoFaced(new THREE.PlaneGeometry(0.62, 0.62));")
rep("  const edgeGeo = new THREE.EdgesGeometry(plane);\n", "")
rep("  const plane = new THREE.PlaneGeometry(0.62, 0.41);\n", "")
rep('''    const rest = new THREE.Vector3(); f.ti.slice(1).forEach(i => rest.add(D[i]));
    const dir = D[f.ti[0]].clone().multiplyScalar(0.72);
    if (f.ti.length > 1) dir.addScaledVector(rest.normalize(), 0.28);
    dir.add(new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(0.2)).normalize();''', '''    const dir = f.dir;''')
# each project sits at the average of its topics, then projects push apart so none overlap
rep("  const loader = new THREE.TextureLoader();", '''  const loader = new THREE.TextureLoader();
  frames.forEach(f => { f.dir = new THREE.Vector3(); f.ti.forEach(i => f.dir.add(D[i])); f.dir.add(new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(0.3)).normalize(); });
  for (let it = 0; it < 200; it++) frames.forEach(f => frames.forEach(g => {
    if (f === g) return; const d = f.dir.angleTo(g.dir); if (d > 0.8) return;
    f.dir.addScaledVector(new THREE.Vector3().subVectors(f.dir, g.dir).normalize(), (0.8 - d) * 0.1).normalize();
  }));''')
rep("    const r = RAD + (f.real ? 0.6 : 0.15 + rnd() * 0.3);", "    const r = RAD + 0.6;")
i = s.index("    let obj;\n    if (f.real) {"); j = s.index("    f.base = f.real ? 1.8 : 1;")
s = s[:i] + """    // tiles are square: the photo is cropped to its centre
    f.ah = 1;
    f.tex = loader.load(f.image, t => {
      const a = t.image.width / t.image.height; // square tiles: crop the photo's centre, so a grid of mixed shapes lines up
      if (a >= 1) { t.repeat.set(1 / a, 1); t.offset.set((1 - 1 / a) / 2, 0); } else { t.repeat.set(1, a); t.offset.set(0, (1 - a) / 2); }
    });
    const obj = new THREE.Mesh(geoS, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    obj.material.color.copy(C.sample); f.showImg = false;
""" + s[j:]
rep("    f.base = f.real ? 1.8 : 1;", "    f.base = 2; // small squares on the globe; the contact sheet makes them big")
rep("    if (f.real) obj.renderOrder = 2;", "    obj.renderOrder = 2;")
rep("      if (f.facing && e > 0) dummy.quaternion.copy(camera.quaternion);", "      if (true) dummy.quaternion.copy(camera.quaternion); // squares always face the viewer")
rep("      f.opT = op;", '''      f.opT = op;
      const img = f.showImg || (inFocus && f.inF); // once a tile has shown its image it keeps it (tiles are hidden on the globe), so a fade-out never flashes blue
      if (f.showImg !== img) { f.showImg = img; f.obj.material.map = img ? f.tex : null; f.obj.material.color.set(img ? 0xffffff : C.sample); f.obj.material.needsUpdate = true; }''')

# ---------------- counts, topics, status ----------------
rep("tagPairs.forEach(q => { q.w = w[q.i][q.j]; q.keep = q.w >= Math.max(2, maxW * 0.1); });",
    "tagPairs.forEach(q => { q.w = w[q.i][q.j]; q.keep = q.w >= 1 && counts[q.i] >= MIN_SHARED && counts[q.j] >= MIN_SHARED; });")
rep("let month = 12, showPriv = true, view = 'globe'", "let view = 'globe'")
rep("const shown = f => f.month <= month && (showPriv || !f.priv);", "const shown = () => true;")
i = s.index("    let vis = 0, priv = 0, scans = 0;"); j = s.index("    const maxW = Math.max(1,")
s = s[:i] + """    frames.forEach(f => {
      f.ti.forEach(i => counts[i]++);
      for (const a of f.ti) for (const b of f.ti) if (a < b) w[a][b]++;
    });
""" + s[j:]
rep("    document.getElementById('status').textContent = `${vis} frames · ${scans} scans · ${counts.filter(c => c > 0).length} tags · ${priv} private`;",
    "    { const st = document.getElementById('status'); st.textContent = CONTENT.status || ''; st.classList.toggle('online', !!CONTENT.status); st.hidden = !CONTENT.status; }")
rep("    document.querySelectorAll('#months span').forEach((el, i) => el.classList.toggle('on', i < month));\n", "")
rep("      chipEls[t.name].innerHTML = `${t.name}<span>${counts[i]}</span>`;",
    "      chipEls[t.name].innerHTML = `${esc(t.name)}<span>${counts[i]}</span>`; chipEls[t.name].hidden = counts[i] < MIN_SHARED;")
rep("      labelEls[i].innerHTML = `${t.name}<small>${counts[i]}</small>`;", "      labelEls[i].innerHTML = `${esc(t.name)}<small>${counts[i]}</small>`;")
rep("      if (inFocus) op = f.inF ? (f.real ? 1 : f.priv ? 0.6 : 0.42) : 0.025;", "      if (inFocus) op = f.inF ? 1 : 0.025;")
rep("      else if (h) op = matches(f, h) ? 1 : 0.06;", "      else if (h) op = 0; // the globe is topics only: projects show up once a topic pulls them forward")
rep("      else op = f.real ? 1 : f.priv ? 0.55 : 0.45;", "      else op = 0;")
rep("      el.dataset.base = inFocus || counts[i] === 0 ? 0 :", "      el.dataset.base = inFocus || counts[i] < MIN_SHARED ? 0 :")
rep("focusList = frames.filter(f => shown(f) && matches(f, focus)).sort((a, b) => (b.real - a.real) || (a.month - b.month) || (a.n - b.n));", "focusList = frames.filter(f => matches(f, focus));")
rep("    const scans = focusList.filter(f => f.real).length;\n", "")
rep("${focusList.length} frames · ${scans} scan${scans === 1 ? '' : 's'} · ${tagList[focus.tag].axis}", "${focusList.length} project${focusList.length === 1 ? '' : 's'}")
rep("      f.gscale = Math.min(s * 0.9 / 0.62, 6);", "      f.gscale = Math.min(s * 0.72 / 0.62, 14); // room between tiles for the titles underneath")
# the contact sheet reserves a title line under every row, so titles never sit on the next row's tiles (many projects on a phone)
rep("""    let best = { s: 0, cols: 1, rows: 1 };
    for (let cols = 1; cols <= N; cols++) { const rows = Math.ceil(N / cols), s = Math.min(W / cols, H / rows); if (s > best.s) best = { s, cols, rows }; }
    const { s, cols, rows } = best;""",
"""    const pxU = innerHeight / vh, fit = TH => { // tile size for the best column count, leaving TH under each row for a title
      let best = { t: 0, cols: 1, rows: 1 };
      for (let cols = 1; cols <= N; cols++) { const rows = Math.ceil(N / cols), t = Math.min(W / cols / 1.15, H / rows - TH * 1.15); if (t > best.t) best = { t, cols, rows }; }
      return best;
    };
    let TH = 30 / pxU, best = fit(TH);
    titlesOn = best.t * 1.15 * pxU >= 84; // columns too narrow for a title (lots of projects on a phone): tiles only, bigger
    if (!titlesOn) { TH = 0; best = fit(0); }
    const { t, cols, rows } = best, sx = t * 1.15, sy = t + TH * 1.15; // tile, plus a gap across and a title line down
    cellPx = sx * pxU;""")
rep("""      f.gpos = center.clone().addScaledVector(right, (c - (cols - 1) / 2) * s + ox).addScaledVector(up, ((rows - 1) / 2 - r) * s + oy);
      f.gscale = Math.min(s * 0.72 / 0.62, 14); // room between tiles for the titles underneath""",
"""      f.gpos = center.clone().addScaledVector(right, (c - (cols - 1) / 2) * sx + ox).addScaledVector(up, ((rows - 1) / 2 - r) * sy + oy + TH / 2);
      f.gscale = Math.min(t / 0.62, 14);""")
rep("    const W = vw * (mobile ? 0.9 : 0.6), H = vh * (mobile ? 0.48 : 0.62);", "    const W = vw * (mobile ? 0.92 : 0.6), H = vh * (mobile ? 0.54 : 0.64);")
# light box: on phones the photo sits in a fixed-height frame, so stepping between tall and wide photos doesn't move the text below
rep("  .d-media img { max-height: 58vh; }", "  .d-media { height: auto; }\n  .d-media img { width: 100%; height: auto; max-height: none; } /* phones: photos at full width, the story scrolls */\n  .d-thumbs { display: none !important; }\n  .d-stack { display: grid; gap: 12px; }")
rep("near.map(t => `<button type=\"button\" class=\"chip\" data-tag=\"${t}\">${t}</button>`)", "near.map(t => `<button type=\"button\" class=\"chip\" data-tag=\"${esc(t)}\">${esc(t)}</button>`)")
rep("'<span>Often with</span>'", "'<span>Also</span>'")

# ---------------- menu: one About button: intro, contact, projects, experience (topics live on the globe) ----------------
rep("    mPanel.insertBefore(sec, mPanel.querySelector('[data-sec=\"time\"]'));", "    mPanel.prepend(sec);")
cut("  const tg = document.createElement('label'); tg.className = 'toggle';", "mPanel.querySelector('[data-sec=\"about\"]').appendChild(tg);")
rep("  AXES.forEach(a => addSection(a, TAGS[a]));", """  AXES.forEach(a => addSection(a, TAGS[a]));
  { // About and CV panels, from content.json
    const photo = document.getElementById('aPhoto');
    if (CONTENT.photo) photo.src = CONTENT.photo; else photo.remove();
    document.getElementById('aIntro').textContent = CONTENT.intro || '';
    const links = CONTENT.links || [], mail = links.find(l => /^mailto:/.test(l.href));
    document.getElementById('aContact').innerHTML = links.map(l => `<a href="${esc(l.href)}"${/^mailto:/.test(l.href) ? '' : ' target="_blank" rel="noopener"'}>${esc(l.label)}</a>`).join('')
      + (mail ? `<span class="addr">${esc(mail.href.slice(7))}</span>` : '');
    document.getElementById('cvList').innerHTML = (CONTENT.cv || []).map(e => `<li><span class="yrs">${esc(e.years)}</span><span>${esc(e.place)}${e.role ? `<span class="role">${esc(e.role)}</span>` : ''}</span></li>`).join('');
  }""")
cut("  document.getElementById('months').innerHTML", "playT = setInterval(")
if "  });\n\n  // Detail view" in s: rep("  });\n\n  // Detail view", "\n  // Detail view")
rep("\n\n  // Month scrubber\n", "\n")

# ---------------- project view: images and text ----------------
rep("const dImg = document.getElementById('dImg'), dPh = document.getElementById('dPh'), info = det.querySelector('.d-info');", "const dImg = document.getElementById('dImg'), info = det.querySelector('.d-info');")
rep("    (detFrame.real ? dImg : dPh).animate(", "    dImg.animate(")
rep("  function frameCode(f) { return `Roll ${pad(f.month)} · ${MONTHS[f.month - 1]} · frame ${pad(f.n)}`; }", "  function frameCode(f) { return f.title; }")
rep("    detList = view === 'focus' ? focusList : f.real ? frames.filter(g => g.real && shown(g)) : frames.filter(g => shown(g));", "    detList = view === 'focus' ? focusList : frames;")
rep("    const el = f.real ? dImg : dPh;\n    el.style.opacity = '0';", "    const el = dImg;\n    el.style.opacity = '0';")
rep("    if (f.real) dImg.decode().then(go, go); else go();", "    dImg.decode().then(go, go);")
rep("    const el = f.real ? dImg : dPh;\n    const p1", "    const el = dImg;\n    const p1")
i = s.index("    const f = detFrame, i = detList.indexOf(f);"); j = s.index("  document.getElementById('dClose').addEventListener('click', closeDetail);")
s = s[:i] + """    const f = detFrame; detImg = 0;
    dImg.src = f.images[0]; dImg.alt = f.alt || f.title;
    det.scrollTop = 0; info.scrollTop = 0;
    // one big image; the rest as thumbnails under the text (tap one to show it big)
    const thumbs = document.getElementById('dThumbs'); thumbs.hidden = f.images.length < 2;
    thumbs.replaceChildren(...(f.images.length < 2 ? [] : f.images.map((src, k) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', `Image ${k + 1} of ${f.images.length}`);
      if (k === 0) b.setAttribute('aria-current', 'true');
      const im = new Image(); im.src = src; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; b.append(im);
      b.addEventListener('click', () => showImage(k, true)); return b;
    })));
    document.getElementById('dCode').textContent = f.title;
    document.getElementById('dKind').textContent = f.years || '';
    document.getElementById('dText').textContent = f.text || '';
    const link = document.getElementById('dLink'); link.hidden = !f.link;
    if (f.link) { link.href = f.link; link.textContent = `${f.linkLabel || f.link.replace(/^https?:\\/\\//, '').replace(/\\/$/, '')} ↗`; }
  }
""" + s[j:]
cut("  document.getElementById('dPrev').addEventListener('click', () => step(-1));", "  document.getElementById('dRel').addEventListener('click'")

# ---------------- hover card: just the title ----------------
rep("tip.innerHTML = `${f.real ? `<img src=\"thumbs/${pad(f.n)}.jpg\" alt=\"\">` : ''}<div class=\"code\">${frameCode(f)}${f.real ? '' : ' · sample'}</div><div class=\"t\">${f.tags.join(' · ')}</div>${f.priv ? '<div class=\"priv\">Private · family, image not shown</div>' : ''}`;",
    "tip.innerHTML = `<div class=\"code\">${esc(f.title)}</div>`;")
rep("    const tipH = f.real ? 260 : 100;", "    const tipH = 40;")
rep("drop any that would sit on the header, chips or scrubber, run off", "drop any that would sit on the title or the menu, run off")

# ---------------- titles under the tiles in a topic view ----------------
rep("  const tip = document.getElementById('tip');", """  const tip = document.getElementById('tip');
  // titles under the tiles are buttons: click, tap, or Tab + Enter opens the project (the tiles themselves live in WebGL)
  frames.forEach(f => { const b = f.titleEl = document.createElement('button'); b.type = 'button'; b.className = 'p-title'; b.textContent = f.title; b.tabIndex = -1; b.addEventListener('click', () => openDetail(f)); labelsEl.appendChild(b); });""")
rep("    updateTip();\n    renderer.render", """    { // project titles under the tiles while a topic is open
      const pxPerUnit = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      frames.forEach(f => {
        const on = view === 'focus' && f.inF && f.showImg && !f.pending && titlesOn && detailEl.hidden; // hidden behind an open project
        if (on) {
          tmp.copy(f.obj.position); const dist = tmp.distanceTo(camera.position); tmp.project(camera);
          const half = 0.31 * f.obj.scale.x * pxPerUnit / dist * f.ah; // half the tile's height
          f.titleEl.style.transform = `translate(${(tmp.x + 1) / 2 * innerWidth}px, ${(1 - tmp.y) / 2 * innerHeight + half + 8}px) translate(-50%, 0)`;
          f.titleEl.style.maxWidth = `${Math.max(60, cellPx - 6)}px`; // no wider than its column
        }
        const op = on && f.obj.material.opacity > 0.6 ? '1' : '0'; // titles appear once their tile has faded in
        if (f.titleEl.style.opacity !== op) { f.titleEl.style.opacity = op; f.titleEl.tabIndex = op === '1' ? 0 : -1; f.titleEl.style.pointerEvents = op === '1' ? 'auto' : 'none'; }
      });
    }
    updateTip();
    renderer.render""")
rep(".p-title { position: absolute; left: 0; top: 0; font: 400 14px var(--pixel); color: var(--ink); white-space: nowrap;",
    ".p-title { position: absolute; left: 0; top: 0; font: 400 14px var(--pixel); color: var(--ink); background: none; border: 0; padding: 2px 4px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;")

# ---------------- labels keep clear of the squares ----------------
rep("    const placed = [], isFront = i => D[i].dot(camDir) >= -0.05;", '''    const pxPerUnit = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const placed = frames.filter(f => f.obj.visible && f.obj.material.opacity > 0.3).map(f => {
      tmp.copy(f.obj.position); const dist = tmp.distanceTo(camera.position); tmp.project(camera);
      const x = (tmp.x + 1) / 2 * innerWidth, y = (1 - tmp.y) / 2 * innerHeight, h = 0.31 * f.obj.scale.x * pxPerUnit / dist;
      return [x - h, y - h, x + h, y + h];
    }), isFront = i => D[i].dot(camDir) >= -0.05;''')

rep("  .d-media { min-height: auto; }", "  .d-media { min-height: auto; overflow: visible; }")

# ---------- one-off topics: background flair (label + lines), not clickable, not in Filter ----------
rep("    tagPairs.forEach(q => { q.w = w[q.i][q.j]; q.keep = q.w >= 1 && counts[q.i] >= MIN_SHARED && counts[q.j] >= MIN_SHARED; });",
    "    tagPairs.forEach(q => { q.w = w[q.i][q.j]; q.keep = q.w >= 1; });")
rep("      labelEls[i].innerHTML = `${esc(t.name)}<small>${counts[i]}</small>`;", '''      const solo = counts[i] < MIN_SHARED;
      labelEls[i].innerHTML = solo ? esc(t.name) : `${esc(t.name)}<small>${counts[i]}</small>`;
      labelEls[i].classList.toggle('solo', solo);''')
rep("      el.dataset.base = inFocus || counts[i] < MIN_SHARED ? 0 :", "      el.dataset.base = inFocus ? 0 : counts[i] < MIN_SHARED ? (h ? (h.tag === i ? 1 : 0.12) : 1) :")
rep(".tag-label.on { color: var(--link); }", ".tag-label.on { color: var(--link); }\n.tag-label.solo { font-size: 14px; }\n.tag-label.solo.on { color: var(--link); }\n.tag-label.solo::before { width: 3px; height: 3px; }")

# a topic with one project opens that project directly; a shared topic opens its topic view
rep("  function enterFocus(key) {", '''  function openTopic(name) {
    const only = frames.filter(f => f.tags.includes(name));
    if (only.length === 1) { closeMenu(); setHl(null); openDetail(only[0]); } else enterFocus(name);
  }
  function enterFocus(key) {''')
rep("    b.addEventListener('click', () => enterFocus(t.name)); hoverable(b, t.name);", "    b.addEventListener('click', () => openTopic(t.name)); hoverable(b, t.name);")
rep("hoverLabel(null); enterFocus(tagList[li].name); return; }", "hoverLabel(null); openTopic(tagList[li].name); return; }")

# no lines between projects either: they'd end in empty space now the projects are hidden on the globe
rep("      if (!shown(e.f) || !shown(e.g)) return BLACK;", "      return BLACK;")

# "Also" in a topic view lists other shared topics only (a one-off there would open a one-tile view)
rep("const near = tagPairs.filter(q => q.keep && (q.i === focus.tag || q.j === focus.tag))", "const near = tagPairs.filter(q => q.keep && counts[q.i] >= MIN_SHARED && counts[q.j] >= MIN_SHARED && (q.i === focus.tag || q.j === focus.tag))")

# spread topics evenly over the globe (the photo map's strong pull between related tags left big empty areas here);
# related topics still lean a little closer together
rep("      d.normalize().multiplyScalar((co[i][j] / maxCo) * 0.6 * (L - 11) - 600 / (L * L));",
    "      d.normalize().multiplyScalar((co[i][j] / maxCo) * 0.3 * (L - 13) - 900 / (L * L));")

# arrows step through a project's images; with one image they step to the next project, as before
rep("  function step(d) { const i = detList.indexOf(detFrame) + d; if (i >= 0 && i < detList.length) { detFrame = detList[i]; renderDetail(); swapAnim(d); } }",
'''  let detImg = 0;
  function showImage(k, fromThumb) {
    const f = detFrame; if (!f || k < 0 || k >= f.images.length || k === detImg) return;
    const d = k > detImg ? 1 : -1; detImg = k;
    dImg.src = f.images[k];
    document.querySelectorAll('#dThumbs button').forEach((b, i) => b.setAttribute('aria-current', String(i === k)));
    if (fromThumb && innerWidth < 760) det.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); // phones: the big image is above the grid
    swapAnim(d);
  }
  function step(d) {
    if (detFrame && detFrame.images.length > 1) return showImage(detImg + d);
    const i = detList.indexOf(detFrame) + d; if (i >= 0 && i < detList.length) { detFrame = detList[i]; renderDetail(); swapAnim(d); }
  }''')

# the About button reads "Close" to screen readers while the panel is open
rep("    menu.querySelectorAll('.m-bar button').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.sec === sec)));",
    "    menu.querySelectorAll('.m-bar button').forEach(b => { b.setAttribute('aria-expanded', String(b.dataset.sec === sec)); b.setAttribute('aria-label', b.dataset.sec === sec ? 'Close' : 'About'); });")

# ---------- tiles fade instead of flying (they no longer have a visible spot on the globe to fly from) ----------
# A visible tile first fades out where it is; it moves to its new place only while invisible. New tiles fade in
# once the camera has arrived. Same for entering a topic, going back, and topic to topic via "Also".
rep("      const to = focused ? f.gpos : f.home, sTo = focused ? f.gscale : f.base;",
    "      const to = focused ? f.gpos : f.pTo, sTo = focused ? f.gscale : f.sTo;")
rep("      if (f.pTo.equals(to) && f.sTo === sTo) return;",
    "      if (f.pTo.equals(to) && f.sTo === sTo) { f.pending = null; return; }")
rep("      f.pFrom = f.obj.position.clone(); f.pTo = to.clone(); f.sFrom = f.sz; f.sTo = sTo; f.facing = focused;",
    "      if (!reduced && f.obj.material.opacity > 0.05) { f.pending = { to: to.clone(), sTo, focused }; return; } // fade out first, then move\n"
    "      f.pending = null; f.pFrom = to.clone(); f.pTo = to.clone(); f.sFrom = sTo; f.sz = sTo; f.sTo = sTo; f.facing = focused;")
rep("      f.t0 = now + (reduced ? 0 : stagger(f)); f.dur = reduced ? 0 : 1100;",
    "      f.t0 = now; f.dur = 0;")
rep("      f.obj.position.lerpVectors(f.pFrom, f.pTo, e);",
    "      if (f.pending && f.obj.material.opacity < 0.05) { const q = f.pending; f.pending = null; f.pFrom = q.to.clone(); f.pTo = q.to; f.sFrom = f.sz = f.sTo = q.sTo; f.facing = q.focused; f.t0 = now; f.dur = 0; }\n"
    "      f.obj.position.lerpVectors(f.pFrom, f.pTo, e);")
rep("      f.obj.material.opacity += (f.opT - f.obj.material.opacity) * (reduced ? 1 : 0.1);",
    "      const want = f.pending || (view === 'focus' && camTw && f.obj.material.opacity < 0.3) ? 0 : f.opT; // fade out before moving; hold new tiles until the camera arrives\n"
    "      f.obj.material.opacity += (want - f.obj.material.opacity) * (reduced ? 1 : want < f.obj.material.opacity ? 0.2 : 0.09);")

rep('id="back">← Globe</button>', 'id="back">← Return</button>')

# no hover tooltip on tiles: the title already sits under each tile, and touch never showed it
rep("""    if (!f) { tip.style.opacity = 0; return; }
    if (f !== tipFrame) { // rebuild only when the frame changes, not every animation frame
      tipFrame = f;
      tip.innerHTML = `<div class="code">${esc(f.title)}</div>`;
    }
    const tipH = 40;
    if (pressing) { // above the finger, so it isn't hidden under it
      const x = Math.max(8, Math.min(hoverXY[0] - 100, innerWidth - 208)), y = Math.max(8, hoverXY[1] - tip.offsetHeight - 28);
      tip.style.transform = `translate(${x}px, ${y}px)`;
    } else tip.style.transform = `translate(${Math.min(hoverXY[0] + 14, innerWidth - 216)}px, ${Math.min(hoverXY[1] + 14, innerHeight - tipH)}px)`;
    tip.style.opacity = 1;
  }""", """    tip.style.opacity = 0;
  }""")

# phones: the rest of a project's photos follow the text at full width (desktop keeps one big photo plus thumbnails)
rep("""    <div class="d-thumbs" id="dThumbs" hidden></div>\n  </aside>""", """    <div class="d-thumbs" id="dThumbs" hidden></div>\n    <div class="d-stack" id="dStack"></div>\n  </aside>""")
rep(".d-thumbs[hidden] { display: none; }", ".d-thumbs[hidden] { display: none; }\n.d-stack { display: none; }\n.d-stack img { width: 100%; height: auto; display: block; border-radius: 4px; box-shadow: 0 0 0 1px var(--line); }")
rep("    document.getElementById('dCode').textContent = f.title;",
    "    document.getElementById('dStack').replaceChildren(...f.images.slice(1).map(src => { const im = new Image(); im.src = src; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; return im; }));\n    document.getElementById('dCode').textContent = f.title;")

# phones: the close button sits at the bottom, where the About button is, and stays there while the story scrolls
rep("""    <div class="d-stack" id="dStack"></div>\n  </aside>""", """    <div class="d-stack" id="dStack"></div>\n  </aside>\n  <button type="button" class="d-xb" id="dCloseB" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5"/></svg></button>""")
rep(".d-stack { display: none; }", """.d-stack { display: none; }
.d-xb { display: none; }
@media (max-width: 760px) {
  .d-xb { display: grid; place-items: center; position: fixed; left: 50%; top: calc(100% - 64px); width: 40px; height: 40px; margin-left: -20px; padding: 0; border-radius: 50%; border: 1px solid var(--line); background: rgba(0,0,0,.6); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); color: var(--ink); cursor: pointer; z-index: 2; }
  #dClose { display: none; }
  #detail { padding-bottom: 88px; } /* the last photo scrolls clear of the button */
}""")
rep("    document.getElementById('dClose').focus({ preventScroll: true });",
    "    { const mb = document.getElementById('mBar').getBoundingClientRect(), xb = document.getElementById('dCloseB'); // same spot as the About button\n      if (mb.height) xb.style.top = `${mb.top + mb.height / 2 - 20}px`;\n      (innerWidth < 760 ? xb : document.getElementById('dClose')).focus({ preventScroll: true }); }")
rep("  document.getElementById('dClose').addEventListener('click', closeDetail);",
    "  document.getElementById('dClose').addEventListener('click', closeDetail);\n  document.getElementById('dCloseB').addEventListener('click', closeDetail);")

leftovers = [w for w in ['month', 'priv', 'thumbs/', 'full/', 'dPh', 'dVis', 'dPrev', 'dRel', 'dTags', 'showPriv', 'scrub', "MONTHS", 'pad('] if w in s.split('<script>')[-1]]
print('leftover mentions in script:', leftovers)
open(OUT, 'w').write(s)
