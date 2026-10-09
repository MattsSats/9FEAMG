// /api/og?slug=w4-the-truce : a 1200x630 preview image of one parlay's legs,
// drawn from the live data/season.js, so odds and HIT/MISS results show up
// without regenerating anything.
import { ImageResponse } from '@vercel/og';
import { loadSeason, findParlay, describe } from './_parlays.js';
import { readJson } from './_yahoo.js';
import { C, F, h, fonts } from './_ogkit.js';

// Open pills use surface2 so they stand out from the page instead of white on cream.
const TAG = { open: [C.surface2, C.muted, 'OPEN'], hit: [C.pos, C.onStatus, 'HIT'], miss: [C.neg, C.onStatus, 'MISS'] };
const STATUS = { OPEN: [C.surface2, C.muted], CASHED: [C.pos, C.onStatus], BUSTED: [C.neg, C.onStatus] };

const MAX_LEGS = 6;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const slug = (url.searchParams.get('slug') || '').replace(/[^\w-]/g, '');
    let found = null;
    try { found = findParlay(await loadSeason(url.origin), slug); } catch { /* handled below */ }
    if (!found) return Response.redirect(new URL('/og.png', url.origin).href, 302);

    let taps = [], passes = [];
    try { const t = await readJson(`tails/w${found.week}.json`); taps = t?.tails?.[slug] || []; passes = t?.passes?.[slug] || []; } catch { /* none yet */ }
    const d = describe(found.week, found.p, taps, passes);
    const shown = d.legs.slice(0, MAX_LEGS), extra = d.legs.length - shown.length;
    const [sBg, sFg] = STATUS[d.status];
    const { mono, display, sans } = F;

    const tight = shown.length > 4;
    const legRow = l => {
      const [bg, fg, label] = TAG[l.status] || TAG.open;
      return h('div', { alignItems: 'center', gap: 20, padding: tight ? '6px 0' : '13px 0', borderBottom: `2px solid ${C.line}` },
        h('div', { flex: 1, fontFamily: sans, fontSize: tight ? 25 : 30, fontWeight: 600, color: C.ink, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, l.text),
        l.odds ? h('div', { fontFamily: mono, fontSize: tight ? 22 : 26, fontWeight: 600, color: C.muted }, l.odds) : null,
        h('div', { width: 92, justifyContent: 'center', fontFamily: mono, fontSize: 18, fontWeight: 600, letterSpacing: 2, padding: '6px 0', borderRadius: 8, background: bg, color: fg }, label));
    };

    const card = h('div', { width: '100%', height: '100%', flexDirection: 'column', background: C.bg, color: C.ink, position: 'relative' },
      h('div', { flexDirection: 'column', flex: 1, padding: '48px 64px 0' },
        h('div', { justifyContent: 'space-between', alignItems: 'center' },
          h('div', { fontFamily: mono, fontSize: 22, fontWeight: 600, letterSpacing: 4, color: C.accentInk }, `${d.by.toUpperCase()} · WEEK ${d.week}`),
          h('div', { fontFamily: mono, fontSize: 20, fontWeight: 600, letterSpacing: 3, padding: '8px 18px', borderRadius: 999, background: sBg, color: sFg }, d.status)),
        h('div', { alignItems: 'baseline', gap: 24, marginTop: 14 },
          h('div', { fontFamily: display, fontSize: 80, fontWeight: 900, lineHeight: 1, textTransform: 'uppercase' }, d.title),
          h('div', { fontFamily: sans, fontSize: 28, fontWeight: 600, color: C.muted }, [d.who, `${d.legs.length} legs`].filter(Boolean).join(' · '))),
        h('div', { flexDirection: 'column', marginTop: tight ? 10 : 16 },
          shown.map(legRow),
          extra > 0 ? h('div', { fontFamily: mono, fontSize: 22, color: C.muted, paddingTop: 12 }, `+ ${extra} more`) : null)),
      h('div', { justifyContent: 'space-between', alignItems: 'center', padding: d.with.length ? '12px 64px 26px' : '20px 64px 34px', borderTop: `2px dashed ${C.line}`, marginTop: 'auto' },
        h('div', { flexDirection: 'column', gap: 4 },
        h('div', { alignItems: 'baseline', gap: 24 },
          // A finished ticket with a leg that was never priced has no total; say so instead of "lines TBD".
          h('div', { fontFamily: display, fontSize: 52, fontWeight: 900, lineHeight: 1 }, d.odds ? `PARLAY ${d.odds}` : d.status == 'OPEN' ? 'LINES TBD' : d.status),
          !d.odds && d.status != 'OPEN' ? h('div', { fontFamily: mono, fontSize: 24, fontWeight: 600, color: C.muted }, 'odds not recorded') : null,
          d.payout ? h('div', { fontFamily: mono, fontSize: 24, fontWeight: 600, color: C.muted }, `$10 ${d.status == 'CASHED' ? 'paid' : d.status == 'BUSTED' ? 'would have paid' : 'pays'} ${d.payout}` + (d.chance ? ` · ~${d.chance} to hit` : '')) : null),
          // Who's on it: "On it", or "Cashed with" / "Busted with" once it settles.
          d.with.length ? h('div', { fontFamily: mono, fontSize: 20, fontWeight: 600, letterSpacing: 1, color: C.accentInk }, `${d.status == 'CASHED' ? 'CASHED WITH' : d.status == 'BUSTED' ? 'BUSTED WITH' : 'ON IT'}: ${d.with.join(', ')}`) : null),
        h('div', { alignItems: 'flex-end', gap: 4 },
          h('div', { fontFamily: display, fontSize: 48, fontWeight: 900, lineHeight: 1 }, '9FEAMG'),
          h('div', { width: 12, height: 12, background: C.accent, marginBottom: 6 }))),
      h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: C.accent }));

    return new ImageResponse(card, {
      width: 1200, height: 630, fonts: await fonts(),
      headers: { 'cache-control': 'public, max-age=300, s-maxage=300' }
    });
  }
};
