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
  gasPriceGwei: string;
}

/**
 * Check if a wallet type supports direct EVM transfer
 */
export function isDirectEvmSupported(walletType: string): boolean {
  return walletType in CHAIN_CONFIG;
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
      //    The old code used legacy `gasPrice` from `feeData.gasPrice`, which on
      //    Ethereum mainnet is often BELOW the current block's baseFee — the RPC
      //    accepts the TX, returns a valid hash, but the TX is then silently
      //    dropped from mempool because maxFeePerGas < baseFee. Classic ghost TX.
      //
      //    Floors:
      //      priority >= 1.5 Gwei on ETH / 30 Gwei on POLYGON (reliable inclusion)
      //      maxFee   >= baseFee * 2 + priority, with absolute minimums of
      //                  3 Gwei on ETH and 50 Gwei on POLYGON
      const isPolygon = config.chain === "POLYGON";
      const minPriorityFee = ethers.parseUnits(isPolygon ? "30" : "1.5", "gwei");
      const minMaxFee = ethers.parseUnits(isPolygon ? "50" : "3", "gwei");

      let maxPriorityFeePerGas: bigint;
      let maxFeePerGas: bigint;

      if (params.gasPriceGwei && params.gasPriceGwei > 0) {
        // Caller-supplied override: interpret as maxFeePerGas with default priority
        maxFeePerGas = ethers.parseUnits(
          Math.ceil(params.gasPriceGwei).toString(),
          "gwei"
        );
        maxPriorityFeePerGas = minPriorityFee < maxFeePerGas
          ? minPriorityFee
          : maxFeePerGas;
      } else {
        // Read live baseFee + priority suggestion from the node
        const [latestBlock, feeData] = await Promise.all([
          provider.getBlock("latest"),
          provider.getFeeData(),
        ]);
        const baseFee = latestBlock?.baseFeePerGas ?? 0n;

        const suggestedPriority = feeData.maxPriorityFeePerGas ?? 0n;
        maxPriorityFeePerGas =
          suggestedPriority > minPriorityFee ? suggestedPriority : minPriorityFee;

        // 2x baseFee headroom covers several blocks of base-fee spikes
        const computedMaxFee = baseFee * 2n + maxPriorityFeePerGas;
        maxFeePerGas = computedMaxFee > minMaxFee ? computedMaxFee : minMaxFee;

        cronLogger.info(
          `${LOG_PREFIX} baseFee=${ethers.formatUnits(baseFee, "gwei")} Gwei, priority=${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} Gwei, maxFee=${ethers.formatUnits(maxFeePerGas, "gwei")} Gwei`
        );
      }

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
          Math.floor(params.amount * 1e8) / 1e8;
        const value = ethers.parseEther(truncatedAmount.toString());

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
          `${LOG_PREFIX} Native sweep: ${truncatedAmount} → ${params.toAddress}`
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
