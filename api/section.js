// /s/<chart> (rewritten here by vercel.json) for the Season charts (luck, bench, pfpa), the
// Gameday parlay ledger (ledger) and matchups (w5-andy-vs-pablo).
// Link-preview bots get a page whose Open Graph tags point at a 1200x630 image of the chart
// (this same function with &img=1); people are sent to the chart on the site (/#<chart>).
// Numbers come from the live data/season.js and box scores, so the image is always current.
import { ImageResponse } from '@vercel/og';
import { loadSeason, escapeHtml, hash, anchorFor, describe } from './_parlays.js';
import { readJson } from './_yahoo.js';
import { seasonStats, loadBox } from './_stats.js';
import { C, F, h, fonts, mgrColor } from './_ogkit.js';

const BOTS = /bot|crawl|spider|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|whatsapp|telegram|linkedin|embedly|skype|iframely|preview/i;
const CHARTS = { luck: 'Luck', bench: 'Points left on bench', pfpa: 'Points for vs against', ledger: 'Parlay ledger' };
const f1 = n => n.toFixed(1), f2 = n => n.toFixed(2);
const money = n => (n < 0 ? '−' : n > 0 ? '+' : '') + '$' + Math.abs(n).toFixed(2);
const moneyCol = n => n > 0 ? C.pos : n < 0 ? C.neg : C.muted;
const sgn = n => n > 0 ? '+' + f2(n) : n < 0 ? '−' + f2(-n) : '0.00';

// The parlay ledger, counted like the site: each manager who placed or tailed a ticket (placedBy,
// tailers, "I'm on it" taps, minus "Didn't bet" passes) is one $10 bet; the rest is paper.
async function ledgerOf(season) {
  const all = { w: 0, l: 0, open: 0, net: 0 }, paper = { w: 0, l: 0, open: 0 }, by = {};
  for (const [week, list] of Object.entries(season.parlays || {})) {
    let t = null;
    try { t = await readJson(`tails/w${week}.json`); } catch { /* none saved */ }
    for (const p of list) {
      const slug = anchorFor(week, p), d = describe(week, p), k = d.status == 'CASHED' ? 'w' : d.status == 'BUSTED' ? 'l' : 'open';
      const passes = t?.passes?.[slug] || [];
      const who = [...new Set([...(p.placedBy || []), ...(p.tailers || []), ...(t?.tails?.[slug] || [])])].filter(m => !passes.includes(m));
      if (!who.length) { paper[k]++; continue; }
      const won = k == 'w' ? (d.payout ? +d.payout - 10 : 0) : k == 'l' ? -10 : 0;
      for (const m of who) {
        const o = by[m] ??= { m, w: 0, l: 0, open: 0, net: 0 };
        o[k]++; all[k]++; o.net += won; all.net += won;
      }
    }
  }
  return { all, paper, rows: Object.values(by).sort((a, b) => b.net - a.net || b.w - a.w || a.l - b.l) };
}

function ledgerCard(L, st) {
  const look = Object.fromEntries(st.rows.map(r => [r.m, r]));
  const tile = (label, value, color) => h('div', { flexDirection: 'column', padding: '16px 22px', borderRadius: 18, background: C.surface2 },
    h('div', { fontFamily: F.mono, fontSize: 18, fontWeight: 600, letterSpacing: 3, color: C.muted }, label),
    h('div', { fontFamily: F.display, fontSize: 64, fontWeight: 900, lineHeight: 1, marginTop: 8, color }, value));
  const rows = L.rows.slice(0, 8);
  return h('div', { gap: 40, marginTop: 26 },
    h('div', { flexDirection: 'column', gap: 12, width: 300 },
      tile('RECORD', `${L.all.w}–${L.all.l}`, C.ink), tile('NET', money(L.all.net), moneyCol(L.all.net)), tile('OPEN', String(L.all.open), C.ink)),
    h('div', { flexDirection: 'column', flex: 1 },
      rows.map(o => h('div', { alignItems: 'center', height: 46, borderTop: `2px solid ${C.line}` },
        h('div', { width: 34, height: 34, borderRadius: 999, background: look[o.m] ? mgrColor(look[o.m].hue) : C.muted, alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontSize: 15, fontWeight: 900, color: C.onAccent }, look[o.m]?.init || o.m.slice(0, 2).toUpperCase()),
        h('div', { flex: 1, marginLeft: 14, fontFamily: F.sans, fontSize: 26, fontWeight: 600, color: C.ink }, o.m),
        h('div', { width: 170, justifyContent: 'flex-end', fontFamily: F.mono, fontSize: 22, fontWeight: 600, color: C.muted }, `${o.w}–${o.l}` + (o.open ? ` · ${o.open} open` : '')),
        h('div', { width: 150, justifyContent: 'flex-end', fontFamily: F.mono, fontSize: 24, fontWeight: 600, color: moneyCol(o.net) }, money(o.net)))),
      rows.length ? null : h('div', { fontFamily: F.sans, fontSize: 26, color: C.muted, paddingTop: 12 }, 'Nobody has bet a ticket yet.'),
      L.paper.w + L.paper.l + L.paper.open ? h('div', { justifyContent: 'space-between', paddingTop: 12, borderTop: `2px dashed ${C.line}`, fontFamily: F.mono, fontSize: 18, fontWeight: 600, letterSpacing: 2, color: C.muted },
        h('div', {}, 'PAPER · NOBODY BET THESE'), h('div', {}, `${L.paper.w}–${L.paper.l}` + (L.paper.open ? ` · ${L.paper.open} open` : ''))) : null));
}

// One line for the chat preview text.
function summary(name, st, L) {
  if (name == 'ledger') {
    const bets = L.all.w + L.all.l + L.all.open, best = L.rows[0];
    return `${L.all.w}–${L.all.l} on ${bets} ${bets == 1 ? 'bet' : 'bets'}, ${money(L.all.net)} at $10 each.` + (best ? ` Best: ${best.m}, ${money(best.net)}.` : '') + (L.all.open ? ` ${L.all.open} still open.` : '');
  }
  const r = st.rows;
  if (name == 'luck') { const s = [...r].sort((a, b) => b.luck - a.luck); return `Luckiest: ${s[0].m} ${sgn(s[0].luck)}. Unluckiest: ${s.at(-1).m} ${sgn(s.at(-1).luck)}. Luck = real wins minus expected wins.`; }
  if (name == 'bench') { const s = [...r].sort((a, b) => (b.max - b.pf) - (a.max - a.pf)); return `Most left on the bench: ${s[0].m}, ${f1(s[0].max - s[0].pf)}. Least: ${s.at(-1).m}, ${f1(s.at(-1).max - s.at(-1).pf)}.`; }
  const pf = [...r].sort((a, b) => b.pf - a.pf)[0], pa = [...r].sort((a, b) => b.pa - a.pa)[0];
  return `Most points for: ${pf.m}, ${f1(pf.pf)}. Most points against: ${pa.m}, ${f1(pa.pa)}.`;
}

// Header shared by all of them: kicker, big title, a note on the right.
const header = (title, note, NF, kicker = 'SEASON') => h('div', { justifyContent: 'space-between', alignItems: 'flex-end' },
  h('div', { flexDirection: 'column' },
    h('div', { fontFamily: F.mono, fontSize: 22, fontWeight: 600, letterSpacing: 4, color: C.accentInk }, `${kicker} · THROUGH WEEK ${NF}`),
    h('div', { fontFamily: F.display, fontSize: 76, fontWeight: 900, lineHeight: 1, marginTop: 10, textTransform: 'uppercase', color: C.ink }, title)),
  note);

const nameCell = m => h('div', { width: 150, fontFamily: F.sans, fontSize: 25, fontWeight: 600, color: C.ink }, m);

function luckChart(st) {
  const rows = [...st.rows].sort((a, b) => b.luck - a.luck), max = Math.max(0.01, ...rows.map(r => Math.abs(r.luck)));
  return h('div', { flexDirection: 'column', gap: 7, marginTop: 22 }, rows.map(r => h('div', { alignItems: 'center', height: 32 },
    nameCell(r.m),
    h('div', { flex: 1, height: 26, justifyContent: 'flex-end', borderRight: `2px solid ${C.muted}` },
      r.luck < 0 ? h('div', { width: `${-r.luck / max * 100}%`, height: '100%', background: C.neg, borderRadius: '6px 0 0 6px' }) : null),
    h('div', { flex: 1, height: 26 },
      r.luck > 0 ? h('div', { width: `${r.luck / max * 100}%`, height: '100%', background: C.pos, borderRadius: '0 6px 6px 0' }) : null),
    h('div', { width: 120, justifyContent: 'flex-end', fontFamily: F.mono, fontSize: 24, fontWeight: 600, color: r.luck > 0 ? C.pos : r.luck < 0 ? C.neg : C.muted }, sgn(r.luck)))));
}

function benchChart(st) {
  const rows = [...st.rows].sort((a, b) => (b.max - b.pf) - (a.max - a.pf)), top = Math.max(...rows.map(r => r.max));
  return h('div', { flexDirection: 'column', gap: 7, marginTop: 22 }, rows.map(r => h('div', { alignItems: 'center', height: 32 },
    nameCell(r.m),
    h('div', { flex: 1, height: 26, borderRadius: 6, overflow: 'hidden', background: C.surface2 },
      h('div', { width: `${r.pf / top * 100}%`, height: '100%', background: C.muted }),
      h('div', { width: `${(r.max - r.pf) / top * 100}%`, height: '100%', backgroundImage: `repeating-linear-gradient(135deg, ${C.accent} 0px, ${C.accent} 6px, transparent 6px, transparent 12px)` })),
    h('div', { width: 120, justifyContent: 'flex-end', fontFamily: F.mono, fontSize: 24, fontWeight: 600, color: C.accentInk }, f1(r.max - r.pf)))));
}

function pfpaChart(st) {
  const r = st.rows, pfs = r.map(x => x.pf), pas = r.map(x => x.pa);
  const x0 = Math.floor(Math.min(...pfs) / 10) * 10 - 5, x1 = Math.ceil(Math.max(...pfs) / 10) * 10 + 5;
  // Extra room above and below keeps the top and bottom dots clear of the corner labels.
  const y0 = Math.floor(Math.min(...pas) / 10) * 10 - 45, y1 = Math.ceil(Math.max(...pas) / 10) * 10 + 45;
  const W = 1010, H = 360, D = 50, avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  // Nudge overlapping dots apart, as the site does.
  const pts = r.map(x => ({ x: (x.pf - x0) / (x1 - x0), y: (y1 - x.pa) / (y1 - y0) })), DX = (D + 6) / W, DY = (D + 6) / H;
  for (let it = 0; it < 80; it++) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j], dx = (b.x - a.x) / DX, dy = (b.y - a.y) / DY, d = Math.hypot(dx, dy);
    if (d >= 1) continue;
    const push = (1 - d) / 2, ux = d ? dx / d : 1, uy = d ? dy / d : 0;
    a.x -= ux * push * DX; b.x += ux * push * DX; a.y -= uy * push * DY; b.y += uy * push * DY;
  }
  const clamp = v => Math.min(0.96, Math.max(0.04, v));
  const corner = (text, color, pos) => h('div', { position: 'absolute', ...pos, fontFamily: F.mono, fontSize: 16, fontWeight: 600, letterSpacing: 2, color }, text);
  const axis = (text, pos) => h('div', { position: 'absolute', ...pos, fontFamily: F.mono, fontSize: 16, fontWeight: 600, color: C.muted }, text);
  return h('div', { position: 'relative', width: W, height: H, marginTop: 26, marginLeft: 60, borderLeft: `2px solid ${C.line}`, borderBottom: `2px solid ${C.line}` },
    h('div', { position: 'absolute', left: `${(avg(pfs) - x0) / (x1 - x0) * 100}%`, top: 0, bottom: 0, borderLeft: `2px dashed ${C.line}` }),
    h('div', { position: 'absolute', top: `${(y1 - avg(pas)) / (y1 - y0) * 100}%`, left: 0, right: 0, borderTop: `2px dashed ${C.line}` }),
    corner('BAD AND CURSED', C.neg, { left: 12, top: 10 }), corner('GOOD, CURSED', C.muted, { right: 12, top: 10 }),
    corner('BAD, LUCKY', C.muted, { left: 12, bottom: 10 }), corner('GOOD AND LUCKY', C.pos, { right: 12, bottom: 10 }),
    axis(String(y1), { left: -56, top: -4 }), axis(String(y0), { left: -56, bottom: -4 }), axis('PA ↑', { left: -56, top: H / 2 - 10 }),
    axis(String(x0), { left: -4, bottom: -28 }), axis(String(x1), { right: -4, bottom: -28 }), axis('PF →', { left: W / 2 - 20, bottom: -28 }),
    r.map((x, i) => h('div', { position: 'absolute', left: clamp(pts[i].x) * W - D / 2, top: clamp(pts[i].y) * H - D / 2, width: D, height: D, borderRadius: 999, border: `3px solid ${C.bg}`, background: mgrColor(x.hue), alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontSize: x.init.length > 2 ? 17 : 21, fontWeight: 900, color: C.onAccent }, x.init)));
}

async function image(name, st, L, LW) {
  const note = name == 'ledger' ? h('div', { fontFamily: F.mono, fontSize: 22, fontWeight: 600, color: C.muted, marginBottom: 8 }, '$10 a bet')
    : name == 'luck' ? h('div', { fontFamily: F.mono, fontSize: 22, fontWeight: 600, color: C.muted, marginBottom: 8 }, 'W − xW')
    : name == 'bench' ? h('div', { gap: 22, fontFamily: F.mono, fontSize: 20, fontWeight: 600, color: C.muted, marginBottom: 8 },
      h('div', { alignItems: 'center', gap: 8 }, h('div', { width: 18, height: 18, borderRadius: 4, background: C.muted }), 'Scored'),
      h('div', { alignItems: 'center', gap: 8 }, h('div', { width: 18, height: 18, borderRadius: 4, background: C.accent }), 'Left on bench'))
    : h('div', { fontFamily: F.mono, fontSize: 22, fontWeight: 600, color: C.muted, marginBottom: 8 }, 'Dashed lines: league average');
  const body = name == 'ledger' ? ledgerCard(L, st) : name == 'luck' ? luckChart(st) : name == 'bench' ? benchChart(st) : pfpaChart(st);
  const card = h('div', { width: '100%', height: '100%', flexDirection: 'column', background: C.bg, padding: '40px 64px 0', position: 'relative' },
    name == 'ledger' ? header(CHARTS[name], note, LW, 'PARLAYS') : header(CHARTS[name], note, st.NF), body,
    h('div', { position: 'absolute', right: 64, top: 40, alignItems: 'flex-end', gap: 4 },
      h('div', { fontFamily: F.display, fontSize: 40, fontWeight: 900, lineHeight: 1, color: C.ink }, '9FEAMG'),
      h('div', { width: 10, height: 10, background: C.accent, marginBottom: 5 })),
    h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: C.accent }));
  return new ImageResponse(card, { width: 1200, height: 630, fonts: await fonts(), headers: { 'cache-control': 'public, max-age=300, s-maxage=300' } });
}

// ---- Matchup previews: /s/w5-andy-vs-pablo (the Gameday "Your matchup" card's Share link) ----
const slugOf = m => m.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SHIELD = 'M24 2.5 L42.5 8 V22.5 C42.5 34 34.5 41.5 24 46 C13.5 41.5 5.5 34 5.5 22.5 V8 Z';
const crest = (mg, size) => h('div', { position: 'relative', width: size, height: size, alignItems: 'center', justifyContent: 'center' },
  { type: 'svg', props: { width: size, height: size, viewBox: '0 0 48 48', style: { position: 'absolute', left: 0, top: 0 }, children: { type: 'path', props: { d: SHIELD, fill: mgrColor(mg.hue) } } } },
  h('div', { fontFamily: F.display, fontSize: Math.round(size * (mg.init.length > 2 ? 0.3 : 0.38)), fontWeight: 900, color: C.onAccent, marginTop: -Math.round(size * 0.04) }, mg.init));

// Everything one matchup card shows, from data/season.js: live projections for the live week,
// final scores for a finished one.
function matchupOf(season, st, wk, aSlug, bSlug) {
  const mgs = season.managers, find = s => mgs.find(x => slugOf(x.m) == s);
  const A = find(aSlug), B = find(bSlug);
  if (!A || !B || !(season.schedule?.[wk] || []).some(p => p.includes(A.m) && p.includes(B.m))) return null;
  const live = season.live?.week == wk, NF = st.NF;
  if (!live && wk > NF) return null;
  const order = [...st.rows].sort((x, y) => y.w - x.w || y.pf - x.pf), place = m => order.findIndex(r => r.m == m) + 1;
  const ord = n => n + (n % 10 == 1 && n % 100 != 11 ? 'st' : n % 10 == 2 && n % 100 != 12 ? 'nd' : n % 10 == 3 && n % 100 != 13 ? 'rd' : 'th');
  const side = mg => {
    const r = st.rows.find(x => x.m == mg.m);
    const [now, proj] = live ? (season.live.scores?.[mg.m] || [0, 0]) : [null, season.scores[mg.m][wk - 1]];
    return { ...mg, rec: `${r.w}–${r.l} · ${ord(place(mg.m))}`, now, score: proj };
  };
  const a = side(A), b = side(B), lead = a.score == b.score ? null : a.score > b.score ? a : b, gap = Math.abs(a.score - b.score);
  const chip = lead ? (live ? `${lead.m} +${gap.toFixed(2)} proj` : `${lead.m} won by ${gap.toFixed(2)}`) : live ? 'Even on projection' : 'Tied';
  const lines = (live ? season.boothPreview?.[wk] : season.booth?.[wk]) || season.boothPreview?.[wk] || [];
  const booth = (lines.find(([m]) => m == A.m || m == B.m) || [])[1] || '';
  const asOf = live && season.live.asOf ? new Date(season.live.asOf).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).replace(',', '') : '';
  return { wk, live, a, b, chip, booth, asOf };
}

function matchupCard(M) {
  const row = s => h('div', { alignItems: 'center', height: 132, borderTop: `2px solid ${C.line}` },
    crest(s, 92),
    h('div', { flexDirection: 'column', flex: 1, marginLeft: 26 },
      h('div', { fontFamily: F.sans, fontSize: 46, fontWeight: 600, color: C.ink, lineHeight: 1.05 }, s.m),
      h('div', { fontFamily: F.mono, fontSize: 22, fontWeight: 600, color: C.muted, marginTop: 6 }, s.rec)),
    M.live ? h('div', { width: 170, justifyContent: 'flex-end', fontFamily: F.mono, fontSize: 30, fontWeight: 600, color: C.muted }, s.now.toFixed(2)) : null,
    h('div', { width: 300, justifyContent: 'flex-end', fontFamily: F.display, fontSize: 104, fontWeight: 900, lineHeight: 1, color: s == (M.a.score >= M.b.score ? M.a : M.b) ? C.ink : C.muted }, s.score.toFixed(2)));
  return h('div', { width: '100%', height: '100%', flexDirection: 'column', background: C.bg, padding: '40px 64px 0', position: 'relative' },
    h('div', { justifyContent: 'space-between', alignItems: 'flex-start' },
      h('div', { fontFamily: F.mono, fontSize: 22, fontWeight: 600, letterSpacing: 4, color: C.accentInk }, `WEEK ${M.wk} · ${M.live ? 'LIVE' + (M.asOf ? ' · AS OF ' + M.asOf.toUpperCase() : '') : 'FINAL'}`),
      h('div', { alignItems: 'flex-end', gap: 4 },
        h('div', { fontFamily: F.display, fontSize: 40, fontWeight: 900, lineHeight: 1, color: C.ink }, '9FEAMG'),
        h('div', { width: 10, height: 10, background: C.accent, marginBottom: 5 }))),
    h('div', { justifyContent: 'flex-end', gap: 0, marginTop: 18, fontFamily: F.mono, fontSize: 20, fontWeight: 600, letterSpacing: 3, color: C.muted },
      M.live ? h('div', { width: 170, justifyContent: 'flex-end' }, 'NOW') : null,
      h('div', { width: 300, justifyContent: 'flex-end' }, M.live ? 'PROJ' : 'FINAL')),
    h('div', { flexDirection: 'column', marginTop: 8 }, row(M.a), row(M.b)),
    h('div', { marginTop: 18, borderTop: `2px solid ${C.line}`, paddingTop: 18 },
      h('div', { fontFamily: F.mono, fontSize: 26, fontWeight: 600, color: C.ink, padding: '8px 16px', borderRadius: 10, background: C.surface2, border: `2px solid ${C.line}` }, M.chip)),
    // The Booth's line on this matchup, up to three lines.
    M.booth ? h('div', { marginTop: 14, maxHeight: 96, overflow: 'hidden', fontFamily: F.sans, fontSize: 24, fontWeight: 600, lineHeight: 1.3, color: C.muted }, M.booth) : null,
    h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: C.accent }));
}

async function matchupRoute(url, request, m) {
  const wk = +m[1], dest = new URL('/#w' + wk, url.origin).href, fallback = () => Response.redirect(new URL('/og.png', url.origin).href, 302);
  const isImg = url.searchParams.has('img');
  if (!isImg && !BOTS.test(request.headers.get('user-agent') || '')) {
    return new Response(null, { status: 302, headers: { location: dest, 'cache-control': 'private, no-store', vary: 'User-Agent' } });
  }
  let M;
  try { const season = await loadSeason(url.origin); M = matchupOf(season, seasonStats(season, null), wk, m[2], m[3]); } catch { return fallback(); }
  if (!M) return isImg ? fallback() : Response.redirect(dest, 302);
  if (isImg) return new ImageResponse(matchupCard(M), { width: 1200, height: 630, fonts: await fonts(), headers: { 'cache-control': 'public, max-age=300, s-maxage=300' } });
  const name = m[0], e = escapeHtml;
  const title = `${M.a.m} vs ${M.b.m} · Week ${wk}${M.live ? ' · live' : ' · final'} · 9FEAMG`;
  const score = s => M.live ? `${s.m} ${s.now.toFixed(2)} now, ${s.score.toFixed(2)} projected` : `${s.m} ${s.score.toFixed(2)}`;
  const desc = `${score(M.a)}; ${score(M.b)}. ${M.chip}.` + (M.booth ? ' ' + M.booth : '');
  const img = new URL(`/api/section?name=${name}&img=1&v=${hash(JSON.stringify([M.a.now, M.a.score, M.b.now, M.b.score, M.asOf]))}`, url.origin).href;
  return new Response(`<!doctype html><html><head><meta charset="utf-8">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="9FEAMG">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(new URL('/s/' + name, url.origin).href)}">
<meta property="og:image" content="${e(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
</head><body><a href="/#w${wk}">${e(title)}</a></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', vary: 'User-Agent' } });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const name = url.searchParams.get('name') || '';
    const mm = name.match(/^w(\d+)-([a-z0-9-]+?)-vs-([a-z0-9-]+)$/);
    if (mm) return matchupRoute(url, request, mm);
    if (!CHARTS[name]) return Response.redirect(new URL('/', url.origin).href, 302);
    const isImg = url.searchParams.has('img');
    if (!isImg && !BOTS.test(request.headers.get('user-agent') || '')) {
      return new Response(null, { status: 302, headers: { location: new URL('/#' + name, url.origin).href, 'cache-control': 'private, no-store', vary: 'User-Agent' } });
    }
    let st, L = null, LW;
    try {
      const season = await loadSeason(url.origin);
      st = seasonStats(season, await loadBox(url.origin));
      LW = season.live?.week ?? st.NF;
      if (name == 'ledger') L = await ledgerOf(season);
    } catch { return Response.redirect(new URL('/og.png', url.origin).href, 302); }
    if (name == 'bench' && !st.maxOk) return isImg ? Response.redirect(new URL('/og.png', url.origin).href, 302) : Response.redirect(new URL('/#bench', url.origin).href, 302);
    if (isImg) return image(name, st, L, LW);

    const title = `${CHARTS[name]} · through week ${name == 'ledger' ? LW : st.NF} · 9FEAMG`, desc = summary(name, st, L), e = escapeHtml;
    const v = hash(JSON.stringify(name == 'ledger' ? L : st.rows.map(r => [r.pf, r.pa, r.luck, r.max])));
    const img = new URL(`/api/section?name=${name}&img=1&v=${v}`, url.origin).href;
    return new Response(`<!doctype html><html><head><meta charset="utf-8">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="9FEAMG">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(new URL('/s/' + name, url.origin).href)}">
<meta property="og:image" content="${e(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
</head><body><a href="/#${name}">${e(title)}</a></body></html>`, {
      // Bots and people share this URL, so never let the CDN hand the bot page to a person.
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', vary: 'User-Agent' } });
  }
};
