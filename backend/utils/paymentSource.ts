/**
 * Payment-source classification.
 *
 * Derives HOW a payment was made from the payment-link presence + link_type
 * captured on the checkout session at settlement, so merchant/buyer emails and
 * in-app notifications can state the source (API, payment link, product order,
 * donation campaign, tip/contribution).
 *
 * Keys match the i18n catalog keys under `paymentSource.*` in locales/<lang>/emails.json.
 */
export type PaymentSourceKey =
  | "api"
  | "paymentLink"
  | "productOrder"
  | "donation"
  | "tip";

export const classifyPaymentSource = (opts: {
  linkId?: number | string | null;
  linkType?: string | null;
}): PaymentSourceKey => {
  const lt = String(opts.linkType || "").trim().toLowerCase();
  if (lt === "cart") return "productOrder";
  if (lt === "donation") return "donation";
  if (lt === "contribution") return "tip"; // creator tip jar + campaign contributions
  const hasLink =
    opts.linkId !== undefined && opts.linkId !== null && String(opts.linkId).length > 0;
  return hasLink ? "paymentLink" : "api";
};
