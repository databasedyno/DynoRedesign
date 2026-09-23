/**
 * Wallet ownership verification ("Verify by signing") — shared by the merchant
 * payout-address manager (tbl_user_wallet) and SafeDeal cashout addresses
 * (tbl_customer_payout_address).
 *
 * Flow: client asks for a nonce → we hand back a human-readable message bound to
 * {address, network, nonce, expiry} (Redis, single-use, 10 min) → the user signs it
 * in their wallet (Reown AppKit) → we recover/verify the signer and, only if it is
 * the saved address, stamp ownership_verified_at. Nothing here moves funds.
 */
import crypto from "crypto";
import { verifyMessage as ethersVerifyMessage } from "ethers";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { TronWeb } from "tronweb";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../../utils/redisInstance";

export type ChainFamily = "evm" | "tron" | "solana";

const FAMILY_BY_CODE: Record<string, ChainFamily> = {
  ETH: "evm", POLYGON: "evm", "USDT-ERC20": "evm", "USDT-POLYGON": "evm", "USDC-ERC20": "evm", "USDC-POLYGON": "evm", "RLUSD-ERC20": "evm",
  TRX: "tron", "USDT-TRC20": "tron", "USDT-TRON": "tron",
  SOL: "solana",
};
const LABEL_BY_CODE: Record<string, string> = {
  ETH: "Ethereum", POLYGON: "Polygon", "USDT-ERC20": "USDT on Ethereum (ERC-20)", "USDT-POLYGON": "USDT on Polygon", "USDC-ERC20": "USDC on Ethereum (ERC-20)", "USDC-POLYGON": "USDC on Polygon", "RLUSD-ERC20": "RLUSD on Ethereum (ERC-20)",
  TRX: "Tron", "USDT-TRC20": "USDT on Tron (TRC-20)", "USDT-TRON": "USDT on Tron (TRC-20)", SOL: "Solana",
};

const NONCE_TTL_SEC = 600;

export function chainFamilyFor(code: string | null | undefined): ChainFamily | null {
  return FAMILY_BY_CODE[String(code || "").toUpperCase()] || null;
}
export function networkLabelFor(code: string): string {
  return LABEL_BY_CODE[String(code || "").toUpperCase()] || code;
}
/** Case-insensitive for EVM (checksum casing), exact for base58 chains. */
export function sameAddress(family: ChainFamily, a: string, b: string): boolean {
  const x = String(a || "").trim(), y = String(b || "").trim();
  return family === "evm" ? x.toLowerCase() === y.toLowerCase() : x === y;
}

export interface OwnershipNonce {
  nonce: string;
  message: string;
  address: string;
  code: string;
  family: ChainFamily;
  product: "Dynopay" | "SafeDeal";
  issued_at: string;
  expires_at: string;
}

function buildMessage(p: { product: string; address: string; code: string; purpose: string; nonce: string; issuedAt: string; expiresAt: string; domain: string }): string {
  return [
    `${p.product} wants you to verify that you control this wallet.`,
    ``,
    `Address: ${p.address}`,
    `Network: ${networkLabelFor(p.code)}`,
    `Purpose: ${p.purpose}`,
    `Domain: ${p.domain}`,
    `Nonce: ${p.nonce}`,
    `Issued At: ${p.issuedAt}`,
    `Expires At: ${p.expiresAt}`,
    ``,
    `Signing is free and does not move funds or grant any permission.`,
  ].join("\n");
}

const key = (scope: string, nonce: string) => `walletverify:${scope}:${nonce}`;

/** Create a single-use nonce + message. `scope` must identify the signer (e.g. user:42 / sdcust:9). */
export async function issueOwnershipNonce(scope: string, p: { product: "Dynopay" | "SafeDeal"; address: string; code: string; purpose: string; domain: string }): Promise<OwnershipNonce> {
  const family = chainFamilyFor(p.code);
  if (!family) throw new Error("UNSUPPORTED_NETWORK");
  const address = String(p.address || "").trim();
  if (!address) throw new Error("ADDRESS_REQUIRED");
  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_SEC * 1000);
  const message = buildMessage({ product: p.product, address, code: p.code.toUpperCase(), purpose: p.purpose, nonce, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString(), domain: p.domain });
  const rec: OwnershipNonce = { nonce, message, address, code: p.code.toUpperCase(), family, product: p.product, issued_at: issuedAt.toISOString(), expires_at: expiresAt.toISOString() };
  await setRedisItemWithTTL(key(scope, nonce), rec, NONCE_TTL_SEC);
  return rec;
}

/** Fetch + burn a nonce (single use). */
export async function consumeOwnershipNonce(scope: string, nonce: string): Promise<OwnershipNonce | null> {
  if (!/^[a-f0-9]{32}$/.test(String(nonce || ""))) return null;
  const rec = (await getRedisItem(key(scope, nonce))) as OwnershipNonce | null;
  if (!rec || !rec.message) return null;
  await deleteRedisItem(key(scope, nonce));
  if (new Date(rec.expires_at).getTime() < Date.now()) return null;
  return rec;
}

function tron(): InstanceType<typeof TronWeb> {
  return new TronWeb({ fullHost: process.env.TRON_FULL_HOST || "https://api.trongrid.io" });
}

/** True when `signature` over `message` was produced by `address` on the given chain family. */
export async function verifyOwnershipSignature(family: ChainFamily, message: string, signature: string, address: string): Promise<boolean> {
  const sig = String(signature || "").trim();
  if (!sig || !message) return false;
  try {
    if (family === "evm") {
      const recovered = ethersVerifyMessage(message, sig.startsWith("0x") ? sig : `0x${sig}`);
      return sameAddress("evm", recovered, address);
    }
    if (family === "tron") {
      const t = tron();
      const clean = sig.startsWith("0x") ? sig : `0x${sig}`;
      try {
        const v2 = await t.trx.verifyMessageV2(message, clean);
        if (sameAddress("tron", v2, address)) return true;
      } catch { /* fall through to v1 */ }
      try {
        const hex = t.toHex(message).replace(/^0x/, "");
        return await t.trx.verifyMessage(hex, clean, address);
      } catch {
        return false;
      }
    }
    // solana — signature is base58 (wallet-standard) or base64; message is UTF-8 bytes
    const msg = new TextEncoder().encode(message);
    const pub = bs58.decode(address);
    for (const decode of [() => bs58.decode(sig), () => Uint8Array.from(Buffer.from(sig, "base64"))]) {
      try {
        const bytes = decode();
        if (bytes.length === 64 && ed25519.verify(bytes, msg, pub)) return true;
      } catch { /* try next encoding */ }
    }
    return false;
  } catch {
    return false;
  }
}
