/**
 * mapBackendErrorToField — shared helper for translating a backend `message`
 * (e.g. from `errorResponseHelper`) into a client-side form-field id, so
 * sagas can dispatch a field-hinted error and the UI can surface the message
 * inline next to the offending field instead of a toast-only message.
 *
 * Design: DUMB, message-driven. Each caller passes its own keyword map
 * (usually a small array of `{ keywords, field }` entries). The first entry
 * whose ANY keyword matches (case-insensitive substring) wins. If none match,
 * we return `{ field: 'generic', friendly: rawMessage }` and the caller
 * shows a toast only.
 *
 * This intentionally does NOT parse structured errors from the backend —
 * Dynopay backend uses `errorResponseHelper` which returns `{message: '...'}`
 * only, so keyword matching is what we have.
 */

export interface FieldMatchRule<F extends string = string> {
  /** Field id that MUST match a form field in the caller UI. */
  field: F;
  /** ANY of these substrings (case-insensitive) matching the backend message triggers this field. */
  keywords: string[];
}

export interface FieldMatchResult<F extends string = string> {
  field: F | "generic";
  friendly: string;
}

/**
 * Generic mapper. First rule with a keyword hit wins.
 */
export function mapBackendErrorToField<F extends string>(
  rawMessage: string | undefined | null,
  rules: FieldMatchRule<F>[],
): FieldMatchResult<F> {
  const msg = (rawMessage || "").toLowerCase();
  if (!msg) return { field: "generic", friendly: "" };

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (msg.includes(kw.toLowerCase())) {
        return { field: rule.field, friendly: rawMessage as string };
      }
    }
  }

  return { field: "generic", friendly: rawMessage as string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain-specific keyword maps.
// Sources of truth: matching backend controllers (paymentLinkController,
// walletController, companyController, addressController, etc.). Update the
// arrays when new validation messages are added on the backend.
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentLinkField =
  | "value"
  | "currency"
  | "description"
  | "expire"
  | "customer_email"
  | "webhook_url"
  | "redirect_url"
  | "callback_url"
  | "accepted_currencies"
  | "company_id"
  | "kyc";

export const paymentLinkKeywordMap: FieldMatchRule<PaymentLinkField>[] = [
  { field: "value", keywords: ["amount is required", "amount must be", "amount ", "goal_amount", "min_amount", "preset_amounts"] },
  { field: "currency", keywords: ["invalid currency", "invalid base_currency", "base_currency"] },
  { field: "description", keywords: ["description", "story_md", "organizer_thanks"] },
  { field: "expire", keywords: ["expire"] },
  { field: "customer_email", keywords: ["email format", "valid email"] },
  { field: "webhook_url", keywords: ["webhook_url", "webhook url"] },
  { field: "redirect_url", keywords: ["redirect_url", "redirect url"] },
  { field: "callback_url", keywords: ["callback_url", "callback url"] },
  { field: "accepted_currencies", keywords: ["payment mode", "cryptocurrency", "accepted_currencies", "no wallet configured", "wallet configured"] },
  { field: "company_id", keywords: ["company_id", "company does not belong", "invalid company"] },
  { field: "kyc", keywords: ["kyc_required", "kyc verification"] },
];

// Wallet — AddWalletModal / validateWalletAddress
export type WalletField =
  | "walletName"
  | "walletAddress"
  | "currency"
  | "kyc"
  | "company_id"
  | "otp";

export const walletKeywordMap: FieldMatchRule<WalletField>[] = [
  { field: "walletAddress", keywords: ["invalid address", "invalid wallet", "address is not valid", "malformed", "already registered", "address already exists", "already added"] },
  { field: "walletName", keywords: ["wallet name", "name is required", "name already"] },
  { field: "currency", keywords: ["unsupported", "unknown currency", "invalid cryptocurrency", "invalid currency"] },
  { field: "kyc", keywords: ["kyc_required", "kyc verification", "kyc pending", "kyc required"] },
  { field: "company_id", keywords: ["company_id", "invalid company"] },
  { field: "otp", keywords: ["otp", "one-time password", "one time password", "invalid code", "expired code", "incorrect otp"] },
];

// Company — CreateCompanyModal / addCompany + updateCompany
export type CompanyField =
  | "company_name"
  | "first_name"
  | "last_name"
  | "email"
  | "mobile"
  | "website"
  | "country"
  | "currency"
  | "tax_id"
  | "image";

export const companyKeywordMap: FieldMatchRule<CompanyField>[] = [
  { field: "company_name", keywords: ["company name", "company_name", "name is required", "already exists"] },
  { field: "email", keywords: ["email format", "valid email", "email is required", "email already"] },
  { field: "mobile", keywords: ["mobile", "phone number", "phone_number"] },
  { field: "website", keywords: ["website", "valid url", "invalid url"] },
  { field: "country", keywords: ["country", "country_code", "invalid country"] },
  { field: "currency", keywords: ["currency", "invalid currency"] },
  { field: "tax_id", keywords: ["tax_id", "tax id", "vat", "gst", "tin "] },
  { field: "image", keywords: ["image", "logo", "file size", "file type", "invalid file"] },
  { field: "first_name", keywords: ["first name", "first_name"] },
  { field: "last_name", keywords: ["last name", "last_name"] },
];
