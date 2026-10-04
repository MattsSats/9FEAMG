// 9FEAMG season data. This is the file to edit each week; the site recalculates
// standings, luck, all-play records and charts from it.
//
// Weekly routine:
//   During a live week  -> update `live.scores` and `live.playerPoints`.
//   When a week goes final:
//     1. append each manager's final score to `scores` (one number per week)
//     2. add the week's Yahoo box scores to uploads/9feamg-boxscores.json
//        (Max PF and bench points are calculated from them)
//     3. set `live` to the new week (add its matchups to `schedule`), or null
//     4. add a caption / booth lines for the week if you want them
//   Then commit and push. Data changes don't need `node build.cjs`.
window.SEASON = {
  year: 2026,
  regularSeasonWeeks: 14,
  playoffTeams: 6,
  faabBudget: 100,
  draftInfo: 'Sep 6 · 10-team snake · 15 rounds · Half-PPR',
  // Draft tab "Open tool" button. Set to null to hide the button.
  draftToolUrl: 'https://9feamg.grok.me/draft',

  // Display order and avatar color (hue 0-360) for each manager.
  managers: [
    { m: 'Tony', init: 'ASG', hue: 35 },
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
    1: [['Pablo', 'Matt'], ['Tony', 'Colin'], ['Tristan', 'Kurt'], ['Andy', 'Jerger'], ['Mr. G', 'DLin']],
    2: [['DLin', 'Kurt'], ['Tony', 'Mr. G'], ['Tristan', 'Jerger'], ['Matt', 'Andy'], ['Colin', 'Pablo']],
    3: [['Andy', 'Colin'], ['Tony', 'Pablo'], ['Tristan', 'Matt'], ['DLin', 'Jerger'], ['Kurt', 'Mr. G']],
    4: [['Tony', 'Andy'], ['Tristan', 'Colin'], ['Matt', 'DLin'], ['Jerger', 'Kurt'], ['Mr. G', 'Pablo']]
  },

  // Final scores (Yahoo, two decimals), one per completed week.
  scores: {
    Tony: [123.06, 154.52, 95.42],
    Tristan: [144.36, 104.10, 121.64],
    Andy: [139.34, 75.96, 127.98],
    Matt: [107.86, 105.64, 114.48],
    Kurt: [100.60, 89.36, 135.88],
    Jerger: [124.06, 92.60, 102.14],
    'Mr. G': [135.22, 84.42, 75.06],
    Colin: [65.66, 100.08, 124.14],
    DLin: [99.82, 100.56, 82.52],
    Pablo: [112.66, 70.92, 86.38]
  },

  // The week in progress. Set to null between weeks.
  live: {
    week: 4,
    status: 'Live · Sunday underway',
    // [current points, projected final]
    // Yahoo live projections as of Sun Oct 4, 11:32 AM CT.
    scores: {
      Matt: [9.10, 108.13], DLin: [32.40, 118.56],
      Tristan: [8.90, 110.91], Colin: [16.00, 120.77],
      Jerger: [0.00, 115.05], Kurt: [14.10, 112.25],
      Tony: [6.60, 105.74], Andy: [0.00, 116.62],
      'Mr. G': [0.00, 119.97], Pablo: [0.00, 106.63]
    },
    // Points for players whose games are final (starters and bench).
    playerPoints: {
      'KC Concepcion Jr.': 8.90,
      'Harold Fannin Jr.': 10.20,
      'Steelers': 6.00,
      'Jaylen Warren': 14.10,
      'Quinshon Judkins': 18.60,
      'Denzel Boston': 10.90,
      'DK Metcalf': 14.00
    },
    sheetNote: 'Live Sunday. Orange = final points; the rest are in progress or still to kick off.'
  },

  // Shown on the week after the live one.
  next: {
    week: 5,
    dates: 'Oct 8–12',
    note: 'Week 5 matchups post once Week 4 goes final. Plenty of time to set a lineup, Pablo.'
  },

  // Player projections for the live week, used when the roster file has none.
  // Fill in every manager's players or leave empty; a partial list makes one team look different.
  // Projected values show in gray with "proj" so they never read as live points.
  projections: {},

  // Wire tab: transactions newer than asOf minus windowDays show under "7 days".
  wire: { asOf: '2026-10-04T11:32:00', windowDays: 7 },

  // ---- Trash talk (hidden when the trashTalk setting is off) ----

  // Caption under the featured matchup, by week.
  captions: {
    1: 'Pablo held off Matt by 4.8. Pablo would like this one framed, since it may be a while.',
    2: 'DLin beat Kurt 100.6–89.4. Neither fan base was reached for comment.',
    3: 'Andy beat Colin by 3.9. Colin is expected to blame the kicker, the refs and Yahoo.',
    4: 'Matt 114.79, DLin 114.46. A 0.33 projection gap. DLin leads 10.20–6.00 after Thursday, and Matt only pulled ahead by benching an injured Justin Jefferson for Josh Downs.'
  },

  // "The Booth" lines by week: [manager, text].
  booth: {
    1: [
      ['Colin', 'Colin opened his season with 65.7. Tony thanks him for his service.'],
      ['Mr. G', 'Mr. G put up 135.2 in Week 1. Frame it. It has been downhill since.'],
      ['Jerger', 'Jerger scored 124.1 and lost. Some weeks the schedule picks you.'],
      ['Matt', 'Matt lost by 4.80 with Christian Watson’s 29.70 on his bench. DeVonta Smith started and scored 6.80. Unlucky is one word for it.']
    ],
    2: [
      ['Tony', 'Tony dropped 154.5 on Mr. G. Mr. G has asked that the tape not be shared.'],
      ['Andy', 'Andy scored 76.0. The gibbing has paused.'],
      ['Pablo', 'Pablo posted 70.9, lowest of the week. He was #1. Past tense.'],
      ['Jerger', 'Jerger lost by 11.50. Travis Kelce scored 20.60 on his bench while Malik Nabers started and scored 0.60.'],
      ['Colin', 'Colin benched Davante Adams for 35.50, the best bench score of the season. He won anyway, which will not help.']
    ],
    3: [
      ['Kurt', 'Kurt hung 135.9 on Mr. G, the top score of the week.'],
      ['Mr. G', 'Mr. G: 75.1, his second straight week under 85 and the lowest score of the week. The team name says Definitely not a Boomer. The box score disagrees.'],
      ['DLin', 'DLin managed 82.5. Toilet Bowl King is starting to look like a mission statement.'],
      ['Pablo', 'Pablo lost by 9.04 with Geno Smith (26.04) and Juwan Johnson (19.30) on his bench. Either one wins it.'],
      ['Matt', 'Christian Watson on Matt’s bench, again: 19.10 while Justin Jefferson started for 4.20. Matt lost by 7.16. Same lesson, Week 3 edition.'],
      ['Colin', 'Colin lost by 3.84 with Joe Burrow on his bench for 22.58. Patrick Mahomes started and scored 16.94.']
    ],
    4: [
      ['Matt', 'Quinshon Judkins scored 18.60 on Thursday from Matt’s bench. Matt would like that one back.'],
      ['Colin', 'Colin banked nothing on Thursday and is still projected to beat Tristan by 0.59. Tristan has 8.90 from KC Concepcion Jr. and trails by a rounding error.'],
      ['Tony', 'Tony is 3–0 and still projected to lose to Andy by 8.43. Respect remains pending.'],
      ['Kurt', 'Kurt and Jerger are both 1–2, and the loser falls to 1–3. Jaylen Warren’s 14.10 on Thursday cut Jerger’s projected edge to 2.27. Kurt would like a word with the projection.'],
      ['Mr. G', 'Pablo is projected for 88.77, lowest in the league. Mr. G is projected for 119.12, highest. The group-chat victory lap is already drafted.'],
      ['Colin', 'Colin made 6 adds this week alone, triple Tony’s total for the whole season. His only points so far: Denzel Boston, 10.90, on the bench.']
    ]
  },

  // The Booth Parlay, by week. Shows under All matchups, with a season ledger
  // ($10 flat stakes) underneath.
  //   legs[].text   what the bet is
  //   legs[].player Yahoo player name, or the team name for a defense/moneyline
  //                 ('Ravens'). The site tags whose fantasy roster it's on and
  //                 shows the player's fantasy points once they're in.
  //   legs[].type   'td' (anytime TD), 'over' (player stat; needs stat + line),
  //                 'ml' (moneyline) or 'total' (game points; needs side + line);
  //                 tells the weekly update how to grade the leg
  //   legs[].stat / legs[].line  for 'over' legs, e.g. stat 'Rec Yds', line 62.5
  //   legs[].side   'over' or 'under', for 'total' legs
  //   legs[].team   the team a moneyline is on, for game legs without a player
  //   legs[].teams  NFL teams in the game (['Jax', 'Cin']); the card lists the
  //                 managers starting someone in it
  //   owner         a manager, or anyone else (e.g. 'The Booth' with init 'TB')
  //   legs[].game   kickoff, e.g. 'Sun 12:00 PM vs TEN'
  //   legs[].result optional, replaces the kickoff once graded ('2 Rush TD')
  //   legs[].odds   American odds as text ('+120', '-150'); null until you have
  //                 real lines. Once every leg has odds, the combined parlay
  //                 odds and $10 payout calculate themselves.
  //   legs[].status 'open', 'hit' or 'miss'. Any miss = BUSTED, all hit = CASHED.
  //   tailers       managers riding along; tailing your own opponent shows HEDGE.
  //   booth         optional trash talk (hidden when trash talk is off).
  parlays: {
    4: [
      {
        owner: 'Andy',
        legs: [
          // Odds: DraftKings via ESPN odds/props pages, Fri Oct 2.
          { text: 'Jahmyr Gibbs anytime TD', player: 'Jahmyr Gibbs', type: 'td', game: 'Sun 7:20 PM @ CAR', odds: '-330', status: 'open' },
          { text: 'Drake London over 79.5 receiving yards', player: 'Drake London', type: 'over', stat: 'Rec Yds', line: 79.5, game: 'Mon 7:15 PM @ NO', odds: '-110', status: 'open' },
          { text: 'Ravens moneyline', player: 'Ravens', type: 'ml', game: 'Sun 12:00 PM vs TEN', odds: '-700', status: 'open' }
        ],
        tailers: ['Tony'],
        booth: 'Andy asked for a “lock parlay.” There is no such thing. Tony is tailing it and is also Andy’s opponent this week, so Tony cashes either way.'
      },
      {
        owner: 'Andy & Tony', owners: ['Andy', 'Tony'], init: 'A&T', title: 'The Truce',
        // Odds: DraftKings via ESPN props pages, Fri Oct 2.
        legs: [
          { text: 'Josh Allen anytime TD', player: 'Josh Allen', type: 'td', game: 'Sun 12:00 PM vs NE', odds: '-130', status: 'open' },
          { text: 'Jaxon Smith-Njigba over 91.5 receiving yards', player: 'Jaxon Smith-Njigba', type: 'over', stat: 'Rec Yds', line: 91.5, game: 'Sun 3:25 PM vs LAC', odds: '-112', status: 'open' },
          { text: 'D’Andre Swift anytime TD', player: "D'Andre Swift", type: 'td', game: 'Sun 12:00 PM vs NYJ', odds: '-115', status: 'open' },
          { text: 'Javonte Williams over 58.5 rushing yards', player: 'Javonte Williams', type: 'over', stat: 'Rush Yds', line: 58.5, game: 'Sun 12:00 PM @ HOU', odds: '-112', status: 'open' }
        ],
        booth: 'Opponents on Sunday, partners on the ticket. If all four hit, whoever loses the matchup still gets paid.'
      },
      {
        owner: 'Tristan & Colin', owners: ['Tristan', 'Colin'], init: 'T&C', title: 'Rounding Error',
        // Odds: DraftKings via ESPN props pages, Fri Oct 2.
        legs: [
          { text: 'Lamar Jackson anytime TD', player: 'Lamar Jackson', type: 'td', game: 'Sun 12:00 PM vs TEN', odds: '+240', status: 'open' },
          { text: 'Bijan Robinson over 88.5 rushing yards', player: 'Bijan Robinson', type: 'over', stat: 'Rush Yds', line: 88.5, game: 'Mon 7:15 PM @ NO', odds: '-111', status: 'open' },
          { text: 'Ja’Marr Chase over 84.5 receiving yards', player: "Ja'Marr Chase", type: 'over', stat: 'Rec Yds', line: 84.5, game: 'Sun 12:00 PM vs JAX', odds: '-110', status: 'open' },
          { text: 'Brock Bowers over 73.5 receiving yards', player: 'Brock Bowers', type: 'over', stat: 'Rec Yds', line: 73.5, game: 'Sun 3:25 PM vs KC', odds: '-111', status: 'open' }
        ],
        booth: 'Projected 0.59 apart, so they split the ticket down the middle. Lamar’s +240 touchdown is doing most of the heavy lifting.'
      },
      {
        owner: 'The Booth', init: 'TB',
        // Odds: ESPN odds page (DraftKings), Fri Oct 2. Noon CT kickoffs.
        legs: [
          { text: 'Jaguars–Bengals over 51.5', type: 'total', side: 'over', line: 51.5, teams: ['Jax', 'Cin'], game: 'Sun 12:00 PM · JAX @ CIN', odds: '-102', status: 'open' },
          { text: 'Cowboys moneyline at Texans', type: 'ml', team: 'Dal', teams: ['Dal', 'Hou'], game: 'Sun 12:00 PM · DAL @ HOU', odds: '+136', status: 'open' },
          { text: 'Packers moneyline at Buccaneers', type: 'ml', team: 'GB', teams: ['GB', 'TB'], game: 'Sun 12:00 PM · GB @ TB', odds: '-175', status: 'open' }
        ],
        tailers: ['Tony'],
        booth: 'The Booth’s noon special: the highest total on the early slate, a Cowboys upset that runs straight through Pablo’s QB and defense, and Matt’s Jordan Love against an 0–3 Bucs team. For fun, not a lock.'
      }
    ]
  },

  // One-liner on each team page.
  roasts: {
    Tony: '3–0 on 2 adds all season. Set it, forget it, collect wins.',
    Tristan: 'Undefeated and quiet about it. Suspicious.',
    Andy: 'Lost Week 2 with 76.0. Still has the second-best Max PF in the league.',
    Matt: 'Unluckiest manager in the league. Would like you to know that.',
    Kurt: 'Week 3 hero, Weeks 1 and 2 villain.',
    Jerger: 'Has left 64.6 points on the bench. The bench is having a great season.',
    'Mr. G': 'Most points allowed in the league by 36. Opponents save their best for him.',
    Colin: 'Twenty adds, one win. The grind continues.',
    DLin: 'Toilet Bowl King. Not a prediction, a title defense.',
    Pablo: 'Left 90.9 on the bench, the most in the league. Geno Smith alone had 26.04 of it.'
  }
};
