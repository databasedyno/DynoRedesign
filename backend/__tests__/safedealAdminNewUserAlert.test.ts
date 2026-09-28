/**
 * SafeDeal admin "new user" alert — every FIRST-EVER customer row must notify
 * the operator exactly once, regardless of which path created it:
 *   sign-in (email / Telegram), guest checkout funding, or being added as a deal party.
 * Regression for the gap where checkout / escrow-ledger creations were silent.
 */

const sent: Array<{ to: string; subject: string; body: string }> = [];

jest.mock("../utils/mailTransporter", () => ({
  __esModule: true,
  default: jest.fn(async (opts: { to: string; subject: string; body: string }) => {
    sent.push(opts);
    return { messageId: "test-message-id" };
  }),
}));

// resolveCustomerForBrand: pretend every lookup INSERTS a fresh row (fires onCreate),
// except emails tagged "existing" which behave like a returning customer.
const resolveMock = jest.fn(async (params: any) => {
  const row = { customer_id: 4242, company_id: params.companyId, customer_name: null, email: params.email };
  if (!String(params.email || "").includes("existing")) params.onCreate?.(row);
  return row;
});
jest.mock("../services/customerWalletService", () => ({
  __esModule: true,
  resolveCustomerForBrand: (p: any) => resolveMock(p),
  resolveCustomerByTelegram: jest.fn(),
  CustomerWalletError: class extends Error {},
}));
jest.mock("../services/safedeal/safedealWallet", () => ({ __esModule: true, applyEntries: jest.fn(async () => []) }));

import { resolveDealParties } from "../services/safedeal/safedealEscrowLedger";
import { adminNotifyOnCreate, notifyAdminNewSafeDealUser } from "../services/safedeal/safedealAdminNotify";

const flush = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  sent.length = 0;
  resolveMock.mockClear();
  process.env.ADMIN_EMAIL = "ops@example.com";
});

describe("SafeDeal new-customer admin alert covers every creation path", () => {
  it("deal parties: both freshly-created parties alert the admin with the deal reference", async () => {
    const deal = { escrow_id: 348, company_id: 262, creator_role: "seller", creator_email: "seller-new@example.com", counterparty_email: "buyer-new@example.com" };
    const parties = await resolveDealParties(deal);
    await flush();
    expect(parties.buyer.email).toBe("buyer-new@example.com");
    expect(resolveMock).toHaveBeenCalledTimes(2);
    for (const call of resolveMock.mock.calls) expect(typeof call[0].onCreate).toBe("function");
    expect(sent).toHaveLength(2);
    expect(sent.map((s) => s.to)).toEqual(["ops@example.com", "ops@example.com"]);
    expect(sent[0].subject).toBe("New SafeDeal user: seller-new@example.com");
    expect(sent[1].subject).toBe("New SafeDeal user: buyer-new@example.com");
    expect(sent[1].body).toContain("Added as a deal party (deal #348)");
  });

  it("returning customers (no INSERT) never re-alert", async () => {
    const deal = { escrow_id: 1, company_id: 262, creator_role: "buyer", creator_email: "existing-a@example.com", counterparty_email: "existing-b@example.com" };
    await resolveDealParties(deal);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("guest checkout hook labels the sign-up method as checkout", async () => {
    adminNotifyOnCreate("checkout", "deal #900")({ customer_id: 7, company_id: 262, customer_name: "Guest", email: "guest@example.com" });
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toContain("Guest checkout");
    expect(sent[0].body).toContain("deal #900");
    expect(sent[0].body).toContain("guest@example.com");
  });

  it("skips (with no throw) when ADMIN_EMAIL is unset", async () => {
    delete process.env.ADMIN_EMAIL;
    notifyAdminNewSafeDealUser({ email: "x@example.com", customerId: 1, method: "email" });
    await flush();
    expect(sent).toHaveLength(0);
  });
});
