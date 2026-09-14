/**
 * Pure-logic unit tests for the Crypto Refund Flow.
 * DB-free / network-free — run with:
 *   node_modules/.bin/ts-node --transpile-only tests/test_refund_logic.ts
 */
import {
  round8,
  normalizeChain,
  getChainMeta,
  validateRefundAmount,
  validateChainAddress,
  explorerTxUrl,
  computeDepositPlan,
  canTransition,
  isRefundableOrderStatus,
  STATIC_GAS_BUFFER_NATIVE,
} from "../services/refund/refundChains";
import { buildRefundEmail, buildMerchantRefundEmail } from "../services/refund/refundEmailTemplates";

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}`);
  }
}
function eq(name: string, a: unknown, b: unknown) {
  assert(`${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, a === b);
}

console.log("\n== normalizeChain / getChainMeta ==");
eq("BTC direct", normalizeChain("BTC"), "BTC");
eq("lowercase usdt-trc20", normalizeChain("usdt-trc20"), "USDT-TRC20");
eq("underscore usdt_trc20", normalizeChain("USDT_TRC20"), "USDT-TRC20");
eq("collapsed usdttrc20", normalizeChain("usdttrc20"), "USDT-TRC20");
eq("unknown -> null", normalizeChain("DOGECOINX"), null);
eq("empty -> null", normalizeChain(""), null);
eq("USDT-TRC20 is token", getChainMeta("USDT-TRC20")?.kind, "token");
eq("BTC is native", getChainMeta("BTC")?.kind, "native");
eq("USDT-TRC20 gas symbol TRX", getChainMeta("USDT-TRC20")?.gasSymbol, "TRX");
eq("USDC-ERC20 gas symbol ETH", getChainMeta("USDC-ERC20")?.gasSymbol, "ETH");

console.log("\n== validateRefundAmount (single, capped) ==");
assert("full refund ok", validateRefundAmount(100, 100).ok === true);
assert("partial refund ok", validateRefundAmount(40, 100).ok === true);
assert("over cap rejected", validateRefundAmount(100.00000001, 100).ok === false);
assert("zero rejected", validateRefundAmount(0, 100).ok === false);
assert("negative rejected", validateRefundAmount(-5, 100).ok === false);
assert("NaN rejected", validateRefundAmount("abc", 100).ok === false);
assert("zero original rejected", validateRefundAmount(10, 0).ok === false);
eq("rounds to 8dp", validateRefundAmount(0.123456789, 1).amount, 0.12345679);

console.log("\n== computeDepositPlan (gas coverage) ==");
const native = getChainMeta("BTC")!;
const nativePlan = computeDepositPlan(native, 0.01, 0.00005);
eq("native deposit = refund + gas", nativePlan.depositAmount, round8(0.01 + 0.00005));
eq("native gas in-asset", nativePlan.gasCoverage, "in_asset");
const token = getChainMeta("USDT-TRC20")!;
const tokenPlan = computeDepositPlan(token, 100, 30);
eq("token deposit = refund only", tokenPlan.depositAmount, 100);
eq("token gas via fee wallet", tokenPlan.gasCoverage, "fee_wallet");
eq("token deposit asset USDT", tokenPlan.depositAsset, "USDT");

console.log("\n== state machine ==");
assert("created->awaiting_deposit", canTransition("created", "awaiting_deposit"));
assert("awaiting->deposit_detected", canTransition("awaiting_deposit", "deposit_detected"));
assert("deposit_detected->forwarding", canTransition("deposit_detected", "forwarding"));
assert("forwarding->completed", canTransition("forwarding", "completed"));
assert("completed is terminal", !canTransition("completed", "forwarding"));
assert("cannot skip to completed", !canTransition("awaiting_deposit", "completed"));
assert("awaiting->cancelled ok", canTransition("awaiting_deposit", "cancelled"));

console.log("\n== refundable status ==");
assert("paid refundable", isRefundableOrderStatus("paid"));
assert("refund_requested refundable", isRefundableOrderStatus("refund_requested"));
assert("pending not refundable", !isRefundableOrderStatus("pending"));
assert("refunded not refundable", !isRefundableOrderStatus("refunded"));

console.log("\n== static gas buffers present for all gas symbols ==");
["BTC", "LTC", "DOGE", "BCH", "ETH", "POL", "TRX", "SOL", "XRP"].forEach((g) =>
  assert(`buffer for ${g}`, typeof STATIC_GAS_BUFFER_NATIVE[g] === "number")
);

console.log("\n== validateChainAddress (per-chain, locked to original chain) ==");
const btcMeta = getChainMeta("BTC")!;
const ethMeta = getChainMeta("ETH")!;
const trc20Meta = getChainMeta("USDT-TRC20")!;
const polTokenMeta = getChainMeta("USDT-POLYGON")!;
const solMeta = getChainMeta("SOL")!;
const xrpMeta = getChainMeta("XRP")!;
assert("valid BTC legacy", validateChainAddress(btcMeta, "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7").ok);
assert("valid BTC bech32", validateChainAddress(btcMeta, "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq").ok);
assert("ETH addr REJECTED for BTC refund", !validateChainAddress(btcMeta, "0x9a7221b5e32d5f99e8da95585835442e29afb38f").ok);
assert("valid ETH", validateChainAddress(ethMeta, "0x9a7221b5e32d5f99e8da95585835442e29afb38f").ok);
assert("BTC addr REJECTED for ETH refund", !validateChainAddress(ethMeta, "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7").ok);
assert("TRC20 token uses Tron format", validateChainAddress(trc20Meta, "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR").ok);
assert("ETH addr REJECTED for TRC20 refund", !validateChainAddress(trc20Meta, "0x9a7221b5e32d5f99e8da95585835442e29afb38f").ok);
assert("USDT-POLYGON token uses EVM 0x format", validateChainAddress(polTokenMeta, "0x9a7221b5e32d5f99e8da95585835442e29afb38f").ok);
assert("valid SOL", validateChainAddress(solMeta, "Gjjphdxe26tayH3PBQcqXYt3R2gt7phEdCAFfxZB63U8").ok);
assert("valid XRP", validateChainAddress(xrpMeta, "rNxp4h8apvRis6mJf9Sh8C6iRxfrDWN7AV").ok);
assert("empty REJECTED", !validateChainAddress(btcMeta, "").ok);
assert("garbage REJECTED", !validateChainAddress(ethMeta, "not-an-address").ok);

console.log("\n== explorerTxUrl + refund receipt emails ==");
assert("ETH explorer url", explorerTxUrl(ethMeta, "0xabc123") === "https://etherscan.io/tx/0xabc123");
assert("empty txid -> null", explorerTxUrl(ethMeta, "") === null);
assert("TRC20 token uses Tron explorer", (explorerTxUrl(trc20Meta, "Txyz") || "").startsWith("https://tronscan.org"));
assert("BTC explorer url", (explorerTxUrl(btcMeta, "deadbeef") || "") === "https://mempool.space/tx/deadbeef");
const emFwd = buildRefundEmail({ refund_amount: 0.5, asset: "BTC", chain: "BTC" }, "forwarding");
assert("forwarding subject mentions amount + on its way", /on its way/i.test(emFwd.subject) && emFwd.subject.includes("0.5 BTC"));
const emDone = buildRefundEmail({ refund_amount: 10, asset: "USDT", chain: "USDT-ERC20", forward_txid: "0xfeedface" }, "completed");
assert("completed subject", /complete/i.test(emDone.subject) && emDone.subject.includes("10 USDT"));
assert("completed body embeds explorer link", emDone.html.includes("https://etherscan.io/tx/0xfeedface"));
const emDoneNoTx = buildRefundEmail({ refund_amount: 1, asset: "BTC", chain: "BTC" }, "completed");
assert("completed w/o txid still builds", /complete/i.test(emDoneNoTx.subject) && emDoneNoTx.html.length > 100);

console.log("\n== merchant record-copy email (buildMerchantRefundEmail) ==");
const emMerchant = buildMerchantRefundEmail({
  refund_amount: 10,
  asset: "USDT",
  chain: "USDT-ERC20",
  forward_txid: "0xfeedface",
  refund_id: "rf_test123",
  customer_email: "buyer@example.com",
});
assert("merchant subject mentions amount + customer", emMerchant.subject.includes("10 USDT") && emMerchant.subject.includes("buyer@example.com"));
assert("merchant body embeds explorer link", emMerchant.html.includes("https://etherscan.io/tx/0xfeedface"));
assert("merchant body includes refund id + customer", emMerchant.html.includes("rf_test123") && emMerchant.html.includes("buyer@example.com"));
assert("merchant footer says record copy (not customer footer)", /record copy/i.test(emMerchant.html));
const emMerchantBare = buildMerchantRefundEmail({ refund_amount: 0.5, asset: "BTC", chain: "BTC" });
assert("merchant email w/o txid/customer still builds", /complete/i.test(emMerchantBare.subject) && emMerchantBare.html.length > 100);

console.log(`\n===== Refund logic tests: ${passed} passed, ${failed} failed =====\n`);
process.exit(failed === 0 ? 0 : 1);
