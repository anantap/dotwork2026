// Local stand-in for Vercel + GitHub, to test the admin without either.
//   node tests/admin-server.mjs            → site with /api on :3300, fake GitHub on :3301, password "test"
// Also importable: start({ site, github }) returns { repo, close }.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css' };

// ---------- a tiny in-memory git repository with the GitHub endpoints the admin uses ----------
function fakeGitHub({ token = 'test-token', branch = 'main' } = {}) {
  const blobs = new Map(), trees = new Map(), commits = new Map();
  const blobSha = buf => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
  const putBlob = buf => { const sha = blobSha(buf); blobs.set(sha, buf); return sha; };
  const putTree = files => { const sha = crypto.createHash('sha1').update(JSON.stringify([...files].sort())).digest('hex'); trees.set(sha, new Map(files)); return sha; };
  const seed = new Map([['content.json', putBlob(fs.readFileSync(path.join(ROOT, 'content.json')))]]);
  let head = crypto.randomBytes(20).toString('hex');
  commits.set(head, { tree: putTree(seed), parents: [], message: 'seed' });
  const repo = {
    commits, get head() { return head; },
    files: () => trees.get(commits.get(head).tree),
    read: p => blobs.get(repo.files().get(p)),
    // simulate an edit made somewhere else (e.g. on github.com)
    externalEdit(p, buf) { const files = new Map(repo.files()); files.set(p, putBlob(buf)); const c = crypto.randomBytes(20).toString('hex'); commits.set(c, { tree: putTree(files), parents: [head], message: 'external' }); head = c; },
    requests: 0,
  };
  const server = http.createServer(async (req, res) => {
    repo.requests++;
    const send = (s, d) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(d)); };
    if (req.headers.authorization !== `Bearer ${token}`) return send(401, { message: 'Bad credentials' });
    const u = new URL(req.url, 'http://x'), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)$/);
    if (!m) return send(404, { message: 'Not Found' });
    const p = decodeURIComponent(m[1]);
    let body = ''; for await (const c of req) body += c; body = body ? JSON.parse(body) : {};
    let r;
    if (req.method === 'GET' && (r = p.match(/^\/contents\/(.+)$/))) {
      if (u.searchParams.get('ref') !== branch) return send(404, { message: 'No commit found for the ref' });
      const sha = repo.files().get(r[1]); if (!sha) return send(404, { message: 'Not Found' });
      return send(200, { sha, content: blobs.get(sha).toString('base64'), encoding: 'base64' });
    }
    if (req.method === 'GET' && p === `/git/ref/heads/${branch}`) return send(200, { object: { sha: head } });
    if (req.method === 'GET' && (r = p.match(/^\/git\/commits\/([0-9a-f]{40})$/))) { const c = commits.get(r[1]); return c ? send(200, { sha: r[1], tree: { sha: c.tree } }) : send(404, { message: 'Not Found' }); }
    if (req.method === 'POST' && p === '/git/blobs') return send(201, { sha: putBlob(Buffer.from(body.content, body.encoding === 'base64' ? 'base64' : 'utf8')) });
    if (req.method === 'POST' && p === '/git/trees') {
      const base = trees.get(body.base_tree); if (!base) return send(422, { message: 'base_tree not found' });
      const files = new Map(base); for (const t of body.tree) { if (!blobs.has(t.sha)) return send(422, { message: 'blob not found' }); files.set(t.path, t.sha); }
      return send(201, { sha: putTree(files) });
    }
    if (req.method === 'POST' && p === '/git/commits') { const c = crypto.randomBytes(20).toString('hex'); commits.set(c, { tree: body.tree, parents: body.parents, message: body.message }); return send(201, { sha: c }); }
    if (req.method === 'PATCH' && p === `/git/refs/heads/${branch}`) {
      const c = commits.get(body.sha); if (!c) return send(422, { message: 'Object does not exist' });
      if (!body.force && c.parents[0] !== head) return send(422, { message: 'Update is not a fast forward' });
      head = body.sha; return send(200, { object: { sha: head } });
    }
    send(404, { message: 'Not Found' });
  });
  return { server, repo };
}

// ---------- the site: static files + /api/<name> → api/<name>.mjs, as on Vercel ----------
function site() {
  return http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const fn = u.pathname.match(/^\/api\/([a-z]+)\/?$/);
    if (fn) {
      const file = path.join(ROOT, 'api', fn[1] + '.mjs');
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      const mod = await import(pathToFileURL(file).href);
      return mod.default(req, res);
    }
    let p = decodeURIComponent(u.pathname);
    let f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
      if (!p.endsWith('/')) { res.writeHead(308, { location: p + '/' }); return res.end(); } // like vercel.json trailingSlash
      f = path.join(f, 'index.html');
    }
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
}

export async function start({ sitePort = 3300, githubPort = 3301, password = 'test' } = {}) {
  const gh = fakeGitHub();
  Object.assign(process.env, { ADMIN_PASSWORD: password, GITHUB_TOKEN: 'test-token', GITHUB_REPO: 'anantap/dotwork2026', GITHUB_BRANCH: 'main', GITHUB_API: `http://127.0.0.1:${githubPort}` });
  const s = site();
  await new Promise(ok => gh.server.listen(githubPort, '127.0.0.1', ok));
  await new Promise(ok => s.listen(sitePort, '127.0.0.1', ok));
  return { repo: gh.repo, close: () => { gh.server.close(); s.close(); } };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await start();
  console.log('admin test site on http://localhost:3300/admin/ (password "test"), fake GitHub on :3301');
}
