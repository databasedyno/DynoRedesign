/**
 * Core Type Definitions for Dynopay Application
 * 
 * This file contains all TypeScript interfaces and types used throughout
 * the application to replace 'any' types and improve type safety.
 * 
 * @file types/index.ts
 * @date 2026-02-03
 */

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export interface UserData {
  user_id: number;
  email: string;
  name: string;
  username?: string;
  phone?: string;
  role: 'user' | 'admin';
  is_verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  userData: UserData;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  username: string;
  phone?: string;
}

export interface OTPData {
  email?: string;
  phone?: string;
  otp: string;
  type: 'email' | 'phone';
  expiresAt: Date;
}

// ============================================================================
// COMPANY TYPES
// ============================================================================

export interface CompanyData {
  company_id: number;
  user_id: number;
  company_name: string;
  email: string;
  mobile?: string;
  country: string;
  vat_number?: string;
  vat_verified?: boolean;
  vat_type?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  logo?: string;
  website?: string;
  backend_url?: string;
  company_currency?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyUpdateData {
  company_name?: string;
  email?: string;
  mobile?: string;
  country?: string;
  vat_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  logo?: string;
  website?: string;
  backend_url?: string;
  company_currency?: string;
}

export interface TaxValidationResult {
  valid: boolean;
  vat_number: string;
  country_code: string;
  company_name?: string;
  company_address?: string;
  vat_type?: string;
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'expired' | 'cancelled' | 'failed';
export type PaymentMode = 'exact_amount' | 'min_amount' | 'custom_amount';
export type FeePaymentOption = 'customer' | 'company';

export interface PaymentLinkData {
  payment_id: string;
  company_id: number;
  user_id: number;
  currency: string;
  amount: number;
  min_amount?: number;
  mode: PaymentMode;
  description?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  status: PaymentStatus;
  expires_at?: Date;
  callback_url?: string;
  webhook_url?: string;
  redirect_url?: string;
  fee_payment: FeePaymentOption;
  tax_applicable: boolean;
  tax_rate?: number;
  tax_amount?: number;
  is_merchant_pool?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentLinkRequest {
  company_id: number;
  currency: string;
  amount: number;
  min_amount?: number;
  mode: PaymentMode;
  description?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  expires_at?: string;
  callback_url?: string;
  webhook_url?: string;
  redirect_url?: string;
  fee_payment?: FeePaymentOption;
  is_merchant_pool?: boolean;
}

export interface PaymentLinkResponse {
  payment_id: string;
  payment_url: string;
  qr_code?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  expires_at?: Date;
}

// ============================================================================
// CRYPTO TRANSACTION TYPES
// ============================================================================

export type CryptoCurrency = 'BTC' | 'ETH' | 'TRX' | 'LTC' | 'DOGE' | 'BCH' | 'USDT-TRC20' | 'USDT-ERC20' | 'USDC-ERC20' | 'SOL' | 'XRP' | 'RLUSD' | 'RLUSD-ERC20' | 'POLYGON' | 'USDT-POLYGON';
export type TransactionStatus = 'pending' | 'confirming' | 'confirmed' | 'failed';

export interface CryptoTransaction {
  transaction_id: string;
  payment_id: string;
  txHash: string;
  from_address: string;
  to_address: string;
  amount: string;
  currency: CryptoCurrency;
  confirmations: number;
  required_confirmations: number;
  status: TransactionStatus;
  block_number?: number;
  timestamp: Date;
  fee?: string;
}

export interface BlockchainWebhookPayload {
  event: 'transaction' | 'confirmation' | 'success' | 'failed';
  txHash: string;
  from: string;
  to: string;
  value: string;
  currency: CryptoCurrency;
  confirmations: number;
  blockNumber?: number;
  timestamp: number;
}

export interface CryptoPaymentVerificationResult {
  verified: boolean;
  txHash: string;
  amount: string;
  currency: CryptoCurrency;
  confirmations: number;
  status: TransactionStatus;
  merchant_amount?: string;
  admin_amount?: string;
}

// ============================================================================
// WALLET TYPES
// ============================================================================

export type WalletType = 'user' | 'temp' | 'merchant_pool';
export type WalletStatus = 'active' | 'inactive' | 'locked';

export interface WalletData {
  wallet_id: string;
  user_id?: number;
  company_id?: number;
  wallet_address: string;
  private_key?: string; // Encrypted
  currency: CryptoCurrency;
  balance: string;
  wallet_type: WalletType;
  status: WalletStatus;
  last_sync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletBalanceResponse {
  wallet_address: string;
  currency: CryptoCurrency;
  balance: string;
  balance_usd: number;
  last_updated: Date;
}

export interface TransactionHistoryItem {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  currency: CryptoCurrency;
  type: 'incoming' | 'outgoing';
  status: TransactionStatus;
  timestamp: Date;
  confirmations: number;
}

export interface TransactionHistory {
  transactions: TransactionHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// API KEY TYPES
// ============================================================================

export type ApiStatus = 'active' | 'inactive' | 'suspended';

export interface ApiKeyData {
  api_id: string;
  company_id: number;
  api_key: string;
  api_secret?: string;
  name?: string;
  description?: string;
  status: ApiStatus;
  rate_limit: number;
  allowed_ips?: string[];
  webhook_url?: string;
  permissions?: string[];
  last_used_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  company_id: number;
  name: string;
  description?: string;
  rate_limit?: number;
  allowed_ips?: string[];
  webhook_url?: string;
  permissions?: string[];
}

export interface ApiKeyResponse {
  api_id: string;
  api_key: string;
  api_secret: string;
  name: string;
  status: ApiStatus;
  rate_limit: number;
  createdAt: Date;
}

export interface ApiUsageStats {
  api_id: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  last_7_days: number[];
  rate_limit: number;
  current_usage: number;
}

// ============================================================================
// FEE & TAX TYPES
// ============================================================================

export interface FeeTier {
  min: number;
  max: number | null;
  fixed: number;
}

export interface FeeCalculationResult {
  fixedFee: number;
  transactionFee: number;
  totalDeduction: number;
  minForwarding: number;
}

export interface TaxRate {
  country_code: string;
  country_name: string;
  standard_rate: number;
  reduced_rates?: number[];
  applies_to_crypto: boolean;
}

export interface TaxCalculation {
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  tax_applicable: boolean;
  vat_number?: string;
}

// ============================================================================
// DASHBOARD & ANALYTICS TYPES
// ============================================================================

export interface DashboardStats {
  total_payments: number;
  total_volume: number;
  total_volume_usd: number;
  completed_payments: number;
  pending_payments: number;
  failed_payments: number;
  success_rate: number;
  average_payment_value: number;
  total_fees_collected: number;
  currency_breakdown: CurrencyStats[];
  daily_stats: DailyStats[];
}

export interface CurrencyStats {
  currency: CryptoCurrency;
  total_volume: string;
  total_volume_usd: number;
  payment_count: number;
  percentage: number;
}

export interface DailyStats {
  date: string;
  payment_count: number;
  total_volume_usd: number;
  completed: number;
  pending: number;
  failed: number;
}

// ============================================================================
// REFERRAL TYPES
// ============================================================================

export type ReferralStatus = 'pending' | 'active' | 'expired';
export type RewardStatus = 'pending' | 'paid' | 'cancelled';

export interface ReferralData {
  referral_id: string;
  referrer_user_id: number;
  referral_code: string;
  total_referrals: number;
  active_referrals: number;
  total_earnings: number;
  status: ReferralStatus;
  expires_at?: Date;
  createdAt: Date;
}

export interface RefereeData {
  referee_id: string;
  referral_code: string;
  referee_user_id: number;
  referee_email: string;
  signup_date: Date;
  first_payment_date?: Date;
  total_payments: number;
  status: 'active' | 'inactive';
}

export interface ReferralReward {
  reward_id: string;
  referrer_user_id: number;
  referee_user_id: number;
  reward_amount: number;
  reward_type: 'signup' | 'first_payment' | 'milestone';
  status: RewardStatus;
  paid_at?: Date;
  createdAt: Date;
}

// ============================================================================
// KYC TYPES
// ============================================================================

export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected';
export type DocumentType = 'passport' | 'drivers_license' | 'national_id' | 'proof_of_address';

export interface KycData {
  kyc_id: string;
  user_id: number;
  company_id?: number;
  status: KycStatus;
  document_type?: DocumentType;
  document_number?: string;
  document_front?: string;
  document_back?: string;
  selfie_photo?: string;
  proof_of_address?: string;
  submission_date?: Date;
  review_date?: Date;
  reviewer_notes?: string;
  rejection_reason?: string;
}

export interface KycSubmission {
  user_id: number;
  company_id?: number;
  document_type: DocumentType;
  document_number: string;
  document_front: string;
  document_back?: string;
  selfie_photo: string;
  proof_of_address?: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type NotificationType = 'email' | 'sms' | 'push' | 'webhook';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'bounced';

export interface NotificationData {
  notification_id: string;
  user_id?: number;
  company_id?: number;
  type: NotificationType;
  recipient: string;
  subject?: string;
  message: string;
  status: NotificationStatus;
  sent_at?: Date;
  error_message?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface EmailNotification {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

// ============================================================================
// INVOICE TYPES
// ============================================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceData {
  invoice_id: string;
  invoice_number: string;
  company_id: number;
  payment_id?: string;
  customer_name: string;
  customer_email: string;
  customer_address?: string;
  amount: number;
  currency: string;
  vat_rate?: number;
  vat_amount?: number;
  total_amount: number;
  status: InvoiceStatus;
  issue_date: Date;
  due_date?: Date;
  paid_date?: Date;
  notes?: string;
  pdf_url?: string;
  createdAt: Date;
}

// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'paused';
export type BillingInterval = 'monthly' | 'quarterly' | 'yearly';

export interface SubscriptionData {
  subscription_id: string;
  company_id: number;
  plan_id: string;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  amount: number;
  currency: string;
  start_date: Date;
  end_date?: Date;
  next_billing_date?: Date;
  cancelled_at?: Date;
  auto_renew: boolean;
}

export interface SubscriptionPlan {
  plan_id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_quarterly: number;
  price_yearly: number;
  features: string[];
  max_payment_links?: number;
  max_api_calls?: number;
  transaction_fee_discount?: number;
}

// ============================================================================
// ADMIN TYPES
// ============================================================================

export interface AdminFeeSummary {
  total_fees_collected: number;
  total_transactions: number;
  fee_by_currency: Record<CryptoCurrency, number>;
  fee_by_date: Array<{
    date: string;
    amount: number;
  }>;
}

export interface AdminSettings {
  setting_id: string;
  key: string;
  value: string | number | boolean;
  description?: string;
  updatedAt: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
  blockchain_nodes: Record<CryptoCurrency, 'online' | 'offline'>;
  last_check: Date;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: Date;
  path?: string;
}

// ============================================================================
// EXPRESS REQUEST EXTENSIONS
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: UserData;
      company?: CompanyData;
      api_key?: ApiKeyData;
    }
  }
}

export {};
