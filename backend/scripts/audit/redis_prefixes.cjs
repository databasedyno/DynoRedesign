const {createClient}=require("redis");
const url=require("dotenv").config({path:"/app/backend/.env"}).parsed.REDIS_PUBLIC_URL;
(async()=>{
  const c=createClient({url:url.replace(/\/\d+$/,"")+"/0", socket:{connectTimeout:8000}});
  await c.connect();
  let cursor=0, groups={}, total=0;
  do { const r=await c.scan(cursor,{COUNT:1000}); cursor=r.cursor;
    const ttls=await Promise.all(r.keys.map(k=>c.ttl(k)));
    r.keys.forEach((k,i)=>{ total++; if(ttls[i]===-1){ const p=k.replace(/[0-9a-fA-F]{6,}.*$/,"").replace(/\d+.*$/,"").replace(/[^A-Za-z:_-]+$/,""); groups[p]=(groups[p]||0)+1; } });
  } while(cursor!==0);
  console.log("total",total); console.log(Object.entries(groups).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${v}\t${k}`).join("\n"));
  await c.quit();
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
