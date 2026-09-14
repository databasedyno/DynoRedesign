/**
 * Splits the full OpenAPI spec into what a MERCHANT integrator needs (default
 * /api/docs) and the internal/super-admin surface (/api/docs/internal, only when
 * ENABLE_INTERNAL_API_DOCS=true).
 */
import { directApiPaths } from "./paths/directApi";
import { embedPaths } from "./paths/embed";
import { apiKeyPaths } from "./paths/apiKeys";
import { apiUsagePaths } from "./paths/apiUsage";
import { webhookPaths } from "./paths/webhooks";
import { invoicePaths } from "./paths/invoice";
import { customerWalletPaths } from "./paths/customerWallet";

type Spec = { paths: Record<string, Record<string, { tags?: string[] }>>; tags?: Array<{ name: string }>; info: Record<string, unknown> } & Record<string, unknown>;

const MERCHANT_PATH_GROUPS: Array<Record<string, unknown>> = [
  directApiPaths,
  customerWalletPaths,
  embedPaths,
  apiKeyPaths,
  apiUsagePaths,
  webhookPaths,
  invoicePaths,
];

/** Dashboard endpoints a merchant may legitimately script against. */
const MERCHANT_EXTRA_PATHS = new Set<string>([
  "/api/pay/createPaymentLink",
  "/api/pay/getPaymentLinks",
  "/api/pay/links/{id}",
  "/api/pay/deletePaymentLink/{id}",
  "/api/pay/fee-preview",
  "/api/pay/calculateFees",
  "/api/pay/configured-currencies",
  "/api/pay/company-currencies/{company_id}",
  "/api/wallet/getAllTransactions",
  "/api/wallet/transaction/{id}",
  "/api/wallet/transactions/export",
  "/api/company/webhook-settings/{id}",
  "/api/company/webhook-test/{id}",
  "/api/company/webhook-history/{id}",
  "/api/company/webhook-history/{id}/detail/{logId}",
  "/api/company/webhook-stats/{id}",
  "/api/company/auto-convert/{id}",
  "/api/company/conversion-history/{id}",
  "/api/company/conversion/{conversionId}",
  "/api/status",
  "/api/status/health",
  "/api/events/stream",
]);

export const isMerchantPath = (path: string): boolean =>
  MERCHANT_EXTRA_PATHS.has(path) || MERCHANT_PATH_GROUPS.some((g) => path in g);

const MERCHANT_INTRO = `# Dynopay Merchant API (v1)

Everything you need to accept crypto payments programmatically: **Direct API** (server-to-server with your \`x-api-key\`), **Embedded Checkout / Elements** (browser-safe publishable keys), **payment links**, **customer wallets**, **transactions & invoices**, **webhooks** and **auto-stablecoin conversion** settings.

- Get an API key: Dashboard → Developers → API keys.
- Send it as the \`x-api-key\` header. Dashboard-scoped endpoints (payment links, transactions, webhook settings) accept the same Bearer token your dashboard session uses.
- Confirm fulfilment from the \`payment.settled\` webhook or \`GET /api/user/getPaymentStatus/{payment_id}\` — never from browser events.
- Every path is also available under \`/api/v1/...\`.

Internal, dashboard-only and super-admin endpoints are documented separately and are not part of the merchant contract.`;

/** Merchant view: allow-listed paths + only the tags they use. */
export const buildMerchantSpec = (full: Spec): Spec => {
  const paths: Spec["paths"] = {};
  for (const [p, ops] of Object.entries(full.paths || {})) {
    if (isMerchantPath(p)) paths[p] = ops;
  }
  const usedTags = new Set<string>();
  for (const ops of Object.values(paths)) {
    for (const op of Object.values(ops)) (op?.tags || []).forEach((t) => usedTags.add(t));
  }
  return {
    ...full,
    info: { ...full.info, title: "Dynopay Merchant API", description: MERCHANT_INTRO },
    paths,
    tags: (full.tags || []).filter((t) => usedTags.has(t.name)),
  };
};

export const buildInternalSpec = (full: Spec): Spec => ({
  ...full,
  info: {
    ...full.info,
    title: "Dynopay API — internal & admin reference",
    description: `# Internal reference (dashboard, platform, super-admin)\n\nThis spec lists **every** route, including dashboard-session, platform and super-admin endpoints. It is not a merchant integration contract — use /api/docs for that.\n\n${String(full.info?.description || "")}`,
  },
});
