// /api/league : the last Yahoo sync. ?format=js returns `window.YAHOO = …;` for a <script> tag
// that loads right after data/season.js; anything missing gives null and the site uses season.js alone.
// The daily cron is the most the free Vercel plan allows, so during games this also starts a fresh
// sync in the background when the saved one is more than 10 minutes old (at most one every 10
// minutes, and only once Yahoo is connected). The page that asked gets the saved copy right away;
// the next load after the sync finishes gets the new numbers.
import { waitUntil } from '@vercel/functions';
import { readData, readJson, writeJson } from './_yahoo.js';
import { sync } from './yahoo/sync.js';
import { loadSeasonFile } from './_parlays.js';
import { isGameTime } from './_shared.js';

const FRESH = 10 * 60e3, MARK = 'yahoo/refresh.json';

// Game time (api/_shared.js isGameTime): 15 minutes before each kickoff on data/season.js's NFL
// schedule until 5 hours after it, so Saturday and Christmas games count. The schedule is read at
// most every 10 minutes per instance.
let season = null, seasonAt = 0;
async function gameTime(origin) {
  if (!season || Date.now() - seasonAt > FRESH) { season = await loadSeasonFile(origin); seasonAt = Date.now(); }
  return isGameTime(season);
}

async function refresh(origin) {
  if (!await gameTime(origin)) return;
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
    if (data?.syncedAt && Date.now() - Date.parse(data.syncedAt) > FRESH) waitUntil(refresh(url.origin).catch(() => {}));
    const body = js ? `window.YAHOO=${JSON.stringify(data).replace(/</g, '\\u003c')};` : JSON.stringify(data);
    return new Response(body, {
      headers: {
        'content-type': js ? 'text/javascript; charset=utf-8' : 'application/json',
        'cache-control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600'
      }
    });
  }
};
