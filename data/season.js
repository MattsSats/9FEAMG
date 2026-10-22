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
    { m: 'Tristan', init: 'T_', hue: 250 },
    { m: 'Andy', init: 'AN', hue: 150 },
    { m: 'Matt', init: 'MA', hue: 305 },
    { m: 'Kurt', init: 'KU', hue: 95 },
    { m: 'Jerger', init: 'JJ', hue: 205 },
    { m: 'Mr. G', init: 'MG', hue: 0 },
    { m: 'Colin', init: 'CG', hue: 125 },
    { m: 'DLin', init: 'DL', hue: 340 },
    { m: 'Pablo', init: 'PA', hue: 65 }
  ],

  // Matchups by week.
  schedule: {
    1: [['Pablo', 'Matt'], ['Tony', 'Colin'], ['Tristan', 'Kurt'], ['Andy', 'Jerger'], ['Mr. G', 'DLin']],
    2: [['DLin', 'Kurt'], ['Tony', 'Mr. G'], ['Tristan', 'Jerger'], ['Matt', 'Andy'], ['Colin', 'Pablo']],
    3: [['Andy', 'Colin'], ['Tony', 'Pablo'], ['Tristan', 'Matt'], ['DLin', 'Jerger'], ['Kurt', 'Mr. G']],
    4: [['Tony', 'Andy'], ['Tristan', 'Colin'], ['Matt', 'DLin'], ['Jerger', 'Kurt'], ['Mr. G', 'Pablo']],
    5: [['Matt', 'Kurt'], ['Tristan', 'Tony'], ['Jerger', 'Mr. G'], ['Colin', 'DLin'], ['Andy', 'Pablo']],
    6: [['Matt', 'Jerger'], ['Tristan', 'Pablo'], ['Tony', 'DLin'], ['Kurt', 'Colin'], ['Mr. G', 'Andy']],
    // The rest of the regular season, from Yahoo's matchup pages (Wed Oct 14), for the playoff odds.
    7: [['Matt', 'Mr. G'], ['Tristan', 'Andy'], ['Jerger', 'Colin'], ['Tony', 'Kurt'], ['DLin', 'Pablo']],
    8: [['Matt', 'Colin'], ['Tristan', 'Mr. G'], ['Jerger', 'Tony'], ['Kurt', 'Pablo'], ['Andy', 'DLin']],
    9: [['Matt', 'Tony'], ['Tristan', 'DLin'], ['Jerger', 'Pablo'], ['Kurt', 'Andy'], ['Colin', 'Mr. G']],
    10: [['Matt', 'Pablo'], ['Tristan', 'Kurt'], ['Jerger', 'Andy'], ['Tony', 'Colin'], ['Mr. G', 'DLin']],
    11: [['Matt', 'Andy'], ['Tristan', 'Jerger'], ['Tony', 'Mr. G'], ['Kurt', 'DLin'], ['Colin', 'Pablo']],
    12: [['Matt', 'Tristan'], ['Jerger', 'DLin'], ['Tony', 'Pablo'], ['Kurt', 'Mr. G'], ['Colin', 'Andy']],
    13: [['Matt', 'DLin'], ['Tristan', 'Colin'], ['Jerger', 'Kurt'], ['Tony', 'Andy'], ['Mr. G', 'Pablo']],
    14: [['Matt', 'Kurt'], ['Tristan', 'Tony'], ['Jerger', 'Mr. G'], ['Colin', 'DLin'], ['Andy', 'Pablo']]
  },

  // Final scores (Yahoo, two decimals), one per completed week.
  scores: {
    Tony: [123.06, 154.52, 95.42, 90.82, 142.40, 117.40],
    Tristan: [144.36, 104.10, 121.64, 125.88, 113.28, 86.92],
    Andy: [139.34, 75.96, 127.98, 96.38, 148.44, 119.72],
    Matt: [107.86, 105.64, 114.48, 92.08, 136.68, 106.14],
    Kurt: [100.60, 89.36, 135.88, 112.22, 116.54, 112.76],
    Jerger: [124.06, 92.60, 102.14, 113.66, 112.32, 119.54],
    'Mr. G': [135.22, 84.42, 75.06, 93.84, 109.76, 90.90],
    Colin: [65.66, 100.08, 124.14, 129.92, 133.20, 61.58],
    DLin: [99.82, 100.56, 82.52, 114.68, 92.62, 72.12],
    Pablo: [112.66, 70.92, 86.38, 133.78, 113.04, 66.50]
  },

  // The week in progress. Set to null between weeks.
  live: {
    week: 7,
    status: 'Kicks off Thursday · NE @ CHI, 7:15 PM',
    // When these numbers were pulled from Yahoo (Central); shows as "Scores as of Thu 10:19 PM".
    asOf: '2026-10-21T19:43:00-05:00',
    // [current points, projected final]
    // Yahoo as of Wed Oct 21, 7:43 PM CT (Week 7 matchup pages).
    scores: {
      Matt: [0.00, 115.15], 'Mr. G': [0.00, 114.54],
      Tristan: [0.00, 112.22], Andy: [0.00, 120.23],
      Jerger: [0.00, 102.97], Colin: [0.00, 107.03],
      Tony: [0.00, 113.57], Kurt: [0.00, 109.47],
      DLin: [0.00, 97.23], Pablo: [0.00, 113.15]
    },
    yahooWin: { Tony: 54, Tristan: 43, Andy: 57, Matt: 51, Kurt: 46, Jerger: 46, 'Mr. G': 49, Colin: 54, DLin: 36, Pablo: 64 },
    // Points so far for every player whose game has started (starters and bench).
    // Players listed in inProgress are still playing; the rest are final.
    playerPoints: {},
    inProgress: [],
    sheetNote: 'Week 7 projections as of Wed 7:43 PM CT. Each player is tagged Final, Live or proj.'
  },

  // The NFL week: every game ('Sun 12:00 PM · CHI @ GB', kickoff Central, same form as parlay legs)
  // and the teams on bye. Lineups use it for kickoff times and bye/empty-slot alerts.
  // Weeks 1-6 from ESPN's scoreboard; Week 6 re-checked against it Wed Oct 14.
  nfl: {
    1: {
      games: ['Wed 7:20 PM · NE @ SEA', 'Thu 7:35 PM · SF @ LAR', 'Sun 12:00 PM · TB @ CIN', 'Sun 12:00 PM · NO @ DET',
        'Sun 12:00 PM · NYJ @ TEN', 'Sun 12:00 PM · BAL @ IND', 'Sun 12:00 PM · ATL @ PIT', 'Sun 12:00 PM · CHI @ CAR',
        'Sun 12:00 PM · CLE @ JAX', 'Sun 12:00 PM · BUF @ HOU', 'Sun 3:25 PM · MIA @ LV', 'Sun 3:25 PM · GB @ MIN',
        'Sun 3:25 PM · WSH @ PHI', 'Sun 3:25 PM · ARI @ LAC', 'Sun 7:20 PM · DAL @ NYG', 'Mon 7:15 PM · DEN @ KC'],
      byes: []
    },
    2: {
      games: ['Thu 7:15 PM · DET @ BUF', 'Sun 12:00 PM · CAR @ ATL', 'Sun 12:00 PM · MIN @ CHI', 'Sun 12:00 PM · PHI @ TEN',
        'Sun 12:00 PM · PIT @ NE', 'Sun 12:00 PM · GB @ NYJ', 'Sun 12:00 PM · CLE @ TB', 'Sun 12:00 PM · NO @ BAL',
        'Sun 12:00 PM · CIN @ HOU', 'Sun 3:05 PM · JAX @ DEN', 'Sun 3:05 PM · LV @ LAC', 'Sun 3:25 PM · WSH @ DAL',
        'Sun 3:25 PM · SEA @ ARI', 'Sun 3:25 PM · MIA @ SF', 'Sun 7:20 PM · IND @ KC', 'Mon 7:15 PM · NYG @ LAR'],
      byes: []
    },
    3: {
      games: ['Thu 7:15 PM · ATL @ GB', 'Sun 12:00 PM · LAC @ BUF', 'Sun 12:00 PM · CAR @ CLE', 'Sun 12:00 PM · NYJ @ DET',
        'Sun 12:00 PM · HOU @ IND', 'Sun 12:00 PM · KC @ MIA', 'Sun 12:00 PM · TEN @ NYG', 'Sun 12:00 PM · CIN @ PIT',
        'Sun 12:00 PM · SEA @ WSH', 'Sun 12:00 PM · NE @ JAX', 'Sun 3:05 PM · ARI @ SF', 'Sun 3:05 PM · MIN @ TB',
        'Sun 3:25 PM · BAL @ DAL', 'Sun 3:25 PM · LV @ NO', 'Sun 7:20 PM · LAR @ DEN', 'Mon 7:15 PM · PHI @ CHI'],
      byes: []
    },
    4: {
      games: ['Thu 7:15 PM · PIT @ CLE', 'Sun 8:30 AM · IND @ WSH', 'Sun 12:00 PM · NE @ BUF', 'Sun 12:00 PM · NYJ @ CHI',
        'Sun 12:00 PM · JAX @ CIN', 'Sun 12:00 PM · ARI @ NYG', 'Sun 12:00 PM · LAR @ PHI', 'Sun 12:00 PM · GB @ TB',
        'Sun 12:00 PM · TEN @ BAL', 'Sun 12:00 PM · DAL @ HOU', 'Sun 3:05 PM · MIA @ MIN', 'Sun 3:25 PM · KC @ LV',
        'Sun 3:25 PM · DEN @ SF', 'Sun 3:25 PM · LAC @ SEA', 'Sun 7:20 PM · DET @ CAR', 'Mon 7:15 PM · ATL @ NO'],
      byes: []
    },
    5: {
      games: ['Thu 7:15 PM · TB @ DAL', 'Sun 8:30 AM · PHI @ JAX', 'Sun 12:00 PM · CHI @ GB', 'Sun 12:00 PM · HOU @ TEN',
        'Sun 12:00 PM · CIN @ MIA', 'Sun 12:00 PM · LV @ NE', 'Sun 12:00 PM · MIN @ NO', 'Sun 12:00 PM · CLE @ NYJ',
        'Sun 12:00 PM · IND @ PIT', 'Sun 12:00 PM · NYG @ WAS', 'Sun 3:05 PM · DEN @ LAC', 'Sun 3:25 PM · DET @ ARI',
        'Sun 3:25 PM · SF @ SEA', 'Sun 7:20 PM · BAL @ ATL', 'Mon 7:15 PM · BUF @ LAR'],
      byes: ['CAR', 'KC']
    },
    6: {
      games: [
        'Thu 7:15 PM · SEA @ DEN', 'Sun 8:30 AM · HOU @ JAX', 'Sun 12:00 PM · CHI @ ATL', 'Sun 12:00 PM · BAL @ CLE',
        'Sun 12:00 PM · TEN @ IND', 'Sun 12:00 PM · NYJ @ NE', 'Sun 12:00 PM · NO @ NYG', 'Sun 12:00 PM · CAR @ PHI',
        'Sun 12:00 PM · PIT @ TB', 'Sun 3:05 PM · ARI @ LAR', 'Sun 3:25 PM · LAC @ KC', 'Sun 3:25 PM · BUF @ LV',
        'Sun 7:20 PM · DAL @ GB', 'Mon 7:15 PM · WAS @ SF'
      ],
      byes: ['CIN', 'DET', 'MIA', 'MIN']
    },
    7: {
      games: [
        'Thu 7:15 PM · NE @ CHI', 'Sun 8:30 AM · PIT @ NO', 'Sun 12:00 PM · SF @ ATL', 'Sun 12:00 PM · CLE @ TEN',
        'Sun 12:00 PM · IND @ MIN', 'Sun 12:00 PM · MIA @ NYJ', 'Sun 12:00 PM · TB @ CAR', 'Sun 12:00 PM · CIN @ BAL',
        'Sun 12:00 PM · NYG @ HOU', 'Sun 3:05 PM · DEN @ ARI', 'Sun 3:25 PM · GB @ DET', 'Sun 3:25 PM · LAR @ LV',
        'Sun 7:20 PM · KC @ SEA', 'Mon 7:15 PM · DAL @ PHI'
      ],
      byes: ['BUF', 'JAX', 'LAC', 'WAS']
    }
  },

  // Thursday of Week 1. Each leg's kickoff ('Thu 7:15 PM · TB @ DAL') counts from that week's
  // Thursday, which is how tails lock when a ticket's first game starts.
  week1Thursday: '2026-09-10',

  // Shown on the week after the live one.
  next: {
    week: 8,
    dates: 'Oct 29–Nov 2',
    note: 'Week 8 matchups post once Week 7 goes final.'
  },

  // Player projections for the live week, used when the roster file has none.
  // Fill in every manager's players or leave empty; a partial list makes one team look different.
  // Projected values show in gray with "proj" so they never read as live points.
  projections: {},

  // Wire tab: "This week" is the fantasy week (from the end of last week's Monday night game).
  wire: {},

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
      ['Matt', 'Pablo beat Matt by 4.80 because Matt benched Watson’s 29.70 to start DeVonta’s 6.80. Unlucky is one word for it.', '2026-10-06T22:16-05:00'],
      ['Colin', 'Colin opened the season with 65.66, lowest of the week, and lost to Tony by 57.40. Tony thanks Colin for the service.', '2026-10-06T19:47-05:00'],
      ['Kurt', 'Tristan put up 144.36, the top score of the week, and beat Kurt by 43.76. Kurt started Loveland, who scored 0.00.', '2026-10-06T19:47-05:00'],
      ['Jerger', 'Jerger scored 124.06, fourth-best of the week, and lost to Andy anyway. Starting Dart over Herbert still comes up 2.94 short.', '2026-10-06T22:16-05:00'],
      ['Mr. G', 'Mr. G opened with 135.22, third-best of the week, and beat DLin by 35.40. Not bad for someone who’s definitely not a Boomer.', '2026-10-06T22:16-05:00']
    ],
    2: [
      ['Kurt', 'DLin beat Kurt by 11.20 with Goff’s 29.78 on the bench. Kurt’s first-round pick Saquon scored 2.50, and Kurt is 0–2.', '2026-10-06T22:16-05:00'],
      ['Mr. G', 'Tony dropped 154.52 on Mr. G, the top score of the season so far, and won by 70.10. Mr. G has asked that the tape not be shared.', '2026-10-06T19:47-05:00'],
      ['Jerger', 'Tristan beat Jerger by 11.50, and Jerger had Kelce’s 20.60 on the bench behind Nabers’ 0.60. Yahoo’s #1 fan, everybody.', '2026-10-06T22:16-05:00'],
      ['Andy', 'Andy scored 75.96 and lost to Matt by 29.68. DJ Moore started and finished at −0.10. The gibbing has paused.', '2026-10-06T19:47-05:00'],
      ['Pablo', 'Colin benched Davante’s 35.50 and still beat Pablo by 29.16. Pablo’s 70.92 was the lowest score of the week.', '2026-10-06T22:16-05:00']
    ],
    3: [
      ['Colin', 'Colin lost to Andy by 3.84 with Burrow’s 22.58 on the bench while Mahomes started for 16.94. That swap wins it.', '2026-10-06T22:16-05:00'],
      ['Tony', 'Tony went to 3–0 with 95.42, seventh-best of the week, because Pablo started Schultz (4.50) over Juwan Johnson (19.30). Fraud watch begins.', '2026-10-06T22:16-05:00'],
      ['Matt', 'Matt lost to Tristan by 7.16 with Watson’s 19.10 on the bench, again. Jefferson started and scored 4.20.', '2026-10-06T22:16-05:00'],
      ['DLin', 'DLin managed 82.52 and lost to Jerger by 19.62 with Fannin’s 20.60 on the bench. Toilet Bowl King is starting to look like a mission statement.', '2026-10-06T19:47-05:00'],
      ['Mr. G', 'Mr. G started Maye over Shough for the second straight week: Maye 5.76, Shough 24.80. Kurt won by 60.82 for a first win.', '2026-10-06T22:16-05:00']
    ],
    4: [
      ['Tony', 'Andy won by 5.56 because Tony benched Ollie Gordon II’s 17.00 for Bucky’s 6.10. Tony’s first loss was self-inflicted.', '2026-10-06T21:50-05:00'],
      ['Tristan', 'Tristan scored 125.88, third-best in the league, lost to Colin anyway, and declared the season over. Tristan is still in first.', '2026-10-06T21:50-05:00'],
      ['Matt', 'Matt lost by 22.60 to the reigning Toilet Bowl King. DLin’s JT and Higgins outscored Matt’s three starting receivers by 29.90.', '2026-10-06T22:16-05:00'],
      ['Kurt', 'Jerger left Nabers’ 20.20 on the bench and still won, because Kurt started Saquon (1.50) over JCM (6.00). Two bad lineups, one loser.', '2026-10-06T21:50-05:00'],
      ['Mr. G', 'Pablo was projected to lose to Mr. G by 30.35 and won by 39.94. Opponents keep saving their best for Mr. G.', '2026-10-06T21:50-05:00']
    ],
    5: [
      ['Matt', 'Kurt set a lineup 2.52 points from perfect and still lost to Matt by 20.14, with Daniels’ 32.26 sitting on Matt’s bench. Kurt did the homework, and Matt got the grade.', '2026-10-13T18:19-05:00'],
      ['Tony', 'The Booth put Tony on fraud watch Wednesday. Tony scored 142.40, beat Tristan by 29.12 and took first with the league’s best luck. The watch continues, from first place.', '2026-10-13T18:19-05:00'],
      ['Jerger', 'Jerger beat Mr. G by 2.56 because Mr. G started Jeremiyah Love (2.20) over Stevenson (16.00). Jerger has won the season’s two closest games, and both came gift-wrapped.', '2026-10-13T18:19-05:00'],
      ['DLin', 'DLin was projected to beat Colin and lost by 40.58 with 92.62, the week’s lowest, as Higgins and Fannin combined for 4.10. The projections lied, and DLin believed them.', '2026-10-13T18:19-05:00'],
      ['Pablo', 'Take Gibbs’ 35.20 out of Andy’s week-best 148.44 and Andy still beats Pablo by 0.20. The gibbing was optional.', '2026-10-13T18:19-05:00']
    ],
    6: [
      ['Jerger', 'The Booth said Jerger’s streak was living on credit. Jerger beat Matt 119.54–106.14, the projected loser, for four straight. The Booth would like to settle up.', '2026-10-19T23:50-05:00'],
      ['Pablo', 'Pablo lost to Tristan by 20.42 while Pitts scored 20.50 on the bench and Juwan Johnson started for 0.00. That swap wins it by 0.08.', '2026-10-19T23:50-05:00'],
      ['Tony', 'DLin got 0.00 from Skattebo, and Tony won by 45.28 to go 5–1. Tony’s luck is still +1.44, but the fraud watch is running out of evidence.', '2026-10-19T23:50-05:00'],
      ['Colin', 'Colin made a league-high 31 adds and posted the season’s lowest score, 61.58, as Kurt won by 51.18. Average Sports Enthusiast, above-average Sunday.', '2026-10-19T23:50-05:00'],
      ['Andy', 'Andy put up the week’s top score, 119.72, with Lawrence’s 28.34 on the bench, and handed Mr. G a fifth straight loss. It’s gibbing time, even with Gibbs on bye.', '2026-10-19T23:50-05:00']
    ]
  },
  // The day each week's previews were written; each line's own time (third field) wins when it has one.
  boothPreviewAt: { 5: '2026-10-07', 6: '2026-10-15' },
  // The Booth's picks, made with the previews: [pick, win % when picked], one per matchup in schedule
  // order. The win % is check.js's "Win odds" line before kickoff. The site grades them once the week is
  // final and keeps the season record.
  boothPicks: {
    6: [['Matt', 60], ['Tristan', 62], ['Tony', 68], ['Colin', 69], ['Mr. G', 62]]
  },
  // Jerger's weekly preview picks ("the experts"): one name per matchup in schedule order, graded
  // like the Booth's (Matt, Oct 20, 2026; Jerger agreed). Only the pick goes here; the write-up stays private.
  expertPicks: {
    6: ['Matt', 'Pablo', 'Tony', 'Kurt', 'Mr. G']
  },
  // Tristan's weekly power rankings, 1 to 10 (Matt, Oct 20, 2026; Tristan agreed). Rank order only; the
  // Season tab shows it beside the site's own power rankings for the same week.
  tristanRanks: {
    6: ['Tony', 'Kurt', 'Andy', 'Jerger', 'Matt', 'Colin', 'Pablo', 'DLin', 'Mr. G', 'Tristan']
  },
  // Post-SNF lines, one per matchup in the same order: written Sunday after the night game, with
  // what each matchup still needs on Monday. [manager, line, written at].
  boothSnf: {
    5: [
      ['Matt', 'Matt scored 136.68, second-best of the week so far, and Kurt needs 24.15 from a kicker. There is no 2nd best, apparently.', '2026-10-11T22:48-05:00'],
      ['Tristan', 'Tristan benched Evans’ 22.80 to start Doubs for 2.10, and now Tony needs 2.39 from Josh Allen. Bring back the tilt.', '2026-10-11T22:48-05:00'],
      ['Jerger', 'Opponents usually save their best for Mr. G. Jerger brought 90.02 and needs 19.75 from Cook, projected for 13.91, to keep the tradition alive.', '2026-10-11T22:48-05:00'],
      ['Colin', 'Colin leads DLin by 4.38, and CeeDee scored 1.90 for Jerger. C Lambs Biggest Hater wins twice.', '2026-10-11T22:48-05:00'],
      ['Pablo', 'Pablo had the top score in Week 4 at 133.78 and has the lowest so far in Week 5 at 83.84. Andy, sitting on 148.44, sends regards.', '2026-10-11T22:48-05:00']
    ]
  },
  boothPreview: {
    // Week 6: the Booth's pass (done by Claude agents at Matt's request, Thu Oct 15, before TNF) on
    // Claude's drafts, from Yahoo's Wed 11:23 PM projections and the season math through Week 5.
    6: [
      ['Jerger', 'Jerger has won three straight with a 21–24 all-play record. In 5th vs. 6th, Matt is projected to win 118.97–110.75. That streak has been living on credit.', '2026-10-15T00:35-05:00'],
      ['Tristan', 'Tristan cut backup QB Brissett on Wednesday for Germie Bernard, so a questionable Lamar is Squirtle Squad’s only QB. Projected 111.88–102.81 over Pablo, as long as Lamar plays.', '2026-10-15T00:35-05:00'],
      ['DLin', 'Pre-kickoff playoff odds give Tony 97% and DLin 24%, and Yahoo projects Tony 115.49–101.35. The projections lied about DLin last week. This time DLin needs them to.', '2026-10-15T00:35-05:00'],
      ['Kurt', 'Kurt sets the league’s most efficient lineups and is 1–4; Colin has made 29 adds and is 3–2. Projected 116.51–101.31, Colin. Tinkering keeps beating homework.', '2026-10-15T00:35-05:00'],
      ['Andy', 'Last-place Mr. G is projected to beat Andy 109.60–99.78, and Andy is helping by starting waiver pickup Winston (14.63) over Lawrence (17.88). Gibbs is on bye, and so is the gibbing.', '2026-10-15T00:35-05:00']
    ],
    5: [
      ['Matt', 'The 1–3 bowl, between the two unluckiest teams in the league: Kurt at −1.00 and Matt at −0.89. Projected 115.63–100.37, Matt. “There is no 2nd best” is 9th.', '2026-10-07T08:54-05:00'],
      ['Tony', 'First vs. second, both 3–1, projected 114.57–109.42 for Tristan. Tony has the league’s best luck at +1.11 and the 7th-best power ranking. Fraud watch is on.', '2026-10-07T08:54-05:00'],
      ['Mr. G', 'Mr. G is projected to beat Jerger 116.16–106.04. Mr. G has also allowed 524.00 points in four weeks, so Jerger knows the assignment.', '2026-10-07T08:54-05:00'],
      ['Colin', 'Both 2–2, Colin 5th and DLin 7th, with the playoff line between them. Colin has 28 adds this season and the worst lineup efficiency in the league, 79.1%.', '2026-10-07T08:54-05:00'],
      ['Pablo', 'Andy is 3–1. Pablo is 2–2 and 6th, right on the playoff line, a week after putting up the top score at 133.78. The team name is “He was #1,” and for one week, Pablo was.', '2026-10-10T10:10-05:00']
    ]
  },

  // The Booth Parlay, by week. Shows under All matchups, with a season ledger
  // ($10 flat stakes) underneath.
  //   legs[].text   what the bet is
  //   legs[].player Yahoo player name, or the team name for a defense/moneyline
  //                 ('Ravens'). The site tags whose fantasy roster it's on and
  //                 shows the player's fantasy points once they're in.
  //   legs[].type   'td' (anytime TD; count: 2 for 2+ TDs), 'over' (player stat;
  //                 needs stat + line), 'under' (player stat under, e.g. against a fantasy
  //                 opponent's starter; stat + line), 'ml' (moneyline), 'spread' (team + line,
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
  //   legs[].vs     optional: the other side's price at the same book and time ('-112' for
  //                 Raiders +5.5 against Bills -5.5 at '-108'). With it the card shows the fair
  //                 (no-vig) price and the book's edge: "Parlay +603 · fair +707 · book edge 13%".
  //   legs[].fair   optional instead of vs: the leg's no-vig chance (0.4957). The fair price
  //                 shows only when every priced leg has one; anytime TDs usually can't (the
  //                 book only offers Yes) unless they carry a ladder, and book-priced or
  //                 same-game tickets never do.
  //   legs[].ladder TD legs only (they have no No side): the book's 1+, 2+ and 3+ TD prices
  //                 for that player from the same pull (['-190', '+285', '+1100']). The site
  //                 estimates the fair chance from them (the only estimate it makes) and shows
  //                 "fair ~+X (est.) · book edge ~Y%".
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
          { text: 'Packers moneyline vs Bears', type: 'ml', team: 'GB', teams: ['Chi', 'GB'], game: 'Sun 12:00 PM · CHI @ GB', odds: '+102', result: 'Final W 31–7', status: 'hit' },
          { text: '49ers moneyline at Seahawks', type: 'ml', team: 'SF', teams: ['SF', 'Sea'], game: 'Sun 3:25 PM · SF @ SEA', odds: '+136', result: 'Final W 32–29', status: 'hit' },
          { text: 'Jets moneyline vs Browns', type: 'ml', team: 'NYJ', teams: ['Cle', 'NYJ'], game: 'Sun 12:00 PM · CLE @ NYJ', odds: '-130', result: 'Final W 17–12', status: 'hit' },
          { text: 'Cardinals moneyline vs Lions', type: 'ml', team: 'Ari', teams: ['Det', 'Ari'], game: 'Sun 3:25 PM · DET @ ARI', odds: '+210', result: 'Final L 21–45', status: 'miss' },
          { text: 'Chargers moneyline vs Broncos', type: 'ml', team: 'LAC', teams: ['Den', 'LAC'], game: 'Sun 3:05 PM · DEN @ LAC', odds: '+160', result: 'Final L 17–23', status: 'miss' },
          { text: 'Steelers moneyline vs Colts', type: 'ml', team: 'Pit', teams: ['Ind', 'Pit'], game: 'Sun 12:00 PM · IND @ PIT', odds: '-148', result: 'Final W 34–22', status: 'hit' }
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
          { text: 'Josh Allen 250+ passing yards', player: 'Josh Allen', type: 'over', stat: 'Pass Yds', line: 249.5, game: 'Mon 7:15 PM · BUF @ LAR', odds: '+101', result: '210 pass yds', status: 'miss' },
          { text: 'Jaxon Smith-Njigba anytime TD', player: 'Jaxon Smith-Njigba', type: 'td', count: 1, game: 'Sun 3:25 PM · SF @ SEA', odds: '-120', result: '16-yd rec TD (Q3)', status: 'hit' },
          { text: 'Eagles moneyline at Jaguars', player: 'Eagles', type: 'ml', team: 'Phi', teams: ['Phi', 'Jax'], game: 'Sun 8:30 AM · PHI @ JAX', odds: '+280', result: 'Final L 17–19', status: 'miss' },
          { text: 'Chargers moneyline vs Broncos', type: 'ml', team: 'LAC', teams: ['Den', 'LAC'], game: 'Sun 3:05 PM · DEN @ LAC', odds: '+154', result: 'Final L 17–23', status: 'miss' }
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
          { text: 'Josh Allen anytime TD', player: 'Josh Allen', type: 'td', count: 1, game: 'Mon 7:15 PM · BUF @ LAR', odds: '-120', result: '1 rush TD (10-121)', status: 'hit' },
          { text: 'Jaxon Smith-Njigba anytime TD', player: 'Jaxon Smith-Njigba', type: 'td', count: 1, game: 'Sun 3:25 PM · SF @ SEA', odds: '-110', result: '16-yd rec TD (Q3)', status: 'hit' },
          { text: 'Dolphins moneyline vs Bengals', player: 'Dolphins', type: 'ml', team: 'Mia', teams: ['Cin', 'Mia'], game: 'Sun 12:00 PM · CIN @ MIA', odds: '+280', result: 'Final L 24–31', status: 'miss' },
          { text: 'Titans moneyline vs Texans', player: 'Titans', type: 'ml', team: 'Ten', teams: ['Hou', 'Ten'], game: 'Sun 12:00 PM · HOU @ TEN', odds: '+295', result: 'Final L 3–26', status: 'miss' }
        ]
      },
      {
        owner: 'Colin', title: 'In-House Lottery', request: 'Colin', requestAt: '2026-10-10T05:16:10.650Z',
        // Built by Claude for Colin's request (Sat Oct 10, 12:16 AM CT: Lottery +5000 and up, any legs,
        // no picks). All four legs are Colin's own starters, one per game. Four anytime TDs came to
        // about +2255, so Kyren Williams goes for 2+ TDs. Chase is listed Q on Yahoo.
        // Odds: DraftKings via The Odds API, Sat Oct 10, 12:21 AM CT. Ticket ≈ +6276.
        legs: [
          { text: 'Kyren Williams 2+ TDs', player: 'Kyren Williams', type: 'td', count: 2, game: 'Mon 7:15 PM · BUF @ LAR', odds: '+340', result: '1 rush TD (16-49 rush, 6-27 rec)', status: 'miss' },
          { text: 'Ja’Marr Chase anytime TD', player: "Ja'Marr Chase", type: 'td', count: 1, game: 'Sun 12:00 PM · CIN @ MIA', odds: '-125', result: '1 rec TD (6-77)', status: 'hit' },
          { text: 'Brock Bowers anytime TD', player: 'Brock Bowers', type: 'td', count: 1, game: 'Sun 12:00 PM · LV @ NE', odds: '+130', result: '1 rec TD (8-110)', status: 'hit' },
          { text: 'Deebo Samuel anytime TD', player: 'Deebo Samuel Sr.', type: 'td', count: 1, game: 'Sun 3:25 PM · SF @ SEA', odds: '+250', result: 'No TD (2-4 rush, 2-21 rec), left injured', status: 'miss' }
        ]
      },
      {
        owner: 'Tristan', title: 'Late Window', request: 'Tristan', requestAt: '2026-10-10T16:04:31.265Z',
        // Built by Claude for Tristan's request (Sat Oct 10, 11:04 AM CT: Long shot +1500 to +5000,
        // 4 legs, Bijan Robinson TD, Bhayshul Tuten TD, Aaron Jones typed in). Tuten's London game
        // was already under way, so Matt swapped that leg for Jones yards (Sun). LaPorta and Evans
        // are Tristan's own players; one leg per game.
        // Odds: DraftKings. Jones 70+ rushing yards is a live price from Matt's DraftKings app
        // screenshot, Sun Oct 11, ~12:20 PM CT (1st quarter, 9:04 left, Jones 2-7). The rest
        // DraftKings via The Odds API, Sun Oct 11, 12:28 PM CT. Ticket ≈ +2136.
        legs: [
          { text: 'Aaron Jones Sr. 70+ rushing yards', player: 'Aaron Jones Sr.', type: 'over', stat: 'Rush Yds', line: 69.5, game: 'Sun 12:00 PM · MIN @ NO', odds: '+100', result: '25-113 rush yds, 1 TD', status: 'hit' },
          { text: 'Sam LaPorta anytime TD', player: 'Sam LaPorta', type: 'td', count: 1, game: 'Sun 3:25 PM · DET @ ARI', odds: '+165', result: '38-yd rec TD (Q2)', status: 'hit' },
          { text: 'Mike Evans anytime TD', player: 'Mike Evans', type: 'td', count: 1, game: 'Sun 3:25 PM · SF @ SEA', odds: '+190', result: '2-yd rec TD (Q1)', status: 'hit' },
          { text: 'Bijan Robinson anytime TD', player: 'Bijan Robinson', type: 'td', count: 1, game: 'Sun 7:20 PM · BAL @ ATL', odds: '-220', result: 'No TD (17-86 rush, 4-32 rec)', status: 'miss' }
        ]
      },
      {
        owner: 'The Booth', init: 'TB', title: 'Booth’s Parlay', id: 'booths-parlay',
        // Claude's own long shot for the games left after the 3:05 kickoff: four anytime TDs, one per
        // game, each team's main red-zone target. Graded against a 100-point rubric (rules, target
        // odds, hit chance per dollar, football case per leg, independence, price sense) by Claude
        // and by an independent agent; built until the two averaged 95 or better.
        // Odds: DraftKings via The Odds API, Sun Oct 11, 3:01 PM CT. Ticket ≈ +2540.
        legs: [
          { text: 'Trey McBride anytime TD', player: 'Trey McBride', type: 'td', count: 1, game: 'Sun 3:25 PM · DET @ ARI', odds: '+100', result: '9-yd rec TD (Q4, 2:11)', status: 'hit' },
          { text: 'Mike Evans anytime TD', player: 'Mike Evans', type: 'td', count: 1, game: 'Sun 3:25 PM · SF @ SEA', odds: '+200', result: '2-yd rec TD (Q1)', status: 'hit' },
          { text: 'Drake London anytime TD', player: 'Drake London', type: 'td', count: 1, game: 'Sun 7:20 PM · BAL @ ATL', odds: '+120', result: 'No TD (7-118 rec)', status: 'miss' },
          { text: 'Davante Adams anytime TD', player: 'Davante Adams', type: 'td', count: 1, game: 'Mon 7:15 PM · BUF @ LAR', odds: '+100', result: '2 rec TDs (5-51)', status: 'hit' }
        ],
        booth: 'The Booth’s long shot: four red-zone targets in four games. McBride in the highest total of the day, Evans with the 49ers chasing in Seattle, London at home, and Adams on Monday night. For fun, not a lock.'
      },
      {
        owner: 'Andy', title: 'Ground and Pound', request: 'Andy', requestAt: '2026-10-07T13:51:36.692Z',
        // Built by Claude for Andy's Balanced request (+250 to +600, any legs, Javonte Williams TD
        // and Jahmyr Gibbs TD). Both TDs come to +75, so a third leg: the Giants moneyline (Andy
        // starts Giants TE Isaiah Likely). One leg per game, so the odds multiply: +338.
        // Odds: DraftKings via The Odds API, Wed Oct 7, 9:24 AM CT.
        legs: [
          { text: 'Javonte Williams anytime TD', player: 'Javonte Williams', type: 'td', count: 1, game: 'Thu 7:15 PM · TB @ DAL', odds: '-230', result: '1 rush TD (12-45)', status: 'hit' },
          { text: 'Jahmyr Gibbs anytime TD', player: 'Jahmyr Gibbs', type: 'td', count: 1, game: 'Sun 3:25 PM · DET @ ARI', odds: '-450', result: '2 rush TDs (Q2, Q4)', status: 'hit' },
          { text: 'Giants moneyline at Commanders', player: 'Giants', type: 'ml', team: 'NYG', teams: ['NYG', 'Was'], game: 'Sun 12:00 PM · NYG @ WAS', odds: '+150', result: 'Final T 27–27 · tie, voided', status: 'push' }
        ]
      },
      {
        owner: 'Andy', title: 'Ground and Pound (Juiced)',
        // Andy's juiced take on Ground and Pound (his text, Wed Oct 7): Williams and Gibbs each
        // need two TDs instead of one; the Giants moneyline stays. Not marked placed.
        // Odds: DraftKings via The Odds API, Wed Oct 7, 3:32 PM CT.
        legs: [
          { text: 'Javonte Williams 2+ TDs', player: 'Javonte Williams', type: 'td', count: 2, game: 'Thu 7:15 PM · TB @ DAL', odds: '+245', result: '1 rush TD (12-45)', status: 'miss' },
          { text: 'Jahmyr Gibbs 2+ TDs', player: 'Jahmyr Gibbs', type: 'td', count: 2, game: 'Sun 3:25 PM · DET @ ARI', odds: '+115', result: '2 rush TDs (Q2, Q4)', status: 'hit' },
          { text: 'Giants moneyline at Commanders', player: 'Giants', type: 'ml', team: 'NYG', teams: ['NYG', 'Was'], game: 'Sun 12:00 PM · NYG @ WAS', odds: '+150', result: 'Final T 27–27 · tie, voided', status: 'push' }
        ]
      }
    ],
    6: [
      {
        owner: 'Colin', title: 'Four Doubles', placedBy: ['Colin'],
        // Colin's 4-leg 2+ TD parlay, from Matt (Sat Oct 17). Colin placed it (Matt, Sun Oct 18). Prices are DraftKings'
        // Over 1.5 TDs (2+), not the +250 to +300 the slip guessed; Taylor is the shortest leg, not Kyren.
        // Odds: DraftKings via The Odds API, Sun Oct 18, 1:16 AM CT. Ticket ≈ +19,700. Ladders (1+, 2+, 3+ TDs, for
        // the fair estimate): 2+ and 3+ from the 1:16 AM pull, 1+ from the 1:24 AM pull.
        legs: [
          { text: 'Kyren Williams 2+ TDs', player: 'Kyren Williams', type: 'td', count: 2, game: 'Sun 3:05 PM · ARI @ LAR', odds: '+285', ladder: ['-190', '+285', '+1100'], result: 'No TD (10-50 rush, 3-17 rec)', status: 'miss' },
          { text: 'Kenneth Walker III 2+ TDs', player: 'Kenneth Walker III', type: 'td', count: 2, game: 'Sun 3:25 PM · LAC @ KC', odds: '+330', ladder: ['-170', '+330', '+1500'], result: '2 rush TDs (19-128 rush, 2-11 rec)', status: 'hit' },
          { text: 'Jonathan Taylor 2+ TDs', player: 'Jonathan Taylor', type: 'td', count: 2, game: 'Sun 12:00 PM · TEN @ IND', odds: '+185', ladder: ['-290', '+185', '+750'], result: '1 rush TD (21-94 rush, 2-57 rec)', status: 'miss' },
          { text: 'James Cook 2+ TDs', player: 'James Cook III', type: 'td', count: 2, game: 'Sun 3:25 PM · BUF @ LV', odds: '+320', ladder: ['-170', '+320', '+1400'], result: '1 rush TD (22-95 rush, 3-58 rec)', status: 'miss' }
        ]
      },
      {
        owner: 'Matt', title: 'Three Favorites', request: 'Matt', requestAt: '2026-10-18T17:14:11.785Z',
        // Built by Claude for Matt's request from Sun Oct 18, 12:14 PM (Balanced +400 to +900, 3 legs, no
        // picked players, team bias off). The noon games had kicked off, so the legs come from the late
        // games: three favorites at near-even prices in three different games. The Packers leg is Matt's
        // own team (he starts Love, Watson and Lloyd). Ticket ≈ +600.
        // Odds: DraftKings via The Odds API, Sun Oct 18, 12:15 PM CT. Other sides (vs), same pull:
        // Raiders +5.5 -112, Chargers +7.5 -115, Cowboys ML -105.
        legs: [
          { text: 'Bills spread (-5.5) at Raiders', type: 'spread', team: 'Buf', line: -5.5, teams: ['Buf', 'LV'], game: 'Sun 3:25 PM · BUF @ LV', odds: '-108', vs: '-112', result: 'Final 33–30 · won by 3, needed 6', status: 'miss' },
          { text: 'Chiefs spread (-7.5) vs Chargers', type: 'spread', team: 'KC', line: -7.5, teams: ['LAC', 'KC'], game: 'Sun 3:25 PM · LAC @ KC', odds: '-105', vs: '-115', result: 'Final 22–6 · won by 16', status: 'hit' },
          { text: 'Packers moneyline vs Cowboys', type: 'ml', team: 'GB', teams: ['Dal', 'GB'], game: 'Sun 7:20 PM · DAL @ GB', odds: '-115', vs: '-105', result: 'Final W 23–13', status: 'hit' }
        ]
      },
      {
        owner: 'The Booth', init: 'TB', title: 'Four Singles and a Bear',
        // Built by Claude at Matt's ask (Sun Oct 18): the anytime-TD shadow of Colin's Four Doubles,
        // with Odunze's TD to get it past +1000. Not marked placed.
        // Odds: DraftKings via The Odds API, Sun Oct 18, 1:30 AM CT. Ticket ≈ +1190. Ladders on the four backs
        // (2+ and 3+ from 1:16 AM, 1+ from 1:30 AM); Odunze's 2+ wasn't pulled before kickoff, so this
        // ticket has no fair estimate.
        legs: [
          { text: 'Jonathan Taylor anytime TD', player: 'Jonathan Taylor', type: 'td', count: 1, game: 'Sun 12:00 PM · TEN @ IND', odds: '-290', ladder: ['-290', '+185', '+750'], result: '1 rush TD (21-94 rush, 2-57 rec)', status: 'hit' },
          { text: 'Rome Odunze anytime TD', player: 'Rome Odunze', type: 'td', count: 1, game: 'Sun 12:00 PM · CHI @ ATL', odds: '+150', result: 'No TD (3-39 rec)', status: 'miss' },
          { text: 'Kyren Williams anytime TD', player: 'Kyren Williams', type: 'td', count: 1, game: 'Sun 3:05 PM · ARI @ LAR', odds: '-190', ladder: ['-190', '+285', '+1100'], result: 'No TD (10-50 rush, 3-17 rec)', status: 'miss' },
          { text: 'Kenneth Walker III anytime TD', player: 'Kenneth Walker III', type: 'td', count: 1, game: 'Sun 3:25 PM · LAC @ KC', odds: '-170', ladder: ['-170', '+330', '+1500'], result: '2 rush TDs (19-128 rush, 2-11 rec)', status: 'hit' },
          { text: 'James Cook anytime TD', player: 'James Cook III', type: 'td', count: 1, game: 'Sun 3:25 PM · BUF @ LV', odds: '-170', ladder: ['-170', '+320', '+1400'], result: '1 rush TD (22-95 rush, 3-58 rec)', status: 'hit' }
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
      Pablo: 'Up four, the biggest jump of the week, after beating all nine teams in Week 4 with 133.78. Pablo was projected 9th.',
      Tony: 'Down five, tied with Matt for the biggest drop, after the league’s lowest score (90.82). 2nd in the standings, 7th here. Fraud watch is open.',
      DLin: 'Holding at 8th after beating Matt by 22.60. The Toilet Bowl King’s title defense is a respectable 2–2.',
      Matt: 'Down five after scoring 92.08. There is no 2nd best, but there is a 9th.',
      'Mr. G': 'Last, but opponents have averaged 131.00 against Mr. G. The schedule owes Mr. G an apology.'
    },
    5: {
      Andy: 'Up one to first after the week’s top score, 148.44. Andy now outscores opponents 588.10–557.70 on the season, so Andy would like you to start checking.',
      Tristan: 'Two straight losses, and still the most points in the league (609.26) and the best all-play record, 33–12. Tristan’s toughest opponent is the schedule.',
      Colin: 'Holding at 3rd with the league’s best two-week form, 14–4 against the field. Kamara and Deebo have both been dropped since Sunday. The churn continues.',
      Tony: 'Up three, tied for the biggest jump, and first in the standings. Still 4th here, with the fewest points against in the league (446.12). The luck stat would like a word.',
      Jerger: 'Three straight wins and down one anyway, because the all-play record is 21–24. Two of those wins came by a combined 4.00.',
      Matt: 'Up three, tied for the biggest jump, after scoring 136.68. There is no 2nd best, but 6th is a playoff spot.',
      Pablo: 'Down one despite going 12–6 against the field over the last two weeks. Pablo’s luck is exactly 0.00, so the 2–3 is fully earned.',
      Kurt: 'Down three while going 23–22 against the whole league. Kurt is 1–4 anyway. The numbers and the standings disagree, and the standings are winning.',
      DLin: 'Down one after the week’s low score, 92.62. 14–31 against the field and still 2–3. The Toilet Bowl King is overachieving.',
      'Mr. G': 'Still last, and opponents have now put 636.32 on Mr. G, 56.32 more than anyone else has allowed. Mr. G is the league’s favorite opponent.'
    },
    6: {
      Andy: 'Still first, with the week’s top score (119.72) and the best all-play record in the league, 38–16. Gibbs was on bye. Nobody noticed.',
      Tony: 'Up two to 2nd and first in the standings at 5–1. Still the fewest points against (518.24) and the best luck, +1.44. The schedule sends its regards.',
      Tristan: 'Down one after 86.92, 7th of the week, and a 20.42 win anyway. Tristan’s luck is now exactly 0.00, and the bench scored just 5.40.',
      Jerger: 'Up one on four straight wins, the latest over Matt and the projections by 13.40, with the week’s second-best score, 119.54. The streak finally brought receipts.',
      Matt: 'Up one despite the loss, and tied with Kurt for the worst luck in the league at −1.22. There is no 2nd best, and 7th is where that gets you.',
      Kurt: 'Up two after a 51.18 win over Colin, and into the last playoff spot at 2–4. Still the league’s best lineup efficiency, 95.2%. The schedule finally blinked.',
      Colin: 'Down four, the week’s biggest drop, after 61.58, the season’s lowest score. 0–9 against the field this week, and 31 adds and counting.',
      Pablo: 'Down one after losing to Tristan by 20.42 with Pitts’ 20.50 on the bench. 19–35 against the field and the league’s worst lineup efficiency, 80.9%.',
      'Mr. G': 'Up one without winning, which says more about DLin. Five straight losses, and 756.04 points allowed, 86.64 more than anyone.',
      DLin: 'Down one to last after 72.12 and a 45.28 loss to Tony. 16–38 against the field. The Toilet Bowl King has found the throne.'
    }
  },

  // One-liner on each team page.
  roasts: {
    Tony: 'First at 5–1 with the fewest points against (518.24) and the league’s best luck, +1.44. 11 Shots In, and opponents keep missing.',
    Tristan: '4–2, the league’s second-best lineup efficiency (93.0%), and luck at exactly 0.00. The season Tristan declared over is right on schedule.',
    Andy: '5–1, first in the power rankings, and the week’s top score with Gibbs on bye. It’s gibbing time, even when Gibbs isn’t.',
    Matt: '7th at 2–4, with 121.28 points left on the bench and luck tied for worst at −1.22. There is no 2nd best, just 7th.',
    Kurt: '2–4 with the league’s best lineup efficiency (95.2%) and luck tied for worst at −1.22. Average Sports Enthusiast, above-average lineups.',
    Jerger: 'Four straight wins and 4–2, with a 29–25 record against the field. #1 Y! Fan, and Yahoo’s projections had Jerger losing Week 6.',
    'Mr. G': '1–5 with 756.04 points allowed, 86.64 more than anyone. Definitely not a Boomer, definitely everyone’s favorite opponent.',
    Colin: '31 adds, the most in the league by 9, and the season’s lowest score in Week 6, 61.58. C Lambs Biggest Hater, and Week 6 hated back.',
    DLin: 'Last in the power rankings, 16–38 against the field, and 2–4 anyway. The Toilet Bowl King is defending the title on schedule.',
    Pablo: '8th at 2–4, 19–35 against the field and the league’s worst lineup efficiency, 80.9%. He was #1, for one week: Week 4’s top score, 133.78.'
  }
};
