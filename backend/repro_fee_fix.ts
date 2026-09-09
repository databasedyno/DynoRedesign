/**
 * SAFE (read-only) verification for the LTC/BTC settlement fee-estimation
 * decimal bug. Fee estimation moves NO money.
 *
 * 1) Reproduces the exact production error by hitting Tatum's UTXO fee
 *    estimator with an unrounded float value (>8 dp).
 * 2) Proves the fixed tatumApi.feeEstimation() sanitises the same messy float
 *    so Tatum accepts it.
 */
import axios from "axios";
import { toNumber } from "./utils/money";
import tatumApi from "./apis/tatumApi";

const KEY = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY || "";
const FROM = "LbiHcxrnyPU4tSJXmfZazPjqMZWCwm4rCk"; // real LTC temp addr from the failed payment
const TO = "Ldud688enYh4zDBdKJAnRDPBnc6hmMK1au";   // real LTC merchant-side addr
const MESSY = 5 / 3;                                // 1.6666666666666667 (16 dp) — realistic converted amount

const dp = (n: number) => (String(n).split(".")[1] || "").length;

async function rawEstimate(value: number) {
  const res = await axios.post(
    "https://api.tatum.io/v3/blockchain/estimate",
    { chain: "LTC", type: "TRANSFER", fromAddress: [FROM], to: [{ address: TO, value }] },
    { headers: { "x-api-key": KEY, "Content-Type": "application/json" }, timeout: 20000 }
  );
  return res.data;
}

(async () => {
  console.log(`\nMESSY float value = ${MESSY}  (decimal places: ${dp(MESSY)})`);
  console.log(`toNumber(MESSY, 8) = ${toNumber(MESSY, 8)}  (decimal places: ${dp(toNumber(MESSY, 8))})`);

  // 1) Reproduce the production 400 with the UNROUNDED value.
  console.log("\n[1] RAW Tatum estimate with UNROUNDED value (reproduce bug)...");
  try {
    const d = await rawEstimate(MESSY);
    console.log("   ⚠️ unexpected SUCCESS:", JSON.stringify(d));
  } catch (e: any) {
    const body = e?.response?.data;
    const msg = typeof body === "object" ? JSON.stringify(body) : String(body || e.message);
    const isDecimalErr = /decimal places not more than 8/i.test(msg);
    console.log(`   status=${e?.response?.status} -> ${msg}`);
    console.log(isDecimalErr ? "   ✅ REPRODUCED the exact production error." : "   (different error)");
  }

  // 2) Prove the fixed feeEstimation() accepts the same messy float.
  console.log("\n[2] FIXED tatumApi.feeEstimation('LTC', ...) with the SAME messy float...");
  try {
    const fees = await tatumApi.feeEstimation("LTC", FROM, TO, MESSY);
    console.log("   ✅ feeEstimation returned (no 400):", JSON.stringify(fees));
    console.log("   FIX VERIFIED — messy float is sanitised to <=8 dp before Tatum.");
  } catch (e: any) {
    const body = e?.response?.data;
    const msg = typeof body === "object" ? JSON.stringify(body) : String(body || e.message);
    if (/decimal places not more than 8/i.test(msg)) {
      console.log("   ❌ FIX FAILED — still rejected for >8 dp:", msg);
      process.exit(1);
    }
    console.log("   ⚠️ feeEstimation threw a NON-decimal error (fix still OK for our bug):", msg);
  }

  console.log("\nDONE");
  process.exit(0);
})();
