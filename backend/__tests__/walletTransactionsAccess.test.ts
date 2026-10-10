const query = jest.fn();
const walletFindOne = jest.fn();
const selfFindAll = jest.fn();
const validateCompanyOwnership = jest.fn();
const getUsdPerUnit = jest.fn();

// dbInstance / models are moduleNameMapper-mapped (jest.config.ts) — mock the mapped names.
jest.mock("../utils/dbInstance", () => ({ __esModule: true, default: { query: (...a: unknown[]) => query(...a) } }));
jest.mock("../models", () => ({ userWalletModel: { findOne: (...a: unknown[]) => walletFindOne(...a) }, companyModel: { findOne: jest.fn() } }));
jest.mock("/app/backend/models/userModels", () => ({ selfTransactionModel: { findAll: (...a: unknown[]) => selfFindAll(...a) } }));
jest.mock("/app/backend/utils/validateCompanyOwnership", () => ({ validateCompanyOwnership: (...a: unknown[]) => validateCompanyOwnership(...a) }));
jest.mock("/app/backend/utils/currencyUtils", () => ({
  getUserDisplayCurrency: async () => "EUR",
  resolveDisplayFx: async () => ({ currency: "EUR", requested_currency: "EUR", rate: 0.9, as_of: "2026-06-01T10:00:00.000Z", is_stale: false, fallback: false }),
  fxMeta: (fx: Record<string, unknown>) => ({ currency: fx.currency, rate: fx.rate }),
  getUsdPerUnit: (...a: unknown[]) => getUsdPerUnit(...a),
  formatAmountForDisplay: jest.fn(),
  getCurrencyInfo: jest.fn(),
  convertToMultiple: jest.fn(),
}));
jest.mock("/app/backend/utils/loggers", () => ({ walletLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock("/app/backend/helper", () => ({
  successResponseHelper: (res: any, code: number, message: string, data: unknown) => res.status(code).json({ message, data }),
  errorResponseHelper: (res: any, code: number, message: string) => res.status(code).json({ message }),
}));
jest.mock("/app/backend/helper/controllerErrorHandler", () => ({
  handleControllerError: (res: any, e: Error) => res.status(500).json({ message: String(e?.message || e) }),
}));
jest.mock("jsonwebtoken", () => ({ decode: () => ({ user_id: 7, email: "owner@x.io" }) }));

import { getWalletTransactions } from "../controller/wallet/walletRead";

const call = async (id: string) => {
  const out: { code?: number; body?: any } = {};
  const res: any = { locals: { token: "t" }, status: (c: number) => ({ json: (b: unknown) => { out.code = c; out.body = b; } }) };
  await getWalletTransactions({ params: { id }, body: { page: 1, rowsPerPage: 10 } } as any, res);
  return out;
};

const wallet = (over: Record<string, unknown> = {}) => ({ dataValues: { wallet_id: 3, company_id: 1, user_id: 7, ...over } });

describe("getWalletTransactions — lookup, ownership, amounts", () => {
  beforeEach(() => {
    [query, walletFindOne, selfFindAll, validateCompanyOwnership, getUsdPerUnit].forEach((m) => m.mockReset());
    selfFindAll.mockResolvedValue([]);
    query.mockResolvedValue([]);
  });

  it("rejects a non-numeric wallet id with 400 (no DB hit)", async () => {
    const { code } = await call("abc");
    expect(code).toBe(400);
    expect(walletFindOne).not.toHaveBeenCalled();
  });

  it("looks the wallet up by wallet_id (the old `id` lookup 500'd) and 404s when missing", async () => {
    walletFindOne.mockResolvedValue(null);
    const { code, body } = await call("42");
    expect(walletFindOne).toHaveBeenCalledWith({ where: { wallet_id: 42 } });
    expect(code).toBe(404);
    expect(body.message).toBe("Wallet not found");
  });

  it("hides another merchant's wallet that has no brand (404)", async () => {
    walletFindOne.mockResolvedValue(wallet({ user_id: 99, company_id: null }));
    const { code } = await call("3");
    expect(code).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it("blocks a non-member of the wallet's brand (403 from the ownership check)", async () => {
    walletFindOne.mockResolvedValue(wallet({ user_id: 99, company_id: 5 }));
    validateCompanyOwnership.mockImplementation(async (res: any) => { res.status(403).json({ message: "You don't have access to this company" }); return null; });
    const { code } = await call("3");
    expect(validateCompanyOwnership).toHaveBeenCalledWith(expect.anything(), 5, 7, "view_wallets");
    expect(code).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it("lets a team member with view_wallets read the owner's wallet", async () => {
    walletFindOne.mockResolvedValue(wallet({ user_id: 99, company_id: 5 }));
    validateCompanyOwnership.mockResolvedValue({ company_id: 5, user_id: 99 });
    const { code } = await call("3");
    expect(code).toBe(200);
  });

  it("values rows at the settlement USD × display rate; estimates unsettled rows; null when no price", async () => {
    walletFindOne.mockResolvedValue(wallet());
    query.mockResolvedValue([
      { base_currency: "BTC", base_amount: 0.001, usd_value: 65, usd_amount: 65, status: "successful" },
      { base_currency: "TRX", base_amount: 100, usd_value: 0, usd_amount: 0, status: "pending" },
      { base_currency: "ZZZ", base_amount: 5, usd_value: null, usd_amount: 0, status: "pending" },
    ]);
    getUsdPerUnit.mockImplementation(async (c: string) => (c === "TRX" ? 0.33 : 0));
    const { code, body } = await call("3");
    expect(code).toBe(200);
    const [btc, trx, zzz] = body.data.customers_transactions;
    expect(btc).toMatchObject({ amount_in_usd: 65, display_amount: 58.5, display_currency: "EUR", usd_estimated: false });
    expect(trx).toMatchObject({ amount_in_usd: 33, display_amount: 29.7, usd_estimated: true });
    expect(zzz).toMatchObject({ amount_in_usd: null, display_amount: null, usd_estimated: true });
    expect(getUsdPerUnit).not.toHaveBeenCalledWith("BTC");
    expect(body.data.fx).toEqual({ currency: "EUR", rate: 0.9 });
    expect(String(query.mock.calls[0][0])).toMatch(/usd_value/);
  });
});
