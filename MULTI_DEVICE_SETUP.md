# NICT Multi-device live cricket

## Cost
This build uses only free-tier services:
- Vercel: frontend + serverless API
- Supabase: persistent match database
No Render process is required.

## Setup
1. Create a free Supabase project.
2. Open Supabase SQL Editor and run `supabase_schema.sql`.
3. In Vercel → Settings → Environment Variables add:
   `SUPABASE_URL` = your project URL
   `SUPABASE_SERVICE_ROLE_KEY` = Supabase service-role key
   `ADMIN_PASSWORD` = your chosen admin password
4. Redeploy Vercel.

**Never put SUPABASE_SERVICE_ROLE_KEY into app.js or any public file.**

## Shared match behavior
Admin uploads the complete ball-by-ball JSON once.
Admin presses **Use Live**.
The server stores:
- complete JSON
- match ID
- status
- one shared `started_at`

Every phone then uses that same timestamp.

Timing:
- 15 minutes after toss before first delivery
- 20 seconds between deliveries
- 60 seconds after each completed over
- 15-minute innings break
- full match continues automatically
- full scorecard remains after completion

Closing every browser does not stop the match.

## Public sharing
Share:
`https://YOUR-VERCEL-DOMAIN/?match=MATCH_ID`

No viewer login is required.

## Career/rankings
`/api/stats` recalculates career and format records from the shared completed matches, so records are not dependent on one phone's localStorage.
