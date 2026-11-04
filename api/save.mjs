// POST /api/save {content, baseSha, images: [{path, sha}]} → one commit with content.json and any new images.
// Refuses (409) if content.json changed on GitHub since the admin page loaded it, so nothing is overwritten.
import { ready, send, readBody, fromAdmin, loggedIn, gh, fail, CONTENT_PATH, IMAGE_PATH } from './_lib.mjs';

function check(content) {
  if (!content || typeof content !== 'object' || !Array.isArray(content.projects)) return 'The content has no project list.';
  for (const [i, p] of content.projects.entries()) {
    if (!p || typeof p.title !== 'string' || !p.title.trim()) return `Project ${i + 1} needs a title.`;
    if (!Array.isArray(p.images) || !p.images.length) return `“${p.title}” needs at least one image.`;
    if (p.images.some(s => typeof s !== 'string' || !/^img\/[a-z0-9][a-z0-9-]*\.(jpg|png|webp)$/i.test(s))) return `“${p.title}” has an image path the site can’t use.`;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  const c = ready(res); if (!c) return;
  if (!fromAdmin(req)) return send(res, 403, { error: 'Not allowed.' });
  if (!loggedIn(req, c)) return send(res, 401, { error: 'Log in first.' });
  try {
    const body = await readBody(req, 600_000);
    const problem = check(body.content); if (problem) return send(res, 400, { error: problem });
    const images = (body.images || []).filter(x => x && IMAGE_PATH.test(x.path) && /^[0-9a-f]{40}$/.test(x.sha));
    const current = await gh(c, 'GET', `/contents/${CONTENT_PATH}?ref=${encodeURIComponent(c.branch)}`);
    if (current.sha !== body.baseSha) return send(res, 409, { error: 'The content changed somewhere else since you opened the admin. Reload to get the latest, then make your change again.' });
    const ref = await gh(c, 'GET', `/git/ref/heads/${encodeURIComponent(c.branch)}`);
    const head = await gh(c, 'GET', `/git/commits/${ref.object.sha}`);
    const json = JSON.stringify(body.content, null, 2) + '\n';
    const blob = await gh(c, 'POST', '/git/blobs', { content: Buffer.from(json).toString('base64'), encoding: 'base64' });
    const tree = await gh(c, 'POST', '/git/trees', { base_tree: head.tree.sha, tree: [
      { path: CONTENT_PATH, mode: '100644', type: 'blob', sha: blob.sha },
      ...images.map(x => ({ path: x.path, mode: '100644', type: 'blob', sha: x.sha })),
    ] });
    const titles = body.content.projects.map(p => p.title).join(', ');
    const commit = await gh(c, 'POST', '/git/commits', { message: `Update site content from the admin\n\nProjects: ${titles}`, tree: tree.sha, parents: [head.sha] });
    try { await gh(c, 'PATCH', `/git/refs/heads/${encodeURIComponent(c.branch)}`, { sha: commit.sha, force: false }); }
    catch (e) { if (e.status === 422) return send(res, 409, { error: 'Someone else saved at the same moment. Reload and try again.' }); throw e; }
    send(res, 200, { ok: true, commit: commit.sha, sha: blob.sha });
  } catch (e) { fail(res, e); }
}
