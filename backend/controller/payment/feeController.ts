/**
 * Fee / quote / configured-currency read handlers.
 * Extracted verbatim from paymentController.ts (no behavior change).
 */
import { raw as envRaw } from "../../utils/config";
import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { apiLogger, cronLogger } from "../../utils/loggers";
import {
  currencyConvert,
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../../helper";
import { getRedisItem } from "../../utils/redisInstance";
import { companyModel, paymentLinkModel, userWalletModel } from "../../models";
import { PaymentUserJwtPayload } from "../../utils/types";
import {
  getAllBlockchainFees,
  getBlockchainNetworkFee,
  calculateCustomerPaymentAmount,
} from "../../services/blockchainFeeService";
import {
  calculateTransactionFees,
  getDiscountedTransactionFee,
} from "../../services/feeService";
import { getFeeTiers } from "../../utils/feeConfigUtils";
import { resolveMembership, membershipCan } from "../../utils/permissions";
import { getCryptoPriceForPayment } from "./paymentHelpers";
import { getPlatformFeePercent } from "../../utils/volumeTierUtils";
import { paymentLinkModel as _pl, userModel } from "../../models";

/**
 * Convert a raw blockchain fee result into a plain, JSON-safe object containing
 * ONLY known scalar fields. This is intentionally robust: when an upstream fee
 * fetch fails (e.g. Tatum returns 400 for a chain), an Axios error object — which
 * holds circular references (TLSSocket -> HTTPParser -> socket) — can leak into the
 * results. Using JSON.parse(JSON.stringify(...)) on such an object THROWS
 * ("Converting circular structure to JSON") and previously crashed the whole
 * endpoint with a 500. Extracting known fields by hand avoids touching any
 * circular/non-serializable properties and returns null for anything that is not
 * a valid fee result so it can be skipped.
 */
const toSafeFeePayload = (raw: unknown): Record<string, unknown> | null => {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  // A valid fee result must expose numeric feeInNative + feeInUSD.
  // Anything else (e.g. an Axios error object) is rejected.
  if (typeof f.feeInNative !== "number" || typeof f.feeInUSD !== "number") return null;
  if (!Number.isFinite(f.feeInNative as number) || !Number.isFinite(f.feeInUSD as number)) return null;

  const ts = f.timestamp;
  const safeTimestamp =
    ts instanceof Date
      ? ts.toISOString()
      : typeof ts === "number" || typeof ts === "string"
        ? ts
        : Date.now();

  const payload: Record<string, unknown> = {
    chain: typeof f.chain === "string" ? f.chain : undefined,
    feeInNative: Number(f.feeInNative),
    feeInUSD: Number(f.feeInUSD),
    speed: typeof f.speed === "string" ? f.speed : "fast",
    timestamp: safeTimestamp,
  };
  if (typeof f.gasPrice === "number") payload.gasPrice = f.gasPrice;
  if (typeof f.satPerByte === "number") payload.satPerByte = f.satPerByte;
  if (typeof f.nativeSymbol === "string") payload.nativeSymbol = f.nativeSymbol;
  return payload;
};

export const getNetworkFees = async (req: express.Request, res: express.Response) => {
  try {
    const { chain } = req.query;

    if (chain) {
      let fee: unknown;
      try {
        fee = await getBlockchainNetworkFee(chain as string);
      } catch (chainErr) {
        // Upstream provider (e.g. Tatum) failed for this specific chain — don't 500.
        cronLogger.warn(
          `[getNetworkFees] Upstream fee fetch failed for ${chain}:`,
          (chainErr as { message?: string })?.message || String(chainErr)
        );
        errorResponseHelper(res, 502, `Network fee temporarily unavailable for ${chain}`);
        return;
      }
      const safeFee = toSafeFeePayload(fee);
      if (!safeFee) {
        // Upstream fee provider returned an error / unusable response for this chain.
        errorResponseHelper(res, 502, `Network fee temporarily unavailable for ${chain}`);
        return;
      }
      successResponseHelper(res, 200, "Network fee retrieved", safeFee);
    } else {
      const fees = await getAllBlockchainFees();
      // Build a clean response containing only chains with valid, serializable fees.
      const safeFees: Record<string, unknown> = {};
      for (const [chainKey, fee] of Object.entries(fees || {})) {
        const safeFee = toSafeFeePayload(fee);
        if (safeFee) safeFees[chainKey] = safeFee;
      }
      successResponseHelper(res, 200, "Network fees retrieved", safeFees);
    }
  } catch (e) {
    const message = typeof e === 'string' ? e : (e as any)?.message || 'Failed to fetch network fees';
    cronLogger.error("[getNetworkFees] Error:", message);
    errorResponseHelper(res, 500, message);
  }
};

/**
 * POST /api/payment/calculate-payment
 * Public endpoint - Calculate total payment amount with blockchain fees
 */
export const calculatePaymentAmount = async (req: express.Request, res: express.Response) => {
  try {
    const { amount_usd, chain, fee_payer = 'customer' } = req.body;

    if (!amount_usd || !chain) {
      return errorResponseHelper(res, 400, "amount_usd and chain are required");
    }

    // Get current crypto price
    const cryptoPrice = await getCryptoPriceForPayment(chain);
    
    if (fee_payer === 'customer') {
      const calculation = await calculateCustomerPaymentAmount(
        parseFloat(amount_usd),
        chain,
        cryptoPrice
      );

      successResponseHelper(res, 200, "Payment amount calculated", {
        fee_payer: 'customer',
        base_amount_usd: parseFloat(amount_usd),
        base_amount_crypto: calculation.baseAmountCrypto,
        blockchain_fee_native: calculation.blockchainFeeNative,
        blockchain_fee_usd: calculation.blockchainFeeUSD,
        total_amount_crypto: calculation.totalAmountCrypto,
        total_amount_usd: calculation.totalAmountUSD,
        crypto_currency: chain,
        crypto_price_usd: cryptoPrice,
      });
    } else {
      const baseAmountCrypto = parseFloat(amount_usd) / cryptoPrice;
      const networkFee = await getBlockchainNetworkFee(chain);

      successResponseHelper(res, 200, "Payment amount calculated", {
        fee_payer: 'company',
        base_amount_usd: parseFloat(amount_usd),
        base_amount_crypto: baseAmountCrypto,
        blockchain_fee_native: networkFee.feeInNative,
        blockchain_fee_usd: networkFee.feeInUSD,
        total_amount_crypto: baseAmountCrypto,
        total_amount_usd: parseFloat(amount_usd),
        crypto_currency: chain,
        crypto_price_usd: cryptoPrice,
        note: "Blockchain fee will be deducted from merchant settlement"
      });
    }
  } catch (e) {
    const message = getErrorMessage(e);
    cronLogger.error("[calculatePaymentAmount] Error:", message);
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Helper: Get crypto price in USD for payment calculations
 */

/**
 * Get Configured Currencies for Checkout
 * Returns only wallets configured for the company (from customer token)
 * Used by checkout page to filter available payment currencies
 * GET /api/pay/configured-currencies
 */
export const getConfiguredCurrenciesForCheckout = async (
  _req: express.Request,
  res: express.Response
) => {
  try {
    // Get user data from customer token (set by customerAuthMiddleware)
    const userData = res.locals.user;
    
    if (!userData) {
      return errorResponseHelper(res, 400, "Invalid customer session");
    }
    
    // For payment link flow, get company_id from payment link record
    let companyId: number | null = null;
    let userId: number | null = null;
    let paymentRef = userData.ref;
    let transactionId = userData.transaction_id;
    let feePayerFromLink = 'company';
    
    // Track accepted_currencies restriction from payment link
    let acceptedCurrenciesFilter: string[] | null = null;
    
    // First try to get company_id and accepted_currencies from payment link using transaction_id
    if (userData.pathType === 'createLink' && userData.transaction_id) {
      const paymentLink = await paymentLinkModel.findOne({
        where: { transaction_id: userData.transaction_id },
        attributes: ['company_id', 'user_id', 'fee_payer', 'base_amount', 'base_currency', 'link_id', 'accepted_currencies'],
      });
      
      if (paymentLink) {
        companyId = paymentLink.dataValues.company_id as number;
        userId = paymentLink.dataValues.user_id as number;
        feePayerFromLink = (paymentLink.dataValues.fee_payer as string) || 'company';
        
        // Parse accepted_currencies if set by merchant
        const acceptedCurrenciesStr = paymentLink.dataValues.accepted_currencies as string | null;
        if (acceptedCurrenciesStr) {
          acceptedCurrenciesFilter = acceptedCurrenciesStr.split(',').map((c: string) => c.trim().toUpperCase());
          cronLogger.info(`[getConfiguredCurrenciesForCheckout] Payment link has accepted_currencies restriction: ${acceptedCurrenciesFilter.join(', ')}`);
        }
      }
    }
    
    // Fallback: try to get from Redis data (includes available_currencies)
    if (!userId && paymentRef) {
      const redisData = await getRedisItem(`customer-${paymentRef}`);
      if (redisData) {
        companyId = redisData.company_id ? parseInt(redisData.company_id) : null;
        userId = redisData.adm_id ? parseInt(redisData.adm_id) : (redisData.user_id ? parseInt(redisData.user_id) : null);
        feePayerFromLink = redisData.fee_payer || 'company';
        
        // Get available_currencies from Redis (set during payment link creation)
        if (redisData.available_currencies) {
          if (Array.isArray(redisData.available_currencies)) {
            acceptedCurrenciesFilter = redisData.available_currencies;
          } else if (typeof redisData.available_currencies === 'string') {
            acceptedCurrenciesFilter = redisData.available_currencies.split(',').map((c: string) => c.trim().toUpperCase());
          }
          cronLogger.info(`[getConfiguredCurrenciesForCheckout] Redis has available_currencies: ${acceptedCurrenciesFilter?.join(', ')}`);
        }
      }
    }
    
    if (!userId) {
      return errorResponseHelper(res, 400, "Invalid payment session - merchant not found");
    }
    
    cronLogger.info(`[getConfiguredCurrenciesForCheckout] Looking up wallets for user_id: ${userId}, company_id: ${companyId}`);
    
    // Get configured wallets for this merchant
    // IMPORTANT: Only return wallets that have a wallet_address configured
    const walletWhereClause: Record<string, unknown> = {
      user_id: userId,
      wallet_address: { [Op.not]: null },
      wallet_type: { [Op.in]: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'] },
    };
    
    // If company_id exists, filter by it
    if (companyId) {
      walletWhereClause.company_id = companyId;
    }
    
    // If merchant specified accepted_currencies, filter wallet types
    if (acceptedCurrenciesFilter && acceptedCurrenciesFilter.length > 0) {
      walletWhereClause.wallet_type = { [Op.in]: acceptedCurrenciesFilter };
      cronLogger.info(`[getConfiguredCurrenciesForCheckout] Filtering wallets to accepted currencies: ${acceptedCurrenciesFilter.join(', ')}`);
    }
    
    const configuredWallets = await userWalletModel.findAll({
      where: walletWhereClause,
      attributes: ['wallet_type', 'wallet_address', 'wallet_name'],
    });
    
    // Extract unique currencies (only those with actual addresses AND in accepted list)
    let currencies = [...new Set(configuredWallets.map((w) => w.dataValues.wallet_type as string))];
    
    // Double-check filter (in case of edge cases)
    if (acceptedCurrenciesFilter && acceptedCurrenciesFilter.length > 0) {
      currencies = currencies.filter(c => acceptedCurrenciesFilter!.includes(c));
    }
    
    // Normalize USDC-ERC20 → USDC for checkout compatibility
    // The checkout frontend only knows about "USDC" (no network selection needed since USDC only runs on ERC-20)
    // This ensures the checkout's cryptoOptions (which has value: "USDC") can match the configured currency
    currencies = currencies.map(c => c === 'USDC-ERC20' ? 'USDC' : c);
    // De-duplicate after normalization
    currencies = [...new Set(currencies)];
    
    cronLogger.info(`[getConfiguredCurrenciesForCheckout] Found ${currencies.length} currencies: ${currencies.join(', ')}`);
    
    let feeInfo = {
      fee_payer: feePayerFromLink,
      transaction_fee_percent: parseFloat(envRaw("TRANSACTION_FEE_PERCENT") || '2.0'),
    };
    
    let transactionAmount = 0;
    let transactionCurrency = 'USD';
    let linkId: string | number | null = null;
    
    // Try to get fee_payer and amount from payment link data
    if (paymentRef) {
      const paymentData = await getRedisItem(`customer-${paymentRef}`);
      if (paymentData) {
        if (paymentData.fee_payer) {
          feeInfo.fee_payer = paymentData.fee_payer;
        }
        if (paymentData.base_amount) {
          transactionAmount = parseFloat(paymentData.base_amount);
        } else if (paymentData.amount) {
          transactionAmount = parseFloat(paymentData.amount);
        }
        if (paymentData.base_currency) {
          transactionCurrency = paymentData.base_currency;
        } else if (paymentData.currency) {
          transactionCurrency = paymentData.currency;
        }
        if (paymentData.link_id) {
          linkId = paymentData.link_id;
        }
      }
    }
    
    // If no link_id from Redis, try to get from payment link record
    if (!linkId && transactionId) {
      const paymentLink = await paymentLinkModel.findOne({
        where: { transaction_id: transactionId },
        attributes: ['link_id', 'base_amount', 'base_currency', 'fee_payer'],
      });
      if (paymentLink) {
        linkId = paymentLink.dataValues.link_id as number;
        if (!transactionAmount && paymentLink.dataValues.base_amount) {
          transactionAmount = parseFloat(String(paymentLink.dataValues.base_amount));
        }
        if (paymentLink.dataValues.base_currency) {
          transactionCurrency = paymentLink.dataValues.base_currency as string;
        }
        if (paymentLink.dataValues.fee_payer) {
          feeInfo.fee_payer = paymentLink.dataValues.fee_payer as string;
        }
      }
    }
    
    // Calculate total processing fee if customer pays fees (internal calculation - not exposed in detail)
    let totalProcessingFee = 0;
    if (feeInfo.fee_payer === 'customer' && transactionAmount > 0) {
      const feeTiers = (await import("../../utils/feeConfigUtils")).getFeeTiers();
      let fixedFee = 0;
      for (const tier of feeTiers) {
        if (transactionAmount >= tier.min && (tier.max === null || transactionAmount <= tier.max)) {
          fixedFee = tier.fixed;
          break;
        }
      }
      const percentageFee = transactionAmount * (feeInfo.transaction_fee_percent / 100);
      totalProcessingFee = percentageFee + fixedFee;
    }
    
    const response: Record<string, unknown> = {
      configured_currencies: currencies,
      wallet_count: configuredWallets.length,
      wallets: configuredWallets.map((w) => {
        const walletData = w.dataValues as { wallet_type: string; wallet_name?: string; wallet_address?: string };
        // Normalize USDC-ERC20 → USDC for checkout consistency
        const normalizedType = walletData.wallet_type === 'USDC-ERC20' ? 'USDC' : walletData.wallet_type;
        return {
          currency: normalizedType,
          label: walletData.wallet_name,
          address_masked: walletData.wallet_address ? 
            `${walletData.wallet_address.substring(0, 6)}...${walletData.wallet_address.substring(walletData.wallet_address.length - 4)}` : 
            null
        };
      }),
      skip_selection: currencies.length === 1,
      // Payment link ID
      link_id: linkId,
      // Transaction info
      transaction_amount: transactionAmount,
      transaction_currency: transactionCurrency,
      // Simplified fee info - no internal breakdown exposed
      fee_payer: feeInfo.fee_payer,
    };
    
    // Include only total processing fee if customer pays fees
    if (feeInfo.fee_payer === 'customer' && transactionAmount > 0) {
      response.processing_fee = parseFloat(totalProcessingFee.toFixed(2));
      response.total_amount = parseFloat((transactionAmount + totalProcessingFee).toFixed(2));
    }
    
    successResponseHelper(res, 200, "Configured currencies retrieved successfully", response);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, {}, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Calculate fees for checkout page - Public endpoint (no auth required)
 * POST /api/pay/calculateFees
 * 
 * Used by merchants and checkout page to show fee breakdown:
 * - Platform fee: % of amount (from TRANSACTION_FEE_PERCENT env)
 * - Blockchain fee: Network fee for the selected cryptocurrency
 * - Total fees: Platform fee + blockchain fee + fixed tier fee
 * - Net to merchant: Amount - Total fees
 * 
 * Supports any fiat currency - automatically converts to USD for fee tier calculation
 */
export const calculateCheckoutFees = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { amount, cryptocurrency, currency = 'USD', paymentLinkId, linkId } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return errorResponseHelper(res, 400, "Valid payment amount is required");
    }

    if (!cryptocurrency) {
      return errorResponseHelper(res, 400, "Cryptocurrency selection is required");
    }

    const paymentAmount = parseFloat(amount);
    let crypto = cryptocurrency.toUpperCase();
    const fiatCurrency = currency.toUpperCase();

    // Normalize checkout currency aliases to internal wallet types
    if (crypto === 'USDC') crypto = 'USDC-ERC20';
    if (crypto === 'RLUSD-XRPL') crypto = 'RLUSD';

    // Validate cryptocurrency
    const validCryptos = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    if (!validCryptos.includes(crypto)) {
      return errorResponseHelper(res, 400, `Invalid cryptocurrency. Valid options: ${validCryptos.join(', ')}`);
    }

    // Validate fiat currency (common fiat currencies supported)
    const validFiatCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'NZD', 'SGD', 'HKD', 'NGN', 'KES', 'ZAR', 'BRL', 'MXN', 'INR', 'PKR', 'AED', 'SAR', 'PHP', 'THB', 'IDR', 'MYR', 'VND', 'KRW', 'TWD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'ILS', 'CLP', 'COP', 'PEN', 'ARS'];
    if (!validFiatCurrencies.includes(fiatCurrency)) {
      return errorResponseHelper(res, 400, `Invalid currency. Common options: USD, EUR, GBP, AUD, CAD, etc.`);
    }

    // Resolve the merchant user_id from the payment link (if provided) so we can
    // use their VOLUME TIER percentage instead of the flat fallback. Safe fallback:
    // if no link id is supplied OR the lookup fails, we use TRANSACTION_FEE_PERCENT
    // (1.5%, same as before this change).
    let merchantUserId: number | undefined;
    const linkRef = paymentLinkId ?? linkId;
    if (linkRef) {
      try {
        const link = await _pl.findOne({
          where: { link_id: linkRef },
          attributes: ["user_id"],
          raw: true,
        });
        merchantUserId = (link as any)?.user_id;
      } catch (e) {
        cronLogger.warn(`[calculateCheckoutFees] Failed to resolve merchant for link ${linkRef}: ${(e as Error).message}`);
      }
    }

    // Convert amount to USD for fee calculation if not already USD
    let amountUSD = paymentAmount;
    let exchangeRate = 1;
    
    if (fiatCurrency !== 'USD') {
      try {
        const usdConversion = await currencyConvert({
          sourceCurrency: fiatCurrency,
          currency: ['USD'],
          amount: paymentAmount,
          fixedDecimal: true,
        });
        amountUSD = Number(usdConversion[0]?.amount || paymentAmount);
        exchangeRate = amountUSD / paymentAmount;
        cronLogger.info(`[calculateCheckoutFees] Converted ${paymentAmount} ${fiatCurrency} → ${amountUSD.toFixed(2)} USD`);
      } catch (conversionError) {
        cronLogger.warn(`[calculateCheckoutFees] USD conversion failed, using original amount:`, conversionError);
      }
    }

    // Calculate actual fees using existing fee logic (based on USD amount)
    const { totalDeduction } = await calculateTransactionFees(
      crypto,
      amountUSD,
      merchantUserId
    );

    // Get blockchain network fee for display
    let networkFeeUSD = 0;
    try {
      const networkFee = await getBlockchainNetworkFee(crypto);
      networkFeeUSD = Number(networkFee.feeInUSD) || 0;
    } catch (e) {
      cronLogger.info(`[calculateCheckoutFees] Could not fetch network fee for ${crypto}, using 0`);
    }

    // Total actual fees in USD (from our fee tier system)
    const totalActualFeesUSD = totalDeduction + networkFeeUSD;

    // Fee breakdown (in USD first):
    // Platform fee = merchant's tier % of amount (falls back to 1.5% if no merchant known)
    // Blockchain fee = network fee for the selected cryptocurrency
    let platformFeePercent = parseFloat(envRaw("TRANSACTION_FEE_PERCENT") || '1.5');
    if (merchantUserId) {
      try {
        const merchant = await userModel.findOne({
          where: { user_id: merchantUserId },
          attributes: ["fee_tier"],
          raw: true,
        });
        platformFeePercent = getPlatformFeePercent((merchant as any)?.fee_tier);
      } catch {
        // Keep the safe 1.5% fallback
      }
    }
    const platformFeeUSD = parseFloat((amountUSD * platformFeePercent / 100).toFixed(2));
    
    // Total fees in USD
    const totalFeesUSD = parseFloat(totalActualFeesUSD.toFixed(2));
    
    // Blockchain fee is the remainder (total - platform fee)
    const blockchainFeeUSD = parseFloat(Math.max(0, totalFeesUSD - platformFeeUSD).toFixed(2));
    
    // Net amount to merchant in USD
    const netToMerchantUSD = parseFloat((amountUSD - totalFeesUSD).toFixed(2));

    // Convert fees back to original currency if not USD
    let platformFee = platformFeeUSD;
    let blockchainFee = blockchainFeeUSD;
    let totalFees = totalFeesUSD;
    let netToMerchant = netToMerchantUSD;

    if (fiatCurrency !== 'USD' && exchangeRate > 0) {
      // Convert all fee amounts back to original currency
      const reverseRate = 1 / exchangeRate;
      platformFee = parseFloat((platformFeeUSD * reverseRate).toFixed(2));
      blockchainFee = parseFloat((blockchainFeeUSD * reverseRate).toFixed(2));
      totalFees = parseFloat((totalFeesUSD * reverseRate).toFixed(2));
      netToMerchant = parseFloat((netToMerchantUSD * reverseRate).toFixed(2));
    }

    // Build response
    const response = {
      payment_amount: paymentAmount,
      currency: fiatCurrency,
      cryptocurrency: crypto,
      fee_breakdown: {
        platform_fee: platformFee,
        platform_fee_percent: platformFeePercent,
        blockchain_fee: blockchainFee,
        total_fees: totalFees,
      },
      net_to_merchant: netToMerchant,
      // USD equivalents for reference (always included)
      usd_equivalents: {
        payment_amount_usd: parseFloat(amountUSD.toFixed(2)),
        total_fees_usd: totalFeesUSD,
        net_to_merchant_usd: netToMerchantUSD,
        exchange_rate: fiatCurrency !== 'USD' ? parseFloat(exchangeRate.toFixed(6)) : 1,
      },
    };

    cronLogger.info(`[calculateCheckoutFees] ${paymentAmount} ${fiatCurrency} ($${amountUSD.toFixed(2)} USD) in ${crypto}: Total fees=$${totalFeesUSD.toFixed(2)} USD (platform=$${platformFeeUSD}, blockchain=$${blockchainFeeUSD}), Net=$${netToMerchantUSD} USD`);

    return successResponseHelper(res, 200, "Fee calculation successful", response);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    cronLogger.error(`[calculateCheckoutFees] Error:`, errorMessage);
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Get fee preview with user's referral discount applied
 * GET /api/pay/fee-preview
 */
export const getFeePreview = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
    const { amount, currency, fee_payer } = req.query;

    if (!amount) {
      return errorResponseHelper(res, 400, "Amount is required");
    }

    const amountNum = parseFloat(amount as string);
    if (isNaN(amountNum) || amountNum <= 0) {
      return errorResponseHelper(res, 400, "Invalid amount");
    }

    // Who pays the platform fee: "customer" -> fee added on top (merchant gets
    // the full amount); "company" (default) -> fee deducted from the merchant payout.
    const feePayer = (fee_payer as string) === "customer" ? "customer" : "company";

    // Get discounted fee info for user.
    // A2/RBAC: a granted team member sees the OWNER's fee tier & volume-based
    // discount, not their own "$0 / Starter". Best-effort remap via the selected
    // company (X-Company-Id header or ?company_id) — never 403s, and is a no-op
    // for the owner (m.ownerUserId === self).
    let feeUserId = Number(userData.user_id);
    const feeCompanyId = String(
      (req.query.company_id as string) || (req.headers["x-company-id"] as string) || ""
    ).trim();
    if (feeCompanyId) {
      try {
        const m = await resolveMembership(feeUserId, Number(feeCompanyId));
        if (m && (m.isOwner || membershipCan(m, "view_dashboard"))) {
          feeUserId = Number(m.ownerUserId);
        }
      } catch {
        // best-effort — fall back to the caller's own id
      }
    }
    const discountInfo = await getDiscountedTransactionFee(feeUserId);

    // Calculate fees
    const baseFeePercent = Number(discountInfo.base_fee);
    const finalFeePercent = Number(discountInfo.final_fee);
    
    const basePercentFee = (amountNum * baseFeePercent) / 100;
    const discountedPercentFee = (amountNum * finalFeePercent) / 100;

    // Fixed per-tier fee — matches what the checkout (customer-pays) path and the
    // settlement engine actually charge, so the create-link estimate lines up to
    // the cent (network/blockchain fee is excluded — it's only known once the
    // customer picks a coin at checkout).
    const feeTiers = getFeeTiers();
    let fixedTierFee = 0;
    for (const tier of feeTiers) {
      if (amountNum >= tier.min && (tier.max === null || amountNum <= tier.max)) {
        fixedTierFee = Number(tier.fixed) || 0;
        break;
      }
    }

    const baseFeeAmount = basePercentFee + fixedTierFee;
    const discountedFeeAmount = discountedPercentFee + fixedTierFee;
    const savings = baseFeeAmount - discountedFeeAmount;

    // Net payout to merchant + total the customer is charged, based on who pays the fee.
    const youReceive = feePayer === "customer"
      ? amountNum                              // customer covers the fee -> merchant gets full amount
      : amountNum - discountedFeeAmount;       // company pays the fee -> fee deducted from payout
    const customerPays = feePayer === "customer"
      ? amountNum + discountedFeeAmount        // fee added on top of the amount
      : amountNum;

    return successResponseHelper(res, 200, "Fee preview retrieved successfully", {
      amount: amountNum,
      currency: currency || 'USD',
      fee: parseFloat(discountedFeeAmount.toFixed(2)),
      fee_payer: feePayer,
      you_receive: parseFloat(youReceive.toFixed(2)),
      customer_pays: parseFloat(customerPays.toFixed(2)),
      fee_info: {
        base_fee_percent: baseFeePercent,
        final_fee_percent: finalFeePercent,
        percent_fee_amount: parseFloat(discountedPercentFee.toFixed(2)),
        fixed_fee: parseFloat(fixedTierFee.toFixed(2)),
        base_fee_amount: parseFloat(baseFeeAmount.toFixed(2)),
        discounted_fee_amount: parseFloat(discountedFeeAmount.toFixed(2)),
        savings: parseFloat(savings.toFixed(2)),
        fee_payer: feePayer,
        you_receive: parseFloat(youReceive.toFixed(2)),
        customer_pays: parseFloat(customerPays.toFixed(2)),
        note: "Estimate covers the DynoPay platform fee (percentage + fixed). Network/blockchain fees are shown at checkout once a coin is selected.",
      },
      discount_info: {
        has_discount: discountInfo.discount_percent > 0,
        discount_percent: discountInfo.discount_percent,
        discount_reason: discountInfo.discount_reason,
        expires_at: discountInfo.discount_expires_at,
        days_remaining: discountInfo.discount_expires_at 
          ? Math.ceil((new Date(discountInfo.discount_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0,
      },
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(errorMessage, {}, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Get configured cryptocurrencies for a company (merchant dashboard)
 * GET /api/pay/configured-currencies/:company_id
 * 
 * Returns list of crypto wallets configured for this company with their status
 * Used by frontend when creating/editing payment links to show available currencies
 */
export const getCompanyConfiguredCurrencies = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
    const { company_id } = req.params;

    if (!company_id) {
      return errorResponseHelper(res, 400, "company_id is required");
    }

    // Verify company belongs to user
    const company = await companyModel.findOne({
      where: { 
        company_id: parseInt(company_id),
        user_id: userData.user_id 
      },
      attributes: ['company_id', 'company_name'],
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Company not found or does not belong to you");
    }

    // All supported crypto types
    const allCryptoTypes = [
      { type: 'BTC', name: 'Bitcoin', symbol: '₿' },
      { type: 'ETH', name: 'Ethereum', symbol: 'Ξ' },
      { type: 'LTC', name: 'Litecoin', symbol: 'Ł' },
      { type: 'DOGE', name: 'Dogecoin', symbol: 'Ð' },
      { type: 'TRX', name: 'Tron', symbol: '◎' },
      { type: 'BCH', name: 'Bitcoin Cash', symbol: '₿' },
      { type: 'USDT-TRC20', name: 'USDT (TRC-20)', symbol: '₮' },
      { type: 'USDT-ERC20', name: 'USDT (ERC-20)', symbol: '₮' },
      { type: 'USDC-ERC20', name: 'USDC (ERC-20)', symbol: '$' },
      { type: 'SOL', name: 'Solana', symbol: '◎' },
      { type: 'XRP', name: 'XRP', symbol: '✕' },
      { type: 'RLUSD', name: 'RLUSD (XRP Ledger)', symbol: '$' },
      { type: 'RLUSD-ERC20', name: 'RLUSD (ERC-20)', symbol: '$' },
      { type: 'POLYGON', name: 'Polygon', symbol: '⬡' },
      { type: 'USDT-POLYGON', name: 'USDT (Polygon)', symbol: '₮' },
    ];

    // Get configured wallets for this company
    const configuredWallets = await userWalletModel.findAll({
      where: {
        user_id: userData.user_id,
        company_id: parseInt(company_id),
        wallet_address: { [Op.not]: null },
        wallet_type: { [Op.in]: allCryptoTypes.map(c => c.type) },
      },
      attributes: ['wallet_type', 'wallet_address', 'wallet_name'],
    });

    // Create a set of configured wallet types
    const configuredTypes = new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type));

    // Build response with all crypto types and their configuration status
    const currencies = allCryptoTypes.map(crypto => ({
      type: crypto.type,
      name: crypto.name,
      symbol: crypto.symbol,
      configured: configuredTypes.has(crypto.type),
      wallet_address: configuredTypes.has(crypto.type) 
        ? (configuredWallets.find((w) => (w.dataValues as { wallet_type: string }).wallet_type === crypto.type)?.dataValues as { wallet_address?: string })?.wallet_address 
        : null,
    }));

    // Separate into configured and unconfigured
    const configuredCurrencies = currencies.filter(c => c.configured);
    const unconfiguredCurrencies = currencies.filter(c => !c.configured);

    return successResponseHelper(res, 200, "Configured currencies retrieved successfully", {
      company_id: parseInt(company_id),
      company_name: (company as { dataValues: Record<string, unknown> }).dataValues.company_name,
      total_available: allCryptoTypes.length,
      total_configured: configuredCurrencies.length,
      currencies: currencies,
      configured: configuredCurrencies.map(c => c.type),
      unconfigured: unconfiguredCurrencies.map(c => c.type),
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(errorMessage, {}, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};
