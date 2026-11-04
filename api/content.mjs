// GET /api/content → the current garden/content.json straight from GitHub (not the deployed copy), with its version.
import { ready, send, loggedIn, gh, fail, CONTENT_PATH } from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Use GET.' });
  const c = ready(res); if (!c) return;
  if (!loggedIn(req, c)) return send(res, 401, { error: 'Log in first.' });
  try {
    const f = await gh(c, 'GET', `/contents/${CONTENT_PATH}?ref=${encodeURIComponent(c.branch)}`);
    const content = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
    send(res, 200, { content, sha: f.sha, branch: c.branch, repo: c.repo });
  } catch (e) { fail(res, e); }
}
