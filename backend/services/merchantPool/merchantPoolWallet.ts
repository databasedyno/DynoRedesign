/**
 * Merchant Pool Wallet Management
 * 
 * Handles wallet creation, address generation, and pool initialization.
 */

import { raw as envRaw } from "../../utils/config";
import { Transaction, Op } from "sequelize";
import { cronLogger } from "../../utils/loggers";
import {
  merchantWalletModel,
  merchantTempAddressModel,
  CHAIN_XPUB_MAPPING,
  NON_HD_CHAINS,
} from "../../models";
import tatumApi from "../../apis/tatumApi";
// All private-key/mnemonic decryption goes through the audited custody boundary
// (writes tbl_key_access_audit). Do NOT call tatumApi.decryptSymmetric directly.
import * as keyCustody from "../keyCustody/keyCustodyService";
import sequelize from "../../utils/dbInstance";
import { getErrorMessage } from "../../helper";
import { POOL_CONFIG, RLUSD_CONFIG, isTagBasedChain, XRP_MASTER_ADDRESS, getCryptoRedisKey } from "./merchantPoolConfig";
import { adminFeeModel } from "../../models";
import { getRedisItem, setRedisItemWithTTL } from "../../utils/redisInstance";
import { generateQRCodeWithLogo } from "../../utils/qrCodeWithLogo";

/**
 * PERF: Pre-generate QR code for a pool address and cache it in DB.
 * Called after address creation — saves ~250ms at payment time.
 */
const cacheQRCode = async (address: string, walletType: string, destinationTag?: number | null): Promise<void> => {
  try {
    const qrPayload = destinationTag ? `${address}?dt=${destinationTag}` : address;
    const qrCode = await generateQRCodeWithLogo(qrPayload, walletType, 400);
    await merchantTempAddressModel.update(
      { cached_qr_code: qrCode },
      { where: { wallet_address: address, ...(destinationTag ? { destination_tag: destinationTag } : {}) } }
    );
    cronLogger.info(`[MerchantPool] ✅ QR code pre-cached for ${address}${destinationTag ? `:${destinationTag}` : ''}`);
  } catch (err) {
    cronLogger.warn(`[MerchantPool] QR pre-cache failed (non-critical):`, (err as Error).message);
  }
};

/**
 * Generate a unique destination tag for XRP-based payments.
 * Uses a random 32-bit unsigned integer (1 to 4,294,967,295).
 * Tag 0 is avoided as some wallets treat it as "no tag".
 */
const generateUniqueDestinationTag = async (
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<number> => {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    // Random tag between 1 and 4,294,967,295
    const tag = Math.floor(Math.random() * 4294967294) + 1;
    
    // Check uniqueness in the pool
    const existing = await merchantTempAddressModel.findOne({
      where: {
        wallet_address: XRP_MASTER_ADDRESS,
        destination_tag: tag,
      },
      transaction,
    });
    
    if (!existing) {
      return tag;
    }
  }
  // Fallback: use timestamp-based tag
  return (Date.now() % 4294967294) + 1;
};

/**
 * Get or create merchant's xpub/mnemonic for a chain
 */
export const getOrCreateMerchantWallet = async (
  userId: number,
  walletType: string
): Promise<{ xpub: string; mnemonic: string }> => {
  const baseChain = CHAIN_XPUB_MAPPING[walletType] || walletType;
  
  let merchantWallet = await merchantWalletModel.findOne({
    where: {
      user_id: userId,
      wallet_type: baseChain,
    },
  });

  if (merchantWallet) {
    // Non-HD chains: mnemonic field stores "NON_HD" marker
    if (NON_HD_CHAINS.includes(baseChain)) {
      return { xpub: merchantWallet.dataValues.xpub, mnemonic: "NON_HD" };
    }
    const decryptedData = await keyCustody.decryptPrivateKey(
      merchantWallet.dataValues.mnemonic,
      envRaw("XPUB_KEY_ID"),
      { purpose: "merchant_wallet_mnemonic", actor: "worker", walletType: baseChain }
    );
    const walletData = JSON.parse(decryptedData);
    return {
      xpub: merchantWallet.dataValues.xpub,
      mnemonic: walletData.mnemonic,
    };
  }

  cronLogger.info(`[MerchantPool] Generating new ${baseChain} wallet for merchant ${userId}...`);
  
  const walletData = await tatumApi.generateWallet(baseChain);
  
  // Non-HD chains (SOL, XRP): no real xpub/mnemonic — store placeholders
  if (NON_HD_CHAINS.includes(baseChain)) {
    if (!walletData || !walletData.xpub) {
      throw new Error(`Failed to generate ${baseChain} wallet for merchant ${userId}`);
    }
    
    const encryptedMnemonic = await tatumApi.encryptSymmetric(
      JSON.stringify({ xpub: walletData.xpub, mnemonic: "NON_HD" }),
      envRaw("XPUB_KEY_ID")
    );

    merchantWallet = await merchantWalletModel.create({
      user_id: userId,
      wallet_type: baseChain,
      xpub: walletData.xpub,
      mnemonic: encryptedMnemonic,
      last_derivation_index: 0,
    });

    cronLogger.info(`[MerchantPool] ✅ Created ${baseChain} (non-HD) wallet marker for merchant ${userId}`);
    return { xpub: walletData.xpub, mnemonic: "NON_HD" };
  }
  
  if (!walletData || !walletData.xpub || !walletData.mnemonic) {
    throw new Error(`Failed to generate ${baseChain} wallet for merchant ${userId}`);
  }

  const encryptedMnemonic = await tatumApi.encryptSymmetric(
    JSON.stringify({ xpub: walletData.xpub, mnemonic: walletData.mnemonic }),
    envRaw("XPUB_KEY_ID")
  );

  merchantWallet = await merchantWalletModel.create({
    user_id: userId,
    wallet_type: baseChain,
    xpub: walletData.xpub,
    mnemonic: encryptedMnemonic,
    last_derivation_index: 0,
  });

  cronLogger.info(`[MerchantPool] ✅ Created ${baseChain} wallet for merchant ${userId}`);

  return {
    xpub: walletData.xpub,
    mnemonic: walletData.mnemonic,
  };
};

/**
 * Get next derivation index for merchant's wallet
 */
const getNextDerivationIndex = async (
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<number> => {
  const baseChain = CHAIN_XPUB_MAPPING[walletType] || walletType;
  
  const merchantWallet = await merchantWalletModel.findOne({
    where: {
      user_id: userId,
      wallet_type: baseChain,
    },
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    transaction,
  });

  if (!merchantWallet) {
    throw new Error(`Merchant wallet not found for user ${userId}, chain ${baseChain}`);
  }

  const nextIndex = (merchantWallet.dataValues.last_derivation_index || 0) + 1;

  await merchantWallet.update(
    { last_derivation_index: nextIndex },
    { transaction }
  );

  return nextIndex;
};

/**
 * Add a new address to merchant's pool
 * 
 * For TAG_BASED_CHAINS (XRP, RLUSD): Uses a single master address with unique
 * destination tags. No per-address funding or trust line setup needed.
 * 
 * For all other chains: Generates a new HD-derived or non-HD address as before.
 */
export const addAddressToMerchantPool = async (
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<unknown> => {
  try {
    // ──────────────────────────────────────────────────────────────
    // TAG-BASED CHAINS (XRP, RLUSD): Master address + destination tag
    // ──────────────────────────────────────────────────────────────
    if (isTagBasedChain(walletType)) {
      if (!XRP_MASTER_ADDRESS) {
        throw new Error(`XRP_MASTER_WALLET (master address) not configured. Cannot create ${walletType} pool address.`);
      }

      const destinationTag = await generateUniqueDestinationTag(userId, walletType, transaction);

      // Get the master address's encrypted private key from admin fee wallet (stored as XRP_MASTER)
      const xrpMasterWalletRecord = await adminFeeModel.findOne({ where: { wallet_type: "XRP_MASTER" } });
      if (!xrpMasterWalletRecord) {
        throw new Error("XRP_MASTER wallet record not found in DB. Cannot create tag-based address.");
      }
      const encryptedMasterKey = xrpMasterWalletRecord.dataValues.privateKey;

      // Create a subscription on the master address (idempotent — Tatum deduplicates by address)
      let subscriptionId = null;
      try {
        const subResult = await tatumApi.createSubscription(
          XRP_MASTER_ADDRESS,
          walletType === "RLUSD" ? "XRP" : walletType,  // Subscription is on the XRP address
          true
        );
        subscriptionId = subResult?.id;
      } catch (subError) {
        cronLogger.warn(`[MerchantPool] Warning: Subscription for master address:`, getErrorMessage(subError));
      }

      const poolAddress = await merchantTempAddressModel.create(
        {
          owner_user_id: userId,
          wallet_type: walletType,
          wallet_address: XRP_MASTER_ADDRESS,
          destination_tag: destinationTag,
          private_key: encryptedMasterKey,
          derivation_index: 0,  // Tag-based chains don't use HD derivation
          subscription_id: subscriptionId,
          status: "AVAILABLE",
          admin_fee_balance: 0,
          gas_balance: 0,
          total_transactions: 0,
        },
        { transaction }
      );

      cronLogger.info(`[MerchantPool] ✅ Added tag-based ${walletType} address for merchant ${userId}: ${XRP_MASTER_ADDRESS}:${destinationTag}`);
      // PERF: Pre-generate QR code in background (fire-and-forget)
      cacheQRCode(XRP_MASTER_ADDRESS, walletType, destinationTag);
      return poolAddress;
    }

    // ──────────────────────────────────────────────────────────────
    // STANDARD CHAINS: Generate individual address (with retry)
    // ──────────────────────────────────────────────────────────────
    const MAX_TATUM_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    let xpub: string;
    let mnemonic: string;
    let derivationIndex: number;
    let addressData: any;
    let encryptedPrivateKey: string;

    // Retry wrapper for transient Tatum API failures
    for (let attempt = 1; attempt <= MAX_TATUM_RETRIES; attempt++) {
      try {
        const walletResult = await getOrCreateMerchantWallet(userId, walletType);
        xpub = walletResult.xpub;
        mnemonic = walletResult.mnemonic;

        derivationIndex = await getNextDerivationIndex(userId, walletType, transaction);

        addressData = await tatumApi.generateUserAddress({
          currency: walletType,
          xpub,
          mnemonic,
          index: derivationIndex,
        });

        if (!addressData || !addressData.address) {
          throw new Error(`Failed to generate address for ${walletType} at index ${derivationIndex}`);
        }

        encryptedPrivateKey = await tatumApi.encryptSymmetric(
          addressData.privateKey,
          envRaw("TEMP_KEY_ID")
        );

        break; // Success — exit retry loop
      } catch (retryErr) {
        const errMsg = getErrorMessage(retryErr);
        if (attempt < MAX_TATUM_RETRIES) {
          cronLogger.warn(`[MerchantPool] Tatum API attempt ${attempt}/${MAX_TATUM_RETRIES} failed for ${walletType} (merchant ${userId}): ${errMsg}. Retrying in ${RETRY_DELAY_MS * attempt}ms...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        } else {
          cronLogger.error(`[MerchantPool] All ${MAX_TATUM_RETRIES} Tatum API attempts failed for ${walletType} (merchant ${userId}): ${errMsg}`);
          throw retryErr;
        }
      }
    }

    let subscriptionId = null;
    try {
      const subResult = await tatumApi.createSubscription(
        addressData.address,
        walletType,
        true
      );
      subscriptionId = subResult?.id;
    } catch (subError) {
      cronLogger.error(`[MerchantPool] Warning: Failed to create subscription for ${addressData.address}:`, subError);
    }

    const poolAddress = await merchantTempAddressModel.create(
      {
        owner_user_id: userId,
        wallet_type: walletType,
        wallet_address: addressData.address,
        private_key: encryptedPrivateKey,
        derivation_index: derivationIndex,
        subscription_id: subscriptionId,
        status: "AVAILABLE",
        admin_fee_balance: 0,
        gas_balance: 0,
        total_transactions: 0,
      },
      { transaction }
    );

    cronLogger.info(`[MerchantPool] ✅ Added ${walletType} address to merchant ${userId}'s pool: ${addressData.address}`);
    // PERF: Pre-generate QR code in background (fire-and-forget)
    cacheQRCode(addressData.address, walletType);
    return poolAddress;
  } catch (error) {
    const message = getErrorMessage(error);
    cronLogger.error(`[MerchantPool] ❌ Failed to add address to pool:`, message);
    throw error;
  }
};

/**
 * Initialize merchant's pool for a specific wallet type
 */
export const initializeMerchantPool = async (
  userId: number,
  walletType: string
): Promise<void> => {
  const transaction = await sequelize.transaction();

  try {
    const existingCount = await merchantTempAddressModel.count({
      where: {
        owner_user_id: userId,
        wallet_type: walletType,
      },
      transaction,
    });

    if (existingCount >= POOL_CONFIG.INITIAL_SIZE) {
      cronLogger.info(`[MerchantPool] Pool already exists for merchant ${userId}, type ${walletType}`);
      await transaction.commit();
      return;
    }

    const toCreate = POOL_CONFIG.INITIAL_SIZE - existingCount;
    cronLogger.info(`[MerchantPool] Creating ${toCreate} ${walletType} addresses for merchant ${userId}...`);

    for (let i = 0; i < toCreate; i++) {
      await addAddressToMerchantPool(userId, walletType, transaction);
    }

    await transaction.commit();
    cronLogger.info(`[MerchantPool] ✅ Initialized ${walletType} pool for merchant ${userId}`);
  } catch (error) {
    await transaction.rollback();
    const message = getErrorMessage(error);
    cronLogger.error(`[MerchantPool] ❌ Failed to initialize pool:`, message);
    throw error;
  }
};


/**
 * Pre-warm pool addresses for active merchants.
 * 
 * Checks each merchant+chain combination that has been used before.
 * If AVAILABLE count is below MIN_AVAILABLE, creates new addresses
 * in the background so the next payment request has an address ready.
 * 
 * This eliminates the ~3-4s Tatum API call bottleneck during payment creation.
 */
export const prewarmPoolAddresses = async (): Promise<{
  checked: number;
  created: number;
  errors: string[];
}> => {
  const result = { checked: 0, created: 0, errors: [] as string[] };
  
  try {
    // Find all distinct merchant+chain combos that have pool addresses
    const activePoolGroups = await merchantTempAddressModel.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('owner_user_id')), 'owner_user_id'],
        'wallet_type',
      ],
      where: {
        owner_user_id: { [Op.ne]: null },
      },
      group: ['owner_user_id', 'wallet_type'],
      raw: true,
    }) as unknown as Array<{ owner_user_id: number; wallet_type: string }>;

    // Quiet mode: skip logging when nothing to check
    if (activePoolGroups.length > 0) {
      cronLogger.info(`[PreWarm] Checking ${activePoolGroups.length} merchant+chain combinations...`);
    }

    for (const group of activePoolGroups) {
      result.checked++;
      const { owner_user_id: userId, wallet_type: walletType } = group;

      try {
        // Count currently AVAILABLE addresses for this merchant+chain
        const availableCount = await merchantTempAddressModel.count({
          where: {
            owner_user_id: userId,
            wallet_type: walletType,
            status: 'AVAILABLE',
          },
        });

        if (availableCount >= POOL_CONFIG.MIN_AVAILABLE) {
          continue; // Already has enough available addresses
        }

        const toCreate = POOL_CONFIG.MIN_AVAILABLE - availableCount;
        cronLogger.info(`[PreWarm] 🔥 Merchant ${userId} / ${walletType}: ${availableCount} available, creating ${toCreate} more...`);

        for (let i = 0; i < toCreate; i++) {
          try {
            await addAddressToMerchantPool(userId, walletType);
            result.created++;
            cronLogger.info(`[PreWarm] ✅ Created pre-warmed ${walletType} address for merchant ${userId}`);
          } catch (createError) {
            const msg = getErrorMessage(createError);
            cronLogger.error(`[PreWarm] ❌ Failed to create ${walletType} for merchant ${userId}: ${msg}`);
            result.errors.push(`${walletType}:${userId} - ${msg}`);
          }
        }
      } catch (groupError) {
        const msg = getErrorMessage(groupError);
        result.errors.push(`Check ${walletType}:${userId} - ${msg}`);
      }
    }

    // Quiet mode: only log when addresses were created or errors occurred
    if (result.created > 0 || result.errors.length > 0) {
      cronLogger.info(`[PreWarm] Complete: checked=${result.checked}, created=${result.created}, errors=${result.errors.length}`);
    }
  } catch (error) {
    const msg = getErrorMessage(error);
    cronLogger.error(`[PreWarm] ❌ Pre-warming failed:`, msg);
    result.errors.push(msg);
  }

  return result;
};

/**
 * Retry trust line creation for RLUSD addresses stuck in PENDING_TRUSTLINE status.
 * Called periodically by the prewarm cron or a dedicated cron job.
 */
export const retryPendingTrustLines = async (): Promise<{
  retried: number;
  succeeded: number;
  errors: string[];
}> => {
  const result = { retried: 0, succeeded: 0, errors: [] as string[] };
  
  try {
    const pendingAddresses = await merchantTempAddressModel.findAll({
      where: {
        wallet_type: "RLUSD",
        status: "PENDING_TRUSTLINE",
      },
    });

    if (pendingAddresses.length === 0) return result;

    // FIX: Backoff for unactivated XRP fee wallet — avoid retrying every 3 min when wallet has 0 XRP
    const xrpFeeWallet = envRaw("XRP_FEE_WALLET") || envRaw("XRP");
    const backoffKey = `trustline-backoff:fee-wallet-not-activated`;
    const backoffEntry = await getRedisItem(backoffKey);
    if (backoffEntry && Object.keys(backoffEntry).length > 0) {
      // Silently skip — backoff is active (fee wallet was recently confirmed not activated)
      return result;
    }

    cronLogger.info(`[TrustLineRetry] Found ${pendingAddresses.length} RLUSD addresses with pending trust lines`);

    const rlusdIssuer = RLUSD_CONFIG.issuer;
    const rlusdCurrencyHex = RLUSD_CONFIG.currencyHex;

    for (const addr of pendingAddresses) {
      result.retried++;
      const walletAddress = addr.dataValues.wallet_address;
      
      try {
        // First check if account is activated
        const isActivated = await tatumApi.verifyXrpAccountActivated(walletAddress);
        if (!isActivated) {
          // Try to fund the account
          const xrpFeeWallet = envRaw("XRP_FEE_WALLET") || envRaw("XRP");
          if (!xrpFeeWallet) {
            cronLogger.info(`[TrustLineRetry] ⏭️ Skipping ${walletAddress} — no XRP fee wallet configured`);
            result.errors.push(`${walletAddress}: No XRP fee wallet configured`);
            continue;
          }

          const { adminFeeModel } = await import("../../models");
          const xrpFeeWalletRecord = await adminFeeModel.findOne({ where: { wallet_type: "XRP" } });
          if (!xrpFeeWalletRecord) {
            cronLogger.info(`[TrustLineRetry] ⏭️ Skipping ${walletAddress} — XRP fee wallet not found in DB`);
            result.errors.push(`${walletAddress}: XRP fee wallet not found in DB`);
            continue;
          }

          // Check if fee wallet itself is activated and has enough balance
          let feeWalletActivated = false;
          try {
            feeWalletActivated = await tatumApi.verifyXrpAccountActivated(xrpFeeWallet);
          } catch {
            feeWalletActivated = false;
          }
          if (!feeWalletActivated) {
            cronLogger.info(`[TrustLineRetry] ⏭️ Skipping ${walletAddress} — XRP fee wallet (${xrpFeeWallet.substring(0, 10)}...) is not activated yet. Backing off for 1 hour.`);
            result.errors.push(`${walletAddress}: XRP fee wallet not activated`);
            // FIX: Set backoff for 1 hour to avoid noisy retries every 3 min
            await setRedisItemWithTTL(backoffKey, { reason: 'XRP fee wallet not activated', wallet: xrpFeeWallet, checkedAt: new Date().toISOString() }, 3600);
            continue;
          }

          try {
            // MEMORY HARDENING: fee-wallet key scoped to the signing call.
            await keyCustody.withPrivateKey(
              xrpFeeWalletRecord.dataValues.privateKey,
              envRaw("TEMP_KEY_ID"),
              { purpose: "trustline_gas_funding", actor: "worker", walletType: "XRP", walletAddress: xrpFeeWallet },
              (xrpFeePrivateKey) => tatumApi.assetToOtherAddress({
                currency: "XRP",
                fromAddress: xrpFeeWallet,
                toAddress: walletAddress,
                privateKey: xrpFeePrivateKey,
                amount: 2,
                fee: null,
              })
            );
            cronLogger.info(`[TrustLineRetry] Funded ${walletAddress} with 2 XRP`);
          } catch (fundErr: unknown) {
            const fundMsg = (fundErr as { message?: string })?.message || '';
            // If funding fails (fee wallet not activated, insufficient balance, etc.), skip this address
            if (fundMsg.includes('account.failed') || fundMsg.includes('Account not found') ||
                fundMsg.includes('not.found') || fundMsg.includes('Unable to sign') ||
                fundMsg.includes('insufficient') || fundMsg.includes('tecUNFUNDED')) {
              cronLogger.info(`[TrustLineRetry] ⏭️ Skipping ${walletAddress} — funding failed: ${fundMsg.substring(0, 100)}`);
              result.errors.push(`${walletAddress}: Funding failed — ${fundMsg.substring(0, 80)}`);
              continue;
            }
            throw fundErr;
          }
          
          // Wait for activation
          await new Promise(resolve => setTimeout(resolve, 8000));
        }

        // Check if trust line already exists
        const hasTrustLine = await tatumApi.verifyXrpTrustLine(walletAddress, rlusdIssuer, rlusdCurrencyHex);
        if (hasTrustLine) {
          cronLogger.info(`[TrustLineRetry] ✅ Trust line already exists for ${walletAddress}, marking AVAILABLE`);
          await addr.update({ status: "AVAILABLE" });
          result.succeeded++;
          continue;
        }

        // Trust line creation — key scoped to the signing call.
        await keyCustody.withPrivateKey(
          addr.dataValues.private_key,
          envRaw("TEMP_KEY_ID"),
          { purpose: "trustline_setup", actor: "worker", walletType: "XRP", walletAddress },
          (privateKey) => tatumApi.setupXrpTrustLine(
            walletAddress,
            privateKey,
            rlusdIssuer,
            rlusdCurrencyHex,
            "999999999"
          )
        );
        
        cronLogger.info(`[TrustLineRetry] ✅ Trust line established for ${walletAddress}`);
        await addr.update({ status: "AVAILABLE" });
        result.succeeded++;
      } catch (error) {
        const msg = getErrorMessage(error);
        cronLogger.error(`[TrustLineRetry] ❌ Failed for ${walletAddress}: ${msg}`);
        result.errors.push(`${walletAddress}: ${msg}`);
      }
    }

    cronLogger.info(`[TrustLineRetry] Complete: retried=${result.retried}, succeeded=${result.succeeded}, errors=${result.errors.length}`);
  } catch (error) {
    const msg = getErrorMessage(error);
    cronLogger.error(`[TrustLineRetry] ❌ Retry job failed:`, msg);
    result.errors.push(msg);
  }

  return result;
};
