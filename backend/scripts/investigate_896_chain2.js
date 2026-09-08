/* READ-ONLY on-chain check via public RPC: current USDT+ETH balance, nonce, and
 * historical USDT Transfer logs (in/out) for each ERC20 deposit address. No writes. */
const https = require("https");
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://eth.llamarpc.com", "https://1rpc.io/eth"];

const ADDRS = [
  ["922", "0x28c9996a1d5e86e8c425c738527de7023b20d3a0"],
  ["923", "0xabe4d61644e337f5c0d7a00be9a821574aaa3e7c"],
  ["924", "0xff1908dca4320b77ae3245f3b874bf7128ca2297"],
  ["925", "0x8906bde0efaaebc80ed857a81d384eb7dd7448af"],
  ["928", "0x094daaf56ccb149d9d79427c297be2def781a3ea"],
  ["929", "0x716d7c7b86e63bdef67e549356222f2642b071f0"],
  ["932", "0x40177200da0aa6547f3f5f8970193e2df3da9ac7"], // <-- txn 896
  ["933", "0x38a6c892c428efaa2d3acffba116ce63e2590b59"],
  ["938", "0xc90a8f8b49ef693f2e1af632d0afb3402db405a1"],
  ["939", "0x1fdba0acf70eed9a6d349a6b863fede06daf813f"],
];

function rpc(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const tryOne = (url) => new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname || "/", method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
      (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => {
        try { const j = JSON.parse(d); if (j.error) return reject(new Error(j.error.message)); resolve(j.result); }
        catch (e) { reject(new Error("bad json from " + u.hostname)); } }); });
    req.on("error", reject); req.setTimeout(15000, () => req.destroy(new Error("timeout"))); req.write(body); req.end();
  });
  return (async () => { let last; for (const u of RPCS) { try { return await tryOne(u); } catch (e) { last = e; } } throw last; })();
}
const topicAddr = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

(async () => {
  const latest = Number(BigInt(await rpc("eth_blockNumber", [])));
  console.log("latest block", latest, "\n");
  for (const [id, a] of ADDRS) {
    let usdt, eth, nonce, logsIn = [], logsOut = [];
    try { usdt = Number(BigInt(await rpc("eth_call", [{ to: USDT, data: "0x70a08231" + pad(a) }, "latest"]))) / 1e6; } catch (e) { usdt = "ERR:" + e.message; }
    try { eth = Number(BigInt(await rpc("eth_getBalance", [a, "latest"]))) / 1e18; } catch (e) { eth = "?"; }
    try { nonce = Number(BigInt(await rpc("eth_getTransactionCount", [a, "latest"]))); } catch (e) { nonce = "?"; }
    // Transfer logs where this address is the recipient (topic2) and sender (topic1)
    try { logsIn = await rpc("eth_getLogs", [{ fromBlock: "0x0", toBlock: "latest", address: USDT, topics: [TRANSFER, null, topicAddr(a)] }]); } catch (e) { logsIn = "ERR:" + e.message; }
    try { logsOut = await rpc("eth_getLogs", [{ fromBlock: "0x0", toBlock: "latest", address: USDT, topics: [TRANSFER, topicAddr(a)] }]); } catch (e) { logsOut = "ERR:" + e.message; }
    const fmtLogs = (L) => Array.isArray(L)
      ? L.map(x => ({ amt: Number(BigInt(x.data)) / 1e6, block: Number(BigInt(x.blockNumber)), tx: x.transactionHash }))
      : L;
    console.log(`#${id} ${a}`);
    console.log(`   USDT_balance=${usdt}  ETH=${eth}  nonce=${nonce}`);
    console.log(`   USDT IN  :`, JSON.stringify(fmtLogs(logsIn)));
    console.log(`   USDT OUT :`, JSON.stringify(fmtLogs(logsOut)), "\n");
  }
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
