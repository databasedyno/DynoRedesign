/**
 * Key-custody boundary tests (memory hardening) — verifies withPrivateKey scopes
 * plaintext to the callback, audits every access, and never leaks key material.
 */

jest.mock("../apis/tatumApi", () => ({
  __esModule: true,
  default: { decryptSymmetric: jest.fn() },
}));
jest.mock("../models/keyAccessAuditModel", () => ({
  __esModule: true,
  default: { create: jest.fn(async () => ({})) },
}));
jest.mock("../utils/loggers", () => ({
  cronLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { withPrivateKey, decryptPrivateKey } from "../services/keyCustody/keyCustodyService";
import tatumApi from "../apis/tatumApi";
import KeyAccessAudit from "../models/keyAccessAuditModel";

const mockDecrypt = tatumApi.decryptSymmetric as jest.Mock;
const mockAudit = (KeyAccessAudit as unknown as { create: jest.Mock }).create;

const CIPHERTEXT = "enc:abc123ciphertext";
const PLAINTEXT = "0xSUPER-SECRET-PRIVATE-KEY";
const CTX = { purpose: "pool_sweep", actor: "worker", walletType: "ETH", walletAddress: "0xPool" };

beforeEach(() => {
  jest.clearAllMocks();
  mockDecrypt.mockResolvedValue(PLAINTEXT);
});

describe("withPrivateKey (scoped custody boundary)", () => {
  it("passes the plaintext key ONLY to the callback and returns its result", async () => {
    let seenKey: string | null = null;
    const result = await withPrivateKey(CIPHERTEXT, "key-id", CTX, async (pk) => {
      seenKey = pk;
      return "tx-hash-1";
    });
    expect(seenKey).toBe(PLAINTEXT);
    expect(result).toBe("tx-hash-1");
    expect(mockDecrypt).toHaveBeenCalledWith(CIPHERTEXT, "key-id");
  });

  it("writes exactly one successful audit row per access with the right purpose", async () => {
    await withPrivateKey(CIPHERTEXT, "key-id", CTX, async () => "ok");
    expect(mockAudit).toHaveBeenCalledTimes(1);
    const row = mockAudit.mock.calls[0][0];
    expect(row.purpose).toBe("pool_sweep");
    expect(row.actor).toBe("worker");
    expect(row.wallet_address).toBe("0xPool");
    expect(row.success).toBe(true);
  });

  it("audit row NEVER contains the plaintext key or raw ciphertext", async () => {
    await withPrivateKey(CIPHERTEXT, "key-id", CTX, async () => "ok");
    const serialized = JSON.stringify(mockAudit.mock.calls[0][0]);
    expect(serialized).not.toContain(PLAINTEXT);
    expect(serialized).not.toContain(CIPHERTEXT);
    expect(mockAudit.mock.calls[0][0].key_ref_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("propagates callback errors while still having audited the access", async () => {
    await expect(
      withPrivateKey(CIPHERTEXT, "key-id", CTX, async () => {
        throw new Error("broadcast failed");
      })
    ).rejects.toThrow("broadcast failed");
    expect(mockAudit).toHaveBeenCalledTimes(1);
    expect(mockAudit.mock.calls[0][0].success).toBe(true);
  });

  it("audits a FAILED access when decryption itself fails, and throws", async () => {
    mockDecrypt.mockRejectedValueOnce(new Error("kms unavailable"));
    await expect(
      withPrivateKey(CIPHERTEXT, "key-id", CTX, async () => "never")
    ).rejects.toThrow("kms unavailable");
    expect(mockAudit).toHaveBeenCalledTimes(1);
    expect(mockAudit.mock.calls[0][0].success).toBe(false);
    expect(mockAudit.mock.calls[0][0].error).toContain("kms unavailable");
  });
});

describe("decryptPrivateKey (raw form, audit-only)", () => {
  it("returns the plaintext and audits", async () => {
    const pk = await decryptPrivateKey(CIPHERTEXT, "key-id", { purpose: "merchant_wallet_mnemonic" });
    expect(pk).toBe(PLAINTEXT);
    expect(mockAudit).toHaveBeenCalledTimes(1);
    expect(mockAudit.mock.calls[0][0].purpose).toBe("merchant_wallet_mnemonic");
  });

  it("never breaks the caller when the audit write fails (best-effort)", async () => {
    mockAudit.mockRejectedValueOnce(new Error("db down"));
    const pk = await decryptPrivateKey(CIPHERTEXT, "key-id", { purpose: "pool_sweep" });
    expect(pk).toBe(PLAINTEXT);
  });
});
