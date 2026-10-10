/**
 * FX engine regression tests — FIAT/CRYPTO audit 2026-06 (F1–F5).
 * Providers are mocked; Redis is the shared in-memory mock (moduleNameMapper).
 */
jest.mock("../utils/tatumAuth", () => ({
  TATUM_V3_URL: "https://tatum.test/v3",
  getTatumApiKey: () => "test-key",
}));

const prices: Record<string, number> = {};
let providersDown = false;
const calls: string[] = [];

jest.mock("../utils/tatumHttp", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url: string, cfg: { params?: Record<string, string> } = {}) => {
      calls.push(url);
      if (providersDown) throw Object.assign(new Error("timeout of 8000ms exceeded"), { code: "ETIMEDOUT" });
      const m = url.match(/\/tatum\/rate\/([A-Z]+)$/);
      if (m) {
        const v = prices[`${m[1]}:${cfg.params?.basePair}`];
        if (v === undefined) throw Object.assign(new Error("403"), { response: { status: 403 } });
        return { data: { value: String(v) } };
      }
      // CoinGecko — unavailable in these tests
      throw new Error("coingecko down");
    }),
  },
}));

import currencyConvert, {
  refreshBackgroundRateCache,
  isRateUnavailableError,
  __resetFxCachesForTests,
  amountDecimalsFor,
} from "../helper/currencyConvert";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const redisMock = require("./__mocks__/redisInstance");

const setPrices = () => {
  Object.assign(prices, {
    "BTC:USD": 60000, "ETH:USD": 2500, "TRX:USD": 0.33095, "DOGE:USD": 0.08581,
    "LTC:USD": 63.729, "BCH:USD": 279.05, "SOL:USD": 109.77, "XRP:USD": 1.4039,
    "BNB:USD": 748.28, "MATIC:USD": 0.10056,
    "USDT:EUR": 0.89165625, "USDT:GBP": 0.75448385, "USDT:NGN": 1327.73782717,
    "USDT:CAD": 1.42484974, "USDT:AUD": 1.43418003, "USDT:BRL": 4.98606327,
  });
};

const realNow = Date.now;
let clock = realNow();

beforeEach(() => {
  __resetFxCachesForTests();
  redisMock.__clearMockStore();
  Object.keys(prices).forEach((k) => delete prices[k]);
  setPrices();
  providersDown = false;
  calls.length = 0;
  clock = realNow();
  Date.now = () => clock;
});

afterAll(() => {
  Date.now = realNow;
});

describe("precision depends on the target asset (F3)", () => {
  it("keeps 8 dp for BTC amounts above 1 coin (was cut to 2 dp)", async () => {
    const [r] = await currencyConvert({ currency: ["BTC"], sourceCurrency: "USD", amount: 100000, fixedDecimal: false });
    expect(r.amount).toBe(1.66666667);
    expect(r.unavailable).toBeUndefined();
  });

  it("keeps 6 dp for TRX amounts", async () => {
    const [r] = await currencyConvert({ currency: ["TRX"], sourceCurrency: "USD", amount: 100, fixedDecimal: false });
    expect(r.amount).toBe(302.160447);
  });

  it("never rounds transferRate to 2 dp (USD→EUR 0.8917 used to become 0.89)", async () => {
    const [r] = await currencyConvert({ currency: ["EUR"], sourceCurrency: "USD", amount: 1, fixedDecimal: true });
    expect(r.transferRate).toBeCloseTo(0.89165625, 8);
    expect(r.amount).toBe(0.89);
  });

  it("fiat targets stay at 2 dp", () => {
    expect(amountDecimalsFor("EUR", 1234.5678, true)).toBe(2);
    expect(amountDecimalsFor("USDT-TRC20", 1234.5678, true)).toBe(6);
    expect(amountDecimalsFor("BTC", 0.5, true)).toBe(8);
  });
});

describe("no silent 0 / 1 rates (F1/F2)", () => {
  it("display mode returns unavailable=true (not a fake rate) when nothing is known", async () => {
    providersDown = true;
    const [r] = await currencyConvert({ currency: ["EUR"], sourceCurrency: "USD", amount: 100, fixedDecimal: true });
    expect(r.unavailable).toBe(true);
    expect(r.amount).toBe(0);
    expect(r.transferRate).toBe(0);
  });

  it("strict mode throws RateUnavailableError when nothing is known", async () => {
    providersDown = true;
    let caught: unknown = null;
    try {
      await currencyConvert({ currency: ["BTC"], sourceCurrency: "USD", amount: 100, fixedDecimal: false, strict: true });
    } catch (e) {
      caught = e;
    }
    expect(isRateUnavailableError(caught)).toBe(true);
  });
});

describe("last-known fallback is age-capped", () => {
  it("money path reuses a ≤30 min rate, refuses beyond; display keeps it (stale) up to 24h", async () => {
    const [live] = await currencyConvert({ currency: ["BTC"], sourceCurrency: "USD", amount: 600, fixedDecimal: false, strict: true });
    expect(live.amount).toBe(0.01);
    expect(live.stale).toBeUndefined();

    providersDown = true;
    clock += 20 * 60 * 1000; // 20 min later — past the 30s request cache
    const [stale] = await currencyConvert({ currency: ["BTC"], sourceCurrency: "USD", amount: 600, fixedDecimal: false, strict: true });
    expect(stale.amount).toBe(0.01);
    expect(stale.stale).toBe(true);

    clock += 15 * 60 * 1000; // 35 min old now
    let caught: unknown = null;
    try {
      await currencyConvert({ currency: ["BTC"], sourceCurrency: "USD", amount: 600, fixedDecimal: false, strict: true });
    } catch (e) {
      caught = e;
    }
    expect(isRateUnavailableError(caught)).toBe(true);

    const [display] = await currencyConvert({ currency: ["BTC"], sourceCurrency: "USD", amount: 600, fixedDecimal: false });
    expect(display.stale).toBe(true);
    expect(display.amount).toBe(0.01);
  });

  it("a freshly booted instance recalls the last-known rate from Redis", async () => {
    await currencyConvert({ currency: ["NGN"], sourceCurrency: "USD", amount: 1, fixedDecimal: true });
    __resetFxCachesForTests(); // new process: memory gone, Redis kept
    providersDown = true;
    clock += 5 * 60 * 1000;
    const [r] = await currencyConvert({ currency: ["NGN"], sourceCurrency: "USD", amount: 10, fixedDecimal: true, strict: true });
    expect(r.stale).toBe(true);
    expect(r.amount).toBeCloseTo(13277.38, 2);
  });
});

describe("fiat ↔ stablecoin is only 1:1 for USD (new P0 found 2026-06)", () => {
  it("prices a €100 USDT payment at ≈112.15 USDT, not 100 (cold cache → live Tatum path)", async () => {
    const [r] = await currencyConvert({ currency: ["USDT-TRC20"], sourceCurrency: "EUR", amount: 100, fixedDecimal: false, strict: true });
    expect(r.amount).toBeCloseTo(112.15, 2);
    expect(r.currency).toBe("USDT-TRC20");
  });

  it("converts 100 USDT to ≈132,773.78 NGN (not 100)", async () => {
    const [r] = await currencyConvert({ currency: ["NGN"], sourceCurrency: "USDT", amount: 100, fixedDecimal: true });
    expect(r.amount).toBeCloseTo(132773.78, 2);
  });

  it("keeps the exact USD peg", async () => {
    const [r] = await currencyConvert({ currency: ["USDC-ERC20"], sourceCurrency: "USD", amount: 42.5, fixedDecimal: false });
    expect(r.amount).toBe(42.5);
    expect(r.transferRate).toBe(1);
  });
});

describe("background cache covers every display currency and coin (F4/F5)", () => {
  it("pre-fetches NGN/CAD/AUD and SOL/XRP/BNB, then serves conversions with zero provider calls", async () => {
    await refreshBackgroundRateCache({ forceFiat: true });
    calls.length = 0;
    for (const fiat of ["EUR", "GBP", "NGN", "CAD", "AUD"]) {
      const [r] = await currencyConvert({ currency: [fiat], sourceCurrency: "SOL", amount: 1, fixedDecimal: true });
      expect(r.unavailable).toBeUndefined();
      expect(r.transferRate).toBeGreaterThan(0);
    }
    const [x] = await currencyConvert({ currency: ["XRP"], sourceCurrency: "EUR", amount: 100, fixedDecimal: false });
    expect(x.amount).toBeGreaterThan(0);
    expect(calls.length).toBe(0);
  });

  it("stays fresh for the whole 2-minute cron interval (old cache expired after 3 of 10 min)", async () => {
    await refreshBackgroundRateCache({ forceFiat: true });
    calls.length = 0;
    clock += 2 * 60 * 1000 + 30 * 1000; // just before the next tick would land
    const [r] = await currencyConvert({ currency: ["USD"], sourceCurrency: "BTC", amount: 1, fixedDecimal: true });
    expect(r.amount).toBe(60000);
    expect(calls.length).toBe(0);
  });
});
