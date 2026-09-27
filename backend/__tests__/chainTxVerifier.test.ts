/**
 * On-chain verification of incoming payment webhooks — parsers + gate decisions.
 * Pure-function tests (no network): Tatum SDK, DB and loggers are mocked.
 */
jest.mock("../utils/loggers", () => ({
  webhookLogs: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  cronLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  log: jest.fn(),
}));
jest.mock("../utils/config", () => ({ raw: (k: string) => process.env[k], str: (k: string) => process.env[k] || "", num: (_k: string, d: number) => d, bool: () => false }));
jest.mock("../services/merchantPool/merchantPoolConfig", () => ({
  TOKEN_CONTRACTS: {
    "USDT-TRC20": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    "USDT-ERC20": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "USDC-ERC20": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "USDT-POLYGON": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "RLUSD-ERC20": "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD",
  },
  RLUSD_CONFIG: { issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" },
}));
const dbQuery = jest.fn();
jest.mock("../utils/dbInstance", () => ({ __esModule: true, default: { query: (...a: unknown[]) => dbQuery(...a) } }));

const sdk: any = { blockchain: { bitcoin: {}, ltc: {}, doge: {}, bcash: {}, eth: {}, polygon: {}, tron: {}, solana: {}, xrp: {} } };
jest.mock("../apis/tatumApi", () => ({ __esModule: true, default: { getTatumSDK: async () => sdk, getTatumHeaders: async () => ({ "x-api-key": "test" }) } }));
const axiosPost = jest.fn();
jest.mock("axios", () => ({ __esModule: true, default: { post: (...a: unknown[]) => axiosPost(...a) } }));

import {
  amountCovers, parseUtxo, parseEvmNative, parseEvmToken, parseTron, parseSolana, parseXrp,
  verifyIncomingTxOnChain, gateIncomingTx, ChainVerifyRetry,
} from "../services/chainTxVerifier";

const ADDR_TRON = "TBckp5W67rgZ8kE5CArzqWgCpBHPqarGht"; // = hex 41 12×20 (valid checksum)
const USDT_TRON_HEX = "41a614f803b6fd780986a42c78ec9c7f77e6ded13c"; // TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
const tronweb = require("tronweb");
const tronHex = (b58: string) => (tronweb.TronWeb || tronweb.default || tronweb).address.toHex(b58);
const pad64 = (hex: string) => hex.replace(/^0x/, "").padStart(64, "0");

beforeEach(() => { dbQuery.mockReset(); delete process.env.CHAIN_TX_VERIFY_MODE; delete process.env.CHAIN_TX_VERIFY_UNSUPPORTED; });

describe("amountCovers", () => {
  it("accepts equal / greater, tolerates float noise, rejects less", () => {
    expect(amountCovers(10, 10)).toBe(true);
    expect(amountCovers(10.000001, 10)).toBe(true);
    expect(amountCovers(9.9999999, 10)).toBe(true); // 1e-6 relative slack
    expect(amountCovers(9.99, 10)).toBe(false);
    expect(amountCovers(0, 10)).toBe(false);
    expect(amountCovers(NaN, 10)).toBe(false);
  });
});

describe("parsers", () => {
  it("UTXO (Tatum BTC outputs shape) sums SATOSHI outputs to our address only", () => {
    const tx = { blockNumber: 900000, time: 1700000000, outputs: [{ address: "bc1qours", value: 1_000_000 }, { address: "bc1qchange", value: 50_000_000 }, { address: "bc1qours", value: 2_000_000 }] };
    const p = parseUtxo(tx, "bc1qours", "BTC")!;
    expect(p.amount).toBeCloseTo(0.03, 8);
    expect(p.mined).toBe(true);
    expect(p.blockTime).toBe(1700000000000);
    expect(parseUtxo({ outputs: [{ address: "bc1qours", value: 100_000_000 }] }, "bc1qours", "BTC")!.mined).toBe(false);
  });
  it("UTXO (Tatum LTC outputs shape) values are decimal strings in LTC", () => {
    const p = parseUtxo({ blockNumber: 1, outputs: [{ address: "Lours", value: "1.23098087" }] }, "Lours", "LTC")!;
    expect(p.amount).toBeCloseTo(1.23098087, 8);
  });
  it("real-world regression: 35320 sat BTC deposit must NOT cover a 0.003532 BTC claim", () => {
    const p = parseUtxo({ blockNumber: 968843, outputs: [{ address: "bc1qours", value: 35320 }] }, "bc1qours", "BTC")!;
    expect(p.amount).toBeCloseTo(0.0003532, 10);
    expect(amountCovers(p.amount, 0.0003532)).toBe(true);
    expect(amountCovers(p.amount, 0.003532)).toBe(false);
  });
  it("UTXO (BCH node vout shape) normalises the bitcoincash: prefix", () => {
    const tx = { blockhash: "x", vout: [{ value: 0.7, scriptPubKey: { addresses: ["bitcoincash:qqours"] } }] };
    expect(parseUtxo(tx, "qqours", "BCH")!.amount).toBe(0.7);
    expect(parseUtxo(tx, "bitcoincash:qqours", "BCH")!.amount).toBe(0.7);
    expect(parseUtxo(tx, "qqother", "BCH")!.amount).toBe(0);
    expect(parseUtxo(tx, "qqours", "BCH")!.hasBlockInfo).toBe(true);
  });
  it("UTXO (Tatum DOGE vout shape) has no block fields → hasBlockInfo=false so the RPC fallback runs", () => {
    const tx = { hash: "h", size: 226, vout: [{ value: 204.48723099, scriptPubKey: { addresses: ["DRours"] } }] };
    const p = parseUtxo(tx, "DRours", "DOGE")!;
    expect(p.amount).toBeCloseTo(204.48723099, 8);
    expect(p.hasBlockInfo).toBe(false);
    expect(p.mined).toBe(false);
  });
  it("EVM native: to must match (case-insensitive), value in wei", () => {
    const tx = { to: "0xABCDEF0000000000000000000000000000000001", value: "1500000000000000000", blockNumber: 1, status: true };
    const p = parseEvmNative(tx, "0xabcdef0000000000000000000000000000000001");
    expect(p.toMatches).toBe(true);
    expect(p.amount).toBeCloseTo(1.5, 12);
    expect(parseEvmNative({ ...tx, to: "0x0000000000000000000000000000000000000002" }, "0xabcdef0000000000000000000000000000000001").toMatches).toBe(false);
    expect(parseEvmNative({ ...tx, blockNumber: null }, "0xabcdef0000000000000000000000000000000001").mined).toBe(false);
  });
  it("EVM token: only Transfer logs from the right contract to our address count", () => {
    const ours = "0x1111111111111111111111111111111111111111";
    const usdt = "0xdac17f958d2ee523a2206206994597c13d831ec7";
    const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const log = (contract: string, to: string, units: bigint) => ({ address: contract, topics: [TRANSFER, "0x" + pad64("0xaaaa"), "0x" + pad64(to)], data: "0x" + units.toString(16).padStart(64, "0") });
    const tx = { blockNumber: 5, status: true, logs: [
      log(usdt, ours, 25_000_000n),                                             // 25 USDT to us ✅
      log("0x2222222222222222222222222222222222222222", ours, 999_000_000n),   // scam token to us ❌
      log(usdt, "0x3333333333333333333333333333333333333333", 50_000_000n),    // USDT to someone else ❌
      log(usdt, ours, 1_000_000n),                                              // +1 USDT ✅
    ] };
    expect(parseEvmToken(tx, ours, usdt, 6).amount).toBeCloseTo(26, 6);
    expect(parseEvmToken({ ...tx, status: false }, ours, usdt, 6).ok).toBe(false);
  });
  it("TRON: TRX TransferContract and USDT-TRC20 transfer()/transferFrom() decode to our address", () => {
    const ourHex = tronHex(ADDR_TRON); // 41…
    const trx = { ret: [{ contractRet: "SUCCESS" }], blockNumber: 10, rawData: { timestamp: 1700000000000, contract: [{ type: "TransferContract", parameter: { value: { amount: 12_500_000, to_address: ourHex, owner_address: "41aa" } } }] } };
    expect(parseTron(trx, ADDR_TRON, "TRX", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t").amount).toBeCloseTo(12.5, 6);
    expect(parseTron(trx, ADDR_TRON, "USDT-TRC20", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t").amount).toBe(0); // TRX is not USDT

    const data = "a9059cbb" + pad64(ourHex.slice(2)) + (100_000_000n).toString(16).padStart(64, "0"); // transfer(to, 100 USDT)
    const usdtTx = { ret: [{ contractRet: "SUCCESS" }], blockNumber: 11, rawData: { timestamp: 1700000000000, contract: [{ type: "TriggerSmartContract", parameter: { value: { data, contract_address: USDT_TRON_HEX, owner_address: "41aa" } } }] } };
    expect(parseTron(usdtTx, ADDR_TRON, "USDT-TRC20", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t").amount).toBeCloseTo(100, 6);
    // Same call data but on a scam contract → nothing
    const scam = { ...usdtTx, rawData: { ...usdtTx.rawData, contract: [{ ...usdtTx.rawData.contract[0], parameter: { value: { data, contract_address: "41bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } } }] } };
    expect(parseTron(scam, ADDR_TRON, "USDT-TRC20", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t").amount).toBe(0);
    // transferFrom(from, to, value)
    const dataFrom = "23b872dd" + pad64("aa") + pad64(ourHex.slice(2)) + (7_000_000n).toString(16).padStart(64, "0");
    const fromTx = { ...usdtTx, rawData: { ...usdtTx.rawData, contract: [{ type: "TriggerSmartContract", parameter: { value: { data: dataFrom, contract_address: USDT_TRON_HEX } } }] } };
    expect(parseTron(fromTx, ADDR_TRON, "USDT-TRC20", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t").amount).toBeCloseTo(7, 6);
    // Failed tx
    expect(parseTron({ ...usdtTx, ret: [{ contractRet: "REVERT" }] }, ADDR_TRON, "USDT-TRC20", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t").ok).toBe(false);
  });
  it("Solana: balance delta of our account key in lamports", () => {
    const tx = { blockTime: 1700000000, meta: { err: null, preBalances: [5_000_000_000, 1_000_000_000], postBalances: [3_000_000_000, 3_000_000_000] }, transaction: { message: { accountKeys: ["sender", "ours"] } } };
    expect(parseSolana(tx, "ours").amount).toBeCloseTo(2, 9);
    expect(parseSolana(tx, "sender").amount).toBe(0);
    expect(parseSolana(tx, "nobody").found).toBe(false);
    expect(parseSolana({ ...tx, meta: { ...tx.meta, err: { InstructionError: [0, "Custom"] } } }, "ours").ok).toBe(false);
  });
  it("XRP: Destination + DestinationTag + delivered drops; RLUSD issued currency by issuer", () => {
    const tx = { TransactionType: "Payment", Destination: "rOurs", DestinationTag: 4242, Amount: "12000000", validated: true, meta: { TransactionResult: "tesSUCCESS", delivered_amount: "11000000" } };
    const p = parseXrp(tx, "rOurs", "XRP", 4242, "rIssuer");
    expect(p.amount).toBe(11); // delivered_amount wins over Amount (partial payments)
    expect(p.destMatches && p.tagMatches && p.ok).toBe(true);
    expect(parseXrp(tx, "rOurs", "XRP", 9999, "rIssuer").tagMatches).toBe(false);
    expect(parseXrp({ ...tx, meta: { TransactionResult: "tecPATH_DRY" } }, "rOurs", "XRP", 4242, "rIssuer").ok).toBe(false);
    const rl = { ...tx, Amount: { currency: "RLUSD", issuer: "rIssuer", value: "50" }, meta: { TransactionResult: "tesSUCCESS" } };
    expect(parseXrp(rl, "rOurs", "RLUSD", 4242, "rIssuer").amount).toBe(50);
    expect(parseXrp({ ...rl, Amount: { ...rl.Amount, issuer: "rFake" } }, "rOurs", "RLUSD", 4242, "rIssuer").amount).toBe(0);
  });
});

describe("verifyIncomingTxOnChain (mocked SDK)", () => {
  it("forged txId → not_found (retryable), never verified", async () => {
    sdk.blockchain.tron.tronGetTransaction = jest.fn().mockRejectedValue(Object.assign(new Error("Transaction not found"), { status: 404 }));
    const r = await verifyIncomingTxOnChain({ txId: "deadbeef", address: ADDR_TRON, currency: "USDT-TRC20", amount: 500 });
    expect(r.status).toBe("not_found");
  });
  it("real tx paying less than claimed → mismatch", async () => {
    const ourHex = tronHex(ADDR_TRON);
    const data = "a9059cbb" + pad64(ourHex.slice(2)) + (10_000_000n).toString(16).padStart(64, "0"); // 10 USDT
    sdk.blockchain.tron.tronGetTransaction = jest.fn().mockResolvedValue({ ret: [{ contractRet: "SUCCESS" }], blockNumber: 1, rawData: { contract: [{ type: "TriggerSmartContract", parameter: { value: { data, contract_address: USDT_TRON_HEX } } }] } });
    const r = await verifyIncomingTxOnChain({ txId: "abc", address: ADDR_TRON, currency: "USDT-TRC20", amount: 500 });
    expect(r.status).toBe("mismatch");
  });
  it("real tx paying ≥ claimed → verified with on-chain amount", async () => {
    const ourHex = tronHex(ADDR_TRON);
    const data = "a9059cbb" + pad64(ourHex.slice(2)) + (500_000_000n).toString(16).padStart(64, "0");
    sdk.blockchain.tron.tronGetTransaction = jest.fn().mockResolvedValue({ ret: [{ contractRet: "SUCCESS" }], blockNumber: 1, rawData: { timestamp: Date.now(), contract: [{ type: "TriggerSmartContract", parameter: { value: { data, contract_address: USDT_TRON_HEX } } }] } });
    const r = await verifyIncomingTxOnChain({ txId: "abc", address: ADDR_TRON, currency: "USDT-TRC20", amount: 500 });
    expect(r).toMatchObject({ status: "verified", onChainAmount: 500 });
  });
  it("unmined tx → pending (retryable)", async () => {
    sdk.blockchain.bitcoin.btcGetRawTransaction = jest.fn().mockResolvedValue({ outputs: [{ address: "bc1qours", value: 100_000_000 }] });
    expect((await verifyIncomingTxOnChain({ txId: "t", address: "bc1qours", currency: "BTC", amount: 1 })).status).toBe("pending");
  });
  it("DOGE: REST view lacks block fields → confirms via node RPC (mined → verified, mempool → pending)", async () => {
    sdk.blockchain.doge.dogeGetRawTransaction = jest.fn().mockResolvedValue({ hash: "h", vout: [{ value: 204.48723099, scriptPubKey: { addresses: ["DRours"] } }] });
    axiosPost.mockResolvedValueOnce({ data: { result: { blockhash: "cd09", confirmations: 166687, blocktime: 1779975317 } } });
    const ok = await verifyIncomingTxOnChain({ txId: "1e49", address: "DRours", currency: "DOGE", amount: 204.48723099 });
    expect(ok).toMatchObject({ status: "verified", onChainAmount: 204.48723099, blockTime: 1779975317000 });
    expect(axiosPost).toHaveBeenCalledWith("https://api.tatum.io/v3/blockchain/node/DOGE", expect.objectContaining({ method: "getrawtransaction", params: ["1e49", true] }), expect.anything());
    axiosPost.mockResolvedValueOnce({ data: { result: { txid: "1e49", confirmations: 0 } } });
    expect((await verifyIncomingTxOnChain({ txId: "1e49", address: "DRours", currency: "DOGE", amount: 204.48723099 })).status).toBe("pending");
  });
  it("DOGE: amount/address mismatch is decided BEFORE the RPC round-trip", async () => {
    sdk.blockchain.doge.dogeGetRawTransaction = jest.fn().mockResolvedValue({ hash: "h", vout: [{ value: 1, scriptPubKey: { addresses: ["DRours"] } }] });
    axiosPost.mockClear();
    expect((await verifyIncomingTxOnChain({ txId: "t", address: "DRours", currency: "DOGE", amount: 204 })).status).toBe("mismatch");
    expect(axiosPost).not.toHaveBeenCalled();
  });
  it("EVM native tx to a different address → mismatch", async () => {
    sdk.blockchain.eth.ethGetTransaction = jest.fn().mockResolvedValue({ to: "0x0000000000000000000000000000000000000002", value: "1000000000000000000", blockNumber: 3, status: true });
    expect((await verifyIncomingTxOnChain({ txId: "t", address: "0x0000000000000000000000000000000000000001", currency: "ETH", amount: 1 })).status).toBe("mismatch");
  });
  it("unknown currency → unsupported", async () => {
    expect((await verifyIncomingTxOnChain({ txId: "t", address: "x", currency: "SHIB", amount: 1 })).status).toBe("unsupported");
  });
  it("API outage → error (retryable)", async () => {
    sdk.blockchain.eth.ethGetTransaction = jest.fn().mockRejectedValue(Object.assign(new Error("ECONNRESET"), { status: 503 }));
    expect((await verifyIncomingTxOnChain({ txId: "t", address: "0x01", currency: "ETH", amount: 1 })).status).toBe("error");
  });
});

describe("gateIncomingTx decisions", () => {
  const verifiedTron = () => {
    const ourHex = tronHex(ADDR_TRON);
    const data = "a9059cbb" + pad64(ourHex.slice(2)) + (500_000_000n).toString(16).padStart(64, "0");
    sdk.blockchain.tron.tronGetTransaction = jest.fn().mockResolvedValue({ ret: [{ contractRet: "SUCCESS" }], blockNumber: 1, rawData: { timestamp: Date.now(), contract: [{ type: "TriggerSmartContract", parameter: { value: { data, contract_address: USDT_TRON_HEX } } }] } });
  };
  const input = { txId: "abc", address: ADDR_TRON, currency: "USDT-TRC20", amount: 500, paymentId: "pay-1" };

  it("verified + not previously credited + not older than the payment → ok", async () => {
    verifiedTron();
    dbQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ createdAt: new Date(Date.now() - 600000).toISOString() }]);
    expect((await gateIncomingTx(input)).decision).toBe("ok");
  });
  it("replay of a tx that already credited a payment → rejected", async () => {
    verifiedTron();
    dbQuery.mockResolvedValueOnce([{ id: "older-payment" }]);
    const g = await gateIncomingTx(input);
    expect(g.decision).toBe("rejected");
    expect(g.note).toMatch(/replay/);
  });
  it("tx mined long before the payment session existed → rejected", async () => {
    const ourHex = tronHex(ADDR_TRON);
    const data = "a9059cbb" + pad64(ourHex.slice(2)) + (500_000_000n).toString(16).padStart(64, "0");
    sdk.blockchain.tron.tronGetTransaction = jest.fn().mockResolvedValue({ ret: [{ contractRet: "SUCCESS" }], blockNumber: 1, rawData: { timestamp: Date.now() - 3 * 86400000, contract: [{ type: "TriggerSmartContract", parameter: { value: { data, contract_address: USDT_TRON_HEX } } }] } });
    dbQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ createdAt: new Date().toISOString() }]);
    const g = await gateIncomingTx(input);
    expect(g.decision).toBe("rejected");
    expect(g.note).toMatch(/predates/);
  });
  it("forged txId → throws ChainVerifyRetry (BullMQ retries, nothing credited)", async () => {
    sdk.blockchain.tron.tronGetTransaction = jest.fn().mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));
    await expect(gateIncomingTx(input)).rejects.toBeInstanceOf(ChainVerifyRetry);
  });
  it("mismatch → rejected in enforce mode, ok in warn mode", async () => {
    sdk.blockchain.tron.tronGetTransaction = jest.fn().mockResolvedValue({ ret: [{ contractRet: "SUCCESS" }], blockNumber: 1, rawData: { contract: [] } });
    expect((await gateIncomingTx(input)).decision).toBe("rejected");
    process.env.CHAIN_TX_VERIFY_MODE = "warn";
    expect((await gateIncomingTx(input)).decision).toBe("ok");
  });
  it("unsupported currency → allowed by default, rejected with CHAIN_TX_VERIFY_UNSUPPORTED=reject", async () => {
    const u = { ...input, currency: "SHIB" };
    expect((await gateIncomingTx(u)).decision).toBe("ok");
    process.env.CHAIN_TX_VERIFY_UNSUPPORTED = "reject";
    expect((await gateIncomingTx(u)).decision).toBe("rejected");
  });
  it("CHAIN_TX_VERIFY_MODE=off short-circuits", async () => {
    process.env.CHAIN_TX_VERIFY_MODE = "off";
    sdk.blockchain.tron.tronGetTransaction = jest.fn();
    expect((await gateIncomingTx(input)).decision).toBe("ok");
    expect(sdk.blockchain.tron.tronGetTransaction).not.toHaveBeenCalled();
  });
});
