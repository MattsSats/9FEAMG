// /api/league : the last Yahoo sync. ?format=js returns `window.YAHOO = …;` for a <script> tag
// that loads right after data/season.js; anything missing gives null and the site uses season.js alone.
// The daily cron is the most the free Vercel plan allows, so this also starts a fresh sync in the
// background when the saved one is more than 10 minutes old (at most one every 10 minutes, and only
// once Yahoo is connected). Any time of day, not just during games (Matt, Nov 8, 2026), so a lineup
// set the night before shows up on the next visit or chat sync, without a browser pull. The page
// that asked gets the saved copy right away; the next load after the sync finishes gets the new numbers.
// ?format=status is the health check (no tokens in it): when Yahoo was last read, when the token last
// renewed, how many moves are on file, and the last error from a sync, a background refresh or the
// moves/FAAB read. healthy is false once the last good read is more than 26 hours old.
import { waitUntil } from '@vercel/functions';
import { readData, readJson, writeJson, readAuth, STATUS_PATH } from './_yahoo.js';
import { sync } from './yahoo/sync.js';

const FRESH = 10 * 60e3, MARK = 'yahoo/refresh.json';

async function refresh(origin) {
  const mark = await readJson(MARK).catch(() => null);
  if (mark?.at && Date.now() - mark.at < FRESH) return;
  await writeJson(MARK, { at: Date.now() });
  try { await sync(origin); } catch (e) {
    const error = String(e.message || e);
    await writeJson(MARK, { at: Date.now(), error }).catch(() => {});
    await writeJson(STATUS_PATH, { at: new Date().toISOString(), error, from: 'background refresh' }).catch(() => {});
  }
}

async function status(data) {
  const [auth, last] = await Promise.all([readAuth().catch(() => null), readJson(STATUS_PATH).catch(() => null)]);
  const ok = !!data?.syncedAt && Date.now() - Date.parse(data.syncedAt) < 26 * 3600e3;
  return { healthy: ok, syncedAt: data?.syncedAt || null, currentWeek: data?.currentWeek ?? null, connected: !!auth?.refresh_token,
    tokenRefreshedAt: auth?.refreshedAt || null, moves: data?.tx?.length ?? null, faab: !!data?.managers, txError: data?.txError || null,
    lastError: last && (!data?.syncedAt || Date.parse(last.at) > Date.parse(data.syncedAt)) ? last : null };
}

export default {
  async fetch(request) {
    const url = new URL(request.url), js = url.searchParams.get('format') == 'js';
    let data = null;
    try { data = await readData(); } catch { /* not connected yet */ }
    if (data?.syncedAt && Date.now() - Date.parse(data.syncedAt) > FRESH) waitUntil(refresh(url.origin).catch(() => {}));
    if (url.searchParams.get('format') == 'status') return Response.json(await status(data), { headers: { 'cache-control': 'no-store' } });
    const body = js ? `window.YAHOO=${JSON.stringify(data).replace(/</g, '\\u003c')};` : JSON.stringify(data);
    return new Response(body, {
      headers: {
        'content-type': js ? 'text/javascript; charset=utf-8' : 'application/json',
        'cache-control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600'
      }
    });
  }
};
