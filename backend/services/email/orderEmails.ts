import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { t as tr, normalizeLang, resolveEmailLang } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, sendEmail } from "./emailShared";
import { isMerchantIdentityVerified } from "../../helper/merchantVerification";

/**
 * Format a cents integer to a currency-symbol prefixed string.
 * (e.g. 1250 in USD -> "$12.50 USD")
 */
const formatCents = (cents: number | string | null | undefined, currency: string = "USD"): string => {
  const amount = Number(cents || 0) / 100;
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toFixed(2)} ${currency}`;
};

/**
 * Escape untrusted strings for embedding in HTML email bodies.
 * (kept as an alias to escapeHtml for backward compatibility with existing
 * order/product-catalog templates below that already reference `esc()`.)
 */
const esc = escapeHtml;

/**
 * Render the shared order line-items table used by both receipt templates.
 */
function renderOrderItemsTable(
  order: any,
  items: any[],
  opts: { includeDeliveryLinks: boolean; merchantVatId?: string | null; lang?: string }
): string {
  const L = opts.lang;
  const currency = order.currency || "USD";
  // Per-Country Tax Receipts Label (2026-08-23n): the order row stores the
  // buyer-country acronym (VAT / GST / IVA / TVA / Tax…) via cartController →
  // taxService::calculateTax. Use it verbatim on the totals row so receipts
  // read correctly no matter the merchant's country. Falls back to plain
  // "Tax" for un-mapped countries (matches the taxData TAX_TYPE_ACRONYMS
  // default).
  const rawTaxLabel = typeof order.tax_label === "string" && order.tax_label.trim()
    ? order.tax_label.trim()
    : "Tax";
  const taxRatePct = Number(order.tax_rate);
  const taxLabelWithRate = Number.isFinite(taxRatePct) && taxRatePct > 0
    ? `${esc(rawTaxLabel)} <span style="color:#9ca3af;font-weight:400;">(${taxRatePct}%)</span>`
    : esc(rawTaxLabel);
  const reverseCharge = !!order.reverse_charge;
  const rows = items
    .map((it: any) => {
      const snap = it.product_snapshot || {};
      const vSnap = it.variant_snapshot;
      const attrText = vSnap && vSnap.attributes
        ? Object.entries(vSnap.attributes).map(([k, v]) => `${esc(k)}: ${esc(String(v))}`).join(", ")
        : "";
      const productLine = `<strong>${esc(snap.title || tr('orderTable.item', L))}</strong>${attrText ? ` <span style="color:#6b7280;font-size:13px;"> (${attrText})</span>` : ""}`;
      let deliveryHtml = "";
      if (opts.includeDeliveryLinks && it.delivered_payload) {
        const dp = it.delivered_payload;
        if (Array.isArray(dp.asset_deliveries) && dp.asset_deliveries.length > 0) {
          deliveryHtml = `<div style="margin-top:6px;">` +
            dp.asset_deliveries.map((a: any) =>
              `<a href="${esc(a.download_url)}" style="color:#05936A;font-weight:600;text-decoration:none;">⬇ ${tr('orderTable.download', L)} ${esc(a.filename)}</a>`
            ).join("<br/>") +
            `</div>`;
        } else if (dp.license_key) {
          deliveryHtml = `<div style="margin-top:6px;font-family:monospace;background:#f3f4f6;padding:6px 8px;border-radius:6px;font-size:13px;">${tr('orderTable.licenseKey', L)} ${esc(dp.license_key)}</div>`;
        } else if (dp.access_url) {
          deliveryHtml = `<div style="margin-top:6px;"><a href="${esc(dp.access_url)}" style="color:#05936A;font-weight:600;">${tr('orderTable.accessPurchase', L)}</a></div>`;
        } else if (dp.calendar_url) {
          deliveryHtml = `<div style="margin-top:6px;"><a href="${esc(dp.calendar_url)}" style="color:#05936A;font-weight:600;">${tr('orderTable.bookSession', L)}</a></div>`;
        }
      }
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
            ${productLine}
            ${deliveryHtml}
          </td>
          <td style="padding:12px;text-align:center;border-bottom:1px solid #e5e7eb;">${it.quantity}</td>
          <td style="padding:12px;text-align:right;border-bottom:1px solid #e5e7eb;font-family:monospace;">${formatCents(it.line_total_cents, currency)}</td>
        </tr>`;
    })
    .join("");

  const totals = `
    <tr><td style="padding:8px 12px;text-align:right;color:#6b7280;">${tr('orderTable.subtotal', L)}</td><td colspan="2" style="padding:8px 12px;text-align:right;font-family:monospace;">${formatCents(order.subtotal_cents, currency)}</td></tr>
    ${Number(order.shipping_cents) > 0 ? `<tr><td style="padding:8px 12px;text-align:right;color:#6b7280;">${tr('orderTable.shipping', L)}</td><td colspan="2" style="padding:8px 12px;text-align:right;font-family:monospace;">${formatCents(order.shipping_cents, currency)}</td></tr>` : ""}
    ${Number(order.tax_cents) > 0 ? `<tr><td style="padding:8px 12px;text-align:right;color:#6b7280;">${taxLabelWithRate}${order.tax_inclusive ? ` <span style="color:#9ca3af;font-size:11px;">· ${tr('orderTable.inclusive', L)}</span>` : ""}</td><td colspan="2" style="padding:8px 12px;text-align:right;font-family:monospace;">${formatCents(order.tax_cents, currency)}</td></tr>` : ""}
    ${reverseCharge ? `<tr><td style="padding:6px 12px;text-align:right;color:#6b7280;font-size:12px;" colspan="3">${esc(rawTaxLabel)} — ${tr('orderTable.reverseCharge', L)}</td></tr>` : ""}
    <tr><td style="padding:12px;text-align:right;font-weight:700;border-top:2px solid #111827;">${tr('orderTable.total', L)}</td><td colspan="2" style="padding:12px;text-align:right;font-family:monospace;font-weight:700;border-top:2px solid #111827;">${formatCents(order.total_cents, currency)}</td></tr>
    ${opts.merchantVatId ? `<tr><td style="padding:8px 12px;text-align:right;color:#6b7280;font-size:11.5px;" colspan="3">${tr('orderTable.merchantTaxId', L, { label: esc(rawTaxLabel) })} <span style="font-family:monospace;color:#374151;">${esc(opts.merchantVatId)}</span></td></tr>` : ""}
  `;

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Product</th>
          <th style="padding:12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Qty</th>
          <th style="padding:12px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>${totals}</tfoot>
    </table>`;
}

/**
 * Template — buyer order receipt (post-payment).
 * Sent to the customer once a cart order transitions to `paid`.
 */
export const sendOrderReceiptEmail = async (
  buyerEmail: string,
  buyerName: string,
  order: any,
  items: any[],
  orderPublicUrl: string,
  merchantVatId?: string | null,
) => {
  try {
    const L = normalizeLang(order?.locale || "en");
    const shortRef = String(order.public_ref || "").slice(0, 8).toUpperCase();
    const subject = tr('orderReceipt.subject', L, { ref: shortRef });

    const itemsTable = renderOrderItemsTable(order, items, { includeDeliveryLinks: true, merchantVatId, lang: L });
    const hasDigital = items.some((i: any) => (i.product_snapshot?.product_type || "digital") === "digital");
    const hasPhysical = items.some((i: any) => i.product_snapshot?.product_type === "physical");

    // "Verified Everywhere": buyer-trust line when the selling merchant is
    // KYC-identity-verified. Resolved from the order's owner; safe no-op (no
    // line) when unverified or the lookup fails.
    const merchantVerified = await isMerchantIdentityVerified(
      order?.merchant_user_id,
      order?.company_id ?? null,
    );
    const verifiedLine = merchantVerified
      ? p(`<span style="display:inline-flex;align-items:center;gap:6px;color:#12B76A;font-weight:600;">&#10003; ${tr('receipt.verifiedMerchant', L)}</span>`)
      : "";

    const message = `
      ${p(tr('orderReceipt.thanks', L))}
      ${verifiedLine}
      ${infoBox(`${tr('orderReceipt.orderReference', L)} <strong style="font-family:monospace;">${esc(order.public_ref)}</strong>`)}
      ${itemsTable}
      ${hasDigital ? p(`${tr('orderReceipt.digitalNote', L)} <a href="${esc(orderPublicUrl)}" style="color:#05936A;">${tr('orderReceipt.openOrderPage', L)}</a>.`) : ""}
      ${hasPhysical ? p(tr('orderReceipt.physicalNote', L)) : ""}
      ${p(`<a href="${esc(orderPublicUrl)}" style="color:#05936A;font-weight:600;">${tr('orderReceipt.viewOrderDetails', L)}</a>`)}
    `;

    // Address the buyer by their real name only — never by their raw email
    // (the greeting template gracefully falls back to a friendly generic).
    const html = dynoPayGreetingTemplate(buyerName, message, tr('orderReceipt.heading', L), false, L);
    await mailTransporter({ to: buyerEmail, name: buyerName || buyerEmail, subject, body: html });
    apiLogger.info(`[email] sent order receipt to ${buyerEmail} for order ${order.order_id}`);
  } catch (e) {
    captureError(e, "email", { extraContext: "sendOrderReceiptEmail", buyerEmail } as any);
  }
};

/**
 * Template — merchant sale notification (post-payment).
 * Sent to the merchant once a cart order transitions to `paid`.
 */
export const sendOrderReceiptMerchantEmail = async (
  merchantEmail: string,
  merchantName: string,
  order: any,
  items: any[],
  orderPublicUrl: string,
  merchantVatId?: string | null,
) => {
  try {
    const name = merchantName || "there";
    const shortRef = String(order.public_ref || "").slice(0, 8).toUpperCase();
    const subject = `New sale — ${formatCents(order.total_cents, order.currency || "USD")} — Dynopay`;
    const itemsTable = renderOrderItemsTable(order, items, { includeDeliveryLinks: false, merchantVatId });

    const buyerBlock = infoBox(`
      <strong>Buyer</strong><br/>
      ${esc(order.buyer_name || "(no name)")}<br/>
      ${esc(order.buyer_email)}
      ${order.buyer_phone ? `<br/>${esc(order.buyer_phone)}` : ""}
    `);

    const shippingBlock = order.shipping_address
      ? infoBox(`
        <strong>Shipping address</strong><br/>
        ${esc(order.shipping_address.line1 || "")}${order.shipping_address.line2 ? `<br/>${esc(order.shipping_address.line2)}` : ""}<br/>
        ${esc(order.shipping_address.city || "")}, ${esc(order.shipping_address.region || "")} ${esc(order.shipping_address.postal_code || "")}<br/>
        ${esc(order.shipping_address.country_code || "")}
      `)
      : "";

    const message = `
      ${p(`You just made a new sale! Order <strong style="font-family:monospace;">${esc(shortRef)}</strong> has been paid in full and settled to your wallet.`)}
      ${buyerBlock}
      ${shippingBlock}
      ${itemsTable}
      ${p(`<a href="${esc(orderPublicUrl)}" style="color:#05936A;font-weight:600;">Open in dashboard →</a>`)}
    `;

    const html = dynoPayGreetingTemplate(name, message, `You just made a sale`, false);
    await mailTransporter({ to: merchantEmail, name, subject, body: html });
    apiLogger.info(`[email] sent merchant sale notification to ${merchantEmail} for order ${order.order_id}`);
  } catch (e) {
    captureError(e, "email", { extraContext: "sendOrderReceiptMerchantEmail", merchantEmail } as any);
  }
};

/**
 * Template — buyer order EXPIRED.
 * Sent when a `payment_status='pending'` cart order passes its payment-link
 * expires_at without settling. The `cron_expire_cart_orders` job triggers
 * this so buyers know why their download links never arrived. Includes a
 * "restart your order" link back to the shop.
 */
export const sendOrderExpiredEmail = async (
  buyerEmail: string,
  buyerName: string,
  order: any,
  items: any[],
  shopUrl: string
) => {
  try {
    const name = buyerName || buyerEmail || "there";
    const shortRef = String(order.public_ref || "").slice(0, 8).toUpperCase();
    const subject = `Your order ${shortRef} was not completed — Dynopay`;
    const itemsTable = renderOrderItemsTable(order, items, { includeDeliveryLinks: false });

    const message = `
      ${p(`It looks like your recent order was not paid before the checkout window closed, so we've released it and returned the items to the shop's stock.`)}
      ${infoBox(`Order reference: <strong style="font-family:monospace;">${esc(order.public_ref)}</strong>`)}
      ${itemsTable}
      ${p(`If this was intentional — no worries. If you still want these items, you can start a fresh cart:`)}
      ${p(`<a href="${esc(shopUrl)}" style="color:#05936A;font-weight:600;">Return to the shop →</a>`)}
    `;

    const html = dynoPayGreetingTemplate(name, message, `Order not completed`, false);
    await mailTransporter({ to: buyerEmail, name, subject, body: html });
    apiLogger.info(`[email] sent order expired to ${buyerEmail} for order ${order.order_id}`);
  } catch (e) {
    captureError(e, "email", { extraContext: "sendOrderExpiredEmail", buyerEmail } as any);
  }
};

/**
 * Template — buyer order REFUNDED.
 * Sent when a merchant clicks "Mark refunded" on an order in their dashboard.
 * Crypto refunds are handled off-chain — this email is the confirmation.
 */
export const sendOrderRefundedEmail = async (
  buyerEmail: string,
  buyerName: string,
  order: any,
  items: any[],
  reason: string | null,
  orderPublicUrl: string
) => {
  try {
    const name = buyerName || buyerEmail || "there";
    const shortRef = String(order.public_ref || "").slice(0, 8).toUpperCase();
    const subject = `Refund confirmed for order ${shortRef} — Dynopay`;
    const itemsTable = renderOrderItemsTable(order, items, { includeDeliveryLinks: false });
    const reasonBlock = reason
      ? infoBox(`<strong>Merchant note:</strong> ${esc(reason)}`)
      : "";

    const message = `
      ${p(`Your recent order has been refunded by the merchant. Depending on the network, the crypto refund may take a few blocks to appear in your wallet.`)}
      ${infoBox(`Order reference: <strong style="font-family:monospace;">${esc(order.public_ref)}</strong>`)}
      ${reasonBlock}
      ${itemsTable}
      ${p(`<a href="${esc(orderPublicUrl)}" style="color:${EMAIL_TOKENS.brand};font-weight:600;">View order status →</a>`)}
    `;

    const html = dynoPayGreetingTemplate(name, message, `Refund confirmed`, false);
    await mailTransporter({ to: buyerEmail, name, subject, body: html });
    apiLogger.info(`[email] sent refund confirmation to ${buyerEmail} for order ${order.order_id}`);
  } catch (e) {
    captureError(e, "email", { extraContext: "sendOrderRefundedEmail", buyerEmail } as any);
  }
};

/**
 * Template — buyer order SHIPPED (physical goods, Phase 2 hook).
 * Sent when a merchant marks a physical line item as shipped and enters a
 * tracking number + carrier. The route to trigger this is not wired in Phase 1
 * (physical checkout isn't shipped yet) but the template is present so Phase 2
 * only needs to call it.
 */
export const sendOrderShippedEmail = async (
  buyerEmail: string,
  buyerName: string,
  order: any,
  trackingInfo: { carrier?: string; tracking_number?: string; estimated_delivery?: string },
  orderPublicUrl: string
) => {
  try {
    const name = buyerName || buyerEmail || "there";
    const shortRef = String(order.public_ref || "").slice(0, 8).toUpperCase();
    const subject = `Your order ${shortRef} has shipped — Dynopay`;

    const trackingBlock = infoBox(`
      <strong>Tracking details</strong><br/>
      ${trackingInfo.carrier ? `Carrier: ${esc(trackingInfo.carrier)}<br/>` : ""}
      ${trackingInfo.tracking_number ? `Tracking #: <span style="font-family:monospace;">${esc(trackingInfo.tracking_number)}</span><br/>` : ""}
      ${trackingInfo.estimated_delivery ? `Estimated delivery: ${esc(trackingInfo.estimated_delivery)}` : ""}
    `);

    const message = `
      ${p(`Great news — your order is on its way!`)}
      ${infoBox(`Order reference: <strong style="font-family:monospace;">${esc(order.public_ref)}</strong>`)}
      ${trackingBlock}
      ${p(`<a href="${esc(orderPublicUrl)}" style="color:#05936A;font-weight:600;">View order details →</a>`)}
    `;

    const html = dynoPayGreetingTemplate(name, message, `Order shipped`, false);
    await mailTransporter({ to: buyerEmail, name, subject, body: html });
    apiLogger.info(`[email] sent order shipped to ${buyerEmail} for order ${order.order_id}`);
  } catch (e) {
    captureError(e, "email", { extraContext: "sendOrderShippedEmail", buyerEmail } as any);
  }
};

/**
 * Template — digital download REMINDER (6h before signed URL expiry).
 * Scheduled by the same cron that expires carts — it scans paid orders with
 * digital line items whose token expiry is < 6h out and sends a "refresh your
 * download" nudge. Buyer can hit the resend-download endpoint to get fresh
 * 24h URLs without waiting for their old link to die.
 */
export const sendDigitalDownloadReminderEmail = async (
  buyerEmail: string,
  buyerName: string,
  order: any,
  items: any[],
  orderPublicUrl: string
) => {
  try {
    const name = buyerName || buyerEmail || "there";
    const shortRef = String(order.public_ref || "").slice(0, 8).toUpperCase();
    const subject = `Reminder — your download links expire soon (order ${shortRef})`;
    const itemsTable = renderOrderItemsTable(order, items, { includeDeliveryLinks: false });

    const message = `
      ${p(`Just a heads-up — the secure download links from your recent order will expire in the next few hours.`)}
      ${p(`If you still need the files, tap the button below to refresh them. Refreshed links are valid for another 24 hours.`)}
      ${itemsTable}
      ${p(`<a href="${esc(orderPublicUrl)}" style="color:#05936A;font-weight:600;">Refresh download links →</a>`)}
    `;

    const html = dynoPayGreetingTemplate(name, message, `Your downloads expire soon`, false);
    await mailTransporter({ to: buyerEmail, name, subject, body: html });
    apiLogger.info(`[email] sent download reminder to ${buyerEmail} for order ${order.order_id}`);
  } catch (e) {
    captureError(e, "email", { extraContext: "sendDigitalDownloadReminderEmail", buyerEmail } as any);
  }
};
