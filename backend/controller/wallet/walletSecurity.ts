/**
 * Wallet security endpoints:
 *   - checkAddressSanity  (authed)  — pre-save "is this the right address?" check
 *   - revertWalletChange  (public)  — the one-tap "this wasn't me" handler
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { walletLogger } from "../../utils/loggers";
import { tatumClient } from "../../integrations/tatum/TatumClient";
import { performRevert } from "../../services/wallet/walletChangeAlert";

const EVM = ["ETH", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON"];
const TRON = ["TRX", "USDT-TRC20"];

type Kind = "evm" | "tron" | "unknown";

function detectKind(address: string): Kind {
  const a = (address || "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "evm";
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "tron";
  return "unknown";
}

/** null = a chain that has no EVM/Tron shape (BTC/LTC/…); any evm/tron paste is wrong. */
function expectedKind(currency: string): Kind | null {
  if (EVM.includes(currency)) return "evm";
  if (TRON.includes(currency)) return "tron";
  return null;
}

const kindLabel = (k: Kind) =>
  k === "evm" ? "an Ethereum-style (EVM)" : k === "tron" ? "a Tron (TRC-20)" : "";

interface SanityWarning {
  code: "network_mismatch" | "no_history";
  severity: "high" | "low";
  message: string;
}

// ============================================
// POST /wallet/address-sanity  (authed)
// Body: { address, currency }
// ============================================
export const checkAddressSanity = async (req: express.Request, res: express.Response) => {
  try {
    const address = String(req.body?.address || "").trim();
    const currency = String(req.body?.currency || "").trim();
    if (!address || !currency) {
      return errorResponseHelper(res, 400, "address and currency are required");
    }

    const warnings: SanityWarning[] = [];

    // 1) Network-mismatch — instant, offline.
    const kind = detectKind(address);
    const expected = expectedKind(currency);
    let network_mismatch = false;
    if (kind !== "unknown" && kind !== expected) {
      network_mismatch = true;
      warnings.push({
        code: "network_mismatch",
        severity: "high",
        message: `This looks like ${kindLabel(kind)} address, but you selected the ${currency} network. Double-check you're on the right chain.`,
      });
    }

    // 2) Never-received-funds — best-effort on-chain lookup.
    let has_received_funds: boolean | null = null;
    if (!network_mismatch) {
      try {
        let balance = 0;
        if (currency === "TRX" || currency === "USDT-TRC20") {
          const r: any = await tatumClient.validateTronAddress(address);
          balance = parseFloat(String(r?.balance ?? r?.trxBalance ?? "0")) || 0;
        } else {
          const r: any = await tatumClient.getAddressBalance(address, currency);
          balance = parseFloat(String(r?.balance ?? "0")) || 0;
        }
        if (balance > 0) {
          has_received_funds = true;
        } else {
          const incoming: any[] = await tatumClient.getIncomingTransactions(address, currency, 1);
          has_received_funds = Array.isArray(incoming) && incoming.length > 0;
        }
        if (has_received_funds === false) {
          warnings.push({
            code: "no_history",
            severity: "low",
            message: `This ${currency} address has no incoming transactions yet. That's fine for a brand-new wallet — just make sure it's the address you meant.`,
          });
        }
      } catch (e) {
        // Unknown history (lookup failed / chain unsupported) — never warn on a guess.
        has_received_funds = null;
        walletLogger.info(`[addressSanity] history lookup skipped for ${currency}: ${(e as Error).message}`);
      }
    }

    return successResponseHelper(res, 200, "OK", {
      network_mismatch,
      detected_kind: kind,
      has_received_funds,
      warnings,
    });
  } catch (e) {
    handleControllerError(res, e, walletLogger);
  }
};

// ============================================
// POST /wallet-security/revert-change  (PUBLIC — no auth)
// Body: { token }
// ============================================
export const revertWalletChange = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.body?.token || req.query?.token || "").trim();
    if (!token || !/^[a-f0-9]{20,80}$/.test(token)) {
      return errorResponseHelper(res, 400, "Invalid or missing token");
    }
    const result = await performRevert(token);
    if (!result.ok) {
      return res.status(410).json({
        success: false,
        statusCode: 410,
        code: result.reason === "expired" ? "LINK_EXPIRED" : "LINK_INVALID",
        message:
          result.reason === "expired"
            ? "This link has expired or was already used."
            : "This link is no longer valid.",
      });
    }
    return successResponseHelper(res, 200, "Your account has been secured.", {
      reverted: true,
      company_name: result.companyName || null,
      networks: result.networks || [],
    });
  } catch (e) {
    handleControllerError(res, e, walletLogger);
  }
};
