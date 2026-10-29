// /api/live : the live week's matchup scores and player points straight from Yahoo, for the
// scoreboard during games. The answer is /api/league's shape with just the current week
// ({ syncedAt, leagueKey, currentWeek, weeks: { [w]: { status, matchups, teams, box } } }), so the
// site lays it over /api/league with the same mergeYahoo, and the newer read wins. ?format=js
// returns `window.YAHOO_LIVE = …;` for a <script> tag that loads after /api/league.
// During game time (api/_shared.js isGameTime) a request pulls Yahoo when this instance's copy is
// more than 90 seconds old: one scoreboard call and one roster call per team. The CDN keeps each
// answer for 60 seconds, so a busy Sunday costs Yahoo about one pull a minute and nobody watching
// costs nothing. Outside game time it answers null without calling Yahoo, and the site uses
// /api/league alone. Nothing is written to Blob storage (the free plan's write budget); the token
// is kept in memory until it's close to expiring.
import { accessToken } from './_yahoo.js';
import { scoreboard, boxScores, findLeague } from './yahoo/sync.js';
import { loadSeasonFile } from './_parlays.js';
import { isGameTime } from './_shared.js';

const FRESH = 90e3, SEASON_FRESH = 10 * 60e3;
let season = null, seasonAt = 0, auth = null, last = null;

async function gameTime(origin) {
  if (!season || Date.now() - seasonAt > SEASON_FRESH) { season = await loadSeasonFile(origin); seasonAt = Date.now(); }
  return isGameTime(season);
}

async function pull(origin) {
  if (!auth || auth.expires_at < Date.now() + 300000) auth = await accessToken(origin);
  const token = auth.access_token, key = auth.league_key || await findLeague(token, auth);
  const { out, league } = await scoreboard(token, key);
  const w = +league.current_week;
  if (out.status != 'preevent') out.box = await boxScores(token, key, w, out.teams);
  return { syncedAt: new Date().toISOString(), leagueKey: key, currentWeek: w, weeks: { [w]: out } };
}

export default {
  async fetch(request) {
    const url = new URL(request.url), js = url.searchParams.get('format') == 'js';
    let data = null, live = false;
    try {
      live = await gameTime(url.origin);
      if (live) {
        if (!last || Date.now() - Date.parse(last.syncedAt) > FRESH) last = await pull(url.origin);
        data = last;
      }
    } catch (e) {
      // Yahoo or the token failed: keep showing this instance's last pull if there is one.
      console.error('live:', e.message);
      data = live ? last : null;
    }
    const body = js ? `window.YAHOO_LIVE=${JSON.stringify(data).replace(/</g, '\\u003c')};` : JSON.stringify(data);
    return new Response(body, {
      headers: {
        'content-type': js ? 'text/javascript; charset=utf-8' : 'application/json',
        'cache-control': live ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=30' : 'public, max-age=0, s-maxage=300'
      }
    });
  }
};
