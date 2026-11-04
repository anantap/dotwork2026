// POST /api/image {name, data (base64)} → stores the image in the repository's object store (not yet committed)
// and returns {path, sha}. /api/save commits it together with content.json, so one save is one commit.
import { ready, send, readBody, fromAdmin, loggedIn, gh, fail } from './_lib.mjs';
import crypto from 'node:crypto';

const TYPES = [['jpg', [0xff, 0xd8, 0xff]], ['png', [0x89, 0x50, 0x4e, 0x47]], ['webp', [0x52, 0x49, 0x46, 0x46]]];

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  const c = ready(res); if (!c) return;
  if (!fromAdmin(req)) return send(res, 403, { error: 'Not allowed.' });
  if (!loggedIn(req, c)) return send(res, 401, { error: 'Log in first.' });
  try {
    const body = await readBody(req, 4_200_000);
    const bytes = Buffer.from(String(body.data || ''), 'base64');
    const type = TYPES.find(([, sig]) => sig.every((b, i) => bytes[i] === b));
    if (!type || bytes.length < 100) return send(res, 400, { error: 'Only JPG, PNG or WebP images.' });
    if (bytes.length > 3_000_000) return send(res, 413, { error: 'That image is too large (over 3 MB after resizing).' });
    const base = String(body.name || 'image').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'image';
    const path = `garden/img/${base}-${crypto.randomBytes(3).toString('hex')}.${type[0]}`;
    const blob = await gh(c, 'POST', '/git/blobs', { content: bytes.toString('base64'), encoding: 'base64' });
    send(res, 200, { path, sha: blob.sha });
  } catch (e) { fail(res, e); }
}
