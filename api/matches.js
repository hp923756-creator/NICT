
const SB_URL=process.env.SUPABASE_URL;
const SB_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD;
async function sb(path,options={}){
  const r=await fetch(`${SB_URL}/rest/v1/${path}`,{
    ...options,
    headers:{
      apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,
      "Content-Type":"application/json",
      ...(options.headers||{})
    }
  });
  const txt=await r.text(); let data; try{data=JSON.parse(txt)}catch{data=txt}
  if(!r.ok)throw new Error(typeof data==="string"?data:JSON.stringify(data));
  return data;
}
function okAdmin(req){return req.headers["x-admin-password"]===ADMIN_PASSWORD}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  try{
    if(req.method==="GET"){
      return res.status(200).json(await sb("matches?select=*&order=created_at.desc"));
    }
    if(!okAdmin(req))return res.status(401).json({error:"Admin authentication required"});
    const id=String(req.query.id||"");
    if(req.method==="POST"){
      const m=req.body||{};
      if(!m.match_id)return res.status(400).json({error:"match_id required"});
      const rows=await sb("matches",{
        method:"POST",
        headers:{"Prefer":"resolution=merge-duplicates,return=representation"},
        body:JSON.stringify({id:String(m.match_id),match_json:m,status:m.status||"upcoming",started_at:m.started_at||null})
      });
      return res.status(200).json(rows[0]||rows);
    }
    if(req.method==="DELETE"){
      if(!id)return res.status(400).json({error:"id required"});
      await sb(`matches?id=eq.${encodeURIComponent(id)}`,{method:"DELETE"});
      return res.status(200).json({ok:true});
    }
    return res.status(405).json({error:"Method not allowed"});
  }catch(e){return res.status(500).json({error:e.message})}
}
