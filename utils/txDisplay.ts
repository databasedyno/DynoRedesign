/**
 * Transaction display helpers — keep merchant-facing rows clean and aligned.
 *
 * Auto-provisioned API/recovered customers are stored with a synthetic name
 * ("Legacy API Customer" / "Recovered Customer") and an internal placeholder
 * email (…@dynopay.internal / …@dynopay.local). Showing those raw looks rough
 * in the Transactions table, so we detect them and render a tidy "via API"
 * label instead of a fake identity.
 */

const INTERNAL_EMAIL_DOMAINS = ["@dynopay.internal", "@dynopay.local"];
const SYNTHETIC_NAMES = ["legacy api customer", "recovered customer"];

/** True when the customer is an auto-generated placeholder (no real identity). */
export const isSyntheticCustomer = (
  name?: string | null,
  email?: string | null,
): boolean => {
  const e = (email || "").trim().toLowerCase();
  if (e && INTERNAL_EMAIL_DOMAINS.some((d) => e.endsWith(d))) return true;
  if (e.startsWith("legacy-api-") || e.startsWith("recovered-")) return true;
  const n = (name || "").trim().toLowerCase();
  return SYNTHETIC_NAMES.includes(n);
};
