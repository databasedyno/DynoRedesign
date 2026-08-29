/**
 * Shared checkout types — extracted from CleanCheckoutV2 (Session refactor).
 * Pure type declarations; no runtime code. Reused by the checkout controller
 * and its presentational sub-components.
 */

/** Payload we hold in local state after `/pay/getData` resolves. */
export type Meta = {
  amount: number
  base_currency: string
  // Who covers the processing fee — 'company' (merchant absorbs) or 'customer'
  // (added on top). MUST be forwarded to /pay/getCurrencyRates so the charged
  // crypto amount includes fees for customer-pays links; otherwise the merchant
  // silently eats the fee (addPayment deducts it from the settled amount).
  fee_payer?: string
  // Tax amount in base_currency (0 when the link has no tax / not applicable).
  tax_amount?: number
  // Estimated processing fee (base_currency) returned by getData for customer-pays
  // links, shown before the exact per-coin fee is known after crypto selection.
  estimated_fee?: number
  available_currencies: string[]
  token: string
  link_type?: string
  description?: string | null
  order_reference?: string | null
  customer_name?: string | null
  contribution?: {
    campaign_title?: string | null
    parent_link_id?: number | null
    donor_name?: string | null
    donor_message?: string | null
    is_anonymous?: boolean | null
  } | null
  merchant?: {
    name?: string | null
    company_name?: string | null
    company_logo?: string | null
  } | null
}

export type CryptoInfo = {
  address: string
  qr_code: string
  memo: string
  expected_amount: number
  crypto_display: string
  crypto_base: string
  network: string
}

export type Phase =
  | 'loading_meta'
  | 'currency_select'
  | 'creating_payment'
  | 'awaiting_payment'
  | 'confirmed'
  | 'underpaid'
  | 'expired'
  | 'failed'
  | 'error'

export type PaymentUri = { uri: string } | null
