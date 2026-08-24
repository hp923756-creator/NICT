
import fs from "fs";
import path from "path";
const SB_URL=process.env.SUPABASE_URL;
const SB_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const BALL=20,OVER=60,INNINGS=900,TOSS=900;
function readJSON(name){
  const p=path.join(process.cwd(),"data",name+".json");
  return JSON.parse(fs.readFileSync(p,"utf8"));
}
async function matches(){
  const r=await fetch(`${SB_URL}/rest/v1/matches?select=match_json,status,started_at`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`}});
  if(!r.ok)throw new Error(await r.text());
  return await r.json();
}
function legal(d){return !["wide","no-ball","noball"].includes(String(d.extra_type||"").toLowerCase())}
function fmt(f){return /t20/i.test(f)?"T20":/odi/i.test(f)?"ODI":"Test"}
function completed(m){
  if(m.status==="completed")return true;
  if(!m.started_at)return false;
  const ds=m.match_json?.deliveries||[];
  if(!ds.length)return false;
  let sec=TOSS;
  let prevIn=null,legalInOver=0;
  for(let i=0;i<ds.length;i++){
    const inn=Number(ds[i].innings||1);
    if(prevIn!==null&&inn!==prevIn){sec+=INNINGS;legalInOver=0}
    if(i>0&&legalInOver===0)sec+=OVER;
    sec+=BALL;
    if(legal(ds[i])){legalInOver++;if(legalInOver===6)legalInOver=0}
    prevIn=inn;
  }
  return (Date.now()-new Date(m.started_at).getTime())/1000>=sec;
}
function calc(m){
  const bat={},bowl={},field={};
  for(const d of m.deliveries||[]){
    const n=d.batsman||d.striker,r=+d.runs||0;
    if(n){bat[n]??={runs:0,balls:0,fours:0,sixes:0,innings:new Set(),out:0};bat[n].runs+=r;if(legal(d))bat[n].balls++;if(r===4)bat[n].fours++;if(r===6)bat[n].sixes++;bat[n].innings.add(+d.innings||1)}
    if(d.dismissed_player){bat[d.dismissed_player]??={runs:0,balls:0,fours:0,sixes:0,innings:new Set(),out:0};bat[d.dismissed_player].out++}
    if(d.bowler){bowl[d.bowler]??={wickets:0};if(+d.wicket&& !/run.?out|retired|obstructing/i.test(String(d.wicket_type||"")))bowl[d.bowler].wickets+=+d.wicket}
    if(d.fielder){const t=String(d.wicket_type||"").toLowerCase();field[d.fielder]??={catches:0,stumpings:0,runouts:0};if(/catch/.test(t))field[d.fielder].catches++;if(/stump/.test(t))field[d.fielder].stumpings++;if(/run.?out/.test(t))field[d.fielder].runouts++}
  }
  return {bat,bowl,field}
}
export default async function handler(req,res){
  try{
    const career=readJSON("career_records"), formats=readJSON("players_format");
    const bs=readJSON("batting_rankings"), ws=readJSON("bowling_rankings"), rs=readJSON("ratings");
    const rows=await matches();
    const done=rows.filter(x=>completed(x.match_json||{}));
    for(const row of done){
      const m=row.match_json||{}, f=fmt(m.format), s=calc(m);
      for(const [name,x] of Object.entries(s.bat)){
        const p=career.find(a=>a.name===name), q=formats.find(a=>a.name===name&&fmt(a.format)===f);
        if(!p||!q)continue;
        const inn=x.innings.size, outs=x.out;
        p.matches=+p.matches||0;p.innings=+p.innings||0;p.not_outs=+p.not_outs||0;p.runs=+p.runs||0;p.fours=+p.fours||0;p.sixes=+p.sixes||0;p.hundreds=+p.hundreds||0;p.fifties=+p.fifties||0;p.fifty_plus=+p.fifty_plus||0;
        p.matches++;p.innings+=inn;p.not_outs+=Math.max(0,inn-outs);p.runs+=x.runs;p.fours+=x.fours;p.sixes+=x.sixes;p.hundreds+=x.runs>=100?1:0;p.fifties+=x.runs>=50&&x.runs<100?1:0;p.fifty_plus+=x.runs>=50?1:0;p.highest=Math.max(+p.highest||0,x.runs);p.average=+(p.runs/Math.max(1,p.innings-p.not_outs)).toFixed(2);
        q.matches=+q.matches||0;q.innings=+q.innings||0;q.not_outs=+q.not_outs||0;q.runs=+q.runs||0;q.balls=+q.balls||0;q.fours=+q.fours||0;q.sixes=+q.sixes||0;q.hundreds=+q.hundreds||0;q.fifties=+q.fifties||0;q.fifty_plus=+q.fifty_plus||0;
        q.matches++;q.innings+=inn;q.not_outs+=Math.max(0,inn-outs);q.runs+=x.runs;q.balls+=x.balls;q.fours+=x.fours;q.sixes+=x.sixes;q.hundreds+=x.runs>=100?1:0;q.fifties+=x.runs>=50&&x.runs<100?1:0;q.fifty_plus+=x.runs>=50?1:0;q.high_score=Math.max(+q.high_score||0,x.runs);q.average=+(q.runs/Math.max(1,q.innings-q.not_outs)).toFixed(2);q.strike_rate=+(q.runs/Math.max(1,q.balls)*100).toFixed(2);
      }
      for(const [name,x] of Object.entries(s.bowl)){const p=career.find(a=>a.name===name),q=formats.find(a=>a.name===name&&fmt(a.format)===f);if(p)p.wickets=(+p.wickets||0)+x.wickets;if(q)q.wickets=(+q.wickets||0)+x.wickets}
    }
    for(const q of formats){
      const key=`${q.name}|${fmt(q.format)}`,br=bs.find(x=>`${x.player}|${fmt(x.format)}`===key),wr=ws.find(x=>`${x.player}|${fmt(x.format)}`===key),rr=rs.find(x=>`${x.player}|${fmt(x.format)}`===key);
      const avg=+q.average||0,sr=+q.strike_rate||0,runs=+q.runs||0,w=+q.wickets||0;
      const bat=+(Math.min(99.9,Math.max(1,avg*.75+sr*.1+Math.log10(runs+10)*7))).toFixed(1);
      const bowl=+(Math.min(99.9,Math.max(1,w*2.5))).toFixed(1);
      if(br)br.rating=bat;if(wr)wr.rating=bowl;if(rr){rr.batting_rating=bat;rr.bowling_rating=bowl;rr.rating=+((bat+bowl)/2).toFixed(1)}
    }
    return res.status(200).json({career_records:career,players_format:formats,batting_rankings:bs,bowling_rankings:ws,ratings:rs});
  }catch(e){return res.status(500).json({error:e.message})}
}
