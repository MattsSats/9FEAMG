// Season numbers for the chart previews (api/section.js), worked out the same way the site
// does in src/logic.js: standings, xW and luck from data/season.js scores and schedule, and
// Max PF from the box scores in uploads/9feamg-boxscores.json.
const LINEUP = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'K', 'DEF'], FLEX = ['RB', 'WR', 'TE'];
function optimalLineup(players) {
  const pool = players.filter(p => p[0] != 'IR').map(p => ({ pos: p[3], pts: p[4] })).sort((a, b) => b.pts - a.pts);
  const take = ok => { const i = pool.findIndex(p => ok(p.pos)); return i < 0 ? 0 : pool.splice(i, 1)[0].pts; };
  return LINEUP.reduce((t, slot) => t + take(pos => pos == slot), 0) + take(pos => FLEX.includes(pos));
}

export function seasonStats(season, box) {
  const MGR = season.managers.map(x => x.m), SC = season.scores, PAIRS = season.schedule;
  const NF = Math.max(0, ...MGR.map(m => (SC[m] || []).length));
  const opp = (m, w) => { const p = (PAIRS[w] || []).find(p => p.includes(m)); return p ? (p[0] == m ? p[1] : p[0]) : null; };
  const rows = MGR.map(m => {
    let w = 0, l = 0, pf = 0, pa = 0, xw = 0, max = 0;
    for (let i = 1; i <= NF; i++) {
      const o = opp(m, i); if (!o) continue;
      const s = SC[m][i - 1];
      pf += s; pa += SC[o][i - 1];
      s > SC[o][i - 1] ? w++ : l++;
      xw += MGR.filter(x => x != m && SC[x][i - 1] < s).length / (MGR.length - 1);
      const bx = box?.weeks?.[i]?.[m];
      max = max == null || !bx ? null : max + optimalLineup([...bx.starters, ...bx.bench]);
    }
    const mg = season.managers.find(x => x.m == m);
    return { m, init: mg.init, hue: mg.hue, w, l, pf, pa, xw, luck: Math.round((w - xw) * 100) / 100, max };
  });
  return { NF, rows, maxOk: rows.every(r => r.max != null) };
}

export async function loadBox(origin) {
  try { const r = await fetch(new URL('/uploads/9feamg-boxscores.json', origin), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; }
}
