// /api/yahoo/callback : Yahoo sends the sign-in back here. Saves the tokens, then runs a first sync.
import { exchangeCode, writeAuth, readAuth } from '../_yahoo.js';
import { sync } from './sync.js';

const page = (title, body, status = 200) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
  `<body style="font-family:system-ui,sans-serif;background:#0D1424;color:#EEF2F8;padding:32px;line-height:1.5"><h1 style="font-size:22px">${title}</h1>${body}<p><a style="color:#FF7A52" href="/">Back to 9FEAMG</a></p></body>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code'), state = url.searchParams.get('state');
    const cookie = (request.headers.get('cookie') || '').match(/(?:^|;\s*)yahoo_state=([^;]+)/)?.[1];
    if (url.searchParams.get('error')) return page('Yahoo sign-in cancelled', `<p>${esc(url.searchParams.get('error_description') || url.searchParams.get('error'))}</p>`, 400);
    if (!code || !state || state != cookie) return page('Sign-in expired', '<p>Start again from /api/yahoo/login.</p>', 400);

    let auth;
    try { auth = await exchangeCode(code, url.origin); }
    catch (e) { return page('Yahoo sign-in failed', `<p>${esc(e.message)}</p>`, 502); }
    const old = await readAuth().catch(() => null);
    await writeAuth({ ...auth, league_key: old?.league_key, connectedAt: new Date().toISOString() });

    let result;
    try { result = await sync(url.origin); }
    catch (e) {
      return page('Connected, but the first sync failed', `<p>${esc(e.message)}</p><p>If Yahoo says access is denied, the Fantasy Sports API isn't switched on for the app yet. The connection is saved; the daily sync will keep trying.</p>`);
    }
    return page('Connected to Yahoo', `<p>Synced ${esc(result.league)} through Week ${result.currentWeek}: ${result.weeks} weeks, ${result.boxWeeks} with box scores.</p>`);
  }
};
