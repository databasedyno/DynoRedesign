/**
 * Chain-specific "send exact payment" + "sign ownership message" helpers used by the wallet UI.
 * Each function takes the AppKit walletProvider for its namespace and returns a tx hash / signature.
 */
import type { WalletRail } from "./rails";
import { toBaseUnits } from "./rails";

export interface EvmProvider { request(args: { method: string; params?: unknown[] | object }): Promise<unknown> }
export interface SolanaProvider {
  publicKey?: { toBase58(): string; toBytes?(): Uint8Array } | null;
  signAndSendTransaction(tx: unknown, opts?: unknown): Promise<string>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}
export interface TronProvider {
  sendTransaction(params: { to: string; from: string; value: string; data?: string }): Promise<string>;
  signMessage(params: { message: string; from: string }): Promise<string>;
  request?(args: { method: string; params?: unknown }): Promise<unknown>;
}

/* ───────────────────────────── EVM (viem over the EIP-1193 provider) ───────────────────────────── */
export async function sendEvmPayment(provider: EvmProvider, rail: WalletRail, from: string, to: string, amount: string): Promise<string> {
  const { createWalletClient, custom, erc20Abi, getAddress } = await import("viem");
  const { mainnet, polygon } = await import("viem/chains");
  const chain = rail.chainId === 137 ? polygon : mainnet;
  const client = createWalletClient({ account: getAddress(from), chain, transport: custom(provider) });
  const current = await client.getChainId();
  if (current !== chain.id) {
    try {
      await client.switchChain({ id: chain.id });
    } catch (e: any) {
      // 4902 = chain not added to the wallet
      if (e?.code === 4902 || /Unrecognized chain|not added/i.test(String(e?.message))) {
        await client.addChain({ chain });
        await client.switchChain({ id: chain.id });
      } else throw e;
    }
  }
  const value = toBaseUnits(amount, rail.decimals);
  if (rail.token) {
    return client.writeContract({ address: getAddress(rail.token), abi: erc20Abi, functionName: "transfer", args: [getAddress(to), value], chain, account: getAddress(from) });
  }
  return client.sendTransaction({ to: getAddress(to), value, chain, account: getAddress(from) });
}

export async function signEvmMessage(provider: EvmProvider, from: string, message: string): Promise<string> {
  const { createWalletClient, custom, getAddress } = await import("viem");
  const client = createWalletClient({ account: getAddress(from), transport: custom(provider) });
  return client.signMessage({ account: getAddress(from), message });
}

/* ───────────────────────────── Solana (native SOL transfer) ───────────────────────────── */
export async function sendSolanaPayment(provider: SolanaProvider, connection: any, rail: WalletRail, from: string, to: string, amount: string): Promise<string> {
  const { PublicKey, SystemProgram, Transaction } = await import("@solana/web3.js");
  const lamports = toBaseUnits(amount, rail.decimals);
  const fromKey = new PublicKey(from);
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: fromKey, toPubkey: new PublicKey(to), lamports }));
  tx.feePayer = fromKey;
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  return provider.signAndSendTransaction(tx);
}

export async function signSolanaMessage(provider: SolanaProvider, message: string): Promise<string> {
  const sig = await provider.signMessage(new TextEncoder().encode(message));
  // base64 — the backend accepts base58 or base64
  let bin = "";
  sig.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

/* ───────────────────────────── Tron (TRX native or TRC-20 via TronWeb) ───────────────────────────── */
const TRONGRID = process.env.NEXT_PUBLIC_TRONGRID_HOST || "https://api.trongrid.io";

async function tronWeb() {
  const mod: any = await import("tronweb");
  const TronWebCtor = mod.TronWeb || mod.default?.TronWeb || mod.default;
  const headers: Record<string, string> = {};
  if (process.env.NEXT_PUBLIC_TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = process.env.NEXT_PUBLIC_TRONGRID_API_KEY;
  return new TronWebCtor({ fullHost: TRONGRID, headers });
}

export async function sendTronPayment(provider: TronProvider, rail: WalletRail, from: string, to: string, amount: string, viaWalletConnect = false): Promise<string> {
  const value = toBaseUnits(amount, rail.decimals);
  if (!rail.token) {
    // Native TRX — the connector builds/signs/broadcasts itself (value in SUN).
    return provider.sendTransaction({ to, from, value: value.toString() });
  }
  const tw = await tronWeb();
  const { transaction } = await tw.transactionBuilder.triggerSmartContract(
    rail.token,
    "transfer(address,uint256)",
    { feeLimit: 100_000_000, callValue: 0 },
    [{ type: "address", value: to }, { type: "uint256", value: value.toString() }],
    from,
  );
  if (!transaction?.txID) throw new Error("Could not build the TRC-20 transfer.");
  if (!provider.request) throw new Error("This wallet can't sign TRC-20 transfers here — send from the wallet app instead.");
  // Extension wallets (TronLink / Trust / OKX) sign via the adapter (tron_sendTransaction);
  // WalletConnect wallets via tron_signTransaction (v2 payload first, then legacy v1).
  const attempts: Array<{ method: string; params: unknown }> = viaWalletConnect
    ? [
        { method: "tron_signTransaction", params: { address: from, transaction: { transaction } } },
        { method: "tron_signTransaction", params: { address: from, transaction } },
      ]
    : [{ method: "tron_sendTransaction", params: { transaction } }];
  let signed: any = null;
  let lastErr: any = null;
  for (const a of attempts) {
    try {
      signed = await provider.request(a);
      if (signed?.signature?.length) break;
    } catch (e: any) {
      lastErr = e;
      if (/reject|denied|cancel/i.test(String(e?.message))) throw e;
    }
  }
  if (!signed?.signature?.length) throw lastErr || new Error("Transaction signing failed.");
  const result = await tw.trx.sendRawTransaction(signed);
  if (!result?.result) throw new Error(result?.message ? tw.toUtf8(result.message) : "Broadcast failed.");
  return signed.txID || transaction.txID;
}

export async function signTronMessage(provider: TronProvider, from: string, message: string): Promise<string> {
  return provider.signMessage({ message, from });
}
