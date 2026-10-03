// /api/league : the last Yahoo sync. ?format=js returns `window.YAHOO = …;` for a <script> tag
// that loads right after data/season.js; anything missing gives null and the site uses season.js alone.
import { readData } from './_yahoo.js';

export default {
  async fetch(request) {
    const js = new URL(request.url).searchParams.get('format') == 'js';
    let data = null;
    try { data = await readData(); } catch { /* not connected yet */ }
    const body = js ? `window.YAHOO=${JSON.stringify(data).replace(/</g, '\\u003c')};` : JSON.stringify(data);
    return new Response(body, {
      headers: {
        'content-type': js ? 'text/javascript; charset=utf-8' : 'application/json',
        'cache-control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600'
      }
    });
  }
};
