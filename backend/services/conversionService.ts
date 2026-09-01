/**
 * Stablecoin Conversion Service
 * 
 * Orchestrates the auto-conversion flow:
 * 1. Picks up PENDING_DEPOSIT records
 * 2. Checks if deposit credited in Binance
 * 3. Gets convert quote + accepts it
 * 4. Initiates withdrawal to merchant's settlement wallet
 * 5. Monitors withdrawal until complete
 * 
 * Runs as a cron job every N minutes.
 */

import { raw as envRaw } from "../utils/config";
import stablecoinConversionModel from "../models/stablecoinConversionModel";
import { cronLogger } from "../utils/loggers";
import * as binanceService from "./binanceService";
import { isConnected as wsBinanceConnected, getStatus as getBinanceWsStatus } from "./binanceWebSocketService";
import { Op, fn, col, literal, QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import userModel from "../models/userModels/userModel";
import companyModel from "../models/companyModels/companyModel";
import { sendAutoConversionPayoutEmail, sendWeeklyConversionSummaryEmail } from "../helper/sendEmail";
import { alertTreasuryLow } from "../utils/treasuryAlert";
import { dispatchCompanyEmail } from "./email/companyDispatch";

const MAX_RETRIES = 30;           // ~30 checks after 30-min age gate ≈ hours of patience for slow chains (BTC)

// Guard to prevent cascading fast-poll re-checks
let fastPollScheduled = false;
const MAX_API_ERROR_RETRIES = 60; // Transient Binance API failures — much higher since these aren't the deposit's fault
const MAX_PENDING_AGE_HOURS = parseInt(envRaw("MAX_PENDING_AGE_HOURS") || "6", 10); // FIX BUG-1: Reduced from 24h to 6h for faster stuck conversion detection
const LOG_PREFIX = "[StablecoinConvert]";

// Estimated Binance withdrawal fees by network (in USDT)
/** Estimated withdrawal fees for reference only (Binance deducts actual fee automatically) */

// ============================================
// Helper: Log with prefix
// ============================================
const log = (msg: string) => cronLogger.info(`${LOG_PREFIX} ${msg}`);
const logError = (msg: string, err?: unknown) => {
  cronLogger.error(`${LOG_PREFIX} ❌ ${msg}`, err instanceof Error ? err.message : err || "");
};

// ============================================
// Phase 1: Check Pending Deposits
// ============================================

const markExhaustedAsFailed = async (): Promise<number> => {
  // Mark records that exceeded retry limit
  const [retryExhausted] = await stablecoinConversionModel.update(
    {
      status: "FAILED",
      error_message: `Exceeded maximum retries (${MAX_RETRIES})`,
    },
    {
      where: {
        status: { [Op.notIn]: ["COMPLETED", "FAILED"] },
        retry_count: { [Op.gte]: MAX_RETRIES },
      },
    }
  );

  // Mark records that are too old (deposit never arrived)
  const ageThreshold = new Date(Date.now() - MAX_PENDING_AGE_HOURS * 60 * 60 * 1000);
  const [ageExpired] = await stablecoinConversionModel.update(
    {
      status: "FAILED",
      error_message: `Expired: deposit not received within ${MAX_PENDING_AGE_HOURS}h — no further retries`,
    },
    {
      where: {
        status: "PENDING_DEPOSIT",
        createdAt: { [Op.lt]: ageThreshold },
      },
    }
  );

  const total = retryExhausted + ageExpired;
  if (retryExhausted > 0) logError(`Marked ${retryExhausted} records as FAILED (exceeded ${MAX_RETRIES} retries)`);
  if (ageExpired > 0) logError(`Marked ${ageExpired} records as FAILED (exceeded ${MAX_PENDING_AGE_HOURS}h age limit)`);
  return total;
};

/**
 * Recover FAILED records that were caused by transient Binance API errors
 * (geo-block, network timeout, etc.) rather than genuine deposit failures.
 * Only recovers records < 6h old where the error clearly indicates a transient issue.
 * Does NOT recover age-expired or retry-exhausted records — those are terminal.
 */
const recoverTransientFailures = async (): Promise<number> => {
  const recoverWindow = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6h window

  // Debug: count how many FAILED records exist in the recovery window
  const failedCount = await stablecoinConversionModel.count({
    where: {
      status: "FAILED",
      createdAt: { [Op.gte]: recoverWindow },
      deposit_confirmed_at: null,
    },
  });
  if (failedCount > 0) {
    log(`[Recovery] Found ${failedCount} FAILED records in last 6h with no deposit — checking for transient errors`);
  }

  const [recoveredCount] = await stablecoinConversionModel.update(
    {
      status: "PENDING_DEPOSIT",
      retry_count: 0,
      error_message: null,
    },
    {
      where: {
        status: "FAILED",
        createdAt: { [Op.gte]: recoverWindow },
        deposit_confirmed_at: null,
        // Only recover transient API errors — NOT retry-exhausted or age-expired
        error_message: {
          [Op.and]: [
            { [Op.notLike]: "%Exceeded maximum retries%" },
            { [Op.notLike]: "%no further retries%" },
          ],
        },
        [Op.or]: [
          { error_message: { [Op.like]: "%restricted location%" } },
          { error_message: { [Op.like]: "%ECONNREFUSED%" } },
          { error_message: { [Op.like]: "%ETIMEDOUT%" } },
          { error_message: { [Op.like]: "%Service unavailable%" } },
          { error_message: { [Op.like]: "%socket hang up%" } },
          { error_message: { [Op.like]: "%SOCKS%" } },
        ],
      },
    }
  );
  if (recoveredCount > 0) {
    log(`🔄 Recovered ${recoveredCount} FAILED records (transient errors) — retrying deposit check`);
  } else if (failedCount > 0) {
    log(`[Recovery] ${failedCount} FAILED records found but none matched transient error patterns`);
  }
  return recoveredCount;
};

const processPendingDeposits = async (): Promise<number> => {
  const pending = await stablecoinConversionModel.findAll({
    where: {
      status: "PENDING_DEPOSIT",
      retry_count: { [Op.lt]: MAX_RETRIES },
    },
    order: [["createdAt", "ASC"]],
    limit: 20,
  });

  if (pending.length === 0) return 0;

  log(`Found ${pending.length} pending deposits to check`);
  let processed = 0;

  for (const record of pending) {
    const data = record.dataValues;
    log(`[LOOP] Processing conversion #${data.conversion_id}, status=${data.status}, currency=${data.source_currency}`);
    try {
      // Check Binance deposit history for this TX
      const binanceAsset = binanceService.default.toBinanceAsset(data.source_currency);
      log(`[DEBUG] Checking deposit for #${data.conversion_id}: asset=${binanceAsset}, tx=${data.deposit_tx_hash ? data.deposit_tx_hash.substring(0, 16) + '...' : '(pending sweep)'}, amount=${data.source_amount}`);
      const deposits = await binanceService.getDepositHistory({
        coin: binanceAsset,
        status: 1, // success
        startTime: new Date(data.createdAt).getTime() - 3600000, // 1h before creation
      });
      log(`[DEBUG] Binance returned ${deposits.length} confirmed deposits for ${binanceAsset}`);

      // Find matching deposit — prefer TX hash match, fallback to amount + time window
      const createdAtMs = new Date(data.createdAt).getTime();
      const matchingDeposit = deposits.find(
        (d) => {
          // Primary: exact TX hash match
          if (data.deposit_tx_hash && d.txId === data.deposit_tx_hash) return true;
          // Fallback: amount + coin + time window (deposit must be after record creation)
          if (d.coin === binanceAsset && d.insertTime >= createdAtMs - 60000) {
            return Math.abs(parseFloat(d.amount) - parseFloat(data.source_amount)) < 0.00001;
          }
          return false;
        }
      );

      if (matchingDeposit) {
        log(`✅ Deposit credited for conversion #${data.conversion_id}: ${matchingDeposit.amount} ${matchingDeposit.coin}`);
        await record.update({
          status: "DEPOSIT_CREDITED",
          deposit_confirmed_at: new Date(),
        });
        processed++;
      } else {
        // Check if deposit is still pending (status=0)
        const pendingDeposits = await binanceService.getDepositHistory({
          coin: binanceAsset,
          status: 0, // pending
        });
        const pendingMatch = pendingDeposits.find(
          (d) => data.deposit_tx_hash && d.txId === data.deposit_tx_hash
        );
        if (pendingMatch) {
          log(`⏳ Deposit still pending for conversion #${data.conversion_id} (${pendingMatch.confirmTimes} confirmations)`);
        } else {
          // Increment retry counter if deposit not found at all after some time
          const ageMinutes = (Date.now() - new Date(data.createdAt).getTime()) / 60000;
          log(`[DEBUG] No deposit found for #${data.conversion_id}, age=${ageMinutes.toFixed(1)}min, pendingDeposits=${pendingDeposits.length}`);

          // FIX BUG-1: Detect stuck conversions where sweep failed (balance is dust)
          // If conversion is old enough and no deposit found on Binance, check if sweep failed
          if (ageMinutes > 60 && data.retry_count >= 5) {
            log(`⚠️ BUG-1 FIX: Conversion #${data.conversion_id} stuck for ${ageMinutes.toFixed(0)}min with ${data.retry_count} retries — likely sweep failure (funds never reached Binance)`);
            // Mark with descriptive error so admin can investigate
            await record.update({
              retry_count: data.retry_count + 1,
              last_retry_at: new Date(),
              error_message: `Sweep likely failed: deposit not found on Binance after ${ageMinutes.toFixed(0)} minutes and ${data.retry_count + 1} retries. Check if source address was swept successfully.`,
            });
          } else if (ageMinutes > 30) {
            await record.update({
              retry_count: data.retry_count + 1,
              last_retry_at: new Date(),
            });
            log(`⚠️ Deposit not found for conversion #${data.conversion_id} after ${ageMinutes.toFixed(0)}min (retry ${data.retry_count + 1}/${MAX_RETRIES})`);
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logError(`Error checking deposit for conversion #${data.conversion_id}`, err);

      // Distinguish transient API errors (network/geo-block) from real failures
      const isTransient = errMsg.includes("restricted location") ||
        errMsg.includes("ECONNREFUSED") ||
        errMsg.includes("ETIMEDOUT") ||
        errMsg.includes("ENOTFOUND") ||
        errMsg.includes("Service unavailable") ||
        errMsg.includes("socket hang up") ||
        errMsg.includes("SOCKS");

      if (isTransient) {
        // Don't increment retry_count for transient API errors — the deposit may still arrive
        // Just log the error so we can track connectivity issues
        await record.update({
          last_retry_at: new Date(),
          error_message: errMsg,
        });
        log(`⚠️ Transient API error for #${data.conversion_id} — NOT counting toward retry limit`);
      } else {
        await record.update({
          retry_count: data.retry_count + 1,
          last_retry_at: new Date(),
          error_message: errMsg,
        });
      }
    }
  }

  return processed;
};

// ============================================
// Phase 2: Convert Credited Deposits
// ============================================

const processConversions = async (): Promise<number> => {
  const credited = await stablecoinConversionModel.findAll({
    where: {
      status: "DEPOSIT_CREDITED",
      retry_count: { [Op.lt]: MAX_RETRIES },
    },
    order: [["deposit_confirmed_at", "ASC"]],
    limit: 10,
  });

  if (credited.length === 0) return 0;

  log(`Found ${credited.length} deposits ready for conversion`);
  let converted = 0;

  for (const record of credited) {
    const data = record.dataValues;
    try {
      const fromAsset = binanceService.default.toBinanceAsset(data.source_currency);
      const toAsset = data.target_currency; // USDT or USDC

      // Check available balance before quoting
      const balance = await binanceService.getAssetBalance(fromAsset);
      const sourceAmount = parseFloat(data.source_amount);

      if (balance.free < sourceAmount * 0.99) {
        log(`⚠️ Insufficient ${fromAsset} balance for conversion #${data.conversion_id}: have ${balance.free}, need ${sourceAmount}`);
        await record.update({
          retry_count: data.retry_count + 1,
          last_retry_at: new Date(),
          error_message: `Insufficient balance: ${balance.free} < ${sourceAmount}`,
        });
        continue;
      }

      // Get conversion quote via Limit IOC for best price
      log(`📊 Selling via Limit IOC: ${sourceAmount} ${fromAsset} → ${toAsset}`);
      await record.update({ status: "CONVERTING" });

      // Execute conversion via Limit IOC (best price with instant fill)
      const result = await binanceService.convertViaLimitIOC(fromAsset, toAsset, sourceAmount);
      const actualSaleUsd = parseFloat(result.toAmount);
      const tradeFeeUsd = actualSaleUsd * 0.001; // Binance 0.1% taker fee (already deducted in fill)
      const conversionRate = parseFloat(result.avgPrice); // price per 1 source_currency in USDT

      log(`✅ ${result.method} executed: order #${result.orderId}, ${result.fromAmount} ${fromAsset} → ${result.toAmount} ${toAsset} (avg price: ${result.avgPrice}, fill: ${result.fillPercent.toFixed(1)}%)`);

      // Calculate sweep gas fee in USD using the actual conversion rate
      let sweepFeeUsd = 0;
      try {
        const sweepRecord = await sequelize.query(
          `SELECT gas_used FROM tbl_merchant_pool_sweep WHERE sweep_tx_id = $1 LIMIT 1`,
          { bind: [data.deposit_tx_hash], type: QueryTypes.SELECT }
        ) as any[];
        if (sweepRecord.length > 0 && sweepRecord[0].gas_used) {
          sweepFeeUsd = parseFloat(sweepRecord[0].gas_used) * conversionRate;
        }
      } catch (sweepErr) {
        log(`⚠️ Could not fetch sweep gas for #${data.conversion_id}: ${sweepErr instanceof Error ? sweepErr.message : sweepErr}`);
      }

      // Calculate platform fee in USD using the actual conversion rate
      // conversion_fee stores the platform fee crypto amount (set at creation)
      const platformFeeCrypto = parseFloat(data.conversion_fee || "0");
      const platformFeeUsd = platformFeeCrypto > 0 ? platformFeeCrypto * conversionRate : 0;

      // Payout calculation: locked rate vs actual sale
      const lockedMerchantUsd = parseFloat(data.source_amount_usd || data.locked_merchant_usd || "0");
      const priceMovementPct = lockedMerchantUsd > 0
        ? ((actualSaleUsd - lockedMerchantUsd) / lockedMerchantUsd) * 100
        : 0;

      let platformSurplus = 0;
      let merchantPayoutPreFees = actualSaleUsd;

      if (actualSaleUsd >= lockedMerchantUsd && lockedMerchantUsd > 0) {
        // Price went up: merchant gets locked amount, platform keeps surplus
        platformSurplus = actualSaleUsd - lockedMerchantUsd;
        merchantPayoutPreFees = lockedMerchantUsd;
        log(`📈 Price went up ${priceMovementPct.toFixed(2)}%: platform surplus $${platformSurplus.toFixed(4)}`);
      } else if (lockedMerchantUsd > 0) {
        // Price dropped: merchant absorbs the loss
        platformSurplus = 0;
        merchantPayoutPreFees = actualSaleUsd;
        log(`📉 Price dropped ${priceMovementPct.toFixed(2)}%: merchant absorbs, gets $${merchantPayoutPreFees.toFixed(2)}`);
      }

      log(`💰 Fee breakdown for #${data.conversion_id}: platform=$${platformFeeUsd.toFixed(4)}, sweepGas=$${sweepFeeUsd.toFixed(4)}, tradeFee=$${tradeFeeUsd.toFixed(4)}, surplus=$${platformSurplus.toFixed(4)}`);

      await record.update({
        binance_order_id: String(result.orderId),
        conversion_rate: conversionRate,
        target_amount: actualSaleUsd,
        actual_sale_usd: actualSaleUsd,
        platform_surplus: platformSurplus,
        price_movement_pct: priceMovementPct,
        trade_fee_usd: tradeFeeUsd,
        ioc_fill_percent: result.fillPercent,
        sell_method: result.method,
        sweep_fee_usd: sweepFeeUsd,
        conversion_fee: platformFeeUsd, // Update with USD value using actual rate
        merchant_payout_usd: merchantPayoutPreFees, // Will be updated after withdrawal fee deduction
        status: "CONVERTED",
        converted_at: new Date(),
      });

      converted++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logError(`Error converting #${data.conversion_id}: ${errMsg}`);

      const isTransient = errMsg.includes("restricted location") ||
        errMsg.includes("ECONNREFUSED") || errMsg.includes("ETIMEDOUT") ||
        errMsg.includes("ENOTFOUND") || errMsg.includes("Service unavailable") ||
        errMsg.includes("socket hang up") || errMsg.includes("SOCKS");

      await record.update({
        status: "DEPOSIT_CREDITED", // Reset back so it can retry
        retry_count: isTransient ? data.retry_count : data.retry_count + 1,
        last_retry_at: new Date(),
        error_message: errMsg,
      });
    }
  }

  return converted;
};

// ============================================
// Phase 3: Withdraw Converted Stablecoins
// ============================================

const processWithdrawals = async (): Promise<number> => {
  const converted = await stablecoinConversionModel.findAll({
    where: {
      status: "CONVERTED",
      retry_count: { [Op.lt]: MAX_RETRIES },
    },
    order: [["converted_at", "ASC"]],
    limit: 10,
  });

  if (converted.length === 0) return 0;

  log(`Found ${converted.length} conversions ready for withdrawal`);
  let withdrawn = 0;

  for (const record of converted) {
    const data = record.dataValues;
    try {
      const coin = data.target_currency; // USDT or USDC
      const address = data.settlement_wallet_address;
      const network = data.settlement_chain;

      // Use merchant_payout_usd (from payout calculation) as the withdrawal amount
      // Do NOT pre-deduct withdrawal fee — Binance deducts it from the amount automatically
      const merchantPayout = parseFloat(data.merchant_payout_usd || data.target_amount || "0");
      const withdrawalAmount = merchantPayout;

      if (withdrawalAmount <= 0) {
        log(`Warning: Withdrawal amount too small for conversion #${data.conversion_id}: payout $${merchantPayout}`);
        await record.update({
          status: "FAILED",
          error_message: `Withdrawal amount ($${withdrawalAmount.toFixed(2)}) too small`,
        });
        continue;
      }

      // Verify we have enough balance
      const balance = await binanceService.getAssetBalance(coin);
      if (balance.free < withdrawalAmount * 0.99) {
        // Treasury shortfall is NOT the payout's fault — wait for a top-up instead of
        // burning retries / marking it FAILED. Alert admin (throttled) so ops can refill.
        log(`⚠️ Insufficient ${coin} for withdrawal #${data.conversion_id}: have ${balance.free}, need ${withdrawalAmount} — waiting for treasury top-up (no retry burn)`);
        await record.update({
          last_retry_at: new Date(),
          error_message: `Insufficient ${coin} balance for withdrawal (have ${balance.free}, need ${withdrawalAmount}) — awaiting treasury top-up`,
        });
        await alertTreasuryLow({ asset: coin, have: balance.free, need: withdrawalAmount, context: `Conversion withdrawal #${data.conversion_id}` });
        continue;
      }

      log(`Withdrawing ${withdrawalAmount.toFixed(2)} ${coin} (${network}) to ${address.substring(0, 10)}... (full payout, Binance deducts fee)`);
      await record.update({ status: "WITHDRAWING" });

      const withdrawal = await binanceService.submitWithdrawal({
        coin,
        address,
        amount: withdrawalAmount,
        network,
      });

      log(`Withdrawal initiated: ID ${withdrawal.id}`);
      await record.update({
        withdrawal_id: withdrawal.id,
        withdrawal_fee: 0, // Will be updated with actual Binance fee in completion check
        merchant_payout_usd: withdrawalAmount, // Amount submitted (merchant gets this minus Binance fee)
        withdrawn_at: new Date(),
      });

      withdrawn++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logError(`Error withdrawing #${data.conversion_id}: ${errMsg}`);

      const isTransient = errMsg.includes("restricted location") ||
        errMsg.includes("ECONNREFUSED") || errMsg.includes("ETIMEDOUT") ||
        errMsg.includes("ENOTFOUND") || errMsg.includes("Service unavailable") ||
        errMsg.includes("socket hang up") || errMsg.includes("SOCKS");

      await record.update({
        status: "CONVERTED", // Reset so it can retry
        retry_count: isTransient ? data.retry_count : data.retry_count + 1,
        last_retry_at: new Date(),
        error_message: errMsg,
      });
    }
  }

  return withdrawn;
};

// ============================================
// Helper: Send Payout Notification Email
// ============================================

const sendConversionPayoutNotification = async (data: any, withdrawalTxHash: string, binanceWithdrawalFee: number = 0, netPayout: number = 0) => {
  // Fetch merchant user and company info
  const user: any = await userModel.findOne({ where: { user_id: data.user_id }, raw: true });
  const company: any = await companyModel.findOne({ where: { company_id: data.company_id }, raw: true });

  if (!user?.email) {
    log(`⚠️ No email found for user #${data.user_id}, skipping payout notification`);
    return;
  }

  // Fetch current live price for the source currency
  const fromAsset = binanceService.default.toBinanceAsset(data.source_currency);
  let currentPrice = 0;
  try {
    const quote = await binanceService.getSpotQuote(fromAsset, "USDT", 1);
    currentPrice = parseFloat(quote.price);
  } catch {
    log(`⚠️ Could not fetch current price for ${fromAsset}, using conversion rate`);
    currentPrice = parseFloat(data.conversion_rate || "0");
  }

  const priceAtConversion = parseFloat(data.conversion_rate || "0");

  // Fetch full conversion record for accurate fee data
  const fullRecord: any = await stablecoinConversionModel.findOne({
    where: { conversion_id: data.conversion_id },
    raw: true,
  });

  // Calculate total received in crypto (merchant + platform fee)
  const sourceAmountCrypto = parseFloat(data.source_amount || "0");
  const platformFeeUsd = parseFloat(fullRecord?.conversion_fee || "0");
  const sweepGasFeeUsd = parseFloat(fullRecord?.sweep_fee_usd || "0");
  const tradeFeeUsd = parseFloat(fullRecord?.trade_fee_usd || "0");
  const grossSaleUsd = parseFloat(fullRecord?.actual_sale_usd || data.target_amount || "0");
  const totalReceivedUsd = grossSaleUsd + platformFeeUsd + sweepGasFeeUsd;

  await dispatchCompanyEmail(
    data.company_id,
    "payouts",
    {
      email: user.email,
      name: [company?.contact_first_name, company?.contact_last_name].filter(Boolean).join(" ").trim() || user.name || "Merchant",
    },
    (email, name) => sendAutoConversionPayoutEmail(
      email,
      name,
      company?.company_name || "Your Company",
      {
        sourceCurrency: data.source_currency,
        sourceAmount: parseFloat(data.source_amount).toString(),
        sourceAmountUsd: data.source_amount_usd || data.locked_merchant_usd || "0",
        targetCurrency: data.target_currency,
        payoutAmount: netPayout > 0 ? netPayout.toFixed(2) : parseFloat(data.merchant_payout_usd || data.target_amount || "0").toFixed(2),
        conversionRate: priceAtConversion.toString(),
        priceAtConversion,
        currentPrice,
        priceMovementPct: parseFloat(data.price_movement_pct || "0"),
        marketState: data.market_state_at_sweep || "STABLE",
        feeTierUsed: data.fee_tier_used || "slow",
        transactionId: String(data.transaction_id),
        conversionId: String(data.conversion_id),
        withdrawalTxHash,
        // Fee breakdown
        platformFeeUsd,
        sweepGasFeeUsd,
        tradeFeeUsd,
        binanceWithdrawalFeeUsd: binanceWithdrawalFee,
        grossSaleUsd,
        totalReceivedUsd,
      }
    )
  );

  log(`📧 Payout email sent to ${user.email} for conversion #${data.conversion_id} (net: $${netPayout.toFixed(2)})`);
};

// ============================================
// Phase 4: Monitor Withdrawals
// ============================================

const monitorWithdrawals = async (): Promise<number> => {
  const withdrawing = await stablecoinConversionModel.findAll({
    where: {
      status: "WITHDRAWING",
      withdrawal_id: { [Op.not]: null },
    },
    order: [["withdrawn_at", "ASC"]],
    limit: 20,
  });

  if (withdrawing.length === 0) return 0;

  log(`Monitoring ${withdrawing.length} pending withdrawals`);
  let completed = 0;

  for (const record of withdrawing) {
    const data = record.dataValues;
    try {
      const history = await binanceService.getWithdrawalHistory({
        coin: data.target_currency,
        limit: 50,
      });

      const match = history.find((w) => w.id === data.withdrawal_id);
      if (!match) {
        log(`[DEBUG] Withdrawal ${data.withdrawal_id} not found in Binance history yet for #${data.conversion_id}`);
        continue;
      }

      if (match.status === 6) {
        // Completed — calculate actual net payout after Binance withdrawal fee
        const actualFee = parseFloat(match.transactionFee || "0");
        const submittedAmount = parseFloat(data.merchant_payout_usd || data.target_amount || "0");
        const netPayout = submittedAmount - actualFee;
        
        log(`🎉 Withdrawal complete for conversion #${data.conversion_id}: TX ${match.txId} (submitted: $${submittedAmount.toFixed(2)}, binanceFee: $${actualFee.toFixed(2)}, net: $${netPayout.toFixed(2)})`);
        
        await record.update({
          status: "COMPLETED",
          withdrawal_tx_hash: match.txId,
          withdrawal_fee: actualFee,
          merchant_payout_usd: netPayout, // Actual amount merchant received after all fees
          completed_at: new Date(),
        });
        completed++;

        // Send auto-conversion payout email to merchant with full fee breakdown
        try {
          await sendConversionPayoutNotification(data, match.txId, actualFee, netPayout);
        } catch (emailErr) {
          logError(`Failed to send payout email for conversion #${data.conversion_id}`, emailErr);
        }
      } else if (match.status === 1 || match.status === 3 || match.status === 5) {
        // Cancelled, Rejected, or Failed
        logError(`Withdrawal failed for conversion #${data.conversion_id}: status=${match.status}`);
        await record.update({
          status: "CONVERTED", // Reset to retry withdrawal
          retry_count: data.retry_count + 1,
          error_message: `Withdrawal status: ${match.status}`,
        });
      } else {
        log(`[DEBUG] Withdrawal #${data.conversion_id} still processing (Binance status: ${match.status})`);
      }
      // status 0,2,4 = still processing, wait
    } catch (err) {
      logError(`Error monitoring withdrawal #${data.conversion_id}`, err);
    }
  }

  return completed;
};

// ============================================
// Main Cron Entry Point
// ============================================

export const processStablecoinConversions = async (): Promise<{
  depositsChecked: number;
  conversions: number;
  withdrawals: number;
  completed: number;
  skipped_reason?: string;
}> => {
  // Quiet mode: only log cycle start/complete when there's actual work
  // (reduces ~1,440 empty log lines/day to near zero)

  // ── Binance Availability Guard ──
  // Before making any signed Binance API calls, check if Binance is reachable.
  // If the WebSocket is disconnected AND the last data is older than 5 minutes,
  // the Binance API is likely unreachable from this server (geo-block, outage, etc.).
  // In that case, skip the expensive phases (convert, withdraw) but still check deposits
  // (which uses Binance REST — we want to detect when it comes back).
  const wsStatus = getBinanceWsStatus();
  const binanceReachable = wsStatus.connected || (wsStatus.lastMessageAge >= 0 && wsStatus.lastMessageAge < 5 * 60 * 1000);

  if (!binanceReachable) {
    log(`⚠️ Binance appears unreachable (WS connected: ${wsStatus.connected}, last msg: ${wsStatus.lastMessageAge > 0 ? Math.round(wsStatus.lastMessageAge / 1000) + 's ago' : 'never'}). Attempting proxy re-detection...`);

    // Re-detect proxy — tunnel may have come up since last check
    try {
      await binanceService.detectBinanceAccess();
      const agent = binanceService.getEffectiveProxyAgent();
      if (agent) {
        log(`✅ Proxy re-detected! Binance proxy is now available. Proceeding with conversion.`);
        // Don't skip — fall through to normal processing
      } else {
        log(`⚠️ Proxy still unavailable. Skipping conversion/withdrawal phases — will retry next cycle.`);

        // Do NOT mark exhausted records as failed when Binance is unreachable —
        // they may succeed once connectivity is restored

        // Attempt deposit check as a connectivity probe
        let depositsChecked = 0;
        try {
          depositsChecked = await processPendingDeposits();
        } catch (err) {
          logError("Deposit check failed (Binance unreachable)", err);
        }

        return {
          depositsChecked,
          conversions: 0,
          withdrawals: 0,
          completed: 0,
          skipped_reason: "binance_unreachable",
        };
      }
    } catch (detectErr) {
      log(`⚠️ Proxy re-detection failed. Skipping conversion/withdrawal phases — will retry next cycle.`);

      // Do NOT mark exhausted records as failed when Binance is unreachable

      let depositsChecked = 0;
      try {
        depositsChecked = await processPendingDeposits();
      } catch (err) {
        logError("Deposit check failed (Binance unreachable)", err);
      }

      return {
        depositsChecked,
        conversions: 0,
        withdrawals: 0,
        completed: 0,
        skipped_reason: "binance_unreachable",
      };
    }
  }

  // First, mark any records that exceeded retries as FAILED
  await markExhaustedAsFailed();

  // Recover FAILED records that were killed by transient Binance errors —
  // now that Binance is confirmed reachable, give them another chance
  await recoverTransientFailures();

  const depositsChecked = await processPendingDeposits();
  const conversions = await processConversions();
  const withdrawals = await processWithdrawals();
  const completed = await monitorWithdrawals();

  const summary = { depositsChecked, conversions, withdrawals, completed };
  // Quiet mode: only log cycle result when actual work was done
  if (depositsChecked > 0 || conversions > 0 || withdrawals > 0 || completed > 0) {
    log(`✅ Cycle complete: ${JSON.stringify(summary)}`);
  }

  // Adaptive fast-polling: if there are active records that need monitoring,
  // schedule an extra check in 30 seconds instead of waiting for the full cron interval.
  // Guard: Only schedule ONE fast-poll at a time to prevent cascade.
  const hasActiveWork = await hasActiveConversions();
  if (hasActiveWork && (depositsChecked > 0 || conversions > 0 || withdrawals > 0) && !fastPollScheduled) {
    fastPollScheduled = true;
    log(`⚡ Active conversions detected — scheduling fast re-check in 60s`);
    setTimeout(async () => {
      fastPollScheduled = false;
      try {
        log(`⚡ Fast re-check starting...`);
        await markExhaustedAsFailed();
        const d = await processPendingDeposits();
        const c = await processConversions();
        const w = await processWithdrawals();
        const comp = await monitorWithdrawals();
        log(`⚡ Fast re-check complete: ${JSON.stringify({ depositsChecked: d, conversions: c, withdrawals: w, completed: comp })}`);
      } catch (err) {
        logError("Fast re-check failed", err);
      }
    }, 60_000);
  }

  return summary;
};

/**
 * Check if there are any active conversion records that need processing
 */
const hasActiveConversions = async (): Promise<boolean> => {
  const count = await stablecoinConversionModel.count({
    where: {
      status: { [Op.in]: ["PENDING_DEPOSIT", "DEPOSIT_CREDITED", "CONVERTING", "CONVERTED", "WITHDRAWING"] },
      retry_count: { [Op.lt]: MAX_RETRIES },
    },
  });
  return count > 0;
};

// ============================================
// Manual Admin Trigger
// ============================================

export const getConversionStats = async (): Promise<Record<string, unknown>> => {
  const statusCounts = await stablecoinConversionModel.findAll({
    attributes: [
      "status",
      [stablecoinConversionModel.sequelize!.fn("COUNT", "*"), "count"],
    ],
    group: ["status"],
    raw: true,
  });

  const failedRecords = await stablecoinConversionModel.findAll({
    where: { status: "FAILED" },
    limit: 10,
    order: [["updatedAt", "DESC"]],
    raw: true,
  });

  return {
    status_counts: statusCounts,
    recent_failures: failedRecords,
    timestamp: new Date().toISOString(),
  };
};

// ============================================
// Create Conversion Record
// ============================================

export const createConversionRecord = async ({
  transactionId,
  companyId,
  userId,
  sourceCurrency,
  sourceAmount,
  sourceAmountUsd,
  targetCurrency,
  settlementWalletAddress,
  settlementChain,
  depositTxHash,
  adminWalletAddress,
  platformFeeUsd,
  platformFeeCrypto,
  totalReceivedCrypto,
  sweepGasCrypto,
}: {
  transactionId: number;
  companyId: number;
  userId: number;
  sourceCurrency: string;
  sourceAmount: number;
  sourceAmountUsd?: number;
  targetCurrency: string;
  settlementWalletAddress: string;
  settlementChain: string;
  depositTxHash?: string;
  adminWalletAddress: string;
  platformFeeUsd?: number;
  platformFeeCrypto?: number;
  totalReceivedCrypto?: number;
  sweepGasCrypto?: number;
}): Promise<unknown> => {
  const record = await stablecoinConversionModel.create({
    transaction_id: transactionId,
    company_id: companyId,
    user_id: userId,
    source_currency: sourceCurrency,
    source_amount: sourceAmount,
    source_amount_usd: sourceAmountUsd,
    target_currency: targetCurrency,
    settlement_wallet_address: settlementWalletAddress,
    settlement_chain: settlementChain,
    deposit_tx_hash: depositTxHash || null,
    admin_wallet_address: adminWalletAddress,
    status: "PENDING_DEPOSIT",
    conversion_fee: platformFeeUsd || null,
    sweep_fee_usd: null, // Will be populated after sweep with actual gas cost in USD
  });

  // Store fee metadata in a separate log for email use later
  log(`📝 Created conversion record #${record.dataValues.conversion_id}: ${sourceAmount} ${sourceCurrency} → ${targetCurrency} for company ${companyId} (platformFee: $${platformFeeUsd?.toFixed(4) || '0'}, sweepGas: ${sweepGasCrypto?.toFixed(8) || '0'} ${sourceCurrency})`);
  return record;
};

// ============================================
// Weekly Conversion Summary (Cron: Monday 9:30 AM UTC)
// ============================================

export const sendWeeklyConversionSummaries = async (): Promise<number> => {
  log("📊 Generating weekly conversion summaries...");

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  // Get all companies that had conversions this week
  const companiesWithConversions: any[] = await stablecoinConversionModel.findAll({
    attributes: [
      "company_id",
      "user_id",
      [fn("COUNT", col("conversion_id")), "total_conversions"],
    ],
    where: {
      status: "COMPLETED",
      completed_at: { [Op.between]: [startDate, endDate] },
    },
    group: ["company_id", "user_id"],
    raw: true,
  });

  if (companiesWithConversions.length === 0) {
    log("📊 No conversions this week, skipping summary emails");
    return 0;
  }

  let sent = 0;

  for (const entry of companiesWithConversions) {
    try {
      const user: any = await userModel.findOne({ where: { user_id: entry.user_id }, raw: true });
      const company: any = await companyModel.findOne({ where: { company_id: entry.company_id }, raw: true });

      if (!user?.email) continue;

      // Get all completed conversions for this company this week
      const conversions: any[] = await stablecoinConversionModel.findAll({
        where: {
          company_id: entry.company_id,
          status: "COMPLETED",
          completed_at: { [Op.between]: [startDate, endDate] },
        },
        raw: true,
      });

      // Aggregate stats
      let totalSourceUsd = 0;
      let totalPayoutUsd = 0;
      let totalVolatile = 0;
      let movementSum = 0;
      const cryptoMap: Record<string, { count: number; totalAmount: number; totalPayout: number; movementSum: number }> = {};
      const dailyMap: Record<string, number> = {};

      for (const c of conversions) {
        const srcUsd = parseFloat(c.source_amount_usd || c.locked_merchant_usd || "0");
        const payout = parseFloat(c.merchant_payout_usd || c.target_amount || "0");
        const movement = parseFloat(c.price_movement_pct || "0");
        const isVol = ["VOLATILE", "DECLINING"].includes(c.market_state_at_sweep || "");

        totalSourceUsd += srcUsd;
        totalPayoutUsd += payout;
        movementSum += movement;
        if (isVol) totalVolatile++;

        // Crypto breakdown
        const curr = c.source_currency;
        if (!cryptoMap[curr]) cryptoMap[curr] = { count: 0, totalAmount: 0, totalPayout: 0, movementSum: 0 };
        cryptoMap[curr].count++;
        cryptoMap[curr].totalAmount += parseFloat(c.source_amount || "0");
        cryptoMap[curr].totalPayout += payout;
        cryptoMap[curr].movementSum += movement;

        // Daily volume
        const dayKey = new Date(c.completed_at).toISOString().split("T")[0];
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + payout;
      }

      // Build crypto breakdown array
      const cryptoBreakdown = Object.entries(cryptoMap).map(([currency, data]) => ({
        currency,
        count: data.count,
        totalAmount: data.totalAmount.toFixed(8),
        totalPayoutUsd: data.totalPayout,
        avgMovementPct: data.count > 0 ? data.movementSum / data.count : 0,
      })).sort((a, b) => b.totalPayoutUsd - a.totalPayoutUsd);

      // Build daily volume array (last 7 days)
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyVolume: Array<{ day: string; label: string; payoutUsd: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(endDate);
        d.setDate(d.getDate() - i);
        const dayKey = d.toISOString().split("T")[0];
        dailyVolume.push({
          day: dayKey,
          label: dayNames[d.getDay()],
          payoutUsd: dailyMap[dayKey] || 0,
        });
      }

      // Calculate savings: fetch current prices and compare
      let totalSavedUsd = 0;
      for (const c of conversions) {
        const convRate = parseFloat(c.conversion_rate || "0");
        const payout = parseFloat(c.merchant_payout_usd || c.target_amount || "0");
        if (convRate <= 0 || payout <= 0) continue;

        try {
          const fromAsset = binanceService.default.toBinanceAsset(c.source_currency);
          const quote = await binanceService.getSpotQuote(fromAsset, "USDT", 1);
          const currentPrice = parseFloat(quote.price);
          const priceDiff = ((currentPrice - convRate) / convRate) * 100;
          if (priceDiff < -0.1) {
            totalSavedUsd += Math.abs(priceDiff / 100) * payout;
          }
        } catch {
          // Can't fetch price, skip savings calc for this one
        }
      }

      const avgMovement = conversions.length > 0 ? movementSum / conversions.length : 0;

      await dispatchCompanyEmail(
        entry.company_id,
        "digests",
        {
          email: user.email,
          name: [company?.contact_first_name, company?.contact_last_name].filter(Boolean).join(" ").trim() || user.name || "Merchant",
        },
        (email, name) => sendWeeklyConversionSummaryEmail(
          email,
          name,
          company?.company_name || "Your Company",
          {
            periodStart: startDate.toISOString().split("T")[0],
            periodEnd: endDate.toISOString().split("T")[0],
            totalConversions: conversions.length,
            totalSourceUsd,
            totalPayoutUsd,
            totalSavedUsd,
            totalVolatileConversions: totalVolatile,
            avgPriceMovementPct: avgMovement,
            cryptoBreakdown,
            dailyVolume,
          }
        )
      );

      log(`📧 Weekly summary sent to ${user.email} (${conversions.length} conversions, $${totalPayoutUsd.toFixed(2)} payout)`);
      sent++;
    } catch (err) {
      logError(`Error sending weekly summary for company #${entry.company_id}`, err);
    }
  }

  log(`📊 Weekly summaries sent: ${sent}/${companiesWithConversions.length}`);
  return sent;
};

export default {
  processStablecoinConversions,
  getConversionStats,
  createConversionRecord,
  sendWeeklyConversionSummaries,
};
