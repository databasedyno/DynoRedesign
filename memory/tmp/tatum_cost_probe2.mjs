import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("/app/backend/.env","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,"")];}));
const H = { "x-api-key": env.TATUM_KEY };
const pool = JSON.parse(fs.readFileSync("/app/memory/tmp/pool_addresses.json","utf8"));
const ltc = pool.find(a=>a.wallet_type==="LTC")?.wallet_address, doge = pool.find(a=>a.wallet_type==="DOGE")?.wallet_address;
const usage = async (chain) => { const d = await (await fetch("https://api.tatum.io/v4/tatum/usage", { headers: H })).json(); const p = d.sort((a,b)=>a.timestamp-b.timestamp).at(-1); const u = p.usage.find(x=>x.type==="api_call"&&x.chain===chain); return { count: u.count, units: u.units }; };
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const probe = async (label, chain, url, n) => {
  const before = await usage(chain);
  let statuses = {};
  for (let i=0;i<n;i++){ const r = await fetch(url, { headers: H }); await r.text(); statuses[r.status]=(statuses[r.status]||0)+1; }
  await sleep(45000);
  const after = await usage(chain);
  console.log(new Date().toISOString(), label, "n",n, "statuses", JSON.stringify(statuses), "Δcalls", after.count-before.count, "Δunits", after.units-before.units);
};
await probe("LTC balance ", "litecoin-mainnet", `https://api.tatum.io/v3/litecoin/address/balance/${ltc}`, 20);
await probe("LTC txByAddr", "litecoin-mainnet", `https://api.tatum.io/v3/litecoin/transaction/address/${ltc}?pageSize=10&offset=0`, 20);
await probe("DOGE balance", "dogecoin-mainnet", `https://api.tatum.io/v3/dogecoin/address/balance/${doge}`, 20);
await probe("DOGE txByAddr", "dogecoin-mainnet", `https://api.tatum.io/v3/dogecoin/transaction/address/${doge}?pageSize=10&offset=0`, 20);
