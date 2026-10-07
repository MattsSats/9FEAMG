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
    // Yahoo Week 5 projections as of Tue Oct 6, 10:10 AM CT (before waivers).
    scores: {
      Matt: [0, 95.68], DLin: [0, 100.11],
      Tristan: [0, 100.77], Colin: [0, 99.30],
      Jerger: [0, 96.22], Kurt: [0, 98.81],
      Tony: [0, 106.42], Andy: [0, 111.46],
      'Mr. G': [0, 110.62], Pablo: [0, 89.98]
    },
    // Points so far for every player whose game has started (starters and bench).
    // Players listed in inProgress are still playing; the rest are final.
    playerPoints: {},
    inProgress: [],
    sheetNote: 'Projections until kickoff.'
  },

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
    1: 'Pablo held off Matt by 4.8. Pablo would like this one framed, since it may be a while.',
    2: 'DLin beat Kurt 100.6–89.4. Neither fan base was reached for comment.',
    3: 'Andy beat Colin by 3.9. Colin is expected to blame the kicker, the refs and Yahoo.',
    4: 'Jerger beat Kurt 113.66–112.22. Chris Olave needed 14.17 on Monday night and scored 15.60.'
  },

  // "The Booth" lines by week: [manager, text].
  // Five per week: one per matchup, in the same order as schedule[week]. The manager
  // is whose crest shows next to the line (whoever the line is mostly about).
  booth: {
    1: [
      ['Matt', 'Matt lost to Pablo by 4.80 with Christian Watson’s 29.70 on the bench while DeVonta Smith started for 6.80. Unlucky is one word for it.'],
      ['Colin', 'Colin opened the season with 65.66, lowest of the week, and lost to Tony by 57.40. Tony thanks Colin for the service.'],
      ['Tristan', 'Tristan put up 144.36, the top score of the week, and beat Kurt by 43.76. Ashton Jeanty had 29.70 and Bijan Robinson 27.30.'],
      ['Jerger', 'Jerger scored 124.06 and lost to Andy by 15.28, with Jaxson Dart’s 26.60 on the bench. Some weeks the schedule picks you.'],
      ['Mr. G', 'Mr. G put up 135.22 in Week 1 and beat DLin by 35.40. Frame it. It has been downhill since.']
    ],
    2: [
      ['Kurt', 'Kurt lost to DLin by 11.20 with Saquon Barkley at 2.50 against a 13.79 projection. DLin won with Jared Goff’s 29.78 on the bench.'],
      ['Tony', 'Tony dropped 154.52 on Mr. G, the top score of the season so far, and won by 70.10. Mr. G has asked that the tape not be shared.'],
      ['Jerger', 'Jerger lost to Tristan by 11.50. Travis Kelce scored 20.60 on the bench while Malik Nabers started and scored 0.60.'],
      ['Andy', 'Andy scored 75.96 and lost to Matt by 29.68. DJ Moore started and finished at −0.10. The gibbing has paused.'],
      ['Pablo', 'Pablo posted 70.92, lowest of the week. Colin benched Davante Adams for 35.50 and still won by 29.16.']
    ],
    3: [
      ['Colin', 'Colin lost to Andy by 3.84 with Joe Burrow’s 22.58 on the bench while Patrick Mahomes started for 16.94. That swap wins it.'],
      ['Pablo', 'Pablo lost to Tony by 9.04 with Geno Smith (26.04) and Juwan Johnson (19.30) on the bench. Either one wins it.'],
      ['Matt', 'Christian Watson on Matt’s bench, again: 19.10 while Justin Jefferson started for 4.20. Matt lost to Tristan by 7.16.'],
      ['DLin', 'DLin managed 82.52 and lost to Jerger by 19.62, with Harold Fannin Jr. (20.60) and Michael Wilson (20.40) on the bench. Toilet Bowl King is starting to look like a mission statement.'],
      ['Kurt', 'Kurt hung 135.88 on Mr. G, the top score of the week. Mr. G’s 75.06 was the lowest, with Tyler Shough’s 24.80 on the bench.']
    ],
    4: [
      ['Tony', 'Tony’s first loss: 90.82–96.38 to Andy, the lowest score of the week. Ollie Gordon II scored 17.00 on Tony’s bench while Bucky Irving started for 6.10, and Drake London’s 12.10 on Monday night closed it out.'],
      ['Colin', 'Colin beat Tristan 129.92–125.88 with Ja’Marr Chase at 4.20 and Rashee Rice at 0.00. Kyren Williams (31.70) and 2:23 AM pickup Emanuel Wilson (25.50) covered for them, and Kyle Monangai’s 27.50 sat on the bench.'],
      ['Matt', 'DLin beat Matt 114.68–92.08 with Tee Higgins at 21.20. Quinshon Judkins scored 18.60 on Matt’s bench, still short of the 22.60 gap.'],
      ['Kurt', 'Jerger beat Kurt 113.66–112.22 when Chris Olave scored 15.60 on Monday night, 1.43 more than needed. Kurt had Jacory Croskey-Merritt’s 6.00 on the bench behind Saquon Barkley’s 1.50; that one swap wins it.'],
      ['Pablo', 'Pablo was projected for 88.77 on Thursday, lowest in the league, and scored 133.78, the top score of the week. Mr. G lost by 39.94 with Drake Maye’s 27.16 on the bench.']
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
  parlays: {
    4: [
      {
        owner: 'Andy', title: 'Chalk Talk', id: 'andy', // id keeps the original link (#w4-andy)
        legs: [
          // Odds: DraftKings via ESPN odds/props pages, Fri Oct 2.
          { text: 'Jahmyr Gibbs anytime TD', player: 'Jahmyr Gibbs', type: 'td', game: 'Sun 7:20 PM @ CAR', result: '1 rush TD', odds: '-330', status: 'hit' },
          { text: 'Drake London over 79.5 receiving yards', player: 'Drake London', type: 'over', stat: 'Rec Yds', line: 79.5, game: 'Mon 7:15 PM @ NO', result: '5-96 rec yds', odds: '-110', status: 'hit' },
          { text: 'Ravens moneyline', player: 'Ravens', type: 'ml', game: 'Sun 12:00 PM vs TEN', result: 'Final W 24–18', odds: '-700', status: 'hit' }
        ],
        tailers: ['Tony'],
        booth: 'Cashed. The Ravens won, Jahmyr Gibbs scored on Sunday night, and Drake London caught 5 for 96 yards on Monday. $10 paid $28.43, the only winner of eight Week 4 tickets. Tony tailed it, so Tony cashed too, on the same night Tony lost to Andy.'
      },
      {
        owner: 'Andy & Tony', owners: ['Andy', 'Tony'], init: 'A&T', title: 'The Truce',
        // Odds: DraftKings via ESPN props pages, Fri Oct 2.
        legs: [
          { text: 'Josh Allen anytime TD', player: 'Josh Allen', type: 'td', game: 'Sun 12:00 PM vs NE', result: '1 rush TD', odds: '-130', status: 'hit' },
          { text: 'Jaxon Smith-Njigba over 91.5 receiving yards', player: 'Jaxon Smith-Njigba', type: 'over', stat: 'Rec Yds', line: 91.5, game: 'Sun 3:25 PM vs LAC', odds: '-112', status: 'open' },
          { text: 'D’Andre Swift anytime TD', player: "D'Andre Swift", type: 'td', game: 'Sun 12:00 PM vs NYJ', result: '0 TD', odds: '-115', status: 'miss' },
          { text: 'Javonte Williams over 58.5 rushing yards', player: 'Javonte Williams', type: 'over', stat: 'Rush Yds', line: 58.5, game: 'Sun 12:00 PM @ HOU', odds: '-112', status: 'open' }
        ],
        booth: 'Opponents on Sunday, partners on the ticket. If all four hit, whoever loses the matchup still gets paid.'
      },
      {
        owner: 'Tristan & Colin', owners: ['Tristan', 'Colin'], init: 'T&C', title: 'Rounding Error',
        // Odds: DraftKings via ESPN props pages, Fri Oct 2.
        legs: [
          { text: 'Lamar Jackson anytime TD', player: 'Lamar Jackson', type: 'td', game: 'Sun 12:00 PM vs TEN', result: '0 TD', odds: '+240', status: 'miss' },
          { text: 'Bijan Robinson over 88.5 rushing yards', player: 'Bijan Robinson', type: 'over', stat: 'Rush Yds', line: 88.5, game: 'Mon 7:15 PM @ NO', result: '19-145 rush yds', odds: '-111', status: 'hit' },
          { text: 'Ja’Marr Chase over 84.5 receiving yards', player: "Ja'Marr Chase", type: 'over', stat: 'Rec Yds', line: 84.5, game: 'Sun 12:00 PM vs JAX', result: '4.20 fantasy pts, so 42 rec yds at most', odds: '-110', status: 'miss' },
          { text: 'Brock Bowers over 73.5 receiving yards', player: 'Brock Bowers', type: 'over', stat: 'Rec Yds', line: 73.5, game: 'Sun 3:25 PM vs KC', odds: '-111', status: 'open' }
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
    ]
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
