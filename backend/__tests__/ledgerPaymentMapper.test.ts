/**
 * Unit Tests: Ledger Payment Mapper (Tier-1 Item #3)
 *
 * Verifies the money-in/money-out lines built by recordSettlementCompleted()
 * and recordPaymentDetected() are correctly balanced and use the right accounts.
 *
 * We mock postDoubleEntry to CAPTURE the batch input (the mapper's job is to
 * shape it correctly). The balance check itself is tested in ledgerDecimals.test.ts.
 */

const mockPostDoubleEntry = jest.fn();
jest.mock("../services/ledger/ledgerService", () => ({
  postDoubleEntry: (...args: unknown[]) => mockPostDoubleEntry(...args),
}));

import {
  recordSettlementCompleted,
  recordPaymentDetected,
} from "../services/ledger/ledgerPaymentMapper";

beforeEach(() => {
  mockPostDoubleEntry.mockReset();
  mockPostDoubleEntry.mockResolvedValue({ batch_id: "test-batch", posted: true, entries_created: 4 });
});

describe("recordSettlementCompleted", () => {
  it("emits merchant + fee legs summing to a balanced batch", async () => {
    await recordSettlementCompleted({
      paymentId: "pay_1",
      companyId: 42,
      currency: "USDT",
      address: "TXYZ",
      settlementTxId: "tx_hash",
      merchantAmount: 98.5,
      adminAmount: 1.5,
    });

    expect(mockPostDoubleEntry).toHaveBeenCalledTimes(1);
    const call = mockPostDoubleEntry.mock.calls[0][0];
    expect(call.journal_event).toBe("settlement_sent");
    expect(call.dedup_key).toBe("tx_hash");
    expect(call.payment_id).toBe("pay_1");
    expect(call.company_id).toBe(42);

    // Lines: DR merchant_payable + CR buyer_escrow + DR fee_revenue + CR buyer_escrow
    expect(call.lines.length).toBe(4);
    const codes = call.lines.map((l: { account_code: string }) => l.account_code);
    expect(codes).toContain("merchant_payable");
    expect(codes).toContain("fee_revenue");
    expect(codes.filter((c: string) => c === "buyer_escrow").length).toBe(2);

    // DR total per currency == CR total per currency
    const drSum = call.lines
      .filter((l: { direction: string }) => l.direction === "DR")
      .reduce((s: number, l: { amount: number | string }) => s + Number(l.amount), 0);
    const crSum = call.lines
      .filter((l: { direction: string }) => l.direction === "CR")
      .reduce((s: number, l: { amount: number | string }) => s + Number(l.amount), 0);
    expect(drSum).toBeCloseTo(100, 10);
    expect(crSum).toBeCloseTo(100, 10);
  });

  it("omits merchant leg when merchant amount is 0 (admin-only sweep)", async () => {
    await recordSettlementCompleted({
      paymentId: "pay_2",
      companyId: null,
      currency: "BTC",
      address: "1abc",
      settlementTxId: "tx_2",
      merchantAmount: 0,
      adminAmount: 0.001,
    });
    const call = mockPostDoubleEntry.mock.calls[0][0];
    expect(call.lines.length).toBe(2);
    const codes = call.lines.map((l: { account_code: string }) => l.account_code);
    expect(codes).not.toContain("merchant_payable");
    expect(codes).toContain("fee_revenue");
  });

  it("includes gas_expense leg when gasAmount is provided", async () => {
    await recordSettlementCompleted({
      paymentId: "pay_3",
      companyId: 7,
      currency: "ETH",
      address: "0xabc",
      settlementTxId: "tx_3",
      merchantAmount: 0.99,
      adminAmount: 0.01,
      gasAmount: 0.005,
    });
    const call = mockPostDoubleEntry.mock.calls[0][0];
    expect(call.lines.length).toBe(6);
    const codes = call.lines.map((l: { account_code: string }) => l.account_code);
    expect(codes).toContain("gas_expense");
  });

  it("skips posting entirely when all amounts are zero (defensive)", async () => {
    const result = await recordSettlementCompleted({
      paymentId: "pay_4",
      companyId: null,
      currency: "USDT",
      address: "TXYZ",
      settlementTxId: "tx_4",
      merchantAmount: 0,
      adminAmount: 0,
    });
    expect(mockPostDoubleEntry).not.toHaveBeenCalled();
    expect(result.posted).toBe(false);
  });

  it("uses payment-scoped dedup_key when settlementTxId is empty", async () => {
    await recordSettlementCompleted({
      paymentId: "pay_5",
      companyId: null,
      currency: "USDT",
      address: "TXYZ",
      settlementTxId: "",
      merchantAmount: 10,
      adminAmount: 1,
    });
    const call = mockPostDoubleEntry.mock.calls[0][0];
    expect(call.dedup_key).toBe("no-tx-pay_5");
  });
});

describe("recordPaymentDetected", () => {
  it("emits DR buyer_escrow / CR merchant_payable + fee_revenue legs", async () => {
    await recordPaymentDetected({
      paymentId: "pay_10",
      companyId: 1,
      currency: "USDT",
      address: "TXYZ",
      txId: "in_tx",
      merchantAmount: 98.5,
      adminAmount: 1.5,
    });

    const call = mockPostDoubleEntry.mock.calls[0][0];
    expect(call.journal_event).toBe("payment_detected");
    expect(call.dedup_key).toBe("in_tx");
    expect(call.lines.length).toBe(4);

    // DR side must be entirely buyer_escrow (funds coming IN increase escrow liab-side)
    const drAccounts = call.lines
      .filter((l: { direction: string }) => l.direction === "DR")
      .map((l: { account_code: string }) => l.account_code);
    expect(drAccounts.every((c: string) => c === "buyer_escrow")).toBe(true);

    // CR side is merchant_payable + fee_revenue
    const crAccounts = call.lines
      .filter((l: { direction: string }) => l.direction === "CR")
      .map((l: { account_code: string }) => l.account_code)
      .sort();
    expect(crAccounts).toEqual(["fee_revenue", "merchant_payable"]);
  });
});
