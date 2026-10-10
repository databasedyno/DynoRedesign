/**
 * Weekly payout digest — account-wide scope indication + in-app notifications.
 * (User report 2026-10-04: the Sunday digest email never appeared in the dashboard
 * notification page, and it silently summed every brand on the account.)
 */
import sequelize from "../utils/dbInstance";

const createNotification = jest.fn(async (..._a: unknown[]) => ({ notification_id: 1 }));
jest.mock("../controller/notificationController", () => ({
  createNotification: (...a: unknown[]) => createNotification(...a),
  NOTIFICATION_TYPES: { PAYOUT_DIGEST_WEEKLY: "payout_digest_weekly" },
}));
const mail = jest.fn(async (..._a: unknown[]) => ({ ok: true }));
jest.mock("../utils/mailTransporter", () => ({ __esModule: true, default: (...a: unknown[]) => mail(...a) }));
jest.mock("../services/email/companyDispatch", () => ({ dispatchCompanyEmail: jest.fn() }));
jest.mock("../services/errorMonitoringService", () => ({ captureError: jest.fn() }));
jest.mock("../utils/loggers", () => ({ apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("../utils/currencyUtils", () => ({
  getUserDisplayCurrency: async () => "USD",
  getUsdToFiatRate: async () => 1,
  getCurrencySymbol: (c: string) => (c === "USD" ? "$" : c === "EUR" ? "€" : ""),
  resolveDisplayFx: async (c: string) => ({ currency: c, requested_currency: c, rate: 1, symbol: "$", as_of: null, is_stale: false, fallback: false }),
}));
jest.mock("../utils/volumeTierUtils", () => ({
  getVolumeTiers: () => [{ displayName: "Growth", percent: 1, min: 0, max: null }],
}));

import {
  buildPayoutDigest,
  renderPayoutDigestEmail,
  sendPayoutDigestEmail,
  buildPayoutDigestNotificationText,
} from "../services/payoutDigestService";

type Row = Record<string, unknown>;
let brandCount = 6;
let existingNotification = false;

// Dispatch mocked SQL by a recognisable fragment of each statement.
const queryMock = sequelize.query as jest.Mock;
queryMock.mockImplementation(async (sql: string) => {
  if (sql.includes("FROM tbl_user WHERE user_id")) return [{ user_id: 1, name: "John", email: "onarrival21@gmail.com", last_company_id: 1 }];
  if (sql.includes("AS cur_volume")) return [{ cur_volume: 2050.4, cur_count: 32, prev_volume: 1706.69, prev_count: 19, fees_paid: 51.52 }];
  if (sql.includes("GROUP BY COALESCE(ut.crypto_currency")) return [{ symbol: "BTC", volume_usd: 901.73, tx_count: 13 }];
  if (sql.includes("FROM tbl_company c")) {
    const rows: Row[] = [{ company_id: 1, company_name: "The Dev Store", volume_usd: 1394.17, tx_count: 23 }];
    if (brandCount >= 2) rows.push({ company_id: 2, company_name: "SMADAV", volume_usd: 656.23, tx_count: 9 });
    for (let i = 3; i <= brandCount; i++) rows.push({ company_id: i, company_name: `Brand ${i}`, volume_usd: 0, tx_count: 0 });
    return rows;
  }
  if (sql.includes("AS lifetime_usd")) return [{ lifetime_usd: 50000 }];
  if (sql.includes("SELECT company_id FROM tbl_company WHERE user_id")) return Array.from({ length: brandCount }, (_, i) => ({ company_id: i + 1 }));
  if (sql.includes("SELECT 1 FROM tbl_notification")) return existingNotification ? [{ "?column?": 1 }] : [];
  throw new Error(`unexpected SQL in test: ${sql.slice(0, 80)}`);
});

beforeEach(() => {
  createNotification.mockClear();
  mail.mockClear();
  brandCount = 6;
  existingNotification = false;
});

describe("payout digest — all-brands scope", () => {
  it("aggregates per-brand settled volume and counts every brand on the account", async () => {
    const d = await buildPayoutDigest(1);
    expect(d).not.toBeNull();
    expect(d!.totalBrands).toBe(6);
    expect(d!.brands.map((b) => `${b.name}:${b.volumeDisplay}:${b.txCount}`)).toEqual(["The Dev Store:1394.17:23", "SMADAV:656.23:9"]);
    expect(d!.settledVolume).toBeCloseTo(2050.4, 2);
  });

  it("email says it covers all brands and lists the per-brand split (multi-brand account)", async () => {
    const d = (await buildPayoutDigest(1))!;
    const { subject, html } = await renderPayoutDigestEmail(d);
    expect(subject).toContain("$2,050.40 USD settled");
    expect(html).toContain("This digest covers all 6 brands on your account.");
    expect(html).toContain("Settled per brand");
    expect(html).toContain("The Dev Store");
    expect(html).toContain("$1,394.17 USD");
    expect(html).toContain("SMADAV");
    expect(html).toContain("$656.23 USD");
    expect(html).toContain("All brands combined");
  });

  it("single-brand account: no scope note and no per-brand table", async () => {
    brandCount = 1;
    const d = (await buildPayoutDigest(1))!;
    const { html } = await renderPayoutDigestEmail(d);
    expect(html).not.toContain("covers all");
    expect(html).not.toContain("Settled per brand");
  });

  it("notification text carries the period, totals and the all-brands note", () => {
    const text = buildPayoutDigestNotificationText(
      {
        userId: 1, companyId: null, email: "x@y", name: "John", periodStart: "2026-09-27T08:00:00Z", periodEnd: "2026-10-04T08:00:00Z",
        displayCurrency: "USD", currencySymbol: "$", settledVolume: 2050.4, settledCount: 32, feesPaid: 51.52,
        prevVolume: 0, prevCount: 0, volumeDeltaPct: 0, countDelta: 0, topCoins: [], feeTier: null, hasActivity: true, hasPriorActivity: false,
        totalBrands: 6,
        brands: [
          { companyId: 1, name: "The Dev Store", volumeUsd: 1394.17, volumeDisplay: 1394.17, txCount: 23 },
          { companyId: 2, name: "SMADAV", volumeUsd: 656.23, volumeDisplay: 656.23, txCount: 9 },
        ],
      },
      "en",
    );
    expect(text.title).toBe("Your week on Dynopay: $2,050.40 USD settled");
    expect(text.message).toContain("32 payments settled");
    expect(text.message).toContain("This digest covers all 6 brands on your account.");
    expect(text.message).toContain("The Dev Store $1,394.17 USD · SMADAV $656.23 USD");
  });
});

describe("payout digest — dashboard notifications", () => {
  it("sending the digest creates one inbox notification per brand (so it shows whichever brand is selected)", async () => {
    const d = (await buildPayoutDigest(1))!;
    const r = await sendPayoutDigestEmail(d, { fanout: true });
    expect(r.sent).toBe(true);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(6);
    const [userId, type, title, message, data, companyId] = createNotification.mock.calls[0] as unknown[];
    expect(userId).toBe(1);
    expect(type).toBe("payout_digest_weekly");
    expect(String(title)).toContain("$2,050.40 USD settled");
    expect(String(message)).toContain("covers all 6 brands");
    expect((data as { all_brands: boolean; brands: unknown[] }).all_brands).toBe(true);
    expect((data as { brands: unknown[] }).brands).toHaveLength(2);
    expect(companyId).toBe(1);
    expect(new Set(createNotification.mock.calls.map((c) => c[5]))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("is idempotent per brand per week — the manual preview button cannot duplicate rows", async () => {
    existingNotification = true;
    const d = (await buildPayoutDigest(1))!;
    await sendPayoutDigestEmail(d);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
