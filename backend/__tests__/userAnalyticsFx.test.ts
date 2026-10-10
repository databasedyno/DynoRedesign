const query = jest.fn();
const resolveDisplayFx = jest.fn();

// dbInstance is moduleNameMapper-mapped (jest.config.ts) — mock the mapped name.
jest.mock("../utils/dbInstance", () => ({ __esModule: true, default: { query: (...a: unknown[]) => query(...a) } }));
jest.mock("/app/backend/utils/currencyUtils", () => ({
  getUserDisplayCurrency: async () => "EUR",
  resolveDisplayFx: (...a: unknown[]) => resolveDisplayFx(...a),
  fxMeta: (fx: Record<string, unknown>) => ({ currency: fx.currency, requested_currency: fx.requested_currency, rate: fx.rate, as_of: fx.as_of, is_stale: fx.is_stale, fallback: fx.fallback }),
}));
jest.mock("/app/backend/utils/validateCompanyOwnership", () => ({ validateCompanyOwnership: async () => ({ user_id: 1 }) }));
jest.mock("/app/backend/utils/loggers", () => ({ walletLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock("/app/backend/models/userModels", () => ({
  userTransactionModel: { findAndCountAll: async () => ({ count: 3 }) },
  selfTransactionModel: { findAndCountAll: async () => ({ count: 0 }) },
}));
jest.mock("/app/backend/helper", () => ({
  successResponseHelper: (res: any, code: number, msg: string, data: unknown) => res.status(code).json({ message: msg, data }),
  errorResponseHelper: (res: any, code: number, msg: string) => res.status(code).json({ message: msg }),
  getErrorMessage: (e: Error) => String(e?.message || e),
}));
jest.mock("jsonwebtoken", () => ({ decode: () => ({ user_id: 1, email: "m@x.io" }) }));

import { getUserAnalytics } from "../controller/wallet/analytics";

const revenueRow = { base_currency: "BTC", amount: "0.2", amount_in_usd: "16000", fee_amount: "0.005", fee_usd: "400" };

const run = async () => {
  const out: { code?: number; body?: any } = {};
  const res: any = { locals: { token: "t" }, status: (c: number) => ({ json: (b: unknown) => { out.code = c; out.body = b; } }) };
  await getUserAnalytics({ body: { periodType: "ALL", company_id: 1 } } as any, res);
  return out;
};

describe("getUserAnalytics — consistent rate handling", () => {
  beforeEach(() => {
    query.mockClear();
    resolveDisplayFx.mockClear();
    query.mockImplementation(async (sql: string) => (sql.includes("amount_in_usd") ? [revenueRow] : []));
  });

  it("values revenue at the settlement USD value and converts with the display rate", async () => {
    resolveDisplayFx.mockResolvedValue({ currency: "EUR", requested_currency: "EUR", rate: 0.9, as_of: "2026-06-01T10:00:00.000Z", is_stale: true, fallback: false });
    const { code, body } = await run();
    expect(code).toBe(200);
    const row = body.data.revenue_performance[0];
    expect(row).toMatchObject({ amount_in_usd: "16000.00", amount_in_fiat: "14400.00", fee_in_usd: "400.00", fee_in_fiat: "360.00", display_currency: "EUR", fee_amount: "0.00500000" });
    expect(body.data.display_currency).toBe("EUR");
    expect(body.data.fx).toMatchObject({ is_stale: true, as_of: "2026-06-01T10:00:00.000Z", fallback: false });
    const revenueSql = query.mock.calls.map((c) => c[0]).find((s: string) => s.includes("amount_in_usd"));
    expect(revenueSql).toMatch(/usd_value/);
    expect(revenueSql).toMatch(/status IN \('successful', 'done', 'completed'\)/);
    expect(revenueSql).toMatch(/transaction_fee/);
    expect(revenueSql).not.toMatch(/blockchain_fee/);
  });

  it("falls back to USD (label and numbers) when no display rate exists — never 0", async () => {
    resolveDisplayFx.mockResolvedValue({ currency: "USD", requested_currency: "EUR", rate: 1, as_of: null, is_stale: false, fallback: true });
    const { body } = await run();
    const row = body.data.revenue_performance[0];
    expect(row).toMatchObject({ amount_in_usd: "16000.00", amount_in_fiat: "16000.00", fee_in_fiat: "400.00", display_currency: "USD" });
    expect(body.data.display_currency).toBe("USD");
    expect(body.data.fx).toMatchObject({ fallback: true, requested_currency: "EUR" });
  });
});
