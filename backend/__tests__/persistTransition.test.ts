/**
 * persistTransition — the single audited gateway for payment state changes.
 * Verifies: every transition is journaled, invalid transitions are flagged
 * (not thrown), and the audit path never breaks the money path.
 */

const mockJournal = jest.fn(async (_row: any) => {});
jest.mock("../services/paymentReliability", () => ({
  journalStateTransition: mockJournal,
}));

import { persistTransition, PaymentState } from "../services/paymentStateMachine";

beforeEach(() => {
  mockJournal.mockClear();
  mockJournal.mockImplementation(async () => {});
});

describe("persistTransition (audit trail enforcement)", () => {
  it("journals a valid transition with state_machine_valid: true and actor", async () => {
    await persistTransition({
      paymentId: "pay-1",
      from: PaymentState.PROCESSING,
      to: PaymentState.PAYOUT_COMPLETE,
      event: "payment_completed",
      actor: "chain_verification",
      currency: "ETH",
      amount: 1.5,
    });
    expect(mockJournal).toHaveBeenCalledTimes(1);
    const row = mockJournal.mock.calls[0][0] as any;
    expect(row.event).toBe("payment_completed");
    expect(row.fromState).toBe("processing");
    expect(row.toState).toBe("payout_complete");
    expect(row.metadata.state_machine_valid).toBe(true);
    expect(row.metadata.actor).toBe("chain_verification");
  });

  it("journals an INVALID transition with a violation flag instead of throwing", async () => {
    await persistTransition({
      paymentId: "pay-2",
      from: PaymentState.EXPIRED,
      to: PaymentState.PAYOUT_COMPLETE,
      event: "impossible_jump",
    });
    expect(mockJournal).toHaveBeenCalledTimes(1);
    expect((mockJournal.mock.calls[0][0] as any).metadata.state_machine_valid).toBe(false);
  });

  it("accepts string states and validates them via parseState", async () => {
    await persistTransition({
      paymentId: "pay-3",
      from: "pending",
      to: "expired",
      event: "payment_expired",
      actor: "expiry_sweeper",
    });
    expect((mockJournal.mock.calls[0][0] as any).metadata.state_machine_valid).toBe(true);
  });

  it("journals unknown/free-form states without a validity verdict", async () => {
    await persistTransition({
      paymentId: "pay-4",
      from: PaymentState.DETECTED,
      to: "overpayment",
      event: "overpayment_rejected",
    });
    const row = mockJournal.mock.calls[0][0] as any;
    expect(row.toState).toBe("overpayment");
    expect(row.metadata.state_machine_valid).toBeUndefined();
  });

  it("treats idempotent self-transitions as valid", async () => {
    await persistTransition({
      paymentId: "pay-5",
      from: PaymentState.PROCESSING,
      to: PaymentState.PROCESSING,
      event: "settlement_retry",
    });
    expect((mockJournal.mock.calls[0][0] as any).metadata.state_machine_valid).toBe(true);
  });

  it("NEVER throws even when the journal write fails (money-path safety)", async () => {
    mockJournal.mockRejectedValueOnce(new Error("db down"));
    await expect(
      persistTransition({
        paymentId: "pay-6",
        from: PaymentState.PENDING,
        to: PaymentState.DETECTED,
        event: "payment_detected",
      })
    ).resolves.toBeUndefined();
  });
});
