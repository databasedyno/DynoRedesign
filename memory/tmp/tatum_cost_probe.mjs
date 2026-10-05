import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("/app/backend/.env","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,"")];}));
const H = { "x-api-key": env.TATUM_KEY };
const addr = JSON.parse(fs.readFileSync("/app/memory/tmp/pool_addresses.json","utf8")).find(a=>a.wallet_type==="LTC")?.wallet_address;
const usage = async () => { const d = await (await fetch("https://api.tatum.io/v4/tatum/usage", { headers: H })).json(); const p = d.sort((a,b)=>a.timestamp-b.timestamp).at(-1); const u = p.usage.find(x=>x.type==="api_call"&&x.chain==="litecoin-mainnet"); return { count: u.count, units: u.units }; };
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const probe = async (label, url) => {
  const before = await usage();
  for (let i=0;i<3;i++){ const r = await fetch(url, { headers: H }); await r.text(); }
  await sleep(8000);
  const after = await usage();
  console.log(label, "Δcalls", after.count-before.count, "Δunits", after.units-before.units);
};
console.log("addr found:", !!addr);
await probe("balance   ", `https://api.tatum.io/v3/litecoin/address/balance/${addr}`);
await probe("txByAddr  ", `https://api.tatum.io/v3/litecoin/transaction/address/${addr}?pageSize=10&offset=0`);
