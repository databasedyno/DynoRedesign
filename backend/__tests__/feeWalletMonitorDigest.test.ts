/**
 * feeWalletMonitor — consolidated gas alert (2026-10-04).
 * Verifies: ONE email per cycle covering all wallets, per-chain cooldown,
 * escalation bypass, 2-read empty confirmation, and Redis-persisted alert state
 * surviving a module reload (restart/redeploy).
 */
const sendMock = jest.fn((..._args: unknown[]) => Promise.resolve({ ok: true }));
const balances: Record<string, string> = {};

jest.mock("../apis/tatumApi", () => ({
  __esModule: true,
  default: {
    getAddressBalance: jest.fn((address: string, chain: string) => {
      const v = balances[chain];
      if (v === undefined) return Promise.reject(new Error("no balance configured"));
      return Promise.resolve({ balance: v });
    }),
  },
}));
jest.mock("../utils/mailTransporter", () => ({ __esModule: true, default: (...a: unknown[]) => sendMock(...a) }));
jest.mock("../utils/currencyUtils", () => ({
  convertToUSD: jest.fn((chain: string, amt: number) => Promise.resolve(amt * ({ ETH: 2680, TRX: 0.34, POLYGON: 0.11, XRP: 2.5 }[chain] || 0))),
}));
jest.mock("../utils/loggers", () => ({
  cronLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("../services/emailService", () => ({
  dynoPayGreetingTemplate: (_n: string, body: string, subject: string) => `<h1>${subject}</h1>${body}`,
}));
jest.mock("../utils/config", () => ({
  __esModule: true,
  default: {
    adminEmail: "admin@test",
    str: (k: string) => ({ TRX_FEE_WALLET: "Taddr", ETH_FEE_WALLET: "0xeth", POLYGON_FEE_WALLET: "0xpol", XRP_MASTER_WALLET: "rxrp" }[k] || ""),
    num: (_k: string, d: number) => d,
  },
}));
// Redis store lives in the TEST scope so it survives jest.resetModules()
// (= a process restart from the monitor's point of view).
const mockStore: Record<string, unknown> = {};
jest.mock("../utils/redisInstance", () => ({
  getRedisItem: (key: string) => Promise.resolve(mockStore[key] || null),
  setRedisItem: (key: string, value: unknown) => { mockStore[key] = value; return Promise.resolve(); },
  setRedisItemWithTTL: (key: string, value: unknown) => { mockStore[key] = value; return Promise.resolve(); },
}));

const load = async () => {
  jest.resetModules();
  return import("../services/feeWalletMonitor");
};

beforeEach(() => {
  sendMock.mockClear();
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  balances.TRX = "42.2"; // warning (<60)
  balances.ETH = "0.000224"; // critical (<0.01)
  balances.POLYGON = "44.8"; // healthy
  balances.XRP = "3.5"; // warning (<3? no: 3.5 ≥ 3 → healthy... critical<2, warning<3) → healthy
});

describe("consolidated gas alert", () => {
  it("sends exactly ONE email listing every wallet when several trip at once", async () => {
    const mod = await load();
    const statuses = await mod.checkAllFeeWallets();
    expect(statuses.map((s) => `${s.id}:${s.status}`)).toEqual([
      "TRX:warning", "ETH:critical", "POLYGON:healthy", "XRP_MASTER:healthy",
    ]);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const mail = (sendMock.mock.calls[0] as unknown[])[0] as { subject: string; body: string };
    expect(mail.subject).toContain("ETH critically low");
    expect(mail.subject).toContain("TRX low");
    // every wallet is in the table, with native + USD and the top-up target
    expect(mail.body).toContain("0.000224 ETH");
    expect(mail.body).toContain("0.049776 ETH"); // top-up to 0.05
    expect(mail.body).toContain("42.20 TRX");
    expect(mail.body).toContain("77.80 TRX"); // top-up to 120
    expect(mail.body).toContain("44.800000 POL");
    expect(mail.body).toContain("Healthy");
    expect(mail.body).toContain("$0.60"); // ETH usd
    // alert state persisted for restarts
    const saved = mockStore["fee_wallet_alert_state"] as Record<string, { lastAlertLevel: string }>;
    expect(saved.ETH.lastAlertLevel).toBe("critical");
    expect(saved.TRX.lastAlertLevel).toBe("warning");
    expect(saved.POLYGON).toBeUndefined();
  });

  it("does not re-send inside the cooldown, but escalates immediately (empty needs 2 reads)", async () => {
    const mod = await load();
    await mod.checkAllFeeWallets();
    expect(sendMock).toHaveBeenCalledTimes(1);

    await mod.checkAllFeeWallets(); // same state → cooldown
    expect(sendMock).toHaveBeenCalledTimes(1);

    balances.ETH = "0"; // critical → empty: escalation, but confirmed on 2nd read only
    await mod.checkAllFeeWallets();
    expect(sendMock).toHaveBeenCalledTimes(1);
    await mod.checkAllFeeWallets();
    expect(sendMock).toHaveBeenCalledTimes(2);
    const mail = (sendMock.mock.calls[1] as unknown[])[0] as { subject: string };
    expect(mail.subject).toContain("ETH empty");
    expect(mail.subject).not.toContain("TRX"); // TRX still in cooldown → not a trigger
  });

  it("a restart (module reload) honours the alert state persisted in Redis", async () => {
    const mod1 = await load();
    await mod1.checkAllFeeWallets();
    expect(sendMock).toHaveBeenCalledTimes(1);

    const mod2 = await load(); // simulates redeploy: in-memory state gone, Redis kept
    await mod2.checkAllFeeWallets();
    expect(sendMock).toHaveBeenCalledTimes(1); // no duplicate email after restart
  });

  it("stays silent when every wallet is healthy and on API failure", async () => {
    balances.TRX = "500"; balances.ETH = "0.2";
    const mod = await load();
    await mod.checkAllFeeWallets();
    expect(sendMock).not.toHaveBeenCalled();
    delete balances.ETH; // Tatum down for ETH → no false alert
    await mod.checkAllFeeWallets();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
