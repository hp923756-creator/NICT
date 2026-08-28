/*
  NICT /api/stats
  ------------------------------------------------------------
  Rebuilds statistics from the shared match table on every request.

  This avoids the previous bug where each refresh/request added the
  same match to career totals again.

  The endpoint does NOT write JSON files on Vercel.
  It returns a fresh calculated snapshot.
*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SB_URL =
  process.env.SUPABASE_URL;

const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function readJSON(
  name,
  fallback = []
) {
  const candidates = [
    path.join(process.cwd(), "data", `${name}.json`),
    path.join(__dirname, "..", "data", `${name}.json`),
    path.join(process.cwd(), "NICT-main", "data", `${name}.json`)
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(
          fs.readFileSync(file, "utf8")
        );
      }
    } catch (error) {
      console.warn(`stats: failed reading ${file}`, error);
    }
  }

  console.warn(`stats: ${name}.json not found in`, candidates);
  return fallback;
}

async function getMatches() {
  if (!SB_URL || !SB_KEY) {
    console.warn("stats: Supabase not configured, using baseline JSON only");
    return [];
  }

  try {
    const response =
      await fetch(
        `${SB_URL}/rest/v1/matches?select=id,match_json,status,started_at,created_at&order=created_at.asc`,
        {
          headers: {
            apikey: SB_KEY,
            Authorization:
              `Bearer ${SB_KEY}`
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        await response.text()
      );
    }

    return response.json();
  } catch (error) {
    console.warn("stats: could not load matches, using baseline JSON only", error);
    return [];
  }
}

function st(v) {
  return String(v ?? "").trim();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(v) {
  const s =
    st(v).toUpperCase();

  if (s.includes("T20")) return "T20";
  if (s.includes("ODI")) return "ODI";
  return "Test";
}

function team(v) {
  return st(v).toUpperCase();
}

function legal(d) {
  if (typeof d.legal_delivery === "boolean") {
    return d.legal_delivery;
  }

  if (typeof d.legal === "boolean") {
    return d.legal;
  }

  const e =
    st(d.extra_type).toLowerCase();

  return ![
    "wide",
    "wides",
    "w",
    "no-ball",
    "noball",
    "no ball",
    "nb"
  ].includes(e);
}

function isWide(d) {
  const e =
    st(d.extra_type).toLowerCase();

  return [
    "wide",
    "wides",
    "w"
  ].includes(e);
}

function isNoBall(d) {
  const e =
    st(d.extra_type).toLowerCase();

  return [
    "no-ball",
    "noball",
    "no ball",
    "nb"
  ].includes(e);
}

function offBat(d) {
  return num(
    d.runs ??
    d.runs_off_bat ??
    d.batter_runs
  );
}

function extras(d) {
  const x =
    d.extras || {};

  return {
    wides: num(
      x.wides ??
      x.wide ??
      (
        isWide(d)
          ? d.extra_runs
          : 0
      )
    ),
    no_balls: num(
      x.no_balls ??
      x.no_ball ??
      (
        isNoBall(d)
          ? d.extra_runs
          : 0
      )
    ),
    byes: num(
      x.byes ??
      x.bye
    ),
    leg_byes: num(
      x.leg_byes ??
      x.leg_bye
    ),
    penalty: num(
      x.penalty
    )
  };
}

function deliveryTotal(d) {
  if (
    d.total_runs !== undefined
  ) {
    return num(
      d.total_runs
    );
  }

  return (
    offBat(d) +
    num(d.extra_runs)
  );
}

function wicketBowlerCredit(d) {
  if (!num(d.wicket)) {
    return false;
  }

  const type =
    st(
      d.wicket_type ||
      d.dismissal
    ).toLowerCase();

  return !(
    type.includes("run out") ||
    type.includes("runout") ||
    type.includes("retired") ||
    type.includes("obstruct") ||
    type.includes("timed out")
  );
}

function getDeliveries(m) {
  if (
    Array.isArray(
      m.deliveries
    )
  ) {
    return m.deliveries;
  }

  if (
    Array.isArray(
      m.innings
    )
  ) {
    const result = [];

    m.innings.forEach(
      block => {
        (
          Array.isArray(
            block.deliveries
          )
            ? block.deliveries
            : []
        ).forEach(
          d =>
            result.push({
              ...d,
              innings:
                d.innings ??
                block.innings ??
                block.number ??
                1
            })
        );
      }
    );

    return result;
  }

  return [];
}

function matchIsCompleted(row) {
  const m =
    row.match_json || {};

  /*
    The statistics engine only consumes a match after
    the scoring system explicitly marks it completed.
    It never guesses completion from elapsed browser time.
  */
  const completed =
    st(
      row.status ||
      m.status ||
      m.audit?.status
    ).toLowerCase() ===
    "completed";

  /*
    A completed match does NOT automatically change player career
    statistics. The admin must explicitly approve player stats from
    the Admin panel.
  */
  const approved =
    m.player_records_enabled === true ||
    m.player_stats_approved === true;

  return completed && approved;
}

function ensurePlayer(
  map,
  name,
  teamName
) {
  if (!name) return null;

  if (!map[name]) {
    map[name] = {
      name,
      short_team:
        teamName || "",
      matches: 0,
      innings: 0,
      not_outs: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      hundreds: 0,
      fifties: 0,
      fifty_plus: 0,
      highest: 0,
      wickets: 0,
      catches: 0
    };
  }

  return map[name];
}

function calculateMatchStats(
  match
) {
  const deliveries =
    getDeliveries(match);

  const players = {};
  const bowlers = {};
  const fielders = {};

  const inningsPlayers = {};

  for (
    const d of deliveries
  ) {
    const innings =
      num(
        d.innings,
        1
      );

    const battingTeam =
      team(
        d.batsman_team ||
        (
          innings % 2 === 1
            ? match.batting_first
            : match.batting_second
        )
      );

    const striker =
      st(
        d.batsman ||
        d.striker
      );

    const bowler =
      st(d.bowler);

    if (striker) {
      const p =
        ensurePlayer(
          players,
          striker,
          battingTeam
        );

      const key =
        `${striker}|${innings}`;

      inningsPlayers[key] =
        inningsPlayers[key] ||
        {
          player: striker,
          innings,
          runs: 0,
          balls: 0,
          out: false
        };

      const ip =
        inningsPlayers[key];

      ip.runs +=
        offBat(d);

      if (
        legal(d) &&
        !isWide(d) &&
        !isNoBall(d)
      ) {
        ip.balls += 1;
      }

      p.runs +=
        offBat(d);

      p.balls +=
        (
          legal(d) &&
          !isWide(d) &&
          !isNoBall(d)
        )
          ? 1
          : 0;

      if (
        offBat(d) === 4
      ) {
        p.fours += 1;
      }

      if (
        offBat(d) === 6
      ) {
        p.sixes += 1;
      }

      if (
        num(d.wicket)
      ) {
        const dismissed =
          st(
            d.dismissed_player ||
            d.batsman
          );

        if (
          dismissed ===
          striker
        ) {
          ip.out = true;
        }
      }
    }

    if (bowler) {
      if (!bowlers[bowler]) {
        bowlers[bowler] = {
          name: bowler,
          short_team:
            team(
              d.bowling_team
            ),
          wickets: 0
        };
      }

      if (
        wicketBowlerCredit(d)
      ) {
        bowlers[bowler]
          .wickets +=
          num(d.wicket);
      }
    }

    const fielder =
      st(
        d.fielder ||
        d.fielder_1
      );

    if (
      fielder &&
      num(d.wicket)
    ) {
      if (!fielders[fielder]) {
        fielders[fielder] = {
          name: fielder,
          short_team:
            team(
              d.bowling_team
            ),
          catches: 0
        };
      }

      const type =
        st(
          d.wicket_type
        ).toLowerCase();

      if (
        type.includes(
          "catch"
        )
      ) {
        fielders[fielder]
          .catches += 1;
      }
    }
  }

  const perPlayer =
    {};

  for (
    const ip of
    Object.values(
      inningsPlayers
    )
  ) {
    if (
      !perPlayer[
        ip.player
      ]
    ) {
      perPlayer[
        ip.player
      ] = {
        innings: 0,
        outs: 0,
        runs: 0,
        balls: 0,
        highest: 0,
        hundreds: 0,
        fifties: 0,
        fifty_plus: 0
      };
    }

    const p =
      perPlayer[
        ip.player
      ];

    p.innings += 1;
    p.outs +=
      ip.out ? 1 : 0;
    p.runs +=
      ip.runs;
    p.balls +=
      ip.balls;
    p.highest =
      Math.max(
        p.highest,
        ip.runs
      );

    if (
      ip.runs >= 100
    ) {
      p.hundreds += 1;
    }

    if (
      ip.runs >= 50 &&
      ip.runs < 100
    ) {
      p.fifties += 1;
    }

    if (
      ip.runs >= 50
    ) {
      p.fifty_plus += 1;
    }
  }

  return {
    players,
    bowlers,
    fielders,
    perPlayer
  };
}

function applyBatting(
  target,
  source,
  format
) {
  const p =
    target;

  p.matches += 1;
  p.innings +=
    source.innings;
  p.not_outs +=
    Math.max(
      0,
      source.innings -
      source.outs
    );
  p.runs +=
    source.runs;
  p.balls +=
    source.balls;
  p.fours +=
    source.fours;
  p.sixes +=
    source.sixes;
  p.highest =
    Math.max(
      p.highest,
      source.highest
    );
  p.hundreds +=
    source.hundreds;
  p.fifties +=
    source.fifties;
  p.fifty_plus +=
    source.fifty_plus;

  p.average =
    +(
      p.runs /
      Math.max(
        1,
        p.innings -
        p.not_outs
      )
    ).toFixed(2);

  p.strike_rate =
    +(
      p.runs /
      Math.max(
        1,
        p.balls
      ) *
      100
    ).toFixed(2);

  p.format =
    format;
}

export default async function handler(
  req,
  res
) {
  try {
    const rows =
      await getMatches();

    /*
      Start from the repository's existing career data
      as the historical baseline. Each current match is
      applied only once within this calculation.
    */
    const careerBase =
      readJSON(
        "career_records"
      );

    const formatBase =
      readJSON(
        "players_format"
      );

    const battingBase =
      readJSON(
        "batting_rankings"
      );

    const bowlingBase =
      readJSON(
        "bowling_rankings"
      );

    const ratingsBase =
      readJSON(
        "ratings"
      );

    const career =
      Array.isArray(
        careerBase
      )
        ? JSON.parse(
            JSON.stringify(
              careerBase
            )
          )
        : [];

    const formats =
      Array.isArray(
        formatBase
      )
        ? JSON.parse(
            JSON.stringify(
              formatBase
            )
          )
        : [];

    const batting =
      Array.isArray(
        battingBase
      )
        ? JSON.parse(
            JSON.stringify(
              battingBase
            )
          )
        : [];

    const bowling =
      Array.isArray(
        bowlingBase
      )
        ? JSON.parse(
            JSON.stringify(
              bowlingBase
            )
          )
        : [];

    const ratings =
      Array.isArray(
        ratingsBase
      )
        ? JSON.parse(
            JSON.stringify(
              ratingsBase
            )
          )
        : [];

    const processed =
      new Set();

    const teamRecords = {};
    const headToHead = {};

    for (
      const row of rows
    ) {
      const match =
        row.match_json ||
        {};

      const matchId =
        st(
          match.match_id ||
          row.id
        );

      if (
        !matchId ||
        processed.has(
          matchId
        ) ||
        !matchIsCompleted(row)
      ) {
        continue;
      }

      processed.add(
        matchId
      );

      const format =
        fmt(
          match.format
        );

      const stats =
        calculateMatchStats(
          match
        );

      /*
        Apply batting records.
      */
      for (
        const [name, x] of
        Object.entries(
          stats.perPlayer
        )
      ) {
        let careerPlayer =
          career.find(
            p =>
              p.name ===
              name
          );

        if (
          !careerPlayer
        ) {
          careerPlayer = {
            name,
            short_team:
              stats.players[
                name
              ]?.short_team ||
              "",
            matches: 0,
            innings: 0,
            not_outs: 0,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            hundreds: 0,
            fifties: 0,
            fifty_plus: 0,
            highest: 0,
            wickets: 0,
            catches: 0
          };

          career.push(
            careerPlayer
          );
        }

        applyBatting(
          careerPlayer,
          x,
          format
        );

        let fp =
          formats.find(
            p =>
              p.name ===
                name &&
              fmt(
                p.format
              ) === format
          );

        if (!fp) {
          fp = {
            name,
            short_team:
              careerPlayer.short_team,
            format,
            matches: 0,
            innings: 0,
            not_outs: 0,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            hundreds: 0,
            fifties: 0,
            fifty_plus: 0,
            high_score: 0,
            average: 0,
            strike_rate: 0,
            wickets: 0
          };

          formats.push(
            fp
          );
        }

        fp.matches += 1;
        fp.innings +=
          x.innings;
        fp.not_outs +=
          Math.max(
            0,
            x.innings -
            x.outs
          );
        fp.runs +=
          x.runs;
        fp.balls +=
          x.balls;
        fp.fours +=
          x.fours || 0;
        fp.sixes +=
          x.sixes || 0;
        fp.hundreds +=
          x.hundreds;
        fp.fifties +=
          x.fifties;
        fp.fifty_plus +=
          x.fifty_plus;
        fp.high_score =
          Math.max(
            num(
              fp.high_score
            ),
            x.highest
          );

        fp.average =
          +(
            fp.runs /
            Math.max(
              1,
              fp.innings -
              fp.not_outs
            )
          ).toFixed(2);

        fp.strike_rate =
          +(
            fp.runs /
            Math.max(
              1,
              fp.balls
            ) *
            100
          ).toFixed(2);
      }

      /*
        Bowling + fielding.
      */
      for (
        const [name, b] of
        Object.entries(
          stats.bowlers
        )
      ) {
        let careerPlayer =
          career.find(
            p =>
              p.name ===
              name
          );

        if (
          !careerPlayer
        ) {
          careerPlayer = {
            name,
            short_team:
              b.short_team ||
              "",
            matches: 0,
            wickets: 0,
            runs: 0,
            innings: 0,
            not_outs: 0,
            fours: 0,
            sixes: 0,
            hundreds: 0,
            fifties: 0,
            fifty_plus: 0,
            highest: 0,
            catches: 0
          };

          career.push(
            careerPlayer
          );
        }

        careerPlayer.wickets =
          num(
            careerPlayer.wickets
          ) +
          b.wickets;

        let fp =
          formats.find(
            p =>
              p.name ===
                name &&
              fmt(
                p.format
              ) === format
          );

        if (!fp) {
          fp = {
            name,
            short_team:
              b.short_team ||
              "",
            format,
            matches: 0,
            wickets: 0,
            runs: 0,
            innings: 0,
            not_outs: 0,
            fours: 0,
            sixes: 0,
            hundreds: 0,
            fifties: 0,
            fifty_plus: 0,
            high_score: 0
          };

          formats.push(
            fp
          );
        }

        fp.wickets =
          num(
            fp.wickets
          ) +
          b.wickets;
      }

      for (
        const [name, f] of
        Object.entries(
          stats.fielders
        )
      ) {
        let careerPlayer =
          career.find(
            p =>
              p.name ===
              name
          );

        if (
          careerPlayer
        ) {
          careerPlayer.catches =
            num(
              careerPlayer.catches
            ) +
            f.catches;
        }
      }

      /*
        Team records from the match result.
      */
      const teamA =
        team(match.team_a);

      const teamB =
        team(match.team_b);

      [
        teamA,
        teamB
      ].forEach(
        t => {
          if (!teamRecords[t]) {
            teamRecords[t] = {
              team: t,
              matches: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              draws: 0
            };
          }

          teamRecords[t]
            .matches += 1;
        }
      );

      const winner =
        team(
          match.winner ||
          match.result?.winner
        );

      if (winner) {
        const loser =
          winner === teamA
            ? teamB
            : teamA;

        teamRecords[winner]
          .wins += 1;

        teamRecords[loser]
          .losses += 1;

        const key =
          `${teamA}|${teamB}`;

        const reverse =
          `${teamB}|${teamA}`;

        const hKey =
          headToHead[key]
            ? key
            : reverse;

        if (!headToHead[hKey]) {
          headToHead[hKey] = {
            team:
              hKey.split("|")[0],
            opponent:
              hKey.split("|")[1],
            matches: 0,
            wins: 0,
            losses: 0
          };
        }

        headToHead[hKey]
          .matches += 1;

        headToHead[hKey]
          .wins +=
          winner ===
          headToHead[hKey].team
            ? 1
            : 0;

        headToHead[hKey]
          .losses +=
          winner !==
          headToHead[hKey].team
            ? 1
            : 0;
      } else if (
        /tie/i.test(
          st(
            match.result?.text ||
            match.result
          )
        )
      ) {
        teamRecords[teamA]
          .ties += 1;
        teamRecords[teamB]
          .ties += 1;
      }
    }

    /*
      Rebuild ratings from the resulting format records.
      This is deliberately deterministic.
    */
    for (
      const p of formats
    ) {
      const average =
        num(
          p.average
        );

      const sr =
        num(
          p.strike_rate
        );

      const runs =
        num(
          p.runs
        );

      const wickets =
        num(
          p.wickets
        );

      p.batting_rating =
        +Math.min(
          99.9,
          Math.max(
            1,
            average * .75 +
            sr * .10 +
            Math.log10(
              runs + 10
            ) * 7
          )
        ).toFixed(1);

      p.bowling_rating =
        +Math.min(
          99.9,
          Math.max(
            1,
            wickets * 2.5
          )
        ).toFixed(1);

      p.rating =
        +(
          (
            p.batting_rating +
            p.bowling_rating
          ) / 2
        ).toFixed(1);
    }

    const battingRankings =
      formats
        .slice()
        .sort(
          (a, b) =>
            num(
              b.batting_rating
            ) -
            num(
              a.batting_rating
            )
        )
        .map(
          p => ({
            player: p.name,
            short_team:
              p.short_team,
            format: p.format,
            rating:
              p.batting_rating
          })
        );

    const bowlingRankings =
      formats
        .slice()
        .sort(
          (a, b) =>
            num(
              b.bowling_rating
            ) -
            num(
              a.bowling_rating
            )
        )
        .map(
          p => ({
            player: p.name,
            short_team:
              p.short_team,
            format: p.format,
            rating:
              p.bowling_rating
          })
        );

    return res
      .status(200)
      .json({
        career_records:
          career,
        players_format:
          formats,
        batting_rankings:
          battingRankings,
        bowling_rankings:
          bowlingRankings,
        ratings:
          ratings,
        team_records:
          Object.values(
            teamRecords
          ),
        opponent_records:
          Object.values(
            headToHead
          )
      });

  } catch (error) {
    console.error(
      "stats API error:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error?.message ||
          "Stats calculation failed"
      });
  }
}
