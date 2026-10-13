// The Booth Board's data (the claude.ai mirror of the live week's scores and Booth lines), built
// from data/season.js. Writes it to a JSON file for the ArtifactData tool to `set` as board/current.
//
//   node scripts/board.js <out.json> [commit]
import fs from 'node:fs';
import vm from 'node:vm';

const [out, commit = ''] = process.argv.slice(2);
if (!out) { console.error('usage: node scripts/board.js <out.json> [commit]'); process.exit(1); }
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../data/season.js', import.meta.url), 'utf8'), box);
const S = box.window.SEASON;

// The live week, or the latest week with scores or Booth lines once the season moves on.
const has = w => S.booth?.[w]?.length || S.boothSnf?.[w]?.length || S.boothPreview?.[w]?.length;
const NF = Math.max(0, ...S.managers.map(x => (S.scores[x.m] || []).length));
const week = S.live?.week || NF || Math.max(0, ...Object.keys(S.schedule).map(Number).filter(has));
const live = S.live?.week == week;
const sc = m => live ? S.live.scores?.[m] || [0, 0] : [S.scores[m]?.[week - 1] ?? 0, S.scores[m]?.[week - 1] ?? 0];
const pairs = S.schedule[week] || [];
const set = lines => (lines || []).map((l, i) => ({ pair: pairs[i] || [l[0]], crest: l[0], text: l[1], at: l[2] || null, draft: l[3] == 'claude' }));
const previewAt = S.boothPreviewAt?.[week] ? S.boothPreviewAt[week] + 'T12:00:00-05:00' : null;

const board = {
  week,
  status: live ? S.live.status.replace(/^Live · /, 'Live · ') : 'Final',
  asOf: live ? S.live.asOf : null,
  managers: S.managers.map(({ m, init, hue }) => ({ m, init, hue })),
  games: pairs.map(([a, b]) => ({ pair: [a, b], a: sc(a), b: sc(b) })),
  booth: {
    Preview: set(S.boothPreview?.[week]).map(l => ({ ...l, at: l.at || previewAt })),
    'Post-SNF': set(S.boothSnf?.[week]),
    Recap: set(S.booth?.[week])
  },
  commit,
  syncedAt: new Date().toISOString()
};
fs.writeFileSync(out, JSON.stringify(board));
console.log(`Week ${week}: ${board.games.length} games, Booth ${Object.entries(board.booth).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
