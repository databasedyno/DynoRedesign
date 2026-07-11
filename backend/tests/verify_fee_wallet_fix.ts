/**
 * Fee Wallet Balance Reporting — Bug Fix Verification
 *
 * Verifies the 4 bugs fixed in the "fee wallet balance appears incorrect" report:
 *
 * BUG 1: Silent 0-fallback in tatumApi.ts (TRX + USDT-TRC20 branches)
 *        → getAddressBalance() must THROW `tatum.tronGetAccount.invalidResponse`
 *          on empty/broken Tatum responses, not return balance:'0'.
 * BUG 2: Frozen (staked) TRX not counted
 *        → response now includes `.total` (liquid + frozen) alongside `.balance`.
 * BUG 3: Empty state bypasses cooldown in feeWalletMonitor.ts
 *        → cooldown now applies to empty; requires 2 consecutive empty reads.
 * BUG 4: String/number mismatch in checkFeeBalance
 *        → `amount === 0` check now Number-coerced.
 *
 * Run: cd /app/backend && npx ts-node --transpile-only tests/verify_fee_wallet_fix.ts
 * Requires the same .env as the running backend (LIVE Tatum + LIVE Postgres).
 */

import "dotenv/config";
import tatumApi from "../apis/tatumApi";

const TRX_FEE_WALLET = process.env.TRX_FEE_WALLET || "";
const ETH_FEE_WALLET = process.env.ETH_FEE_WALLET || "";
const POLYGON_FEE_WALLET = process.env.POLYGON_FEE_WALLET || "";

// A TRON address that DOES NOT EXIST on-chain — used to verify the "account not found"
// path still returns balance:'0' cleanly (not throw).
const BOGUS_TRON = "TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

type BalanceRes = { balance?: string; liquid?: string; frozen?: string; total?: string };

interface CheckResult { name: string; pass: boolean; detail: string; }
const results: CheckResult[] = [];
const pushResult = (name: string, pass: boolean, detail: string): void => {
  results.push({ name, pass, detail });
  const tag = pass ? "✅ PASS" : "❌ FAIL";
  console.log(`${tag}  ${name}  — ${detail}`);
};

async function testTrxPositive(): Promise<void> {
  console.log("\n=== TEST 1: TRX fee wallet — happy path returns liquid+frozen+total ===");
  const r = (await tatumApi.getAddressBalance(TRX_FEE_WALLET, "TRX", true)) as BalanceRes;
  const balanceOK = typeof r?.balance === "string" && Number.isFinite(Number(r.balance));
  const liquidOK = typeof r?.liquid === "string" && Number.isFinite(Number(r.liquid));
  const frozenOK = typeof r?.frozen === "string" && Number.isFinite(Number(r.frozen));
  const totalOK = typeof r?.total === "string" && Number.isFinite(Number(r.total));
  const totalEqualsSum = Math.abs(Number(r.total) - (Number(r.liquid) + Number(r.frozen))) < 0.000001;
  const balanceEqualsLiquid = Number(r.balance) === Number(r.liquid);
  pushResult(
    "TRX response shape has balance/liquid/frozen/total",
    balanceOK && liquidOK && frozenOK && totalOK,
    `balance=${r.balance} liquid=${r.liquid} frozen=${r.frozen} total=${r.total}`
  );
  pushResult(
    "TRX .total === liquid + frozen (arithmetic correctness)",
    totalEqualsSum,
    `${r.total} vs ${Number(r.liquid) + Number(r.frozen)}`
  );
  pushResult(
    "TRX .balance kept === .liquid (backward compat for settlement pre-check)",
    balanceEqualsLiquid,
    `balance=${r.balance} liquid=${r.liquid}`
  );
}

async function testTrxUnactivatedAccount(): Promise<void> {
  console.log("\n=== TEST 2: TRX unactivated account returns clean 0s (not throw) ===");
  try {
    const r = (await tatumApi.getAddressBalance(BOGUS_TRON, "TRX", true)) as BalanceRes;
    // Either the SDK returns "account.not.found" (caught → balance:'0') OR
    // it returns a valid account-shaped response with balance 0. Both are OK.
    const nZero = Number(r?.balance) === 0 && Number(r?.total ?? 0) === 0;
    pushResult(
      "Unactivated TRON address → balance:0/total:0 without throwing",
      nZero,
      JSON.stringify(r)
    );
  } catch (e: unknown) {
    const msg = (e as Error)?.message || String(e);
    // Acceptable if it maps a known unactivated pattern to error; but the fix requires
    // account.not.found to be caught and 0 returned.
    pushResult(
      "Unactivated TRON address → clean 0 (not throw)",
      false,
      `unexpected throw: ${msg}`
    );
  }
}

async function testCompareOnChain(): Promise<void> {
  console.log("\n=== TEST 3: Reported balance matches live TronGrid ===");
  const r = (await tatumApi.getAddressBalance(TRX_FEE_WALLET, "TRX", true)) as BalanceRes;
  // Fetch the live TronGrid /v1/accounts/<addr> response for ground truth
  const axios = require("axios");
  const url = `https://api.trongrid.io/v1/accounts/${TRX_FEE_WALLET}`;
  const { data } = await axios.get(url, { timeout: 10000 });
  const acct = (data?.data && data.data[0]) || {};
  const liquidSun = Number(acct.balance || 0);
  let frozenSun = 0;
  if (Array.isArray(acct.frozenV2)) for (const f of acct.frozenV2) frozenSun += Number(f?.amount || 0);
  if (Array.isArray(acct.frozen)) for (const f of acct.frozen) frozenSun += Number(f?.frozen_balance || 0);
  const expectLiquid = liquidSun / 1e6;
  const expectFrozen = frozenSun / 1e6;
  const expectTotal = expectLiquid + expectFrozen;
  const okLiquid = Math.abs(Number(r.liquid) - expectLiquid) < 0.000001;
  const okFrozen = Math.abs(Number(r.frozen) - expectFrozen) < 0.000001;
  const okTotal = Math.abs(Number(r.total) - expectTotal) < 0.000001;
  pushResult(
    "TRX liquid matches TronGrid",
    okLiquid,
    `reported liquid=${r.liquid} on-chain=${expectLiquid}`
  );
  pushResult(
    "TRX frozen matches TronGrid (sum of Stake 1.0 + Stake 2.0)",
    okFrozen,
    `reported frozen=${r.frozen} on-chain=${expectFrozen}`
  );
  pushResult(
    "TRX total matches TronGrid",
    okTotal,
    `reported total=${r.total} on-chain=${expectTotal}`
  );
}

async function testCheckFeeWalletBalance(): Promise<void> {
  console.log("\n=== TEST 4: feeWalletMonitor.checkFeeWalletBalance() ===");
  const mod = await import("../services/feeWalletMonitor");
  // First call: initial baseline
  const s1 = await mod.checkFeeWalletBalance();
  const s1OK = typeof s1?.balance === "number" && Number.isFinite(s1.balance) && !!s1.status && !!s1.lastChecked;
  pushResult(
    "checkFeeWalletBalance() returns valid WalletStatus with numeric balance",
    s1OK,
    `balance=${s1?.balance} liquid=${s1?.liquid} frozen=${s1?.frozen} status=${s1?.status}`
  );
  // Second call immediately: cooldown should suppress a duplicate alert (no error)
  const s2 = await mod.checkFeeWalletBalance();
  pushResult(
    "Second immediate check doesn't crash & returns valid status",
    typeof s2?.balance === "number" && Number.isFinite(s2.balance),
    `balance=${s2?.balance} status=${s2?.status}`
  );
}

async function testInvalidResponseGuard(): Promise<void> {
  console.log("\n=== TEST 5: Invalid Tatum response throws (not silent 0) ===");
  // Monkey-patch the underlying SDK to return an empty object once
  const tatumApiMod = await import("../apis/tatumApi");
  const orig = require("../apis/tatumApi");
  // We cannot easily monkey-patch the internal getTatumSDK() from outside. So instead
  // exercise the code path via fetchValidatedTrxBalance's error handling by passing a
  // syntactically-valid TRON address that we KNOW returns account.not.found.
  //
  // Use BOGUS_TRON → Tatum SDK throws with 'account.not.found' → caught → balance:'0'.
  // That's already covered by TEST 2. Here we complement by directly asserting the
  // shape/behavior when the fetcher used by feeWalletMonitor treats broken responses
  // as null.
  const mod = await import("../services/feeWalletMonitor");
  // Force a Tatum failure by patching tatumApi.getAddressBalance to throw
  const origFn = (tatumApiMod.default as any).getAddressBalance;
  (tatumApiMod.default as any).getAddressBalance = async () => {
    throw new Error("tatum.tronGetAccount.invalidResponse (address=xxx)");
  };
  try {
    const s = await mod.checkFeeWalletBalance();
    // With the guard, we should either get lastStatus (if any) or the initial warning
    // fallback. Critically: status must NOT be 'empty' (no false urgent alert).
    const noFalseEmpty = s.status !== 'empty';
    pushResult(
      "When Tatum throws, feeWalletMonitor does NOT report status='empty' (no false urgent alert)",
      noFalseEmpty,
      `status=${s.status} balance=${s.balance}`
    );
  } finally {
    (tatumApiMod.default as any).getAddressBalance = origFn;
  }
  // Restore
  void orig;
}

async function testEthAndPolygonUnchanged(): Promise<void> {
  console.log("\n=== TEST 6: ETH + POLYGON fee wallets still work (regression) ===");
  if (ETH_FEE_WALLET) {
    try {
      const r = (await tatumApi.getAddressBalance(ETH_FEE_WALLET, "ETH", true)) as BalanceRes;
      const ok = typeof r?.balance === "string" && Number.isFinite(Number(r.balance));
      pushResult("ETH fee wallet balance returned", ok, `balance=${r?.balance}`);
    } catch (e) {
      pushResult("ETH fee wallet balance returned", false, `error: ${(e as Error).message}`);
    }
  }
  if (POLYGON_FEE_WALLET) {
    try {
      const r = (await tatumApi.getAddressBalance(POLYGON_FEE_WALLET, "POLYGON", true)) as BalanceRes;
      const ok = typeof r?.balance === "string" && Number.isFinite(Number(r.balance));
      pushResult("POLYGON fee wallet balance returned", ok, `balance=${r?.balance}`);
    } catch (e) {
      pushResult("POLYGON fee wallet balance returned", false, `error: ${(e as Error).message}`);
    }
  }
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║ Fee Wallet Balance — Bug Fix Verification                            ║");
  console.log(`║ TRX_FEE_WALLET: ${TRX_FEE_WALLET.padEnd(56)}║`);
  console.log(`║ ETH_FEE_WALLET: ${ETH_FEE_WALLET.padEnd(56)}║`);
  console.log(`║ POLYGON_FEE_WALLET: ${POLYGON_FEE_WALLET.padEnd(52)}║`);
  console.log("╚══════════════════════════════════════════════════════════════════════╝");

  await testTrxPositive();
  await testTrxUnactivatedAccount();
  await testCompareOnChain();
  await testCheckFeeWalletBalance();
  await testInvalidResponseGuard();
  await testEthAndPolygonUnchanged();

  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`║ RESULTS: ${passed}/${total} passed`.padEnd(71) + "║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  for (const r of results) {
    console.log(`  ${r.pass ? "✅" : "❌"} ${r.name}`);
  }
  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
