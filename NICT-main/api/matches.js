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
        const rows =
          await sb(
            `matches?id=eq.${encodeURIComponent(
              id
            )}&select=*`
          );

        return res
          .status(200)
          .json(
            rows?.[0] ||
            null
          );
      }

      const rows =
        await sb(
          "matches?select=*&order=created_at.desc"
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
