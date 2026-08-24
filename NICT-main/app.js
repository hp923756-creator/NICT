const DATA={}; let view="home", currentPlayer="", liveTimer=null, rankingFormat="T20", recordFormat="T20";
const BALL_DELAY_SECONDS=60, OVER_BREAK_SECONDS=120, INNINGS_BREAK_SECONDS=900, TOSS_BREAK_SECONDS=900;
const app=document.getElementById("app");
const TEAM_MAP={
 "Galgotia College Cricket Club":"GCET","Galgotia College":"GCET","GCCC":"GCET","GCET":"GCET",
 "GL Bajaj Cricket Club":"GLB","GL Bajaj":"GLB","GLB":"GLB",
 "ABES Cricket Club":"ABES","ABES":"ABES",
 "JSS Greater Noida Cricket Club":"JSS","JSS":"JSS",
 "KCC Cricket Club":"KCC","KCC":"KCC"
};
const LOGOS={GCET:"assets/logos/GCET.png",GLB:"assets/logos/GLB.png",ABES:"assets/logos/ABES.png",JSS:"assets/logos/JSS.png",KCC:"assets/logos/KCC.png"};

function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function st(x){return TEAM_MAP[String(x||"").trim()]||String(x||"").trim()}
function fmt(x){return Number(x||0).toLocaleString("en-IN")}
function logo(t,cls="team-logo"){return `<img class="${cls}" src="${LOGOS[st(t)]||""}" alt="${esc(st(t))}">`}
function navigate(v){view=v;closeMenu();render();scrollTo(0,0)}
function closeMenu(){document.getElementById("drawer").classList.remove("open");document.getElementById("overlay").classList.remove("show")}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
document.getElementById("menuBtn").onclick=()=>{document.getElementById("drawer").classList.add("open");document.getElementById("overlay").classList.add("show")};
document.getElementById("closeMenu").onclick=closeMenu;document.getElementById("overlay").onclick=closeMenu;

function head(title,sub=""){return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub?`<div class="muted">${esc(sub)}</div>`:""}</div></div>`}
function table(h,rows){return `<div class="table-wrap"><table class="table"><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`}
function player(name){currentPlayer=name;view="player";render()}
function playerLink(name){return `<a href="#" onclick="player('${esc(name)}');return false">${esc(name)}</a>`}

async function loadData(){
 const names=["players_format","career_records","ratings","batting_rankings","bowling_rankings","catches","teams","squads","opponent_records","live_matches"];
 for(const n of names){try{DATA[n]=await fetch(`data/${n}.json`).then(r=>r.json())}catch(e){DATA[n]=[]}}
 const local=JSON.parse(localStorage.getItem("nict_uploaded_matches")||"[]");
 DATA.live_matches=local;
 const savedCareer=JSON.parse(localStorage.getItem("nict_career_records")||"null");
 const savedFormats=JSON.parse(localStorage.getItem("nict_players_format")||"null");
 if(savedCareer)DATA.career_records=savedCareer;
 if(savedFormats)DATA.players_format=savedFormats;
 loadSavedPerformance();
 render();
}

function render(){
 if(view==="home")return home(); if(view==="live")return live(); if(view==="matches")return matches();
 if(view==="teams")return teamsPage(); if(view==="players")return playersPage(); if(view==="player")return playerPage();
 if(view==="rankings"||view==="playerRankings")return battingRankings();
 if(view==="batRankings")return battingRankings(); if(view==="bowlRankings")return bowlingRankings(); if(view==="allRoundRankings")return allRoundRankings();
 if(view==="records")return records(); if(view==="careerRecords")return careerRecords(); if(view==="centuryRecords")return leader("hundreds","Most Centuries");
 if(view==="fiftyRecords")return leader("fifty_plus","Most 50+ Scores"); if(view==="sixRecords")return leader("sixes","Most Sixes");
 if(view==="fourRecords")return leader("fours","Most Fours"); if(view==="wicketRecords")return leader("wickets","Most Wickets");
 if(view==="catchRecords")return catchesPage(); if(view==="teamRecords")return teamRecords(); if(view==="headToHead")return headToHead();
 if(view==="stats")return stats(); if(view==="admin")return admin();
}

function home(){
 const m=DATA.live_matches?.[0];
 app.innerHTML=head("NICT Cricket Centre","Live cricket, player career statistics, rankings and tournament records")+
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
 return `<div class="scorehero"><div class="match-banner"><div><div class="meta">${esc(m.format||"Match")} · ${esc(m.match_id||"")}</div><h2>${esc(a)} vs ${esc(b)}</h2><div class="meta">${esc(m.venue||"Noida Intercollege Cricket Ground")}</div></div><div class="team-logos">${logo(a)}${logo(b)}</div></div><div style="margin-top:15px"><button class="btn" onclick="navigate('live')">Open Live Scorecard</button></div></div>`
}
function matches(){
 const rows=(DATA.live_matches||[]).map((m,i)=>`<tr><td>${esc(m.match_id||"MATCH-"+(i+1))}</td><td>${esc(m.format||"")}</td><td><b>${esc(st(m.team_a))}</b> vs <b>${esc(st(m.team_b))}</b></td><td><span class="pill ${m.status==="completed"?"":"live-pill"}">${esc(m.status||"Replay")}</span></td><td><button class="btn" onclick="startLive(${i})">Watch</button></td></tr>`);
 app.innerHTML=head("Matches","Every uploaded match is normalized to short team names")+table(["Match","Format","Teams","Status",""],rows);
}
function startLive(i){localStorage.setItem("nict_active_match",String(i));replayStart=Date.now();localStorage.setItem("nict_replay_start",String(replayStart));replayIndex=0;replayNextAt=Date.now()+(TOSS_BREAK_SECONDS*1000);localStorage.setItem("nict_replay_index","0");localStorage.setItem("nict_replay_next_at",String(replayNextAt));view="live";render()}

function getActiveMatch(){
 const i=Number(localStorage.getItem("nict_active_match")||0);
 return DATA.live_matches?.[i]||DATA.live_matches?.[0];
}

let replayStart=Number(localStorage.getItem("nict_replay_start")||0);
let replayIndex=Number(localStorage.getItem("nict_replay_index")||0);
let replayNextAt=Number(localStorage.getItem("nict_replay_next_at")||0);
function live(){
 const m=getActiveMatch(); if(!m){app.innerHTML=head("Live Scores")+"<div class='card empty'>No match loaded.</div>";return}
 if(!replayStart){replayStart=Date.now();localStorage.setItem("nict_replay_start",String(replayStart));replayIndex=0;replayNextAt=Date.now()+(TOSS_BREAK_SECONDS*1000);localStorage.setItem("nict_replay_index","0");localStorage.setItem("nict_replay_next_at",String(replayNextAt))}
 if(!liveTimer)liveTimer=setInterval(()=>{if(view==="live"){const active=getActiveMatch();if(active)renderLive(active)}},1000);
 renderLive(m);
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
 const toss=copy.toss||{};copy.toss_winner=copy.toss_winner||toss.winner||toss.team||toss.won_by||"";copy.toss_decision=copy.toss_decision||toss.decision||toss.choice||toss.elected_to||"";
 return copy;
}
function tossSummary(m){if(!m.toss_winner)return "Toss result not available";const decision=String(m.toss_decision||"").toLowerCase();return `${st(m.toss_winner)} won the toss and chose to ${decision.includes("bowl")||decision.includes("field")?"bowl":"bat"}`}
function careerFormat(format){return /t20/i.test(String(format||""))?"T20":/odi/i.test(String(format||""))?"ODI":"Test"}
function matchCareerStats(m){
 const bat={}, bowl={}, field={};
 for(const d of m.deliveries||[]){
   const runs=Number(d.runs||0), legal=legalBall(d), innings=Number(d.innings||1), batsman=d.batsman;
   if(batsman){if(!bat[batsman])bat[batsman]={innings:new Set(),runs:0,balls:0,fours:0,sixes:0,dismissals:0};bat[batsman].innings.add(innings);bat[batsman].runs+=runs;if(legal)bat[batsman].balls++;if(runs===4)bat[batsman].fours++;if(runs===6)bat[batsman].sixes++}
   if(d.dismissed_player&&bat[d.dismissed_player])bat[d.dismissed_player].dismissals++;
   if(d.bowler){if(!bowl[d.bowler])bowl[d.bowler]={wickets:0,runs:0,balls:0};bowl[d.bowler].runs+=runs+Number(d.extra_runs||0);if(legal)bowl[d.bowler].balls++;if(d.wicket)bowl[d.bowler].wickets+=Number(d.wicket||0)}
   if(d.fielder&&/catch/i.test(String(d.wicket_type||d.wicket||"")))field[d.fielder]=(field[d.fielder]||0)+1;
 }
 return {bat,bowl,field}
}
function updateCareerFromMatch(m){
 const key=`${m.file_name}:${m.match_id||""}`, done=JSON.parse(localStorage.getItem("nict_completed_matches")||"[]");
 if(done.includes(key))return;
 const format=careerFormat(m.format), stats=matchCareerStats(m), records=DATA.career_records||[], formats=DATA.players_format||[];
 Object.entries(stats.bat).forEach(([name,s])=>{
   const record=records.find(x=>x.name===name), formatRecord=formats.find(x=>x.name===name&&careerFormat(x.format)===format);if(!record||!formatRecord)return;
   const innings=s.innings.size, dismissals=s.dismissals, oldBalls=Number(formatRecord.strike_rate)?Number(formatRecord.runs)/(Number(formatRecord.strike_rate)/100):0;
   record.matches++;record.innings+=innings;record.not_outs+=Math.max(0,innings-dismissals);record.runs+=s.runs;record.career_runs+=s.runs;record[`${format.toLowerCase()}_runs`]=(Number(record[`${format.toLowerCase()}_runs`])||0)+s.runs;record.fours+=s.fours;record.sixes+=s.sixes;record.hundreds+=s.runs>=100?1:0;record.fifties+=s.runs>=50&&s.runs<100?1:0;record.fifty_plus+=s.runs>=50?1:0;record.highest=Math.max(Number(record.highest)||0,s.runs);record.average=Number((record.runs/Math.max(1,record.innings-record.not_outs)).toFixed(2));
   formatRecord.matches++;formatRecord.innings+=innings;formatRecord.not_outs+=Math.max(0,innings-dismissals);formatRecord.runs+=s.runs;formatRecord.fours+=s.fours;formatRecord.sixes+=s.sixes;formatRecord.hundreds+=s.runs>=100?1:0;formatRecord.fifties+=s.runs>=50&&s.runs<100?1:0;formatRecord.fifty_plus+=s.runs>=50?1:0;formatRecord.high_score=s.runs>(parseInt(formatRecord.high_score)||0)?`${s.runs}${dismissals?"":"*"}`:formatRecord.high_score;formatRecord.strike_rate=Number(((formatRecord.runs/(oldBalls+s.balls))*100).toFixed(2));
 });
 Object.entries(stats.bowl).forEach(([name,s])=>{const record=records.find(x=>x.name===name),formatRecord=formats.find(x=>x.name===name&&careerFormat(x.format)===format);if(record)record.wickets+=s.wickets;if(formatRecord)formatRecord.wickets+=s.wickets});
 Object.entries(stats.field).forEach(([name,catches])=>{const record=records.find(x=>x.name===name),formatRecord=formats.find(x=>x.name===name&&careerFormat(x.format)===format);if(record)record.catches+=catches;if(formatRecord)formatRecord.catches+=catches});
 localStorage.setItem("nict_career_records",JSON.stringify(records));localStorage.setItem("nict_players_format",JSON.stringify(formats));done.push(key);localStorage.setItem("nict_completed_matches",JSON.stringify(done));
}
function renderLive(raw){
 const m=normalizedMatch(raw), ds=m.deliveries||[];
<<<<<<< HEAD:NICT-main/app.js
 const replayState=getStrictReplayState(ds,m), shown=ds.slice(0,replayState.idx);
=======
 const elapsed=Math.max(0,(Date.now()-replayStart)/1000);
 const replayState=getReplayState(ds,elapsed,m), shown=ds.slice(0,replayState.idx);
>>>>>>> origin/main:app.js
 const state=calcMatch(shown,m);
 if(m.file_name&&shown.length===ds.length&&ds.length){updateCareerFromMatch(m);}
 const currentInnings=state.innings;
 const last=shown.slice(-6).map(d=>ballChip(d)).join("");
 const seenBatters=new Set();
 const commentary=shown.map(d=>{const newcomers=[d.batsman,d.non_striker].filter(n=>n&&!seenBatters.has(n));newcomers.forEach(n=>seenBatters.add(n));return commentaryHTML(d,newcomers,m.format)});
 const comments=commentary.reverse().join("");
 const a=state.team_a,b=state.team_b;
 const currentBatting=state.team;
 const matchEvent=replayState.event;
 app.innerHTML=head(`${a} vs ${b}`,`${m.format||"Match"} · ${m.match_id||""}`)+
 `<div class="notice"><b>Toss:</b> ${esc(tossSummary(m))}</div><div class="notice ${matchEvent?.type==='draw'?'live-pill':''}">${matchEvent?esc(eventLabel(matchEvent)):`${esc(state.status)}`}</div>`+
 `<div class="scorehero"><div class="scoretop"><div><div class="meta">LIVE · INNINGS ${currentInnings}</div><h2>${esc(currentBatting)}</h2><div class="score">${state.runs}/${state.wickets} <span class="meta">(${state.overs})</span></div><div class="meta">${state.crr} CRR · ${state.status}</div></div><div class="team-logos">${logo(a)}<b>vs</b>${logo(b)}</div></div>
 <div style="margin-top:15px"><b>🏏 ${esc(state.striker?.name||"—")} ${state.striker?state.striker.runs+"* ("+state.striker.balls+")":""}</b> · ${esc(state.nonStriker?.name||"—")} ${state.nonStriker?state.nonStriker.runs+" ("+state.nonStriker.balls+")":""}</div></div>
 <div class="section grid"><div class="card"><h3>Partnership</h3><div class="big">${state.partnership.runs}</div><span class="muted">${state.partnership.balls} balls</span></div><div class="card"><h3>Bowler</h3><div>${esc(state.bowler.name||"—")}</div><span class="muted">${state.bowler.overs} · ${state.bowler.runs}-${state.bowler.wickets}</span></div><div class="card"><h3>Venue</h3><div>${esc(m.venue||"—")}</div></div><div class="card"><h3>Umpires</h3><div>${esc([m.umpire_1,m.umpire_2].filter(Boolean).join(" · ")||"—")}</div></div></div>
 <div class="section"><h2>Last balls</h2><div class="lastballs">${last||"<span class='muted'>Waiting for first delivery...</span>"}</div></div>
 <div class="section"><h2>Playing XI</h2>${playingXI(m,a,b)}</div>
 ${allInningsCards(shown,m)}
 <div class="section"><h2>Commentary</h2>${comments||"<div class='empty'>No commentary yet.</div>"}</div>`;
}
function deliveryIndex(ds,elapsed){
 return Math.min(ds.length,Math.max(0,Math.floor(Number(elapsed||0)/BALL_DELAY_SECONDS)));
}
function strictReplayDurationForBall(ds,i){
 if(i<=0)return BALL_DELAY_SECONDS;
 const prev=ds[i-1];
 const legalBefore=ds.slice(0,i).filter(legalBall).length;
 const newOver=legalBall(prev)&&legalBefore>0&&legalBefore%6===0;
 return BALL_DELAY_SECONDS+(newOver?OVER_BREAK_SECONDS:0);
}
function getStrictReplayState(ds,m){
 const now=Date.now();
 if(!ds.length)return {idx:0,event:null};

 if(!replayNextAt){
   replayIndex=0;
   replayNextAt=now+(m.toss_winner?TOSS_BREAK_SECONDS*1000:BALL_DELAY_SECONDS*1000);
   localStorage.setItem("nict_replay_index","0");
   localStorage.setItem("nict_replay_next_at",String(replayNextAt));
 }

 // Advance AT MOST ONE delivery. No elapsed-time catch-up.
 // This guarantees 1.1 -> 1.2 -> 1.3 ... without jumps.
 if(replayIndex<ds.length&&now>=replayNextAt){
   replayIndex++;
   localStorage.setItem("nict_replay_index",String(replayIndex));

   if(replayIndex<ds.length){
     replayNextAt=now+strictReplayDurationForBall(ds,replayIndex)*1000;
     localStorage.setItem("nict_replay_next_at",String(replayNextAt));
   }else{
     replayNextAt=0;
     localStorage.setItem("nict_replay_next_at","0");
   }
 }

 let event=null;
 if(replayIndex===0){
   event=m.toss_winner
    ?{type:"toss",remaining:Math.max(0,(replayNextAt-now)/1000)}
    :{type:"match_start",remaining:Math.max(0,(replayNextAt-now)/1000)};
 }else if(replayIndex<ds.length){
   const legalBefore=ds.slice(0,replayIndex).filter(legalBall).length;
   if(legalBefore>0&&legalBefore%6===0){
     event={type:"over_break",remaining:Math.max(0,(replayNextAt-now)/1000)};
   }
 }
 return {idx:replayIndex,event};
}
function formatCountdown(seconds){
 const s=Math.max(0,Math.ceil(Number(seconds||0)));
 const m=Math.floor(s/60),r=s%60;
 return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
}
function eventLabel(event){
 if(event.type==="toss")return `Toss result confirmed · First ball in ${formatCountdown(event.remaining)}`;
  if(event.type==="match_start")return `Match starts in ${formatCountdown(event.remaining)}`;
 if(event.type==="innings_break")return `Innings break · Second innings in ${formatCountdown(event.remaining)}`;
 if(event.type==="over_break")return `Over break · Next ball in ${formatCountdown(event.remaining)}`;
 if(event.type==="tea")return `Tea break · Play resumes in ${formatCountdown(event.remaining)}`;
 if(event.type==="drinks")return `Drinks break · Play resumes in ${formatCountdown(event.remaining)}`;
 if(event.type==="rain")return "Rain suspension";
 if(event.type==="draw")return "Match drawn";
 return "Match in progress";
}
function getReplayState(ds,elapsed,m){
  elapsed=Math.max(0,Number(elapsed)||0);
  let time=0;

  // 15-minute toss wait before the first delivery.
  if(m.toss_winner){
    if(elapsed<TOSS_BREAK_SECONDS){
      return {
        idx:0,
        event:{
          type:"toss",
          remaining:TOSS_BREAK_SECONDS-elapsed
        }
      };
    }
    time=TOSS_BREAK_SECONDS;
  }

  let previousInnings=null;
  let legalInCurrentOver=0;

  for(let i=0;i<ds.length;i++){
    const d=ds[i];
    const innings=Number(d.innings||1);

    // 15-minute break between innings.
    if(previousInnings!==null && innings!==previousInnings){
      if(elapsed<time+INNINGS_BREAK_SECONDS){
        return {
          idx:i,
          event:{
            type:"innings_break",
            remaining:time+INNINGS_BREAK_SECONDS-elapsed
          }
        };
      }
      time+=INNINGS_BREAK_SECONDS;
      legalInCurrentOver=0;
    }

    // 2-minute break after every completed over.
    if(i>0 && legalInCurrentOver===0){
      if(elapsed<time+OVER_BREAK_SECONDS){
        return {
          idx:i,
          event:{
            type:"over_break",
            remaining:time+OVER_BREAK_SECONDS-elapsed
          }
        };
      }
      time+=OVER_BREAK_SECONDS;
    }

    // Exactly one delivery every BALL_DELAY_SECONDS.
    if(elapsed<time+BALL_DELAY_SECONDS){
      return {idx:i,event:null};
    }

    time+=BALL_DELAY_SECONDS;

    if(legalBall(d)){
      legalInCurrentOver++;
      if(legalInCurrentOver===6) legalInCurrentOver=0;
    }

    previousInnings=innings;
  }

  return {idx:ds.length,event:null};
}
function legalCountBefore(ds,i){return ds.slice(0,i).filter(legalBall).length}
function legalBall(d){return !["wide","no-ball","noball"].includes(String(d.extra_type||"").toLowerCase())}

function calcMatch(ds,m,forcedInnings=null){
 const inningsNos=[...new Set(ds.map(d=>Number(d.innings||1)))].sort((a,b)=>a-b);
 const inn=forcedInnings|| (inningsNos.length?inningsNos[inningsNos.length-1]:1);
 const current=ds.filter(d=>Number(d.innings||1)===inn);
 const battingTeam=current[0]?.batsman_team||((inn%2===1)?st(m.team_a):st(m.team_b));
 const bowlingTeam=current[0]?.bowling_team||((battingTeam===st(m.team_a))?st(m.team_b):st(m.team_a));

 let runs=0,wickets=0,legal=0,bat={},bowl={};
 let striker="",non="";
 const xi=m.playing_xi?.[battingTeam] || DATA.squads?.[battingTeam]?.filter(x=>x.playing_xi).map(x=>x.name) || [];
 if(xi.length>=2){
   striker=xi[0]; non=xi[1];
   bat[striker]={name:striker,runs:0,balls:0,fours:0,sixes:0,out:false,seen:false};
   bat[non]={name:non,runs:0,balls:0,fours:0,sixes:0,out:false,seen:false};
 }

 for(const d of current){
   const bats=d.batsman||d.striker||striker;
   const ns=d.non_striker||"";

   // Imported feeds are authoritative for the pair at the START of the delivery.
   if(bats)striker=bats;
   if(ns)non=ns;

   if(bats&&!bat[bats])bat[bats]={name:bats,runs:0,balls:0,fours:0,sixes:0,out:false,seen:false};
   if(non&&!bat[non])bat[non]={name:non,runs:0,balls:0,fours:0,sixes:0,out:false,seen:false};
   if(bats)bat[bats].seen=true;
   if(non)bat[non].seen=true;

   const isLegal=legalBall(d);
   const r=Number(d.runs||0), ex=Number(d.extra_runs||0), total=r+ex;
   runs+=total;
   if(Number(d.wicket||0)>0)wickets+=Number(d.wicket||0);

   if(bats){
     bat[bats].runs+=r;
     if(r===4)bat[bats].fours++;
     if(r===6)bat[bats].sixes++;
     if(isLegal)bat[bats].balls++;
   }

   if(d.dismissed_player){
     if(!bat[d.dismissed_player])bat[d.dismissed_player]={name:d.dismissed_player,runs:0,balls:0,fours:0,sixes:0,out:false,seen:true};
     bat[d.dismissed_player].out=true;
   }else if(Number(d.wicket||0)>0 && bats){
     const wt=String(d.wicket_type||d.dismissal_type||"").toLowerCase();
     if(!/run.?out/i.test(wt))bat[bats].out=true;
   }

   const bowler=d.bowler||"";
   if(bowler){
     if(!bowl[bowler])bowl[bowler]={name:bowler,legal:0,runs:0,wickets:0};
     bowl[bowler].runs+=total;
     if(isLegal)bowl[bowler].legal++;
     const wt=String(d.wicket_type||d.dismissal_type||"").toLowerCase();
     if(Number(d.wicket||0)>0&&!/run.?out|retired|obstructing/i.test(wt))bowl[bowler].wickets+=Number(d.wicket||0);
   }

   if(isLegal){
     legal++;
     if(total%2===1)[striker,non]=[non,striker];
     if(legal%6===0)[striker,non]=[non,striker];
   }
 }

 const s=bat[striker]||null,n=bat[non]||null;
 const partnership={runs:(s?.runs||0)+(n?.runs||0),balls:(s?.balls||0)+(n?.balls||0)};
 const last=current[current.length-1];
 const bw=bowl[last?.bowler]||{name:last?.bowler||"",legal:0,runs:0,wickets:0};
 bw.overs=`${Math.floor(bw.legal/6)}.${bw.legal%6}`;
 const complete=legal>=120 || (current.length>0 && Number(current[current.length-1]?.innings_end||0)===1);

 return {
   team_a:st(m.team_a),team_b:st(m.team_b),team:battingTeam,innings:inn,runs,wickets,
   overs:`${Math.floor(legal/6)}.${legal%6}`,
   crr:legal?(runs/(legal/6)).toFixed(2):"0.00",
   striker:s,nonStriker:n,partnership,bowler:bw,status:complete?"Innings complete":"Live",bat,bowl,
   playingXI:xi
 };
}
function ballChip(d){
 const val=d.wicket?"W":(d.extra_type?String(d.extra_type).toUpperCase()+(d.extra_runs?` ${d.extra_runs}`:""):String(d.runs??0));
 let cls=d.wicket?"wicket":Number(d.runs)===6?"six":Number(d.runs)===4?"four":d.extra_type?"extra":"";
 return `<span class="ball ${cls}" title="${esc(d.commentary||"")}">${esc(val)}</span>`;
}
function commentaryHTML(d,newcomers=[],format=""){
 const r=Number(d.runs||0), ex=Number(d.extra_runs||0);
 const headline=d.wicket?"WICKET":r===6?"SIX":r===4?"FOUR":(d.extra_type||"").toUpperCase()||`${r} RUN`;
 const tags=[d.shot?`Shot: ${d.shot}`:"",d.shot_direction?`Direction: ${d.shot_direction}`:"",d.length?`Length: ${d.length}`:"",d.line?`Line: ${d.line}`:""].filter(Boolean);
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
}
   else if(r===6)body=`${d.batsman} gets under it and sends the ball over the boundary for six.`;
   else if(r===4)body=`${d.batsman} finds the gap and the ball races away for four.`;
   else if(ex)body=`${d.batsman} faces a ${String(d.extra_type).toLowerCase()} and ${r?`takes ${r} run${r>1?"s":""}.`:"the extra is added."}`;
   else if(r===0)body=`Good delivery. ${d.batsman} plays it safely into the field.`;
   else body=`${d.batsman} plays the shot and completes ${r} run${r>1?"s":""}.`;
 }
 const career=newcomers.map(name=>{const p=DATA.players_format.find(x=>x.name===name&&careerFormat(x.format)===careerFormat(format));if(!p)return `${name} career record unavailable.`;return `${name} career: ${p.runs} runs, ${p.average} average, ${p.strike_rate} SR, ${p.hundreds} hundreds, ${p.fifty_plus} scores of 50+.`}).join(" ");
 return `<div class="commentary"><div class="commentary-head"><span>${esc(`${d.over}.${d.ball}`)}</span><span class="pill ${d.wicket?"live-pill":""}">${headline}</span><span>${esc(d.batsman||"")}</span></div><div class="commentary-body">${esc(body)}${career?` ${esc(career)}`:""}</div>${tags.length?`<div class="shot-tags">${tags.map(x=>`<span class="tag">${esc(x)}</span>`).join("")}</div>`:""}</div>`;
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
 return Array.from({length:4},(_,index)=>{const innings=index+1, inningsData=ds.filter(d=>Number(d.innings||1)===innings), state=calcMatch(inningsData,m,innings), battingTeam=state.team, bowlingTeam=battingTeam===st(m.team_a)?st(m.team_b):st(m.team_a);return `<div class="section"><h2>Innings ${innings}: ${esc(battingTeam)} batting</h2><div class="muted innings-summary">${inningsData.length?`${state.runs}/${state.wickets} · ${state.overs} overs`:`Not started`}</div><h3>Batting Scorecard</h3>${inningsData.length?battingCard(state,m):`<div class="card empty">No deliveries recorded.</div>`}<h3>Bowling Card: ${esc(bowlingTeam)}</h3>${inningsData.length?bowlingCard(state):`<div class="card empty">No deliveries recorded.</div>`}</div>`}).join("");
}
function playingXI(m,a,b){
 const ix=m.playing_xi||{};
 const squads=DATA.squads||{};
 const roleFor=(team,n)=>m.squad_roles?.[team]?.[n]||squads[team]?.find(x=>x.name===n)?.role||"Player";
 function box(team){
   let names=ix[team]||squads[team]?.filter(x=>x.playing_xi).map(x=>x.name)||[];
   if(!names.length)names=squads[team]?.slice(0,11).map(x=>x.name)||[];
   return `<div class="card"><div class="squad-team">${logo(team,"mini-logo")}<h3>${esc(team)} · Playing XI</h3></div><div class="squad-list">${names.slice(0,11).map(n=>`<div class="player-row"><b>${esc(n)}</b><small>${esc(roleFor(team,n))}</small></div>`).join("")}</div><p class="muted">${Math.max(0,(squads[team]?.length||20)-11)} squad members on bench/standby</p></div>`;
 }
 return `<div class="squads">${box(a)}${box(b)}</div>`;
}

function teamsPage(){const rows=DATA.teams.map(t=>`<tr><td>${logo(t.short_team,"mini-logo")} <b>${esc(t.short_team)}</b></td><td>${t.matches}</td><td>${t.wins}</td><td>${t.losses}</td><td>${t.no_results}</td><td>${t.win_percentage}%</td></tr>`);app.innerHTML=head("Teams","Every team has 20 registered players · 11 playing XI + 9 standby")+table(["Team","Matches","Wins","Losses","NR","Win %"],rows)}
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
function catchesPage(){app.innerHTML=head("Most Catches","Fielding leaderboard");app.innerHTML+=table(["Rank","Player","Team","Catches","Stumpings","Run-outs"],DATA.catches.map(x=>`<tr><td>${x.catch_rank}</td><td>${playerLink(x.player)}</td><td>${x.short_team}</td><td>${x.total_catches}</td><td>${x.total_stumpings}</td><td>${x.total_runouts}</td></tr>`))}
function teamRecords(){app.innerHTML=head("Team Records","Tournament results by team");app.innerHTML+=table(["Team","Matches","Wins","Losses","NR","Win %"],DATA.teams.map(x=>`<tr><td>${x.short_team}</td><td>${x.matches}</td><td>${x.wins}</td><td>${x.losses}</td><td>${x.no_results}</td><td>${x.win_percentage}%</td></tr>`))}
function records(){app.innerHTML=head("Records","Choose an individual or team record category")+`<div class="grid">${[["Career Records","careerRecords"],["Most Centuries","centuryRecords"],["Most 50+ Scores","fiftyRecords"],["Most Sixes","sixRecords"],["Most Fours","fourRecords"],["Most Wickets","wicketRecords"],["Most Catches","catchRecords"],["Team Records","teamRecords"]].map(x=>`<div class="card"><h3>${x[0]}</h3><button class="btn" onclick="navigate('${x[1]}')">Open</button></div>`).join("")}</div>`}
function headToHead(){const ts=Object.keys(DATA.squads||{});app.innerHTML=head("Head to Head","Opponent records from the supplied starting dataset")+`<div class="tabs">${ts.map(t=>`<button onclick="h2h('${t}')">${t}</button>`).join("")}</div><div id="h2h" class="card empty">Select a team.</div>`}
function h2h(t){const rows=DATA.opponent_records.filter(x=>x.short_team===t||x.team===t).slice(0,50);document.getElementById("h2h").innerHTML=rows.length?table(Object.keys(rows[0]).slice(0,9),rows.map(x=>`<tr>${Object.values(x).slice(0,9).map(v=>`<td>${esc(v)}</td>`).join("")}</tr>`)):"No records found."}
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
 try{
   const b=JSON.parse(localStorage.getItem("nict_batting_rankings")||"null");
   const w=JSON.parse(localStorage.getItem("nict_bowling_rankings")||"null");
   const r=JSON.parse(localStorage.getItem("nict_ratings")||"null");
   if(b)DATA.batting_rankings=b;
   if(w)DATA.bowling_rankings=w;
   if(r)DATA.ratings=r;
 }catch(e){}
}
function mergedCareerRecords(){
 const base=(DATA.career_records||[]).map(x=>JSON.parse(JSON.stringify(x)));
 const saved=JSON.parse(localStorage.getItem("nict_career_records")||"null");
 return saved||base;
}

function admin(){
 if(sessionStorage.getItem("nict_admin")==="true")return adminPanel();
 app.innerHTML=`<div class="admin-lock card"><h1>🔒 Admin</h1><p class="muted">Enter the tournament admin password.</p><input id="adminPass" class="input" type="password" placeholder="Password"><button class="btn" onclick="unlock()">Unlock Admin</button><p id="adminMsg" class="muted"></p></div>`;
}
function unlock(){if(document.getElementById("adminPass").value==="12309856"){sessionStorage.setItem("nict_admin","true");adminPanel()}else document.getElementById("adminMsg").textContent="Incorrect password."}
function adminPanel(){
 app.innerHTML=head("Admin","Upload a complete ball-by-ball JSON and start it in the frontend viewer")+
 `<div class="notice">Upload format: JSON with <b>deliveries</b>. Team names are normalized automatically. A filename such as <b>GCET_vs_GLB.json</b> is also understood. Uploaded matches are stored in this browser.</div>
 <div class="section upload-box"><h2>Upload Match JSON</h2><input class="input file" id="jsonFile" type="file" accept=".json,application/json"><button class="btn" onclick="uploadJSON()">Upload Match</button><p id="uploadMsg" class="muted"></p></div>
 <div class="section"><h2>Available Matches</h2><div id="adminMatches"></div></div>
 <div class="section"><button class="btn secondary" onclick="rebuildCareerFromCompletedMatches()">Update Career From Completed Matches</button> <button class="btn secondary" onclick="sessionStorage.removeItem('nict_admin');admin()">Lock Admin</button></div>`;
 renderAdminMatches();
}

function rebuildCareerFromCompletedMatches(){
  const all=DATA.live_matches||[];
  let added=0;
  all.forEach(m=>{ if(applyCompletedMatchToCareer(m)) added++; });
  mergeCareerIntoUI();
  alert(`${added} completed match${added===1?"":"es"} added to career records.`);
  renderAdminMatches();
}

function renderAdminMatches(){
 const box=document.getElementById("adminMatches");if(!box)return;
 const local=JSON.parse(localStorage.getItem("nict_uploaded_matches")||"[]");
 const rows=local.map((m,i)=>`<div class="match-card"><b>${esc(st(m.team_a))} vs ${esc(st(m.team_b))}</b><div class="muted">${esc(m.format||"")} · ${esc(m.match_id||"")}</div><div class="event-controls"><label>Event after <select id="eventBall${i}" class="input">${eventBallOptions(m)}</select></label><button class="btn" onclick="addMatchEvent(${i},'tea')">Tea break</button><button class="btn" onclick="addMatchEvent(${i},'drinks')">Drinks break</button><button class="btn" onclick="addMatchEvent(${i},'rain')">Rain suspension</button><button class="btn" onclick="addMatchEvent(${i},'draw')">Draw</button><button class="btn secondary" onclick="resumeRain(${i})">Resume rain</button></div><div style="margin-top:8px"><button class="btn" onclick="useUploaded(${i})">Use Live</button> <button class="btn danger" onclick="deleteUploaded(${i})">Delete</button></div></div>`).join("");
 box.innerHTML=rows||`<div class="empty">No browser-uploaded matches yet.</div>`;
}
function eventBallOptions(m){const count=(m.deliveries||[]).length;return Array.from({length:count+1},(_,i)=>`<option value="${i}">${i===0?"Before first ball":`After ball ${i}`}</option>`).join("")}
function saveUploadedMatches(local){localStorage.setItem("nict_uploaded_matches",JSON.stringify(local));DATA.live_matches=local}
function addMatchEvent(index,type){const local=JSON.parse(localStorage.getItem("nict_uploaded_matches")||"[]"),match=local[index];if(!match)return;match.events=match.events||[];const afterBall=Number(document.getElementById(`eventBall${index}`).value);match.events=match.events.filter(e=>!(Number(e.afterBall)===afterBall&&e.type===type));match.events.push({type,afterBall,resumed:false});saveUploadedMatches(local);renderAdminMatches()}
function resumeRain(index){const local=JSON.parse(localStorage.getItem("nict_uploaded_matches")||"[]"),match=local[index];if(!match)return;(match.events||[]).filter(e=>e.type==="rain").forEach(e=>e.resumed=true);saveUploadedMatches(local);renderAdminMatches()}
function parseFilename(name){
 const clean=name.replace(/\.[^.]+$/,"");
 const m=clean.match(/(.+?)_vs_(.+)$/i);
 return m?{a:st(m[1]),b:st(m[2])}:null;
}
async function uploadJSON(){
 const f=document.getElementById("jsonFile").files[0],msg=document.getElementById("uploadMsg");if(!f){msg.textContent="Choose a JSON file.";return}
 try{
   const d=JSON.parse(await f.text());const fn=parseFilename(f.name);
   if(!Array.isArray(d.deliveries))throw new Error("JSON must contain a deliveries array.");
   if(fn){d.team_a=fn.a;d.team_b=fn.b}
   d.team_a=st(d.team_a||"");d.team_b=st(d.team_b||"");
   if(!d.team_a||!d.team_b)throw new Error("Team names missing. Use team_a/team_b or filename TEAM1_vs_TEAM2.json.");
   d.file_name=f.name;d.match_id=d.match_id||f.name.replace(/\.json$/i,"");d.status="live";
   d.deliveries=d.deliveries.map(x=>({...x,batsman_team:x.batsman_team||((Number(x.innings||1)%2===1)?d.team_a:d.team_b),bowling_team:x.bowling_team||((Number(x.innings||1)%2===1)?d.team_b:d.team_a)}));
  const local=JSON.parse(localStorage.getItem("nict_uploaded_matches")||"[]");local.unshift(d);localStorage.setItem("nict_uploaded_matches",JSON.stringify(local));
  DATA.live_matches=local;localStorage.setItem("nict_active_match","0");localStorage.setItem("nict_uploaded_mode","true");replayStart=Date.now();localStorage.setItem("nict_replay_start",String(replayStart));msg.textContent=`Uploaded: ${d.team_a} vs ${d.team_b}`;navigate("live");
 }catch(e){msg.textContent="Upload failed: "+e.message}
}
function useUploaded(i){localStorage.setItem("nict_active_match",String(i));localStorage.setItem("nict_uploaded_mode","true");replayStart=Date.now();localStorage.setItem("nict_replay_start",String(replayStart));navigate("live")}
function deleteUploaded(i){const local=JSON.parse(localStorage.getItem("nict_uploaded_matches")||"[]");local.splice(i,1);localStorage.setItem("nict_uploaded_matches",JSON.stringify(local));DATA.live_matches=[...local,...(DATA.live_matches||[]).filter(x=>!x.file_name)];renderAdminMatches()}

loadData();
