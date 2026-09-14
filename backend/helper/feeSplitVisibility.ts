/**
 * B12 / F1 — whether buyers see the merchant/Dynopay fee split.
 *   null  → auto: shown only when the customer pays the fee (they are charged it)
 *   true  → always shown (checkout, success card, receipt e-mail + PDF)
 *   false → never shown
 */
export const shouldShowFeeSplit = (
  company: { show_fee_split_to_customers?: boolean | null } | null | undefined,
  feePayer: string | null | undefined
): boolean => {
  const pref = company?.show_fee_split_to_customers;
  if (pref === true) return true;
  if (pref === false) return false;
  return String(feePayer || "company") === "customer";
};
