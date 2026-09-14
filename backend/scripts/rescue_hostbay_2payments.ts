/**
 * One-shot rescue for TWO stuck USDT-ERC20 payments to hostbay@moxx.co
 *
 * Payment 1: 3264a681-f0e6-4a69-a8a1-a01cf865d788 (52 USDT expected, 52.150408 on-chain)
 *   temp_address_id=8, wallet 0xe8c0d38210490b7930f94cb3d5867a7850af7bfa
 *   Redis: merchant_amount=50.22, total_fees=1.78, fee_payer=company
 *   Deposit tx: 0x8241d24eaa35aeac32990638872322488bb2f8373670f40b4da32da557e7ca59
 *
 * Payment 2: 780ebded-20af-4df4-999c-f47b1a4c6f9b (30 USDT expected, 30.334754 on-chain)
 *   temp_address_id=7, wallet 0x84aae5037ee0ea99c78a2f46a4d27ef1e64ba2cc
 *   Redis: merchant_amount=28.55, total_fees=1.45, fee_payer=company
 *   Deposit tx: 0xddf05cfeec671b231aa43cd59565ac0d15674cd0cee0702e3554b99c290f25cb
 *
 * Merchant destination: 0x9a7221b5e32d5f99e8da95585835442e29afb38f (wallet_id=5, user_id=1, company_id=1)
 * Fee wallet (gas):     0x2b29aa060c6c15c50c02999ba7d7d090105e1a6b (0.01283 ETH available)
 *
 * Root cause: isOwnOutgoingTransaction() in webhookProcessor.ts (commit 61cc2422 Jul 3 15:37)
 * incorrectly treats `payload.counterAddress` as the sender. For Tatum's ADDRESS_EVENT format
 * on ERC-20 INCOMING transfers, `counterAddress` is the RECEIVER (our subscribed pool addr).
 * This caused the processor to bail out as "pool_sender" (own outgoing) for every legitimate
 * ERC-20 payment since Jul 3 15:37.
 *
 * Steps for each payment:
 *   1. KMS-decrypt temp addr + fee wallet private keys
 *   2. Fund gas from fee wallet → temp addr (~0.0006 ETH)
 *   3. Transfer merchant_amount USDT from temp addr → merchant wallet
 *   4. Update tbl_user_transaction (status=successful, tx hashes)
 *   5. Update tbl_merchant_temp_address (status=AVAILABLE)
 *   6. Insert tbl_payment_journal rows (payment_detected → settlement_sent → payment_completed)
 *   7. Insert tbl_merchant_pool_transaction audit row
 *   8. Update tbl_user_wallet.amount += merchant_amount
 *   9. Fire merchant webhooks (payment.pending → payment.settled)
 *  10. Set Redis processed-tx-<txid> + delete stale session keys
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { ethers } from "ethers";
import { Sequelize, QueryTypes } from "sequelize";
import { createClient, RedisClientType } from "redis";
import tatumApi from "../apis/tatumApi";
import { callMerchantWebhook } from "../webhooks";

// ─── Constants ──────────────────────────────────────────────────────────────
const USDT_CONTRACT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const MERCHANT_WALLET = "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const FEE_WALLET = "0x2b29aa060c6c15c50c02999ba7d7d090105e1a6b";

interface RescueTask {
  paymentId: string;
  tempAddrId: number;
  tempAddress: string;
  companyId: number;
  userId: number;
  walletId: number; // merchant wallet_id
  linkId: number | null;
  depositTxId: string;
  paymentAmountCrypto: number;   // amount received on-chain (used for journal payment_amount)
  merchantAmount: number;        // amount forwarded to merchant (Redis merchant_amount)
  adminFeeAmount: number;        // admin fee kept in temp addr for later sweep
  baseAmountUsd: number;         // base amount USD (== crypto for USDT)
  currency: string;
  redisKey: string;
  refKey: string;
  webhookUrl: string | null;
  callbackUrl: string | null;
  webhookSecret: string | null;
}

const TASKS: RescueTask[] = [
  {
    paymentId: "3264a681-f0e6-4a69-a8a1-a01cf865d788",
    tempAddrId: 8,
    tempAddress: "0xe8c0d38210490b7930f94cb3d5867a7850af7bfa",
    companyId: 1,
    userId: 1,
    walletId: 5,
    linkId: null,
    depositTxId: "0x8241d24eaa35aeac32990638872322488bb2f8373670f40b4da32da557e7ca59",
    paymentAmountCrypto: 52,          // Redis "amount"
    merchantAmount: 50.22,            // Redis "merchant_amount"
    adminFeeAmount: 1.78,             // Redis "total_fees"
    baseAmountUsd: 52,
    currency: "USDT-ERC20",
    redisKey: "crypto-0xe8c0d38210490b7930f94cb3d5867a7850af7bfa:json",
    refKey: "customer-1dd6967d65b0105cbfdcf2fbda0ec260e234871843ffd0d3",
    webhookUrl: "https://nomadly-email-ivr-production.up.railway.app/dynopay/crypto-wallet",
    callbackUrl: null,
    webhookSecret: null,
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

// ─── Helpers ────────────────────────────────────────────────────────────────
function stamp(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${msg}`);
}

async function getProvider(): Promise<ethers.JsonRpcProvider> {
  const rpcUrls = [
    "https://eth.llamarpc.com",
    "https://ethereum-rpc.publicnode.com",
    `https://api.tatum.io/v3/ethereum/web3/${process.env.TATUM_KEY}`,
  ];
  for (const rpcUrl of rpcUrls) {
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
      stamp(`   RPC OK: ${rpcUrl.split("/").slice(0, 3).join("/")}... blockNumber=${block}`);
      return provider;
    } catch (e: any) {
      stamp(`   RPC ${rpcUrl} failed: ${e.message}`);
    }
  }
  throw new Error("No RPC endpoint available");
}

async function buildFees(provider: ethers.JsonRpcProvider) {
  const latest = await provider.getBlock("latest");
  const baseFee = latest?.baseFeePerGas ?? ethers.parseUnits("2", "gwei");
  const priorityFee = ethers.parseUnits("1.5", "gwei");
  const computed = baseFee * 2n + priorityFee;
  const minMax = ethers.parseUnits("3", "gwei");
  const maxFeePerGas = computed > minMax ? computed : minMax;
  return { maxFeePerGas, maxPriorityFeePerGas: priorityFee, baseFee };
}

async function decryptKey(cipher: string): Promise<string> {
  const pk = await (tatumApi as any).decryptSymmetric(cipher, process.env.TEMP_KEY_ID);
  if (!pk) throw new Error("KMS decrypt returned empty");
  return pk;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  stamp("🚑 Starting rescue for 2 stuck USDT-ERC20 payments to hostbay@moxx.co");

  // 1. Connect DB + Redis
  const sequelize = new Sequelize(
    process.env.DB_NAME!,
    process.env.USER_NAME!,
    process.env.PASSWORD!,
    {
      host: process.env.HOST!,
      port: Number(process.env.DB_PORT!),
      dialect: "postgres",
      dialectOptions: { ssl: { require: true, rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" } },
      logging: false,
    }
  );
  await sequelize.authenticate();
  stamp("✅ Prod DB connected");

  const redis: RedisClientType = createClient({ url: process.env.REDIS_PUBLIC_URL! });
  await redis.connect();
  stamp("✅ Prod Redis connected");

  const provider = await getProvider();

  // 2. Decrypt fee wallet private key ONCE (shared for both tasks)
  const feeRows = (await sequelize.query(
    `SELECT "privateKey" FROM tbl_admin_fee_wallet WHERE wallet_type='ETH' AND wallet_address=:addr`,
    { replacements: { addr: FEE_WALLET }, type: QueryTypes.SELECT }
  )) as Array<{ privateKey: string }>;
  if (!feeRows.length) throw new Error("Fee wallet row missing");
  const feePk = await decryptKey(feeRows[0].privateKey);
  const feeWallet = new ethers.Wallet(feePk, provider);
  if (feeWallet.address.toLowerCase() !== FEE_WALLET.toLowerCase()) {
    throw new Error(`Fee wallet PK mismatch: ${feeWallet.address} vs ${FEE_WALLET}`);
  }
  stamp("✅ Fee wallet private key decrypted + address verified");

  const feeEthBal = await provider.getBalance(FEE_WALLET);
  stamp(`   fee wallet ETH balance: ${ethers.formatEther(feeEthBal)} ETH`);
  const need = ethers.parseEther("0.0015"); // 0.00075 × 2 buffer
  if (feeEthBal < need) {
    throw new Error(`Fee wallet balance too low: need >= 0.0015 ETH, have ${ethers.formatEther(feeEthBal)}`);
  }

  const usdtRO = new ethers.Contract(USDT_CONTRACT, ERC20_IFACE, provider);
  const merchantUsdtBefore = await usdtRO.balanceOf(MERCHANT_WALLET);
  stamp(`   merchant wallet USDT before: ${Number(merchantUsdtBefore) / 1e6}`);

  // Process each task sequentially
  for (const task of TASKS) {
    stamp("");
    stamp(`━━━ ${task.paymentId.substring(0, 8)}...  ${task.tempAddress.substring(0, 10)}...  ${task.paymentAmountCrypto} USDT ━━━`);

    // 2a. Decrypt temp addr private key
    const tempRows = (await sequelize.query(
      `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address=:addr`,
      { replacements: { addr: task.tempAddress }, type: QueryTypes.SELECT }
    )) as Array<{ private_key: string }>;
    if (!tempRows.length) throw new Error(`Temp addr row not found: ${task.tempAddress}`);
    const tempPk = await decryptKey(tempRows[0].private_key);
    const tempWallet = new ethers.Wallet(tempPk, provider);
    if (tempWallet.address.toLowerCase() !== task.tempAddress.toLowerCase()) {
      throw new Error(`Temp PK mismatch: ${tempWallet.address} vs ${task.tempAddress}`);
    }
    stamp("   ✅ temp addr PK decrypted + verified");

    // 2b. Verify USDT balance on-chain
    const usdtBal: bigint = await usdtRO.balanceOf(task.tempAddress);
    const usdtBalHuman = Number(usdtBal) / 1e6;
    stamp(`   on-chain USDT: ${usdtBalHuman}`);
    const requiredUsdt = BigInt(Math.floor(task.merchantAmount * 1e6));
    if (usdtBal < requiredUsdt) {
      throw new Error(`USDT balance too low: ${usdtBalHuman} < ${task.merchantAmount}`);
    }

    // 2c. Check current ETH gas on temp addr
    const tempEthBefore = await provider.getBalance(task.tempAddress);
    stamp(`   temp addr ETH gas: ${ethers.formatEther(tempEthBefore)}`);

    // 2d. Fund gas from fee wallet (~0.0006 ETH)
    stamp("   Step A: gas funding fee wallet → temp addr");
    const feeNonce = await provider.getTransactionCount(FEE_WALLET, "pending");
    const fees1 = await buildFees(provider);
    stamp(`     baseFee=${ethers.formatUnits(fees1.baseFee, "gwei")}Gwei maxFee=${ethers.formatUnits(fees1.maxFeePerGas, "gwei")}Gwei`);
    const gasAmountWei = ethers.parseEther("0.0006");
    const fundTx = await feeWallet.sendTransaction({
      to: task.tempAddress,
      value: gasAmountWei,
      nonce: feeNonce,
      gasLimit: 21000n,
      maxFeePerGas: fees1.maxFeePerGas,
      maxPriorityFeePerGas: fees1.maxPriorityFeePerGas,
      type: 2,
    });
    stamp(`     ✅ broadcast: ${fundTx.hash}`);
    const fundReceipt = await fundTx.wait(1, 180_000);
    if (!fundReceipt || fundReceipt.status !== 1) throw new Error("Gas funding TX failed");
    stamp(`     ✅ confirmed in block ${fundReceipt.blockNumber}, gasUsed=${fundReceipt.gasUsed.toString()}`);

    // 2e. USDT transfer temp → merchant
    stamp("   Step B: USDT transfer temp → merchant");
    const tempNonce = await provider.getTransactionCount(task.tempAddress, "pending");
    const fees2 = await buildFees(provider);
    const data = ERC20_IFACE.encodeFunctionData("transfer", [MERCHANT_WALLET, requiredUsdt]);
    let gasLimit: bigint;
    try {
      const est = await provider.estimateGas({ from: task.tempAddress, to: USDT_CONTRACT, data });
      gasLimit = (est * 120n) / 100n;
    } catch {
      gasLimit = 100000n;
    }
    stamp(`     nonce=${tempNonce} gasLimit=${gasLimit.toString()} maxFee=${ethers.formatUnits(fees2.maxFeePerGas, "gwei")}Gwei`);
    const usdtTx = await tempWallet.sendTransaction({
      to: USDT_CONTRACT,
      data,
      nonce: tempNonce,
      gasLimit,
      maxFeePerGas: fees2.maxFeePerGas,
      maxPriorityFeePerGas: fees2.maxPriorityFeePerGas,
      type: 2,
    });
    stamp(`     ✅ broadcast: ${usdtTx.hash}`);
    const usdtReceipt = await usdtTx.wait(1, 180_000);
    if (!usdtReceipt || usdtReceipt.status !== 1) throw new Error("USDT transfer failed on chain");
    stamp(`     ✅ confirmed in block ${usdtReceipt.blockNumber}, gasUsed=${usdtReceipt.gasUsed.toString()}`);

    // 3. DB reconciliation (transaction)
    stamp("   Step C: DB reconciliation");
    const nowIso = new Date().toISOString();
    const tx = await sequelize.transaction();
    try {
      // 3a. tbl_user_transaction → mark completed (matches prior manual_recovery pattern)
      await sequelize.query(
        `UPDATE tbl_user_transaction
           SET status='completed',
               incoming_tx_hash=:inHash,
               outgoing_tx_hash=:outHash,
               usd_value=:usdVal,
               confirmations=12,
               transaction_fee=:txFee,
               "updatedAt"=NOW()
         WHERE id=:pid`,
        {
          replacements: {
            inHash: task.depositTxId,
            outHash: usdtTx.hash,
            usdVal: task.baseAmountUsd,
            txFee: task.adminFeeAmount,
            pid: task.paymentId,
          },
          transaction: tx,
        }
      );

      // 3b. tbl_merchant_temp_address → AVAILABLE (fully released)
      await sequelize.query(
        `UPDATE tbl_merchant_temp_address
           SET status='AVAILABLE',
               current_payment_id=NULL,
               current_company_id=NULL,
               received_amount=:amt,
               is_partial_payment=false,
               expected_amount=NULL,
               reserved_until=NULL,
               locked_at=NULL,
               last_used_at=NOW(),
               last_swept_at=NOW(),
               last_merchant_payout=NOW(),
               admin_fee_balance = admin_fee_balance + :feeAmt,
               total_transactions = total_transactions + 1,
               last_payment_context=:ctx,
               updated_at=NOW()
         WHERE temp_address_id=:tid`,
        {
          replacements: {
            amt: task.paymentAmountCrypto,
            feeAmt: task.adminFeeAmount,
            tid: task.tempAddrId,
            ctx: JSON.stringify({
              payment_id: task.paymentId,
              rescue: true,
              root_cause: "isOwnOutgoingTransaction false-positive (webhookProcessor.ts commit 61cc2422 Jul 3 15:37)",
              incoming_tx: task.depositTxId,
              settle_tx: usdtTx.hash,
              gas_fund_tx: fundTx.hash,
              rescued_at: nowIso,
              merchant_amount: task.merchantAmount,
              admin_fee_amount: task.adminFeeAmount,
            }),
          },
          transaction: tx,
        }
      );

      // 3c. Payment journal - payment_detected
      await sequelize.query(
        `INSERT INTO tbl_payment_journal (payment_id, tx_id, address, currency, event, from_state, to_state, amount, company_id, metadata, created_at)
         VALUES (:pid, :tx, :addr, :cur, 'payment_detected', 'pending', 'processing', :amt, :cid, :meta::jsonb, NOW())`,
        {
          replacements: {
            pid: task.paymentId,
            tx: task.depositTxId,
            addr: task.tempAddress,
            cur: task.currency,
            amt: task.paymentAmountCrypto,
            cid: task.companyId,
            meta: JSON.stringify({ source: "manual_recovery", expectedAmount: task.paymentAmountCrypto, reason: "isOwnOutgoingTransaction bug — see webhookProcessor.ts commit 61cc2422" }),
          },
          transaction: tx,
        }
      );

      // 3d. Payment journal - settlement_sent
      await sequelize.query(
        `INSERT INTO tbl_payment_journal (payment_id, tx_id, address, currency, event, from_state, to_state, amount, settlement_tx_id, company_id, metadata, created_at)
         VALUES (:pid, NULL, :addr, :cur, 'settlement_sent', 'processing', 'payout_complete', :amt, :sTx, :cid, :meta::jsonb, NOW())`,
        {
          replacements: {
            pid: task.paymentId,
            addr: task.tempAddress,
            cur: task.currency,
            amt: task.paymentAmountCrypto,
            sTx: usdtTx.hash,
            cid: task.companyId,
            meta: JSON.stringify({
              source: "manual_recovery",
              method: "directEvmSweep_recovery",
              admin_amount: task.adminFeeAmount,
              merchant_amount: task.merchantAmount,
              gas_funding_tx: fundTx.hash,
            }),
          },
          transaction: tx,
        }
      );

      // 3e. Payment journal - payment_completed
      await sequelize.query(
        `INSERT INTO tbl_payment_journal (payment_id, tx_id, address, currency, event, from_state, to_state, amount, settlement_tx_id, company_id, metadata, created_at)
         VALUES (:pid, :tx, :addr, :cur, 'payment_completed', 'processing', 'payout_complete', :amt, :sTx, :cid, :meta::jsonb, NOW())`,
        {
          replacements: {
            pid: task.paymentId,
            tx: task.depositTxId,
            addr: task.tempAddress,
            cur: task.currency,
            amt: task.paymentAmountCrypto,
            sTx: usdtTx.hash,
            cid: task.companyId,
            meta: JSON.stringify({ source: "manual_recovery", originalExpected: task.paymentAmountCrypto, settlement_tx: usdtTx.hash, note: "Recovered from isOwnOutgoingTransaction bug" }),
          },
          transaction: tx,
        }
      );

      // 3f. tbl_merchant_pool_transaction audit row
      await sequelize.query(
        `INSERT INTO tbl_merchant_pool_transaction 
           (temp_address_id, owner_user_id, company_id, payment_reference, wallet_type,
            payment_amount, merchant_amount, admin_fee_amount, gas_funded, gas_used,
            incoming_tx_id, merchant_tx_id, gas_funding_tx_id, status, created_at, updated_at)
         VALUES (:tid, :uid, :cid, :pref, :wt, :pa, :ma, :fa, :gf, :gu, :inTx, :outTx, :gasTx, 'completed', NOW(), NOW())`,
        {
          replacements: {
            tid: task.tempAddrId,
            uid: task.userId,
            cid: task.companyId,
            pref: task.paymentId,
            wt: task.currency,
            pa: task.paymentAmountCrypto,
            ma: task.merchantAmount,
            fa: task.adminFeeAmount,
            gf: 0.0006,
            gu: Number(usdtReceipt.gasUsed) / 1e18 * 3, // approx
            inTx: task.depositTxId,
            outTx: usdtTx.hash,
            gasTx: fundTx.hash,
          },
          transaction: tx,
        }
      );

      // 3g. Credit merchant wallet balance (only merchant_amount, not the fee)
      await sequelize.query(
        `UPDATE tbl_user_wallet
           SET amount = amount + :amt, "updatedAt"=NOW()
         WHERE wallet_id = :wid`,
        {
          replacements: { amt: task.merchantAmount, wid: task.walletId },
          transaction: tx,
        }
      );

      await tx.commit();
      stamp("     ✅ DB updates committed");
    } catch (dbErr) {
      await tx.rollback();
      stamp(`     ❌ DB rollback: ${(dbErr as Error).message}`);
      throw dbErr;
    }

    // 4. Merchant webhook — payment.pending → payment.confirmed → payment.settled
    stamp("   Step D: fire merchant webhooks");
    const customerData: any = {
      adm_id: task.userId,
      user_id: task.userId,
      company_id: task.companyId,
      webhook_url: task.webhookUrl,
      callback_url: task.callbackUrl,
      webhook_secret: task.webhookSecret,
      base_amount: task.baseAmountUsd,
      base_currency: "USD",
      customer_name: null,
      email: null,
      description: null,
      link_id: task.linkId,
      fee_payer: "company",
    };

    if (task.webhookUrl || task.callbackUrl) {
      const paymentType = task.linkId ? "payment_link" : "direct_api";

      // payment.pending
      try {
        await callMerchantWebhook(customerData, {
          event: "payment.pending",
          payment_type: paymentType,
          address: task.tempAddress,
          txId: task.depositTxId,
          transaction_reference: task.depositTxId,
          amount: task.paymentAmountCrypto,
          currency: task.currency,
          payment_id: task.paymentId,
          status: "pending",
          payment_status: "pending",
          base_amount: task.baseAmountUsd,
          base_currency: "USD",
          fee_payer: "company",
          link_id: task.linkId,
          note: "Recovered from webhook processor bug (isOwnOutgoingTransaction). Original arrival: on-chain confirmed.",
          created_at: nowIso,
          timestamp: nowIso,
        } as any);
        stamp("     ✅ payment.pending sent");
      } catch (e: any) { stamp(`     ⚠️ pending webhook err: ${e.message}`); }

      // slight delay so pending is delivered first
      await new Promise((r) => setTimeout(r, 400));

      // payment.confirmed
      try {
        await callMerchantWebhook(customerData, {
          event: "payment.confirmed",
          payment_type: paymentType,
          address: task.tempAddress,
          txId: task.depositTxId,
          transaction_reference: task.depositTxId,
          amount: task.paymentAmountCrypto,
          currency: task.currency,
          payment_id: task.paymentId,
          status: "confirmed",
          payment_status: "confirmed",
          base_amount: task.baseAmountUsd,
          base_currency: "USD",
          fee_payer: "company",
          link_id: task.linkId,
          note: "Payment confirmed on-chain. Recovered from webhook processor bug — settlement completed manually.",
          created_at: nowIso,
          received_at: nowIso,
        } as any);
        stamp("     ✅ payment.confirmed sent");
      } catch (e: any) { stamp(`     ⚠️ confirmed webhook err: ${e.message}`); }

      await new Promise((r) => setTimeout(r, 400));

      // payment.settled
      try {
        await callMerchantWebhook(customerData, {
          event: "payment.settled",
          payment_type: paymentType,
          address: task.tempAddress,
          txId: task.depositTxId,
          transaction_reference: task.depositTxId,
          amount: task.paymentAmountCrypto,
          currency: task.currency,
          payment_id: task.paymentId,
          status: "settled",
          payment_status: "settled",
          base_amount: task.baseAmountUsd,
          base_currency: "USD",
          fee_payer: "company",
          link_id: task.linkId,
          settlement_tx_id: usdtTx.hash,
          merchant_amount: task.merchantAmount,
          admin_fee_amount: task.adminFeeAmount,
          note: "Funds delivered to merchant wallet.",
          created_at: nowIso,
          settled_at: nowIso,
        } as any);
        stamp("     ✅ payment.settled sent");
      } catch (e: any) { stamp(`     ⚠️ settled webhook err: ${e.message}`); }
    } else {
      stamp("     (no webhook_url — merchant has no webhook configured)");
    }

    // 5. Redis cleanup
    stamp("   Step E: Redis cleanup");
    const keysToClear = [
      task.redisKey,
      `${task.refKey}:json`,
      `payment-settlement-lock-${task.paymentId}:json`,
      `settlement-lock-${task.paymentId}:json`,
      `lock:settlement-claim-${task.paymentId}`,
      `payment-in-progress:${task.paymentId}`,
    ];
    for (const k of keysToClear) {
      const n = await redis.del(k);
      stamp(`     ${n ? "🗑️  deleted" : "   (absent)"}: ${k}`);
    }

    // Set processed-tx guard
    await redis.set(
      `processed-tx-${task.depositTxId}:json`,
      JSON.stringify({
        address: task.tempAddress,
        payment_id: task.paymentId,
        amount: task.paymentAmountCrypto,
        processed_at: nowIso,
        recovered: true,
        rescue_settlement_tx: usdtTx.hash,
      }),
      { EX: 172800 }
    );
    stamp(`     ✅ processed-tx-${task.depositTxId.slice(0, 12)}... marked with 48h TTL`);

    stamp(`✅ Payment ${task.paymentId.substring(0, 8)}... RECOVERED`);
    stamp(`   incoming tx:   https://etherscan.io/tx/${task.depositTxId}`);
    stamp(`   settlement tx: https://etherscan.io/tx/${usdtTx.hash}`);
    stamp(`   merchant received: ${task.merchantAmount} USDT-ERC20`);
  }

  // Post-check merchant balance
  stamp("");
  const merchantUsdtAfter = await usdtRO.balanceOf(MERCHANT_WALLET);
  stamp(`Final merchant wallet USDT: ${Number(merchantUsdtAfter) / 1e6} (was ${Number(merchantUsdtBefore) / 1e6}, delta ${(Number(merchantUsdtAfter) - Number(merchantUsdtBefore)) / 1e6})`);

  await redis.quit();
  await sequelize.close();
  stamp("");
  stamp("🎉 ALL RESCUES COMPLETE");
}

main().catch(async (e) => {
  console.error("❌ RESCUE FAILED:", e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
