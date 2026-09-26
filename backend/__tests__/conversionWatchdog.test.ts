/**
 * Payout-alert watchdog: a settled SafeDeal escrow-custody conversion (status HELD)
 * must NEVER trigger a "payout running late" / "payout failed" email. Regression guard
 * for the false-alert bug on deal #347 (conversion #8).
 */
import { Op } from "sequelize";
jest.mock("../services/binanceService", () => ({}));
jest.mock("../services/binanceWebSocketService", () => ({
  isConnected: () => false,
  getStatus: () => ({ connected: false, lastMessageAge: -1 }),
}));
jest.mock("../helper/sendEmail", () => ({
  sendAutoConversionPayoutEmail: jest.fn(),
  sendWeeklyConversionSummaryEmail: jest.fn(),
}));
jest.mock("../services/email/adminOpsEmails", () => ({ sendConversionFailedAdminEmail: jest.fn() }));
jest.mock("../services/safedeal/safedealCheckout", () => ({
  isSafeDealCompany: jest.fn(() => false),
  onCustodyConverted: jest.fn(),
}));
jest.mock("../utils/treasuryAlert", () => ({ alertTreasuryLow: jest.fn() }));
jest.mock("../controller/notificationController", () => ({ createNotification: jest.fn(), NOTIFICATION_TYPES: {} }));

// The models are imported directly from their files (not the barrel), so mock each.
jest.mock("../models/stablecoinConversionModel", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), update: jest.fn().mockResolvedValue([0]) },
}));
jest.mock("../models/userModels/userModel", () => ({
  __esModule: true,
  default: { findOne: jest.fn().mockResolvedValue({ user_id: 1, email: "merchant@example.com", name: "Mo", language: "en" }) },
}));
jest.mock("../models/companyModels/companyModel", () => ({
  __esModule: true,
  default: { findOne: jest.fn().mockResolvedValue({ company_id: 262, company_name: "Acme" }) },
}));

// Spy targets: the actual email sender + the dispatcher that fans out to it.
jest.mock("../services/email/payoutEmails", () => ({ sendPayoutDelayedEmail: jest.fn() }));
jest.mock("../services/email/companyDispatch", () => ({
  dispatchCompanyEmail: jest.fn(async (_companyId, _cat, to: any, send: any) => send(to.email, to.name)),
}));

import stablecoinConversionModel from "../models/stablecoinConversionModel";
import { sendPayoutDelayedEmail } from "../services/email/payoutEmails";
import { __testables } from "../services/conversionService";

const findAllMock = (stablecoinConversionModel as any).findAll as jest.Mock;
const sendMock = sendPayoutDelayedEmail as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (stablecoinConversionModel as any).update.mockResolvedValue([0]);
});

describe("payout watchdog only alerts on genuinely in-flight conversions", () => {
  test("PAYOUT_INFLIGHT_STATUSES is an allow-list that excludes every terminal state (COMPLETED/FAILED/HELD)", () => {
    expect(__testables.PAYOUT_INFLIGHT_STATUSES).toEqual(
      expect.arrayContaining(["PENDING_DEPOSIT", "DEPOSIT_CREDITED", "CONVERTING", "CONVERTED", "WITHDRAWING"]),
    );
    expect(__testables.PAYOUT_INFLIGHT_STATUSES).not.toContain("COMPLETED");
    expect(__testables.PAYOUT_INFLIGHT_STATUSES).not.toContain("FAILED");
    expect(__testables.PAYOUT_INFLIGHT_STATUSES).not.toContain("HELD");
  });

  test("notifyStalledConversions only queries in-flight, not-yet-completed conversions (HELD & future terminal states can't leak in)", async () => {
    findAllMock.mockResolvedValueOnce([]);
    await __testables.notifyStalledConversions();

    const where = findAllMock.mock.calls[0][0].where;
    // Allow-list: only genuinely in-flight statuses are eligible.
    expect(where.status[Op.in]).toEqual(
      expect.arrayContaining(["PENDING_DEPOSIT", "DEPOSIT_CREDITED", "CONVERTING", "CONVERTED", "WITHDRAWING"]),
    );
    expect(where.status[Op.in]).not.toContain("HELD");
    // Belt-and-suspenders: a record with a completion timestamp is never "late".
    expect(where.completed_at[Op.is]).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("markExhaustedAsFailed never flips a completed/HELD record to FAILED", async () => {
    findAllMock.mockResolvedValueOnce([]);
    await __testables.markExhaustedAsFailed();

    const snapshotWhere = findAllMock.mock.calls[0][0].where;
    const retryClause = snapshotWhere[Op.or][0];
    expect(retryClause.status[Op.in]).not.toContain("HELD");
    expect(retryClause.completed_at[Op.is]).toBeNull();

    const updateWhere = (stablecoinConversionModel as any).update.mock.calls[0][1].where;
    expect(updateWhere.status[Op.in]).not.toContain("HELD");
    expect(updateWhere.completed_at[Op.is]).toBeNull();
  });

  test("a genuine >2h-old non-terminal conversion still sends the delayed email", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    findAllMock.mockResolvedValueOnce([
      {
        conversion_id: 999,
        user_id: 1,
        company_id: 262,
        status: "PENDING_DEPOSIT",
        source_amount: "0.0013",
        source_currency: "BTC",
        source_amount_usd: "115.67",
        target_currency: "USDT",
        settlement_chain: "TRON",
        transaction_id: "TX-999",
        createdAt: threeHoursAgo,
      },
    ]);

    await __testables.notifyStalledConversions();

    expect(sendMock).toHaveBeenCalledTimes(1);
    const dataArg = sendMock.mock.calls[0][3];
    expect(dataArg.stage).toBe("delayed");
  });
});
