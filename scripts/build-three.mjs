// A three.js build with only the parts the page uses, served from the site itself.
//   node scripts/build-three.mjs            (needs the devDependencies: three, esbuild)
// Collects every THREE.Something the page's script names, bundles just those from three r147 (tree-shaken, minified)
// to js/three-<hash>.js exposing the same global THREE, and records the file name in js/three.json.
import { build } from 'esbuild'; import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))); process.chdir(root);
const page = fs.readFileSync('src/index.html', 'utf8');
const names = [...new Set([...page.matchAll(/\bTHREE\.([A-Za-z0-9_]+)/g)].map(m => m[1]))].sort();
const entry = `import { ${names.join(', ')} } from 'three';\nwindow.THREE = {}; Object.assign(window.THREE, { ${names.join(', ')} }); // filled in one by one, as three.min.js does\n`;
const res = await build({ stdin: { contents: entry, resolveDir: root, loader: 'js' }, bundle: true, minify: true, format: 'iife', write: false, target: ['es2019'], legalComments: 'none' });
const code = res.outputFiles[0].text, hash = crypto.createHash('sha1').update(code).digest('hex').slice(0, 8);
fs.mkdirSync('js', { recursive: true });
for (const f of fs.readdirSync('js')) if (/^three-[0-9a-f]{8}\.js$/.test(f)) fs.unlinkSync(`js/${f}`);
const out = `js/three-${hash}.js`; fs.writeFileSync(out, code); fs.writeFileSync('js/three.json', JSON.stringify({ file: out, names }, null, 1));
console.log(`${names.length} parts of three.js -> ${out} (${(code.length / 1024).toFixed(0)} KB, full three.min.js is ${(fs.statSync('node_modules/three/build/three.min.js').size / 1024).toFixed(0)} KB)`);
