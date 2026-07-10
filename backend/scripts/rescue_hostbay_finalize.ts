/**
 * Idempotent completion of hostbay recovery.
 * - Payment 1 (0xe8c0, 52 USDT): on-chain settlement ALREADY BROADCAST during interrupted rescue.
 *   Skip on-chain step, just finish DB reconciliation + merchant webhooks + Redis cleanup.
 * - Payment 2 (0x84aa, 30 USDT): still stuck — execute full recovery.
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { ethers } from "ethers";
import { Sequelize, QueryTypes } from "sequelize";
import { createClient, RedisClientType } from "redis";
import tatumApi from "../apis/tatumApi";
import { callMerchantWebhook } from "../webhooks";

const USDT_CONTRACT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const MERCHANT_WALLET = "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const FEE_WALLET = "0x2b29aa060c6c15c50c02999ba7d7d090105e1a6b";

interface Task {
  paymentId: string;
  tempAddrId: number;
  tempAddress: string;
  companyId: number;
  userId: number;
  walletId: number;
  linkId: number | null;
  depositTxId: string;
  paymentAmountCrypto: number;
  merchantAmount: number;
  adminFeeAmount: number;
  baseAmountUsd: number;
  currency: string;
  redisKey: string;
  refKey: string;
  webhookUrl: string | null;
  callbackUrl: string | null;
  webhookSecret: string | null;
  // If settlement is already done on-chain, pass its hash and skip broadcast
  existingSettlementTxId?: string;
  existingGasFundingTxId?: string;
}

const TASKS: Task[] = [
  {
    paymentId: "3264a681-f0e6-4a69-a8a1-a01cf865d788",
    tempAddrId: 8,
    tempAddress: "0xe8c0d38210490b7930f94cb3d5867a7850af7bfa",
    companyId: 1,
    userId: 1,
    walletId: 5,
    linkId: null,
    depositTxId: "0x8241d24eaa35aeac32990638872322488bb2f8373670f40b4da32da557e7ca59",
    paymentAmountCrypto: 52,
    merchantAmount: 50.22,
    adminFeeAmount: 1.78,
    baseAmountUsd: 52,
    currency: "USDT-ERC20",
    redisKey: "crypto-0xe8c0d38210490b7930f94cb3d5867a7850af7bfa:json",
    refKey: "customer-1dd6967d65b0105cbfdcf2fbda0ec260e234871843ffd0d3",
    webhookUrl: "https://nomadly-email-ivr-production.up.railway.app/dynopay/crypto-wallet",
    callbackUrl: null,
    webhookSecret: null,
    existingSettlementTxId: "0x1b59674f06279214d36b3bb0159f534b80b24e4f4d97ea839c736aac7875d630",
    existingGasFundingTxId: "0x0f881754102977d47e68161ad59e3301a84ce8b8daf648b6316608d4dd022596",
  },
  {
    paymentId: "780ebded-20af-4df4-999c-f47b1a4c6f9b",
    tempAddrId: 7,
    tempAddress: "0x84aae5037ee0ea99c78a2f46a4d27ef1e64ba2cc",
    companyId: 1,
    userId: 1,
    walletId: 5,
    linkId: null,
    depositTxId: "0xddf05cfeec671b231aa43cd59565ac0d15674cd0cee0702e3554b99c290f25cb",
    paymentAmountCrypto: 30,
    merchantAmount: 28.55,
    adminFeeAmount: 1.45,
    baseAmountUsd: 30,
    currency: "USDT-ERC20",
    redisKey: "crypto-0x84aae5037ee0ea99c78a2f46a4d27ef1e64ba2cc:json",
    refKey: "customer-f3f918e4ae2feaec441439240c93d4d989f7a84ef0b5234a",
    webhookUrl: "https://nomadly-email-ivr-production.up.railway.app/dynopay/crypto-wallet",
    callbackUrl: null,
    webhookSecret: null,
  },
];

const ERC20_IFACE = new ethers.Interface([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

function stamp(m: string) {
  const ts = new Date().toISOString().slice(11, 23);
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${m}`);
}

async function getProvider(): Promise<ethers.JsonRpcProvider> {
  const urls = [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
    `https://api.tatum.io/v3/ethereum/web3/${process.env.TATUM_KEY}`,
  ];
  for (const rpcUrl of urls) {
    try {
      let provider: ethers.JsonRpcProvider;
      if (rpcUrl.includes("tatum.io") && process.env.TATUM_KEY) {
        const req = new ethers.FetchRequest(rpcUrl);
        req.setHeader("x-api-key", process.env.TATUM_KEY);
        req.timeout = 20_000;
        provider = new ethers.JsonRpcProvider(req, 1, { staticNetwork: ethers.Network.from(1) });
      } else {
        provider = new ethers.JsonRpcProvider(rpcUrl, 1, { staticNetwork: ethers.Network.from(1) });
      }
      const block = await provider.getBlockNumber();
      stamp(`   RPC OK: ${rpcUrl.split("/").slice(0, 3).join("/")}... block=${block}`);
      return provider;
    } catch (e: any) {
      stamp(`   RPC ${rpcUrl}: ${e.message}`);
    }
  }
  throw new Error("No RPC");
}

async function buildFees(provider: ethers.JsonRpcProvider) {
  const latest = await provider.getBlock("latest");
  const baseFee = latest?.baseFeePerGas ?? ethers.parseUnits("2", "gwei");
  const priority = ethers.parseUnits("1.5", "gwei");
  const computed = baseFee * 2n + priority;
  const minMax = ethers.parseUnits("3", "gwei");
  const maxFeePerGas = computed > minMax ? computed : minMax;
  return { maxFeePerGas, maxPriorityFeePerGas: priority, baseFee };
}

async function main() {
  stamp("🚑 hostbay recovery — idempotent");
  const sequelize = new Sequelize(
    process.env.DB_NAME!, process.env.USER_NAME!, process.env.PASSWORD!,
    {
      host: process.env.HOST!, port: Number(process.env.DB_PORT!),
      dialect: "postgres",
      dialectOptions: { ssl: { require: true, rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" } },
      logging: false,
    }
  );
  await sequelize.authenticate();
  stamp("✅ Prod DB");

  const redis: RedisClientType = createClient({ url: process.env.REDIS_PUBLIC_URL! });
  await redis.connect();
  stamp("✅ Prod Redis");

  const provider = await getProvider();
  const usdtRO = new ethers.Contract(USDT_CONTRACT, ERC20_IFACE, provider);

  // Cache: decrypt fee wallet once (only needed if any task requires on-chain broadcast)
  let feeWallet: ethers.Wallet | null = null;
  const anyOnChainRequired = TASKS.some((t) => !t.existingSettlementTxId);
  if (anyOnChainRequired) {
    const feeRows = (await sequelize.query(
      `SELECT "privateKey" FROM tbl_admin_fee_wallet WHERE wallet_type='ETH' AND wallet_address=:addr`,
      { replacements: { addr: FEE_WALLET }, type: QueryTypes.SELECT }
    )) as Array<{ privateKey: string }>;
    if (!feeRows.length) throw new Error("Fee wallet not found");
    const feePk = await (tatumApi as any).decryptSymmetric(feeRows[0].privateKey, process.env.TEMP_KEY_ID);
    feeWallet = new ethers.Wallet(feePk, provider);
    if (feeWallet.address.toLowerCase() !== FEE_WALLET.toLowerCase()) throw new Error("Fee PK mismatch");
    const b = await provider.getBalance(FEE_WALLET);
    stamp(`✅ Fee wallet decrypted, ETH bal=${ethers.formatEther(b)}`);
  }

  for (const task of TASKS) {
    stamp("");
    stamp(`━━━ ${task.paymentId.substring(0, 8)}...  ${task.tempAddress.substring(0, 10)}...  ${task.paymentAmountCrypto} USDT ━━━`);

    // 0. Idempotency check — has this payment already been finalized in DB?
    const existing = await sequelize.query(
      `SELECT status, incoming_tx_hash, outgoing_tx_hash FROM tbl_user_transaction WHERE id=:pid`,
      { replacements: { pid: task.paymentId }, type: QueryTypes.SELECT }
    ) as any[];
    if (existing[0] && (existing[0].status === "completed" || existing[0].status === "successful") && existing[0].outgoing_tx_hash) {
      stamp(`   ⏩ Already completed (status=${existing[0].status}, outTx=${existing[0].outgoing_tx_hash}). Skipping.`);
      continue;
    }

    let settlementTxHash = task.existingSettlementTxId || null;
    let gasFundingTxHash = task.existingGasFundingTxId || null;

    if (!settlementTxHash) {
      // Full on-chain execution
      const tempRows = (await sequelize.query(
        `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address=:addr`,
        { replacements: { addr: task.tempAddress }, type: QueryTypes.SELECT }
      )) as Array<{ private_key: string }>;
      if (!tempRows.length) throw new Error(`Temp row not found`);
      const tempPk = await (tatumApi as any).decryptSymmetric(tempRows[0].private_key, process.env.TEMP_KEY_ID);
      const tempWallet = new ethers.Wallet(tempPk, provider);
      if (tempWallet.address.toLowerCase() !== task.tempAddress.toLowerCase()) throw new Error(`Temp PK mismatch`);
      stamp("   ✅ temp addr PK");

      const usdtBal: bigint = await usdtRO.balanceOf(task.tempAddress);
      stamp(`   on-chain USDT: ${Number(usdtBal) / 1e6}`);
      const need = BigInt(Math.floor(task.merchantAmount * 1e6));
      if (usdtBal < need) throw new Error(`USDT too low: ${Number(usdtBal) / 1e6} < ${task.merchantAmount}`);

      const tempEthBefore = await provider.getBalance(task.tempAddress);
      stamp(`   temp ETH: ${ethers.formatEther(tempEthBefore)}`);

      // Gas fund
      stamp("   Step A: gas funding");
      const feeNonce = await provider.getTransactionCount(FEE_WALLET, "pending");
      const fees1 = await buildFees(provider);
      const fundTx = await feeWallet!.sendTransaction({
        to: task.tempAddress,
        value: ethers.parseEther("0.0006"),
        nonce: feeNonce,
        gasLimit: 21000n,
        maxFeePerGas: fees1.maxFeePerGas,
        maxPriorityFeePerGas: fees1.maxPriorityFeePerGas,
        type: 2,
      });
      stamp(`     ✅ ${fundTx.hash}`);
      const fundRc = await fundTx.wait(1, 180000);
      if (!fundRc || fundRc.status !== 1) throw new Error("Gas TX failed");
      stamp(`     ✅ confirmed block ${fundRc.blockNumber}`);
      gasFundingTxHash = fundTx.hash;

      // USDT transfer
      stamp("   Step B: USDT transfer");
      const tempNonce = await provider.getTransactionCount(task.tempAddress, "pending");
      const fees2 = await buildFees(provider);
      const data = ERC20_IFACE.encodeFunctionData("transfer", [MERCHANT_WALLET, need]);
      let gasLimit: bigint;
      try {
        const est = await provider.estimateGas({ from: task.tempAddress, to: USDT_CONTRACT, data });
        gasLimit = (est * 120n) / 100n;
      } catch {
        gasLimit = 100000n;
      }
      const usdtTx = await tempWallet.sendTransaction({
        to: USDT_CONTRACT, data, nonce: tempNonce, gasLimit,
        maxFeePerGas: fees2.maxFeePerGas,
        maxPriorityFeePerGas: fees2.maxPriorityFeePerGas,
        type: 2,
      });
      stamp(`     ✅ ${usdtTx.hash}`);
      const usdtRc = await usdtTx.wait(1, 180000);
      if (!usdtRc || usdtRc.status !== 1) throw new Error("USDT TX failed");
      stamp(`     ✅ confirmed block ${usdtRc.blockNumber}`);
      settlementTxHash = usdtTx.hash;
    } else {
      // Verify on-chain that the existing settlement TX succeeded
      const rc = await provider.getTransactionReceipt(settlementTxHash);
      if (!rc || rc.status !== 1) throw new Error(`Existing settlement TX ${settlementTxHash} not confirmed`);
      stamp(`   ✅ Existing settlement TX confirmed (block ${rc.blockNumber})`);
    }

    // ── DB reconciliation ─────────────────────────────────────
    stamp("   Step C: DB reconciliation");
    const nowIso = new Date().toISOString();
    const tx = await sequelize.transaction();
    try {
      await sequelize.query(
        `UPDATE tbl_user_transaction
           SET status='completed', incoming_tx_hash=:inH, outgoing_tx_hash=:outH,
               usd_value=:usdVal, confirmations=12, transaction_fee=:txFee,
               "updatedAt"=NOW()
         WHERE id=:pid`,
        {
          replacements: { inH: task.depositTxId, outH: settlementTxHash, usdVal: task.baseAmountUsd, txFee: task.adminFeeAmount, pid: task.paymentId },
          transaction: tx,
        }
      );
      await sequelize.query(
        `UPDATE tbl_merchant_temp_address
           SET status='AVAILABLE', current_payment_id=NULL, current_company_id=NULL,
               received_amount=:amt, is_partial_payment=false, expected_amount=NULL,
               reserved_until=NULL, locked_at=NULL, last_used_at=NOW(),
               last_swept_at=NOW(), last_merchant_payout=NOW(),
               admin_fee_balance = admin_fee_balance + :feeAmt,
               total_transactions = total_transactions + 1,
               last_payment_context=:ctx, updated_at=NOW()
         WHERE temp_address_id=:tid`,
        {
          replacements: {
            amt: task.paymentAmountCrypto, feeAmt: task.adminFeeAmount, tid: task.tempAddrId,
            ctx: JSON.stringify({
              payment_id: task.paymentId, rescue: true,
              root_cause: "isOwnOutgoingTransaction false-positive (webhookProcessor.ts commit 61cc2422 Jul 3 15:37)",
              incoming_tx: task.depositTxId, settle_tx: settlementTxHash,
              gas_fund_tx: gasFundingTxHash, rescued_at: nowIso,
              merchant_amount: task.merchantAmount, admin_fee_amount: task.adminFeeAmount,
            }),
          },
          transaction: tx,
        }
      );
      await sequelize.query(
        `INSERT INTO tbl_payment_journal (payment_id, tx_id, address, currency, event, from_state, to_state, amount, company_id, metadata, created_at)
         VALUES (:pid, :tx, :addr, :cur, 'payment_detected', 'pending', 'processing', :amt, :cid, :meta::jsonb, NOW())`,
        {
          replacements: { pid: task.paymentId, tx: task.depositTxId, addr: task.tempAddress, cur: task.currency, amt: task.paymentAmountCrypto, cid: task.companyId, meta: JSON.stringify({ source: "manual_recovery", expectedAmount: task.paymentAmountCrypto, reason: "isOwnOutgoingTransaction bug — commit 61cc2422" }) },
          transaction: tx,
        }
      );
      await sequelize.query(
        `INSERT INTO tbl_payment_journal (payment_id, tx_id, address, currency, event, from_state, to_state, amount, settlement_tx_id, company_id, metadata, created_at)
         VALUES (:pid, NULL, :addr, :cur, 'settlement_sent', 'processing', 'payout_complete', :amt, :sTx, :cid, :meta::jsonb, NOW())`,
        {
          replacements: { pid: task.paymentId, addr: task.tempAddress, cur: task.currency, amt: task.paymentAmountCrypto, sTx: settlementTxHash, cid: task.companyId, meta: JSON.stringify({ source: "manual_recovery", method: "directEvmSweep_recovery", admin_amount: task.adminFeeAmount, merchant_amount: task.merchantAmount, gas_funding_tx: gasFundingTxHash }) },
          transaction: tx,
        }
      );
      await sequelize.query(
        `INSERT INTO tbl_payment_journal (payment_id, tx_id, address, currency, event, from_state, to_state, amount, settlement_tx_id, company_id, metadata, created_at)
         VALUES (:pid, :tx, :addr, :cur, 'payment_completed', 'processing', 'payout_complete', :amt, :sTx, :cid, :meta::jsonb, NOW())`,
        {
          replacements: { pid: task.paymentId, tx: task.depositTxId, addr: task.tempAddress, cur: task.currency, amt: task.paymentAmountCrypto, sTx: settlementTxHash, cid: task.companyId, meta: JSON.stringify({ source: "manual_recovery", originalExpected: task.paymentAmountCrypto, settlement_tx: settlementTxHash, note: "Recovered from isOwnOutgoingTransaction bug" }) },
          transaction: tx,
        }
      );
      await sequelize.query(
        `INSERT INTO tbl_merchant_pool_transaction 
           (temp_address_id, owner_user_id, company_id, payment_reference, wallet_type,
            payment_amount, merchant_amount, admin_fee_amount, gas_funded, gas_used,
            incoming_tx_id, merchant_tx_id, gas_funding_tx_id, status, created_at, updated_at)
         VALUES (:tid, :uid, :cid, :pref, :wt, :pa, :ma, :fa, 0.0006, 0.0001, :inTx, :outTx, :gasTx, 'completed', NOW(), NOW())`,
        {
          replacements: { tid: task.tempAddrId, uid: task.userId, cid: task.companyId, pref: task.paymentId, wt: task.currency, pa: task.paymentAmountCrypto, ma: task.merchantAmount, fa: task.adminFeeAmount, inTx: task.depositTxId, outTx: settlementTxHash, gasTx: gasFundingTxHash },
          transaction: tx,
        }
      );
      await sequelize.query(
        `UPDATE tbl_user_wallet SET amount = amount + :amt, "updatedAt"=NOW() WHERE wallet_id=:wid`,
        { replacements: { amt: task.merchantAmount, wid: task.walletId }, transaction: tx }
      );
      await tx.commit();
      stamp("     ✅ DB committed");
    } catch (dbErr) {
      await tx.rollback();
      stamp(`     ❌ DB rollback: ${(dbErr as Error).message}`);
      throw dbErr;
    }

    // ── Merchant webhooks ─────────────────────────────────
    stamp("   Step D: merchant webhooks");
    const customerData: any = {
      adm_id: task.userId, user_id: task.userId, company_id: task.companyId,
      webhook_url: task.webhookUrl, callback_url: task.callbackUrl, webhook_secret: task.webhookSecret,
      base_amount: task.baseAmountUsd, base_currency: "USD",
      customer_name: null, email: null, description: null,
      link_id: task.linkId, fee_payer: "company",
    };
    const paymentType = task.linkId ? "payment_link" : "direct_api";
    if (task.webhookUrl || task.callbackUrl) {
      // pending
      try {
        await callMerchantWebhook(customerData, {
          event: "payment.pending", payment_type: paymentType,
          address: task.tempAddress, txId: task.depositTxId, transaction_reference: task.depositTxId,
          amount: task.paymentAmountCrypto, currency: task.currency,
          payment_id: task.paymentId, status: "pending", payment_status: "pending",
          base_amount: task.baseAmountUsd, base_currency: "USD",
          fee_payer: "company", link_id: task.linkId,
          note: "Recovered from webhook processor bug (isOwnOutgoingTransaction).",
          created_at: nowIso, timestamp: nowIso,
        } as any);
        stamp("     ✅ payment.pending");
      } catch (e: any) { stamp(`     ⚠️ pending: ${e.message}`); }
      await new Promise((r) => setTimeout(r, 400));
      try {
        await callMerchantWebhook(customerData, {
          event: "payment.confirmed", payment_type: paymentType,
          address: task.tempAddress, txId: task.depositTxId, transaction_reference: task.depositTxId,
          amount: task.paymentAmountCrypto, currency: task.currency,
          payment_id: task.paymentId, status: "confirmed", payment_status: "confirmed",
          base_amount: task.baseAmountUsd, base_currency: "USD",
          fee_payer: "company", link_id: task.linkId,
          note: "Payment confirmed on-chain. Recovered from webhook processor bug.",
          created_at: nowIso, received_at: nowIso,
        } as any);
        stamp("     ✅ payment.confirmed");
      } catch (e: any) { stamp(`     ⚠️ confirmed: ${e.message}`); }
      await new Promise((r) => setTimeout(r, 400));
      try {
        await callMerchantWebhook(customerData, {
          event: "payment.settled", payment_type: paymentType,
          address: task.tempAddress, txId: task.depositTxId, transaction_reference: task.depositTxId,
          amount: task.paymentAmountCrypto, currency: task.currency,
          payment_id: task.paymentId, status: "settled", payment_status: "settled",
          base_amount: task.baseAmountUsd, base_currency: "USD",
          fee_payer: "company", link_id: task.linkId,
          settlement_tx_id: settlementTxHash,
          merchant_amount: task.merchantAmount, admin_fee_amount: task.adminFeeAmount,
          created_at: nowIso, settled_at: nowIso,
        } as any);
        stamp("     ✅ payment.settled");
      } catch (e: any) { stamp(`     ⚠️ settled: ${e.message}`); }
    } else {
      stamp("     (no webhook url)");
    }

    // ── Redis cleanup ─────────────────────────────────────
    stamp("   Step E: Redis cleanup");
    for (const k of [task.redisKey, `${task.refKey}:json`, `payment-settlement-lock-${task.paymentId}:json`, `settlement-lock-${task.paymentId}:json`, `lock:settlement-claim-${task.paymentId}`]) {
      const n = await redis.del(k);
      stamp(`     ${n ? "🗑️  del" : "  absent"}: ${k}`);
    }
    await redis.set(
      `processed-tx-${task.depositTxId}:json`,
      JSON.stringify({ address: task.tempAddress, payment_id: task.paymentId, amount: task.paymentAmountCrypto, processed_at: nowIso, recovered: true, rescue_settlement_tx: settlementTxHash }),
      { EX: 172800 }
    );
    stamp(`     ✅ processed-tx-${task.depositTxId.slice(0, 12)}...`);

    stamp(`✅ Payment ${task.paymentId.substring(0, 8)}... FINALIZED`);
    stamp(`   incoming:   https://etherscan.io/tx/${task.depositTxId}`);
    stamp(`   settlement: https://etherscan.io/tx/${settlementTxHash}`);
    stamp(`   merchant received: ${task.merchantAmount} USDT-ERC20`);
  }

  await redis.quit();
  await sequelize.close();
  stamp("");
  stamp("🎉 DONE");
}

main().catch(async (e) => {
  console.error("❌ RESCUE FAILED:", e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
