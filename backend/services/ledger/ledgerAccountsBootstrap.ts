/**
 * Ledger Standard Accounts Bootstrap (Tier-1 Item #3)
 *
 * Seeds the chart of accounts on first boot. Idempotent — safe to call every
 * startup. Additional accounts can be added by extending STANDARD_ACCOUNTS.
 */

import LedgerAccount, { LedgerAccountAttributes } from "../../models/ledger/ledgerAccountModel";
import { cronLogger } from "../../utils/loggers";

export const STANDARD_ACCOUNTS: LedgerAccountAttributes[] = [
  {
    code: "buyer_escrow",
    name: "Buyer Escrow",
    kind: "LIABILITY",
    normal_side: "CR",
    description:
      "Funds received from buyers, held in temp/pool addresses. Owed to merchant + refund liability.",
  },
  {
    code: "merchant_payable",
    name: "Merchant Payable",
    kind: "LIABILITY",
    normal_side: "CR",
    description: "Net amount owed to a merchant after platform fees; discharged on settlement.",
  },
  {
    code: "fee_revenue",
    name: "Platform Fee Revenue",
    kind: "INCOME",
    normal_side: "CR",
    description: "Take-rate + fixed fees earned by DynoPay.",
  },
  {
    code: "gas_expense",
    name: "Blockchain Gas Expense",
    kind: "EXPENSE",
    normal_side: "DR",
    description: "On-chain network fees paid by the platform (sweep, settle, gas-fund).",
  },
  {
    code: "conversion_pnl",
    name: "Auto-Conversion PnL",
    kind: "INCOME",
    normal_side: "CR",
    description: "PnL from Binance / on-ramp stablecoin auto-conversion.",
  },
  {
    code: "refund_liability",
    name: "Refund Liability",
    kind: "LIABILITY",
    normal_side: "CR",
    description: "Refundable amount pending payout back to the buyer.",
  },
  {
    code: "suspense",
    name: "Suspense",
    kind: "ASSET",
    normal_side: "DR",
    description:
      "Transient / uncategorized. Balances here MUST clear within 24h — alert on drift.",
  },
];

export async function bootstrapStandardAccounts(): Promise<{ created: string[]; existing: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];
  for (const acct of STANDARD_ACCOUNTS) {
    const [row, wasCreated] = await LedgerAccount.findOrCreate({
      where: { code: acct.code },
      defaults: acct as never,
    });
    if (wasCreated) created.push(acct.code);
    else existing.push(row.code);
  }
  if (created.length > 0) cronLogger.info(`[Ledger] Seeded ${created.length} accounts: ${created.join(", ")}`);
  return { created, existing };
}

export default { bootstrapStandardAccounts, STANDARD_ACCOUNTS };
