#!/usr/bin/env python3
"""Builds garden/index.html (project map for ananta.work) from the photo globe's index.html."""
import re, sys
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

# ---------- head ----------
rep('<title>Roll a Month Map</title>', '<title>Ananta Mulyono</title>\n<meta name="description" content="Ananta Mulyono, UX designer: projects on a map, connected by the work they share.">')
rep('/* Layout: one black screen, a globe drawn only by the connections between frames, Geist in the corners with Geist Pixel for the HUD. Tag view pulls a contact sheet in front of the globe; detail view is a full-screen light box. Deliberately dark-only. */',
    '/* Layout: one black screen, a globe of projects held together by the work they share, Geist with Geist Pixel for the HUD. Tag view pulls the matching projects in front of the globe; the light box shows one project. Deliberately dark-only. */')

# ---------- CSS: drop the scrubber, add project text and link ----------
for a in ['.scrub {', '.play {', '.track {', '.track input', '.months {', '.months span {', '#tip .ch {', '#tip .priv {', '.toggle {', '.toggle input', '.m-panel .toggle', '.d-ph {']:
    lines = s.split('\n'); idx = [k for k, l in enumerate(lines) if l.lstrip().startswith(a)]
    assert len(idx) == 1, (a, idx); del lines[idx[0]]; s = '\n'.join(lines)
rep('#detail[hidden], .d-ph[hidden], .d-media img[hidden], #dRelS[hidden] { display: none; }', '#detail[hidden], #dRelS[hidden], #dLink[hidden] { display: none; }')
rep('.d-kind.sample { color: var(--muted); }', '''.d-text { margin: 0; font-size: 15px; line-height: 1.5; text-wrap: pretty; }
.d-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font: 400 13px var(--sans); color: var(--ink); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; text-decoration: none; }
.m-bar a { font: 400 12px var(--sans); color: var(--ink); border-radius: 999px; padding: 6px 11px; text-decoration: none; white-space: nowrap; }''')
rep('  .back:hover, .chip:hover, .d-x:hover, .d-nav button:hover:not(:disabled) { border-color: var(--ink); }', '  .back:hover, .chip:hover, .d-x:hover, .d-link:hover, .d-nav button:hover:not(:disabled) { border-color: var(--ink); }\n  .m-bar a:hover { background: rgba(255,255,255,.12); }')
rep('  .m-bar button { padding: 6px 9px; }', '  .m-bar button, .m-bar a { padding: 6px 9px; }')
rep('.chip { font: 400 12px var(--sans);', '.chip { font: 400 12px var(--sans); text-decoration: none;')
rep('.d-media img { max-width: 100%; max-height: calc(100vh - 48px); object-fit: contain; display: block; box-shadow: 0 0 0 1px var(--line); }',
    '.d-media img { max-width: 100%; max-height: calc(100vh - 48px); object-fit: contain; display: block; box-shadow: 0 0 0 1px var(--line); border-radius: 4px; }')

# ---------- HTML ----------
rep('''        <h1>Roll a Month<sup>*</sup></h1>
        <div class="status" id="status">0 frames</div>''', '''        <h1>Ananta Mulyono</h1>
        <div class="status" id="status">UX designer</div>''')
cut('<section data-sec="time"', '</section>')
cut('<section data-sec="about"', '</section>')
rep('''        <button type="button" data-sec="subject" aria-expanded="false" aria-controls="mPanel">Subject</button>
        <button type="button" data-sec="light" aria-expanded="false" aria-controls="mPanel">Light</button>
        <button type="button" data-sec="distance" aria-expanded="false" aria-controls="mPanel">Distance</button>
        <button type="button" data-sec="mood" aria-expanded="false" aria-controls="mPanel">Mood</button>
        <button type="button" data-sec="time" aria-expanded="false" aria-controls="mPanel">Time</button>
        <button type="button" data-sec="about" aria-expanded="false" aria-controls="mPanel">About</button>''',
'''        <button type="button" data-sec="projects" aria-expanded="false" aria-controls="mPanel">Projects</button>
        <button type="button" data-sec="work" aria-expanded="false" aria-controls="mPanel">Work</button>
        <button type="button" data-sec="sector" aria-expanded="false" aria-controls="mPanel">Sector</button>
        <button type="button" data-sec="type" aria-expanded="false" aria-controls="mPanel">Type</button>
        <button type="button" id="mAbout">About</button>''')
rep('<nav class="menu" id="menu" aria-label="Browse">', '<nav class="menu" id="menu" aria-label="Browse projects">')
rep('<div class="d-media"><img id="dImg" alt=""><div class="d-ph" id="dPh" hidden>Sample frame<br>no scan yet</div></div>', '<div class="d-media"><img id="dImg" alt=""></div>')
rep('<button type="button" id="dPrev" aria-label="Previous frame">', '<button type="button" id="dPrev" aria-label="Previous project">')
rep('<button type="button" id="dNext" aria-label="Next frame">', '<button type="button" id="dNext" aria-label="Next project">')
rep('''    <section><h3>Tags</h3><dl class="d-axis" id="dTags"></dl></section>
    <section><h3>On the site</h3><dl class="kv" id="dVis"></dl></section>
    <section id="dRelS"><h3>Shares the most tags</h3><div class="d-rel" id="dRel"></div></section>''',
'''    <section><p class="d-text" id="dText"></p><a class="d-link" id="dLink" target="_blank" rel="noopener" hidden></a></section>
    <section><h3>Tags</h3><dl class="d-axis" id="dTags"></dl></section>
    <section id="dRelS"><h3>Shares the most work</h3><div class="d-rel" id="dRel"></div></section>''')

# ---------- data ----------
i = s.index("  const MONTHS = ['Jan'"); j = s.index("  const tagList = AXES.flatMap")
s = s[:i] + r"""  // Projects: the five client projects from ananta.work, plus bami.blog. Edit here to add more.
  const AXES = ['work', 'sector', 'type'];
  const PROJECTS = [
    { slug: 'about', about: true, title: 'Ananta Mulyono', role: 'UX designer',
      text: 'My work is about making complexity legible. I observe, ask questions, challenge assumptions, and bring structure across stakeholders, processes, and the design itself. I’m drawn to problems where the answer isn’t just on the screen, but in the people and context around it.',
      cv: [['2023 — Now', 'Gemeente Den Haag'], ['2021 — 2023', 'Eneco'], ['2019 — 2021', 'Harborn (fka Connect Holland)'], ['2017 — 2019', 'Silo']],
      links: [['Email', 'mailto:anantadotwork@gmail.com'], ['LinkedIn', 'https://www.linkedin.com/in/anantadotpm/']], email: 'anantadotwork@gmail.com' },
    { slug: 'nvd', title: 'Nationale Veteranendag', type: 'client',
      text: 'For Nationale Veteranendag I applied a new campaign identity to the website, restructuring the information hierarchy to balance campaign messaging with veterans’ personal stories.',
      work: ['website', 'content architecture', 'campaign identity'], sector: ['public sector'] },
    { slug: 'kinfill', title: 'Kinfill', type: 'client',
      text: 'For Kinfill, a Rotterdam-based sustainable cleaning brand, I redesigned the website while a technical team improved performance and future-proofed their logistical processes.',
      work: ['website', 'redesign', 'e-commerce'], sector: ['retail', 'sustainability'] },
    { slug: 'eneco', title: 'Eneco', type: 'client', years: '2021 — 2023',
      text: 'At Eneco I worked on the redesign and continued improvement of the sales flow, with additional contributions to the design system and UX operations.',
      work: ['redesign', 'flows', 'design system', 'UX operations'], sector: ['energy', 'sustainability'] },
    { slug: 'riserve', title: 'Riserve', type: 'client',
      text: 'For Riserve I designed the website and UX flows for a platform connecting talent and jobs with a shared passion for football.',
      work: ['website', 'flows', 'platform'], sector: ['sport', 'recruitment'] },
    { slug: 'gdh', title: 'Gemeente Den Haag', type: 'client', years: '2023 — Now',
      text: 'At Gemeente Den Haag I work as a UX designer across research, content architecture, design, and project coordination for the people and businesses the city serves.',
      work: ['research', 'content architecture', 'project coordination'], sector: ['public sector'] },
    { slug: 'bami', title: 'bami.blog', type: 'side project', link: 'https://bami.blog', linkLabel: 'bami.blog',
      text: 'A logbook of instant noodles. Every pack gets a photo, a number, a flag and a rating out of five.',
      work: ['website', 'code', 'logbook'], sector: ['food'] }
  ];
  const TAGS = Object.fromEntries(AXES.map(a => [a, [...new Set(PROJECTS.filter(p => !p.about).flatMap(p => [].concat(p[a])))]]));
  const AXIS_OF = Object.fromEntries(AXES.flatMap(a => TAGS[a].map(t => [t, a])));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RAD = 14;

  const prng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rnd = prng(20260601);
  const frames = PROJECTS.map((p, n) => ({ ...p, n, tags: p.about ? [] : AXES.flatMap(a => [].concat(p[a])), real: true, aspect: 1, thumb: `img/${p.slug}-sm.jpg`, full: `img/${p.slug}.jpg` }));
""" + s[j:]

# ---------- tiles: square, bigger, all images ----------
rep("  const geoL = twoFaced(plane.clone()), geoP = twoFaced(new THREE.PlaneGeometry(0.41, 0.62));", "  const geoS = twoFaced(new THREE.PlaneGeometry(0.62, 0.62));")
rep("""    const r = RAD + (f.real ? 0.6 : 0.15 + rnd() * 0.3);""", """    const r = RAD + 0.9;""")
i = s.index("    let obj;\n    if (f.real) {"); j = s.index("    f.base = f.real ? 1.8 : 1;")
s = s[:i] + """    const obj = new THREE.Mesh(geoS, new THREE.MeshBasicMaterial({ map: loader.load(f.thumb), transparent: true, depthWrite: false }));
""" + s[j:]
rep("    f.base = f.real ? 1.8 : 1;", "    f.base = 4.2; // projects are few, so each tile is big")
rep("    if (f.real) obj.renderOrder = 2;", "    obj.renderOrder = 2;")
rep("  const edgeGeo = new THREE.EdgesGeometry(plane);\n", "")
rep("  const plane = new THREE.PlaneGeometry(0.62, 0.41);\n", "")
# with six projects most tag pairs occur once: keep every pair that occurs
rep("tagPairs.forEach(q => { q.w = w[q.i][q.j]; q.keep = q.w >= Math.max(2, maxW * 0.1); });", "tagPairs.forEach(q => { q.w = w[q.i][q.j]; q.keep = q.w >= 1; });")

# ---------- state / counts / status ----------
rep("let month = 12, showPriv = true, view = 'globe'", "let view = 'globe'")
rep("const shown = f => f.month <= month && (showPriv || !f.priv);", "const shown = () => true;")
i = s.index("    let vis = 0, priv = 0, scans = 0;"); j = s.index("    const maxW = Math.max(1,")
s = s[:i] + """    frames.forEach(f => {
      f.ti.forEach(i => counts[i]++);
      for (const a of f.ti) for (const b of f.ti) if (a < b) w[a][b]++;
    });
""" + s[j:]
rep("    document.getElementById('status').textContent = `${vis} frames · ${scans} scans · ${counts.filter(c => c > 0).length} tags · ${priv} private`;",
    "    document.getElementById('status').textContent = `UX designer · ${frames.filter(f => !f.about).length} projects`;")
rep("    document.querySelectorAll('#months span').forEach((el, i) => el.classList.toggle('on', i < month));\n", "")
rep("      if (inFocus) op = f.inF ? (f.real ? 1 : f.priv ? 0.6 : 0.42) : 0.025;", "      if (inFocus) op = f.inF ? 1 : 0.025;")
rep("      else if (h) op = matches(f, h) ? 1 : 0.06;", "      else if (h) op = matches(f, h) ? 1 : 0.12;")
rep("      else op = f.real ? 1 : f.priv ? 0.55 : 0.45;", "      else op = 1;")
rep("focusList = frames.filter(f => shown(f) && matches(f, focus)).sort((a, b) => (b.real - a.real) || (a.month - b.month) || (a.n - b.n));", "focusList = frames.filter(f => matches(f, focus));")
rep("    const scans = focusList.filter(f => f.real).length;\n", "")
rep("${focusList.length} frames · ${scans} scan${scans === 1 ? '' : 's'} · ${tagList[focus.tag].axis}", "${focusList.length} project${focusList.length === 1 ? '' : 's'} · ${tagList[focus.tag].axis}")
# contact sheet: fewer, bigger
rep("      f.gscale = Math.min(s * 0.9 / 0.62, 6);", "      f.gscale = Math.min(s * 0.9 / 0.62, 14);")

# ---------- menu sections ----------
rep("  AXES.forEach(a => addSection(a, TAGS[a]));", """  AXES.forEach(a => addSection(a, TAGS[a]));
  { // Projects: one chip per project, straight to its light box
    const sec = document.createElement('section'); sec.dataset.sec = 'projects'; sec.hidden = true; sec.setAttribute('aria-label', 'Projects');
    sec.innerHTML = `<div class="chips">${frames.filter(f => !f.about).map(f => `<button type="button" class="chip" data-id="${f.id}">${f.title}</button>`).join('')}</div>`;
    sec.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { closeMenu(); openDetail(frames[+b.dataset.id]); } });
    mPanel.prepend(sec);
  }
  document.getElementById('mAbout').addEventListener('click', () => { closeMenu(); openDetail(frames.find(f => f.about)); });""")
rep("    mPanel.insertBefore(sec, mPanel.querySelector('[data-sec=\"time\"]'));", "    mPanel.appendChild(sec);")
cut("  const tg = document.createElement('label'); tg.className = 'toggle';", "mPanel.querySelector('[data-sec=\"about\"]').appendChild(tg);")
cut("  document.getElementById('months').innerHTML", "playT = setInterval(")
rep("  });\n\n  // Detail view", "\n  // Detail view") if "  });\n\n  // Detail view" in s else None

# ---------- detail ----------
rep("const dImg = document.getElementById('dImg'), dPh = document.getElementById('dPh'), info = det.querySelector('.d-info');", "const dImg = document.getElementById('dImg'), info = det.querySelector('.d-info');")
rep("    (detFrame.real ? dImg : dPh).animate(", "    dImg.animate(")
rep("  function frameCode(f) { return `Roll ${pad(f.month)} · ${MONTHS[f.month - 1]} · frame ${pad(f.n)}`; }", "  function frameCode(f) { return f.title; }")
rep("    detList = view === 'focus' ? focusList : f.real ? frames.filter(g => g.real && shown(g)) : frames.filter(g => shown(g));", "    detList = view === 'focus' ? focusList : frames;")
rep("    const el = f.real ? dImg : dPh;\n    el.style.opacity = '0';", "    const el = dImg;\n    el.style.opacity = '0';")
rep("    if (f.real) dImg.decode().then(go, go); else go();", "    dImg.decode().then(go, go);")
rep("    const el = f.real ? dImg : dPh;\n    const p1", "    const el = dImg;\n    const p1")
i = s.index("    const img = document.getElementById('dImg'), ph = document.getElementById('dPh');"); j = s.index("    document.getElementById('dCode').textContent = frameCode(f);")
s = s[:i] + """    const img = document.getElementById('dImg');
    img.src = f.thumb; img.alt = `${f.title}: ${f.tags.join(', ')}`;
    const pre = new Image(); pre.onload = () => { if (detFrame === f) img.src = pre.src; }; pre.src = f.full;
""" + s[j:]
rep("    kind.textContent = f.real ? 'Scan' : 'Sample frame'; kind.className = 'd-kind' + (f.real ? '' : ' sample');", "    kind.textContent = [f.type === 'client' ? 'Client' : 'Side project', f.years].filter(Boolean).join(' · '); kind.className = 'd-kind';")
i = s.index("    const people = { none:"); j = s.index("    const rel = frames.filter(")
s = s[:i] + """    document.getElementById('dText').textContent = f.text;
    const link = document.getElementById('dLink'); link.hidden = !f.link;
    if (f.link) { link.href = f.link; link.textContent = `Visit ${f.linkLabel || f.link} ↗`; }
""" + s[j:]
rep('<img src="thumbs/${pad(g.n)}.jpg" alt=""></button>', '<img src="${g.thumb}" alt=""></button>')
rep("if (!detList.includes(detFrame)) detList = frames.filter(g => g.real && shown(g));", "if (!detList.includes(detFrame)) detList = frames;")

# ---------- hover card ----------
rep("tip.innerHTML = `${f.real ? `<img src=\"thumbs/${pad(f.n)}.jpg\" alt=\"\">` : ''}<div class=\"code\">${frameCode(f)}${f.real ? '' : ' · sample'}</div><div class=\"t\">${f.tags.join(' · ')}</div>${f.priv ? '<div class=\"priv\">Private · family, image not shown</div>' : ''}`;",
    "tip.innerHTML = `<div class=\"code\">${f.title}</div><div class=\"t\">${f.about ? f.role + ' · about, CV and contact' : f.work.join(' · ')}</div>`;")
rep("    const tipH = f.real ? 260 : 100;", "    const tipH = 80;")

rep("\n\n  // Month scrubber\n", "\n")
rep("  .months span:nth-child(even) { visibility: hidden; }\n", "")
rep("drop any that would sit on the header, chips or scrubber, run off", "drop any that would sit on the title or the menu, run off")

# ---------- few, big, readable tiles ----------
# place each project at the average of all its tags, then push projects apart so none overlap
rep('''    const rest = new THREE.Vector3(); f.ti.slice(1).forEach(i => rest.add(D[i]));
    const dir = D[f.ti[0]].clone().multiplyScalar(0.72);
    if (f.ti.length > 1) dir.addScaledVector(rest.normalize(), 0.28);
    dir.add(new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(0.2)).normalize();''',
'''    const dir = f.dir;''')
rep("  const loader = new THREE.TextureLoader();", '''  const loader = new THREE.TextureLoader();
  frames.forEach(f => { f.dir = new THREE.Vector3(); f.ti.forEach(i => f.dir.add(D[i])); f.dir.add(new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(0.3)).normalize(); });
  for (let it = 0; it < 200; it++) frames.forEach(f => frames.forEach(g => {
    if (f === g) return; const d = f.dir.angleTo(g.dir); if (d > 1.05) return;
    f.dir.addScaledVector(new THREE.Vector3().subVectors(f.dir, g.dir).normalize(), (1.05 - d) * 0.1).normalize();
  }));''')
rep("    f.base = 4.2; // projects are few, so each tile is big", "    f.base = 3.6; // projects are few, so tiles are bigger than photos (1.8), but still small on the globe")
# tiles always face the viewer: a project is a picture, not a plate on the surface
rep("      if (f.facing && e > 0) dummy.quaternion.copy(camera.quaternion);", "      if (true) dummy.quaternion.copy(camera.quaternion); // always facing the viewer")

# labels steer clear of the project tiles too (tiles are big here)
rep("    const placed = [], isFront = i => D[i].dot(camDir) >= -0.05;", '''    const pxPerUnit = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const placed = frames.filter(f => f.obj.visible && f.obj.material.opacity > 0.3).map(f => {
      tmp.copy(f.obj.position); const dist = tmp.distanceTo(camera.position); tmp.project(camera);
      const x = (tmp.x + 1) / 2 * innerWidth, y = (1 - tmp.y) / 2 * innerHeight, h = 0.31 * f.obj.scale.x * pxPerUnit / dist;
      return [x - h, y - h, x + h, y + h];
    }), isFront = i => D[i].dot(camDir) >= -0.05;''')

# ---------- About is a node: portrait tile, linked to every project, CV and contact in its light box ----------
rep("  frames.forEach(f => { f.dir = new THREE.Vector3(); f.ti.forEach(i => f.dir.add(D[i]));",
    "  frames.forEach(f => { f.dir = f.about ? new THREE.Vector3(0, 1, 0.4) : new THREE.Vector3(); f.ti.forEach(i => f.dir.add(D[i]));")
rep("  const webLines = buildLines(webEdges, 6,", '''  frames.filter(f => f.about).forEach(f => frames.forEach(g => { if (g !== f) webEdges.push({ f, g, a: f.home.clone().normalize(), b: g.home.clone().normalize() }); }));
  const webLines = buildLines(webEdges, 6,''')
rep('    <section><p class="d-text" id="dText"></p>', '''    <section><p class="d-text" id="dText"></p>''')
rep('    <section><h3>Tags</h3><dl class="d-axis" id="dTags"></dl></section>', '''    <section id="dAboutS" hidden><h3>Work</h3><ul class="d-cv" id="dCv"></ul></section>
    <section id="dContactS" hidden><h3>Contact</h3><div class="d-contact" id="dContact"></div></section>
    <section id="dTagsS"><h3>Tags</h3><dl class="d-axis" id="dTags"></dl></section>''')
rep("#detail[hidden], #dRelS[hidden], #dLink[hidden] { display: none; }", '''#detail[hidden], #dRelS[hidden], #dLink[hidden], #dAboutS[hidden], #dContactS[hidden], #dTagsS[hidden] { display: none; }
.d-cv { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.d-cv li { display: grid; grid-template-columns: 92px 1fr; gap: 8px; align-items: baseline; font-size: 13px; }
.d-cv .yrs { font: 400 13px var(--pixel); color: var(--muted); font-variant-numeric: tabular-nums; }
.d-contact { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.d-contact .d-link { margin-top: 0; }
.d-addr { flex-basis: 100%; margin-top: 4px; font-size: 12px; color: var(--muted); user-select: all; }''')
rep("    img.src = f.thumb; img.alt = `${f.title}: ${f.tags.join(', ')}`;", "    img.src = f.thumb; img.alt = f.about ? 'Portraits of Ananta' : `${f.title}: ${f.tags.join(', ')}`;")
rep("    kind.textContent = [f.type === 'client' ? 'Client' : 'Side project', f.years].filter(Boolean).join(' · '); kind.className = 'd-kind';",
    "    kind.textContent = f.about ? f.role : [f.type === 'client' ? 'Client' : 'Side project', f.years].filter(Boolean).join(' · '); kind.className = 'd-kind';")
rep("    document.getElementById('dText').textContent = f.text;", '''    document.getElementById('dText').textContent = f.text;
    document.getElementById('dTagsS').hidden = !f.tags.length;
    document.getElementById('dAboutS').hidden = document.getElementById('dContactS').hidden = !f.about;
    if (f.about) {
      document.getElementById('dCv').innerHTML = f.cv.map(([y, p]) => `<li><span class="yrs">${y}</span><span>${p}</span></li>`).join('');
      document.getElementById('dContact').innerHTML = f.links.map(([l, h]) => `<a class="d-link" href="${h}"${h.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener"'}>${l}</a>`).join('') + `<div class="d-addr">${f.email}</div>`;
    }''')

leftovers = [w for w in ['month', 'priv', 'thumbs/', 'full/', 'dPh', 'dVis', 'showPriv', 'scrub', "MONTHS", 'pad('] if w in s.split('<script>')[-1]]
print('leftover mentions in script:', leftovers)
open(OUT, 'w').write(s)
