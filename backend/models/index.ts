import adminFeeModel from "./adminFeeModel";
import adminFeeTransactionModel from "./adminFeeTransactionModel";
import adminTransferFeeModel from "./adminTransferFeeModel";
import adminWalletModel from "./adminWalletModel";
import { apiModel, planModel, subscriptionModel } from "./apiModels";
import { companyModel } from "./companyModels";

import {
  customerModel,
  customerTransactionModel,
  customerWalletModel,
} from "./customerModels";
import feesModel from "./feesModel";
import {
  paymentLinkModel,
  userModel,
  userTempAddressModel,
  userTransactionModel,
  userWalletModel,
  userWalletAddressModel,
  userExchangeModel,
} from "./userModels";

// Phase 1: New models
import taxRateModel from "./taxRateModel";
import invoiceModel from "./invoiceModel";
import notificationModel from "./notificationModel";
import notificationPreferencesModel from "./notificationPreferencesModel";
import kycModel from "./kycModel";
import webhookDeliveryLogModel from "./webhookDeliveryLogModel";

// Referral models
import referralModel from "./referralModels/referralModel";
import referralRewardModel from "./referralModels/referralRewardModel";
import refereeCodeModel from "./referralModels/refereeCodeModel";

// Knowledge Base models
import kbCategoryModel from "./knowledgeBaseModels/kbCategoryModel";
import supportChatMessageModel from "./supportChatModel";
import kbArticleModel from "./knowledgeBaseModels/kbArticleModel";

// Stablecoin Conversion
import stablecoinConversionModel from "./stablecoinConversionModel";

// Push Subscriptions
import pushSubscriptionModel from "./pushSubscriptionModel";

// Onboarding analytics
import onboardingEventModel from "./onboardingEventModel";

// Login Activity
import loginActivityModel from "./loginActivityModel";

// USDT Pool System models (legacy - to be deprecated)
import {
  usdtPoolAddressModel,
  usdtPoolTransactionModel,
  usdtPoolSweepModel,
} from "./usdtPoolModels";

// Merchant Pool System models (new per-merchant pool)
import {
  merchantWalletModel,
  merchantTempAddressModel,
  merchantPoolTransactionModel,
  merchantPoolSweepModel,
  MERCHANT_POOL_CRYPTO_TYPES,
  CHAIN_XPUB_MAPPING,
  UTXO_CHAINS,
  ACCOUNT_CHAINS,
  TOKEN_CHAINS,
  GAS_TOKEN_MAPPING,
  NON_HD_CHAINS,
} from "./merchantPoolModels";

export {
  apiModel,
  adminFeeModel,
  planModel,
  feesModel,
  subscriptionModel,
  userModel,
  companyModel,
  userWalletModel,
  adminFeeTransactionModel,
  adminTransferFeeModel,
  adminWalletModel,
  customerModel,
  customerWalletModel,
  paymentLinkModel,
  customerTransactionModel,
  userWalletAddressModel,
  userTransactionModel,
  userTempAddressModel,
  userExchangeModel,
  // Phase 1: New models
  taxRateModel,
  invoiceModel,
  notificationModel,
  notificationPreferencesModel,
  kycModel,
  webhookDeliveryLogModel,
  // Referral models
  referralModel,
  referralRewardModel,
  refereeCodeModel,
  // Knowledge Base models
  kbCategoryModel,
  kbArticleModel,
  // AI Support Chat
  supportChatMessageModel,
  // USDT Pool System models (legacy)
  usdtPoolAddressModel,
  usdtPoolTransactionModel,
  usdtPoolSweepModel,
  // Merchant Pool System models (new)
  merchantWalletModel,
  merchantTempAddressModel,
  merchantPoolTransactionModel,
  merchantPoolSweepModel,
  MERCHANT_POOL_CRYPTO_TYPES,
  CHAIN_XPUB_MAPPING,
  UTXO_CHAINS,
  ACCOUNT_CHAINS,
  TOKEN_CHAINS,
  GAS_TOKEN_MAPPING,
  NON_HD_CHAINS,
  // Stablecoin Conversion
  stablecoinConversionModel,
  // Push Subscriptions
  pushSubscriptionModel,
  // Onboarding analytics
  onboardingEventModel,
  // Login Activity
  loginActivityModel,
};
