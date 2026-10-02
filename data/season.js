// 9FEAMG season data. This is the file to edit each week; the site recalculates
// standings, luck, all-play records and charts from it.
//
// Weekly routine:
//   During a live week  -> update `live.scores` and `live.playerPoints`.
//   When a week goes final:
//     1. append each manager's final score to `scores` (one number per week)
//     2. set `maxPF` to each manager's season Max PF from Yahoo
//     3. set `live` to the new week (add its matchups to `schedule`), or null
//     4. add a caption / booth lines for the week if you want them
//   Then commit and push. Data changes don't need `node build.js`.
window.SEASON = {
  year: 2026,
  regularSeasonWeeks: 14,
  playoffTeams: 6,
  faabBudget: 100,
  draftInfo: 'Sep 6 · 10-team snake · 15 rounds · Half-PPR',

  // Display order and avatar color (hue 0-360) for each manager.
  managers: [
    { m: 'ASG', init: 'AS', hue: 35 },
    { m: 'Tristan', init: 'TR', hue: 250 },
    { m: 'Andy', init: 'AN', hue: 150 },
    { m: 'Matt', init: 'MA', hue: 305 },
    { m: 'Kurt', init: 'KU', hue: 95 },
    { m: 'Jerger', init: 'JJ', hue: 205 },
    { m: 'Mr. G', init: 'MG', hue: 0 },
    { m: 'Colin', init: 'CO', hue: 125 },
    { m: 'DLin', init: 'DL', hue: 340 },
    { m: 'Pablo', init: 'PA', hue: 65 }
  ],

  // Matchups by week.
  schedule: {
    1: [['Pablo', 'Matt'], ['ASG', 'Colin'], ['Tristan', 'Kurt'], ['Andy', 'Jerger'], ['Mr. G', 'DLin']],
    2: [['DLin', 'Kurt'], ['ASG', 'Mr. G'], ['Tristan', 'Jerger'], ['Matt', 'Andy'], ['Colin', 'Pablo']],
    3: [['Andy', 'Colin'], ['ASG', 'Pablo'], ['Tristan', 'Matt'], ['DLin', 'Jerger'], ['Kurt', 'Mr. G']],
    4: [['ASG', 'Andy'], ['Tristan', 'Colin'], ['Matt', 'DLin'], ['Jerger', 'Kurt'], ['Mr. G', 'Pablo']]
  },

  // Final scores, one per completed week.
  scores: {
    ASG: [123.1, 154.5, 95.4],
    Tristan: [144.4, 104.1, 121.6],
    Andy: [139.3, 76.0, 128.0],
    Matt: [107.9, 105.6, 114.5],
    Kurt: [100.6, 89.4, 135.9],
    Jerger: [124.1, 92.6, 102.1],
    'Mr. G': [135.2, 84.4, 75.1],
    Colin: [65.7, 100.1, 124.1],
    DLin: [99.8, 100.6, 82.5],
    Pablo: [112.7, 70.9, 86.4]
  },

  // Season Max PF through the last final week (from Yahoo).
  maxPF: {
    ASG: 420.9, Tristan: 396.9, Andy: 411.9, Matt: 398.9, Kurt: 345.4,
    Jerger: 383.4, 'Mr. G': 357.2, Colin: 357.2, DLin: 354.9, Pablo: 360.8
  },

  // The week in progress. Set to null between weeks.
  live: {
    week: 4,
    status: 'Live · TNF final · Sunday to come',
    // [current points, projected final]
    scores: {
      Matt: [6.00, 117.88], DLin: [10.20, 114.39],
      Tristan: [8.90, 111.52], Colin: [0, 111.42],
      Jerger: [0, 113.79], Kurt: [14.10, 109.08],
      ASG: [0, 107.79], Andy: [0, 116.74],
      'Mr. G': [0, 118.23], Pablo: [0, 93.17]
    },
    // Points for players whose games are final.
    playerPoints: {
      'KC Concepcion Jr.': 8.90,
      'Harold Fannin Jr.': 9.48,
      'Steelers': 6.00
    },
    sheetNote: 'Live after TNF. Orange = final points; the rest kick off Sunday.'
  },

  // Shown on the week after the live one.
  next: {
    week: 5,
    dates: 'Oct 8–12',
    note: 'Week 5 matchups post once Week 4 goes final. Plenty of time to set a lineup, Pablo.'
  },

  // Player projections for the live week, used when the roster file has none.
  projections: {
    'Josh Allen': 23.1, 'Omarion Hampton': 10.3, 'TreVeyon Henderson': 9.0,
    'Jaxon Smith-Njigba': 17.9, 'Matthew Golden': 10.4, 'Dalton Kincaid': 9.8,
    'Bucky Irving': 12.3, 'Jason Myers': 8.8, 'Eagles': 5.1
  },

  // Wire tab: transactions newer than asOf minus windowDays show under "7 days".
  wire: { asOf: '2026-10-01T23:59:00', windowDays: 7 },

  // ---- Trash talk (hidden when the trashTalk setting is off) ----

  // Caption under the featured matchup, by week.
  captions: {
    1: 'Pablo held off Matt by 4.8. Pablo would like this one framed, since it may be a while.',
    2: 'DLin beat Kurt 100.6–89.4. Neither fan base was reached for comment.',
    3: 'Andy beat Colin by 3.9. Colin has already blamed the kicker, the refs and Yahoo.',
    4: 'Tristan 111.52, Colin 111.42. A 0.10 projection gap after TNF. Tristan banked 8.90 from KC Concepcion Jr. Colin banked nothing and is still projected to lose by a rounding error.'
  },

  // "The Booth" lines by week: [manager, text].
  booth: {
    1: [
      ['Colin', 'Colin opened his season with 65.7. ASG thanks him for his service.'],
      ['Mr. G', 'Mr. G put up 135.2 in Week 1. Frame it. It has been downhill since.'],
      ['Jerger', 'Jerger scored 124.1 and lost. Some weeks the schedule picks you.']
    ],
    2: [
      ['ASG', 'ASG dropped 154.5 on Mr. G. Mr. G has asked that the tape not be shared.'],
      ['Andy', 'Andy scored 76.0. The gibbing has paused.'],
      ['Pablo', 'Pablo posted 70.9, lowest of the week. He was #1. Past tense.']
    ],
    3: [
      ['Kurt', 'Kurt hung 135.9 on Mr. G, the top score of the week.'],
      ['Mr. G', 'Mr. G: 75.1, his second straight week under 85. The team name says Definitely not a Boomer. The box score disagrees.'],
      ['DLin', 'DLin managed 82.5. Toilet Bowl King is starting to look like a mission statement.']
    ],
    4: [
      ['Matt', 'The Steelers D gave Matt 6.00 on Thursday. He trails DLin 10.20–6.00 but is projected to win by 3.49. Matt would like the projection read aloud.'],
      ['ASG', 'ASG is 3–0 and still projected to lose to Andy by 8.95. Respect remains pending.'],
      ['Kurt', 'Kurt and Jerger are both 1–2, and the loser falls to 1–3. Yahoo has Jerger by 4.71. Kurt hung 135.9 last week and would like a word with the projection.'],
      ['Mr. G', 'Pablo is projected for 93.17, lowest in the league. Mr. G is projected for 118.23, highest. The group-chat victory lap is already drafted.'],
      ['Colin', 'Colin has made 20 adds this season. The waiver wire has asked for a restraining order.']
    ]
  },

  // One-liner on each team page.
  roasts: {
    ASG: '3–0 on 2 adds all season. Set it, forget it, collect wins.',
    Tristan: 'Undefeated and quiet about it. Suspicious.',
    Andy: 'Lost Week 2 with 76.0. Still has the second-best Max PF in the league.',
    Matt: 'Unluckiest manager in the league. Would like you to know that.',
    Kurt: 'Week 3 hero, Weeks 1 and 2 villain.',
    Jerger: 'Has left 64.6 points on the bench. The bench is having a great season.',
    'Mr. G': 'Most points allowed in the league by 36. Opponents save their best for him.',
    Colin: 'Twenty adds, one win. The grind continues.',
    DLin: 'Toilet Bowl King. Not a prediction, a title defense.',
    Pablo: 'Left 90.8 on the bench. Most in the league, by a lot.'
  }
};
