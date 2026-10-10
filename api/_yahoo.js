// Shared Yahoo Fantasy plumbing for /api/yahoo/* and /api/league.
// Tokens and synced data live in a private Vercel Blob store (BLOB_READ_WRITE_TOKEN).
// Env: YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, ADMIN_KEY, CRON_SECRET,
// optional YAHOO_REDIRECT_URI (must match the Yahoo app) and YAHOO_LEAGUE_ID.
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

const AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';
const API = 'https://fantasysports.yahooapis.com/fantasy/v2/';
const AUTH_PATH = 'yahoo/auth.json', DATA_PATH = 'yahoo/league.json';

// Yahoo team id -> manager, as the league names them.
export const TEAMS = { 1: 'Tristan', 2: 'Jerger', 3: 'Tony', 4: 'Kurt', 5: 'Colin', 6: 'Mr. G', 7: 'Andy', 8: 'Matt', 9: 'DLin', 10: 'Pablo' };

// ---- storage ----
export async function readJson(path) {
  const r = await get(path, { access: 'private', useCache: false });
  if (!r) return null;
  return JSON.parse(await new Response(r.stream).text());
}
export const writeJson = (path, data) =>
  put(path, JSON.stringify(data), { access: 'private', contentType: 'application/json', allowOverwrite: true, addRandomSuffix: false, cacheControlMaxAge: 60 });
// Read, change and write one JSON file without losing a change someone else saved in between
// (two people tapping at once): the write only lands if the file is still the version that was
// read, otherwise it reads again and re-applies the change. change(data) returns the new data,
// or throws to stop without writing.
export async function updateJson(path, change, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const r = await get(path, { access: 'private', useCache: false });
    const data = r ? JSON.parse(await new Response(r.stream).text()) : null;
    const next = await change(data);
    try {
      await put(path, JSON.stringify(next), { access: 'private', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60, ...(r ? { ifMatch: r.blob.etag } : { allowOverwrite: false }) });
      return next;
    } catch (e) {
      // Someone else wrote first, is writing right now, or created the file first: try again on top
      // of their change, waiting a little longer each time.
      if (e instanceof BlobPreconditionFailedError || /precondition|already exists|conflict/i.test(String(e?.message))) { await new Promise(res => setTimeout(res, (60 + Math.random() * 140) * (i + 1))); continue; }
      throw e;
    }
  }
  throw new Error('Too many taps at once. Try again.');
}
export const readAuth = () => readJson(AUTH_PATH);
export const writeAuth = a => writeJson(AUTH_PATH, a);
export const readData = () => readJson(DATA_PATH);
export const writeData = d => writeJson(DATA_PATH, d);

// ---- access checks ----
export const redirectUri = () => process.env.YAHOO_REDIRECT_URI || 'https://www.9feamg.cloud/api/yahoo/callback';
const same = (a, b) => typeof a == 'string' && typeof b == 'string' && a.length == b.length && a.length > 0 && [...a].every((c, i) => c == b[i]);
// The admin key comes in a header (Authorization: Bearer <key>) or a POSTed form field,
// never the query string, so it stays out of browser history and request logs.
export async function isAdmin(request) {
  const want = process.env.ADMIN_KEY?.trim();
  if (!want) return false;
  if (same(request.headers.get('authorization') || '', 'Bearer ' + want)) return true;
  if (request.method != 'POST') return false;
  try { return same(String((await request.formData()).get('key') || '').trim(), want); } catch { return false; }
}
// A one-field page that POSTs the admin key to `action`.
export const keyForm = (title, action, button, note = '') => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>` +
  `<body style="font-family:system-ui,sans-serif;background:#F7F5F0;color:#191815;padding:32px;line-height:1.5;max-width:420px"><h1 style="font-size:22px">${title}</h1>${note}` +
  `<form method="post" action="${action}"><label>Admin key<br><input name="key" type="password" autocomplete="current-password" required style="width:100%;font-size:16px;padding:10px;margin:6px 0 12px;border:1px solid #E0DBD0;border-radius:8px"></label>` +
  `<button style="font-size:16px;padding:10px 18px;border:0;border-radius:999px;background:#E4572E;color:#141311;font-weight:700">${button}</button></form></body>`,
  { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
export const isCron = req => !!process.env.CRON_SECRET && same(req.headers.get('authorization') || '', 'Bearer ' + process.env.CRON_SECRET.trim());

// ---- OAuth ----
export const authorizeUrl = (origin, state) => AUTH_URL + '?' + new URLSearchParams({
  client_id: process.env.YAHOO_CLIENT_ID, redirect_uri: redirectUri(origin), response_type: 'code', state
});

async function tokenRequest(params) {
  const basic = Buffer.from(process.env.YAHOO_CLIENT_ID + ':' + process.env.YAHOO_CLIENT_SECRET).toString('base64');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { authorization: 'Basic ' + basic, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.access_token) throw new Error('Yahoo token request failed (' + r.status + '): ' + (body.error_description || body.error || 'no token'));
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: Date.now() + (body.expires_in || 3600) * 1000 };
}
export const exchangeCode = (code, origin) => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(origin) });

// A working access token, refreshed (and saved) when it's within 5 minutes of expiring.
export async function accessToken(origin) {
  const auth = await readAuth();
  if (!auth?.refresh_token) throw new Error('Not connected to Yahoo yet. Open /api/yahoo/login and sign in first.');
  if (auth.access_token && auth.expires_at > Date.now() + 300000) return auth;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refresh_token, redirect_uri: redirectUri(origin) });
  const next = { ...auth, ...t, refresh_token: t.refresh_token || auth.refresh_token };
  await writeAuth(next);
  return next;
}

export async function yahoo(path, token) {
  const r = await fetch(API + path + (path.includes('?') ? '&' : '?') + 'format=json', { headers: { authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('Yahoo ' + r.status + ' on ' + path + ': ' + (await r.text()).slice(0, 300));
  return (await r.json()).fantasy_content;
}

// ---- Yahoo JSON helpers ----
// Yahoo nests objects as arrays of one-key fragments; merge folds them into one object.
export function merge(node, acc = {}) {
  if (Array.isArray(node)) { for (const x of node) merge(x, acc); return acc; }
  if (node && typeof node == 'object') Object.assign(acc, node);
  return acc;
}
// Collections look like { count: 2, 0: { team: … }, 1: { team: … } }.
export const list = (coll, key) => coll ? Object.keys(coll).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b).map(k => coll[k][key]) : [];
export const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; };
export const teamManager = t => TEAMS[+String(t.team_key || '').split('.t.')[1] || +t.team_id];
