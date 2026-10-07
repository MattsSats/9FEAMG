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
    4: [['Tony', 'Andy'], ['Tristan', 'Colin'], ['Matt', 'DLin'], ['Jerger', 'Kurt'], ['Mr. G', 'Pablo']],
    5: [['Matt', 'Kurt'], ['Tristan', 'Tony'], ['Jerger', 'Mr. G'], ['Colin', 'DLin'], ['Andy', 'Pablo']]
  },

  // Final scores (Yahoo, two decimals), one per completed week.
  scores: {
    Tony: [123.06, 154.52, 95.42, 90.82],
    Tristan: [144.36, 104.10, 121.64, 125.88],
    Andy: [139.34, 75.96, 127.98, 96.38],
    Matt: [107.86, 105.64, 114.48, 92.08],
    Kurt: [100.60, 89.36, 135.88, 112.22],
    Jerger: [124.06, 92.60, 102.14, 113.66],
    'Mr. G': [135.22, 84.42, 75.06, 93.84],
    Colin: [65.66, 100.08, 124.14, 129.92],
    DLin: [99.82, 100.56, 82.52, 114.68],
    Pablo: [112.66, 70.92, 86.38, 133.78]
  },

  // The week in progress. Set to null between weeks.
  live: {
    week: 5,
    status: 'Kicks off Thursday',
    // [current points, projected final]
    // Yahoo Week 5 projections as of Wed Oct 7, 8:44 AM CT (after waivers).
    scores: {
      Matt: [0, 115.63], DLin: [0, 105.63],
      Tristan: [0, 114.57], Colin: [0, 107.09],
      Jerger: [0, 106.04], Kurt: [0, 100.37],
      Tony: [0, 109.42], Andy: [0, 119.45],
      'Mr. G': [0, 116.16], Pablo: [0, 91.39]
    },
    // Points so far for every player whose game has started (starters and bench).
    // Players listed in inProgress are still playing; the rest are final.
    playerPoints: {},
    inProgress: [],
    sheetNote: 'Projections until kickoff.'
  },

  // Thursday of Week 1. Each leg's kickoff ('Thu 7:15 PM · TB @ DAL') counts from that week's
  // Thursday, which is how tails lock when a ticket's first game starts.
  week1Thursday: '2026-09-10',

  // Shown on the week after the live one.
  next: {
    week: 6,
    dates: 'Oct 15–19',
    note: 'Week 6 matchups post once Week 5 goes final.'
  },

  // Player projections for the live week, used when the roster file has none.
  // Fill in every manager's players or leave empty; a partial list makes one team look different.
  // Projected values show in gray with "proj" so they never read as live points.
  projections: {},

  // Wire tab: transactions newer than asOf minus windowDays show under "7 days".
  wire: { asOf: '2026-10-06T10:10:00', windowDays: 7 },

  // ---- Trash talk (hidden when the trashTalk setting is off) ----

  // Caption under the featured matchup, by week. While a week is live the featured
  // matchup can change, so tie the caption to it: { pair: ['Matt', 'DLin'], text }.
  // If another matchup takes over, the site writes a plain caption from the scores.
  captions: {
    1: 'Pablo held off Matt by 4.80. Pablo would like this one framed, since it may be a while.',
    2: 'DLin beat Kurt 100.56–89.36. Neither fan base was reached for comment.',
    3: 'Andy beat Colin by 3.84. Colin is expected to blame the kicker, the refs and Yahoo.',
    4: 'Jerger beat Kurt 113.66–112.22. Chris Olave needed 14.17 on Monday night and scored 15.60.'
  },

  // "The Booth" lines by week: [manager, text].
  // Five per week: one per matchup, in the same order as schedule[week]. The manager
  // is whose crest shows next to the line (whoever the line is mostly about).
  // booth holds the recaps (after Monday night); boothPreview (below) holds the
  // previews (before Thursday kickoff), same order and format. A recap shows with its
  // preview tucked under it; a preview alone shows in the recap's spot, labeled.
  booth: {
    1: [
      ['Matt', 'Pablo beat Matt by 4.80 because Matt benched Watson’s 29.70 to start DeVonta’s 6.80. Unlucky is one word for it.'],
      ['Colin', 'Colin opened the season with 65.66, lowest of the week, and lost to Tony by 57.40. Tony thanks Colin for the service.'],
      ['Kurt', 'Tristan put up 144.36, the top score of the week, and beat Kurt by 43.76. Kurt started Loveland, who scored 0.00.'],
      ['Jerger', 'Jerger scored 124.06, fourth-best of the week, and lost to Andy anyway. Starting Dart over Herbert still comes up 2.94 short.'],
      ['Mr. G', 'Mr. G opened with 135.22, third-best of the week, and beat DLin by 35.40. Not bad for someone who’s definitely not a Boomer.']
    ],
    2: [
      ['Kurt', 'DLin beat Kurt by 11.20 with Goff’s 29.78 on the bench. Kurt’s first-round pick Saquon scored 2.50, and Kurt is 0–2.'],
      ['Mr. G', 'Tony dropped 154.52 on Mr. G, the top score of the season so far, and won by 70.10. Mr. G has asked that the tape not be shared.'],
      ['Jerger', 'Tristan beat Jerger by 11.50, and Jerger had Kelce’s 20.60 on the bench behind Nabers’ 0.60. Yahoo’s #1 fan, everybody.'],
      ['Andy', 'Andy scored 75.96 and lost to Matt by 29.68. DJ Moore started and finished at −0.10. The gibbing has paused.'],
      ['Pablo', 'Colin benched Davante’s 35.50 and still beat Pablo by 29.16. Pablo’s 70.92 was the lowest score of the week.']
    ],
    3: [
      ['Colin', 'Colin lost to Andy by 3.84 with Burrow’s 22.58 on the bench while Mahomes started for 16.94. That swap wins it.'],
      ['Tony', 'Tony went to 3–0 with 95.42, seventh-best of the week, because Pablo started Schultz (4.50) over Juwan Johnson (19.30). Fraud watch begins.'],
      ['Matt', 'Matt lost to Tristan by 7.16 with Watson’s 19.10 on the bench, again. Jefferson started and scored 4.20.'],
      ['DLin', 'DLin managed 82.52 and lost to Jerger by 19.62 with Fannin’s 20.60 on the bench. Toilet Bowl King is starting to look like a mission statement.'],
      ['Mr. G', 'Mr. G started Maye over Shough for the second straight week: Maye 5.76, Shough 24.80. Kurt won by 60.82 for a first win.']
    ],
    4: [
      ['Tony', 'Andy won by 5.56 because Tony benched Ollie Gordon II’s 17.00 for Bucky’s 6.10. Tony’s first loss was self-inflicted.'],
      ['Tristan', 'Tristan scored 125.88, third-best in the league, lost to Colin anyway, and declared the season over. Tristan is still in first.'],
      ['Matt', 'Matt lost by 22.60 to the reigning Toilet Bowl King. DLin’s JT and Higgins outscored Matt’s three starting receivers by 29.90.'],
      ['Kurt', 'Jerger left Nabers’ 20.20 on the bench and still won, because Kurt started Saquon (1.50) over JCM (6.00). Two bad lineups, one loser.'],
      ['Mr. G', 'Pablo was projected to lose to Mr. G by 30.35 and won by 39.94. Opponents keep saving their best for Mr. G.']
    ]
  },
  boothPreview: {
    5: [
      ['Matt', 'The 1–3 bowl, between the two unluckiest teams in the league: Kurt at −1.00 and Matt at −0.89. Projected 115.63–100.37, Matt. There is no 2nd best is 9th.'],
      ['Tony', 'First vs. second, both 3–1, projected 114.57–109.42 for Tristan. Tony has the league’s best luck at +1.11 and the 7th-best power ranking. Fraud watch is on.'],
      ['Mr. G', 'Mr. G is projected to beat Jerger 116.16–106.04. Mr. G has also allowed 524.00 points in four weeks, so Jerger knows the assignment.'],
      ['Colin', 'Both 2–2, Colin 5th and DLin 7th, with the playoff line between them. Colin has 24 adds this season and the worst lineup efficiency in the league, 79.1%.'],
      ['Pablo', 'Andy is 3–1. Pablo is 2–2 and 6th, right on the playoff line, a week after putting up the top score at 133.78. The team name is He was #1, and it was, for one week.']
    ]
  },

  // The Booth Parlay, by week. Shows under All matchups, with a season ledger
  // ($10 flat stakes) underneath.
  //   legs[].text   what the bet is
  //   legs[].player Yahoo player name, or the team name for a defense/moneyline
  //                 ('Ravens'). The site tags whose fantasy roster it's on and
  //                 shows the player's fantasy points once they're in.
  //   legs[].type   'td' (anytime TD; count: 2 for 2+ TDs), 'over' (player stat;
  //                 needs stat + line), 'ml' (moneyline), 'spread' (team + line,
  //                 e.g. team 'Bal', line -11.5) or 'total' (game points; needs
  //                 side + line); tells the weekly update how to grade the leg
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
  //   odds          optional book price for the whole ticket ('+2350'). Use it for
  //                 same-game parlays, which the book prices as one bet; it
  //                 overrides the leg-by-leg math, and legs can stay odds: null.
  //   sgps          for a parlay of same-game parlays: each SGP's book price
  //                 (['+345', '+650']); legs[].sgp says which one a leg is in (1, 2…).
  //                 The ticket odds are the SGP prices multiplied together.
  //   booth         optional trash talk (hidden when trash talk is off).
  //   request       the manager whose site parlay request (api/requests.js) this fills; the
  //                 request on Gameday then shows Built and links here.
  parlays: {
    4: [
      {
        owner: 'Andy', title: 'Chalk Talk', id: 'andy', // id keeps the original link (#w4-andy)
        legs: [
          // Odds: DraftKings via ESPN odds/props pages, Fri Oct 2.
          { text: 'Jahmyr Gibbs anytime TD', player: 'Jahmyr Gibbs', type: 'td', game: 'Sun 7:20 PM @ CAR', result: '1 rush TD', odds: '-330', status: 'hit' },
          { text: 'Drake London over 79.5 receiving yards', player: 'Drake London', type: 'over', stat: 'Rec Yds', line: 79.5, game: 'Mon 7:15 PM @ NO', result: '5-96 rec yds', odds: '-110', status: 'hit' },
          // Andy bet the Ravens spread, not the moneyline, and it missed. His line and ticket
          // price are still to come; until then the ticket shows Lines TBD. Nobody tailed it.
          { text: 'Ravens spread vs Titans', player: 'Ravens', type: 'spread', team: 'Bal', line: null, teams: ['Ten', 'Bal'], game: 'Sun 12:00 PM vs TEN', result: 'Final 24–18 · won by 6', odds: null, status: 'miss' }
        ]
        // Booth line removed: it said the ticket cashed. The writer owes a new one.
      },
      {
        owner: 'Andy & Tony', owners: ['Andy', 'Tony'], init: 'A&T', title: 'The Truce',
        // Odds: DraftKings via ESPN props pages, Fri Oct 2.
        legs: [
          { text: 'Josh Allen anytime TD', player: 'Josh Allen', type: 'td', game: 'Sun 12:00 PM vs NE', result: '1 rush TD', odds: '-130', status: 'hit' },
          { text: 'Jaxon Smith-Njigba over 91.5 receiving yards', player: 'Jaxon Smith-Njigba', type: 'over', stat: 'Rec Yds', line: 91.5, game: 'Sun 3:25 PM vs LAC', result: '5-76 rec yds', odds: '-112', status: 'miss' },
          { text: 'D’Andre Swift anytime TD', player: "D'Andre Swift", type: 'td', game: 'Sun 12:00 PM vs NYJ', result: '0 TD', odds: '-115', status: 'miss' },
          { text: 'Javonte Williams over 58.5 rushing yards', player: 'Javonte Williams', type: 'over', stat: 'Rush Yds', line: 58.5, game: 'Sun 12:00 PM @ HOU', result: '19-62 rush yds, 3 TD', odds: '-112', status: 'hit' }
        ],
        booth: 'Opponents on Sunday, partners on the ticket. If all four hit, whoever loses the matchup still gets paid.'
      },
      {
        owner: 'Tristan & Colin', owners: ['Tristan', 'Colin'], init: 'T&C', title: 'Rounding Error',
        // Odds: DraftKings via ESPN props pages, Fri Oct 2.
        legs: [
          { text: 'Lamar Jackson anytime TD', player: 'Lamar Jackson', type: 'td', game: 'Sun 12:00 PM vs TEN', result: '0 TD', odds: '+240', status: 'miss' },
          { text: 'Bijan Robinson over 88.5 rushing yards', player: 'Bijan Robinson', type: 'over', stat: 'Rush Yds', line: 88.5, game: 'Mon 7:15 PM @ NO', result: '19-145 rush yds', odds: '-111', status: 'hit' },
          { text: 'Ja’Marr Chase over 84.5 receiving yards', player: "Ja'Marr Chase", type: 'over', stat: 'Rec Yds', line: 84.5, game: 'Sun 12:00 PM vs JAX', result: '3-27, left with a concussion in Q2', odds: '-110', status: 'miss' },
          { text: 'Brock Bowers over 73.5 receiving yards', player: 'Brock Bowers', type: 'over', stat: 'Rec Yds', line: 73.5, game: 'Sun 3:25 PM vs KC', result: '6-86 rec yds, 1 TD', odds: '-111', status: 'hit' }
        ],
        booth: 'Projected 0.59 apart, so they split the ticket down the middle. Lamar’s +240 touchdown is doing most of the heavy lifting.'
      },
      {
        owner: 'The Booth', init: 'TB', title: 'Noon Special', id: 'the-booth', // id keeps the original link (#w4-the-booth)
        // Odds: ESPN odds page (DraftKings), Fri Oct 2. Noon CT kickoffs.
        legs: [
          { text: 'Jaguars–Bengals over 51.5', type: 'total', side: 'over', line: 51.5, teams: ['Jax', 'Cin'], game: 'Sun 12:00 PM · JAX @ CIN', result: 'Final 22–17 · 39 pts', odds: '-102', status: 'miss' },
          { text: 'Cowboys moneyline at Texans', type: 'ml', team: 'Dal', teams: ['Dal', 'Hou'], game: 'Sun 12:00 PM · DAL @ HOU', result: 'Final W 34–30', odds: '+136', status: 'hit' },
          { text: 'Packers moneyline at Buccaneers', type: 'ml', team: 'GB', teams: ['GB', 'TB'], game: 'Sun 12:00 PM · GB @ TB', result: 'Final W 17–14', odds: '-175', status: 'hit' }
        ],
        tailers: ['Tony'],
        booth: 'The Booth’s noon special: the highest total on the early slate, a Cowboys upset that runs straight through Pablo’s QB and defense, and Matt’s Jordan Love against an 0–3 Bucs team. For fun, not a lock.'
      },
      {
        owner: 'Andy', title: 'London Lottery', odds: '+2350', // book price for the whole ticket (same-game parlay)
        legs: [
          { text: 'Jonathan Taylor anytime TD', player: 'Jonathan Taylor', type: 'td', game: 'Sun 8:30 AM · IND @ WAS (London)', result: '2 rush TD', odds: null, status: 'hit' },
          { text: 'Jacory Croskey-Merritt anytime TD', player: 'Jacory Croskey-Merritt', type: 'td', game: 'Sun 8:30 AM · IND @ WAS (London)', result: '15 rush yds, 2-35 rec, no TD', odds: null, status: 'miss' },
          { text: 'Tyler Warren anytime TD', player: 'Tyler Warren', type: 'td', game: 'Sun 8:30 AM · IND @ WAS (London)', result: '5-41, no TD', odds: null, status: 'miss' },
          { text: 'Stefon Diggs anytime TD', player: 'Stefon Diggs', type: 'td', game: 'Sun 8:30 AM · IND @ WAS (London)', result: '5-35, no TD', odds: null, status: 'miss' }
        ],
        tailers: ['DLin'],
        booth: 'Andy needed Tony’s tight end to score against Tony. Tyler Warren caught five balls and found no end zone, so Tony wins that subplot. Jonathan Taylor scored twice and DLin keeps the 22.20 in the matchup, so the tail only cost ten bucks.'
      },
      {
        owner: 'Andy', title: 'Breakfast in London', odds: '+1000', // book price for the whole ticket (same-game parlay)
        legs: [
          { text: 'Commanders moneyline vs Colts', type: 'ml', team: 'Was', teams: ['Ind', 'Was'], game: 'Sun 8:30 AM · IND @ WAS (London)', result: 'Lost 13–30', odds: null, status: 'miss' },
          { text: 'Jonathan Taylor anytime TD', player: 'Jonathan Taylor', type: 'td', game: 'Sun 8:30 AM · IND @ WAS (London)', result: '2 rush TD', odds: null, status: 'hit' },
          { text: 'Stefon Diggs anytime TD', player: 'Stefon Diggs', type: 'td', game: 'Sun 8:30 AM · IND @ WAS (London)', result: '5-35, no TD', odds: null, status: 'miss' }
        ],
        booth: 'A Commanders win with two Jonathan Taylor touchdowns. Taylor delivered both. The Commanders lost by 17 before most of the league had coffee.'
      },
      {
        owner: 'Andy', title: 'Two-Score Moonshot',
        // Three same-game parlays; each SGP's book price, from Andy's ticket.
        sgps: ['+345', '+650', '+440'],
        legs: [
          { text: 'Derrick Henry 2+ TDs', player: 'Derrick Henry', type: 'td', count: 2, sgp: 1, game: 'Sun 12:00 PM · TEN @ BAL', result: '1 rush TD', odds: null, status: 'miss' },
          { text: 'Ravens −11.5 vs Titans', type: 'spread', team: 'Bal', line: -11.5, teams: ['Ten', 'Bal'], sgp: 1, game: 'Sun 12:00 PM · TEN @ BAL', result: 'Final 24–18 · won by 6', odds: null, status: 'miss' },
          { text: 'Josh Allen 2+ TDs', player: 'Josh Allen', type: 'td', count: 2, sgp: 2, game: 'Sun 12:00 PM · NE @ BUF', result: '1 rush TD', odds: null, status: 'miss' },
          { text: 'Bills −7 vs Patriots', type: 'spread', team: 'Buf', line: -7, teams: ['NE', 'Buf'], sgp: 2, game: 'Sun 12:00 PM · NE @ BUF', result: 'Final 26–29 · lost by 3', odds: null, status: 'miss' },
          { text: 'Chiefs −4.5 at Raiders', type: 'spread', team: 'KC', line: -4.5, teams: ['KC', 'LV'], sgp: 3, game: 'Sun 3:25 PM · KC @ LV', result: 'Final 30–27 · won by 3', odds: null, status: 'miss' },
          { text: 'Kenneth Walker III 2+ TDs', player: 'Kenneth Walker III', type: 'td', count: 2, sgp: 3, game: 'Sun 3:25 PM · KC @ LV', result: '2 rush TD', odds: null, status: 'hit' }
        ],
        booth: 'Six legs across three games, with Derrick Henry, Josh Allen and Kenneth Walker III each asked to score twice. Allen is Tony’s quarterback, in the week Andy plays Tony. A $10 bet that pays about $1,800 if all of it lands.'
      },
      {
        owner: 'Andy', title: 'The Sensible Six',
        // Three same-game parlays; each SGP's book price, from Andy's ticket.
        sgps: ['+210', '+106', '+112'],
        legs: [
          { text: 'D’Andre Swift anytime TD', player: 'D\'Andre Swift', type: 'td', sgp: 1, game: 'Sun 12:00 PM · NYJ @ CHI', result: '0 TD', odds: null, status: 'miss' },
          { text: 'Bears −6.5 vs Jets', type: 'spread', team: 'Chi', line: -6.5, teams: ['NYJ', 'Chi'], sgp: 1, game: 'Sun 12:00 PM · NYJ @ CHI', result: 'Final 23–12 · won by 11', odds: null, status: 'hit' },
          { text: 'Derrick Henry anytime TD', player: 'Derrick Henry', type: 'td', sgp: 2, game: 'Sun 12:00 PM · TEN @ BAL', result: '5-yd rush TD, Q1', odds: null, status: 'hit' },
          { text: 'Ravens −9.5 vs Titans', type: 'spread', team: 'Bal', line: -9.5, teams: ['Ten', 'Bal'], sgp: 2, game: 'Sun 12:00 PM · TEN @ BAL', result: 'Final 24–18 · won by 6', odds: null, status: 'miss' },
          { text: 'Josh Allen anytime TD', player: 'Josh Allen', type: 'td', sgp: 3, game: 'Sun 12:00 PM · NE @ BUF', result: '1 rush TD', odds: null, status: 'hit' },
          { text: 'Bills −2.5 vs Patriots', type: 'spread', team: 'Buf', line: -2.5, teams: ['NE', 'Buf'], sgp: 3, game: 'Sun 12:00 PM · NE @ BUF', result: 'Final 26–29 · lost by 3', odds: null, status: 'miss' }
        ],
        booth: 'The same three-game idea with friendlier numbers. Derrick Henry already scored, and D’Andre Swift is Andy’s own FLEX, so that leg pays twice if it hits.'
      }
    ],
    5: [
      {
        owner: 'Matt', title: 'The Whole Lineup', request: 'Matt',
        // Built by Claude for Matt's Lottery request (+5000 and up, any legs): every leg is a team
        // Matt starts someone from winning outright. Steelers over Colts because Matt starts the
        // Steelers D/ST (and Josh Downs, so that leg cuts both ways); Hubbard's Panthers are on bye.
        // Odds: DraftKings moneylines via ESPN, Tue Oct 6, 11:10 PM CT.
        legs: [
          { text: 'Packers moneyline vs Bears', type: 'ml', team: 'GB', teams: ['Chi', 'GB'], game: 'Sun 12:00 PM · CHI @ GB', odds: '+124', status: 'open' },
          { text: '49ers moneyline at Seahawks', type: 'ml', team: 'SF', teams: ['SF', 'Sea'], game: 'Sun 3:25 PM · SF @ SEA', odds: '+130', status: 'open' },
          { text: 'Jets moneyline vs Browns', type: 'ml', team: 'NYJ', teams: ['Cle', 'NYJ'], game: 'Sun 12:00 PM · CLE @ NYJ', odds: '-130', status: 'open' },
          { text: 'Cardinals moneyline vs Lions', type: 'ml', team: 'Ari', teams: ['Det', 'Ari'], game: 'Sun 3:25 PM · DET @ ARI', odds: '+195', status: 'open' },
          { text: 'Chargers moneyline vs Broncos', type: 'ml', team: 'LAC', teams: ['Den', 'LAC'], game: 'Sun 3:05 PM · DEN @ LAC', odds: '+154', status: 'open' },
          { text: 'Steelers moneyline vs Colts', type: 'ml', team: 'Pit', teams: ['Ind', 'Pit'], game: 'Sun 12:00 PM · IND @ PIT', odds: '-142', status: 'open' }
        ]
      },
      {
        owner: 'Tony', title: 'Starting Four', request: 'Tony',
        // Built by Claude for Tony's Long shot request (+1500 to +5000, 4 legs, with Josh Allen and
        // Jaxon Smith-Njigba): both players plus moneylines for two more Tony starters (Eagles D/ST,
        // Omarion Hampton). One leg per game, so the odds multiply as a regular parlay.
        // Odds: DraftKings. Allen and JSN props from Matt's DraftKings app screenshots, Tue Oct 6,
        // 11:54-11:56 PM CT; moneylines from DraftKings via ESPN, Tue Oct 6, 11:10 PM CT.
        legs: [
          { text: 'Josh Allen 250+ passing yards', player: 'Josh Allen', type: 'over', stat: 'Pass Yds', line: 249.5, game: 'Mon 7:15 PM · BUF @ LAR', odds: '+101', status: 'open' },
          { text: 'Jaxon Smith-Njigba anytime TD', player: 'Jaxon Smith-Njigba', type: 'td', count: 1, game: 'Sun 3:25 PM · SF @ SEA', odds: '-120', status: 'open' },
          { text: 'Eagles moneyline vs Jaguars', player: 'Eagles', type: 'ml', team: 'Phi', teams: ['Phi', 'Jax'], game: 'Sun 8:30 AM · PHI vs JAX', odds: '+280', status: 'open' },
          { text: 'Chargers moneyline vs Broncos', type: 'ml', team: 'LAC', teams: ['Den', 'LAC'], game: 'Sun 3:05 PM · DEN @ LAC', odds: '+154', status: 'open' }
        ]
      },
      {
        owner: 'Andy', title: 'Ground and Pound', request: 'Andy',
        // Built by Claude for Andy's Balanced request (+250 to +600, any legs, Javonte Williams TD
        // and Jahmyr Gibbs TD). Both TDs come to +75, so a third leg: the Giants moneyline (Andy
        // starts Giants TE Isaiah Likely). One leg per game, so the odds multiply: +338.
        // Odds: DraftKings via The Odds API, Wed Oct 7, 9:24 AM CT.
        legs: [
          { text: 'Javonte Williams anytime TD', player: 'Javonte Williams', type: 'td', count: 1, game: 'Thu 7:15 PM · TB @ DAL', odds: '-230', status: 'open' },
          { text: 'Jahmyr Gibbs anytime TD', player: 'Jahmyr Gibbs', type: 'td', count: 1, game: 'Sun 3:25 PM · DET @ ARI', odds: '-450', status: 'open' },
          { text: 'Giants moneyline at Commanders', player: 'Giants', type: 'ml', team: 'NYG', teams: ['NYG', 'Was'], game: 'Sun 12:00 PM · NYG @ WAS', odds: '+150', status: 'open' }
        ]
      },
      {
        owner: 'Andy', title: 'Ground and Pound (Juiced)',
        // Andy's juiced take on Ground and Pound (his text, Wed Oct 7): Williams and Gibbs each
        // need two TDs instead of one; the Giants moneyline stays. Not marked placed.
        // Odds: DraftKings via The Odds API, Wed Oct 7, 3:32 PM CT.
        legs: [
          { text: 'Javonte Williams 2+ TDs', player: 'Javonte Williams', type: 'td', count: 2, game: 'Thu 7:15 PM · TB @ DAL', odds: '+245', status: 'open' },
          { text: 'Jahmyr Gibbs 2+ TDs', player: 'Jahmyr Gibbs', type: 'td', count: 2, game: 'Sun 3:25 PM · DET @ ARI', odds: '+115', status: 'open' },
          { text: 'Giants moneyline at Commanders', player: 'Giants', type: 'ml', team: 'NYG', teams: ['NYG', 'Was'], game: 'Sun 12:00 PM · NYG @ WAS', odds: '+150', status: 'open' }
        ]
      }
    ]
  },

  // Power rankings one-liners, by the last final week the rankings cover: { Manager: text }.
  // Written by the writer session; a team without a line just shows its numbers.
  powerNotes: {
    4: {
      Tristan: 'First in the standings, first here, and 29–7 against the whole league. The season Tristan declared over is going fine.',
      Andy: 'Up one to 2nd and 3–1, while being outscored 444.66–439.66 on the season. Andy would like you to stop checking.',
      Colin: 'Up three after the second-best score of Week 4. Twenty-three adds, and the 2:23 AM one scored 25.50.',
      Jerger: 'Up three on two straight wins, the second one by 1.44. Yahoo’s #1 fan is getting the hang of the app.',
      Kurt: '5th by the numbers, 8th in the standings, and the unluckiest team in the league. Average Sports Enthusiast, below-average luck.',
      Pablo: 'Up four, the biggest jump of the week, after beating all nine teams in Week 4. He was #1, and for one week he was again.',
      Tony: 'Down five, the biggest drop of the week, after the league’s lowest score (90.82). 2nd in the standings, 7th here. Fraud watch is open.',
      DLin: 'Holding at 8th after beating Matt by 22.60. The Toilet Bowl King’s title defense is a respectable 2–2.',
      Matt: 'Down five after scoring 92.08. There is no 2nd best, but there is a 9th.',
      'Mr. G': 'Last, but opponents have averaged 131.00 against Mr. G. The schedule owes Mr. G an apology.'
    }
  },

  // One-liner on each team page.
  roasts: {
    Tony: '3–1 on 2 adds all season. The first loss came with 21.30 points on the bench.',
    Tristan: 'First at 3–1, with the most points scored (495.98) and the fewest left on the bench (30.30).',
    Andy: 'Lost Week 2 with 75.96 and is 3–1 anyway. 11 adds, second only to Colin.',
    Matt: 'Second-unluckiest manager in the league at −0.89. Would still like you to know that.',
    Kurt: 'Unluckiest manager in the league at −1.00. Lost Week 4 by 1.44 with the fix sitting on the bench.',
    Jerger: 'Has left 91.52 points on the bench. Chris Olave bailed out Week 4 anyway.',
    'Mr. G': 'Most points allowed in the league: 524.00, 76.16 more than anyone. Opponents save their best for Mr. G.',
    Colin: '23 adds, two wins, and the most bench points in the league (110.74). Somehow it’s working.',
    DLin: 'Toilet Bowl King. Not a prediction, a title defense.',
    Pablo: 'Projected last in Week 4, finished first with 133.78. Still has 99.56 bench points, second only to Colin.'
  }
};
