jest.mock("../utils/loggers", () => ({ cronLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock("axios", () => ({ __esModule: true, default: { create: () => ({ get: mockGet, post: mockPost }) } }));

import { probeUnconfirmedIncoming, supportsMempoolProbe } from "../services/mempoolProbe";

const hex = (n: bigint) => "0x" + n.toString(16);

describe("mempoolProbe", () => {
  beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); });

  it("supports the checkout coins with a public unconfirmed source", () => {
    for (const c of ["BTC", "LTC", "ETH", "USDT-ERC20", "USDC-ERC20", "TRX", "USDT-TRC20", "POLYGON", "USDT-POLYGON"]) expect(supportsMempoolProbe(c)).toBe(true);
    expect(supportsMempoolProbe("DOGE")).toBe(false);
    expect(supportsMempoolProbe("XRP")).toBe(false);
  });

  it("BTC: sums unconfirmed outputs paying the checkout address", async () => {
    mockGet.mockResolvedValueOnce({ data: [
      { txid: "aa11", vout: [{ scriptpubkey_address: "bc1qpay", value: 150000 }, { scriptpubkey_address: "bc1qchange", value: 999 }] },
      { txid: "bb22", vout: [{ scriptpubkey_address: "bc1qother", value: 5 }] },
    ] });
    const r = await probeUnconfirmedIncoming("bc1qpay", "BTC");
    expect(r).toEqual({ detected: true, txId: "aa11", amount: 0.0015, source: "mempool-api" });
    expect(mockGet.mock.calls[0][0]).toBe("https://mempool.space/api/address/bc1qpay/txs/mempool");
  });

  it("ETH: detected only when the pending balance exceeds the latest balance", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { result: hex(BigInt("21309200000000000")) } }) // pending
      .mockResolvedValueOnce({ data: { result: hex(BigInt(0)) } }); // latest
    const r = await probeUnconfirmedIncoming("0xdbb830880280b349df072edace1b70f03f9e3d1c", "ETH");
    expect(r.detected).toBe(true);
    expect(r.amount).toBeCloseTo(0.0213092, 10);
    expect(r.source).toBe("evm-rpc");
  });

  it("ETH: no false positive when pending == latest (uses a fresh address to avoid the cache)", async () => {
    mockPost.mockResolvedValue({ data: { result: hex(BigInt(5)) } });
    const r = await probeUnconfirmedIncoming("0x1111111111111111111111111111111111111111", "ETH");
    expect(r.detected).toBe(false);
  });

  it("USDT-TRC20: reads TronGrid only_unconfirmed transfers", async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [{ transaction_id: "t1", value: "40500000", token_info: { decimals: 6 } }] } });
    const r = await probeUnconfirmedIncoming("TRyk74od7FfrRYeopp1azu26HcxKdb6zj2", "USDT-TRC20");
    expect(r).toEqual({ detected: true, txId: "t1", amount: 40.5, source: "trongrid" });
    expect(mockGet.mock.calls[0][1].params).toMatchObject({ only_to: true, only_unconfirmed: true });
  });

  it("never throws — upstream errors degrade to not-detected", async () => {
    mockGet.mockRejectedValueOnce(new Error("boom"));
    const r = await probeUnconfirmedIncoming("bc1qfails", "BTC");
    expect(r.detected).toBe(false);
  });

  it("unsupported chains short-circuit without any network call", async () => {
    const r = await probeUnconfirmedIncoming("DAbcdef", "DOGE");
    expect(r.detected).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
