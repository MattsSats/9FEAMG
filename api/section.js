// /s/<chart> (rewritten here by vercel.json) for the Season charts: luck, bench, pfpa.
// Link-preview bots get a page whose Open Graph tags point at a 1200x630 image of the chart
// (this same function with &img=1); people are sent to the chart on the site (/#<chart>).
// Numbers come from the live data/season.js and box scores, so the image is always current.
import { ImageResponse } from '@vercel/og';
import { loadSeason, escapeHtml, hash } from './_parlays.js';
import { seasonStats, loadBox } from './_stats.js';
import { C, F, h, fonts, mgrColor } from './_ogkit.js';

const BOTS = /bot|crawl|spider|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|whatsapp|telegram|linkedin|embedly|skype|iframely|preview/i;
const CHARTS = { luck: 'Luck', bench: 'Points left on bench', pfpa: 'Points for vs against' };
const f1 = n => n.toFixed(1), f2 = n => n.toFixed(2);
const sgn = n => n > 0 ? '+' + f2(n) : n < 0 ? '−' + f2(-n) : '0.00';

// One line for the chat preview text.
function summary(name, st) {
  const r = st.rows;
  if (name == 'luck') { const s = [...r].sort((a, b) => b.luck - a.luck); return `Luckiest: ${s[0].m} ${sgn(s[0].luck)}. Unluckiest: ${s.at(-1).m} ${sgn(s.at(-1).luck)}. Luck = real wins minus expected wins.`; }
  if (name == 'bench') { const s = [...r].sort((a, b) => (b.max - b.pf) - (a.max - a.pf)); return `Most left on the bench: ${s[0].m}, ${f1(s[0].max - s[0].pf)}. Least: ${s.at(-1).m}, ${f1(s.at(-1).max - s.at(-1).pf)}.`; }
  const pf = [...r].sort((a, b) => b.pf - a.pf)[0], pa = [...r].sort((a, b) => b.pa - a.pa)[0];
  return `Most points for: ${pf.m}, ${f1(pf.pf)}. Most points against: ${pa.m}, ${f1(pa.pa)}.`;
}

// Header shared by all three: kicker, big title, a note on the right.
const header = (title, note, NF) => h('div', { justifyContent: 'space-between', alignItems: 'flex-end' },
  h('div', { flexDirection: 'column' },
    h('div', { fontFamily: F.mono, fontSize: 22, fontWeight: 600, letterSpacing: 4, color: C.accentInk }, `SEASON · THROUGH WEEK ${NF}`),
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

async function image(name, st) {
  const note = name == 'luck' ? h('div', { fontFamily: F.mono, fontSize: 22, fontWeight: 600, color: C.muted, marginBottom: 8 }, 'W − xW')
    : name == 'bench' ? h('div', { gap: 22, fontFamily: F.mono, fontSize: 20, fontWeight: 600, color: C.muted, marginBottom: 8 },
      h('div', { alignItems: 'center', gap: 8 }, h('div', { width: 18, height: 18, borderRadius: 4, background: C.muted }), 'Scored'),
      h('div', { alignItems: 'center', gap: 8 }, h('div', { width: 18, height: 18, borderRadius: 4, background: C.accent }), 'Left on bench'))
    : h('div', { fontFamily: F.mono, fontSize: 22, fontWeight: 600, color: C.muted, marginBottom: 8 }, 'Dashed lines: league average');
  const body = name == 'luck' ? luckChart(st) : name == 'bench' ? benchChart(st) : pfpaChart(st);
  const card = h('div', { width: '100%', height: '100%', flexDirection: 'column', background: C.bg, padding: '40px 64px 0', position: 'relative' },
    header(CHARTS[name], note, st.NF), body,
    h('div', { position: 'absolute', right: 64, top: 40, alignItems: 'flex-end', gap: 4 },
      h('div', { fontFamily: F.display, fontSize: 40, fontWeight: 900, lineHeight: 1, color: C.ink }, '9FEAMG'),
      h('div', { width: 10, height: 10, background: C.accent, marginBottom: 5 })),
    h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: C.accent }));
  return new ImageResponse(card, { width: 1200, height: 630, fonts: await fonts(), headers: { 'cache-control': 'public, max-age=300, s-maxage=300' } });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const name = url.searchParams.get('name') || '';
    if (!CHARTS[name]) return Response.redirect(new URL('/', url.origin).href, 302);
    const isImg = url.searchParams.has('img');
    if (!isImg && !BOTS.test(request.headers.get('user-agent') || '')) {
      return new Response(null, { status: 302, headers: { location: new URL('/#' + name, url.origin).href, 'cache-control': 'private, no-store', vary: 'User-Agent' } });
    }
    let st;
    try { st = seasonStats(await loadSeason(url.origin), await loadBox(url.origin)); } catch { return Response.redirect(new URL('/og.png', url.origin).href, 302); }
    if (name == 'bench' && !st.maxOk) return isImg ? Response.redirect(new URL('/og.png', url.origin).href, 302) : Response.redirect(new URL('/#bench', url.origin).href, 302);
    if (isImg) return image(name, st);

    const title = `${CHARTS[name]} · through week ${st.NF} · 9FEAMG`, desc = summary(name, st), e = escapeHtml;
    const img = new URL(`/api/section?name=${name}&img=1&v=${hash(JSON.stringify(st.rows.map(r => [r.pf, r.pa, r.luck, r.max])))}`, url.origin).href;
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
