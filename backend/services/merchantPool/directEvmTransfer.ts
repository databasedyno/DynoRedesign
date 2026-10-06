/**
 * Direct EVM Transaction Builder
 *
 * Bypasses Tatum SDK for sweep transactions to eliminate "ghost TX" issues.
 * Uses ethers.js to build, sign, and broadcast transactions directly via JSON-RPC.
 *
 * Key advantages over Tatum SDK:
 * - TX hash is computed locally from signed bytes (deterministic, cannot be a ghost)
 * - Direct JSON-RPC broadcast (eth_sendRawTransaction)
 * - Multiple RPC endpoint fallback for redundancy
 * - Explicit nonce management prevents stuck transactions
 */

import { ethers } from "ethers";
import { cronLogger } from "../../utils/loggers";
import { TOKEN_CONTRACTS } from "./merchantPoolConfig";
import { TATUM_V3_URL, getTatumApiKey } from "../../utils/tatumAuth";
import { toNumber } from "../../utils/money";

const LOG_PREFIX = "[DirectEvmSweep]";

// ─── Chain Configuration ───────────────────────────────────────────────────────

interface ChainConfig {
  chain: "ETH" | "POLYGON";
  isToken: boolean;
  contractAddress?: string;
  decimals: number;
  defaultGasLimit: number;
  maxGasPriceGwei: number;
}

const CHAIN_CONFIG: Record<string, ChainConfig> = {
  ETH: {
    chain: "ETH",
    isToken: false,
    decimals: 18,
    defaultGasLimit: 21000,
    maxGasPriceGwei: 50,
  },
  "USDT-ERC20": {
    chain: "ETH",
    isToken: true,
    contractAddress: TOKEN_CONTRACTS["USDT-ERC20"],
    decimals: 6,
    defaultGasLimit: 65000,
    maxGasPriceGwei: 50,
  },
  "USDC-ERC20": {
    chain: "ETH",
    isToken: true,
    contractAddress: TOKEN_CONTRACTS["USDC-ERC20"],
    decimals: 6,
    defaultGasLimit: 65000,
    maxGasPriceGwei: 50,
  },
  "RLUSD-ERC20": {
    chain: "ETH",
    isToken: true,
    contractAddress: TOKEN_CONTRACTS["RLUSD-ERC20"],
    decimals: 6,
    defaultGasLimit: 65000,
    maxGasPriceGwei: 50,
  },
  POLYGON: {
    chain: "POLYGON",
    isToken: false,
    decimals: 18,
    defaultGasLimit: 21000,
    maxGasPriceGwei: 500,
  },
  "USDT-POLYGON": {
    chain: "POLYGON",
    isToken: true,
    contractAddress: TOKEN_CONTRACTS["USDT-POLYGON"],
    decimals: 6,
    defaultGasLimit: 65000,
    maxGasPriceGwei: 500,
  },
};

// ERC20 transfer ABI for encoding calldata
const ERC20_IFACE = new ethers.Interface([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

// ─── RPC Endpoints ─────────────────────────────────────────────────────────────

export function getRpcUrls(chain: "ETH" | "POLYGON"): string[] {
  const tatumKey = getTatumApiKey();

  if (chain === "POLYGON") {
    // NOTE: https://polygon-rpc.com now returns HTTP 401 "API key disabled /
    // tenant disabled" for anonymous requests, which broke provider network
    // detection. Lead with reachable public nodes; keep Tatum as authed fallback.
    const urls = [
      "https://polygon-bor-rpc.publicnode.com",
      "https://polygon.drpc.org",
    ];
    if (tatumKey) urls.push(`${TATUM_V3_URL}/polygon/web3/${tatumKey}`);
    return urls;
  }

  // Ethereum — https://eth.llamarpc.com started returning HTTP 521 (server
  // down), which stalled network detection. Lead with reliable public nodes.
  const urls = [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org",
  ];
  if (tatumKey) urls.push(`${TATUM_V3_URL}/ethereum/web3/${tatumKey}`);
  return urls;
}

// ─── Provider Factory ──────────────────────────────────────────────────────────

function createProvider(rpcUrl: string, chain: "ETH" | "POLYGON"): ethers.JsonRpcProvider {
  // Pin the network explicitly (ETH=1, POLYGON=137) so ethers NEVER runs its
  // own eth_chainId "network detection". Detecting against a dead/unauthorized
  // endpoint is what produced the noisy log loop:
  //   "JsonRpcProvider failed to detect network and cannot start up; retry in 1s"
  // With an explicit staticNetwork the provider fails fast on an unreachable RPC
  // and the caller falls through to the next endpoint in getRpcUrls().
  const network = ethers.Network.from(chain === "POLYGON" ? 137 : 1);
  // Tatum proxy needs API key in header too for some endpoints
  const tatumKey = getTatumApiKey();
  if (rpcUrl.includes("tatum.io") && tatumKey) {
    const fetchReq = new ethers.FetchRequest(rpcUrl);
    fetchReq.setHeader("x-api-key", tatumKey);
    fetchReq.timeout = 15000;
    return new ethers.JsonRpcProvider(fetchReq, network, {
      staticNetwork: network,
    });
  }
  return new ethers.JsonRpcProvider(rpcUrl, network, {
    staticNetwork: network,
  });
}

// ─── Non-retryable Error Detection ─────────────────────────────────────────────

const NON_RETRYABLE_PATTERNS = [
  "insufficient funds",
  "nonce too low",
  "replacement transaction underpriced",
  "invalid private key",
  "invalid address",
];

function isNonRetryable(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return NON_RETRYABLE_PATTERNS.some((p) => lower.includes(p));
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface DirectEvmSweepResult {
  txHash: string;
  nonce: number;
  /** maxFeePerGas actually signed (decimal gwei). */
  gasPriceGwei: string;
  /** maxPriorityFeePerGas actually signed (decimal gwei). */
  priorityFeeGwei: string;
  baseFeeGwei: string;
  gasLimit: number;
  /** Amount actually signed into the TX (native coin or token units) — may be clamped below the request. */
  amountSent: string;
}

/** Largest shortfall the native clamp will absorb silently: 100× an 8-dp rounding step. */
const NATIVE_CLAMP_MAX_WEI = 1_000_000_000_000n; // 0.000001 ETH

/**
 * Check if a wallet type supports direct EVM transfer
 */
export function isDirectEvmSupported(walletType: string): boolean {
  return walletType in CHAIN_CONFIG;
}

/** True for native-coin wallet types (ETH / POLYGON) — gas is paid from the swept balance itself. */
export function isDirectEvmNative(walletType: string): boolean {
  const config = CHAIN_CONFIG[walletType];
  return !!config && !config.isToken;
}

export interface NativeSweepQuote {
  balance: number;
  /** Max amount that can leave the address once gasLimit × maxFeePerGas is reserved (8 dp, floored). */
  maxSendable: number;
  /** maxFeePerGas the quote assumed — pass as `gasPriceGwei` cap so the signed TX cannot exceed it. */
  maxFeeGwei: number;
  gasCost: number;
  baseFeeGwei: string;
}

/**
 * Quote a full-balance native sweep against the REAL maxFeePerGas the TX will be signed with.
 *
 * Nodes check `value + gasLimit × maxFeePerGas ≤ balance` (not the eventual effective price),
 * so reserving only the market estimate makes every full-balance ETH/POL sweep fail with
 * "insufficient funds for intrinsic transaction cost". Returns null if every RPC is down.
 */
export async function quoteNativeSweep(params: {
  fromAddress: string;
  walletType: string;
  gasLimit?: number;
}): Promise<NativeSweepQuote | null> {
  const config = CHAIN_CONFIG[params.walletType];
  if (!config || config.isToken) return null;
  const gasLimit = BigInt(params.gasLimit || config.defaultGasLimit);

  for (const rpcUrl of getRpcUrls(config.chain)) {
    try {
      const provider = createProvider(rpcUrl, config.chain);
      const [balance, fees] = await Promise.all([
        provider.getBalance(params.fromAddress, "latest"),
        computeEip1559Fees(provider, config),
      ]);
      const gasCost = gasLimit * fees.maxFeePerGas;
      const sendable = balance - gasCost;
      return {
        balance: toNumber(ethers.formatEther(balance), 8, "down"),
        maxSendable: sendable > 0n ? toNumber(ethers.formatEther(sendable), 8, "down") : 0,
        maxFeeGwei: Number(ethers.formatUnits(fees.maxFeePerGas, "gwei")),
        gasCost: toNumber(ethers.formatEther(gasCost), 10, "up"),
        baseFeeGwei: ethers.formatUnits(fees.baseFee, "gwei"),
      };
    } catch (error) {
      cronLogger.warn(`${LOG_PREFIX} quote via ${rpcUrl.substring(0, 50)} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}

/** Market EIP-1559 fees: priority = max(node suggestion, chain floor); maxFee = 2 × baseFee + priority, capped per chain. */
async function computeEip1559Fees(
  provider: ethers.JsonRpcProvider,
  config: ChainConfig
): Promise<{ baseFee: bigint; maxPriorityFeePerGas: bigint; maxFeePerGas: bigint }> {
  const isPolygon = config.chain === "POLYGON";
  const minPriorityFee = ethers.parseUnits(isPolygon ? "30" : "0.05", "gwei");
  const [latestBlock, feeData] = await Promise.all([provider.getBlock("latest"), provider.getFeeData()]);
  const baseFee = latestBlock?.baseFeePerGas ?? 0n;
  const suggestedPriority = feeData.maxPriorityFeePerGas ?? 0n;
  let maxPriorityFeePerGas = suggestedPriority > minPriorityFee ? suggestedPriority : minPriorityFee;
  let maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
  const maxAllowed = ethers.parseUnits(config.maxGasPriceGwei.toString(), "gwei");
  if (maxFeePerGas > maxAllowed) {
    maxFeePerGas = maxAllowed;
    if (maxPriorityFeePerGas > maxFeePerGas) maxPriorityFeePerGas = maxFeePerGas;
  }
  return { baseFee, maxPriorityFeePerGas, maxFeePerGas };
}

/**
 * Build, sign, and broadcast a sweep transaction using ethers.js directly.
 *
 * The TX hash is computed locally from the signed bytes — if this function
 * returns successfully, the hash is real and the transaction has been accepted
 * by at least one node. No more ghost TXs.
 */
export async function directEvmSweep(params: {
  fromAddress: string;
  toAddress: string;
  privateKey: string;
  walletType: string;
  amount: number;
  gasPriceGwei?: number;
  gasLimit?: number;
}): Promise<DirectEvmSweepResult> {
  const config = CHAIN_CONFIG[params.walletType];
  if (!config) {
    throw new Error(`${LOG_PREFIX} Unsupported wallet type: ${params.walletType}`);
  }

  const rpcUrls = getRpcUrls(config.chain);
  let lastError: Error | null = null;

  for (const rpcUrl of rpcUrls) {
    const rpcLabel = rpcUrl.substring(0, 50) + (rpcUrl.length > 50 ? "..." : "");
    try {
      cronLogger.info(`${LOG_PREFIX} Attempting via ${rpcLabel}`);
      const provider = createProvider(rpcUrl, config.chain);
      const wallet = new ethers.Wallet(params.privateKey, provider);

      // 1. Get nonce (use 'pending' to account for in-flight TXs)
      const nonce = await provider.getTransactionCount(params.fromAddress, "pending");
      cronLogger.info(`${LOG_PREFIX} Nonce: ${nonce}`);

      // 2. Determine EIP-1559 fee parameters (ETH & POLYGON are both EIP-1559 chains)
      //
      //    Market-based, decimal gwei — no integer rounding, no artificial 1.5/3 gwei floors
      //    (those made every low-gas payout pay ~10× market). What the sender actually pays
      //    is baseFee + priority; maxFee only needs headroom for base-fee spikes.
      //
      //    priority = max(node suggestion, floor)  floor: 0.05 gwei ETH / 30 gwei POLYGON
      //    maxFee   = baseFee × 2 + priority
      //    A caller-supplied `gasPriceGwei` (the amount already deducted from the merchant
      //    for gas) caps maxFee so a full-balance native transfer never exceeds the balance.
      const isPolygon = config.chain === "POLYGON";
      const minPriorityFee = ethers.parseUnits(isPolygon ? "30" : "0.05", "gwei");

      const fees = await computeEip1559Fees(provider, config);
      const baseFee = fees.baseFee;
      let maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
      let maxFeePerGas = fees.maxFeePerGas;

      if (params.gasPriceGwei && params.gasPriceGwei > 0) {
        const cap = ethers.parseUnits(params.gasPriceGwei.toFixed(9), "gwei");
        if (cap < maxFeePerGas) {
          if (cap < baseFee + minPriorityFee) {
            cronLogger.warn(
              `${LOG_PREFIX} fee cap ${params.gasPriceGwei} Gwei is below baseFee ${ethers.formatUnits(baseFee, "gwei")} + tip — TX may wait for the base fee to drop`
            );
          }
          maxFeePerGas = cap;
          if (maxPriorityFeePerGas > maxFeePerGas) maxPriorityFeePerGas = maxFeePerGas;
        }
      }

      cronLogger.info(
        `${LOG_PREFIX} baseFee=${ethers.formatUnits(baseFee, "gwei")} Gwei, priority=${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} Gwei, maxFee=${ethers.formatUnits(maxFeePerGas, "gwei")} Gwei${params.gasPriceGwei ? ` (cap ${params.gasPriceGwei} Gwei)` : ""}`
      );

      // Cap to prevent overpaying during spikes
      const maxAllowed = ethers.parseUnits(
        config.maxGasPriceGwei.toString(),
        "gwei"
      );
      if (maxFeePerGas > maxAllowed) {
        cronLogger.warn(
          `${LOG_PREFIX} maxFeePerGas ${ethers.formatUnits(maxFeePerGas, "gwei")} Gwei exceeds cap ${config.maxGasPriceGwei} Gwei, capping`
        );
        maxFeePerGas = maxAllowed;
        if (maxPriorityFeePerGas > maxFeePerGas) {
          maxPriorityFeePerGas = maxFeePerGas;
        }
      }

      const gasPriceStr = ethers.formatUnits(maxFeePerGas, "gwei");
      cronLogger.info(
        `${LOG_PREFIX} EIP-1559 fees: priority=${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} Gwei / maxFee=${gasPriceStr} Gwei`
      );

      const gasLimit = params.gasLimit || config.defaultGasLimit;

      // 3. Build transaction
      let tx: ethers.TransactionRequest;
      let amountSent: string;

      if (config.isToken && config.contractAddress) {
        // ERC20 token transfer — encode transfer(to, amount) calldata
        const truncatedAmount =
          Math.floor(params.amount * 10 ** config.decimals) /
          10 ** config.decimals;
        const amountBN = ethers.parseUnits(
          truncatedAmount.toString(),
          config.decimals
        );
        const data = ERC20_IFACE.encodeFunctionData("transfer", [
          params.toAddress,
          amountBN,
        ]);
        amountSent = truncatedAmount.toString();

        tx = {
          to: config.contractAddress,
          data,
          value: 0n,
          type: 2,
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit,
          nonce,
        };

        cronLogger.info(
          `${LOG_PREFIX} ERC20 sweep: ${truncatedAmount} tokens → ${params.toAddress} via ${config.contractAddress}`
        );
      } else {
        // Native transfer (ETH or POLYGON/POL)
        const truncatedAmount =
          toNumber(params.amount, 8, "down");
        let value = ethers.parseEther(truncatedAmount.toString());

        // Wei-exact guard: the node requires value + gasLimit × maxFeePerGas ≤ balance. Upstream
        // quotes are 8-dp decimals, so a full-balance payout can land a few wei short and be
        // rejected with INSUFFICIENT_FUNDS (prod 2026-10-06: short by exactly 1 gwei). Absorb a
        // rounding-sized shortfall here; anything larger is a real bug and must surface.
        const balance = await provider.getBalance(params.fromAddress, "latest");
        const maxValue = balance - BigInt(gasLimit) * maxFeePerGas;
        if (value > maxValue) {
          const shortfall = value - maxValue;
          if (maxValue <= 0n || shortfall > NATIVE_CLAMP_MAX_WEI) {
            throw new Error(
              `${LOG_PREFIX} insufficient funds: balance ${ethers.formatEther(balance)} cannot cover ${truncatedAmount} + gas ${ethers.formatEther(BigInt(gasLimit) * maxFeePerGas)} (short ${shortfall} wei)`
            );
          }
          cronLogger.warn(
            `${LOG_PREFIX} value ${truncatedAmount} exceeds sendable ${ethers.formatEther(maxValue)} by ${shortfall} wei — clamping to balance − gas`
          );
          value = maxValue;
        }
        amountSent = ethers.formatEther(value);

        tx = {
          to: params.toAddress,
          value,
          type: 2,
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit,
          nonce,
        };

        cronLogger.info(
          `${LOG_PREFIX} Native sweep: ${amountSent} → ${params.toAddress}`
        );
      }

      // 4. Sign and broadcast — then verify the TX actually reached the mempool.
      //    `sendTransaction` returns a locally-computed hash as soon as the RPC
      //    accepts the bytes. That hash is valid (derived from signed preimage)
      //    but is NOT a guarantee the TX was propagated to other nodes — e.g.
      //    if maxFeePerGas is below dynamic minimums, some clients accept the
      //    submit and silently drop it. We do a best-effort re-query to catch
      //    this before returning success to the caller.
      const txResponse = await wallet.sendTransaction(tx);
      cronLogger.info(`${LOG_PREFIX} ✍️  Signed + submitted: ${txResponse.hash}`);

      // Best-effort mempool sanity check. We poll for up to ~10s asking the
      // node whether it knows about this hash. If yes → broadcast confirmed.
      // If not → try the next RPC (since this one accepted-but-dropped).
      let accepted = false;
      for (let i = 0; i < 5; i++) {
        try {
          const lookup = await provider.getTransaction(txResponse.hash);
          if (lookup) {
            accepted = true;
            break;
          }
        } catch {
          /* transient — keep polling */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!accepted) {
        throw new Error(
          `TX ${txResponse.hash} was submitted but not visible in mempool after 10s — likely dropped (underpriced or node rejection)`
        );
      }

      cronLogger.info(`${LOG_PREFIX} ✅ TX accepted into mempool: ${txResponse.hash}`);

      return {
        txHash: txResponse.hash,
        nonce,
        gasPriceGwei: gasPriceStr,
        priorityFeeGwei: ethers.formatUnits(maxPriorityFeePerGas, "gwei"),
        baseFeeGwei: ethers.formatUnits(baseFee, "gwei"),
        gasLimit,
        amountSent,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      cronLogger.warn(`${LOG_PREFIX} RPC ${rpcLabel} failed: ${errMsg}`);
      lastError = error instanceof Error ? error : new Error(errMsg);

      // Don't try other RPCs for non-retryable errors
      if (isNonRetryable(errMsg)) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error(`${LOG_PREFIX} All RPC endpoints failed`);
}
