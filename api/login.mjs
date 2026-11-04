// POST /api/login {password} → session cookie.  DELETE /api/login → log out.
import { ready, send, readBody, fromAdmin, passwordMatches, sessionCookie, clearCookie } from './_lib.mjs';

const attempts = new Map(); // ip → [timestamps]; per instance, enough to slow down guessing
const WINDOW = 15 * 60 * 1000, MAX = 10;

export default async function handler(req, res) {
  if (req.method === 'DELETE') return send(res, 200, { ok: true }, { 'set-cookie': clearCookie });
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  const c = ready(res); if (!c) return;
  if (!fromAdmin(req)) return send(res, 403, { error: 'Not allowed.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const now = Date.now(), recent = (attempts.get(ip) || []).filter(t => now - t < WINDOW);
  if (recent.length >= MAX) return send(res, 429, { error: 'Too many attempts. Wait a quarter of an hour and try again.' });
  let body; try { body = await readBody(req, 10_000); } catch { return send(res, 400, { error: 'Bad request.' }); }
  if (!passwordMatches(c, body.password)) {
    attempts.set(ip, [...recent, now]);
    return send(res, 401, { error: 'That password isn’t right.' });
  }
  attempts.delete(ip);
  send(res, 200, { ok: true }, { 'set-cookie': sessionCookie(c, req) });
}
