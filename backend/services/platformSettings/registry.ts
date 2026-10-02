/**
 * Platform Settings — typed registry (Deliverable 2, Phase 1).
 *
 * A single source of truth for every admin-managed configuration key. Each
 * entry declares its group, type, validation, code default and the .env var it
 * mirrors (`envKey`). Resolution order at read time (see ./index.ts) is:
 *
 *     DB override  →  process.env[envKey]  →  code default
 *
 * so .env keeps working unchanged and keys can be migrated one at a time.
 *
 * `editable:true`  → the read-site reads through the settings service, so a DB
 *                    override takes effect live (hot-reload, no redeploy).
 * `editable:false` → shown read-only with its effective value + source; still
 *                    managed in .env until migrated in a later phase.
 */

export type SettingType = "boolean" | "number" | "string" | "enum" | "csv";

export interface SettingDef {
  key: string;
  group: string;
  label: string;
  description?: string;
  type: SettingType;
  /** The .env var this mirrors. null for pure-DB keys (e.g. kill switches). */
  envKey: string | null;
  /** Last-resort code default when no override and no env value. */
  default: unknown;
  enumValues?: string[];
  min?: number;
  max?: number;
  unit?: string;
  /** Can an admin change it from the dashboard (live hot-reload)? */
  editable: boolean;
  /** Require a fresh step-up (TOTP) grant to change. Default true for editable. */
  requiresStepUp?: boolean;
  /** A destructive / money-movement control (kill switches). */
  danger?: boolean;
  /** Never echo the value back to the client (show masked). */
  secret?: boolean;
}

export interface GroupMeta {
  id: string;
  label: string;
  description?: string;
}

export const GROUPS: GroupMeta[] = [
  { id: "kill_switches", label: "Kill switches & maintenance", description: "Stop money movement instantly. Changes apply live across the platform." },
  { id: "fees", label: "Fees & pricing", description: "Platform transaction fees and pricing rules." },
  { id: "limits", label: "Order & checkout limits", description: "Minimum order amounts and checkout timing." },
  { id: "safedeal", label: "SafeDeal / escrow", description: "Escrow economics, withdrawal and AML risk limits." },
  { id: "compliance", label: "Compliance / KYC", description: "KYC thresholds, grace periods and exemptions." },
  { id: "security", label: "Security policy", description: "Account lockout, session and token policy." },
  { id: "flags", label: "Feature flags", description: "Toggle platform capabilities." },
  { id: "treasury", label: "Treasury & sweeps", description: "Sweep thresholds and fee-wallet bands." },
  { id: "alerts", label: "Alerting & routing", description: "Where operational alerts are delivered." },
  { id: "branding", label: "Branding & legal", description: "Sender identities and legal copy." },
];

const def = (d: SettingDef): SettingDef => ({ requiresStepUp: d.editable, ...d });

export const REGISTRY: SettingDef[] = [
  // ── Kill switches (pure DB, live, wired into the money flows) ──────────────
  def({ key: "killswitch.maintenance_mode", group: "kill_switches", label: "Maintenance mode", description: "Reject new checkouts platform-wide and show the maintenance message.", type: "boolean", envKey: null, default: false, editable: true, danger: true }),
  def({ key: "killswitch.maintenance_message", group: "kill_switches", label: "Maintenance message", description: "Shown to payers while maintenance mode is on.", type: "string", envKey: null, default: "We're doing some quick maintenance and will be back shortly.", editable: true, requiresStepUp: false, max: 280 }),
  def({ key: "killswitch.pause_checkouts", group: "kill_switches", label: "Pause new checkouts", description: "Stop creating new crypto payments. In-flight payments still settle.", type: "boolean", envKey: null, default: false, editable: true, danger: true }),
  def({ key: "killswitch.pause_settlements", group: "kill_switches", label: "Pause settlements", description: "Defer merchant settlement broadcasts. Payments stay confirmed and settle once resumed.", type: "boolean", envKey: null, default: false, editable: true, danger: true }),
  def({ key: "killswitch.pause_cashouts", group: "kill_switches", label: "Pause SafeDeal cashouts", description: "Block new customer-initiated cashouts. Deal-release payouts are unaffected.", type: "boolean", envKey: null, default: false, editable: true, danger: true }),

  // ── Fees & pricing ─────────────────────────────────────────────────────────
  def({ key: "fees.transaction_fee_percent", group: "fees", label: "Transaction fee", description: "Base platform fee applied to crypto payments.", type: "number", envKey: "TRANSACTION_FEE_PERCENT", default: 1.5, min: 0, max: 50, unit: "%", editable: true }),
  def({ key: "fees.checkout_min_fee_multiple", group: "fees", label: "Checkout min-fee multiple", type: "number", envKey: "CHECKOUT_MIN_FEE_MULTIPLE", default: 1, editable: false }),
  def({ key: "fees.free_trial_volume_usd", group: "fees", label: "Free-trial volume", type: "number", envKey: "FREE_TRIAL_VOLUME_USD", default: 0, unit: "USD", editable: false }),
  def({ key: "fees.platform_fee_exempt_company_ids", group: "fees", label: "Fee-exempt company IDs", description: "Comma-separated company IDs exempt from platform fees.", type: "csv", envKey: "PLATFORM_FEE_EXEMPT_COMPANY_IDS", default: "", editable: false }),

  // ── Order & checkout limits (live) ──────────────────────────────────────────
  def({ key: "limits.min_order_store_usd", group: "limits", label: "Min order — Store", type: "number", envKey: "MIN_ORDER_STORE_USD", default: 10, min: 1, max: 100000, unit: "USD", editable: true }),
  def({ key: "limits.min_order_api_usd", group: "limits", label: "Min order — API", type: "number", envKey: "MIN_ORDER_API_USD", default: 5, min: 1, max: 100000, unit: "USD", editable: true }),
  def({ key: "limits.min_order_buy_button_usd", group: "limits", label: "Min order — Buy button", type: "number", envKey: "MIN_ORDER_BUY_BUTTON_USD", default: 5, min: 1, max: 100000, unit: "USD", editable: true }),
  def({ key: "limits.min_order_payment_link_usd", group: "limits", label: "Min order — Payment link", type: "number", envKey: "MIN_ORDER_PAYMENT_LINK_USD", default: 1, min: 1, max: 100000, unit: "USD", editable: true }),
  def({ key: "limits.reservation_timeout_minutes", group: "limits", label: "Reservation timeout", type: "number", envKey: "RESERVATION_TIMEOUT_MINUTES", default: 30, unit: "min", editable: false }),
  def({ key: "limits.max_pending_age_hours", group: "limits", label: "Max pending age", type: "number", envKey: "MAX_PENDING_AGE_HOURS", default: 24, unit: "h", editable: false }),

  // ── SafeDeal / escrow ───────────────────────────────────────────────────────
  def({ key: "safedeal.min_withdrawal_usd", group: "safedeal", label: "Minimum cashout", type: "number", envKey: "SAFEDEAL_MIN_WITHDRAWAL_USD", default: 10, min: 1, max: 100000, unit: "USD", editable: true }),
  def({ key: "safedeal.withdrawal_approval_usd", group: "safedeal", label: "Cashout approval threshold", description: "Single cashouts at or above this route to admin approval.", type: "number", envKey: "SAFEDEAL_WITHDRAWAL_APPROVAL_USD", default: 1000, min: 1, max: 1000000, unit: "USD", editable: true }),
  def({ key: "safedeal.velocity_cap_usd", group: "safedeal", label: "24h velocity cap", description: "Rolling 24h cashout total over this routes to admin approval (AML).", type: "number", envKey: "SAFEDEAL_VELOCITY_CAP_USD", default: 1000, min: 1, max: 1000000, unit: "USD", editable: true }),
  def({ key: "safedeal.fee_percent", group: "safedeal", label: "Escrow fee", type: "number", envKey: "ESCROW_FEE_PERCENT", default: 5, unit: "%", editable: false }),
  def({ key: "safedeal.fee_min_usd", group: "safedeal", label: "Escrow fee minimum", type: "number", envKey: "ESCROW_FEE_MIN_USD", default: 10, unit: "USD", editable: false }),
  def({ key: "safedeal.min_deal_usd", group: "safedeal", label: "Minimum deal", type: "number", envKey: "ESCROW_MIN_DEAL_USD", default: 30, unit: "USD", editable: false }),
  def({ key: "safedeal.max_deal_eur", group: "safedeal", label: "Maximum deal", type: "number", envKey: "ESCROW_MAX_DEAL_EUR", default: 2999, unit: "EUR", editable: false }),
  def({ key: "safedeal.cancellation_fee_percent", group: "safedeal", label: "Cancellation fee", type: "number", envKey: "SAFEDEAL_CANCELLATION_FEE_PERCENT", default: 0, unit: "%", editable: false }),
  def({ key: "safedeal.address_cooling_hours", group: "safedeal", label: "Address cooling period", type: "number", envKey: "SAFEDEAL_ADDRESS_COOLING_HOURS", default: 0, unit: "h", editable: false }),
  def({ key: "safedeal.dispute_auto_escalate_hours", group: "safedeal", label: "Dispute auto-escalate", type: "number", envKey: "ESCROW_DISPUTE_AUTO_ESCALATE_HOURS", default: 72, unit: "h", editable: false }),
  def({ key: "safedeal.max_revision_rounds", group: "safedeal", label: "Max revision rounds", type: "number", envKey: "ESCROW_MAX_REVISION_ROUNDS", default: 3, editable: false }),

  // ── Compliance / KYC ────────────────────────────────────────────────────────
  def({ key: "compliance.kyc_threshold_usd", group: "compliance", label: "KYC threshold", type: "number", envKey: "KYC_THRESHOLD_USD", default: 1000, unit: "USD", editable: false }),
  def({ key: "compliance.kyc_grace_period_days", group: "compliance", label: "KYC grace period", type: "number", envKey: "KYC_GRACE_PERIOD_DAYS", default: 30, unit: "days", editable: false }),
  def({ key: "compliance.kyc_exempt_user_ids", group: "compliance", label: "KYC-exempt user IDs", type: "csv", envKey: "KYC_EXEMPT_USER_IDS", default: "", editable: false }),
  def({ key: "compliance.kyc_exempt_company_ids", group: "compliance", label: "KYC-exempt company IDs", type: "csv", envKey: "KYC_EXEMPT_COMPANY_IDS", default: "", editable: false }),

  // ── Security policy ──────────────────────────────────────────────────────────
  def({ key: "security.account_lockout_max_attempts", group: "security", label: "Lockout max attempts", type: "number", envKey: "ACCOUNT_LOCKOUT_MAX_ATTEMPTS", default: 5, editable: false }),
  def({ key: "security.account_lockout_window_minutes", group: "security", label: "Lockout window", type: "number", envKey: "ACCOUNT_LOCKOUT_WINDOW_MINUTES", default: 15, unit: "min", editable: false }),
  def({ key: "security.account_lockout_duration_minutes", group: "security", label: "Lockout duration", type: "number", envKey: "ACCOUNT_LOCKOUT_DURATION_MINUTES", default: 15, unit: "min", editable: false }),
  def({ key: "security.max_2fa_failed_attempts", group: "security", label: "Max 2FA failures", type: "number", envKey: "MAX_2FA_FAILED_ATTEMPTS", default: 5, editable: false }),
  def({ key: "security.max_concurrent_sessions", group: "security", label: "Max concurrent sessions", type: "number", envKey: "MAX_CONCURRENT_SESSIONS", default: 10, editable: false }),
  def({ key: "security.refresh_token_expiry_days", group: "security", label: "Refresh token expiry", type: "number", envKey: "REFRESH_TOKEN_EXPIRY_DAYS", default: 30, unit: "days", editable: false }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  def({ key: "flags.enable_crypto_refunds", group: "flags", label: "Crypto refunds", type: "boolean", envKey: "ENABLE_CRYPTO_REFUNDS", default: false, editable: false }),
  def({ key: "flags.escrow_live_settlement", group: "flags", label: "Escrow live settlement", type: "boolean", envKey: "ESCROW_LIVE_SETTLEMENT", default: false, editable: false }),
  def({ key: "flags.safedeal_allow_simulation", group: "flags", label: "SafeDeal simulation", type: "boolean", envKey: "SAFEDEAL_ALLOW_SIMULATION", default: false, editable: false }),
  def({ key: "flags.admin_notify_new_user", group: "flags", label: "Notify admin on new user", type: "boolean", envKey: "ADMIN_NOTIFY_NEW_USER", default: false, editable: false }),
  def({ key: "flags.storefront_per_company", group: "flags", label: "Per-company storefront", type: "boolean", envKey: "STOREFRONT_PER_COMPANY", default: false, editable: false }),
  def({ key: "flags.enable_product_catalog", group: "flags", label: "Product catalog", type: "boolean", envKey: "NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG", default: false, editable: false }),

  // ── Treasury & sweeps ─────────────────────────────────────────────────────────
  def({ key: "treasury.btc_threshold", group: "treasury", label: "BTC sweep threshold", type: "number", envKey: "BTC_THRESHOLD", default: 5, editable: false }),
  def({ key: "treasury.eth_threshold", group: "treasury", label: "ETH sweep threshold", type: "number", envKey: "ETH_THRESHOLD", default: 5, editable: false }),
  def({ key: "treasury.trx_threshold", group: "treasury", label: "TRX sweep threshold", type: "number", envKey: "TRX_THRESHOLD", default: 5, editable: false }),
  def({ key: "treasury.polygon_threshold", group: "treasury", label: "Polygon sweep threshold", type: "number", envKey: "POLYGON_THRESHOLD", default: 5, editable: false }),
  def({ key: "treasury.eth_fee_wallet_warning", group: "treasury", label: "ETH fee-wallet warning", type: "number", envKey: "ETH_FEE_WALLET_WARNING", default: 0.05, unit: "ETH", editable: false }),
  def({ key: "treasury.trx_fee_wallet_warning", group: "treasury", label: "TRX fee-wallet warning", type: "number", envKey: "TRX_FEE_WALLET_WARNING", default: 60, unit: "TRX", editable: false }),

  // ── Alerting & routing ──────────────────────────────────────────────────────
  def({ key: "alerts.admin_email", group: "alerts", label: "Admin email", type: "string", envKey: "ADMIN_EMAIL", default: "", editable: false }),
  def({ key: "alerts.ops_emails", group: "alerts", label: "Ops emails", type: "csv", envKey: "OPS_EMAILS", default: "", editable: false }),
  def({ key: "alerts.alert_channel", group: "alerts", label: "Alert channel", type: "string", envKey: "ALERT_CHANNEL", default: "", editable: false }),
  def({ key: "alerts.slack_webhook_url", group: "alerts", label: "Slack webhook URL", type: "string", envKey: "SLACK_WEBHOOK_URL", default: "", editable: false, secret: true }),
  def({ key: "alerts.discord_webhook_url", group: "alerts", label: "Discord webhook URL", type: "string", envKey: "DISCORD_WEBHOOK_URL", default: "", editable: false, secret: true }),

  // ── Branding & legal ────────────────────────────────────────────────────────
  def({ key: "branding.app_name", group: "branding", label: "App name", type: "string", envKey: "APP_NAME", default: "Dynopay", editable: false }),
  def({ key: "branding.email_legal_name", group: "branding", label: "Email legal name", type: "string", envKey: "EMAIL_LEGAL_NAME", default: "", editable: false }),
  def({ key: "branding.safedeal_legal_name", group: "branding", label: "SafeDeal legal name", type: "string", envKey: "SAFEDEAL_LEGAL_NAME", default: "", editable: false }),
  def({ key: "branding.safedeal_sender_email", group: "branding", label: "SafeDeal sender email", type: "string", envKey: "SAFEDEAL_SENDER_EMAIL", default: "", editable: false }),
  def({ key: "branding.brevo_sender_email", group: "branding", label: "Brevo sender email", type: "string", envKey: "BREVO_SENDER_EMAIL", default: "", editable: false }),
];

const BY_KEY: Record<string, SettingDef> = Object.fromEntries(REGISTRY.map((d) => [d.key, d]));

export const getDef = (key: string): SettingDef | undefined => BY_KEY[key];

/** Parse a .env string into the setting's typed value. */
export const coerceEnv = (d: SettingDef, envVal: string): unknown => {
  const v = envVal.trim();
  switch (d.type) {
    case "number": {
      const n = Number(v);
      return Number.isFinite(n) ? n : d.default;
    }
    case "boolean":
      return ["1", "true", "yes", "on"].includes(v.toLowerCase());
    case "csv":
    case "string":
    case "enum":
    default:
      return v;
  }
};

/** Normalise a DB-stored (jsonb) value to the setting's declared type. */
export const coerceValue = (d: SettingDef, stored: unknown): unknown => {
  switch (d.type) {
    case "number": {
      const n = Number(stored);
      return Number.isFinite(n) ? n : d.default;
    }
    case "boolean":
      return stored === true || stored === "true" || stored === 1 || stored === "1";
    default:
      return stored == null ? "" : String(stored);
  }
};
