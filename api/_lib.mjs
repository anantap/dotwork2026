// Shared helpers for the admin API (files starting with "_" are not routes on Vercel).
// Settings come from environment variables set in Vercel → Settings → Environment Variables:
//   ADMIN_PASSWORD   the password for /garden/admin/
//   GITHUB_TOKEN     a fine-grained GitHub token with "Contents: read and write" on this repository
//   GITHUB_REPO      optional, default anantap/rollamonth
//   GITHUB_BRANCH    optional, default: the branch this deployment was built from
import crypto from 'node:crypto';

export const CONTENT_PATH = 'garden/content.json';
export const IMAGE_PATH = /^garden\/img\/[a-z0-9][a-z0-9-]{0,80}\.(jpg|png|webp)$/;

export function config() {
  const e = process.env;
  return {
    password: e.ADMIN_PASSWORD || '',
    token: e.GITHUB_TOKEN || '',
    repo: e.GITHUB_REPO || 'anantap/rollamonth',
    branch: e.GITHUB_BRANCH || e.VERCEL_GIT_COMMIT_REF || 'main',
    api: e.GITHUB_API || 'https://api.github.com',
    secret: e.SESSION_SECRET || crypto.createHash('sha256').update(`${e.ADMIN_PASSWORD}|${e.GITHUB_TOKEN}`).digest('hex'),
  };
}

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

// The admin isn't usable until both settings exist; say so plainly
export function ready(res) {
  const c = config();
  if (!c.password || !c.token) {
    send(res, 503, { error: 'The admin isn’t set up yet. In Vercel, open Settings → Environment Variables, add ADMIN_PASSWORD and GITHUB_TOKEN, then redeploy.' });
    return null;
  }
  return c;
}

// JSON body, whether or not the platform already parsed it
export async function readBody(req, limit = 4_000_000) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('Too large'), { status: 413 }); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

// Requests that change things must come from the admin page itself (custom header + SameSite cookie)
export function fromAdmin(req) { return req.headers['x-admin'] === '1'; }

// Session: a signed expiry time in an HttpOnly cookie
const COOKIE = 'garden_admin';
const sign = (c, v) => crypto.createHmac('sha256', c.secret).update(v).digest('base64url');
export function sessionCookie(c, req, maxAgeSec = 60 * 60 * 24 * 14) {
  const exp = String(Date.now() + maxAgeSec * 1000);
  const secure = /^localhost|^127\./.test(req.headers.host || '') ? '' : '; Secure';
  return `${COOKIE}=${exp}.${sign(c, exp)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`;
}
export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
export function loggedIn(req, c) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9]+)\\.([A-Za-z0-9_-]+)`).exec(req.headers.cookie || '');
  if (!m || +m[1] < Date.now()) return false;
  const a = Buffer.from(sign(c, m[1])), b = Buffer.from(m[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function passwordMatches(c, given) {
  const a = crypto.createHash('sha256').update(String(given ?? '')).digest(), b = crypto.createHash('sha256').update(c.password).digest();
  return crypto.timingSafeEqual(a, b);
}

// GitHub REST API for this repository
export async function gh(c, method, path, data) {
  const r = await fetch(`${c.api}/repos/${c.repo}${path}`, {
    method,
    headers: { authorization: `Bearer ${c.token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'garden-admin', ...(data ? { 'content-type': 'application/json' } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  if (!r.ok) throw Object.assign(new Error(`GitHub ${method} ${path}: ${r.status} ${json?.message || text.slice(0, 200)}`), { status: r.status, github: true });
  return json;
}

export function fail(res, e) {
  if (e.status === 413) return send(res, 413, { error: 'That file is too large.' });
  if (e.github && (e.status === 401 || e.status === 403)) return send(res, 502, { error: 'GitHub refused the token. Check that GITHUB_TOKEN is valid and has “Contents: read and write” on the repository.' });
  if (e.github && e.status === 404) return send(res, 502, { error: 'GitHub couldn’t find the repository or branch. Check GITHUB_REPO and GITHUB_BRANCH.' });
  console.error(e);
  send(res, 500, { error: 'Something went wrong on the server. Try again in a moment.' });
}
