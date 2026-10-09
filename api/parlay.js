// /p/<slug> (rewritten here by vercel.json). Link-preview bots get a page whose
// Open Graph tags describe this parlay and point at its generated image
// (/api/og). People are redirected to the card on the site (/#<slug>).
import { loadSeason, findParlay, describe, escapeHtml, hash } from './_parlays.js';
import { readJson } from './_yahoo.js';

const BOTS = /bot|crawl|spider|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|whatsapp|telegram|linkedin|embedly|skype|iframely|preview/i;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const slug = (url.searchParams.get('slug') || '').replace(/[^\w-]/g, '');
    const home = new URL('/', url.origin);
    const card = new URL('/#' + slug, url.origin);

    if (!BOTS.test(request.headers.get('user-agent') || '')) {
      return new Response(null, { status: 302, headers: { location: card.href, 'cache-control': 'private, no-store', vary: 'User-Agent' } });
    }

    let found = null;
    try { found = findParlay(await loadSeason(url.origin), slug); } catch { /* fall back to the site preview */ }
    if (!found) return Response.redirect(home.href, 302);

    let taps = [], passes = [];
    try { const t = await readJson(`tails/w${found.week}.json`); taps = t?.tails?.[slug] || []; passes = t?.passes?.[slug] || []; } catch { /* none yet */ }
    const d = describe(found.week, found.p, taps, passes);
    const title = `${d.title} · ${d.odds ? 'Parlay ' + d.odds : 'Week ' + d.week}${d.status != 'OPEN' ? ' · ' + d.status : ''}`;
    const desc = d.legs.map(l => l.text).join(' · ');
    const img = new URL(`/api/og?slug=${slug}&v=${hash(d.version)}`, url.origin).href;
    const e = escapeHtml;

    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="9FEAMG">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(new URL('/p/' + slug, url.origin).href)}">
<meta property="og:image" content="${e(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${e(img)}">
</head><body><a href="${e(card.href)}">${e(title)}</a></body></html>`;

    return new Response(html, {
      // Never cache: bots and people get different responses from the same URL.
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', vary: 'User-Agent' }
    });
  }
};
