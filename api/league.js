// /api/league : the last Yahoo sync. ?format=js returns `window.YAHOO = …;` for a <script> tag
// that loads right after data/season.js; anything missing gives null and the site uses season.js alone.
// The daily cron is the most the free Vercel plan allows, so during games this also starts a fresh
// sync in the background when the saved one is more than 10 minutes old (at most one every 10
// minutes, and only once Yahoo is connected). The page that asked gets the saved copy right away;
// the next load after the sync finishes gets the new numbers.
import { waitUntil } from '@vercel/functions';
import { readData, readJson, writeJson } from './_yahoo.js';
import { sync } from './yahoo/sync.js';

const FRESH = 10 * 60e3, MARK = 'yahoo/refresh.json';

// Game time (Central): Thursday night, all Sunday, Monday night, and the hour after each.
function gameTime(now = new Date()) {
  const d = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' })), day = d.getDay(), h = d.getHours();
  return (day == 4 && h >= 19) || (day == 5 && h < 1) || (day == 0 && h >= 8) || (day == 1 && (h < 1 || h >= 19)) || (day == 2 && h < 1);
}

async function refresh(origin) {
  const mark = await readJson(MARK).catch(() => null);
  if (mark?.at && Date.now() - mark.at < FRESH) return;
  await writeJson(MARK, { at: Date.now() });
  try { await sync(origin); } catch (e) { await writeJson(MARK, { at: Date.now(), error: String(e.message || e) }).catch(() => {}); }
}

export default {
  async fetch(request) {
    const url = new URL(request.url), js = url.searchParams.get('format') == 'js';
    let data = null;
    try { data = await readData(); } catch { /* not connected yet */ }
    if (data?.syncedAt && gameTime() && Date.now() - Date.parse(data.syncedAt) > FRESH) waitUntil(refresh(url.origin).catch(() => {}));
    const body = js ? `window.YAHOO=${JSON.stringify(data).replace(/</g, '\\u003c')};` : JSON.stringify(data);
    return new Response(body, {
      headers: {
        'content-type': js ? 'text/javascript; charset=utf-8' : 'application/json',
        'cache-control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600'
      }
    });
  }
};
