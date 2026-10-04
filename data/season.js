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
    status: 'Live · late games in the 3rd and 4th quarters',
    // [current points, projected final]
    // Yahoo live as of Sun Oct 4, 5:34 PM CT.
    scores: {
      Matt: [52.48, 75.50], DLin: [94.20, 112.16],
      Tristan: [66.08, 103.64], Colin: [114.42, 124.12],
      Jerger: [74.60, 113.77], Kurt: [81.82, 95.53],
      Tony: [66.92, 83.17], Andy: [68.58, 104.66],
      'Mr. G': [66.40, 104.50], Pablo: [90.68, 108.59]
    },
    // Points so far for every player whose game has started (starters and bench).
    // Players listed in inProgress are still playing; the rest are final.
    playerPoints: {
      'Jordan Love': 14.08,
      'Christian McCaffrey': 5.30,
      'Garrett Wilson': 4.20,
      'Christian Watson': 6.20,
      'Trey McBride': 6.60,
      'Josh Downs': 3.10,
      'Cameron Dicker': 7.00,
      'Steelers': 6.00,
      'Justin Jefferson': 0.00,
      'Quinshon Judkins': 18.60,
      'Chris Godwin Jr.': 6.10,
      'Wan\'Dale Robinson': 9.50,
      'Xavier Worthy': 9.00,
      'MarShawn Lloyd': 7.40,
      'DeVonta Smith': 0.00,
      'Jayden Daniels': 0.00,
      'Jonathan Taylor': 22.20,
      'Cam Skattebo': 7.10,
      'George Pickens': 8.50,
      'Tee Higgins': 21.20,
      'Harold Fannin Jr.': 10.20,
      'Michael Wilson': 13.00,
      'Tyler Loop': 8.00,
      'Chiefs': 4.00,
      'Jalen Hurts': 13.52,
      'Jake Ferguson': 2.60,
      'Stefon Diggs': 6.00,
      'Brian Thomas Jr.': 8.70,
      'Kenny Gainwell': 9.70,
      'RJ Harvey': 6.60,
      'De\'Von Achane': 0.00,
      'Rico Dowdle': 0.00,
      'Lamar Jackson': 18.88,
      'Ashton Jeanty': 8.40,
      'KC Concepcion Jr.': 8.90,
      'Mike Evans': 6.50,
      'Aaron Jones Sr.': 11.40,
      'Evan McPherson': 5.00,
      'Bears': 7.00,
      'Ladd McConkey': 0.00,
      'Bhayshul Tuten': 10.10,
      'Rome Odunze': 12.40,
      'Blake Corum': 2.60,
      'Josh Jacobs': 0.00,
      'Bo Nix': 5.16,
      'A.J. Brown': 0.00,
      'Joe Burrow': 25.72,
      'Kyren Williams': 31.70,
      'Emanuel Wilson': 21.10,
      'Ja\'Marr Chase': 4.20,
      'Rashee Rice': 0.00,
      'Brock Bowers': 6.50,
      'Davante Adams': 5.20,
      'Spencer Shrader': 16.00,
      'Bills': 4.00,
      'Kyle Monangai': 27.50,
      'Patrick Mahomes': 10.34,
      'Denzel Boston': 10.90,
      'Jadarian Price': 0.00,
      'Zach Charbonnet': 0.00,
      'James Cook III': 15.30,
      'David Montgomery': 4.30,
      'CeeDee Lamb': 32.80,
      'Travis Kelce': 2.50,
      'Braelon Allen': 7.70,
      'Harrison Butker': 4.00,
      'Vikings': 8.00,
      'Malik Nabers': 20.20,
      'Tucker Kraft': 13.50,
      'Justin Herbert': 4.08,
      'J.K. Dobbins': 2.60,
      'Brock Purdy': 11.02,
      'Saquon Barkley': 1.50,
      'Kenneth Walker III': 7.80,
      'Zay Flowers': 21.80,
      'Jordan Addison': 3.90,
      'Colston Loveland': 8.70,
      'Jaylen Warren': 14.10,
      'Harrison Mevis': 7.00,
      'Broncos': 6.00,
      'Dak Prescott': 18.10,
      'Terry McLaurin': 0.00,
      'Emeka Egbuka': 2.30,
      'Courtland Sutton': 0.90,
      'Jacory Croskey-Merritt': 6.00,
      'Alec Pierce': 0.00,
      'Josh Allen': 19.52,
      'Bucky Irving': 6.10,
      'Omarion Hampton': 3.50,
      'Jaxon Smith-Njigba': 10.10,
      'Matthew Golden': 10.20,
      'Tyler Warren': 6.60,
      'George Kittle': 2.90,
      'Jason Myers': 3.00,
      'Eagles': 5.00,
      'TreVeyon Henderson': 4.20,
      'Dalton Kincaid': 1.20,
      'Carnell Tate': 17.00,
      'Matthew Stafford': 11.68,
      'Mike Washington Jr.': 1.80,
      'Ollie Gordon II': 16.80,
      'Trevor Lawrence': 13.08,
      'Javonte Williams': 28.80,
      'DJ Moore': 2.20,
      'Isaiah Likely': 10.10,
      'D\'Andre Swift': 6.40,
      'Chase McLaughlin': 2.00,
      'Ravens': 6.00,
      'Jaylen Waddle': 3.20,
      'Mark Andrews': 11.20,
      'Tre Tucker': 1.90,
      'Kalif Raymond': 1.60,
      'Rams': 5.00,
      'Chase Brown': 13.60,
      'Jeremiyah Love': 6.00,
      'Nico Collins': 27.30,
      'Kenyon Sadiq': 0.00,
      'Parker Washington': 1.50,
      'Eddy Pineiro': 3.00,
      'Seahawks': 15.00,
      'DK Metcalf': 14.00,
      'Drake Maye': 27.16,
      'Luther Burden III': 9.40,
      'Rhamondre Stevenson': 16.90,
      'Kyler Murray': 9.18,
      'Dallas Goedert': 0.00,
      'C.J. Stroud': 23.08,
      'Derrick Henry': 14.90,
      'Tony Pollard': 12.00,
      'Quentin Johnston': -0.40,
      'Dalton Schultz': 1.90,
      'Puka Nacua': 23.20,
      'Brandon Aubrey': 12.00,
      'Texans': 4.00,
      'Breece Hall': 0.00,
      'Caleb Williams': 0.00,
      'Geno Smith': 8.76,
      'Cairo Santos': 11.00
    },
    inProgress: [
      'Christian McCaffrey', 'Cameron Dicker', 'Justin Jefferson', 'Xavier Worthy', 'Chiefs',
      'RJ Harvey', 'De\'Von Achane', 'Ashton Jeanty', 'Mike Evans', 'Aaron Jones Sr.',
      'Ladd McConkey', 'Bo Nix', 'Emanuel Wilson', 'Rashee Rice', 'Brock Bowers',
      'Patrick Mahomes', 'Jadarian Price', 'Zach Charbonnet', 'Travis Kelce', 'Harrison Butker',
      'Vikings', 'Justin Herbert', 'J.K. Dobbins', 'Brock Purdy', 'Kenneth Walker III',
      'Jordan Addison', 'Broncos', 'Courtland Sutton', 'Omarion Hampton', 'Jaxon Smith-Njigba',
      'George Kittle', 'Jason Myers', 'Mike Washington Jr.', 'Ollie Gordon II', 'Jaylen Waddle',
      'Tre Tucker', 'Eddy Pineiro', 'Seahawks', 'Kyler Murray', 'Quentin Johnston'
    ],
    sheetNote: 'Live as of 5:34 PM CT. Orange = final points, white = still playing, gray = projection.'
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
  wire: { asOf: '2026-10-04T17:34:00', windowDays: 7 },

  // ---- Trash talk (hidden when the trashTalk setting is off) ----

  // Caption under the featured matchup, by week. While a week is live the featured
  // matchup can change, so tie the caption to it: { pair: ['Matt', 'DLin'], text }.
  // If another matchup takes over, the site writes a plain caption from the scores.
  captions: {
    1: 'Pablo held off Matt by 4.8. Pablo would like this one framed, since it may be a while.',
    2: 'DLin beat Kurt 100.6–89.4. Neither fan base was reached for comment.',
    3: 'Andy beat Colin by 3.9. Colin is expected to blame the kicker, the refs and Yahoo.',
    4: { pair: ['Matt', 'DLin'], text: 'Matt 114.79, DLin 114.46. A 0.33 projection gap. DLin leads 10.20–6.00 after Thursday, and Matt only pulled ahead by benching an injured Justin Jefferson for Josh Downs.' }
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
          { text: 'Jahmyr Gibbs anytime TD', player: 'Jahmyr Gibbs', type: 'td', game: 'Sun 7:20 PM @ CAR', odds: '-330', status: 'open' },
          { text: 'Drake London over 79.5 receiving yards', player: 'Drake London', type: 'over', stat: 'Rec Yds', line: 79.5, game: 'Mon 7:15 PM @ NO', odds: '-110', status: 'open' },
          { text: 'Ravens moneyline', player: 'Ravens', type: 'ml', game: 'Sun 12:00 PM vs TEN', result: 'Final W 24–18', odds: '-700', status: 'hit' }
        ],
        tailers: ['Tony'],
        booth: 'Andy asked for a “lock parlay.” There is no such thing. Tony is tailing it and is also Andy’s opponent this week, so Tony cashes either way.'
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
          { text: 'Bijan Robinson over 88.5 rushing yards', player: 'Bijan Robinson', type: 'over', stat: 'Rush Yds', line: 88.5, game: 'Mon 7:15 PM @ NO', odds: '-111', status: 'open' },
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
          { text: 'Chiefs −4.5 at Raiders', type: 'spread', team: 'KC', line: -4.5, teams: ['KC', 'LV'], sgp: 3, game: 'Sun 3:25 PM · KC @ LV', odds: null, status: 'open' },
          { text: 'Kenneth Walker III 2+ TDs', player: 'Kenneth Walker III', type: 'td', count: 2, sgp: 3, game: 'Sun 3:25 PM · KC @ LV', odds: null, status: 'open' }
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
