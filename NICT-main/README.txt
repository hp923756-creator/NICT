NICT Cricket Centre Pro v2 — Frontend Only

UPDATES
- Upper-right Menu contains Admin and all records/rankings options.
- No legacy placeholder team name is displayed anywhere.
- Short teams: GCET, GLB, ABES, JSS, KCC.
- 5 teams × 20 players = 100 players.
- Every team: 11 Playing XI + 9 standby/bench.
- Live scorecard shows both teams' Playing XI with roles.
- Live scorecard includes batting card and bowling card.
- JSON upload in Admin.
- JSON team_a/team_b names are normalized to short names.
- Filename format TEAM1_vs_TEAM2.json is supported.
- Uploaded JSON is saved in browser localStorage.
- Harsh Pandey:
  Test: 12 matches, 18 innings, 73.00 avg, 2 hundreds, 8 fifty-plus scores.
  ODI: 17 matches, 60.23 avg, 12 fifty-plus scores.
  T20: 25 matches, 43.00 avg, 12 fifties, 174.33 strike rate.
  Right-hand batter; right-arm part-time bowler.
- Other player averages are kept below 59 and varied to avoid repeated-looking values.
- Test/ODI/T20 batting rankings are separate.
- Career records include 100s, 50+ scores, fours, sixes and wickets.
- Records include most centuries, most 50+ scores, sixes, fours, wickets and catches.

ADMIN
Password: 12309856

IMPORTANT
This is a frontend-only application. Uploaded matches are stored in the browser
that performs the upload. A frontend-only site cannot globally publish a new
upload to every phone without a shared backend/database. The bundled matches
and records are available to everyone from Vercel; new browser uploads are local
to that browser.

The team logos included in assets/logos were cropped from the logo sheet supplied
in the conversation.


RUN TOTALS
Every player career record now contains explicit Test Runs, ODI Runs, T20 Runs and Career Runs. Individual player pages display all four totals, and the Career Records table displays the three format totals plus the combined career total.
