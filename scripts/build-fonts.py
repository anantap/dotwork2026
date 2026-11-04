#!/usr/bin/env python3
"""Small, self-hosted fonts for the site.

    python3 scripts/build-fonts.py        (needs: pip install fonttools brotli)

From the sources in scripts/fonts-src/ it writes fonts/geist-<hash>.woff2 (Geist, fixed at weight 400, the only weight
the site uses) and fonts/geist-pixel-<hash>.woff2, both cut down to Latin text, punctuation and arrows, and
fonts/fonts.json with their names, which scripts/build-pages.mjs puts in the page. Run it again only when the
sources or the needed characters change.
"""
import hashlib, io, json, os
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
os.makedirs('fonts', exist_ok=True)
UNICODES = [*range(0x20, 0x7F), *range(0xA0, 0x100), *range(0x2010, 0x2028), *range(0x2030, 0x203B), 0x20AC, *range(0x2190, 0x219A)]


def build(src, name, weight=None):
    font = TTFont(src)
    if weight and 'fvar' in font:
        font = instancer.instantiateVariableFont(font, {'wght': weight})
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['kern', 'liga', 'calt', 'tnum']; opts.name_IDs = [1, 2]; opts.notdef_outline = True
    sub = subset.Subsetter(opts); sub.populate(unicodes=UNICODES); sub.subset(font)
    buf = io.BytesIO(); font.flavor = 'woff2'; font.save(buf); data = buf.getvalue()
    out = f'fonts/{name}-{hashlib.sha1(data).hexdigest()[:8]}.woff2'
    for f in os.listdir('fonts'):
        if f.startswith(name + '-') and f.endswith('.woff2') and f'fonts/{f}' != out and not (name == 'geist' and f.startswith('geist-pixel')):
            os.remove(f'fonts/{f}')
    open(out, 'wb').write(data)
    print(f'{src} ({os.path.getsize(src) // 1024} KB) -> {out} ({len(data) // 1024} KB)')
    return out


out = {'sans': build('scripts/fonts-src/Geist-latin-variable.woff2', 'geist', weight=400),
       'pixel': build('scripts/fonts-src/GeistPixel.woff2', 'geist-pixel')}
json.dump(out, open('fonts/fonts.json', 'w'), indent=1)
