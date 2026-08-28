/* ============================================================
   NICA FINAL APP.JS — BRANDING AND LOGO UPDATE
   ============================================================

   Based on the full application app.js from the latest project.

   CHANGES MADE:
   1. Playing XI: team logo removed.
   2. Team Records: kept exactly as-is (there was already no logo
      team-record rendering is no longer exposed in the website).
   3. Main NICA header logo:
      IMPORTANT — the header is rendered by index.html, NOT this
      app.js. Therefore it cannot be safely changed here without
      changing index.html. No other team-logo usage in app.js has
      been removed, so match/team pages remain unchanged.

   EVERYTHING ELSE IS UNCHANGED:
   - Supabase/cloud matches
   - admin
   - live match
   - multi-device polling
   - 20 sec ball timing
   - 60 sec over break
   - 15 min innings break
   - scorecards
   - Playing XI data
   - rankings
   - records
   - team records
   - match data
   ============================================================ */

const DATA={}; let view="home", currentPlayer="", liveTimer=null, rankingFormat="T20", recordFormat="T20";
const BASELINE_STATS={};
const BALL_DELAY_SECONDS=20, OVER_BREAK_SECONDS=60, INNINGS_BREAK_SECONDS=900, TOSS_BREAK_SECONDS=900;
let app=null;
const CLOUD_API="/api/matches";
let CLOUD_MATCHES=[];
async function cloudMatches(){
  try{
    const r=await fetch(CLOUD_API,{cache:"no-store"});
    if(!r.ok)throw new Error(await r.text()||`HTTP ${r.status}`);
    const rows=await r.json();
    CLOUD_MATCHES=(Array.isArray(rows)?rows:[]).map(x=>x?.match_json||x).filter(Boolean);
    return CLOUD_MATCHES;
  }catch(e){
    console.warn("Shared match server unavailable:",e);
    return null;
  }
}

async function cloudMatchById(matchId){
  const id=String(matchId||"").trim();
  if(!id)return null;
  try{
    const r=await fetch(
      `${CLOUD_API}?id=${encodeURIComponent(id)}`,
      {cache:"no-store"}
    );
    if(!r.ok)throw new Error(await r.text()||`HTTP ${r.status}`);
    const row=await r.json();
    if(!row)return null;
    return row.match_json||row;
  }catch(e){
    console.warn("Could not load shared match:",e);
    return null;
  }
}

function getUrlMatchId(){
  return new URLSearchParams(location.search).get("match")||"";
}

function sharedLiveLink(matchId){
  const id=String(matchId||"").trim();
  const base=(location.origin+location.pathname).replace(/\/$/,"");
  return `${base}?match=${encodeURIComponent(id)}`;
}

function setUrlMatchId(matchId){
  const id=String(matchId||"").trim();
  if(!id)return;
  const url=new URL(location.href);
  url.searchParams.set("match",id);
  history.replaceState(null,"",url);
}

async function copyLiveLink(matchId){
  const link=sharedLiveLink(matchId);
  try{
    await navigator.clipboard.writeText(link);
    alert("Live link copied!\n\nAnyone can open this scorecard on any phone, tablet, or computer.");
  }catch(e){
    prompt("Copy this live link to share:",link);
  }
}

function mergeMatchIntoList(match){
  if(!match?.match_id)return;
  const id=String(match.match_id);
  const list=Array.isArray(DATA.live_matches)?[...DATA.live_matches]:[];
  const idx=list.findIndex(x=>String(x.match_id||x.id||"")===id);
  if(idx>=0)list[idx]={...list[idx],...match};
  else list.unshift(match);
  DATA.live_matches=list;
  localStorage.setItem("nict_uploaded_matches",JSON.stringify(list));
}

async function ensureSharedMatchLoaded(){
  const id=getUrlMatchId();
  if(!id)return false;
  if(findMatchById(id))return true;
  const remote=await cloudMatchById(id);
  if(!remote)return false;
  mergeMatchIntoList(remote);
  return true;
}

let sharedLinkBootstrapped=false;

function bootstrapSharedLink(){
  const id=getUrlMatchId();
  if(!id)return;
  localStorage.setItem("nict_active_match_id",id);
  if(!sharedLinkBootstrapped){
    view="live";
    sharedLinkBootstrapped=true;
  }
}

async function refreshSharedMatchFromCloud(){
  const id=getUrlMatchId()||localStorage.getItem("nict_active_match_id")||"";
  if(!id)return;
  const remote=await cloudMatchById(id);
  if(remote)mergeMatchIntoList(remote);
}
function applyCloudMatches(cloud){
  if(!Array.isArray(cloud))return false;
  DATA.live_matches=cloud;
  localStorage.setItem("nict_uploaded_matches",JSON.stringify(cloud));
  return true;
}
async function adminCloud(method,body,id=""){
  const password=sessionStorage.getItem("nict_admin_password")||"";
  const url=id?`${CLOUD_API}?id=${encodeURIComponent(id)}`:CLOUD_API;
  const r=await fetch(url,{method,headers:{"Content-Type":"application/json","x-admin-password":password},body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    const msg=data.error||"Cloud request failed";
    if(r.status===401){
      throw new Error(msg+" Check that Vercel ADMIN_PASSWORD matches the admin panel password (@@098).");
    }
    throw new Error(msg);
  }
  return data;
}

const TEAM_MAP={
 "Galgotia College Cricket Club":"GCET","Galgotia College":"GCET","GCCC":"GCET","GCET":"GCET",
 "GL Bajaj Cricket Club":"GLB","GL Bajaj":"GLB","GLB":"GLB",
 "ABES Cricket Club":"ABES","ABES":"ABES",
 "JSS Greater Noida Cricket Club":"JSS","JSS":"JSS",
 "KCC Cricket Club":"KCC","KCC":"KCC"
};
const LOGOS={GCET:"assets/logos/GCET.png",GLB:"assets/logos/GLB.png",ABES:"assets/logos/ABES.png",JSS:"assets/logos/JSS.png",KCC:"assets/logos/KCC.png"};

function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function jsArg(v){return JSON.stringify(String(v??""))}
function safeParseJSON(raw,fallback=null){
  try{
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}
function stopLiveTimer(){
  if(liveTimer){
    clearInterval(liveTimer);
    liveTimer=null;
  }
}
function st(x){return TEAM_MAP[String(x||"").trim()]||String(x||"").trim()}
function fmt(x){return Number(x||0).toLocaleString("en-IN")}
function logo(t,cls="team-logo"){return `<img class="${cls}" src="${LOGOS[st(t)]||""}" alt="${esc(st(t))}">`}
function navigate(v){
  if(v!=="live")stopLiveTimer();
  view=v;
  closeMenu();
  render();
  scrollTo(0,0);
}
function closeMenu(){document.getElementById("drawer")?.classList.remove("open");document.getElementById("overlay")?.classList.remove("show")}
function head(title,sub=""){return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub?`<div class="muted">${esc(sub)}</div>`:""}</div></div>`}
function table(h,rows){return `<div class="table-wrap"><table class="table"><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`}
function player(name){currentPlayer=name;view="player";render()}
function playerLink(name){return `<a href="#" onclick="player(${jsArg(name)});return false">${esc(name)}</a>`}

function hasStatsRows(v){
  return Array.isArray(v)&&v.length>0;
}

function snapshotBaselineStats(){
  BASELINE_STATS.career_records=JSON.parse(JSON.stringify(DATA.career_records||[]));
  BASELINE_STATS.players_format=JSON.parse(JSON.stringify(DATA.players_format||[]));
  BASELINE_STATS.batting_rankings=JSON.parse(JSON.stringify(DATA.batting_rankings||[]));
  BASELINE_STATS.bowling_rankings=JSON.parse(JSON.stringify(DATA.bowling_rankings||[]));
  BASELINE_STATS.ratings=JSON.parse(JSON.stringify(DATA.ratings||[]));
  BASELINE_STATS.opponent_records=JSON.parse(JSON.stringify(DATA.opponent_records||[]));
  BASELINE_STATS.team_records=JSON.parse(JSON.stringify(DATA.team_records||[]));
}

function restoreSavedStats(){
  const saved={
    career_records:safeParseJSON(localStorage.getItem("nict_career_records"),null),
    players_format:safeParseJSON(localStorage.getItem("nict_players_format"),null),
    batting_rankings:safeParseJSON(localStorage.getItem("nict_batting_rankings"),null),
    bowling_rankings:safeParseJSON(localStorage.getItem("nict_bowling_rankings"),null),
    ratings:safeParseJSON(localStorage.getItem("nict_ratings"),null),
    opponent_records:safeParseJSON(localStorage.getItem("nict_opponent_records"),null),
    team_records:safeParseJSON(localStorage.getItem("nict_team_records"),null)
  };

  for(const [key,value] of Object.entries(saved)){
    if(hasStatsRows(value))DATA[key]=value;
  }
}

function applyStatsSnapshot(s){
  const fields=[
    "career_records",
    "players_format",
    "batting_rankings",
    "bowling_rankings",
    "ratings",
    "opponent_records",
    "team_records"
  ];

  for(const key of fields){
    const incoming=s?.[key];
    if(hasStatsRows(incoming)){
      DATA[key]=incoming;
      continue;
    }

    if(!hasStatsRows(DATA[key]) && hasStatsRows(BASELINE_STATS[key])){
      DATA[key]=JSON.parse(JSON.stringify(BASELINE_STATS[key]));
    }
  }
}

function persistStatsToLocalStorage(){
  localStorage.setItem("nict_career_records",JSON.stringify(DATA.career_records||[]));
  localStorage.setItem("nict_players_format",JSON.stringify(DATA.players_format||[]));
  localStorage.setItem("nict_batting_rankings",JSON.stringify(DATA.batting_rankings||[]));
  localStorage.setItem("nict_bowling_rankings",JSON.stringify(DATA.bowling_rankings||[]));
  localStorage.setItem("nict_ratings",JSON.stringify(DATA.ratings||[]));
  localStorage.setItem("nict_opponent_records",JSON.stringify(DATA.opponent_records||[]));
  localStorage.setItem("nict_team_records",JSON.stringify(DATA.team_records||[]));
}

async function loadData(){
 if(!app)return;
 const names=["players_format","career_records","ratings","batting_rankings","bowling_rankings","catches","teams","squads","opponent_records","live_matches"];
 for(const n of names){
   try{
     const r=await fetch(`data/${n}.json`,{cache:"no-store"});
     if(!r.ok)throw new Error(`HTTP ${r.status}`);
     DATA[n]=await r.json();
   }catch(e){
     console.warn(`Could not load data/${n}.json`,e);
     DATA[n]=Array.isArray(DATA[n])?DATA[n]:[];
   }
 }

 snapshotBaselineStats();
 restoreSavedStats();

 const local=safeParseJSON(localStorage.getItem("nict_uploaded_matches"),[]);
 DATA.live_matches=Array.isArray(local)?local:[];
 loadSavedPerformance();
 try{
   const cloud=await cloudMatches();
   if(cloud!==null)applyCloudMatches(cloud);
 }catch(e){console.warn("Cloud initial load failed",e)}

 await ensureSharedMatchLoaded();
 await refreshStatsFromServer({silent:true});
 bootstrapSharedLink();
 startCloudPolling();
 startSharedLinkListeners();
 render();
}

function startSharedLinkListeners(){
 if(window.__nictSharedListeners)return;
 window.__nictSharedListeners=true;

 document.addEventListener("visibilitychange",()=>{
   if(document.visibilityState!=="visible")return;
   refreshSharedMatchFromCloud().then(()=>{
     if(view==="live")renderLive(getActiveMatch());
   });
 });

 window.addEventListener("focus",()=>{
   refreshSharedMatchFromCloud().then(()=>{
     if(view==="live")renderLive(getActiveMatch());
   });
 });
}

let STATS_REFRESHED_FOR=new Set(
  safeParseJSON(localStorage.getItem("nict_stats_refreshed_for"),[])||[]
);

function saveStatsRefreshedFor(){
  localStorage.setItem(
    "nict_stats_refreshed_for",
    JSON.stringify([...STATS_REFRESHED_FOR])
  );
}

function startCloudPolling(){
 if(window.__nictCloudPoll)return;
 window.__nictCloudPoll=setInterval(async()=>{
   try{
     const cloud=await cloudMatches();
     if(cloud!==null){
       const prev=JSON.stringify(DATA.live_matches||[]);
       applyCloudMatches(cloud);

       const urlId=getUrlMatchId();
       if(urlId && !findMatchById(urlId)){
         await ensureSharedMatchLoaded();
       }else if(view==="live"){
         await refreshSharedMatchFromCloud();
       }

       bootstrapSharedLink();

       const newlyCompleted=cloud.filter(m=>{
         const id=String(m.match_id||"");
         return (
           id &&
           m.player_records_enabled===true &&
           String(m.status||"").toLowerCase()==="completed" &&
           !STATS_REFRESHED_FOR.has(id)
         );
       });

       if(newlyCompleted.length){
         for(const m of newlyCompleted){
           STATS_REFRESHED_FOR.add(String(m.match_id));
         }
         saveStatsRefreshedFor();
         await refreshStatsFromServer({silent:true});
       }

       if(view==="live"){renderLive(getActiveMatch())}
       if(view==="matches"){matches()}
       if(view==="admin"){renderAdminMatches()}
       else if(JSON.stringify(cloud)!==prev && ["teams","headToHead","pointTable","careerRecords","players"].includes(view)){
         render();
       }
     }
   }catch(e){console.warn("Cloud polling failed",e)}
 },3000);
}

function render(){
  if(!app)return;
 if(view==="home")return home(); if(view==="live")return live(); if(view==="matches")return matches();
 if(view==="teams")return teamsPage(); if(view==="players")return playersPage(); if(view==="player")return playerPage();
 if(view==="rankings"||view==="playerRankings")return rankingsPage();
 if(view==="batRankings")return battingRankings(); if(view==="bowlRankings")return bowlingRankings(); if(view==="allRoundRankings")return allRoundRankings();
 if(view==="records")return records(); if(view==="careerRecords")return careerRecords(); if(view==="centuryRecords")return leader("hundreds","Most Centuries");
 if(view==="fiftyRecords")return leader("fifty_plus","Most 50+ Scores"); if(view==="sixRecords")return leader("sixes","Most Sixes");
 if(view==="fourRecords")return leader("fours","Most Fours"); if(view==="wicketRecords")return leader("wickets","Most Wickets");
 if(view==="catchRecords")return catchesPage(); if(view==="pointTable")return pointTable(); if(view==="headToHead")return headToHead();
 if(view==="stats")return stats(); if(view==="admin")return admin();
}

function home(){
 const m=DATA.live_matches?.[0];
 app.innerHTML=head("NICA Cricket Association","Live cricket, player career statistics, rankings and tournament records")+
 `<div class="grid">
  <div class="card"><h3>Players</h3><div class="big">${DATA.career_records.length}</div><span class="muted">20 players per team</span></div>
  <div class="card"><h3>Teams</h3><div class="big">${DATA.teams.length}</div><span class="muted">GCET · GLB · ABES · JSS · KCC</span></div>
  <div class="card"><h3>Formats</h3><div class="big">3</div><span class="muted">Test · ODI · T20</span></div>
 </div>
 <div class="section">${m?matchHero(m):`<div class="card empty">No match feed loaded.</div>`}</div>
 <div class="section"><h2>Quick access</h2><div class="tabs"><button onclick="navigate('batRankings')">Batsman Rankings</button><button onclick="navigate('bowlRankings')">Bowling Rankings</button><button onclick="navigate('careerRecords')">Career Records</button><button onclick="navigate('centuryRecords')">Most Centuries</button><button onclick="navigate('fiftyRecords')">Most 50+ Scores</button></div></div>`;
}
function matchHero(m){
 const a=st(m.team_a),b=st(m.team_b);
 return `<div class="scorehero"><div class="match-banner"><div><div class="meta">${esc(m.format||"Match")} · ${esc(m.match_id||"")}</div><h2>${esc(a)} vs ${esc(b)}</h2><div class="meta">${esc(m.venue||"Noida Intercollege Cricket Ground")}</div></div><div class="team-logos">${logo(a)}${logo(b)}</div></div><div style="margin-top:15px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="openSharedLive(${jsArg(m.match_id)})">Open Live Scorecard</button><button class="btn secondary" onclick="copyLiveLink(${jsArg(m.match_id)})">Copy Live Link</button></div></div>`
}
function openSharedLive(matchId){
  setUrlMatchId(matchId);
  localStorage.setItem("nict_active_match_id",String(matchId));
  view="live";
  render();
}
function matches(){
 const rows=(DATA.live_matches||[]).map((m,i)=>`<tr><td>${esc(m.match_id||"MATCH-"+(i+1))}</td><td>${esc(m.format||"")}</td><td><b>${esc(st(m.team_a))}</b> vs <b>${esc(st(m.team_b))}</b></td><td><span class="pill ${m.status==="completed"?"":"live-pill"}">${esc(m.status||"Replay")}</span></td><td><button class="btn" onclick="openSharedLive(${jsArg(m.match_id)})">Watch</button> <button class="btn secondary" onclick="copyLiveLink(${jsArg(m.match_id)})">Copy Link</button></td></tr>`);
 app.innerHTML=head("Matches","Share the live link — everyone sees the same scorecard in real time")+table(["Match","Format","Teams","Status","Actions"],rows);
}
function startLive(i){
  const m=DATA.live_matches?.[i];
  if(m)openSharedLive(m.match_id||m.file_name||"");
}

function getActiveMatch(){
 const urlId=getUrlMatchId();
 const id=urlId||localStorage.getItem("nict_active_match_id")||"";
 if(id){
   const byId=findMatchById(id);
   if(byId)return byId;
 }
 return DATA.live_matches?.[0]||null;
}

let replayStart=0;
function live(){
 const m=getActiveMatch();
 if(!m){
   const pendingId=getUrlMatchId();
   app.innerHTML=head("Live Scores")+
   (pendingId
     ?`<div class="card empty">Loading shared match <b>${esc(pendingId)}</b> from the server…</div>
        <div style="margin-top:12px"><button class="btn" onclick="ensureSharedMatchLoaded().then(()=>render())">Retry</button></div>`
     :"<div class='card empty'>No match loaded. Open a shared link or choose a match from the Matches page.</div>");
   if(pendingId)ensureSharedMatchLoaded().then(found=>{if(found)render()});
   return;
 }
 if(!liveTimer)liveTimer=setInterval(()=>{if(view==="live"){const active=getActiveMatch();if(active)renderLive(active)}},1000);
 renderLive(m);
}

function findMatchById(matchId){
  return (DATA.live_matches||[]).find(
    x=>String(x.match_id||x.id||"")===String(matchId||"")
  );
}

function findMatchIndex(matchId){
  return (DATA.live_matches||[]).findIndex(
    x=>String(x.match_id||x.id||"")===String(matchId||"")
  );
}
function matchTimings(m){
  const rules=m?.rules||{};
  return {
    ballDelay:Number(rules.ball_delay_seconds)||BALL_DELAY_SECONDS,
    overBreak:Number(rules.over_break_seconds)||OVER_BREAK_SECONDS,
    inningsBreak:Number(rules.innings_break_seconds)||INNINGS_BREAK_SECONDS,
    preMatch:Number(rules.pre_match_delay_seconds)||TOSS_BREAK_SECONDS
  };
}

function normalizedMatch(m){
 const copy=JSON.parse(JSON.stringify(m));
 let a=st(copy.team_a),b=st(copy.team_b);
 if((!a)||(!b)){
   const source=(copy.file_name||copy.match_id||"");
   const match=source.match(/([^/\\]+?)_vs_([^/\\]+?)(?:\.json)?$/i);
   if(match){a=st(match[1]);b=st(match[2])}
 }
 
 copy.team_a=a||"GCET";copy.team_b=b||"GLB";copy.deliveries=copy.deliveries||[];
 const toss=copy.toss||{};
 copy.toss_winner=st(
   copy.toss_winner||
   toss.winner||
   toss.team||
   toss.won_by||
   copy.toss_result?.winner||
   ""
 );
 copy.toss_decision=String(
   copy.toss_decision||
   toss.decision||
   toss.choice||
   toss.elected_to||
   copy.toss_result?.decision||
   ""
 );
 return copy;
}
function tossSummary(m){if(!m.toss_winner)return "Toss result not available";const decision=String(m.toss_decision||"").toLowerCase();return `${st(m.toss_winner)} won the toss and chose to ${decision.includes("bowl")||decision.includes("field")?"bowl":"bat"}`}
function careerFormat(format){return /t20/i.test(String(format||""))?"T20":/odi/i.test(String(format||""))?"ODI":"Test"}
function matchResultText(m,shown){
  if(!shown.length||shown.length<(m.deliveries||[]).length)return "";
  return deriveCompletedMatchResult({
    ...m,
    deliveries:shown
  }).text||"";
}


function milestoneDelivery(ds,index){
  const d=ds[index];
  const out={...d};
  const innings=Number(d?.innings||1);
  const batter=st(d.batsman||d.striker||"");
  const bowler=st(d.bowler||"");

  let batterBefore=0,batterAfter=0;
  let bowlerBefore=0,bowlerAfter=0;

  for(let i=0;i<=index;i++){
    const x=ds[i];
    if(Number(x?.innings||1)!==innings)continue;

    if(st(x.batsman||x.striker)===batter){
      const r=Number(x.runs||0);
      batterAfter+=r;
      if(i<index)batterBefore+=r;
    }

    if(st(x.bowler)===bowler){
      const wt=String(x.wicket_type||x.dismissal_type||"").toLowerCase();
      if(
        Number(x.wicket||0)>0 &&
        !/run.?out|retired|obstructing|timed.?out/i.test(wt)
      ){
        bowlerAfter+=Number(x.wicket||0);
        if(i<index)bowlerBefore+=Number(x.wicket||0);
      }
    }
  }

  out.batter_50=batterBefore<50&&batterAfter>=50;
  out.batter_100=batterBefore<100&&batterAfter>=100;
  out.bowler_5_wickets=bowlerBefore<5&&bowlerAfter>=5;

  return out;
}


function renderLive(raw){
  const m=normalizedMatch(raw);
  const ds=m.deliveries||[];

  const elapsed=Math.max(
    0,
    m.started_at
      ?(Date.now()-new Date(m.started_at).getTime())/1000
      :0
  );

  const replayState=getReplayState(ds,elapsed,m);
  const shown=ds.slice(0,replayState.idx);

  /*
    Stats refresh is triggered separately once the shared server
    marks the match completed after the final ball.
  */

  const prepared=shown.map((d,i)=>({
    ...d,
    display_ball:computedBallLabel(ds,i)
  }));

  const state=calcMatch(prepared,m);
  const currentInnings=state.innings;

  const last=prepared.slice(-6).map(d=>ballChip(d)).join("");

  const seenBatters=new Set();
  const commentary=prepared.map((d,i)=>{
    const md=milestoneDelivery(prepared,i);
    const newcomers=[d.batsman,d.non_striker]
      .filter(n=>n&&!seenBatters.has(n));
    newcomers.forEach(n=>seenBatters.add(n));
    return commentaryHTML(
      md,
      newcomers,
      m.format,
      d.display_ball
    );
  });

  const comments=commentary.reverse().join("");
  const a=state.team_a,b=state.team_b;
  const currentBatting=state.team;
  const matchEvent=replayState.event;

  const finished=shown.length===ds.length&&ds.length>0;
  const resultText=finished?matchResultText(m,shown):"";

  if(
    finished &&
    (
      m.player_records_enabled===true ||
      String(m.status||"").toLowerCase()==="completed"
    )
  ){
    const matchId=String(m.match_id||"");
    if(matchId && !STATS_REFRESHED_FOR.has(matchId)){
      STATS_REFRESHED_FOR.add(matchId);
      saveStatsRefreshedFor();
      refreshStatsFromServer({silent:true});
    }
  }

  let statusLabel="LIVE";
  const testSession=testSessionForDelivery(prepared,Math.max(0,prepared.length-1),m);
  const testDayLabel=testSession?` · DAY ${testSession.day}`:"";
  if(resultText)statusLabel="RESULT";
  else if(finished)statusLabel="RESULT";
  else if(matchEvent)statusLabel=statusLabelForEvent(matchEvent,statusLabel);

  const eventText=resultText||(matchEvent?eventLabel(matchEvent):"");
  const breakBanner=breakBannerHTML(matchEvent);

  app.innerHTML=head(
    `${a} vs ${b}`,
    `${m.format||"Match"} · ${m.match_id||""}`
  )+
  `<div class="notice" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">
    <span>🌐 <b>Live on all devices</b> · synced every 3 seconds from the shared server</span>
    <button class="btn secondary" onclick="copyLiveLink(${jsArg(m.match_id)})">Copy Live Link</button>
  </div>`+
  `<div class="notice"><b>Toss:</b> ${esc(tossSummary(m))}</div>`+
  breakBanner+
  (eventText && !breakBanner
    ?`<div class="notice">${esc(eventText)}</div>`
    :"")+
  `<div class="scorehero">
    <div class="scoretop">
      <div>
        <div class="meta">${statusLabel} · INNINGS ${currentInnings}${testDayLabel}</div>
        <h2>${esc(currentBatting)}</h2>
        <div class="score">${state.runs}/${state.wickets}
          <span class="meta">(${state.overs})</span>
        </div>
        <div class="meta">${state.crr} CRR</div>
      </div>
      <div class="team-logos">${logo(a)}<b>vs</b>${logo(b)}</div>
    </div>

    <div style="margin-top:15px">
      <b>🏏 ${esc(state.striker?.name||"—")}
      ${state.striker?state.striker.runs+"* ("+state.striker.balls+")":""}</b>
      · ${esc(state.nonStriker?.name||"—")}
      ${state.nonStriker?state.nonStriker.runs+" ("+state.nonStriker.balls+")":""}
    </div>
  </div>

  <div class="section grid">
    <div class="card">
      <h3>Partnership</h3>
      <div class="big">${state.partnership.runs}</div>
      <span class="muted">${state.partnership.balls} legal balls</span>
    </div>

    <div class="card">
      <h3>Bowler</h3>
      <div>${esc(state.bowler.name||"—")}</div>
      <span class="muted">${state.bowler.overs} · ${state.bowler.runs}-${state.bowler.wickets}</span>
    </div>

    <div class="card">
      <h3>Venue</h3>
      <div>${esc(m.venue||"—")}</div>
    </div>

    <div class="card">
      <h3>Umpires</h3>
      <div>${esc([m.umpire_1,m.umpire_2].filter(Boolean).join(" · ")||"—")}</div>
    </div>
  </div>

  <div class="section">
    <h2>Last balls</h2>
    <div class="lastballs">${last||"<span class='muted'>Waiting for first delivery...</span>"}</div>
  </div>

  <div class="section">
    <h2>Playing XI</h2>
    ${playingXI(m,a,b)}
  </div>

  ${allInningsCards(prepared,m)}

  <div class="section">
    <h2>Commentary</h2>
    ${comments||"<div class='empty'>No commentary yet.</div>"}
  </div>`;
}

function deliveryIndex(ds,elapsed){
 if(!ds.length)return 0;
 let t=0;
 for(let i=0;i<ds.length;i++){
   const prev=i?ds[i-1]:null;
  const overBreak=prev && legalBall(prev) && legalCountBefore(ds,i)%6===0 ? OVER_BREAK_SECONDS:0;
  const dur=BALL_DELAY_SECONDS+overBreak;
   if(elapsed<t+dur)return i;
   t+=dur;
 }
 return ds.length;
}
function formatCountdown(seconds){
 const s=Math.max(0,Math.ceil(Number(seconds||0)));
 const m=Math.floor(s/60),r=s%60;
 return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
}
function eventLabel(event){
 if(!event)return "";
 if(event.type==="toss")return `Toss result confirmed · First ball in ${formatCountdown(event.remaining)}`;
 if(event.type==="pre_match")return `Match starting in ${formatCountdown(event.remaining)}`;
 if(event.type==="waiting_start")return "Waiting for admin to start the match from the Admin panel.";
 if(event.type==="innings_break")return `Innings break · Play resumes in ${formatCountdown(event.remaining)}`;
 if(event.type==="over_break")return `Over break · Next ball in ${formatCountdown(event.remaining)}`;
 if(event.type==="tea")return `Tea break · Play resumes in ${formatCountdown(event.remaining)}`;
 if(event.type==="drinks")return `Drinks break · Play resumes in ${formatCountdown(event.remaining)}`;
 if(event.type==="day_break")return `Stumps · Day ${event.day||""} complete · Next session in ${formatCountdown(event.remaining)}`;
 if(event.type==="rain")return "Rain suspension";
 if(event.type==="suspend")return "Match suspended";
 if(event.type==="draw")return "Match drawn";
 return "Match in progress";
}

function statusLabelForEvent(event,defaultLabel="LIVE"){
 if(!event)return defaultLabel;
 const labels={
  toss:"TOSS · PRE-MATCH",
  pre_match:"PRE-MATCH",
  waiting_start:"NOT STARTED",
  innings_break:"INNINGS BREAK",
  over_break:"OVER BREAK",
  tea:"TEA BREAK",
  drinks:"DRINKS BREAK",
  day_break:"STUMPS",
  rain:"RAIN DELAY",
  suspend:"SUSPENDED"
 };
 return labels[event.type]||defaultLabel;
}

function breakBannerHTML(event){
 if(!event)return "";
 if(event.type==="rain"||event.type==="suspend"||event.type==="waiting_start"){
   return `<div class="notice break-banner" style="text-align:center;padding:18px">
     <div class="meta">${esc(statusLabelForEvent(event))}</div>
     <div style="margin-top:8px">${esc(eventLabel(event))}</div>
   </div>`;
 }
 if(event.remaining===undefined)return "";
 return `<div class="notice break-banner" style="text-align:center;padding:18px">
   <div class="meta">${esc(statusLabelForEvent(event))}</div>
   <div class="big" style="font-size:2rem;margin-top:8px">${formatCountdown(event.remaining)}</div>
   <div style="margin-top:8px">${esc(eventLabel(event))}</div>
 </div>`;
}
function testSessionForDelivery(ds,index,m){
  if(careerFormat(m?.format)!=="Test")return null;

  const rules=m.rules||{};
  const schedule=rules.test_session_schedule||m.test_session_schedule;
  if(!schedule)return null;

  const d=ds[index];
  const innings=Number(d?.innings||1);

  let legal=0;
  for(let i=0;i<index;i++){
    if(Number(ds[i]?.innings||1)===innings&&legalBall(ds[i]))legal++;
  }

  return {
    day:Math.floor(legal/Math.max(1,Number(schedule.overs_per_day||80)))+1,
    legal
  };
}

function getActiveAdminHold(m,ballIndex){
  const events=Array.isArray(m?.events)?m.events:[];
  for(const e of events){
    if(e.resumed)continue;
    if((e.type==="rain"||e.type==="suspend")&&Number(e.afterBall)===Number(ballIndex)){
      return e.type;
    }
  }
  return null;
}

function getReplayState(ds,elapsed,m){
  elapsed=Math.max(0,Number(elapsed)||0);
  const timings=matchTimings(m);
  let time=0;

  if(!m.started_at){
    return {
      idx:0,
      event:{type:"waiting_start",remaining:0}
    };
  }

  if(elapsed<timings.preMatch){
    return {
      idx:0,
      event:{
        type:m.toss_winner?"toss":"pre_match",
        remaining:timings.preMatch-elapsed
      }
    };
  }
  time=timings.preMatch;

  let previousInnings=null;
  let legalInCurrentOver=0;
  let testDay=1;
  let dayLegal=0;
  let sessionStage=0;

  const isTest=careerFormat(m?.format)==="Test";
  const rules=m.rules||{};

  const testSchedule={
    firstSessionOvers:Number(rules.test_first_session_overs||30),
    secondSessionOvers:Number(rules.test_second_session_overs||30),
    finalSessionOvers:Number(rules.test_final_session_overs||25),
    drinksSeconds:Number(rules.test_drinks_break_seconds||900),
    teaSeconds:Number(rules.test_tea_break_seconds||900),
    dayBreakSeconds:Number(rules.test_day_break_seconds||15*60*60)
  };

  for(let i=0;i<ds.length;i++){
    const d=ds[i];
    const innings=Number(d.innings||1);

    const adminHold=getActiveAdminHold(m,i);
    if(adminHold){
      return {
        idx:i,
        event:{type:adminHold,remaining:0}
      };
    }

    if(previousInnings!==null&&innings!==previousInnings){
      if(elapsed<time+timings.inningsBreak){
        return {
          idx:i,
          event:{
            type:"innings_break",
            remaining:time+timings.inningsBreak-elapsed
          }
        };
      }
      time+=timings.inningsBreak;
      legalInCurrentOver=0;
      dayLegal=0;
      sessionStage=0;
    }

    if(i>0&&legalInCurrentOver===0){
      if(elapsed<time+timings.overBreak){
        return {
          idx:i,
          event:{
            type:"over_break",
            remaining:time+timings.overBreak-elapsed
          }
        };
      }
      time+=timings.overBreak;
    }

    /*
      Test-session simulation:
      30 overs -> 15 min drinks -> 30 overs -> 15 min tea
      -> 25 overs -> stumps -> next day starts automatically.
      These are NICA simulation settings, not claimed as ICC timing rules.
    */
    if(isTest&&legalBall(d)){
      const sessionLimit=
        sessionStage===0
          ?testSchedule.firstSessionOvers*6
          :sessionStage===1
            ?testSchedule.secondSessionOvers*6
            :testSchedule.finalSessionOvers*6;

      if(dayLegal>=sessionLimit){
        let breakSeconds=0;
        let breakType="drinks";

        if(sessionStage===0){
          breakSeconds=testSchedule.drinksSeconds;
          breakType="drinks";
        }else if(sessionStage===1){
          breakSeconds=testSchedule.teaSeconds;
          breakType="tea";
        }else{
          breakSeconds=testSchedule.dayBreakSeconds;
          breakType="day_break";
          testDay++;
        }

        if(elapsed<time+breakSeconds){
          return {
            idx:i,
            event:{
              type:breakType,
              remaining:time+breakSeconds-elapsed,
              day:testDay
            }
          };
        }

        time+=breakSeconds;

        if(sessionStage===0){
          sessionStage=1;
        }else if(sessionStage===1){
          sessionStage=2;
        }else{
          sessionStage=0;
          dayLegal=0;
        }
      }
    }

    if(elapsed<time+timings.ballDelay){
      return {idx:i,event:null};
    }

    time+=timings.ballDelay;

    if(legalBall(d)){
      legalInCurrentOver++;
      if(legalInCurrentOver===6)legalInCurrentOver=0;

      if(isTest)dayLegal++;
    }

    previousInnings=innings;
  }

  return {idx:ds.length,event:null};
}

function legalCountBefore(ds,i){return ds.slice(0,i).filter(legalBall).length}
function legalBall(d){return !["wide","no-ball","noball"].includes(String(d.extra_type||"").toLowerCase())}

function inningsLimitOvers(m){
  const format=careerFormat(m?.format);
  if(format==="T20")return 20;
  if(format==="ODI")return 50;
  return null;
}

function deliveryIsFreeHit(d, previousNoBall){
  return Boolean(previousNoBall) && !d.wicket;
}

function calcMatch(ds,m,forcedInnings=null){
  const inningsNos=[...new Set(ds.map(d=>Number(d.innings||1)))].sort((a,b)=>a-b);
  const inn=forcedInnings || (inningsNos.length?inningsNos[inningsNos.length-1]:1);
  const current=ds.filter(d=>Number(d.innings||1)===inn);

  const battingTeam=
    current[0]?.batsman_team ||
    ((inn%2===1)?st(m.team_a):st(m.team_b));
  const bowlingTeam=
    current[0]?.bowling_team ||
    (battingTeam===st(m.team_a)?st(m.team_b):st(m.team_a));

  let runs=0,wickets=0,legal=0,bat={},bowl={};
  let striker="",non="";
  let partnershipRuns=0,partnershipBalls=0;
  let lastWicketAt=-1;

  const xi=m.playing_xi?.[battingTeam] ||
    DATA.squads?.[battingTeam]?.filter(x=>x.playing_xi).map(x=>x.name) || [];

  if(xi.length>=2){
    striker=xi[0];
    non=xi[1];
    bat[striker]={name:striker,runs:0,balls:0,fours:0,sixes:0,out:false,seen:false};
    bat[non]={name:non,runs:0,balls:0,fours:0,sixes:0,out:false,seen:false};
  }

  let previousNoBall=false;

  for(let index=0;index<current.length;index++){
    const d=current[index];

    const bats=d.batsman||d.striker||striker;
    const ns=d.non_striker||"";

    if(bats)striker=bats;
    if(ns)non=ns;

    if(bats&&!bat[bats])bat[bats]={name:bats,runs:0,balls:0,fours:0,sixes:0,out:false,seen:false};
    if(non&&!bat[non])bat[non]={name:non,runs:0,balls:0,fours:0,sixes:0,out:false,seen:false};
    if(bats)bat[bats].seen=true;
    if(non)bat[non].seen=true;

    const isLegal=legalBall(d);
    const r=Number(d.runs||0);
    const ex=Number(d.extra_runs||0);
    const total=r+ex;

    runs+=total;
    if(Number(d.wicket||0)>0)wickets+=Number(d.wicket||0);

    /*
      Partnership is NOT:
        batter-1 cumulative runs + batter-2 cumulative runs.
      It is the team score accumulated since the current partnership began.
      Therefore wides/no-balls are included in partnership team runs, while
      only legal deliveries count as partnership balls.
    */
    partnershipRuns+=total;
    if(isLegal)partnershipBalls++;

    if(bats){
      bat[bats].runs+=r;
      if(r===4)bat[bats].fours++;
      if(r===6)bat[bats].sixes++;
      if(isLegal)bat[bats].balls++;
    }

    if(d.dismissed_player){
      if(!bat[d.dismissed_player]){
        bat[d.dismissed_player]={
          name:d.dismissed_player,runs:0,balls:0,
          fours:0,sixes:0,out:false,seen:true
        };
      }
      bat[d.dismissed_player].out=true;
    }else if(Number(d.wicket||0)>0&&bats){
      const wt=String(d.wicket_type||d.dismissal_type||"").toLowerCase();
      if(!/run.?out/i.test(wt))bat[bats].out=true;
    }

    const bowler=d.bowler||"";
    if(bowler){
      if(!bowl[bowler])bowl[bowler]={name:bowler,legal:0,runs:0,wickets:0};
      /*
        Wides and no-balls count to bowler runs; byes/leg-byes should not.
        Keep supplied extra_runs behaviour where the feed has no detailed
        extra split, but exclude byes/leg-byes when explicitly identified.
      */
      const extraType=String(d.extra_type||"").toLowerCase();
      const bowlerRuns=
        /bye|leg.?bye/.test(extraType) ? r : r+ex;
      bowl[bowler].runs+=bowlerRuns;

      if(isLegal)bowl[bowler].legal++;

      const wt=String(d.wicket_type||d.dismissal_type||"").toLowerCase();
      if(
        Number(d.wicket||0)>0 &&
        !/run.?out|retired|obstructing|timed.?out/i.test(wt)
      ){
        bowl[bowler].wickets+=Number(d.wicket||0);
      }
    }

    if(isLegal){
      legal++;
      if(total%2===1)[striker,non]=[non,striker];

      if(legal%6===0)[striker,non]=[non,striker];
    }

    if(Number(d.wicket||0)>0){
      lastWicketAt=index;
      /*
        The next delivery starts a new partnership. Keep the current
        partnership visible as zero until the new batter faces/appears.
      */
      partnershipRuns=0;
      partnershipBalls=0;
    }

    previousNoBall=String(d.extra_type||"").toLowerCase()==="no-ball";
  }

  const s=bat[striker]||null;
  const n=bat[non]||null;

  const last=current[current.length-1];
  const bw=bowl[last?.bowler]||{
    name:last?.bowler||"",legal:0,runs:0,wickets:0
  };

  bw.overs=`${Math.floor(bw.legal/6)}.${bw.legal%6}`;

  const maxOvers=inningsLimitOvers(m);
  const reachedOverLimit=
    maxOvers!==null && legal>=maxOvers*6;

  const inningsEndFlag=
    current.length>0 &&
    Number(current[current.length-1]?.innings_end||0)===1;

  const allOut=wickets>=10;

  const complete=
    Boolean(reachedOverLimit||inningsEndFlag||allOut);

  return {
    team_a:st(m.team_a),
    team_b:st(m.team_b),
    team:battingTeam,
    innings:inn,
    runs,
    wickets,
    overs:`${Math.floor(legal/6)}.${legal%6}`,
    legalBalls:legal,
    crr:legal?(runs/(legal/6)).toFixed(2):"0.00",
    striker:s,
    nonStriker:n,
    partnership:{
      runs:partnershipRuns,
      balls:partnershipBalls
    },
    bowler:bw,
    status:complete?"Innings complete":"Live",
    bat,
    bowl,
    playingXI:xi,
    maxOvers,
    allOut
  };
}

function computedBallLabel(ds,index){
  const d=ds[index];
  const innings=Number(d?.innings||1);

  let legalBefore=0;
  for(let i=0;i<index;i++){
    if(Number(ds[i]?.innings||1)===innings&&legalBall(ds[i]))legalBefore++;
  }

  return `${Math.floor(legalBefore/6)}.${(legalBefore%6)+1}`;
}

function ballChip(d){
 const val=d.wicket?"W":(d.extra_type?String(d.extra_type).toUpperCase()+(d.extra_runs?` ${d.extra_runs}`:""):String(d.runs??0));
 let cls=d.wicket?"wicket":Number(d.runs)===6?"six":Number(d.runs)===4?"four":d.extra_type?"extra":"";
 return `<span class="ball ${cls}" title="${esc(d.commentary||"")}">${esc(val)}</span>`;
}
function commentaryHTML(d,newcomers=[],format="",displayBall=""){
  const r=Number(d.runs||0), ex=Number(d.extra_runs||0);
  const headline=d.wicket
    ?"WICKET"
    :r===6
      ?"SIX"
      :r===4
        ?"FOUR"
        :(d.extra_type||"").toUpperCase()||`${r} RUN`;

  const tags=[
    d.shot?`Shot: ${d.shot}`:"",
    d.shot_direction?`Direction: ${d.shot_direction}`:"",
    d.length?`Length: ${d.length}`:"",
    d.line?`Line: ${d.line}`:""
  ].filter(Boolean);

  let body=d.commentary;

  if(!body){
    if(d.wicket){
      const wt=String(d.wicket_type||d.dismissal_type||"").toLowerCase();
      const victim=d.dismissed_player||d.batsman||"Batter";
      if(/catch|caught/.test(wt))body=`WICKET! ${victim} is caught by ${d.fielder||"the fielder"}.`;
      else if(/stump/.test(wt))body=`WICKET! ${victim} is stumped by ${d.keeper||d.fielder||"the wicketkeeper"}.`;
      else if(/run.?out/.test(wt))body=`WICKET! ${victim} is run out by ${d.fielder||"the fielder"}.`;
      else if(/bowled/.test(wt))body=`WICKET! ${victim} is bowled by ${d.bowler||"the bowler"}.`;
      else body=`WICKET! ${victim} is dismissed${d.fielder?` by ${d.fielder}`:""}.`;
    }else if(r===6)body=`${d.batsman} gets under it and sends the ball over the boundary for six.`;
    else if(r===4)body=`${d.batsman} finds the gap and the ball races away for four.`;
    else if(ex)body=`${d.batsman} faces a ${String(d.extra_type).toLowerCase()} and ${r?`takes ${r} run${r>1?"s":""}.`:"the extra is added."}`;
    else if(r===0)body=`Good delivery. ${d.batsman} plays it safely into the field.`;
    else body=`${d.batsman} plays the shot and completes ${r} run${r>1?"s":""}.`;
  }

  const career=newcomers.map(name=>{
    const p=DATA.players_format.find(
      x=>x.name===name&&careerFormat(x.format)===careerFormat(format)
    );
    if(!p)return `${name} career record unavailable.`;
    return `${name} career: ${p.runs} runs, ${p.average} average, ${p.strike_rate} SR, ${p.hundreds} hundreds, ${p.fifty_plus} scores of 50+.`;
  }).join(" ");

  const milestone=[];
  if(d.batter_50||d.fifty||d.fifty_plus_milestone)milestone.push("50");
  if(d.batter_100||d.hundred||d.hundred_milestone)milestone.push("100");
  if(d.bowler_5_wickets||d.five_wicket_haul||d.five_wickets)milestone.push("5 WICKET HAUL");

  const milestoneText=milestone.length
    ? `<strong class="milestone">${esc(milestone.join(" · "))}</strong>`
    : "";

  const text=milestoneText||esc(body);

  return `<div class="commentary ${milestone.length?"milestone-commentary":""}" style="${milestone.length?"font-weight:700;":""}">
    <div class="commentary-head">
      <span>${esc(displayBall||d.display_ball||`${d.over??""}.${d.ball??""}`)}</span>
      <span class="pill ${d.wicket?"live-pill":""}">${esc(headline)}</span>
      <span>${esc(d.batsman||"")}</span>
    </div>
    <div class="commentary-body">${text}${career?` ${esc(career)}`:""}</div>
    ${tags.length?`<div class="shot-tags">${tags.map(x=>`<span class="tag">${esc(x)}</span>`).join("")}</div>`:""}
  </div>`;
}
function battingCard(state,m){
 const team=state.team;
 const xi=m.playing_xi?.[team] || DATA.squads?.[team]?.filter(x=>x.playing_xi).map(x=>x.name) || [];
 const names=[...new Set([...xi,...Object.keys(state.bat)])];
 const rows=names.map(name=>{
   const x=state.bat[name];
   if(!x){
     return `<tr><td>${esc(name)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>Yet to bat</td></tr>`;
   }
   const isStriker=name===state.striker?.name;
   const status=x.out?"Out":(x.seen||x.balls>0?"Not out":"Yet to bat");
   return `<tr><td>${isStriker?"🏏 ":""}${esc(name)}${isStriker&&!x.out?"*":""}</td><td>${x.runs}</td><td>${x.balls}</td><td>${x.fours}</td><td>${x.sixes}</td><td>${x.balls?(x.runs/x.balls*100).toFixed(2):"0.00"}</td><td>${status}</td></tr>`;
 });
 return table(["Batter","R","B","4s","6s","SR","Status"],rows);
}
function bowlingCard(state){
 const rows=Object.values(state.bowl).map(x=>`<tr><td>${esc(x.name)}</td><td>${Math.floor(x.legal/6)}.${x.legal%6}</td><td>—</td><td>${x.runs}</td><td>${x.wickets}</td><td>${x.legal?(x.runs/(x.legal/6)).toFixed(2):"0.00"}</td></tr>`);
 return table(["Bowler","O","M","R","W","Econ"],rows);
}
function allInningsCards(ds,m){
  const count=careerFormat(m.format)==="Test"?4:2;

  return Array.from({length:count},(_,index)=>{
    const innings=index+1;
    const inningsData=ds.filter(d=>Number(d.innings||1)===innings);
    const state=calcMatch(inningsData,m,innings);
    const battingTeam=state.team;
    const bowlingTeam=
      battingTeam===st(m.team_a)?st(m.team_b):st(m.team_a);

    return `<div class="section">
      <h2>Innings ${innings}: ${esc(battingTeam)} batting</h2>
      <div class="muted innings-summary">
        ${inningsData.length
          ?`${state.runs}/${state.wickets} · ${state.overs} overs`
          :"Not started"}
      </div>
      <h3>Batting Scorecard</h3>
      ${inningsData.length
        ?battingCard(state,m)
        :`<div class="card empty">No deliveries recorded.</div>`}
      <h3>Bowling Card: ${esc(bowlingTeam)}</h3>
      ${inningsData.length
        ?bowlingCard(state)
        :`<div class="card empty">No deliveries recorded.</div>`}
    </div>`;
  }).join("");
}

function playingXI(m,a,b){
 const ix=m.playing_xi||{};
 const squads=DATA.squads||{};
 const roleFor=(team,n)=>m.squad_roles?.[team]?.[n]||squads[team]?.find(x=>x.name===n)?.role||"Player";
 function box(team){
   let names=ix[team]||squads[team]?.filter(x=>x.playing_xi).map(x=>x.name)||[];
   if(!names.length)names=squads[team]?.slice(0,11).map(x=>x.name)||[];
   return `<div class="card"><div class="squad-team"><h3>${esc(team)} · Playing XI</h3></div><div class="squad-list">${names.slice(0,11).map(n=>`<div class="player-row"><b>${esc(n)}</b><small>${esc(roleFor(team,n))}</small></div>`).join("")}</div><p class="muted">${Math.max(0,(squads[team]?.length||20)-11)} squad members on bench/standby</p></div>`;
 }
 return `<div class="squads">${box(a)}${box(b)}</div>`;
}

function mergedTeamRecords(){
  const base=JSON.parse(JSON.stringify(DATA.teams||[]));
  const dynamic=DATA.team_records||[];
  const map=Object.fromEntries(
    base.map(t=>[st(t.short_team||t.team),{...t}])
  );

  for(const tr of dynamic){
    const key=st(tr.team||tr.short_team);
    if(!map[key]){
      map[key]={
        team:tr.team||key,
        short_team:key,
        matches:0,
        wins:0,
        losses:0,
        no_results:0,
        win_percentage:0
      };
    }

    map[key].matches+=Number(tr.matches||0);
    map[key].wins+=Number(tr.wins||0);
    map[key].losses+=Number(tr.losses||0);
    map[key].no_results+=Number(tr.ties||0)+Number(tr.draws||0);
    map[key].win_percentage=map[key].matches
      ?+((map[key].wins/map[key].matches)*100).toFixed(1)
      :0;
  }

  return Object.values(map).sort(
    (a,b)=>b.win_percentage-a.win_percentage||a.short_team.localeCompare(b.short_team)
  );
}

function teamsPage(){
  const rows=mergedTeamRecords().map(t=>`<tr><td><b>${esc(t.short_team)}</b></td><td>${t.matches}</td><td>${t.wins}</td><td>${t.losses}</td><td>${t.no_results}</td><td>${t.win_percentage}%</td></tr>`);
  app.innerHTML=head("Teams","Every team has 20 registered players · 11 playing XI + 9 standby · records update automatically after each match")+table(["Team","Matches","Wins","Losses","NR","Win %"],rows);
}
function playersPage(){const rows=mergedCareerRecords().map(p=>`<tr><td>${playerLink(p.name)}</td><td>${p.team}</td><td>${esc(p.role)}</td><td>${fmt(p.runs)}</td><td>${p.average}</td><td>${p.hundreds}</td><td>${p.fifty_plus}</td><td>${p.wickets}</td><td>${p.catches}</td></tr>`);app.innerHTML=head("Players","100-player tournament database")+`<input id="ps" class="input search" placeholder="Search player or team">`+table(["Player","Team","Role","Runs","Avg","100s","50+","Wkts","Catches"],rows);document.getElementById("ps").oninput=e=>{let q=e.target.value.toLowerCase();document.querySelectorAll(".table tbody tr").forEach(r=>r.style.display=r.innerText.toLowerCase().includes(q)?"":"none")}}
function playerPage(){
 const p=mergedCareerRecords().find(x=>x.name===currentPlayer);
 if(!p)return playersPage();
 const fs=DATA.players_format.filter(x=>x.name===p.name);
 const rows=fs.map(x=>`<tr><td>${x.format}</td><td>${x.matches}</td><td>${x.innings}</td><td><b>${fmt(x.runs)}</b></td><td>${x.average}</td><td>${x.hundreds}</td><td>${x.fifty_plus}</td><td>${x.fours}</td><td>${x.sixes}</td><td>${x.strike_rate}</td><td>${x.wickets}</td></tr>`);
 app.innerHTML=head(p.name,`${p.team} · ${p.role} · ${p.batting_style} · ${p.bowling_style}`)+
 `<div class="grid">
   <div class="card"><h3>Career Runs</h3><div class="big">${fmt(p.runs)}</div></div>
   <div class="card"><h3>Career Average</h3><div class="big">${p.average}</div></div>
   <div class="card"><h3>100s</h3><div class="big">${p.hundreds}</div></div>
   <div class="card"><h3>50+ Scores</h3><div class="big">${p.fifty_plus}</div></div>
 </div>
 <div class="section"><h2>Career by format</h2>${table(["Format","Mat","Inn","Runs","Avg","100s","50+","4s","6s","SR","Wkts"],rows)}</div>
 <div class="section"><h2>Individual records</h2><div class="record-grid">
   <div class="card">${record("Highest Score",p.highest)}${record("Fours",p.fours)}${record("Sixes",p.sixes)}${record("Wickets",p.wickets)}</div>
   <div class="card">${record("Catches",p.catches)}${record("Stumpings",p.stumpings)}${record("Run-outs",p.runouts)}${record("Matches",p.matches)}</div>
 </div></div>`;
}
function record(a,b){return `<div class="record-item"><span>${a}</span><b>${b}</b></div>`}

function rankingsPage(){
  app.innerHTML=head("Rankings","Format-specific player rankings")+
  `<div class="grid">
    <div class="card"><h3>Batting Rankings</h3><button class="btn" onclick="navigate('batRankings')">Open</button></div>
    <div class="card"><h3>Bowling Rankings</h3><button class="btn" onclick="navigate('bowlRankings')">Open</button></div>
    <div class="card"><h3>All-Rounder Rankings</h3><button class="btn" onclick="navigate('allRoundRankings')">Open</button></div>
  </div>`;
}
function formatPicker(){return `<label class="format-picker">Format <select id="rankingFormat" class="input"><option>T20</option><option>ODI</option><option>Test</option></select></label>`}
function rankingRows(arr){return arr.filter(x=>x.format===rankingFormat).sort((a,b)=>Number(b.rating)-Number(a.rating)||a.player.localeCompare(b.player)).map((x,i)=>`<tr><td>${i+1}</td><td>${playerLink(x.player)}</td><td>${x.short_team}</td><td>${x.format}</td><td>${x.rating}</td></tr>`)}
function updateRankingFormat(){rankingFormat=document.getElementById("rankingFormat").value;render()}
function battingRankings(){const arr=DATA.batting_rankings.filter(x=>x.format===rankingFormat).sort((a,b)=>Number(b.rating)-Number(a.rating)||a.player.localeCompare(b.player));app.innerHTML=head("Batsman Rankings","Format-specific batting rating")+formatPicker()+table(["Rank","Player","Team","Format","Rating"],arr.map((x,i)=>`<tr><td>${i+1}</td><td>${playerLink(x.player)}</td><td>${x.short_team}</td><td>${x.format}</td><td>${x.rating}</td></tr>`));document.getElementById("rankingFormat").value=rankingFormat;document.getElementById("rankingFormat").onchange=updateRankingFormat}
function bowlingRankings(){const arr=DATA.bowling_rankings.filter(x=>x.format===rankingFormat);app.innerHTML=head("Bowling Rankings","Format-specific bowling rating")+formatPicker()+table(["Rank","Player","Team","Format","Rating"],rankingRows(arr));document.getElementById("rankingFormat").value=rankingFormat;document.getElementById("rankingFormat").onchange=updateRankingFormat}
function allRoundRankings(){const arr=DATA.ratings.filter(x=>x.format===rankingFormat).map(x=>({...x,overall:(Number(x.batting_rating)+Number(x.bowling_rating))/2})).sort((a,b)=>b.overall-a.overall||a.player.localeCompare(b.player));app.innerHTML=head("All-Rounder Rankings","Combined batting + bowling rating")+formatPicker()+table(["Rank","Player","Team","Format","Overall"],arr.map((x,i)=>`<tr><td>${i+1}</td><td>${playerLink(x.player)}</td><td>${x.short_team}</td><td>${x.format}</td><td>${x.overall.toFixed(1)}</td></tr>`));document.getElementById("rankingFormat").value=rankingFormat;document.getElementById("rankingFormat").onchange=updateRankingFormat}
function recordFormatPicker(){return `<label class="format-picker">Format <select id="recordFormat" class="input"><option>T20</option><option>ODI</option><option>Test</option></select></label>`}
function updateRecordFormat(){recordFormat=document.getElementById("recordFormat").value;render()}
function leader(field,title){const formatField=field==="fifty_plus"?"fifties":field,arr=DATA.players_format.filter(x=>careerFormat(x.format)===recordFormat).sort((a,b)=>Number(b[formatField])-Number(a[formatField])||a.name.localeCompare(b.name));app.innerHTML=head(title,"Format-specific leaderboard")+recordFormatPicker()+table(["Rank","Player","Team","Format",title.replace("Most ","")],arr.map((x,i)=>`<tr><td>${i+1}</td><td>${playerLink(x.name)}</td><td>${x.short_team}</td><td>${x.format}</td><td>${x[formatField]}</td></tr>`));document.getElementById("recordFormat").value=recordFormat;document.getElementById("recordFormat").onchange=updateRecordFormat}
function careerRecords(){
 const records=mergedCareerRecords();
 app.innerHTML=head("Career Records","All formats combined · averages, 100s, 50+ scores and career totals")+
 `<input id="careerSearch" class="input search" placeholder="Search player or team">`+
 table(["Rank","Player","Team","Runs","Avg","100s","50+","4s","6s","Wkts"],
   records.map((x,i)=>`<tr><td>${i+1}</td><td>${playerLink(x.name)}</td><td>${esc(x.team)}</td><td>${fmt(x.runs)}</td><td>${x.average}</td><td>${x.hundreds}</td><td>${x.fifty_plus}</td><td>${x.fours}</td><td>${x.sixes}</td><td>${x.wickets}</td></tr>`));
 document.getElementById("careerSearch").oninput=e=>{
   const q=e.target.value.toLowerCase();
   document.querySelectorAll(".table tbody tr").forEach(r=>r.style.display=r.innerText.toLowerCase().includes(q)?"":"none")
 };
}
function catchesPage(){
  const fromCareer=(DATA.career_records||[])
    .filter(p=>Number(p.catches||0)>0)
    .sort((a,b)=>Number(b.catches)-Number(a.catches)||a.name.localeCompare(b.name))
    .map((p,i)=>({
      catch_rank:i+1,
      player:p.name,
      short_team:p.team||p.short_team||"",
      total_catches:p.catches||0,
      total_stumpings:p.stumpings||0,
      total_runouts:p.runouts||0
    }));
  const rows=(hasStatsRows(DATA.catches)?DATA.catches:fromCareer);
  app.innerHTML=head("Most Catches","Fielding leaderboard")+
  table(["Rank","Player","Team","Catches","Stumpings","Run-outs"],
    rows.map(x=>`<tr><td>${x.catch_rank||""}</td><td>${playerLink(x.player)}</td><td>${esc(x.short_team||"")}</td><td>${x.total_catches||0}</td><td>${x.total_stumpings||0}</td><td>${x.total_runouts||0}</td></tr>`));
}
function deriveCompletedMatchResult(m){
  const ds=Array.isArray(m?.deliveries)?m.deliveries:[];
  const teams=[st(m?.team_a),st(m?.team_b)];
  const format=careerFormat(m?.format);

  if(!ds.length)return {type:"NR",winner:"",loser:"",text:"No Result"};

  const innings={};
  for(const d of ds){
    const n=Number(d?.innings||1);
    if(!innings[n])innings[n]={runs:0,wickets:0};
    innings[n].runs+=Number(d?.runs||0)+Number(d?.extra_runs||0);
    innings[n].wickets+=Number(d?.wicket||0);
  }

  const nums=Object.keys(innings).map(Number).sort((a,b)=>a-b);
  if(nums.length<2)return {type:"NR",winner:"",loser:"",text:"No Result"};

  const firstBatTeam=
    st(ds.find(d=>Number(d?.innings||1)===nums[0])?.batsman_team)||
    st(m?.batting_first)||
    teams[0];

  const secondBatTeam=firstBatTeam===teams[0]?teams[1]:teams[0];

  if(format==="Test"&&nums.length>=4){
    const firstTotal=innings[nums[0]].runs+innings[nums[2]].runs;
    const secondTotal=innings[nums[1]].runs+innings[nums[3]].runs;

    if(firstTotal===secondTotal){
      return {type:"TIE",winner:"",loser:"",text:"Match tied"};
    }

    const winner=firstTotal>secondTotal?firstBatTeam:secondBatTeam;
    const loser=winner===firstBatTeam?secondBatTeam:firstBatTeam;

    const finalInnings=innings[nums[3]];
    const fourthTarget=firstTotal+1;

    if(finalInnings.runs>=fourthTarget){
      const wicketsRemaining=Math.max(0,10-finalInnings.wickets);
      return {
        type:"WIN",
        winner,
        loser,
        text:`${winner} won by ${wicketsRemaining} wickets`
      };
    }

    return {
      type:"WIN",
      winner,
      loser,
      text:`${winner} won by ${Math.abs(firstTotal-secondTotal)} runs`
    };
  }

  const first=innings[nums[0]].runs;
  const second=innings[nums[1]].runs;

  if(first===second){
    return {type:"TIE",winner:"",loser:"",text:"Match tied"};
  }

  const winner=second>first?secondBatTeam:firstBatTeam;
  const loser=winner===secondBatTeam?firstBatTeam:secondBatTeam;

  if(second>first){
    const wicketsRemaining=Math.max(0,10-innings[nums[1]].wickets);
    return {
      type:"WIN",
      winner,
      loser,
      text:`${winner} won by ${wicketsRemaining} wickets`
    };
  }

  return {
    type:"WIN",
    winner,
    loser,
    text:`${winner} won by ${Math.abs(first-second)} runs`
  };
}


function pointTableData(format){
  const table=Object.fromEntries(
    ["GCET","GLB","ABES","JSS","KCC"].map(team=>[
      team,{team,played:0,wins:0,losses:0,ties:0,nr:0,points:0}
    ])
  );

  const completed=(DATA.live_matches||[]).filter(m=>
    m &&
    String(m.status||"").toLowerCase()==="completed" &&
    careerFormat(m.format)===format &&
    m.points_table_enabled===true
  );

  for(const m of completed){
    const a=st(m.team_a),b=st(m.team_b);
    if(!table[a]||!table[b])continue;

    const result=deriveCompletedMatchResult(m);

    table[a].played++;
    table[b].played++;

    if(result.type==="WIN" && (result.winner===a||result.winner===b)){
      const loser=result.winner===a?b:a;
      table[result.winner].wins++;
      table[result.winner].points+=2;
      table[loser].losses++;
    }else if(result.type==="TIE"){
      table[a].ties++;
      table[b].ties++;
      table[a].points++;
      table[b].points++;
    }else{
      table[a].nr++;
      table[b].nr++;
      table[a].points++;
      table[b].points++;
    }
  }

  return Object.values(table).sort(
    (x,y)=>
      y.points-x.points ||
      y.wins-x.wins ||
      y.ties-x.ties ||
      y.played-x.played ||
      x.team.localeCompare(y.team)
  );
}

function pointTableSection(format){
  const rows=pointTableData(format).map((x,i)=>`<tr>
    <td><b>${i+1}</b></td>
    <td><b>${esc(x.team)}</b></td>
    <td>${x.played}</td>
    <td>${x.wins}</td>
    <td>${x.losses}</td>
    <td>${x.ties}</td>
    <td>${x.nr}</td>
    <td><b>${x.points}</b></td>
    <td>${x.played?((x.wins/x.played)*100).toFixed(2):"0.00"}%</td>
  </tr>`).join("");

  return `<div class="section">
    <h2>${format} Points Table 2026</h2>
    ${table(["Pos","Team","P","W","L","T","NR","Pts","Win %"],rows)}
  </div>`;
}


function pointTable(){
  app.innerHTML=head(
    "Points Table 2026",
    "Only Admin-approved completed matches are included · Win 2 · Tie/No Result 1 · Loss 0"
  )+
  pointTableSection("T20")+
  pointTableSection("ODI")+
  pointTableSection("Test");
}

function records(){app.innerHTML=head("Records","Choose an individual record category")+`<div class="grid">${[
["Career Records","careerRecords"],
["Most Centuries","centuryRecords"],
["Most 50+ Scores","fiftyRecords"],
["Most Sixes","sixRecords"],
["Most Fours","fourRecords"],
["Most Wickets","wicketRecords"],
["Most Catches","catchRecords"],
["Points Table 2026","pointTable"]
].map(x=>`<div class="card"><h3>${x[0]}</h3><button class="btn" onclick="navigate('${x[1]}')">Open</button></div>`).join("")}</div>`}
function headToHead(){
  const teams=["GCET","GLB","ABES","JSS","KCC"];
  app.innerHTML=head("Head to Head","Team vs team records from completed matches")+
  `<div class="tabs">${teams.map(t=>`<button onclick="h2h(${jsArg(t)})">${esc(t)}</button>`).join("")}</div>
  <div id="h2h" class="card empty">Select a team.</div>`;
}
function h2h(teamCode){
  const code=st(teamCode);
  const rows=(DATA.opponent_records||[]).filter(x=>{
    const a=st(x.team||x.short_team||"");
    const b=st(x.opponent||"");
    return a===code||b===code;
  }).map(x=>({
    team:st(x.team||""),
    opponent:st(x.opponent||""),
    matches:x.matches||0,
    wins:x.wins||0,
    losses:x.losses||0
  }));

  document.getElementById("h2h").innerHTML=rows.length
    ?table(["Team","Opponent","Matches","Wins","Losses"],
      rows.map(x=>`<tr><td>${esc(x.team)}</td><td>${esc(x.opponent)}</td><td>${x.matches}</td><td>${x.wins}</td><td>${x.losses}</td></tr>`))
    :"No head-to-head records yet. Complete a live match to populate this table.";
}
function stats(){app.innerHTML=head("Stats Explorer","Use the menu to move between format rankings, career records and opponent records")+`<div class="grid"><div class="card"><h3>Batting</h3><p>Runs · average · SR · 100s · 50+ · 4s · 6s</p><button class="btn" onclick="navigate('batRankings')">Open</button></div><div class="card"><h3>Bowling</h3><p>Overs · economy · wickets · bowling rating</p><button class="btn" onclick="navigate('bowlRankings')">Open</button></div><div class="card"><h3>Fielding</h3><p>Catches · stumpings · run-outs</p><button class="btn" onclick="navigate('catchRecords')">Open</button></div><div class="card"><h3>Player Career</h3><p>Separate Test, ODI and T20 records.</p><button class="btn" onclick="navigate('careerRecords')">Open</button></div></div>`}


/* ============================================================
   COMPLETED MATCH -> CAREER / FORMAT / RANKING UPDATES
   ============================================================ */

function matchCareerStats(m){
 const bat={}, bowl={}, field={}, played=new Set();
 const wicketCountsForBowler=(type)=>{
   const t=String(type||"").toLowerCase();
   return t && !/run.?out|retired|obstructing/i.test(t);
 };
 for(const d of m.deliveries||[]){
   const batsman=String(d.batsman||d.striker||"").trim();
   const bowler=String(d.bowler||"").trim();
   const innings=Number(d.innings||1);
   const r=Number(d.runs||0);
   const legal=legalBall(d);
   if(batsman){
     played.add(batsman);
     if(!bat[batsman])bat[batsman]={name:batsman,innings:new Set(),runs:0,balls:0,fours:0,sixes:0,dismissals:0};
     bat[batsman].innings.add(innings);
     bat[batsman].runs+=r;
     if(legal)bat[batsman].balls++;
     if(r===4)bat[batsman].fours++;
     if(r===6)bat[batsman].sixes++;
   }
   if(d.dismissed_player){
     played.add(String(d.dismissed_player));
     if(!bat[d.dismissed_player])bat[d.dismissed_player]={name:d.dismissed_player,innings:new Set(),runs:0,balls:0,fours:0,sixes:0,dismissals:0};
     bat[d.dismissed_player].dismissals++;
   }
   if(bowler){
     played.add(bowler);
     if(!bowl[bowler])bowl[bowler]={name:bowler,wickets:0,runs:0,balls:0};
     bowl[bowler].runs+=r+Number(d.extra_runs||0);
     if(legal)bowl[bowler].balls++;
     if(Number(d.wicket||0)>0 && wicketCountsForBowler(d.wicket_type||d.dismissal_type))bowl[bowler].wickets+=Number(d.wicket||0);
   }
   if(d.fielder){
     const wt=String(d.wicket_type||d.dismissal_type||"").toLowerCase();
     if(/catch|caught/.test(wt))field[d.fielder]=(field[d.fielder]||{catches:0,stumpings:0,runouts:0}),field[d.fielder].catches++;
     if(/stump/.test(wt))field[d.fielder]=(field[d.fielder]||{catches:0,stumpings:0,runouts:0}),field[d.fielder].stumpings++;
     if(/run.?out/.test(wt))field[d.fielder]=(field[d.fielder]||{catches:0,stumpings:0,runouts:0}),field[d.fielder].runouts++;
   }
 }
 return {bat,bowl,field,played};
}

function formatRecordFor(name,format){
 return (DATA.players_format||[]).find(x=>x.name===name&&careerFormat(x.format)===format);
}

function updateCareerFromMatch(m){
 const key=`${m.file_name||m.match_id||""}:${m.match_id||""}`;
 const done=JSON.parse(localStorage.getItem("nict_completed_matches")||"[]");
 if(done.includes(key))return false;

 const format=careerFormat(m.format), stats=matchCareerStats(m);
 const records=DATA.career_records||[], formats=DATA.players_format||[];

 Object.entries(stats.bat).forEach(([name,s])=>{
   const record=records.find(x=>x.name===name);
   const fr=formatRecordFor(name,format);
   if(!record||!fr)return;

   const innings=s.innings.size;
   const dismissals=s.dismissals;
   const previousRuns=Number(fr.runs||0);
   let balls=Number(fr.balls||0);

   if(!balls){
     const oldSR=Number(fr.strike_rate||0);
     if(oldSR>0)balls=Math.round(previousRuns*100/oldSR);
   }

   record.matches=Number(record.matches||0)+1;
   record.innings=Number(record.innings||0)+innings;
   record.not_outs=Number(record.not_outs||0)+Math.max(0,innings-dismissals);
   record.runs=Number(record.runs||0)+s.runs;
   record.fours=Number(record.fours||0)+s.fours;
   record.sixes=Number(record.sixes||0)+s.sixes;
   record.hundreds=Number(record.hundreds||0)+(s.runs>=100?1:0);
   record.fifties=Number(record.fifties||0)+(s.runs>=50&&s.runs<100?1:0);
   record.fifty_plus=Number(record.fifty_plus||0)+(s.runs>=50?1:0);
   record.highest=Math.max(Number(record.highest||0),s.runs);
   record.average=Number((record.runs/Math.max(1,record.innings-record.not_outs)).toFixed(2));

   fr.matches=Number(fr.matches||0)+1;
   fr.innings=Number(fr.innings||0)+innings;
   fr.not_outs=Number(fr.not_outs||0)+Math.max(0,innings-dismissals);
   fr.runs=Number(fr.runs||0)+s.runs;
   fr.balls=balls+s.balls;
   fr.fours=Number(fr.fours||0)+s.fours;
   fr.sixes=Number(fr.sixes||0)+s.sixes;
   fr.hundreds=Number(fr.hundreds||0)+(s.runs>=100?1:0);
   fr.fifties=Number(fr.fifties||0)+(s.runs>=50&&s.runs<100?1:0);
   fr.fifty_plus=Number(fr.fifty_plus||0)+(s.runs>=50?1:0);
   fr.high_score=Math.max(parseInt(fr.high_score)||0,s.runs);
   fr.average=Number((fr.runs/Math.max(1,fr.innings-fr.not_outs)).toFixed(2));
   fr.strike_rate=Number(((fr.runs/Math.max(1,fr.balls))*100).toFixed(2));

   // Keep legacy career-run fields synchronized internally.
   const runField=`${format.toLowerCase()}_runs`;
   record[runField]=Number(record[runField]||0)+s.runs;
   record.career_runs=Number(record.career_runs||0)+s.runs;
 });

 Object.entries(stats.bowl).forEach(([name,s])=>{
   const record=records.find(x=>x.name===name);
   const fr=formatRecordFor(name,format);
   if(record)record.wickets=Number(record.wickets||0)+s.wickets;
   if(fr)fr.wickets=Number(fr.wickets||0)+s.wickets;
 });

 Object.entries(stats.field).forEach(([name,f])=>{
   const record=records.find(x=>x.name===name);
   const fr=formatRecordFor(name,format);
   if(record){
     record.catches=Number(record.catches||0)+f.catches;
     record.stumpings=Number(record.stumpings||0)+f.stumpings;
     record.runouts=Number(record.runouts||0)+f.runouts;
   }
   if(fr){
     fr.catches=Number(fr.catches||0)+f.catches;
     fr.stumpings=Number(fr.stumpings||0)+f.stumpings;
     fr.runouts=Number(fr.runouts||0)+f.runouts;
   }
 });

 updateRatingsFromPerformance();

 localStorage.setItem("nict_career_records",JSON.stringify(records));
 localStorage.setItem("nict_players_format",JSON.stringify(formats));
 done.push(key);
 localStorage.setItem("nict_completed_matches",JSON.stringify(done));
 return true;
}

function updateRatingsFromPerformance(){
 const formats=DATA.players_format||[];
 const battingMap=new Map((DATA.batting_rankings||[]).map(x=>[`${x.player}|${careerFormat(x.format)}`,x]));
 const bowlingMap=new Map((DATA.bowling_rankings||[]).map(x=>[`${x.player}|${careerFormat(x.format)}`,x]));
 const allMap=new Map((DATA.ratings||[]).map(x=>[`${x.player}|${careerFormat(x.format)}`,x]));

 formats.forEach(p=>{
   const fmt=careerFormat(p.format);
   const runs=Number(p.runs||0), avg=Number(p.average||0), sr=Number(p.strike_rate||0);
   const wickets=Number(p.wickets||0), economy=Number(p.economy||0);

   // Ratings are intentionally capped at 99.9.
   const battingRating=Number(Math.min(99.9,Math.max(1,avg*0.75+sr*0.10+Math.log10(runs+10)*7)).toFixed(1));
   const bowlingRating=Number(Math.min(99.9,Math.max(1,wickets*2.5+(economy>0?Math.max(0,12-economy)*3:0))).toFixed(1));

   const key=`${p.name}|${fmt}`;
   const br=battingMap.get(key)||{player:p.name,short_team:p.short_team,format:fmt};
   br.player=p.name;br.short_team=p.short_team;br.format=fmt;br.rating=battingRating;br.runs=runs;br.average=avg;br.strike_rate=sr;
   battingMap.set(key,br);

   const bw=bowlingMap.get(key)||{player:p.name,short_team:p.short_team,format:fmt};
   bw.player=p.name;bw.short_team=p.short_team;bw.format=fmt;bw.rating=bowlingRating;bw.wickets=wickets;bw.economy=economy;
   bowlingMap.set(key,bw);

   const ar=allMap.get(key)||{player:p.name,short_team:p.short_team,format:fmt};
   ar.player=p.name;ar.short_team=p.short_team;ar.format=fmt;
   ar.batting_rating=battingRating;ar.bowling_rating=bowlingRating;
   ar.rating=Number(((battingRating+bowlingRating)/2).toFixed(1));
   allMap.set(key,ar);
 });

 DATA.batting_rankings=[...battingMap.values()];
 DATA.bowling_rankings=[...bowlingMap.values()];
 DATA.ratings=[...allMap.values()];

 localStorage.setItem("nict_batting_rankings",JSON.stringify(DATA.batting_rankings));
 localStorage.setItem("nict_bowling_rankings",JSON.stringify(DATA.bowling_rankings));
 localStorage.setItem("nict_ratings",JSON.stringify(DATA.ratings));
}

function loadSavedPerformance(){
  /* Intentionally disabled: rankings must be identical across devices. */
}

function mergedCareerRecords(){
  return (DATA.career_records||[]).map(x=>JSON.parse(JSON.stringify(x)));
}

function admin(){
 if(!app)return;
 if(sessionStorage.getItem("nict_admin")==="true")return adminPanel();
 app.innerHTML=`<div class="admin-lock card"><h1>🔒 Admin</h1><p class="muted">Enter the tournament admin password.</p><input id="adminPass" class="input" type="password" placeholder="Password"><button class="btn" onclick="unlock()">Unlock Admin</button><p id="adminMsg" class="muted"></p></div>`;
}
function unlock(){
  const p=document.getElementById("adminPass")?.value||"";
  if(p==="@@098"){
    sessionStorage.setItem("nict_admin","true");
    sessionStorage.setItem("nict_admin_password",p);
    view="admin";
    adminPanel();
  }else if(document.getElementById("adminMsg")){
    document.getElementById("adminMsg").textContent="Incorrect password.";
  }
}

function isMatchFinished(m){
  if(!m)return false;

  const status=String(
    m.status ||
    m.audit?.status ||
    ""
  ).toLowerCase();

  if(["completed","finished","result"].includes(status))return true;

  if(
    m.match_finished===true ||
    m.finished===true ||
    m.completed===true ||
    m.result_final===true
  )return true;

  const ds=Array.isArray(m.deliveries)?m.deliveries:[];
  if(!ds.length)return false;

  const last=ds[ds.length-1]||{};
  if(
    last.match_end===1 ||
    last.match_finished===true ||
    last.match_complete===true
  )return true;

  /*
    If the feed contains explicit innings_end markers for the final
    innings, the match is considered finished. This lets the admin
    approve player stats without a separate "Complete Match" button.
  */
  const expectedInnings=careerFormat(m.format)==="Test"?4:2;
  const inningsNumbers=[
    ...new Set(
      ds.map(d=>Number(d.innings||1))
    )
  ].sort((a,b)=>a-b);

  if(
    inningsNumbers.length>=expectedInnings &&
    Number(last.innings_end||0)===1
  )return true;

  return false;
}

function adminPanel(){
 view="admin";
 app.innerHTML=head(
   "Admin",
   "Match controls and player-stat approval"
 )+
 `<div class="notice">
   Admin controls: <b>Upload Match</b>, <b>Start Match</b>, <b>Rain</b>, <b>Suspend</b>,
   <b>Resume Match</b>, <b>Update Stats of Player</b> and <b>Delete Match</b>.
   Player and team records update automatically after a live match finishes.
   Set Vercel <code>ADMIN_PASSWORD=@@098</code> for upload/start/delete to work.
 </div>
 <div class="section">
   <h2>Upload Match JSON</h2>
   <p class="muted">Upload a ball-by-ball JSON file. Team names can be in the file or in the filename (e.g. <code>GCET_vs_GLB.json</code>).</p>
   <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px">
     <input id="jsonFile" class="input" type="file" accept=".json,application/json">
     <button class="btn" onclick="uploadJSON()">Upload Match</button>
   </div>
   <p id="uploadMsg" class="muted" style="margin-top:8px"></p>
 </div>
 <div class="section">
   <h2>Statistics</h2>
   <p class="muted">Reload player career, rankings, team records and head-to-head data from the server.</p>
   <button class="btn" onclick="rebuildCareerFromCompletedMatches()">Refresh Statistics</button>
 </div>
 <div class="section">
   <h2>Matches</h2>
   <div id="adminMatches"></div>
 </div>
 <div class="section">
   <button class="btn secondary"
     onclick="sessionStorage.removeItem('nict_admin');sessionStorage.removeItem('nict_admin_password');admin()">
     Lock Admin
   </button>
 </div>`;
 renderAdminMatches();
}

async function refreshStatsFromServer({silent=false}={}){
  try{
    const r=await fetch("/api/stats",{cache:"no-store"});
    if(!r.ok)throw new Error(await r.text()||"Stats server unavailable");
    const s=await r.json();
    if(s.error)throw new Error(s.error);

    applyStatsSnapshot(s);
    persistStatsToLocalStorage();

    if(view==="admin")renderAdminMatches();
    if(["home","teams","headToHead","pointTable","careerRecords","players","player","batRankings","bowlRankings","allRoundRankings","rankings","records","stats","catchRecords","centuryRecords","fiftyRecords","sixRecords","fourRecords","wicketRecords"].includes(view)){
      render();
    }
    if(!silent)alert("Player and team statistics have been refreshed.");
  }catch(e){
    console.warn("Stats refresh failed, keeping loaded baseline data.",e);
    applyStatsSnapshot({});
    persistStatsToLocalStorage();
    if(!silent)alert("Could not update stats from server. Showing saved player and team records.");
  }
}

async function rebuildCareerFromCompletedMatches(){
  await refreshStatsFromServer({silent:false});
}

async function updatePlayerStats(matchId){
  const m=findMatchById(matchId);
  if(!m)return;

  if(sessionStorage.getItem("nict_admin")!=="true"){
    alert("Admin authentication required.");
    return;
  }

  if(!isMatchFinished(m)){
    alert(
      "Player career cannot be updated yet. Finish the match first, then use Update Stats of Player."
    );
    return;
  }

  if(m.player_records_enabled===true){
    if(!confirm("Player stats are already approved for this match. Rebuild shared player statistics again?"))return;
  }else if(!confirm(
    `Allow player career statistics for ${st(m.team_a)} vs ${st(m.team_b)}?`
  )){
    return;
  }

  const result=deriveCompletedMatchResult(m);
  const now=new Date().toISOString();

  const updated={
    ...m,
    status:"completed",
    winner:result.winner||m.winner||"",
    result:result.text||m.result||(
      result.type==="WIN"
        ? `${result.winner} won`
        : result.type==="TIE"
          ? "Match tied"
          : "No Result"
    ),
    completed_at:m.completed_at||now,
    player_records_enabled:true,
    player_stats_approved:true,
    player_stats_approved_at:now,
    points_table_enabled:true
  };

  try{
    await adminCloud("POST",updated,m.match_id);

    const cloud=await cloudMatches();
    if(cloud!==null)applyCloudMatches(cloud);

    await rebuildCareerFromCompletedMatches();
  }catch(e){
    alert("Could not approve player stats: "+e.message);
  }
}

function renderAdminMatches(){
  const box=document.getElementById("adminMatches");
  if(!box)return;

  const local=Array.isArray(DATA.live_matches)?DATA.live_matches:[];

  const rows=local.map((m,i)=>{
    const status=String(m.status||"upcoming").toLowerCase();
    const finished=isMatchFinished(m);
    const started=["live","in_progress","started"].includes(status);
    const statsApproved=m.player_records_enabled===true;

    return `<div class="match-card">
      <b>${esc(st(m.team_a))} vs ${esc(st(m.team_b))}</b>
      <div class="muted">${esc(m.format||"")} · ${esc(m.match_id||"")}</div>

      <div class="notice">
        Status: <b>${esc(status.toUpperCase())}</b>
        ${m.result?` · ${esc(m.result)}`:""}
        ${finished?` · <b>MATCH FINISHED</b>`:""}
        ${statsApproved?` · <b>PLAYER STATS APPROVED</b>`:""}
      </div>

      <div class="event-controls">
        <label>Event after
          <select id="eventBall${i}" class="input">
            ${eventBallOptions(m)}
          </select>
        </label>

        <button class="btn"
          onclick="addMatchEvent(${jsArg(m.match_id)},'rain')">
          Rain
        </button>

        <button class="btn"
          onclick="addMatchEvent(${jsArg(m.match_id)},'suspend')">
          Suspend Match
        </button>

        <button class="btn secondary"
          onclick="resumeMatch(${jsArg(m.match_id)})">
          Resume Match
        </button>
      </div>

      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn"
          onclick="useUploaded(${jsArg(m.match_id)})"
          ${started||finished?"disabled":""}>
          Start Match
        </button>

        <button class="btn"
          onclick="updatePlayerStats(${jsArg(m.match_id)})"
          ${finished?"":"disabled"}>
          Update Stats of Player
        </button>

        <button class="btn secondary"
          onclick="copyLiveLink(${jsArg(m.match_id)})"
          ${started||finished?"":"disabled"}>
          Copy Live Link
        </button>

        <button class="btn danger"
          onclick="deleteUploaded(${jsArg(m.match_id)})">
          Delete Match
        </button>
      </div>
    </div>`;
  }).join("");

  box.innerHTML=rows||`<div class="empty">No matches available.</div>`;
}

function eventBallOptions(m){
  const count=(m.deliveries||[]).length;
  return Array.from(
    {length:count+1},
    (_,i)=>`<option value="${i}">
      ${i===0?"Before first ball":`After ball ${i}`}
    </option>`
  ).join("");
}

async function addMatchEvent(matchId,type){
  const index=findMatchIndex(matchId);
  const m=findMatchById(matchId);
  if(!m)return;

  if(sessionStorage.getItem("nict_admin")!=="true"){
    alert("Admin authentication required.");
    return;
  }

  const afterBall=Number(
    document.getElementById(`eventBall${index}`)?.value||0
  );

  const events=Array.isArray(m.events)
    ?m.events.filter(e=>!(
        Number(e.afterBall)===afterBall &&
        e.type===type
      ))
    :[];

  events.push({
    type,
    afterBall,
    resumed:false,
    created_at:new Date().toISOString()
  });

  try{
    const updated={...m,events};
    await adminCloud("POST",updated,m.match_id);
    const cloud=await cloudMatches();
    if(cloud!==null)applyCloudMatches(cloud);
    renderAdminMatches();
  }catch(e){
    alert("Could not save match event: "+e.message);
  }
}

async function resumeMatch(matchId){
  const m=findMatchById(matchId);
  if(!m)return;

  if(sessionStorage.getItem("nict_admin")!=="true"){
    alert("Admin authentication required.");
    return;
  }

  const events=(m.events||[]).map(e=>(
    e.type==="rain"||e.type==="suspend"
      ?{...e,resumed:true,resumed_at:new Date().toISOString()}
      :e
  ));

  try{
    const updated={
      ...m,
      events,
      match_suspended:false
    };

    await adminCloud("POST",updated,m.match_id);
    const cloud=await cloudMatches();
    if(cloud!==null)applyCloudMatches(cloud);
    renderAdminMatches();
  }catch(e){
    alert("Could not resume match: "+e.message);
  }
}

function removeMatchLocally(matchId){
  const id=String(matchId||"");
  if(!id)return;

  DATA.live_matches=(DATA.live_matches||[]).filter(
    m=>String(m.match_id||m.id||"")!==id
  );

  localStorage.setItem(
    "nict_uploaded_matches",
    JSON.stringify(DATA.live_matches)
  );

  const completed=safeParseJSON(localStorage.getItem("nict_completed_matches"),[]);
  localStorage.setItem(
    "nict_completed_matches",
    JSON.stringify(
      completed.filter(key=>!String(key).includes(id))
    )
  );

  STATS_REFRESHED_FOR.delete(id);
  saveStatsRefreshedFor();

  const activeId=localStorage.getItem("nict_active_match_id");
  if(String(activeId)===id){
    localStorage.removeItem("nict_active_match_id");
    localStorage.removeItem("nict_active_match");
    stopLiveTimer();
    if(view==="live")view="matches";
  }
}

function saveUploadedMatches(local){localStorage.setItem("nict_uploaded_matches",JSON.stringify(local));DATA.live_matches=local}

function parseFilename(name){
  const clean=String(name||"").replace(/\.[^.]+$/,"");
  const m=clean.match(/(.+?)_vs_(.+)$/i);
  return m?{a:st(m[1]),b:st(m[2])}:null;
}

async function uploadJSON(){
  const f=document.getElementById("jsonFile")?.files?.[0];
  const msg=document.getElementById("uploadMsg");

  if(sessionStorage.getItem("nict_admin")!=="true"){
    if(msg)msg.textContent="Admin authentication required.";
    return;
  }

  if(!f){
    if(msg)msg.textContent="Choose a JSON file first.";
    return;
  }

  if(msg)msg.textContent="Uploading...";

  try{
    const d=JSON.parse(await f.text());
    const fn=parseFilename(f.name);

    if(!Array.isArray(d.deliveries)){
      throw new Error("JSON must contain a deliveries array.");
    }

    if(fn){
      d.team_a=fn.a;
      d.team_b=fn.b;
    }

    d.team_a=st(d.team_a||"");
    d.team_b=st(d.team_b||"");

    if(!d.team_a||!d.team_b){
      throw new Error("Team names missing. Add team_a/team_b in JSON or use TeamA_vs_TeamB.json filename.");
    }

    d.file_name=f.name;
    d.match_id=d.match_id||f.name.replace(/\.json$/i,"");
    d.status="upcoming";
    d.started_at=null;
    d.rules={
      ball_delay_seconds:20,
      over_break_seconds:60,
      innings_break_seconds:900,
      pre_match_delay_seconds:900,
      ...(d.rules||{})
    };
    d.points_table_enabled=false;
    d.player_records_enabled=false;
    d.rankings_enabled=false;
    d.records_applied=false;
    d.deliveries=d.deliveries.map(x=>({
      ...x,
      batsman_team:x.batsman_team||((Number(x.innings||1)%2===1)?d.team_a:d.team_b),
      bowling_team:x.bowling_team||((Number(x.innings||1)%2===1)?d.team_b:d.team_a)
    }));
    d.events=d.events||[];

    await adminCloud("POST",d);

    const cloud=await cloudMatches();
    if(cloud!==null)applyCloudMatches(cloud);

    if(msg)msg.textContent=`Uploaded: ${d.team_a} vs ${d.team_b}`;
    document.getElementById("jsonFile").value="";
    renderAdminMatches();
  }catch(e){
    if(msg)msg.textContent="Upload failed: "+e.message;
  }
}

async function useUploaded(matchId){
  const m=findMatchById(matchId);
  if(!m)return;

  if(sessionStorage.getItem("nict_admin")!=="true"){
    alert("Admin authentication required.");
    return;
  }

  try{
    const now=new Date().toISOString();
    const updated={...m,status:"live",started_at:now};
    await adminCloud("POST",updated,m.match_id);
    const cloud=await cloudMatches();
    if(cloud!==null)applyCloudMatches(cloud);
    const fresh=findMatchById(m.match_id)||updated;
    setUrlMatchId(fresh.match_id);
    localStorage.setItem("nict_active_match_id",String(fresh.match_id));
    view="live";
    render();
  }catch(e){alert("Could not start shared live match: "+e.message)}
}
async function deleteUploaded(matchId){
  const m=findMatchById(matchId);
  if(!m)return;

  if(sessionStorage.getItem("nict_admin")!=="true"){
    alert("Admin authentication required.");
    return;
  }

  const matchId=String(m.match_id||"");

  if(!confirm(
    `Delete ${st(m.team_a)} vs ${st(m.team_b)}?\n\nThis removes the uploaded match from admin, matches list, and server, then recalculates player and team records.`
  ))return;

  removeMatchLocally(matchId);
  renderAdminMatches();
  if(view!=="admin")render();

  try{
    await adminCloud("DELETE",null,m.match_id);

    const cloud=await cloudMatches();
    if(cloud!==null)applyCloudMatches(cloud);

    await refreshStatsFromServer({silent:true});
    renderAdminMatches();
    if(view!=="admin")render();
  }catch(e){
    alert("Delete failed: "+e.message);
    const cloud=await cloudMatches();
    if(cloud!==null)applyCloudMatches(cloud);
    renderAdminMatches();
    if(view!=="admin")render();
  }
}

function initApp(){
  app=document.getElementById("app");
  if(!app){
    console.error("NICA: #app element not found.");
    return;
  }

  document.querySelectorAll("[data-view]").forEach(b=>{
    b.addEventListener("click",()=>navigate(b.dataset.view));
  });

  const menuBtn=document.getElementById("menuBtn");
  const closeBtn=document.getElementById("closeMenu");
  const overlay=document.getElementById("overlay");

  if(menuBtn){
    menuBtn.onclick=()=>{
      document.getElementById("drawer")?.classList.add("open");
      overlay?.classList.add("show");
    };
  }
  if(closeBtn)closeBtn.onclick=closeMenu;
  if(overlay)overlay.onclick=closeMenu;

  Object.assign(window,{
    navigate,
    player,
    unlock,
    uploadJSON,
    deleteUploaded,
    useUploaded,
    updatePlayerStats,
    addMatchEvent,
    resumeMatch,
    startLive,
    openSharedLive,
    copyLiveLink,
    ensureSharedMatchLoaded,
    h2h,
    updateRankingFormat,
    updateRecordFormat,
    rebuildCareerFromCompletedMatches,
    rankingsPage
  });

  loadData();
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",initApp);
}else{
  initApp();
}




