import { raw as envRaw } from "../../utils/config";
/**
 * Centralized payment configuration constants.
 * Extracted verbatim from paymentController.ts (no behavior change).
 */

export const PAYMENT_TIMING = {
  // Crypto invoice window - time to complete payment after selecting currency
  CRYPTO_INVOICE_MINUTES: 15,

  // Grace period for partial/underpayment completion
  GRACE_PERIOD_MINUTES: 30,

  // Redis TTL for soft-deleted payment data (matches grace period)
  REDIS_SOFT_DELETE_TTL_SECONDS: 30 * 60, // 1800 seconds

  // Default payment link expiry options
  LINK_EXPIRY: {
    '24h': 24 * 60,        // 24 hours in minutes
    '7d': 7 * 24 * 60,     // 7 days in minutes (default)
    '30d': 30 * 24 * 60,   // 30 days in minutes
    'never': null,
  },

  // Webhook/confirmation timeouts
  TRANSACTION_CONFIRMATION_TIMEOUT_MS: 90000, // 90 seconds

  // SQL interval constants (for parameterized queries)
  SQL_INTERVALS: {
    GRACE_PERIOD: '30 minutes',
    CRYPTO_INVOICE: '15 minutes',
    RECENT_TRANSACTIONS: '2 days',
    MONTHLY_TRANSACTIONS: '30 days',
  },
};

// ============================================
// CENTRALIZED ADMIN CONFIGURATION
// ============================================
export const ADMIN_CONFIG = {
  // Admin email for notifications (from env, no hardcoded fallback exposed)
  EMAIL: envRaw("ADMIN_EMAIL") || envRaw("SMTP_USER") || '',

  // JWT expiry times
  JWT_EXPIRY: {
    ADMIN: '30d',
    USER: '7d',
    API_KEY: '365d',
    CHECKOUT: '1h',
  },
};

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 2000,
};

// Tax calculation constants
export const TAX_DATA_API_URL = envRaw("TAX_DATA_API_URL") || "https://api.apilayer.com/tax_data";
export const TAX_DATA_API_KEY = envRaw("TAX_DATA_API_KEY");
