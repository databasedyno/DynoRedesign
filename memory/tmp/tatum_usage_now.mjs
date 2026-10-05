import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("/app/backend/.env","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,"")];}));
const H = { "x-api-key": env.TATUM_KEY };
const r = await fetch("https://api.tatum.io/v3/tatum/usage", { headers: H });
const d = await r.json();
fs.writeFileSync("/app/memory/tmp/tatum_usage_raw_2.json", JSON.stringify(d));
const rows = (Array.isArray(d)?d:[]).sort((a,b)=>a.timestamp-b.timestamp).slice(-3);
for (const p of rows) {
  const day = new Date(p.timestamp).toISOString().slice(0,10);
  const g=(t,c)=>p.usage.filter(u=>u.type===t&&u.chain===c).reduce((a,u)=>a+Number(u.count||0),0);
  const tot=p.usage.reduce((a,u)=>a+Number(u.units||0),0);
  console.log(day,"units",tot,"LTC",g("api_call","litecoin-mainnet"),"DOGE",g("api_call","dogecoin-mainnet"),"BTC",g("api_call","bitcoin-mainnet"),"ETH",g("api_call","ethereum-mainnet"),"TRON",g("api_call","tron-mainnet"),"none",g("api_call",null),"subs",p.usage.filter(u=>u.type==="daily_charge").reduce((a,u)=>a+Number(u.count||0),0));
}
console.log("now", new Date().toISOString());
