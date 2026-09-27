/**
 * E2E proof for the on-chain webhook gate (chainTxVerifier) against LIVE chain data.
 *
 *   cd backend && npx ts-node -T scripts/chain_verify_e2e.ts
 *
 * Read-only towards the database (SELECTs only). Writes ONLY scratch keys to Redis
 * (crypto-<fake e2e address>, processed-tx-<…>) and deletes them at the end.
 *
 * Part A — verifier vs real historic deposits (Tatum lookups):
 *   genuine tx → verified; gate → rejected as REPLAY (already credited);
 *   random txId → not_found; genuine tx to another address → mismatch; inflated amount → mismatch.
 * Part B — full processWebhookJob with forged payloads against a synthetic pending session:
 *   replayed real hash to attacker address → dropped + processed-tx=onchain_rejected, session untouched;
 *   random txId → ChainVerifyRetry (BullMQ retry path), session untouched, no dedup key.
 */
import "dotenv/config";
import { connectRedis, getRedisItem, setRedisItem, deleteRedisItem } from "../utils/redisInstance";
import { verifyIncomingTxOnChain, gateIncomingTx, ChainVerifyRetry, verifyMode } from "../services/chainTxVerifier";
import { processWebhookJob } from "../services/webhookProcessor";

const REAL: Array<{ currency: string; amount: number; address: string; txId: string; paymentId: string | null; notCredited?: boolean }> = [
  { currency: "BTC", amount: 0.0003532, address: "bc1q09qhm733hfwyk0rddc7ydt4lnh248yflz6mk0a", txId: "b47fbb731da2d84c0faf562cfafdc1651a0577104b507a207d6d66fcefd5118b", paymentId: "a282c9e6-a97f-4e63-989b-c0b321c09eae" },
  { currency: "ETH", amount: 0.00793, address: "0xe6caffe43d49ebdc9fc59bc2ed3572f6974cf455", txId: "0xaa756fafde6dd2497f28b1f74287e82ab518b61e503d00bccf8353364a7de33c", paymentId: "98f5dd51-e69d-4a24-a2c7-b86c980bb841" },
  { currency: "LTC", amount: 1.23098087, address: "LYXbYBpryGSim73rWuLjXspEDeydxUxAoP", txId: "f13a853db572c3f4de7620f243359a0f20ab737184ae7b6c180015c03ab1e9a8", paymentId: "251481dd-cd1c-4732-9870-de0564fb54f3" },
  { currency: "TRX", amount: 76.673, address: "TK7g7RCeNJrQLBcbh6aZiaeo7ySN8EUqQV", txId: "255f55041b5c973530a358982817f18c393a9ea92d80d9da6bb20bc1fe14fb09", paymentId: "dd68a54c-a64e-4dd9-b7ac-6683a882ce03" },
  { currency: "USDT-TRC20", amount: 110, address: "TEC76iWACFa5vwrTyDfTLfvigACAfkuHuY", txId: "e3d13a5517d769be76e21b5dd6d640baae16269f181036b597f9ad0710121eff", paymentId: "22b6e147-cca9-4596-b0d3-5e1f7bfbaf1d" },
  { currency: "USDT-ERC20", amount: 26, address: "0x0f748eba5636c3d29688e799ca38d97c060190be", txId: "0x3e41dea88d24a8ba6c62749ba5f54fe9b5463db2c6bc92a92b76c98427b24043", paymentId: "db038dd9-3d82-4609-914e-20a2b5b628ff" },
  { currency: "DOGE", amount: 204.48723099, address: "DR9EPUKkW5Mj4EpBp8ao7sjzZgpXDh18Ud", txId: "1e49b1eff191debe33f114e8b6147e69439e55fbade15f240631913be1198dc0", paymentId: null },
  // Not a Dynopay deposit (public BCH tx) — proves the BCH parser/units; skip the replay check.
  { currency: "BCH", amount: 0.01730915, address: "bitcoincash:qp22jez9rusqthcu63ch8dkyav7wmznccymt0sufrl", txId: "5356e660d2e87c501cbfcd87af706694b3cd68d1f855a51857525352f57329f0", paymentId: null, notCredited: true },
];
const FAKE_TX: Record<string, string> = {
  BTC: "1111111111111111111111111111111111111111111111111111111111111111",
  ETH: "0x1111111111111111111111111111111111111111111111111111111111111111",
  LTC: "2222222222222222222222222222222222222222222222222222222222222222",
  TRX: "3333333333333333333333333333333333333333333333333333333333333333",
  "USDT-TRC20": "4444444444444444444444444444444444444444444444444444444444444444",
  "USDT-ERC20": "0x2222222222222222222222222222222222222222222222222222222222222222",
  DOGE: "5555555555555555555555555555555555555555555555555555555555555555",
  BCH: "6666666666666666666666666666666666666666666666666666666666666666",
};
const OTHER_ADDR: Record<string, string> = {
  BTC: "bc1qe2e0000000000000000000000000000000000",
  ETH: "0x000000000000000000000000000000000000e2e1",
  LTC: "LE2eAttacker000000000000000000000",
  TRX: "TE2eAttacker0000000000000000000000",
  "USDT-TRC20": "TE2eAttacker0000000000000000000000",
  "USDT-ERC20": "0x000000000000000000000000000000000000e2e1",
  DOGE: "DE2eAttacker000000000000000000000",
  BCH: "bitcoincash:qqe2eattacker00000000000000000000000000000",
};

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} ${name} — ${detail}`);
};

async function partA() {
  console.log(`\n═══ PART A — verifier vs live chain (mode=${verifyMode()}) ═══`);
  for (const c of REAL) {
    const v = await verifyIncomingTxOnChain(c);
    check(`[${c.currency}] genuine deposit verifies (on-chain amount == claimed, coin units)`, v.status === "verified" && Math.abs((v as any).onChainAmount - c.amount) < 1e-8, JSON.stringify(v));
    if (c.notCredited) {
      const g = await gateIncomingTx({ ...c });
      check(`[${c.currency}] gate lets a genuine, never-credited tx through`, g.decision === "ok", g.note);
    } else {
      const g = await gateIncomingTx({ ...c });
      check(`[${c.currency}] gate rejects REPLAY of an already-credited tx`, g.decision === "rejected" && /replay/i.test(g.note), g.note);
    }
    const nf = await verifyIncomingTxOnChain({ ...c, txId: FAKE_TX[c.currency] });
    check(`[${c.currency}] random txId → not_found/error (never verified)`, nf.status === "not_found" || nf.status === "error", JSON.stringify(nf));
    const wrong = await verifyIncomingTxOnChain({ ...c, address: OTHER_ADDR[c.currency] });
    check(`[${c.currency}] genuine tx claimed for ANOTHER address → mismatch`, wrong.status === "mismatch", JSON.stringify(wrong));
    const inflated = await verifyIncomingTxOnChain({ ...c, amount: c.amount * 10 });
    check(`[${c.currency}] genuine tx with INFLATED amount → mismatch`, inflated.status === "mismatch", JSON.stringify(inflated));
  }
}

const session = (currency: string, amount: number) => ({
  amount: String(amount), currency, payment_id: "e2e-forged-payment", company_id: 1, user_id: 1, ref: "e2e-ref", status: "pending",
  unique_tx_id: "e2e-forged-payment", link_id: "e2e-link",
});

async function partB() {
  console.log("\n═══ PART B — full webhook processor with forged payloads ═══");
  const eth = REAL.find((r) => r.currency === "ETH")!;
  const attacker = OTHER_ADDR.ETH;
  const sessionKey = `crypto-${attacker}`;
  const scratch = [sessionKey, `processed-tx-${eth.txId}`, `processed-tx-${FAKE_TX.ETH}`];
  try {
    await setRedisItem(sessionKey, session("ETH", eth.amount));

    // B1: attacker replays a REAL hash (someone else's deposit) against their own pending checkout.
    await processWebhookJob({
      payload: { address: attacker, counterAddress: "0x000000000000000000000000000000000000dead", amount: String(eth.amount), txId: eth.txId, asset: "ETH" },
      queryParams: { company_id: 1, user_id: 1 }, receivedAt: new Date().toISOString(), source: "webhook",
    } as any);
    const dedup = await getRedisItem(`processed-tx-${eth.txId}`);
    const after = await getRedisItem(sessionKey);
    check("B1 forged replay → dropped with processed-tx type=onchain_rejected", dedup?.type === "onchain_rejected", JSON.stringify(dedup));
    check("B1 session untouched (still pending, no txId, no status change)", after?.status === "pending" && !after?.txId, JSON.stringify(after));

    // B2: attacker invents a txId → chain has nothing → retry path (never credited).
    let thrown: any = null;
    try {
      await processWebhookJob({
        payload: { address: attacker, counterAddress: "0x000000000000000000000000000000000000dead", amount: String(eth.amount), txId: FAKE_TX.ETH, asset: "ETH" },
        queryParams: { company_id: 1, user_id: 1 }, receivedAt: new Date().toISOString(), source: "webhook",
      } as any);
    } catch (e) { thrown = e; }
    const dedup2 = await getRedisItem(`processed-tx-${FAKE_TX.ETH}`);
    const after2 = await getRedisItem(sessionKey);
    check("B2 invented txId → ChainVerifyRetry thrown (BullMQ retry → DLQ, never credited)", thrown instanceof ChainVerifyRetry, String(thrown?.message || thrown));
    const empty = (o: any) => !o || Object.keys(o).length === 0; // getRedisItem returns {} for a missing key
    check("B2 no dedup key written, session still pending", empty(dedup2) && after2?.status === "pending" && !after2?.txId, JSON.stringify({ dedup2, after2 }));
  } finally {
    for (const k of scratch) await deleteRedisItem(k).catch(() => {});
    console.log(`(scratch keys removed: ${scratch.join(", ")})`);
  }
}

(async () => {
  await connectRedis();
  await partA();
  await partB();
  console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
