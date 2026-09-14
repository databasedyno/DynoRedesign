/**
 * Security Event Logger
 * Logs security-related events for monitoring and incident response
 */

import { raw as envRaw } from "./config";
import { createLogger, format, transports } from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize } = format;

// Custom format for security logs
const securityLogFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    log += ` | ${JSON.stringify(metadata)}`;
  }
  
  return log;
});

// Security logger configuration
const securityLogger = createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    securityLogFormat
  ),
  transports: [
    // Write to security-specific log file
    new transports.File({
      filename: path.join(__dirname, '../logs/security.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    // Also write errors to separate file
    new transports.File({
      filename: path.join(__dirname, '../logs/security-errors.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});

// Add console transport in development
if (envRaw("NODE_ENV") !== 'production') {
  securityLogger.add(new transports.Console({
    format: combine(
      colorize(),
      securityLogFormat
    )
  }));
}

/**
 * Log authentication attempt
 */
export const logAuthAttempt = (
  success: boolean,
  email: string,
  ip: string,
  userAgent: string,
  reason?: string
): void => {
  const level = success ? 'info' : 'warn';
  securityLogger.log(level, `Authentication ${success ? 'success' : 'failure'}`, {
    event: 'auth_attempt',
    success,
    email,
    ip,
    userAgent,
    reason
  });
};

/**
 * Log password reset request
 */
export const logPasswordReset = (
  email: string,
  ip: string,
  success: boolean
): void => {
  securityLogger.info('Password reset requested', {
    event: 'password_reset',
    email,
    ip,
    success
  });
};

/**
 * Log admin action
 */
export const logAdminAction = (
  adminId: number,
  action: string,
  targetId: string | number,
  ip: string,
  details?: Record<string, unknown>
): void => {
  securityLogger.info('Admin action performed', {
    event: 'admin_action',
    adminId,
    action,
    targetId,
    ip,
    ...details
  });
};

/**
 * Log privilege escalation attempt
 */
export const logPrivilegeEscalation = (
  userId: number,
  attemptedAction: string,
  ip: string,
  details?: string
): void => {
  securityLogger.warn('Privilege escalation attempt', {
    event: 'privilege_escalation',
    userId,
    attemptedAction,
    ip,
    details
  });
};

/**
 * Log large payment
 */
export const logLargePayment = (
  amount: number,
  currency: string,
  companyId: number,
  userId: number,
  transactionId: string
): void => {
  securityLogger.info('Large payment detected', {
    event: 'large_payment',
    amount,
    currency,
    companyId,
    userId,
    transactionId
  });
};

/**
 * Log wallet address change
 */
export const logWalletChange = (
  userId: number,
  companyId: number,
  oldAddress: string,
  newAddress: string,
  currency: string,
  ip: string
): void => {
  securityLogger.info('Wallet address updated', {
    event: 'wallet_change',
    userId,
    companyId,
    oldAddress,
    newAddress,
    currency,
    ip
  });
};

/**
 * Log API key generation
 */
export const logApiKeyGeneration = (
  userId: number,
  companyId: number,
  apiKeyId: number,
  ip: string
): void => {
  securityLogger.info('API key generated', {
    event: 'api_key_generated',
    userId,
    companyId,
    apiKeyId,
    ip
  });
};

/**
 * Log suspicious activity
 */
export const logSuspiciousActivity = (
  type: string,
  description: string,
  userId: number | null,
  ip: string,
  metadata?: Record<string, unknown>
): void => {
  securityLogger.warn('Suspicious activity detected', {
    event: 'suspicious_activity',
    type,
    description,
    userId,
    ip,
    ...metadata
  });
};

/**
 * Log rate limit exceeded
 */
export const logRateLimitExceeded = (
  identifier: string,
  endpoint: string,
  ip: string,
  limit: number
): void => {
  securityLogger.warn('Rate limit exceeded', {
    event: 'rate_limit_exceeded',
    identifier,
    endpoint,
    ip,
    limit
  });
};

/**
 * Log CSRF token validation failure
 */
export const logCsrfFailure = (
  ip: string,
  endpoint: string,
  userAgent: string
): void => {
  securityLogger.warn('CSRF validation failed', {
    event: 'csrf_failure',
    ip,
    endpoint,
    userAgent
  });
};

/**
 * Log webhook signature validation failure
 */
export const logWebhookValidationFailure = (
  webhookType: string,
  ip: string,
  reason: string
): void => {
  securityLogger.warn('Webhook validation failed', {
    event: 'webhook_validation_failure',
    webhookType,
    ip,
    reason
  });
};

/**
 * Log account lockout
 */
export const logAccountLockout = (
  email: string,
  ip: string,
  reason: string
): void => {
  securityLogger.warn('Account locked out', {
    event: 'account_lockout',
    email,
    ip,
    reason
  });
};

/**
 * Log successful payment
 */
export const logPaymentSuccess = (
  companyId: number,
  amount: number,
  currency: string,
  transactionId: string,
  paymentMethod: string
): void => {
  securityLogger.info('Payment completed', {
    event: 'payment_success',
    companyId,
    amount,
    currency,
    transactionId,
    paymentMethod
  });
};

/**
 * Log payment failure
 */
export const logPaymentFailure = (
  companyId: number,
  amount: number,
  currency: string,
  reason: string
): void => {
  securityLogger.warn('Payment failed', {
    event: 'payment_failure',
    companyId,
    amount,
    currency,
    reason
  });
};

export default {
  logAuthAttempt,
  logPasswordReset,
  logAdminAction,
  logPrivilegeEscalation,
  logLargePayment,
  logWalletChange,
  logApiKeyGeneration,
  logSuspiciousActivity,
  logRateLimitExceeded,
  logCsrfFailure,
  logWebhookValidationFailure,
  logAccountLockout,
  logPaymentSuccess,
  logPaymentFailure
};
