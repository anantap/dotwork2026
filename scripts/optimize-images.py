#!/usr/bin/env python3
"""Light versions of every photo the site shows, plus a link-preview image per project.

    python3 scripts/optimize-images.py

Reads content.json and writes, next to the originals (which stay as they are):
  img/opt/<name>-<hash>-sq400.webp, -sq800.webp   square crops for the topic grid
  img/opt/<name>-<hash>-w800.webp,  -w1600.webp   the photo itself, for phones and for larger screens
  img/opt/<name>-<hash>-a240.webp                 the About photo
  img/og/<project>-<hash>.jpg                     1200x630 link preview per project (first photo)
  img/opt/manifest.json                           {"img/name.jpg": "<hash>"}; the page uses a light version only when it is listed
<hash> is taken from the original's bytes, so a replaced photo gets new names (the light versions can be cached for good).
Files in img/opt and img/og that are no longer needed are removed. Runs again quickly: existing versions are kept.
"""
import hashlib, json, os, re, sys, unicodedata
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OPT, OG = 'img/opt', 'img/og'
os.makedirs(OPT, exist_ok=True); os.makedirs(OG, exist_ok=True)


def slug(s):  # same rule as the page and scripts/build-pages.mjs
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def digest(path):
    return hashlib.sha1(open(path, 'rb').read()).hexdigest()[:8]


def stem(src):
    return os.path.splitext(src[len('img/'):])[0]


def load(src):
    return ImageOps.exif_transpose(Image.open(src)).convert('RGB')


def fit(im, w):
    k = w / max(im.size)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS) if k < 1 else im


def square(im, w):
    s = min(im.size)
    return im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).resize((w, w), Image.LANCZOS)


def cover(im, w, h):
    k = max(w / im.width, h / im.height)
    r = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    l, t = (r.width - w) // 2, (r.height - h) // 2
    return r.crop((l, t, l + w, t + h))


content = json.load(open('content.json'))
want, manifest, made = set(), {}, 0
jobs = [(src, ('sq400', 'sq800', 'w800', 'w1600')) for p in content.get('projects', []) for src in p.get('images', [])]
if content.get('photo'):
    jobs.append((content['photo'], ('a240',)))
for src, kinds in jobs:
    if not os.path.exists(src):
        print('missing', src, file=sys.stderr); continue
    h = manifest.setdefault(src, digest(src))
    im = None
    for kind in kinds:
        out = f'{OPT}/{stem(src)}-{h}-{kind}.webp'
        want.add(out)
        if os.path.exists(out):
            continue
        im = im or load(src)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        if kind.startswith('sq'):
            v = square(im, int(kind[2:]))
        elif kind == 'a240':
            v = square(im, 240)
        else:
            v = fit(im, int(kind[1:]))
        v.save(out, 'WEBP', quality=78, method=6)
        made += 1
for p in content.get('projects', []):
    if not p.get('images') or not os.path.exists(p['images'][0]):
        continue
    src = p['images'][0]
    out = f'{OG}/{slug(p["title"])}-{manifest.get(src) or digest(src)}.jpg'
    want.add(out)
    if not os.path.exists(out):
        cover(load(src), 1200, 630).save(out, 'JPEG', quality=80, optimize=True, progressive=True)
        made += 1

removed = 0
for d in (OPT, OG):
    for dirpath, _, files in os.walk(d):
        for f in files:
            path = os.path.join(dirpath, f).replace(os.sep, '/')
            if path.endswith('manifest.json') or path in want:
                continue
            os.remove(path); removed += 1
json.dump(manifest, open(f'{OPT}/manifest.json', 'w'), indent=0, sort_keys=True)
size = sum(os.path.getsize(f) for f in want if os.path.exists(f))
print(f'{len(manifest)} photos, {len(want)} light versions ({size // 1024} KB in all); {made} made, {removed} removed')
