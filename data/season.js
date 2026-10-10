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
  draftToolUrl: '/draft',  // the old Grok tool, copied into draft/, assets/ and docs/

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
    status: 'Live · Thursday final (TB 24, DAL 16) · Sunday next',
    // When these numbers were pulled from Yahoo (Central); shows as "Scores as of Thu 10:19 PM".
    asOf: '2026-10-09T19:27:00-05:00',
    // [current points, projected final]
    // Yahoo as of Fri Oct 9, 7:27 PM CT: Thursday final, Sunday projections. Tristan has only
    // two starters set (Odunze, Tuten), so Yahoo projects him 20.12.
    scores: {
      Matt: [0, 116.23], DLin: [24.50, 117.94],
      Tristan: [0, 20.12], Colin: [0, 114.26],
      Jerger: [1.90, 93.68], Kurt: [28.84, 102.46],
      Tony: [30.50, 128.20], Andy: [20.20, 120.70],
      'Mr. G': [0, 117.00], Pablo: [5.00, 79.07]
    },
    // Points so far for every player whose game has started (starters and bench).
    // Players listed in inProgress are still playing; the rest are final.
    playerPoints: {
      'Bucky Irving': 30.50, 'Emeka Egbuka': 14.20, 'Dak Prescott': 14.64,
      'Javonte Williams': 13.20, 'Chase McLaughlin': 7.00, 'George Pickens': 23.50,
      'Cowboys': 1.00, 'Jake Ferguson': 3.40, 'Kenny Gainwell': 4.30,
      'CeeDee Lamb': 1.90, 'Brandon Aubrey': 5.00, 'Chris Godwin Jr.': 5.50
    },
    inProgress: [],
    sheetNote: 'Thursday final; Sunday projections as of Fri 7:27 PM CT. Each player is tagged Final, Live or proj.'
  },

  // The NFL week: every game ('Sun 12:00 PM · CHI @ GB', kickoff Central, same form as parlay legs)
  // and the teams on bye. Lineups use it for kickoff times and bye/empty-slot alerts.
  // Week 5 from ESPN's scoreboard, Fri Oct 9.
  nfl: {
    5: {
      games: ['Thu 7:15 PM · TB @ DAL', 'Sun 8:30 AM · PHI @ JAX', 'Sun 12:00 PM · CHI @ GB', 'Sun 12:00 PM · HOU @ TEN',
        'Sun 12:00 PM · CIN @ MIA', 'Sun 12:00 PM · LV @ NE', 'Sun 12:00 PM · MIN @ NO', 'Sun 12:00 PM · CLE @ NYJ',
        'Sun 12:00 PM · IND @ PIT', 'Sun 12:00 PM · NYG @ WAS', 'Sun 3:05 PM · DEN @ LAC', 'Sun 3:25 PM · DET @ ARI',
        'Sun 3:25 PM · SF @ SEA', 'Sun 7:20 PM · BAL @ ATL', 'Mon 7:15 PM · BUF @ LAR'],
      byes: ['CAR', 'KC']
    }
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

  // Wire tab: "7 days" shows the windowDays before the newest transaction on file.
  wire: { windowDays: 7 },

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
      ['Colin', 'Both 2–2, Colin 5th and DLin 7th, with the playoff line between them. Colin has 28 adds this season and the worst lineup efficiency in the league, 79.1%.'],
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
  //   placedBy      managers who actually bet it (a real slip). The ledger counts only
  //                 placed and tailed tickets, plus "I'm on it" taps on the site.
  //   tailers       managers riding along; tailing your own opponent shows HEDGE.
  //   odds          optional book price for the whole ticket ('+2350'). Use it for
  //                 same-game parlays, which the book prices as one bet; it
  //                 overrides the leg-by-leg math, and legs can stay odds: null.
  //   sgps          for a parlay of same-game parlays: each SGP's book price
  //                 (['+345', '+650']); legs[].sgp says which one a leg is in (1, 2…).
  //                 The ticket odds are the SGP prices multiplied together.
  //   booth         optional trash talk (hidden when trash talk is off).
  //   request       the manager whose site parlay request (api/requests.js) this fills, and
  //   requestAt     that request's `at`; the request on Gameday then shows Built and links here.
  //                 A newer request from the same manager shows as waiting until it's built too.
  parlays: {
    4: [
      {
        owner: 'Andy', title: 'Chalk Talk', id: 'andy', placedBy: ['Andy'], // id keeps the original link (#w4-andy)
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
      }
    ],
    5: [
      {
        owner: 'Matt', title: 'The Whole Lineup', request: 'Matt', requestAt: '2026-10-07T04:04:28.169Z', placedBy: ['Matt'], odds: '+11291',
        // Built by Claude for Matt's Lottery request (+5000 and up, any legs): every leg is a team
        // Matt starts someone from winning outright. Steelers over Colts because Matt starts the
        // Steelers D/ST (and Josh Downs, so that leg cuts both ways); Hubbard's Panthers are on bye.
        // Odds: Matt placed it at DraftKings, Fri Oct 9, 7:54 PM CT (DK639271904910145642), $10 to pay
        // $1,139.12; legs and the +11291 ticket price are from his slip. Built from DraftKings
        // moneylines via ESPN, Tue Oct 6, 11:10 PM CT.
        legs: [
          { text: 'Packers moneyline vs Bears', type: 'ml', team: 'GB', teams: ['Chi', 'GB'], game: 'Sun 12:00 PM · CHI @ GB', odds: '+102', status: 'open' },
          { text: '49ers moneyline at Seahawks', type: 'ml', team: 'SF', teams: ['SF', 'Sea'], game: 'Sun 3:25 PM · SF @ SEA', odds: '+136', status: 'open' },
          { text: 'Jets moneyline vs Browns', type: 'ml', team: 'NYJ', teams: ['Cle', 'NYJ'], game: 'Sun 12:00 PM · CLE @ NYJ', odds: '-130', status: 'open' },
          { text: 'Cardinals moneyline vs Lions', type: 'ml', team: 'Ari', teams: ['Det', 'Ari'], game: 'Sun 3:25 PM · DET @ ARI', odds: '+210', status: 'open' },
          { text: 'Chargers moneyline vs Broncos', type: 'ml', team: 'LAC', teams: ['Den', 'LAC'], game: 'Sun 3:05 PM · DEN @ LAC', odds: '+160', status: 'open' },
          { text: 'Steelers moneyline vs Colts', type: 'ml', team: 'Pit', teams: ['Ind', 'Pit'], game: 'Sun 12:00 PM · IND @ PIT', odds: '-148', status: 'open' }
        ]
      },
      {
        owner: 'Tony', title: 'Starting Four', request: 'Tony', requestAt: '2026-10-06', // Tony's first request (Tue Oct 6), since replaced
        // Built by Claude for Tony's Long shot request (+1500 to +5000, 4 legs, with Josh Allen and
        // Jaxon Smith-Njigba): both players plus moneylines for two more Tony starters (Eagles D/ST,
        // Omarion Hampton). One leg per game, so the odds multiply as a regular parlay.
        // Odds: DraftKings. Allen and JSN props from Matt's DraftKings app screenshots, Tue Oct 6,
        // 11:54-11:56 PM CT; moneylines from DraftKings via ESPN, Tue Oct 6, 11:10 PM CT. Eagles +280
        // re-checked: DraftKings via The Odds API, Wed Oct 7, 6:06 PM CT (Jaguars -355, home in London).
        legs: [
          { text: 'Josh Allen 250+ passing yards', player: 'Josh Allen', type: 'over', stat: 'Pass Yds', line: 249.5, game: 'Mon 7:15 PM · BUF @ LAR', odds: '+101', status: 'open' },
          { text: 'Jaxon Smith-Njigba anytime TD', player: 'Jaxon Smith-Njigba', type: 'td', count: 1, game: 'Sun 3:25 PM · SF @ SEA', odds: '-120', status: 'open' },
          { text: 'Eagles moneyline at Jaguars', player: 'Eagles', type: 'ml', team: 'Phi', teams: ['Phi', 'Jax'], game: 'Sun 8:30 AM · PHI @ JAX', odds: '+280', status: 'open' },
          { text: 'Chargers moneyline vs Broncos', type: 'ml', team: 'LAC', teams: ['Den', 'LAC'], game: 'Sun 3:05 PM · DEN @ LAC', odds: '+154', status: 'open' }
        ]
      },
      {
        owner: 'Tony', title: 'Home Dogs', request: 'Tony', requestAt: '2026-10-09T19:16:09.063Z',
        // Built by Claude for Tony's second request (Fri Oct 9, 2:16 PM CT: Lottery +5000 and up, 4 legs,
        // Josh Allen TD and Jaxon Smith-Njigba TD). Both picks plus moneylines for two home underdogs
        // Tony starts someone from (Ollie Gordon II's Dolphins, Carnell Tate's Titans). One leg per game.
        // Odds: DraftKings. Allen and JSN anytime TD from Matt's DraftKings app screenshots, Fri Oct 9,
        // ~8 PM CT; moneylines DraftKings via The Odds API, Fri Oct 9, 8:05 PM CT. Ticket ≈ +5154.
        legs: [
          { text: 'Josh Allen anytime TD', player: 'Josh Allen', type: 'td', count: 1, game: 'Mon 7:15 PM · BUF @ LAR', odds: '-120', status: 'open' },
          { text: 'Jaxon Smith-Njigba anytime TD', player: 'Jaxon Smith-Njigba', type: 'td', count: 1, game: 'Sun 3:25 PM · SF @ SEA', odds: '-110', status: 'open' },
          { text: 'Dolphins moneyline vs Bengals', player: 'Dolphins', type: 'ml', team: 'Mia', teams: ['Cin', 'Mia'], game: 'Sun 12:00 PM · CIN @ MIA', odds: '+280', status: 'open' },
          { text: 'Titans moneyline vs Texans', player: 'Titans', type: 'ml', team: 'Ten', teams: ['Hou', 'Ten'], game: 'Sun 12:00 PM · HOU @ TEN', odds: '+295', status: 'open' }
        ]
      },
      {
        owner: 'Andy', title: 'Ground and Pound', request: 'Andy', requestAt: '2026-10-07T13:51:36.692Z',
        // Built by Claude for Andy's Balanced request (+250 to +600, any legs, Javonte Williams TD
        // and Jahmyr Gibbs TD). Both TDs come to +75, so a third leg: the Giants moneyline (Andy
        // starts Giants TE Isaiah Likely). One leg per game, so the odds multiply: +338.
        // Odds: DraftKings via The Odds API, Wed Oct 7, 9:24 AM CT.
        legs: [
          { text: 'Javonte Williams anytime TD', player: 'Javonte Williams', type: 'td', count: 1, game: 'Thu 7:15 PM · TB @ DAL', odds: '-230', result: '1 rush TD (12-45)', status: 'hit' },
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
          { text: 'Javonte Williams 2+ TDs', player: 'Javonte Williams', type: 'td', count: 2, game: 'Thu 7:15 PM · TB @ DAL', odds: '+245', result: '1 rush TD (12-45)', status: 'miss' },
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
    Tony: '3–1 with the fewest points against in the league (332.84). Power rankings have Tony 7th.',
    Tristan: 'First at 3–1, with the most points scored (495.98) and the fewest left on the bench (30.30).',
    Andy: '3–1 while being outscored 444.66–439.66 on the season. 12 adds, second only to Colin.',
    Matt: 'Second-unluckiest manager in the league at −0.89. Would still like you to know that.',
    Kurt: 'Unluckiest manager in the league at −1.00. Lost Week 4 by 1.44 with the fix sitting on the bench.',
    Jerger: 'Two straight wins after an 0–2 start. Still has 91.52 points left on the bench.',
    'Mr. G': 'Most points allowed in the league: 524.00, 76.16 more than anyone. Opponents save their best for Mr. G.',
    Colin: '28 adds, more than double anyone else, and the most points left on the bench (110.74). Somehow 2–2.',
    DLin: 'Toilet Bowl King. Not a prediction, a title defense.',
    Pablo: 'Projected last in Week 4, finished first with 133.78. Still has 99.56 bench points, second only to Colin.'
  }
};
