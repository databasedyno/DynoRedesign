const {createClient}=require("redis");
const url=require("dotenv").config({path:"/app/backend/.env"}).parsed.REDIS_PUBLIC_URL;
(async()=>{
 for (const db of [0,1]) {
  const c=createClient({url:url.replace(/\/\d+$/,"")+"/"+db, socket:{connectTimeout:8000}});
  await c.connect();
  const size=await c.dbSize();
  const info=await c.info("memory");
  const used=info.match(/used_memory_human:(\S+)/)[1];
  let cursor=0, noTtl=0, total=0, prefixes={};
  do { const r=await c.scan(cursor,{COUNT:1000}); cursor=r.cursor;
    const ttls = await Promise.all(r.keys.map(k=>c.ttl(k)));
    r.keys.forEach((k,i)=>{ total++; if(ttls[i]===-1){noTtl++; const p=k.replace(/[0-9a-f]{8,}.*$/,"").split(/[-:]/)[0].slice(0,25); prefixes[p]=(prefixes[p]||0)+1;} });
  } while(cursor!==0 && total<30000);
  console.log(`DB${db}: dbsize=${size} mem=${used} scanned=${total} noTTL=${noTtl}`);
  console.log(" noTTL prefixes:", JSON.stringify(Object.entries(prefixes).sort((a,b)=>b[1]-a[1]).slice(0,20)));
  await c.quit();
 }
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
