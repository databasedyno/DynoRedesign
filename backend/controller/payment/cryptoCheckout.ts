/**
 * Crypto checkout / payment-creation chain.
 * Extracted verbatim from paymentController.ts (no behavior change).
 * Contains: getData, Crypto, createCryptoPayment, confirmPayment.
 */
import express from "express";
import {
  PAYMENT_TIMING,
} from "./paymentConfig";
import { convertToUSD } from "./paymentHelpers";
import {
  currencyConvert,
  errorResponseHelper,
  getErrorMessage,
  sendAdminFeeReceivedEmail,
  successResponseHelper,
} from "../../helper";
import { apiLogger, cronLogger, webhookLogs } from "../../utils/loggers";
import {
  getRedisItem,
  setRedisItem,
  setRedisItemWithTTL,
  softDeleteRedisItem,
} from "../../utils/redisInstance";
import { formatAmountForDisplay, getCurrencyInfo, formatCryptoAmount } from "../../utils/currencyUtils";
import sequelize from "../../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import jwt from "jsonwebtoken";
import { normalizeLang } from "../../utils/emailI18n";
import {
  companyModel,
  customerTransactionModel,
  customerWalletModel,
  userWalletModel,
} from "../../models";
import { createNotification, NOTIFICATION_TYPES } from "../notificationController";
import {
  IFundData,
  IUserType,
  IVerifyResponse,
} from "../../utils/types";
import { paymentTypes } from "../../utils/enums";
import flw from "../../apis/flutterwaveApi";
import crypto from "crypto";
import axios from "axios";
import { getClientIP, getCountryFromIP, getCountryFromTimezone } from "../../utils/geolocation";
import { checkKycEnforcement } from "../../helper/kycEnforcement";
import { incrementAdminFee } from "../../helper/walletHelpers";
import { autoGenerateInvoice } from "../invoiceController";

import {
  userTempAddressModel,
  userTransactionModel,
  paymentLinkModel,
  merchantTempAddressModel,
} from "../../models";
import { generateQRCodeWithLogo } from "../../utils/qrCodeWithLogo";
import {
  getTransactionFee,
  getBlockchainFee,
  calculateTransactionFees,
} from "../../services/feeService";
import { 
  getBlockchainNetworkFee, 
} from "../../services/blockchainFeeService";
import * as merchantPoolService from "../../services/merchantPoolService";
import { getCryptoRedisKey } from "../../services/merchantPool/merchantPoolConfig";
import { isStablecoin } from "../../services/binanceService";
import { PaymentState, parseState, toRedisStatus } from "../../services/paymentStateMachine";

// ============================================
// CENTRALIZED TIMING CONFIGURATION
// ============================================
// All payment timing constants in one place for consistency
// These can be overridden by merchant settings in tbl_company

import { calculateTaxForCheckout } from "./taxService";
import { getLinkAccessToken, getAccessToken } from "./paymentTokens";
import {
  getDonationAggregates,
  getRecentSupporters,
  parsePresetAmounts,
} from "./paymentLinkController";

const getData = async (req: express.Request, res: express.Response) => {
  try {
    const { data, timezone } = req.body;  // Accept timezone hint from frontend

    // Validate data parameter is provided
    if (!data) {
      return errorResponseHelper(res, 400, "Payment reference is required");
    }

    // Define interface for incomplete payment data
    interface IncompletePaymentData {
      currency: string;
      address: string;
      pending_amount: number | string;
      timestamp: string | Date;
      qr_code?: string;
      destination_tag?: number | null; // XRP/RLUSD destination tag for tag-based chains
    }

    // Define interface for Redis payment item
    interface RedisPaymentItem {
      pathType?: string;
      company_id?: number;
      base_amount?: number;
      amount?: number;
      base_currency?: string;
      email?: string;
      transaction_id?: string;
      link_id?: number;
      description?: string;
      allowedModes?: string;
      fee_payer?: 'customer' | 'company';
      apply_tax?: boolean;
      expires_at?: string | Date;
      redirect_url?: string;
      callback_url?: string;
      webhook_url?: string;
      createdAt?: string | Date;
      customer_id?: string;
      incomplete_payment?: IncompletePaymentData;
      available_currencies?: string[] | string;  // Can be array or comma-separated string
      accepted_currencies?: string;
      customer_name?: string;  // Optional customer name
      language?: string;  // Customer's preferred language captured at checkout
      link_type?: string;  // 'standard' | 'donation' (campaign parent) | 'contribution'
    }

    const item = await getRedisItem("customer-" + data) as RedisPaymentItem | null;

    // Capture the customer's preferred language (sent by the checkout page) for localized emails.
    // Persisted on the customer session so it survives through to settlement.
    const rawLanguage = (req.body as { language?: string })?.language;
    if (item && rawLanguage) {
      const reqLanguage = normalizeLang(rawLanguage);
      if (item.language !== reqLanguage) {
        try {
          item.language = reqLanguage;
          await setRedisItem("customer-" + data, { ...item });
        } catch (e) {
          cronLogger.warn('[getData] Failed to persist customer language:', e);
        }
      }
    }

    // Only log for debugging when item exists or in development
    if (process.env.NODE_ENV === 'development' || (item && Object.keys(item).length > 0)) {
      cronLogger.info("[getData] Payment lookup:", { hasItem: !!item && Object.keys(item).length > 0, dataRef: data?.substring(0, 10) + '...' });
    }
    
    // Check if item exists
    if (!item || Object.keys(item).length === 0) {
      return errorResponseHelper(res, 404, "Payment link not found or expired");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DB STATUS CHECK: For already-completed payment links, return the actual
    // DB status so the checkout page can show "Payment Completed" instead of
    // the payment form. This covers Direct Pay links where the customer may
    // have paid without visiting checkout (the Redis status stays stale).
    // ═══════════════════════════════════════════════════════════════════════════
    // Donation campaign parents are multi-use — the "already completed" gate
    // below must never fire for them (children carry the actual payments).
    if (item.link_id && item.link_type !== 'donation') {
      try {
        const [dbLink] = await sequelize.query(
          `SELECT status, base_amount, base_currency, paid_amount, paid_currency, "updatedAt" FROM tbl_payment_link WHERE link_id = :linkId`,
          { replacements: { linkId: item.link_id }, type: QueryTypes.SELECT }
        ) as any[];

        // Treat the link as "completed" for the checkout page once the customer's
        // payment has been confirmed on-chain — regardless of the exact status
        // string persisted. Legacy flows store "successful"/"completed" while the
        // formal state machine stores confirmed/processing/converted/payout_complete.
        // Previously ONLY the literal "successful" matched, so links settled under a
        // different status kept showing the "awaiting payment" form after payment.
        if (dbLink) {
          const parsedState = parseState(dbLink.status);
          const COMPLETED_STATES = new Set<PaymentState>([
            PaymentState.CONFIRMED,
            PaymentState.PROCESSING,
            PaymentState.CONVERTED,
            PaymentState.PAYOUT_COMPLETE,
          ]);
          const isPaid =
            dbLink.status === 'successful' ||
            (parsedState !== undefined && COMPLETED_STATES.has(parsedState));

          if (isPaid) {
            // Pull display fields FROM THE DB (source of truth) — the Redis
            // customer session stores `amount`/`currency` in CRYPTO terms
            // (e.g. `amount: 0.00635942 ETH`), not the base fiat total. If we
            // pass those to the checkout page it renders "Total 0.01" (dust)
            // instead of "$10 USD paid". Fall back to Redis fields only when
            // the DB row is unexpectedly missing them.
            const baseAmountForDisplay = Number(
              (dbLink as any).base_amount ?? item.base_amount ?? item.amount ?? 0,
            );
            const baseCurrencyForDisplay =
              (dbLink as any).base_currency || item.base_currency || null;
            // `updatedAt` is when the payment settled (status flipped to
            // successful/confirmed/…). Returned so the checkout page can show
            // "Paid X days ago" — helps merchants disambiguate when they share
            // the same link across teammates.
            const paidAtForDisplay = (dbLink as any).updatedAt || null;
            return res.status(200).json({
              success: true,
              data: {
                payment_completed: true,
                status: 'successful',
                amount: baseAmountForDisplay,
                base_amount: baseAmountForDisplay,
                base_currency: baseCurrencyForDisplay,
                paid_amount: dbLink.paid_amount,
                paid_currency: dbLink.paid_currency,
                paid_at: paidAtForDisplay,
                description: item.description || null,
                redirect_url: item.redirect_url || null,
              },
            });
          }
        }
      } catch (dbErr) {
        cronLogger.warn('[getData] DB status check failed:', dbErr);
        // Continue with normal flow if DB check fails
      }
    }
    
    // Get company info if company_id exists
    let companyInfo: Record<string, unknown> | null = null;
    let paymentSettings = {
      initial_window_minutes: PAYMENT_TIMING.CRYPTO_INVOICE_MINUTES,      // Default: 15 minutes to pay after selecting crypto
      grace_period_minutes: PAYMENT_TIMING.GRACE_PERIOD_MINUTES,        // Default: 30 minutes to complete partial payment
      overpayment_threshold_usd: 5,    // Default: $5 minimum overpayment to handle
      underpayment_threshold_usd: 1,   // Default: $1 maximum underpayment to accept as full payment
    };
    
    // Define company data interface
    interface CompanyDataValues {
      company_name?: string;
      photo?: string;
      grace_period_minutes?: number | string;
      overpayment_threshold_usd?: number | string;
      underpayment_threshold_usd?: number | string;
    }
    
    if (item.company_id) {
      try {
        const company = await companyModel.findByPk(item.company_id);
        if (company) {
          const companyData = (company as { dataValues: CompanyDataValues }).dataValues;
          companyInfo = {
            company_name: String(companyData.company_name || '') || null,
            company_logo: String(companyData.photo || '') || null,  // Only include if available
          };
          
          // Override defaults with company-specific settings if configured
          if (companyData.grace_period_minutes !== undefined && companyData.grace_period_minutes !== null) {
            paymentSettings.grace_period_minutes = Math.min(parseInt(String(companyData.grace_period_minutes)), 30); // Max 30 minutes
          }
          if (companyData.overpayment_threshold_usd !== undefined && companyData.overpayment_threshold_usd !== null) {
            paymentSettings.overpayment_threshold_usd = parseFloat(String(companyData.overpayment_threshold_usd));
          }
          if (companyData.underpayment_threshold_usd !== undefined && companyData.underpayment_threshold_usd !== null) {
            paymentSettings.underpayment_threshold_usd = parseFloat(String(companyData.underpayment_threshold_usd));
          }
        }
      } catch (companyError) {
        cronLogger.warn(`[getData] Failed to fetch company info:`, companyError);
      }
    }
    
    // Get fee configuration (internal calculation - not exposed to public)
    const transactionFeePercent = Number(process.env.TRANSACTION_FEE_PERCENT) || 1.5;
    const feeTiers = (await import("../../utils/feeConfigUtils")).getFeeTiers();
    const amount = Number(item.base_amount || item.amount || 0);
    
    // Find applicable fee tier based on amount
    let fixedFee = 0;
    for (const tier of feeTiers) {
      if (amount >= tier.min && (tier.max === null || amount <= tier.max)) {
        fixedFee = tier.fixed;
        break;
      }
    }
    
    // Calculate total processing fee (internal - details not exposed)
    // Total fees = transaction fee % + fixed fee + network fee
    const feeAmountPercent = (amount * transactionFeePercent) / 100;
    
    // Include blockchain network fee for consistency with getCurrencyRates
    let networkFeeUSD = 0;
    try {
      const networkFee = await getBlockchainNetworkFee('ETH'); // Use ETH as default for USD display
      networkFeeUSD = Number(networkFee.feeInUSD) || 0;
    } catch (e) {
      cronLogger.info('[getData] Could not fetch network fee, using 0');
    }
    
    const totalProcessingFee = parseFloat((feeAmountPercent + fixedFee + networkFeeUSD).toFixed(2));
    // totalWithFees calculated but not used - kept for reference
    
    // Calculate expiry countdown
    let expiryInfo: Record<string, unknown> | null = null;
    if (item.expires_at) {
      const expiresAt = new Date(item.expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      
      if (diffMs > 0) {
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        expiryInfo = {
          expires_at: item.expires_at,
          is_expired: false,
          countdown: {
            days,
            hours,
            minutes,
            seconds,
            formatted: `${days}d : ${hours.toString().padStart(2, '0')}h : ${minutes.toString().padStart(2, '0')}m : ${seconds.toString().padStart(2, '0')}s`
          }
        };
      } else {
        // Payment link has expired.
        // Donation campaigns render a friendly "campaign ended" state on the
        // checkout page instead of a hard error — fall through and let the
        // donation block below set campaign_closed.
        if (item.link_type !== 'donation') {
          cronLogger.info(`[getData] Payment link expired at ${item.expires_at}`);
          return errorResponseHelper(
            res, 
            410, 
            "This payment link has expired. Please contact the merchant for a new payment link."
          );
        }
        expiryInfo = {
          expires_at: item.expires_at,
          is_expired: true,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DONATION CAMPAIGN DATA: settings are read fresh from the DB (survives
    // edits) and progress is aggregated from completed contribution rows.
    // ═══════════════════════════════════════════════════════════════════════
    let donationInfo: Record<string, unknown> | null = null;
    if (item.link_type === 'donation' && item.link_id) {
      try {
        const [parentRow] = (await sequelize.query(
          `SELECT title, description, goal_amount, preset_amounts, min_amount, allow_custom_amount,
                  show_progress, show_supporters, auto_close_at_goal, campaign_image, base_currency, expires_at
           FROM tbl_payment_link WHERE link_id = :id AND link_type = 'donation'`,
          { replacements: { id: item.link_id }, type: QueryTypes.SELECT }
        )) as Array<Record<string, unknown>>;

        if (!parentRow) {
          return errorResponseHelper(res, 404, "Campaign not found or expired");
        }

        const agg = await getDonationAggregates(Number(item.link_id));
        const goal = parentRow.goal_amount != null ? Number(parentRow.goal_amount) : null;
        const goalReached = Boolean(parentRow.auto_close_at_goal) && goal != null && goal > 0 && agg.raised_amount >= goal;
        const campaignExpired = Boolean(
          parentRow.expires_at && new Date(parentRow.expires_at as string) <= new Date()
        );
        const showSupporters = parentRow.show_supporters !== false;
        const recentSupporters = showSupporters
          ? await getRecentSupporters(Number(item.link_id))
          : [];

        donationInfo = {
          title: parentRow.title || null,
          purpose: parentRow.description || null,
          campaign_image: parentRow.campaign_image || null,
          currency: parentRow.base_currency || item.base_currency || 'USD',
          goal_amount: goal,
          raised_amount: agg.raised_amount,
          supporters_count: agg.supporters_count,
          progress_percent:
            goal != null && goal > 0
              ? Math.min(100, Math.round((agg.raised_amount / goal) * 100))
              : null,
          min_amount: Number(parentRow.min_amount) > 0 ? Number(parentRow.min_amount) : 1,
          preset_amounts: parsePresetAmounts(parentRow.preset_amounts as string | null),
          allow_custom_amount: parentRow.allow_custom_amount !== false,
          show_progress: parentRow.show_progress !== false,
          show_supporters: showSupporters,
          campaign_closed: goalReached || campaignExpired,
          closed_reason: goalReached ? 'goal_reached' : campaignExpired ? 'expired' : null,
          recent_supporters: recentSupporters,
        };
      } catch (donationErr) {
        cronLogger.error('[getData] Failed to load donation campaign data:', donationErr);
        return errorResponseHelper(res, 500, "Unable to load campaign. Please try again.");
      }
    }
    
    // Generate order reference (format: PREFIX-YEAR-SEQUENCE)
    const orderReference = item.transaction_id 
      ? `INV-${new Date().getFullYear()}-${item.link_id || item.transaction_id.substring(0, 8).toUpperCase()}`
      : null;
    
    // Define tax info type
    interface TaxInfo {
      tax_enabled: boolean;
      tax_rate: number;
      tax_acronym?: string;
      tax_amount: number;
      country_code?: string;
      country_name?: string;
      country_detected?: boolean;
      subtotal: number;
      total: number;
      currency?: string;
      message?: string;
    }
    
    // Tax calculation - only if merchant enabled apply_tax
    let taxInfo: TaxInfo | null = null;
    if (item.apply_tax) {
      cronLogger.info(`[getData] Tax enabled for this payment link, detecting customer location...`);
      
      // Log all relevant headers for debugging
      cronLogger.info(`[getData] Headers received:`, {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'cf-ipcountry': req.headers['cf-ipcountry'],
        'true-client-ip': req.headers['true-client-ip'],
        'x-client-ip': req.headers['x-client-ip'],
      });
      cronLogger.info(`[getData] Timezone hint from frontend: ${timezone || 'not provided'}`);
      
      // Get customer IP and detect country
      const clientIP = getClientIP(req);
      cronLogger.info(`[getData] Customer IP: ${clientIP}`);
      
      // Check if IP is localhost/private (unreliable for geolocation)
      const isPrivateIP = clientIP === '127.0.0.1' || 
                          clientIP === 'localhost' ||
                          clientIP.startsWith('192.168.') ||
                          clientIP.startsWith('10.') ||
                          clientIP.startsWith('172.') ||
                          clientIP === '::1';
      
      let geoLocation = null;
      
      // If timezone is provided and IP is private/localhost, prefer timezone
      if (timezone && isPrivateIP) {
        cronLogger.info(`[getData] Private/localhost IP detected (${clientIP}), using timezone: ${timezone}`);
        geoLocation = getCountryFromTimezone(timezone);
      } else {
        // Try IP-based geolocation first
        geoLocation = await getCountryFromIP(clientIP, req.headers);
        
        // If IP detection failed or returned unreliable result, and timezone provided, use timezone
        if ((!geoLocation || !geoLocation.country_code) && timezone) {
          cronLogger.info(`[getData] IP detection failed, trying timezone fallback: ${timezone}`);
          geoLocation = getCountryFromTimezone(timezone);
        }
      }
      
      if (geoLocation && geoLocation.country_code) {
        cronLogger.info(`[getData] Detected country: ${geoLocation.country_name} (${geoLocation.country_code}) via ${geoLocation.source || 'ip'}`);
        
        // Calculate tax based on detected country
        taxInfo = await calculateTaxForCheckout(
          geoLocation.country_code,
          amount,
          item.base_currency
        );
        
        if (taxInfo) {
          cronLogger.info(`[getData] Tax calculated: ${taxInfo.tax_rate}% ${taxInfo.tax_acronym} = ${taxInfo.tax_amount} ${taxInfo.currency}`);
        }
      } else {
        cronLogger.info(`[getData] Could not detect customer country, tax not applied`);
        taxInfo = {
          tax_enabled: true,
          country_detected: false,
          tax_rate: 0,
          tax_amount: 0,
          subtotal: amount,
          total: amount,
          currency: item.base_currency,
          message: "Country could not be detected. Please ensure your browser allows timezone detection."
        };
      }
    }
    
    // Calculate grand total including tax (if applicable)
    const taxAmount = taxInfo?.tax_amount || 0;
    // Total should ALWAYS include tax, regardless of fee_payer
    // For customer pays fees: Don't include processing fee in total_amount yet
    // The exact fee depends on selected crypto and will be calculated by getCurrencyRates
    const subtotalWithTax = amount + taxAmount;
    // grandTotal calculated but not used - kept for reference: amount + totalProcessingFee + taxAmount
    
    // ── Store calculated tax info back to Redis for addPayment to use ──
    // This prevents addPayment from re-deriving tax from IP (which could differ due to VPN/proxy changes)
    if (taxInfo && taxInfo.tax_amount > 0) {
      try {
        await setRedisItem("customer-" + data, {
          ...item,
          _cached_tax_info: taxInfo,
          _cached_tax_amount: taxAmount,
        });
      } catch (e) {
        cronLogger.warn('[getData] Failed to cache tax info in Redis:', e);
      }
    }
    
    // Convert incomplete payment amount to USD if exists
    let incompletePaymentUSD = 0;
    if (item.incomplete_payment?.pending_amount && item.incomplete_payment?.currency) {
      const converted = await convertToUSD(
        Number(item.incomplete_payment.pending_amount),
        item.incomplete_payment.currency
      );
      incompletePaymentUSD = isNaN(converted) ? 0 : converted;
    }
    
    let payload;
    
    // Parse available_currencies for frontend display
    let availableCurrenciesList: string[] = [];
    if (item.available_currencies) {
      if (Array.isArray(item.available_currencies)) {
        availableCurrenciesList = item.available_currencies;
      } else if (typeof item.available_currencies === 'string') {
        availableCurrenciesList = item.available_currencies.split(',').map((c: string) => c.trim());
      }
    }
    
    // Also check accepted_currencies from payment link record if available_currencies is empty
    if (availableCurrenciesList.length === 0 && item.accepted_currencies) {
      if (typeof item.accepted_currencies === 'string') {
        availableCurrenciesList = item.accepted_currencies.split(',').map((c: string) => c.trim());
      }
    }
    
    // Normalize USDC-ERC20 → USDC for checkout frontend compatibility
    // Checkout only has "USDC" in its cryptoOptions (no network selection for USDC)
    availableCurrenciesList = [...new Set(availableCurrenciesList.map(c => c === 'USDC-ERC20' ? 'USDC' : c))];
    
    if (item.pathType === "createLink") {
      payload = {
        amount: amount, // Use the converted number instead of item.base_amount
        base_currency: item.base_currency,
        token: await getLinkAccessToken(
          item.email,
          data,
          item.pathType,
          item.transaction_id
        ),
        payment_mode: item.pathType,
        allowedModes: item.allowedModes,
        fee_payer: item.fee_payer || 'company',
        // Customer name - displayed on checkout page if provided
        ...(item.customer_name && { customer_name: item.customer_name }),
        // Enhanced checkout data
        transaction_id: item.transaction_id,
        order_reference: orderReference,
        description: item.description || null,
        merchant: companyInfo,
        // Payment timing settings - passed upfront for checkout to display
        payment_settings: paymentSettings,
        // Available currencies - filtered by merchant's accepted_currencies selection
        // If empty, frontend should call /configured-currencies endpoint
        ...(availableCurrenciesList.length > 0 && { available_currencies: availableCurrenciesList }),
        // Simplified fee info - always include subtotal and total with tax
        fee_info: {
          fee_payer: item.fee_payer || 'company',
          subtotal: parseFloat(amount.toFixed(2)),
          tax_amount: parseFloat(taxAmount.toFixed(2)),
          // Total always includes tax, regardless of fee_payer
          total_amount: parseFloat(subtotalWithTax.toFixed(2)),
          // For customer pays fees: show estimated processing fee
          ...(item.fee_payer === 'customer' && {
            // Processing fee is ESTIMATED - actual fee depends on selected cryptocurrency
            // Frontend should call getCurrencyRates after crypto selection to get exact fee
            estimated_processing_fee: parseFloat(totalProcessingFee.toFixed(2)),
            fees_pending_crypto_selection: true, // Flag to indicate fee is estimated
          }),
          // For company pays fees: NO processing_fee returned (hidden from customer)
        },
        expiry: expiryInfo,
        created_at: item.createdAt || new Date().toISOString(),
        // Post-payment settings - redirect_url for customer redirection after payment
        // Only include if configured (callback_url and webhook_url are backend-only for security)
        ...(item.redirect_url && { redirect_url: item.redirect_url }),
        // Tax information - only included if merchant enabled apply_tax
        apply_tax: item.apply_tax || false,
        ...(taxInfo && { tax_info: taxInfo }),
        // PHASE 12: Include incomplete payment info if exists (for currency lock on frontend)
        ...(item.incomplete_payment && {
          incomplete_payment: {
            exists: true,
            currency: item.incomplete_payment.currency,
            address: item.incomplete_payment.address,
            pending_amount: item.incomplete_payment.pending_amount,
            pending_usd: incompletePaymentUSD, // Properly converted to USD
            timestamp: item.incomplete_payment.timestamp,
            remaining_minutes: Math.max(0, Math.ceil((new Date(item.incomplete_payment.timestamp).getTime() + paymentSettings.grace_period_minutes * 60 * 1000 - Date.now()) / 60000)),
            qr_code: item.incomplete_payment.qr_code,
            // XRP/RLUSD: Include destination tag for tag-based chains
            ...(item.incomplete_payment.destination_tag && { destination_tag: Number(item.incomplete_payment.destination_tag) }),
            ...(item.incomplete_payment.destination_tag && { memo: String(item.incomplete_payment.destination_tag) }),
          }
        }),
        // ── Donation campaign block (multi-use links; checkout renders the
        //    campaign view and calls /pay/startDonation to begin a payment) ──
        ...(donationInfo && { is_donation: true, donation: donationInfo }),
      };
    } else {
      // Validate customer_id exists before calling getAccessToken
      if (!item.customer_id) {
        cronLogger.warn(`[getData] Missing customer_id for non-createLink payment:`, item);
        // Try to use link-style token generation as fallback
        payload = {
          amount: item.amount || item.base_amount,
          base_currency: item.base_currency,
          token: await getLinkAccessToken(
            item.email,
            data,
            item.pathType || 'payment',
            item.transaction_id
          ),
          payment_mode: item.pathType,
          fee_payer: item.fee_payer || 'company',
          // Enhanced checkout data
          transaction_id: item.transaction_id,
          order_reference: orderReference,
          description: item.description || null,
          merchant: companyInfo,
          // Payment timing settings - passed upfront for checkout to display
          payment_settings: paymentSettings,
          // Available currencies - filtered by merchant's accepted_currencies selection
          ...(availableCurrenciesList.length > 0 && { available_currencies: availableCurrenciesList }),
          // Simplified fee info - no internal breakdown exposed
          fee_info: {
            fee_payer: item.fee_payer || 'company',
            ...(item.fee_payer === 'customer' && {
              estimated_processing_fee: parseFloat(totalProcessingFee.toFixed(2)),
              fees_pending_crypto_selection: true,
              subtotal: parseFloat(amount.toFixed(2)),
              tax_amount: parseFloat(taxAmount.toFixed(2)),
              total_amount: parseFloat(subtotalWithTax.toFixed(2)),
            })
          },
          expiry: expiryInfo,
          // Post-payment settings - redirect_url for customer redirection after payment
          ...(item.redirect_url && { redirect_url: item.redirect_url }),
          // Tax information
          apply_tax: item.apply_tax || false,
          ...(taxInfo && { tax_info: taxInfo }),
          // PHASE 12: Include incomplete payment info if exists
          ...(item.incomplete_payment && {
            incomplete_payment: {
              exists: true,
              currency: item.incomplete_payment.currency,
              address: item.incomplete_payment.address,
              pending_amount: item.incomplete_payment.pending_amount,
              pending_usd: incompletePaymentUSD, // Properly converted to USD
              timestamp: item.incomplete_payment.timestamp,
              remaining_minutes: Math.max(0, Math.ceil((new Date(item.incomplete_payment.timestamp).getTime() + paymentSettings.grace_period_minutes * 60 * 1000 - Date.now()) / 60000)),
              qr_code: item.incomplete_payment.qr_code,
              // XRP/RLUSD: Include destination tag for tag-based chains
              ...(item.incomplete_payment.destination_tag && { destination_tag: Number(item.incomplete_payment.destination_tag) }),
            ...(item.incomplete_payment.destination_tag && { memo: String(item.incomplete_payment.destination_tag) }),
            }
          }),
        };
      } else {
        payload = {
          amount: item.amount,
          base_currency: item.base_currency,
          token: await getAccessToken(item.customer_id, data),
          payment_mode: item.pathType,
          fee_payer: item.fee_payer || 'company',
          // Enhanced checkout data
          transaction_id: item.transaction_id,
          order_reference: orderReference,
          description: item.description || null,
          merchant: companyInfo,
          // Payment timing settings - passed upfront for checkout to display
          payment_settings: paymentSettings,
          // Available currencies - filtered by merchant's accepted_currencies selection
          ...(availableCurrenciesList.length > 0 && { available_currencies: availableCurrenciesList }),
          // Simplified fee info - no internal breakdown exposed
          fee_info: {
            fee_payer: item.fee_payer || 'company',
            ...(item.fee_payer === 'customer' && {
              estimated_processing_fee: parseFloat(totalProcessingFee.toFixed(2)),
              fees_pending_crypto_selection: true,
              subtotal: parseFloat(amount.toFixed(2)),
              tax_amount: parseFloat(taxAmount.toFixed(2)),
              total_amount: parseFloat(subtotalWithTax.toFixed(2)),
            })
          },
          expiry: expiryInfo,
          // Post-payment settings - redirect_url for customer redirection after payment
          ...(item.redirect_url && { redirect_url: item.redirect_url }),
          // Tax information
          apply_tax: item.apply_tax || false,
          ...(taxInfo && { tax_info: taxInfo }),
          // PHASE 12: Include incomplete payment info if exists
          ...(item.incomplete_payment && {
            incomplete_payment: {
              exists: true,
              currency: item.incomplete_payment.currency,
              address: item.incomplete_payment.address,
              pending_amount: item.incomplete_payment.pending_amount,
              pending_usd: incompletePaymentUSD, // Properly converted to USD
              timestamp: item.incomplete_payment.timestamp,
              remaining_minutes: Math.max(0, Math.ceil((new Date(item.incomplete_payment.timestamp).getTime() + paymentSettings.grace_period_minutes * 60 * 1000 - Date.now()) / 60000)),
              qr_code: item.incomplete_payment.qr_code,
              // XRP/RLUSD: Include destination tag for tag-based chains
              ...(item.incomplete_payment.destination_tag && { destination_tag: Number(item.incomplete_payment.destination_tag) }),
            ...(item.incomplete_payment.destination_tag && { memo: String(item.incomplete_payment.destination_tag) }),
            }
          }),
        };
      }
    }

    cronLogger.info(payload);
    successResponseHelper(res, 200, "Payment link details retrieved successfully", payload);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, new Error(e));
    errorResponseHelper(res, 404, "Sorry! No transaction found");
  }
};

const Crypto = async (
  data: IFundData,
  tokenData: IUserType,
  onlyCrypto = false
) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const currency = data.currency;
  const userId = tokenData.adm_id;
  const companyId = tokenData.company_id;
  
  // Supported merchant pool crypto types
  const MERCHANT_POOL_CRYPTO_TYPES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
  
  // Use merchant pool for supported currencies
  if (MERCHANT_POOL_CRYPTO_TYPES.includes(currency)) {
    cronLogger.info(`[Crypto] Using MERCHANT POOL for ${currency} payment`);
    cronLogger.info(`[Crypto]   - Merchant (user_id): ${userId}`);
    cronLogger.info(`[Crypto]   - Company: ${companyId}`);
    
    // Validate IDs
    if (!userId || isNaN(Number(userId))) {
      throw { message: "Invalid user ID for payment" };
    }
    
    // Validate and parse company_id - it can be null but not NaN
    const parsedCompanyId = companyId ? parseInt(String(companyId)) : null;
    if (companyId && isNaN(parsedCompanyId as number)) {
      throw { message: "Invalid company ID for payment" };
    }
    
    // Generate unique payment ID
    const paymentId = crypto.randomUUID();
    
    // Reserve address from merchant's pool
    // Check if a Direct Pay address was pre-reserved during payment link creation
    // If so, use that SAME address to keep consistency between the QR shown to merchant and the checkout
    let poolAddressResult;
    if (data.direct_pay_temp_id) {
      cronLogger.info(`[Crypto] Checking Direct Pay pre-reserved address (temp_id: ${data.direct_pay_temp_id}, expected chain: ${currency})`);
      const preReservedAddr = await merchantTempAddressModel.findOne({
        where: {
          temp_address_id: data.direct_pay_temp_id,
          owner_user_id: Number(userId),
          wallet_type: currency,
        }
      });
      if (preReservedAddr && (preReservedAddr.dataValues.status === 'RESERVED' || preReservedAddr.dataValues.status === 'PRE_RESERVED')) {
        // Update with the new payment ID
        await preReservedAddr.update({
          current_payment_id: paymentId,
          status: 'RESERVED',
          reserved_at: new Date(),
        });
        poolAddressResult = preReservedAddr;
        cronLogger.info(`[Crypto] ✅ Re-used Direct Pay address: ${preReservedAddr.dataValues.wallet_address}`);
      } else {
        cronLogger.warn(`[Crypto] Pre-reserved address not found or not available, falling back to normal reservation`);
        poolAddressResult = await merchantPoolService.reserveAddress(
          currency,
          paymentId,
          Number(userId),
          parsedCompanyId || 0,
          Number(data.amount) || 0
        );
      }
    } else {
      // Normal flow: reserve a new address from the pool
      // This will:
      // 1. Create merchant's xpub if not exists (lazy initialization)
      // 2. Initialize pool if empty
      // 3. Find available address with highest admin_fee_balance
      // 4. Reserve it for this payment
      poolAddressResult = await merchantPoolService.reserveAddress(
        currency,
        paymentId,
        Number(userId),
        parsedCompanyId || 0,
        Number(data.amount) || 0
      );
    }
    const poolAddress = poolAddressResult as { dataValues: { wallet_address: string; temp_address_id: number; destination_tag?: number; cached_qr_code?: string } };
    
    const address = poolAddress.dataValues.wallet_address;
    const destinationTag = poolAddress.dataValues.destination_tag || null;
    const cachedQR = poolAddress.dataValues.cached_qr_code;
    cronLogger.info(`[Crypto] ✅ Reserved merchant pool address: ${address}${destinationTag ? ` (tag: ${destinationTag})` : ''} (QR cached: ${!!cachedQR})`);
    
    // PERF: Use pre-generated QR from pool DB if available (saves ~250ms sharp processing)
    // Fallback to generation only if cache miss (first-time addresses before pre-warm ran)
    let qr_code: string | undefined;
    let walletId: number | null = null;

    if (cachedQR) {
      // QR already cached — just do wallet lookup (fast, ~50-95ms)
      const merchantWalletLookup: Record<string, unknown> = {
        user_id: Number(userId),
        wallet_type: currency,
      };
      if (companyId && !isNaN(Number(companyId))) {
        merchantWalletLookup.company_id = Number(companyId);
      }
      const walletDetails = await userWalletModel.findOne({ where: merchantWalletLookup });
      walletId = walletDetails?.dataValues.wallet_id ? Number(walletDetails.dataValues.wallet_id) : null;
      qr_code = cachedQR;
    } else {
      // Cache miss — parallelize QR generation + wallet lookup (existing optimization)
      const merchantWalletLookup: Record<string, unknown> = {
        user_id: Number(userId),
        wallet_type: currency,
      };
      if (companyId && !isNaN(Number(companyId))) {
        merchantWalletLookup.company_id = Number(companyId);
      }
      const qrPayload = address ? (destinationTag ? `${address}?dt=${destinationTag}` : address) : null;
      const [qrResult, walletDetails] = await Promise.all([
        qrPayload ? generateQRCodeWithLogo(qrPayload, currency, 400) : Promise.resolve(undefined),
        userWalletModel.findOne({ where: merchantWalletLookup }),
      ]);
      qr_code = qrResult;
      walletId = walletDetails?.dataValues.wallet_id ? Number(walletDetails.dataValues.wallet_id) : null;
      
      // Cache the generated QR for next time (fire-and-forget)
      if (qr_code && address) {
        merchantTempAddressModel.update(
          { cached_qr_code: qr_code },
          { where: { wallet_address: address, ...(destinationTag ? { destination_tag: destinationTag } : {}) } }
        ).catch(() => {/* non-critical */});
      }
    }
    
    // PERF: Defer DB transaction create to post-response (saves ~125ms on critical path)
    // Transaction record is needed for bookkeeping but not for payment flow — webhook uses Redis data
    const userPayload = {
      id: paymentId,
      wallet_id: walletId,
      user_id: Number(userId),
      payment_mode: "CRYPTO",
      base_amount: isNaN(Number(data.amount)) ? 0 : Number(data.amount),
      base_currency: currency,
      transaction_type: "CREDIT",
      status: "pending",
      customer_id: (tokenData.customer_id && !isNaN(Number(tokenData.customer_id))) ? Number(tokenData.customer_id) : null,
      company_id: (companyId && !isNaN(Number(companyId))) ? Number(companyId) : null,
      // FIX: Populate crypto fields at creation time so records are complete even if verification fails
      crypto_currency: currency,
      crypto_amount: isNaN(Number(data.amount)) ? 0 : Number(data.amount),
    };
    cronLogger.info("[Crypto] Merchant pool userPayload:", JSON.stringify(userPayload));
    
    // Fire-and-forget: DB write happens in background (~125ms saved from critical path)
    userTransactionModel.create({ ...userPayload }).catch((err: unknown) => {
      cronLogger.error("[Crypto] Deferred transaction create failed:", (err as Error).message);
    });
    
    const paymentRes = {
      qr_code,
      address: address,
      destination_tag: destinationTag,
      // XRP/RLUSD: Return memo field (string form of destination_tag) for checkout display
      ...(destinationTag && { memo: String(destinationTag) }),
      transaction_id: paymentId,
      temp_id: poolAddress.dataValues.temp_address_id,
      is_merchant_pool: true,  // Flag to identify merchant pool address
    };
    
    return { paymentRes, uniqueRef };
  }
  
  // ALL payments must go through merchant pool — no legacy admin wallet fallback
  // If we reach here, the currency is not in MERCHANT_POOL_CRYPTO_TYPES
  cronLogger.error(`[Crypto] ❌ REJECTED: ${currency} is not supported by merchant pool. Legacy admin wallet system is disabled.`);
  cronLogger.error(`[Crypto]   Supported currencies: ${MERCHANT_POOL_CRYPTO_TYPES.join(', ')}`);
  throw { 
    message: `${currency} is not currently supported for payments. Supported currencies: ${MERCHANT_POOL_CRYPTO_TYPES.join(', ')}`,
    status: 400
  };
};


const createCryptoPayment = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const DEBUG = process.env.DEBUG_MODE === 'true';
  if (DEBUG) cronLogger.info('[DEBUG] Step 1: JWT decoded successfully');
  
  try {
    const data: IFundData = req.body;
    if (DEBUG) cronLogger.info('[DEBUG] Step 2: Request body parsed:', { uniqueRef: data?.uniqueRef, currency: data?.currency });
    
    if (data) {
      let finalRes;
      
      // NORMALIZE: Ensure uniqueRef always uses "customer-" prefix for consistent Redis key lookups
      // Normal flow passes "customer-{ref}", Legacy API passes just "{transactionId}"
      const rawRef = data.uniqueRef;
      const normalizedRef = rawRef.startsWith("customer-") ? rawRef : "customer-" + rawRef;
      
      if (DEBUG) cronLogger.info('[DEBUG] Step 3: About to call getRedisItem with key:', normalizedRef);
      
      const items = await getRedisItem(normalizedRef);
      
      if (DEBUG) cronLogger.info('[DEBUG] Step 4: Redis item retrieved successfully:', { adm_id: items?.adm_id, company_id: items?.company_id });

      // ========================================
      // PERF: Start KYC check as a promise immediately — awaited after validation checks
      // This runs in parallel with expiry/currency validation (~100ms saved)
      // ========================================
      const merchantUserId = items?.adm_id;
      const merchantCompanyId = items?.company_id;
      const kycPromise = merchantUserId
        ? checkKycEnforcement(merchantUserId, merchantCompanyId, '[KYC - Checkout]')
        : Promise.resolve({ blocked: false });

      // Check if payment link has expired (instant, no I/O)
      if (items.expires_at) {
        const expiresAt = new Date(items.expires_at);
        const now = new Date();
        if (expiresAt.getTime() <= now.getTime()) {
          cronLogger.info(`[Expiry Check] Payment link expired at ${items.expires_at}, current time: ${now.toISOString()}`);
          return errorResponseHelper(
            res,
            410,
            "This payment link has expired and can no longer be used for payments."
          );
        }
        cronLogger.info(`[Expiry Check] Payment link valid until ${items.expires_at}`);
      }

      // Phase 11: Validate requested currency is in available_currencies list
      let requestedCurrency = data.currency;
      
      // Normalize checkout currency aliases to internal wallet types
      // Checkout sends "USDC" but wallets are stored as "USDC-ERC20"
      // Checkout sends "RLUSD-XRPL" but wallets are stored as "RLUSD"
      const currencyAliasMap: Record<string, string> = {
        'USDC': 'USDC-ERC20',
        'RLUSD-XRPL': 'RLUSD',
      };
      const internalCurrency = currencyAliasMap[requestedCurrency] || requestedCurrency;
      
      // Parse available_currencies - could be array or comma-separated string from Redis
      let availableCurrenciesList: string[] = [];
      if (items.available_currencies) {
        if (Array.isArray(items.available_currencies)) {
          availableCurrenciesList = items.available_currencies;
        } else if (typeof items.available_currencies === 'string') {
          availableCurrenciesList = items.available_currencies.split(',').map((c: string) => c.trim());
        }
      }
      
      if (availableCurrenciesList.length > 0) {
        // Check both the original and internal currency names for validation
        if (!availableCurrenciesList.includes(requestedCurrency) && !availableCurrenciesList.includes(internalCurrency)) {
          cronLogger.info(`[Phase 11] Currency ${requestedCurrency} (internal: ${internalCurrency}) not in available list:`, availableCurrenciesList);
          return errorResponseHelper(
            res,
            400,
            `${requestedCurrency} is not available for this payment. Available currencies: ${availableCurrenciesList.join(', ')}`
          );
        }
        cronLogger.info(`[Phase 11] Currency ${requestedCurrency} (internal: ${internalCurrency}) validated against available list:`, availableCurrenciesList);
      }
      
      // Use internal currency name for wallet lookup and payment processing
      requestedCurrency = internalCurrency;

      // PHASE 12: Check for existing incomplete payment - prevent currency switching
      // This ensures customer completes partial payment on same currency before switching
      if (items.incomplete_payment) {
        const incompletePayment = items.incomplete_payment;
        const incompleteTimestamp = new Date(incompletePayment.timestamp);
        const gracePeriodMs = PAYMENT_TIMING.GRACE_PERIOD_MINUTES * 60 * 1000; // From centralized config
        const now = new Date();
        const graceExpiry = new Date(incompleteTimestamp.getTime() + gracePeriodMs);
        
        // Check if grace period has NOT expired
        if (now < graceExpiry) {
          const remainingMs = graceExpiry.getTime() - now.getTime();
          const remainingMinutes = Math.ceil(remainingMs / 60000);
          
          // If trying to switch to DIFFERENT currency - BLOCK
          if (incompletePayment.currency !== requestedCurrency) {
            cronLogger.info(`[Phase 12] ❌ Blocking currency switch: Incomplete ${incompletePayment.currency} payment exists, requested ${requestedCurrency}`);
            return errorResponseHelper(
              res,
              400,
              `You have an incomplete payment of ${formatCryptoAmount(incompletePayment.pending_amount, incompletePayment.currency)} ${incompletePayment.currency}. ` +
              `Please complete it or wait for expiry (${remainingMinutes} minutes remaining) before switching currencies.`
            );
          }
          
          // If SAME currency - return existing address info (don't create new)
          cronLogger.info(`[Phase 12] ✓ Same currency requested, returning existing incomplete payment address`);
          return successResponseHelper(res, 200, "Continue existing payment", {
            address: incompletePayment.address,
            amount: incompletePayment.pending_amount,
            currency: incompletePayment.currency,
            qr_code: incompletePayment.qr_code,
            remaining_minutes: remainingMinutes,
            is_continuation: true,
            // XRP/RLUSD: Include destination tag for tag-based chains
            ...(incompletePayment.destination_tag && { destination_tag: Number(incompletePayment.destination_tag) }),
            message: `You have ${remainingMinutes} minutes to complete your payment of ${formatCryptoAmount(incompletePayment.pending_amount, incompletePayment.currency)} ${incompletePayment.currency}`
          });
        } else {
          // Grace period expired - clear incomplete payment info and allow new payment
          cronLogger.info(`[Phase 12] Grace period expired for incomplete payment, clearing and allowing new payment`);
          const updatedItems = { ...items };
          delete updatedItems.incomplete_payment;
          await setRedisItem("customer-" + data.uniqueRef, updatedItems);
        }
      }

      // PHASE 12.1: Check if an address already exists for this payment link + currency combination
      // This prevents generating multiple addresses for the same payment link when customer refreshes page
      if (items.active_crypto_address && items.active_crypto_address.currency === requestedCurrency) {
        const existingAddress = items.active_crypto_address.address;
        const existingDestTag = items.active_crypto_address.destination_tag ? Number(items.active_crypto_address.destination_tag) : null;
        const existingRedisData = await getRedisItem(getCryptoRedisKey(existingAddress, existingDestTag));
        
        // Only return existing address if it's still pending (not completed/expired)
        if (existingRedisData && parseState(existingRedisData.status) === PaymentState.PENDING) {
          cronLogger.info(`[Phase 12.1] ✓ Returning existing address for same payment link + currency: ${existingAddress}${existingDestTag ? ` (tag: ${existingDestTag})` : ''}`);
          return successResponseHelper(res, 200, "Using existing payment address", {
            qr_code: items.active_crypto_address.qr_code,
            address: existingAddress,
            // XRP/RLUSD: Include destination tag for tag-based chains
            ...(existingDestTag && { destination_tag: existingDestTag }),
            ...(existingDestTag && { memo: String(existingDestTag) }),
            transaction_id: existingRedisData.payment_id || existingRedisData.unique_tx_id,
            amount: existingRedisData.amount,
            currency: requestedCurrency,
            merchant_amount: existingRedisData.merchant_amount,
            fee_payer: existingRedisData.fee_payer,
            is_existing_address: true,
            message: `Payment address already generated. Send ${existingRedisData.amount} ${requestedCurrency} to complete payment.`
          });
        } else {
          // Address exists but status changed (completed/expired) - clear and generate new
          cronLogger.info(`[Phase 12.1] Existing address status changed, clearing active_crypto_address`);
          const updatedItems = { ...items };
          delete updatedItems.active_crypto_address;
          await setRedisItem("customer-" + data.uniqueRef, updatedItems);
        }
      } else if (items.active_crypto_address && items.active_crypto_address.currency !== requestedCurrency) {
        // User is switching to a DIFFERENT currency (allowed since no incomplete_payment)
        // Clear the old active_crypto_address since they're changing currency
        cronLogger.info(`[Phase 12.1] User switching from ${items.active_crypto_address.currency} to ${requestedCurrency}, clearing old active_crypto_address`);
        const updatedItemsForSwitch = { ...items };
        delete updatedItemsForSwitch.active_crypto_address;
        await setRedisItem("customer-" + data.uniqueRef, updatedItemsForSwitch);
      }

      // Phase 10 Task 10.3: Validate currency is configured using userWalletModel
      // ========================================
      // PERF: Await KYC check here (started in parallel above) — saves ~100ms
      // ========================================
      const kycResult = await kycPromise;
      if (kycResult.blocked) {
        return errorResponseHelper(
          res,
          503,
          "This payment cannot be processed at this time. The merchant's account requires verification. Please contact the merchant for assistance. [MERCHANT_KYC_REQUIRED]"
        );
      }

      cronLogger.info(`[Phase 10 Validation] Checking wallet for currency: ${requestedCurrency}, user_id: ${items.adm_id}, company_id: ${items.company_id}`);
      
      // Parse user_id safely
      const userId = parseInt(items.adm_id);
      if (isNaN(userId)) {
        return errorResponseHelper(res, 400, "Invalid user ID");
      }

      // ═══════════════════════════════════════════════════════════════════
      // PERF FIX 2: Cached wallet validation (~100ms saved on cache hit)
      // Merchant wallets rarely change; cache for 5 minutes
      // ═══════════════════════════════════════════════════════════════════
      const hasCompanyId = items.company_id && items.company_id !== '' && items.company_id !== 'undefined' && items.company_id !== 'null';
      const walletCacheKey = `wallet-cache:${userId}:${requestedCurrency}:${hasCompanyId ? items.company_id : 'none'}`;
      
      let hasWallet: { dataValues: Record<string, unknown> } | null = null;
      let walletCacheHit = false;
      
      // Try cache first
      try {
        const cachedWallet = await getRedisItem(walletCacheKey);
        if (cachedWallet && cachedWallet._walletFound !== undefined) {
          if (cachedWallet._walletFound) {
            hasWallet = { dataValues: cachedWallet };
            walletCacheHit = true;
            // Restore company_id if it was resolved from default company
            if (cachedWallet._resolvedCompanyId && !hasCompanyId) {
              items.company_id = cachedWallet._resolvedCompanyId;
            }
            cronLogger.info(`[Phase 10 Validation] ⚡ Wallet cache HIT for ${walletCacheKey}`);
          } else {
            // Cached as "not found" — skip DB query
            walletCacheHit = true;
            hasWallet = null;
            cronLogger.info(`[Phase 10 Validation] ⚡ Wallet cache HIT (not found) for ${walletCacheKey}`);
          }
        }
      } catch (_cacheErr) { /* Cache miss or error — proceed to DB */ }
      
      if (!walletCacheHit) {
        // DB lookup (original logic preserved exactly)
        const whereClause: Record<string, unknown> = {
          user_id: userId,
          wallet_type: requestedCurrency,
          wallet_address: { [Op.not]: null },
        };
      
        if (hasCompanyId) {
          const companyId = parseInt(items.company_id);
          if (!isNaN(companyId)) {
            whereClause.company_id = companyId;
          }
          cronLogger.info('[Phase 10 Validation] Where clause (with company_id):', JSON.stringify(whereClause));
          hasWallet = await userWalletModel.findOne({ where: whereClause });
        
          if (!hasWallet) {
            cronLogger.error(`[Phase 10 Validation] ❌ MULTI-TENANT: No wallet found for company_id ${whereClause.company_id}. NOT falling back.`);
            // Cache negative result for 60s (shorter TTL for negative cache)
            setRedisItemWithTTL(walletCacheKey, { _walletFound: false }, 60).catch(() => {});
            return errorResponseHelper(
              res,
              400,
              `No wallet address configured for ${requestedCurrency} in this company. Please add a ${requestedCurrency} wallet for this company first.`
            );
          }
        } else {
          cronLogger.info('[Phase 10 Validation] No company_id provided, searching with null company_id');
          whereClause.company_id = null;
          cronLogger.info('[Phase 10 Validation] Where clause (null company_id):', JSON.stringify(whereClause));
          hasWallet = await userWalletModel.findOne({ where: whereClause });
        
          if (!hasWallet) {
            cronLogger.info('[Phase 10 Validation] No null company_id wallet, finding user default company');
            const admIdInt = parseInt(String(items.adm_id), 10);
            if (isNaN(admIdInt)) {
              return errorResponseHelper(res, 400, "Invalid admin user ID");
            }
            const userCompany = await companyModel.findOne({
              where: { user_id: admIdInt },
              order: [['createdAt', 'ASC']]
            });
          
            if (userCompany) {
              whereClause.company_id = userCompany.dataValues.company_id;
              cronLogger.info('[Phase 10 Validation] Using default company_id:', whereClause.company_id);
              hasWallet = await userWalletModel.findOne({ where: whereClause });
            
              if (hasWallet) {
                items.company_id = userCompany.dataValues.company_id;
                cronLogger.info('[Phase 10 Validation] Found wallet with default company_id:', items.company_id);
              }
            }
          }
        }
        
        // Cache the result (5 min for positive, 60s for negative)
        if (hasWallet) {
          const cacheData = { ...hasWallet.dataValues, _walletFound: true, _resolvedCompanyId: items.company_id || null };
          setRedisItemWithTTL(walletCacheKey, cacheData, 300).catch(() => {});
        } else {
          setRedisItemWithTTL(walletCacheKey, { _walletFound: false }, 60).catch(() => {});
        }
      }
      
      cronLogger.info('[Phase 10 Validation] Wallet found:', hasWallet ? 'YES' : 'NO');

      if (!hasWallet) {
        return errorResponseHelper(
          res,
          400,
          `No wallet address configured for ${requestedCurrency}. Please add a ${requestedCurrency} wallet first.`
        );
      }

      const tokenData: Partial<IUserType> = {
        ref: data.uniqueRef,
        adm_id: items.adm_id,
        customer_id: items.customer_id,
        company_id: items.company_id || hasWallet.dataValues.company_id,  // Include company_id from Redis or wallet
      };
      const { paymentRes, uniqueRef } = await Crypto(data, tokenData as IUserType, true);
      
      // Determine fee_payer mode
      const fee_payer = items.fee_payer || 'company';
      
      // Get base amount in original currency (could be USD, AUD, EUR, etc.)
      const baseAmountOriginal = Number(items.base_amount || items.amount || 0);
      const baseCurrency = items.base_currency || 'USD';
      
      // Convert base amount to USD for fee tier calculation
      // Fee tiers are defined in USD, so we need accurate USD amount
      let baseAmountUSD = baseAmountOriginal;
      if (baseCurrency !== 'USD') {
        try {
          const usdConversion = await currencyConvert({
            sourceCurrency: baseCurrency,
            currency: ['USD'],
            amount: baseAmountOriginal,
            fixedDecimal: true,
          });
          baseAmountUSD = Number(usdConversion[0]?.amount || baseAmountOriginal);
          cronLogger.info(`[createCryptoPayment] Converted ${baseAmountOriginal} ${baseCurrency} → ${baseAmountUSD} USD for fee calculation`);
        } catch (conversionError) {
          cronLogger.warn(`[createCryptoPayment] USD conversion failed, using original amount:`, conversionError);
          // Fallback to original amount if conversion fails
        }
      }
      
      let taxAmount = 0;
      let taxAmountUSD = 0;  // Tax in USD for fee calculation
      
      // Define tax info type
      interface CryptoPaymentTaxInfo {
        tax_enabled: boolean;
        tax_rate: number;
        tax_acronym?: string;
        tax_amount: number;
        country_code?: string;
        country_name?: string;
        subtotal: number;
        total: number;
        currency?: string;
      }
      
      let taxInfo: CryptoPaymentTaxInfo | null = null;
      
      // TAX HANDLING: If apply_tax is enabled, calculate tax based on customer location
      if (items.apply_tax) {
        cronLogger.info(`[createCryptoPayment] Tax enabled, detecting customer location...`);
        
        // Get customer IP and detect country
        const clientIP = getClientIP(req);
        const geoLocation = await getCountryFromIP(clientIP, req.headers);
        
        if (geoLocation && geoLocation.country_code) {
          cronLogger.info(`[createCryptoPayment] Detected country: ${geoLocation.country_name} (${geoLocation.country_code})`);
          
          // Calculate tax using the same function as getData (in original currency)
          const calculatedTax = await calculateTaxForCheckout(
            geoLocation.country_code,
            baseAmountOriginal,
            baseCurrency
          );
          
          if (calculatedTax) {
            taxInfo = calculatedTax as CryptoPaymentTaxInfo;
          }
          
          if (taxInfo && taxInfo.tax_amount > 0) {
            taxAmount = taxInfo.tax_amount;  // Tax in original currency
            // Convert tax to USD for fee calculation if needed
            if (baseCurrency !== 'USD') {
              taxAmountUSD = taxAmount * (baseAmountUSD / baseAmountOriginal);
            } else {
              taxAmountUSD = taxAmount;
            }
            cronLogger.info(`[createCryptoPayment] Tax calculated: ${taxInfo.tax_rate}% ${taxInfo.tax_acronym} = ${taxAmount} ${baseCurrency} (${taxAmountUSD.toFixed(2)} USD)`);
            cronLogger.info(`[createCryptoPayment] Total with tax: ${taxInfo.total} ${baseCurrency}`);
          }
        } else {
          cronLogger.info(`[createCryptoPayment] Could not detect customer country, no tax applied`);
        }
      }
      
      // Total amount customer should pay in original currency (base + tax if applicable)
      const totalAmountWithTax = baseAmountOriginal + taxAmount;
      
      let crypto_amount = 0;           // What customer should pay (includes tax)
      let merchant_amount_crypto = 0;  // What merchant receives (base amount only, no tax)
      let total_fees_crypto = 0;       // Admin fees
      let tax_amount_crypto = 0;       // Tax in crypto (goes to merchant as collected tax)
      let exchange_rate = 0;
      
      try {
        // PERFORMANCE FIX: Use cached exchange rate if available
        // This avoids a redundant ~100-300ms external API call to FastForex
        const cachedRate = items?.cached_transfer_rate ? parseFloat(String(items.cached_transfer_rate)) : 0;
        const cachedCurrency = items?.cached_crypto_currency || null;
        const hasCachedRate = cachedRate > 0 && cachedCurrency === requestedCurrency && taxAmount === 0;
        cronLogger.info(`[createCryptoPayment] Cache debug: rate=${items?.cached_transfer_rate}, currency=${items?.cached_crypto_currency}, parsed=${cachedRate}, requested=${requestedCurrency}, tax=${taxAmount}, hasCached=${hasCachedRate}`);
        
        // Stablecoin shortcut: USD ↔ USDT/USDC is exactly 1:1 (no exchange rate variance)
        const normalizedCrypto = requestedCurrency.replace(/-.*$/, '').toUpperCase(); // USDT-TRC20 → USDT
        const isStablecoinPayment = ['USDT', 'USDC'].includes(normalizedCrypto) && baseCurrency === 'USD';
        
        let total_crypto_amount: number;
        if (isStablecoinPayment) {
          // Stablecoins are pegged 1:1 to USD — no rate conversion needed
          total_crypto_amount = totalAmountWithTax;
          exchange_rate = 1;
          cronLogger.info(`[createCryptoPayment] 💵 Stablecoin 1:1 peg: $${totalAmountWithTax} USD = ${total_crypto_amount} ${requestedCurrency} (exact)`);
        } else if (hasCachedRate) {
          // Use cached rate — same currency, no tax adjustment needed
          total_crypto_amount = totalAmountWithTax * cachedRate;
          exchange_rate = cachedRate;
          cronLogger.info(`[createCryptoPayment] Using cached exchange rate: 1 ${baseCurrency} = ${cachedRate} ${requestedCurrency} (saved ~200ms)`);
        } else {
          // Fresh conversion needed (different currency, tax involved, or no cache)
          const cryptoRates = await currencyConvert({
            sourceCurrency: baseCurrency,
            currency: [requestedCurrency],
            amount: totalAmountWithTax,
            fixedDecimal: false,
          });
          total_crypto_amount = parseFloat(cryptoRates[0]?.amount?.toString() || '0');
          exchange_rate = parseFloat(cryptoRates[0]?.transferRate?.toString() || '0');
        }
        
        // Calculate base crypto amount (without tax) for merchant amount calculation
        // Use ratio from original currency amounts
        const base_crypto_amount = taxAmount > 0 
          ? total_crypto_amount * (baseAmountOriginal / totalAmountWithTax)
          : total_crypto_amount;
        
        // Calculate tax amount in crypto
        tax_amount_crypto = taxAmount > 0 
          ? total_crypto_amount * (taxAmount / totalAmountWithTax)
          : 0;
        
        cronLogger.info(`[createCryptoPayment] Crypto amount calculated:
          - Base amount: ${baseAmountOriginal} ${baseCurrency} (${baseAmountUSD.toFixed(2)} USD)
          - Tax amount: ${taxAmount} ${baseCurrency}
          - Total with tax: ${totalAmountWithTax} ${baseCurrency}
          - Total crypto: ${total_crypto_amount} ${requestedCurrency}
          - Base crypto: ${base_crypto_amount} ${requestedCurrency}
          - Tax crypto: ${tax_amount_crypto} ${requestedCurrency}
          - Exchange rate: 1 ${baseCurrency} = ${exchange_rate} ${requestedCurrency}`);
        
        // Calculate fees using tier-based structure: 1.5% + fixed
        // IMPORTANT: Use USD amount for fee tier selection (tiers are defined in USD)
        const merchantUserId = items?.adm_id ? Number(items.adm_id) : undefined;
        const { totalDeduction, fixedFee, transactionFee, feeFreeApplied } = await calculateTransactionFees(
          requestedCurrency,
          baseAmountUSD,  // Fee calculation based on USD amount (ensures correct tier)
          merchantUserId  // Pass userId for fee-free discount
        );
        
        if (feeFreeApplied) {
          cronLogger.info(`[createCryptoPayment] 🎉 Fee-free promotion applied for user ${merchantUserId}`);
        }
        
        // Fee percentage for crypto conversion (based on USD fee / USD amount)
        const feePercentage = totalDeduction / baseAmountUSD;
        
        cronLogger.info(`[createCryptoPayment] Fee calculation (USD-based for tier accuracy):
          - Base original: ${baseAmountOriginal} ${baseCurrency}
          - Base USD: $${baseAmountUSD.toFixed(2)}
          - Fee breakdown: 1.5%=$${transactionFee.toFixed(2)} + Fixed=$${fixedFee.toFixed(2)}
          - Total fee: $${totalDeduction.toFixed(2)} (${(feePercentage * 100).toFixed(2)}% of base)`);
        
        // TAX HANDLING IN FEE CALCULATION:
        // - Admin fees are calculated on BASE amount only (not on tax)
        // - Tax goes entirely to merchant (they must remit to tax authority)
        // - Merchant receives: base_amount (after fees) + tax_amount
        
        if (fee_payer === 'customer') {
          // CUSTOMER PAYS FEES:
          // - Customer pays: base_amount + fees + tax
          // - Merchant receives: full base_amount + tax (what they requested + tax collected)
          // - Admin receives: fees only (swept from temp wallet)
          
          const merchant_base_crypto = base_crypto_amount;  // Merchant gets full base
          total_fees_crypto = base_crypto_amount * feePercentage;  // Calculate fees using tier-based percentage
          merchant_amount_crypto = merchant_base_crypto + tax_amount_crypto;  // Merchant gets base + tax
          crypto_amount = merchant_base_crypto + total_fees_crypto + tax_amount_crypto;  // Customer pays base + fees + tax
          
          cronLogger.info(`[createCryptoPayment] CUSTOMER PAYS FEES mode (with tax):
            - Customer pays: ${crypto_amount.toFixed(8)} ${requestedCurrency} (base + fees + tax)
            - Merchant receives: ${merchant_amount_crypto.toFixed(8)} ${requestedCurrency} (base + tax)
            - Admin fees: ${total_fees_crypto.toFixed(8)} ${requestedCurrency} (${(feePercentage * 100).toFixed(2)}% of base)
            - Tax collected: ${tax_amount_crypto.toFixed(8)} ${requestedCurrency} (included in merchant amount)`);
            
        } else {
          // COMPANY (MERCHANT) PAYS FEES:
          // - Customer pays: base_amount + tax
          // - Merchant receives: base_amount * (1 - fee_percent) + tax
          // - Admin receives: base_amount * fee_percent (swept from temp wallet)
          
          crypto_amount = total_crypto_amount;  // Customer pays base + tax
          const merchant_base_after_fees = base_crypto_amount * (1 - feePercentage);
          merchant_amount_crypto = merchant_base_after_fees + tax_amount_crypto;
          total_fees_crypto = base_crypto_amount * feePercentage;
          
          cronLogger.info(`[createCryptoPayment] COMPANY PAYS FEES mode (with tax):
            - Customer pays: ${crypto_amount.toFixed(8)} ${requestedCurrency} (base + tax)
            - Merchant receives: ${merchant_amount_crypto.toFixed(8)} ${requestedCurrency} (${((1 - feePercentage) * 100).toFixed(2)}% base + tax)
            - Admin fees: ${total_fees_crypto.toFixed(8)} ${requestedCurrency} (${(feePercentage * 100).toFixed(2)}% of base)
            - Tax collected: ${tax_amount_crypto.toFixed(8)} ${requestedCurrency} (included in merchant amount)`);
        }
      } catch (calcError) {
        cronLogger.error('[createCryptoPayment] Crypto/fee calculation error:', calcError);
        // Fallback to simple 2% if calculation fails
        crypto_amount = data.amount || 0;
        const fallbackFeePercent = parseFloat(process.env.TRANSACTION_FEE_PERCENT || '2.0') / 100;
        total_fees_crypto = crypto_amount * fallbackFeePercent;
        merchant_amount_crypto = crypto_amount - total_fees_crypto;
      }
      
      // Add crypto amount and rate to response
      // Calculate remaining minutes for crypto invoice (uses centralized config)
      const CRYPTO_INVOICE_MINUTES = PAYMENT_TIMING.CRYPTO_INVOICE_MINUTES;
      finalRes = { 
        hash: uniqueRef, 
        ...paymentRes,
        amount: crypto_amount,
        merchant_amount: merchant_amount_crypto,
        fees: total_fees_crypto,
        fee_payer: fee_payer,
        base_amount: baseAmountOriginal,          // Original amount in merchant's currency
        base_amount_usd: baseAmountUSD,           // Converted to USD (for reference)
        base_currency: baseCurrency,
        rate: exchange_rate,
        remaining_minutes: CRYPTO_INVOICE_MINUTES,  // Frontend uses this for invoice countdown timer
        // Tax info (if applicable)
        ...(taxInfo && {
          tax_info: {
            tax_amount: taxAmount,                // Tax in original currency
            tax_amount_usd: taxAmountUSD,         // Tax in USD
            tax_amount_crypto: tax_amount_crypto,
            tax_rate: taxInfo.tax_rate,
            tax_acronym: taxInfo.tax_acronym,
            country_code: taxInfo.country_code,
          }
        }),
      };

      cronLogger.info(`[addPayment] crypto direct response, ref: ${uniqueRef}, currency: ${data.currency}, amount: ${crypto_amount}`);

      // PERF: Removed redundant deleteRedisItem — setRedisItem already overwrites :json key
      // and deletes hash key, so explicit delete before set was 2 extra Redis round-trips (~200ms)
      const directCryptoRedisKey = getCryptoRedisKey(paymentRes.address, paymentRes.destination_tag);
      
      // FIX: Store crypto invoice expiry timestamp (15 minutes from now)
      // This is separate from payment link expiry - crypto invoice has shorter window
      const cryptoInvoiceExpiresAt = new Date(Date.now() + CRYPTO_INVOICE_MINUTES * 60 * 1000).toISOString();
      
      // Build the crypto address Redis payload (needed for webhook processing)
      const cryptoRedisPayload = {
        mode: paymentTypes.CRYPTO,
        amount: crypto_amount,                  // Crypto amount customer should pay (includes tax)
        merchant_amount: merchant_amount_crypto, // Amount merchant should receive (includes tax)
        total_fees: total_fees_crypto,          // Total fees (admin's portion - from base only)
        fee_payer: fee_payer,                   // Who pays fees
        // Store both original and USD amounts for accurate fee calculations
        base_amount_original: baseAmountOriginal,  // Original amount in merchant's currency
        base_currency: baseCurrency,              // Merchant's currency (e.g., AUD)
        base_amount_usd: baseAmountUSD,           // Converted USD amount (for fee tier)
        total_amount_original: totalAmountWithTax, // Total in original currency (with tax)
        total_amount_usd: baseAmountUSD + (taxAmountUSD || 0),  // Total USD amount (with tax if applicable)
        status: toRedisStatus(PaymentState.PENDING),
        ref: uniqueRef,
        currency: data.currency,
        payment_id: paymentRes.transaction_id,  // Internal payment ID (NOT blockchain txId)
        unique_tx_id: paymentRes.transaction_id,  // Alias for backward compatibility with cryptoVerification
        walletType: "customer",
        temp_id: paymentRes.temp_id,
        is_merchant_pool: paymentRes.is_merchant_pool ? "true" : "false",  // CRITICAL: Include merchant pool flag
        // XRP/RLUSD: Store destination tag for tag-based chains (needed for incomplete payment UI)
        ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
        // FIX: Store crypto invoice expiry for polling countdown
        crypto_invoice_expires_at: cryptoInvoiceExpiresAt,
        // BUGFIX: Store merchant webhook info directly in crypto-{address}
        webhook_url: items?.webhook_url || null,
        callback_url: items?.callback_url || null,
        webhook_secret: items?.webhook_secret || null,
        company_id: items?.company_id || null,
        link_id: items?.link_id || null,
        // Tax tracking
        ...(taxInfo && {
          tax_enabled: "true",
          tax_amount_original: taxAmount,       // Tax in original currency
          tax_amount_usd: taxAmountUSD,         // Tax in USD
          tax_amount_crypto: tax_amount_crypto,
          tax_rate: taxInfo.tax_rate,
          tax_country_code: taxInfo.country_code,
        }),
      };

      // ═══════════════════════════════════════════════════════════════
      // PERF: Send response FIRST, then do Redis writes in background
      // Blockchain confirmation takes 3+ minutes; Redis write takes ~200ms
      // This moves ~700ms of Redis I/O off the critical path
      // ═══════════════════════════════════════════════════════════════
      
      // Also update the temp address record in database for partial payment handling
      // Note: Only update if NOT a merchant pool address (userTempAddressModel is for legacy addresses)
      if (!paymentRes.is_merchant_pool) {
        // Legacy path: keep sync for safety since it's not on the fast path
        await setRedisItem(directCryptoRedisKey, cryptoRedisPayload);
        
        await userTempAddressModel.update(
          {
            fee_payer: fee_payer,
            merchant_amount: merchant_amount_crypto,
            base_amount_usd: baseAmountUSD,
          },
          { where: { temp_id: paymentRes.temp_id } }
        );
        
        // Customer Redis update (sync for legacy)
        const customerRedisData = await getRedisItem(uniqueRef);
        if (customerRedisData) {
          const updatedCustomerData = {
            ...customerRedisData,
            active_crypto_address: {
              currency: data.currency,
              address: paymentRes.address,
              qr_code: paymentRes.qr_code,
              payment_id: paymentRes.transaction_id,
              created_at: new Date().toISOString(),
              ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
            },
            ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
          };
          await setRedisItem(uniqueRef, updatedCustomerData);
        }
      } else {
        // ═══════════════════════════════════════════════════════════
        // MERCHANT POOL FAST PATH: Fire-and-forget background writes
        // ═══════════════════════════════════════════════════════════
        
        // Send HTTP response immediately (sub-500ms target)
        successResponseHelper(res, 200, "Payment created successfully", finalRes);
        
        // Background writes — these MUST complete but don't block the response
        // Safety: blockchain TX takes 3+ min to confirm, Redis write takes ~200ms
        (async () => {
          try {
            // Critical: crypto address data (needed for webhook processing)
            await setRedisItem(directCryptoRedisKey, cryptoRedisPayload);
            
            // Non-critical: customer Redis update (prevents duplicate address generation)
            const customerRedisData = await getRedisItem(uniqueRef);
            if (customerRedisData) {
              const updatedCustomerData = {
                ...customerRedisData,
                active_crypto_address: {
                  currency: data.currency,
                  address: paymentRes.address,
                  qr_code: paymentRes.qr_code,
                  payment_id: paymentRes.transaction_id,
                  created_at: new Date().toISOString(),
                  ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
                },
                ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
              };
              await setRedisItem(uniqueRef, updatedCustomerData);
              cronLogger.info(`[Phase 12.1] Stored active_crypto_address for ${uniqueRef}: ${paymentRes.address}${paymentRes.destination_tag ? `:${paymentRes.destination_tag}` : ''}`);
            }
          } catch (bgErr) {
            cronLogger.error(`[CRITICAL] Background Redis write failed for ${directCryptoRedisKey}:`, (bgErr as Error).message);
          }
        })();
        
        return; // Response already sent above
      }

      successResponseHelper(res, 200, "Payment created successfully", finalRes);
    } else {
      throw { message: "Please enter valid currency!" };
    }
  } catch (e) {
    cronLogger.info("####e", e);
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};


const confirmPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem(uniqueRef);

    cronLogger.info(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      if (tempData?.pathType === "createLink") {
        const { data }: IVerifyResponse = await flw.Transaction.verify({
          id: transactionId,
        });
        cronLogger.info(data);

        const linkData = (
          await paymentLinkModel.findOne({
            where: { transaction_id: tempData?.transaction_id },
          })
        ).dataValues;

        // Multi-tenant fix: Include company_id in wallet lookup
        const walletWhereClause: Record<string, unknown> = {
          user_id: Number(linkData.user_id),
          wallet_type: data.currency,
        };
        
        // Add company_id filter if present
        if (linkData.company_id && linkData.company_id !== '' && linkData.company_id !== 'undefined' && linkData.company_id !== 'null') {
          const companyId = parseInt(linkData.company_id);
          if (!isNaN(companyId)) {
            walletWhereClause.company_id = companyId;
          }
        } else {
          walletWhereClause.company_id = null;
        }
        
        const walletData = await userWalletModel.findOne({
          where: walletWhereClause,
          transaction,
        });

        const transaction_fee = await getTransactionFee();
        const blockchain_fee = await getBlockchainFee();
        const platformCharge = (data.amount * Number(transaction_fee)) / 100;
        const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

        await incrementAdminFee(data.currency, platformCharge + blockchainCharge);

        // Send admin fee notification email for card payments
        try {
          const adminEmail = process.env.ADMIN_EMAIL;
          const totalFee = platformCharge + blockchainCharge;
          if (adminEmail && totalFee > 0) {
            const merchantAmount = data.amount_settled - platformCharge - blockchainCharge;
            await sendAdminFeeReceivedEmail(
              adminEmail,
              "Dynopay Admin",
              totalFee.toFixed(2),
              data.currency,
              (data as { transaction_id?: string }).transaction_id || String(data.id),
              linkData?.company_name || "Unknown Company",
              merchantAmount.toFixed(2),
              data.amount_settled.toFixed(2)
            );
            
            cronLogger.info(`[Admin Fee Notification - Card] Sent email for ${totalFee} ${data.currency} from Company ${linkData?.company_id || 'N/A'}`);
          }
        } catch (emailError) {
          cronLogger.error("[Admin Fee Notification - Card] Email failed:", emailError);
        }

        await userWalletModel.update(
          {
            amount: Number(
              walletData.dataValues.amount +
              data.amount_settled -
              platformCharge -
              blockchainCharge
            ).toFixed(2),
          },
          {
            where: {
              wallet_id: walletData.dataValues.wallet_id,
            },
            transaction,
          }
        );

        await paymentLinkModel.update(
          {
            paid_currency: data.currency,
            paid_amount: data.amount,
            status: data.status,
            wallet_id: walletData.dataValues.wallet_id,
            transaction_reference: data.flw_ref,
            payment_mode: tempData.mode,
          },
          {
            where: {
              transaction_id: tempData?.transaction_id,
            },
          }
        );

        // Increment times_used counter
        await paymentLinkModel.increment('times_used', {
          by: 1,
          where: {
            transaction_id: tempData?.transaction_id,
          },
        });

        transaction.commit();
        
        // Use stored redirect_url or callback_url if available
        const returnData = {
          transaction_reference: data.flw_ref,
          status: data.status,
          redirect: false,
          ...(linkData.redirect_url && { redirect_url: linkData.redirect_url }),
          ...(linkData.callback_url && { callback_url: linkData.callback_url }),
        };
        
        // Call webhook if webhook_url is configured
        if (linkData.webhook_url) {
          // Validate webhook URL - localhost URLs won't work from cloud server
          if (linkData.webhook_url.includes('localhost') || linkData.webhook_url.includes('127.0.0.1')) {
            webhookLogs.error("Payment link webhook uses localhost URL which is unreachable", { 
              webhook_url: linkData.webhook_url,
              suggestion: "Use a public URL for webhooks"
            });
          } else {
            try {
              await axios.post(linkData.webhook_url, returnData, { timeout: 30000 });
              webhookLogs.log("info", "Payment link webhook sent successfully!", {
                webhook_url: linkData.webhook_url,
                ...returnData,
              });
            } catch (webhookError) {
              const errorMsg = webhookError.code === 'ECONNREFUSED' 
                ? `Connection refused - server at ${linkData.webhook_url} is not reachable`
                : webhookError.message;
              webhookLogs.error("Payment link webhook failed", { 
                webhook_url: linkData.webhook_url,
                error: errorMsg
              });
            }
          }
        }
        
        // FIXED: Use soft delete with TTL for checkout status polling
        await softDeleteRedisItem(uniqueRef, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS); // Grace period TTL
        successResponseHelper(res, 200, "Payment confirmed successfully", returnData);
      } else {
        const company_data = (
          await companyModel.findOne({
            where: { company_id: tempData.company_id },
          })
        ).dataValues;

        let product_name;

        if (tempData?.meta_data) {
          const meta_data = JSON.parse(tempData?.meta_data);
          product_name = meta_data?.product_name ?? meta_data?.product;
        }

        if (tempData.mode !== paymentTypes.WALLET) {
          const { data }: IVerifyResponse = await flw.Transaction.verify({
            id: transactionId,
          });
          cronLogger.info(data);

          const customerPayload = {
            id: crypto.randomUUID(),
            company_id: Number(tempData.company_id),
            customer_id: Number(tempData.customer_id),
            payment_mode: tempData.mode,
            base_amount: Number(tempData.amount).toFixed(2),
            base_currency: tempData.base_currency,
            paid_amount: data.amount.toFixed(2),
            paid_currency: data.currency,
            transaction_reference: data.flw_ref,
            unique_tx_id: tempData.payment_id || tempData.unique_tx_id || tempData.id,
            transaction_type: tempData?.pathType?.includes("addFund")
              ? "CREDIT"
              : "PAYMENT",
            language: normalizeLang(tempData?.language),
            ...(!tempData?.pathType?.includes("addFund") && {
              transaction_details: product_name
                ? "Made payment for " +
                product_name +
                " on " +
                company_data?.company_name
                : "Made payment for " +
                (company_data?.company_name || "Company") +
                " product",
            }),
            status: data.status,
          };

          // Multi-tenant fix: Include company_id in wallet lookup
          const createPaymentWalletWhere: Record<string, unknown> = {
            user_id: Number(tempData.adm_id),
            wallet_type: data.currency,
          };
          
          // Add company_id filter if present
          if (tempData.company_id && tempData.company_id !== '' && tempData.company_id !== 'undefined' && tempData.company_id !== 'null') {
            const companyId = parseInt(tempData.company_id);
            if (!isNaN(companyId)) {
              createPaymentWalletWhere.company_id = companyId;
            }
          } else {
            createPaymentWalletWhere.company_id = null;
          }
          
          const walletData = await userWalletModel.findOne({
            where: createPaymentWalletWhere,
            transaction,
          });

          const transaction_fee = await getTransactionFee();
          const blockchain_fee = await getBlockchainFee();
          const platformCharge = (data.amount * Number(transaction_fee)) / 100;
          const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

          await incrementAdminFee(data.currency, platformCharge + blockchainCharge);

          // Send admin fee notification email for create payment
          try {
            const adminEmail = process.env.ADMIN_EMAIL;
            const totalFee = platformCharge + blockchainCharge;
            if (adminEmail && totalFee > 0) {
              const merchantAmount = data.amount_settled - platformCharge - blockchainCharge;
              const companyData = await companyModel.findOne({
                where: { company_id: tempData.company_id },
              });
              
              await sendAdminFeeReceivedEmail(
                adminEmail,
                "Dynopay Admin",
                totalFee.toFixed(2),
                data.currency,
                (data as { transaction_id?: string }).transaction_id || String(data.id),
                companyData?.dataValues?.company_name || "Unknown Company",
                merchantAmount.toFixed(2),
                data.amount_settled.toFixed(2)
              );
              
              cronLogger.info(`[Admin Fee Notification - CreatePayment] Sent email for ${totalFee} ${data.currency} from Company ${tempData.company_id || 'N/A'}`);
            }
          } catch (emailError) {
            cronLogger.error("[Admin Fee Notification - CreatePayment] Email failed:", emailError);
          }

          const customerWalletData = await customerWalletModel.findOne({
            where: {
              customer_id: Number(tempData.customer_id),
            },
          });

          await userWalletModel.update(
            {
              amount: Number(
                walletData.dataValues.amount +
                data.amount_settled -
                platformCharge -
                blockchainCharge
              ).toFixed(2),
            },
            {
              where: {
                wallet_id: walletData.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const userPayload = {
            id: uniqueRef,
            wallet_id: walletData.dataValues.wallet_id,
            user_id: walletData.dataValues.user_id,
            payment_mode: tempData.mode,
            base_amount: (
              data.amount_settled -
              platformCharge -
              blockchainCharge
            ).toFixed(2),
            base_currency: data.currency,
            transaction_reference: data.flw_ref,
            transaction_type: "CREDIT",
            status: data.status,
            customer_id: Number(tempData.customer_id),
            company_id: tempData.company_id || null,  // Include company_id from Redis
          };

          await customerTransactionModel.create(
            { ...customerPayload },
            { transaction }
          );
          await userTransactionModel.create(
            { ...userPayload },
            { transaction }
          );
          if (tempData?.pathType?.includes("addFund")) {
            await customerWalletModel.update(
              {
                amount: Number(
                  customerWalletData.dataValues.amount + Number(tempData.amount)
                ).toFixed(2),
              },
              {
                where: {
                  customer_id: Number(tempData.customer_id),
                },
                transaction,
              }
            );
          }
          transaction.commit();

          // Auto-generate invoice for completed transaction
          if (tempData.company_id && userPayload.id) {
            autoGenerateInvoice(
              Number(userPayload.id),
              Number(tempData.company_id)
            ).catch(err => {
              cronLogger.error("Failed to generate invoice:", err);
            });
          }

          const redirect_uri =
            tempData.redirect_uri +
            `?transaction_id=${customerPayload.id}&status=${customerPayload.status
            }&meta_data=${tempData?.meta_data ?? null}&payment_type=${tempData.mode
            }`;

          const returnData = {
            transaction_id: customerPayload.id,
            status: customerPayload.status,
            redirect: true,
            redirect_uri,
          };
          // FIXED: Use soft delete with TTL for checkout status polling
          await softDeleteRedisItem(uniqueRef, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS);
          successResponseHelper(
            res,
            200,
            "transaction successful!",
            returnData
          );
        } else {
          const customerPayload = {
            id: crypto.randomUUID(),
            company_id: Number(tempData.company_id),
            customer_id: Number(tempData.customer_id),
            payment_mode: tempData.mode,
            base_amount: Number(tempData.amount).toFixed(2),
            base_currency: tempData.base_currency,
            paid_amount: Number(tempData.paid_amount).toFixed(2),
            paid_currency: tempData.paid_currency,
            transaction_reference: tempData.id,
            unique_tx_id: tempData.payment_id || tempData.unique_tx_id || tempData.id,
            transaction_type: "DEBIT",
            language: normalizeLang(tempData?.language),
            transaction_details: product_name
              ? "Made payment for " +
              product_name +
              " on " +
              company_data?.company_name
              : "Made payment for " +
              (company_data?.company_name || "Company") +
              " product",

            status: tempData.status,
          };

          await customerTransactionModel.create(
            { ...customerPayload },
            { transaction }
          );

          transaction.commit();
          const redirect_uri =
            tempData.redirect_uri +
            `?transaction_id=${customerPayload.id}&status=${customerPayload.status
            }&meta_data=${tempData?.meta_data ?? null}&payment_type=${tempData.mode
            }`;

          const returnData = {
            transaction_id: customerPayload.id,
            status: customerPayload.status,
            redirect: true,
            redirect_uri,
          };
          // FIXED: Use soft delete with TTL for checkout status polling
          await softDeleteRedisItem(uniqueRef, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS);
          successResponseHelper(
            res,
            200,
            "transaction successful!",
            returnData
          );
        }
      }
    } else {
      transaction.rollback();
      errorResponseHelper(
        res,
        500,
        "Transaction Not found! Please contact support"
      );
    }
  } catch (e) {
    const message = getErrorMessage(e);
    transaction.rollback();
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};


// ═══════════════════════════════════════════════════════════════════════════
// getPaymentMeta — lightweight, READ-ONLY metadata for a checkout link, used by
// the /pay page's getServerSideProps to render dynamic OG/link-preview tags
// (social crawlers don't run JS). No Redis writes, no reservations.
// GET /api/pay/meta?d=<session-key>
// ═══════════════════════════════════════════════════════════════════════════
const getPaymentMeta = async (req: express.Request, res: express.Response) => {
  try {
    const data = String(req.query.d || req.query.data || "").trim();
    if (!data) return errorResponseHelper(res, 400, "Payment reference is required");

    const item = (await getRedisItem("customer-" + data)) as Record<string, any> | null;
    if (!item || Object.keys(item).length === 0) {
      return errorResponseHelper(res, 404, "Payment link not found or expired");
    }

    // Merchant / company
    let merchantName: string | null = null;
    let merchantLogo: string | null = null;
    if (item.company_id) {
      try {
        const company = await companyModel.findByPk(item.company_id);
        if (company) {
          const cd = (company as { dataValues: Record<string, any> }).dataValues;
          merchantName = cd.company_name ? String(cd.company_name) : null;
          merchantLogo = cd.photo ? String(cd.photo) : null;
        }
      } catch {
        /* ignore */
      }
    }

    const isDonation = item.link_type === "donation";
    const amount = Number(item.base_amount || item.amount || 0);
    const currency = String(item.base_currency || "USD");

    if (isDonation && item.link_id) {
      const [parentRow] = (await sequelize.query(
        `SELECT title, description, goal_amount, campaign_image, base_currency
         FROM tbl_payment_link WHERE link_id = :id AND link_type = 'donation'`,
        { replacements: { id: item.link_id }, type: QueryTypes.SELECT }
      )) as Array<Record<string, any>>;
      const agg = parentRow ? await getDonationAggregates(Number(item.link_id)) : { raised_amount: 0, supporters_count: 0 };
      const goal = parentRow?.goal_amount != null ? Number(parentRow.goal_amount) : null;
      const cur = String(parentRow?.base_currency || currency);
      const title = (parentRow?.title as string) || "Support this campaign";
      const raisedStr = `${agg.raised_amount.toLocaleString()} ${cur}`;
      return successResponseHelper(res, 200, "Payment meta", {
        type: "donation",
        title,
        description:
          (parentRow?.description as string) ||
          `Help fund "${title}"${merchantName ? ` by ${merchantName}` : ""} — donate with crypto via Dynopay.`,
        image: (parentRow?.campaign_image as string) || merchantLogo || null,
        merchant_name: merchantName,
        currency: cur,
        goal_amount: goal,
        raised_amount: agg.raised_amount,
        supporters_count: agg.supporters_count,
        progress_percent: goal && goal > 0 ? Math.min(100, Math.round((agg.raised_amount / goal) * 100)) : null,
        summary: goal ? `${raisedStr} raised of ${goal.toLocaleString()} ${cur} goal` : `${raisedStr} raised`,
      });
    }

    // Standard payment link
    const prettyAmount = amount > 0 ? `${amount.toLocaleString()} ${currency}` : null;
    const title = prettyAmount
      ? `Pay ${prettyAmount}${merchantName ? ` to ${merchantName}` : ""}`
      : merchantName
        ? `Pay ${merchantName}`
        : "Complete your payment";
    return successResponseHelper(res, 200, "Payment meta", {
      type: "standard",
      title,
      description:
        (item.description as string) ||
        `Secure crypto payment${merchantName ? ` to ${merchantName}` : ""} — pay with Bitcoin, Ethereum, USDT and more via Dynopay.`,
      image: merchantLogo || null,
      merchant_name: merchantName,
      amount: amount || null,
      currency,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to load payment meta";
    errorResponseHelper(res, 500, message);
  }
};

export { getData, getPaymentMeta, Crypto, createCryptoPayment, confirmPayment };
