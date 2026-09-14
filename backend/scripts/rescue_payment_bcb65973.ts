/**
 * One-shot rescue script for payment bcb65973-e357-4f5a-b12d-f70c1be011b7
 *
 *   49.99 USDT-ERC20 stuck at 0x5a3fd72435ebdab0d938c8abee61d39412b6bb15
 *   Merchant wallet (destination): 0x9a7221b5e32d5f99e8da95585835442e29afb38f
 *   Fee wallet (gas payer):        0x2b29aa060c6c15c50c02999ba7d7d090105e1a6b
 *
 * What this does:
 *   1. KMS-decrypts fee wallet privateKey + temp address privateKey
 *   2. Replaces the ghost gas-funding TX at nonce=0 on the fee wallet with
 *      a proper EIP-1559 TX (maxFeePerGas well above base fee, priority 1.5 Gwei)
 *   3. Waits for 1 block confirmation — real hash, not signed-only
 *   4. Broadcasts USDT transfer from temp address → merchant wallet, also EIP-1559
 *   5. Updates tbl_payment_journal (settlement_completed) and
 *      tbl_merchant_temp_address (status=AVAILABLE, received_amount, last_swept_at)
 *   6. Deletes stale Redis keys for this payment
 *
 * Usage:
 *   cd /app/backend
 *   npx ts-node --transpile-only scripts/rescue_payment_bcb65973.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.resolve(__dirname, ".env.prod-recovery"),
  override: true,
});

import { ethers } from "ethers";
import { Sequelize, QueryTypes } from "sequelize";
import { createClient } from "redis";
import tatumApi from "../apis/tatumApi";

// ---------- constants ----------
const PAYMENT_ID = "bcb65973-e357-4f5a-b12d-f70c1be011b7";
const TEMP_ADDR = "0x5a3fd72435ebdab0d938c8abee61d39412b6bb15";
const FEE_WALLET = "0x2b29aa060c6c15c50c02999ba7d7d090105e1a6b";
const MERCHANT_WALLET = "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const USDT_CONTRACT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const USDT_AMOUNT_UNITS = 49_990_000n; // 49.99 * 1e6 (USDT has 6 decimals)
const USDT_AMOUNT_HUMAN = 49.99;

// RPC — Tatum web3 gateway with our API key (known-good from earlier checks)
const RPC_URL = "https://api.tatum.io/v3/ethereum/web3/node/";

// ERC20 transfer(address,uint256)
const ERC20_IFACE = new ethers.Interface([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

// ---------- helpers ----------
function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
}

async function getProvider(): Promise<ethers.JsonRpcProvider> {
  const req = new ethers.FetchRequest(RPC_URL);
  req.setHeader("x-api-key", process.env.TATUM_KEY!);
  const provider = new ethers.JsonRpcProvider(req, 1, {
    staticNetwork: ethers.Network.from(1),
    batchMaxCount: 1, // Tatum proxy may not handle batched JSON-RPC — safer to disable
  });
  return provider;
}

async function buildEip1559Fees(provider: ethers.JsonRpcProvider) {
  // Get current block's baseFeePerGas
  const latest = await provider.getBlock("latest");
  const baseFee = latest?.baseFeePerGas ?? ethers.parseUnits("2", "gwei");
  // Priority fee: 1.5 Gwei — enough for inclusion within a block or two
  const priorityFee = ethers.parseUnits("1.5", "gwei");
  // Max fee = baseFee * 2 + priorityFee (generous headroom for base fluctuations)
  // Also enforce an absolute minimum of 3 Gwei so we don't get stuck again
  const computedMax = baseFee * 2n + priorityFee;
  const minMax = ethers.parseUnits("3", "gwei");
  const maxFeePerGas = computedMax > minMax ? computedMax : minMax;
  log(
    `   baseFee=${ethers.formatUnits(baseFee, "gwei")}Gwei, priority=${ethers.formatUnits(
      priorityFee,
      "gwei"
    )}Gwei, maxFee=${ethers.formatUnits(maxFeePerGas, "gwei")}Gwei`
  );
  return { maxFeePerGas, maxPriorityFeePerGas: priorityFee };
}

// ---------- main ----------
async function main() {
  log("🚑 Starting rescue for payment " + PAYMENT_ID);

  // ---------- 1. Connect to prod Postgres + Redis ----------
  const sequelize = new Sequelize(
    process.env.DB_NAME!,
    process.env.USER_NAME!,
    process.env.PASSWORD!,
    {
      host: process.env.HOST!,
      port: Number(process.env.DB_PORT!),
      dialect: "postgres",
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
        },
      },
      logging: false,
    }
  );
  await sequelize.authenticate();
  log("✅ Prod DB connected");

  const redis = createClient({ url: process.env.REDIS_PUBLIC_URL! });
  await redis.connect();
  log("✅ Prod Redis connected");

  // ---------- 2. Load encrypted private keys from DB ----------
  const tempRows = (await sequelize.query(
    `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address=:addr`,
    { replacements: { addr: TEMP_ADDR }, type: QueryTypes.SELECT }
  )) as Array<{ private_key: string }>;
  if (!tempRows.length) throw new Error("Temp address row not found");
  const encryptedTempPk = tempRows[0].private_key;

  const feeRows = (await sequelize.query(
    `SELECT "privateKey" FROM tbl_admin_fee_wallet WHERE wallet_type='ETH' AND wallet_address=:addr`,
    { replacements: { addr: FEE_WALLET }, type: QueryTypes.SELECT }
  )) as Array<{ privateKey: string }>;
  if (!feeRows.length) throw new Error("Fee wallet row not found");
  const encryptedFeePk = feeRows[0].privateKey;

  log("✅ Ciphertexts loaded from DB");

  // ---------- 3. KMS-decrypt both ----------
  const tempPk = await tatumApi.decryptSymmetric(
    encryptedTempPk,
    process.env.TEMP_KEY_ID!
  );
  const feePk = await tatumApi.decryptSymmetric(
    encryptedFeePk,
    process.env.TEMP_KEY_ID!
  );
  if (!tempPk || !feePk) throw new Error("KMS decrypt returned empty");
  log("✅ KMS-decrypted both private keys");

  // ---------- 4. Verify addresses match ----------
  const derivedTemp = new ethers.Wallet(tempPk).address.toLowerCase();
  const derivedFee = new ethers.Wallet(feePk).address.toLowerCase();
  if (derivedTemp !== TEMP_ADDR.toLowerCase())
    throw new Error(
      `Temp pk mismatch: derived ${derivedTemp} vs expected ${TEMP_ADDR}`
    );
  if (derivedFee !== FEE_WALLET.toLowerCase())
    throw new Error(
      `Fee pk mismatch: derived ${derivedFee} vs expected ${FEE_WALLET}`
    );
  log("✅ Derived addresses match DB values");

  // ---------- 5. Provider + wallets ----------
  const provider = await getProvider();
  const feeWallet = new ethers.Wallet(feePk, provider);
  const tempWallet = new ethers.Wallet(tempPk, provider);

  // Snapshot on-chain state
  const feeBalWei = await provider.getBalance(FEE_WALLET);
  const tempEthWei = await provider.getBalance(TEMP_ADDR);
  const usdtContract = new ethers.Contract(
    USDT_CONTRACT,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  const usdtBal = await usdtContract.balanceOf(TEMP_ADDR);
  log(
    `   fee wallet: ${ethers.formatEther(feeBalWei)} ETH`
  );
  log(
    `   temp addr:  ${ethers.formatEther(tempEthWei)} ETH, ${
      Number(usdtBal) / 1e6
    } USDT`
  );

  if (usdtBal < USDT_AMOUNT_UNITS) {
    throw new Error(
      `USDT balance too low on temp addr: ${Number(usdtBal) / 1e6} < ${USDT_AMOUNT_HUMAN}`
    );
  }

  // ---------- 6. Gas funding TX (0.0006 ETH to cover USDT transfer + slack) ----------
  log("");
  log("━━━ Step A: gas funding (fee wallet → temp addr) ━━━");
  const feeNonce = await provider.getTransactionCount(FEE_WALLET, "pending");
  log(`   nonce=${feeNonce}`);
  const fees1 = await buildEip1559Fees(provider);
  const gasAmountWei = ethers.parseEther("0.0006"); // plenty for a single USDT transfer

  const fundTx = await feeWallet.sendTransaction({
    to: TEMP_ADDR,
    value: gasAmountWei,
    nonce: feeNonce,
    gasLimit: 21000n,
    maxFeePerGas: fees1.maxFeePerGas,
    maxPriorityFeePerGas: fees1.maxPriorityFeePerGas,
    type: 2,
  });
  log(`   ✅ broadcast: ${fundTx.hash}`);
  log(`   ⏳ waiting for 1 confirmation...`);
  const fundReceipt = await fundTx.wait(1, 180_000);
  if (!fundReceipt || fundReceipt.status !== 1) {
    throw new Error("Gas funding TX failed on chain");
  }
  log(
    `   ✅ confirmed in block ${fundReceipt.blockNumber}, gasUsed=${fundReceipt.gasUsed.toString()}`
  );

  // ---------- 7. USDT transfer TX ----------
  log("");
  log("━━━ Step B: USDT transfer (temp addr → merchant) ━━━");
  const tempNonce = await provider.getTransactionCount(TEMP_ADDR, "pending");
  log(`   nonce=${tempNonce}`);
  const fees2 = await buildEip1559Fees(provider);
  const data = ERC20_IFACE.encodeFunctionData("transfer", [
    MERCHANT_WALLET,
    USDT_AMOUNT_UNITS,
  ]);

  // Estimate gas for this specific call
  let gasLimit: bigint;
  try {
    const est = await provider.estimateGas({
      from: TEMP_ADDR,
      to: USDT_CONTRACT,
      data,
    });
    gasLimit = (est * 120n) / 100n; // 20% buffer
  } catch {
    gasLimit = 100_000n; // USDT transfer typical
  }
  log(`   gasLimit=${gasLimit.toString()}`);

  const usdtTx = await tempWallet.sendTransaction({
    to: USDT_CONTRACT,
    data,
    nonce: tempNonce,
    gasLimit,
    maxFeePerGas: fees2.maxFeePerGas,
    maxPriorityFeePerGas: fees2.maxPriorityFeePerGas,
    type: 2,
  });
  log(`   ✅ broadcast: ${usdtTx.hash}`);
  log(`   ⏳ waiting for 1 confirmation...`);
  const usdtReceipt = await usdtTx.wait(1, 180_000);
  if (!usdtReceipt || usdtReceipt.status !== 1) {
    throw new Error("USDT transfer failed on chain");
  }
  log(
    `   ✅ confirmed in block ${usdtReceipt.blockNumber}, gasUsed=${usdtReceipt.gasUsed.toString()}`
  );

  // ---------- 8. Post-check on-chain ----------
  const usdtAfter = await usdtContract.balanceOf(TEMP_ADDR);
  const merchantAfter = await usdtContract.balanceOf(MERCHANT_WALLET);
  log(
    `   temp USDT now: ${Number(usdtAfter) / 1e6} (was ${
      Number(usdtBal) / 1e6
    })`
  );
  log(`   merchant USDT now: ${Number(merchantAfter) / 1e6}`);

  // ---------- 9. DB reconciliation ----------
  log("");
  log("━━━ Step C: DB reconciliation ━━━");
  await sequelize.query(
    `UPDATE tbl_merchant_temp_address
       SET status='AVAILABLE',
           current_payment_id=NULL,
           current_company_id=NULL,
           received_amount=:amt,
           reserved_until=NULL,
           locked_at=NULL,
           last_swept_at=NOW(),
           last_merchant_payout=NOW(),
           last_payment_context=:ctx,
           updated_at=NOW()
     WHERE wallet_address=:addr`,
    {
      replacements: {
        amt: USDT_AMOUNT_HUMAN,
        addr: TEMP_ADDR,
        ctx: JSON.stringify({
          payment_id: PAYMENT_ID,
          rescue: true,
          gas_tx: fundTx.hash,
          settle_tx: usdtTx.hash,
          rescued_at: new Date().toISOString(),
          note: "Manual operator rescue — directEvmSweep gas underpricing bug workaround",
        }),
      },
    }
  );
  log("   ✅ tbl_merchant_temp_address → AVAILABLE");

  await sequelize.query(
    `INSERT INTO tbl_payment_journal (payment_id, event, from_state, to_state, settlement_tx_id, metadata, created_at)
     VALUES (:pid, 'settlement_completed', 'failed', 'settled', :tx, :meta::jsonb, NOW())`,
    {
      replacements: {
        pid: PAYMENT_ID,
        tx: usdtTx.hash,
        meta: JSON.stringify({
          source: "manual-operator-rescue",
          gas_funding_tx: fundTx.hash,
          merchant_tx: usdtTx.hash,
          merchant_amount: USDT_AMOUNT_HUMAN,
          merchant_wallet: MERCHANT_WALLET,
          admin_fee_amount: 0,
          note: "Rescue after directEvmSweep dropped gas TX at 0.749 Gwei",
        }),
      },
    }
  );
  log("   ✅ tbl_payment_journal ← settlement_completed");

  // ---------- 10. Redis cleanup ----------
  log("");
  log("━━━ Step D: Redis cleanup ━━━");
  const toDelete = [
    `settlement-lock-${PAYMENT_ID}:json`,
    `lock:settlement-claim-${PAYMENT_ID}`,
    `watchdog-recovery:${PAYMENT_ID}:json`,
    `payment-in-progress:${PAYMENT_ID}`,
    `settlement:${PAYMENT_ID}`,
  ];
  for (const k of toDelete) {
    const n = await redis.del(k);
    log(`   ${n ? "🗑️  deleted" : "   (absent)"}: ${k}`);
  }

  // ---------- done ----------
  log("");
  log("🎉 RESCUE COMPLETE");
  log(`   gas funding TX:    https://etherscan.io/tx/${fundTx.hash}`);
  log(`   USDT settlement:   https://etherscan.io/tx/${usdtTx.hash}`);
  log(`   merchant received: ${USDT_AMOUNT_HUMAN} USDT`);

  await redis.quit();
  await sequelize.close();
}

main().catch(async (e) => {
  console.error("❌ RESCUE FAILED:", e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
