/*
  NICT /api/matches
  ------------------------------------------------------------
  Browser:
    GET  /api/matches                 public
    POST /api/matches                 admin
    PATCH /api/matches?id=...         admin
    DELETE /api/matches?id=...        admin

  Supabase:
    public.matches
      id text primary key
      match_json jsonb
      status text
      started_at timestamptz
      created_at timestamptz
      updated_at timestamptz

  The service-role key stays on the server.
*/

const SB_URL =
  process.env.SUPABASE_URL;

const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD;

function configurationError() {
  const missing = [];

  if (!SB_URL) missing.push("SUPABASE_URL");
  if (!SB_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    return (
      "Server configuration missing: " +
      missing.join(", ")
    );
  }

  return "";
}

async function sb(
  path,
  options = {}
) {
  const error =
    configurationError();

  if (error) {
    throw new Error(error);
  }

  const response =
    await fetch(
      `${SB_URL}/rest/v1/${path}`,
      {
        ...options,
        headers: {
          apikey: SB_KEY,
          Authorization:
            `Bearer ${SB_KEY}`,
          "Content-Type":
            "application/json",
          ...(options.headers || {})
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "string"
        ? data
        : (
            data?.message ||
            JSON.stringify(data)
          )
    );
  }

  return data;
}

function adminOK(req) {
  if (!ADMIN_PASSWORD) {
    return false;
  }

  return (
    req.headers[
      "x-admin-password"
    ] === ADMIN_PASSWORD
  );
}

function getId(req) {
  return String(
    req.query?.id ||
    ""
  ).trim();
}

function buildRow(match) {
  const m = match || {};

  if (!m.match_id) {
    throw new Error(
      "match_id required"
    );
  }

  const matchId =
    String(m.match_id);

  const now =
    new Date().toISOString();

  return {
    id: matchId,
    match_json: m,
    status:
      String(
        m.status ||
        "upcoming"
      ),
    started_at:
      m.started_at ||
      null,
    updated_at: now
  };
}

function st(v) {
  return String(v ?? "").trim();
}

function careerFormat(format) {
  const s = st(format).toUpperCase();
  if (s.includes("T20")) return "T20";
  if (s.includes("ODI")) return "ODI";
  return "Test";
}

function isMatchFinished(m) {
  if (!m) return false;

  const status = st(
    m.status ||
    m.audit?.status ||
    ""
  ).toLowerCase();

  if (["completed", "finished", "result"].includes(status)) {
    return true;
  }

  if (
    m.match_finished === true ||
    m.finished === true ||
    m.completed === true ||
    m.result_final === true
  ) {
    return true;
  }

  const ds = Array.isArray(m.deliveries) ? m.deliveries : [];
  if (!ds.length) return false;

  const last = ds[ds.length - 1] || {};

  if (
    last.match_end === 1 ||
    last.match_finished === true ||
    last.match_complete === true
  ) {
    return true;
  }

  const expectedInnings = careerFormat(m.format) === "Test" ? 4 : 2;
  const inningsNumbers = [
    ...new Set(ds.map(d => Number(d.innings || 1)))
  ].sort((a, b) => a - b);

  if (
    inningsNumbers.length >= expectedInnings &&
    Number(last.innings_end || 0) === 1
  ) {
    return true;
  }

  return false;
}

function deriveCompletedMatchResult(m) {
  const ds = Array.isArray(m?.deliveries) ? m.deliveries : [];
  const teams = [st(m?.team_a), st(m?.team_b)];
  const format = careerFormat(m?.format);

  if (!ds.length) {
    return { type: "NR", winner: "", loser: "", text: "No Result" };
  }

  const innings = {};

  for (const d of ds) {
    const n = Number(d?.innings || 1);
    if (!innings[n]) innings[n] = { runs: 0, wickets: 0 };
    innings[n].runs += Number(d?.runs || 0) + Number(d?.extra_runs || 0);
    innings[n].wickets += Number(d?.wicket || 0);
  }

  const nums = Object.keys(innings).map(Number).sort((a, b) => a - b);
  if (nums.length < 2) {
    return { type: "NR", winner: "", loser: "", text: "No Result" };
  }

  const firstBatTeam =
    st(ds.find(d => Number(d?.innings || 1) === nums[0])?.batsman_team) ||
    st(m?.batting_first) ||
    teams[0];

  const secondBatTeam =
    firstBatTeam === teams[0] ? teams[1] : teams[0];

  if (format === "Test" && nums.length >= 4) {
    const firstTotal = innings[nums[0]].runs + innings[nums[2]].runs;
    const secondTotal = innings[nums[1]].runs + innings[nums[3]].runs;

    if (firstTotal === secondTotal) {
      return { type: "TIE", winner: "", loser: "", text: "Match tied" };
    }

    const winner = firstTotal > secondTotal ? firstBatTeam : secondBatTeam;
    const loser = winner === firstBatTeam ? secondBatTeam : firstBatTeam;
    const finalInnings = innings[nums[3]];
    const fourthTarget = firstTotal + 1;

    if (finalInnings.runs >= fourthTarget) {
      const wicketsRemaining = Math.max(0, 10 - finalInnings.wickets);
      return {
        type: "WIN",
        winner,
        loser,
        text: `${winner} won by ${wicketsRemaining} wickets`
      };
    }

    return {
      type: "WIN",
      winner,
      loser,
      text: `${winner} won by ${Math.abs(firstTotal - secondTotal)} runs`
    };
  }

  const first = innings[nums[0]].runs;
  const second = innings[nums[1]].runs;

  if (first === second) {
    return { type: "TIE", winner: "", loser: "", text: "Match tied" };
  }

  const winner = second > first ? secondBatTeam : firstBatTeam;
  const loser = winner === secondBatTeam ? firstBatTeam : secondBatTeam;

  if (second > first) {
    const wicketsRemaining = Math.max(0, 10 - innings[nums[1]].wickets);
    return {
      type: "WIN",
      winner,
      loser,
      text: `${winner} won by ${wicketsRemaining} wickets`
    };
  }

  return {
    type: "WIN",
    winner,
    loser,
    text: `${winner} won by ${Math.abs(first - second)} runs`
  };
}

async function autoFinalizeFinishedMatches(rows) {
  const result = [];

  for (const row of rows) {
    const m = row.match_json || {};
    const status = st(row.status || m.status || "").toLowerCase();
    const alreadyApproved = m.player_records_enabled === true;

    if (status === "completed" && alreadyApproved) {
      result.push(row);
      continue;
    }

    if (!isMatchFinished(m)) {
      result.push(row);
      continue;
    }

    const matchResult = deriveCompletedMatchResult(m);
    const now = new Date().toISOString();
    const completed = {
      ...m,
      status: "completed",
      winner: matchResult.winner || m.winner || "",
      result:
        matchResult.text ||
        m.result ||
        (matchResult.type === "WIN"
          ? `${matchResult.winner} won`
          : matchResult.type === "TIE"
            ? "Match tied"
            : "No Result"),
      completed_at: m.completed_at || now,
      player_records_enabled: true,
      player_stats_approved: true,
      player_stats_approved_at: now,
      points_table_enabled: true
    };

    try {
      const newRow = buildRow(completed);
      const saved = await sb("matches", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(newRow)
      });

      const savedRow = Array.isArray(saved) ? saved[0] : saved;
      result.push(savedRow || { ...row, match_json: completed, status: "completed" });
    } catch (error) {
      console.error("auto-finalize match failed:", error);
      result.push(row);
    }
  }

  return result;
}

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  try {
    /*
      PUBLIC READ.
      This is what allows anyone with the match URL
      to watch from another device without logging in.
    */
    if (req.method === "GET") {
      const id =
        getId(req);

      if (id) {
        let rows =
          await sb(
            `matches?id=eq.${encodeURIComponent(
              id
            )}&select=*`
          );

        rows = await autoFinalizeFinishedMatches(
          Array.isArray(rows) ? rows : []
        );

        return res
          .status(200)
          .json(
            rows?.[0] ||
            null
          );
      }

      let rows =
        await sb(
          "matches?select=*&order=created_at.desc"
        );

      rows = await autoFinalizeFinishedMatches(
        Array.isArray(rows) ? rows : []
      );

      return res
        .status(200)
        .json(rows);
    }

    /*
      Everything below this point is admin-only.
    */
    if (!adminOK(req)) {
      return res
        .status(401)
        .json({
          error:
            "Admin authentication required"
        });
    }

    if (
      req.method === "POST" ||
      req.method === "PATCH"
    ) {
      const body =
        req.body || {};

      /*
        PATCH may arrive as:
          { match_id, ...fields }
        or:
          { id, match_json, status, started_at }
      */
      let match;

      if (
        body.match_json &&
        typeof body.match_json ===
          "object"
      ) {
        match = {
          ...body.match_json,
          match_id:
            body.match_id ||
            body.match_json.match_id ||
            body.id,
          status:
            body.status ||
            body.match_json.status ||
            "upcoming",
          started_at:
            body.started_at ??
            body.match_json.started_at ??
            null
        };
      } else {
        match = {
          ...body,
          match_id:
            body.match_id ||
            body.id
        };
      }

      const row =
        buildRow(match);

      /*
        Upsert by primary key "id".
        This makes START MATCH atomic from the browser's
        point of view: all devices subsequently read the
        same started_at from Supabase.
      */
      const rows =
        await sb(
          "matches",
          {
            method: "POST",
            headers: {
              "Prefer":
                "resolution=merge-duplicates,return=representation"
            },
            body:
              JSON.stringify(
                row
              )
          }
        );

      return res
        .status(200)
        .json(
          rows?.[0] ||
          rows
        );
    }

    if (
      req.method ===
      "DELETE"
    ) {
      const id =
        getId(req);

      if (!id) {
        return res
          .status(400)
          .json({
            error:
              "id required"
          });
      }

      await sb(
        `matches?id=eq.${encodeURIComponent(
          id
        )}`,
        {
          method:
            "DELETE"
        }
      );

      return res
        .status(200)
        .json({
          ok: true
        });
    }

    return res
      .status(405)
      .json({
        error:
          "Method not allowed"
      });

  } catch (error) {
    console.error(
      "matches API error:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error?.message ||
          "Server error"
      });
  }
}
