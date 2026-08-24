/**
 * CryptoRefundModal — merchant-facing on-chain refund flow (Crypto Refund Flow).
 *
 * Reusable across Product Orders and Payment Links. Given a refund source it:
 *   1) previews the original payment (asset, chain, cap, customer refund address, gas)
 *   2) lets the merchant enter a partial/full amount (single refund, capped) + reason
 *   3) creates the refund invoice and shows the DynoPay deposit address + status
 *
 * The backend is gated by ENABLE_CRYPTO_REFUNDS and, in the preview, runs in
 * DRY-RUN (placeholder deposit address, no funds move) — surfaced via `is_dry_run`.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  TextField,
  Alert,
  Chip,
  Box,
  LinearProgress,
  Divider,
  IconButton,
  Tooltip,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import axiosBaseApi from "@/axiosConfig";
import { RefundStatusTimeline, maskAddress } from "./refundStatus";

export type RefundSourceType = "product_order" | "payment_link";

interface Preview {
  chain: string;
  asset: string;
  asset_kind: "native" | "token";
  original_crypto_amount: number;
  max_refundable: number;
  customer_refund_address: string;
  gas_buffer_native: number;
  gas_buffer_symbol: string;
  gas_coverage: "in_asset" | "fee_wallet";
  deposit_asset: string;
  full_refund_deposit_total: number;
  dry_run: boolean;
  needs_address?: boolean;
  address_invalid?: boolean;
}

interface RefundRow {
  refund_id: string;
  status: string;
  asset: string;
  chain: string;
  refund_amount: string | number;
  merchant_deposit_total: string | number;
  deposit_asset: string;
  dyno_deposit_address: string;
  customer_refund_address: string;
  gas_buffer_native: string | number;
  gas_buffer_symbol: string;
  is_dry_run: boolean;
  expires_at?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sourceType: RefundSourceType;
  sourceRef: string;
  onDone?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  awaiting_deposit: { bg: "#FEF3C7", fg: "#92400E" },
  deposit_detected: { bg: "#DBEAFE", fg: "#1E40AF" },
  forwarding: { bg: "#DBEAFE", fg: "#1E40AF" },
  completed: { bg: "#DCFCE7", fg: "#166534" },
  cancelled: { bg: "#E5E7EB", fg: "#4B5563" },
  failed: { bg: "#FEE2E2", fg: "#991B1B" },
  expired: { bg: "#E5E7EB", fg: "#4B5563" },
};

/**
 * Lightweight client-side per-chain address format check (instant feedback).
 * The backend re-validates authoritatively. Mirrors refundChains.ts patterns.
 */
const ADDR_PATTERNS: Record<string, RegExp> = {
  btc: /^(bc1[a-z0-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
  ltc: /^(ltc1[a-z0-9]{11,87}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
  doge: /^D[1-9A-HJ-NP-Za-km-z]{25,39}$/,
  bch: /^((bitcoincash:)?[qp][a-z0-9]{38,}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/i,
  evm: /^0x[0-9a-fA-F]{40}$/,
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  sol: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  xrp: /^r[1-9A-HJ-NP-Za-km-z]{23,34}$/,
};

const familyForChain = (chain: string): string => {
  const c = String(chain || "").toUpperCase();
  if (c === "ETH" || c === "POLYGON" || c.includes("ERC20") || c.includes("POLYGON")) return "evm";
  if (c === "TRX" || c.includes("TRC20")) return "tron";
  if (c === "BTC") return "btc";
  if (c === "LTC") return "ltc";
  if (c === "DOGE") return "doge";
  if (c === "BCH") return "bch";
  if (c === "SOL") return "sol";
  if (c === "XRP" || c === "RLUSD") return "xrp";
  return "unknown";
};

const isValidAddressFor = (chain: string, addr: string): boolean => {
  const a = String(addr || "").trim();
  if (!a) return false;
  const re = ADDR_PATTERNS[familyForChain(chain)];
  return re ? re.test(a) : a.length >= 12 && a.length <= 255;
};

const CryptoRefundModal: React.FC<Props> = ({ open, onClose, sourceType, sourceRef, onDone }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [existing, setExisting] = useState<RefundRow | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [amountPreset, setAmountPreset] = useState<"full" | "half" | "custom">("full");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<RefundRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [addrInput, setAddrInput] = useState<string>("");
  const [addrConfirmed, setAddrConfirmed] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setExisting(null);
    setCreated(null);
    try {
      // Any active/complete refund already on this source?
      const listResp = await axiosBaseApi.get(
        `refunds?source_type=${sourceType}&source_ref=${encodeURIComponent(sourceRef)}`
      );
      const rows: RefundRow[] = listResp?.data?.data || [];
      const active = rows.find(
        (r) => !["cancelled", "failed", "expired"].includes(String(r.status))
      );
      if (active) {
        setExisting(active);
        setLoading(false);
        return;
      }
      const prevResp = await axiosBaseApi.get(
        `refunds/preview?source_type=${sourceType}&source_ref=${encodeURIComponent(sourceRef)}`
      );
      const p: Preview = prevResp?.data?.data;
      setPreview(p);
      setAmount(String(p.max_refundable));
      setAmountPreset("full");
      setAddrInput(p.address_invalid ? String(p.customer_refund_address || "") : "");
      setAddrConfirmed(false);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Unable to load refund details."
      );
    } finally {
      setLoading(false);
    }
  }, [sourceType, sourceRef]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const submit = async () => {
    if (!preview) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a refund amount greater than 0.");
      return;
    }
    if (amt > preview.max_refundable) {
      setError(`Amount cannot exceed ${preview.max_refundable} ${preview.asset}.`);
      return;
    }
    let refundAddr: string | undefined;
    if (preview.needs_address) {
      const a = addrInput.trim();
      if (!isValidAddressFor(preview.chain, a)) {
        setError(`Enter a valid ${preview.asset} address on the ${preview.chain} network.`);
        return;
      }
      refundAddr = a;
    }
    if (!addrConfirmed) {
      setError("Please confirm the refund address is correct before continuing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await axiosBaseApi.post(`refunds`, {
        source_type: sourceType,
        source_ref: sourceRef,
        amount: amt,
        reason: reason || undefined,
        refund_address: refundAddr,
      });
      setCreated(resp?.data?.data);
      onDone?.();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Unable to create the refund."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRefund = async (refundId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await axiosBaseApi.post(`refunds/${refundId}/cancel`, {});
      onDone?.();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Unable to cancel refund.");
    } finally {
      setSubmitting(false);
    }
  };

  // Sandbox only — advance a dry-run refund to the next stage to preview the flow.
  const simulateAdvance = async (refundId: string) => {
    setSimulating(true);
    setError(null);
    try {
      await axiosBaseApi.post(`refunds/${refundId}/simulate`, {});
      onDone?.();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Unable to advance refund.");
    } finally {
      setSimulating(false);
    }
  };

  const copy = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const invoice = created || existing;

  const renderInvoice = (r: RefundRow) => {
    const sc = STATUS_COLORS[r.status] || STATUS_COLORS.awaiting_deposit;
    const isPlaceholder = /^DRYRUN-/.test(r.dyno_deposit_address || "");
    return (
      <Stack spacing={2} sx={{ pt: 1 }} data-testid="refund-invoice">
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2">Refund status</Typography>
          <Chip
            size="small"
            label={String(r.status).replace(/_/g, " ").toUpperCase()}
            sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 700 }}
            data-testid="refund-status-chip"
          />
          {r.is_dry_run && (
            <Chip size="small" label="DRY-RUN" sx={{ bgcolor: "#EDE9FE", color: "#5B21B6", fontWeight: 700 }} />
          )}
        </Stack>

        <Box sx={{ px: 0.5 }}>
          <RefundStatusTimeline status={r.status} />
        </Box>

        {r.is_dry_run &&
          ["awaiting_deposit", "deposit_detected", "forwarding"].includes(r.status) && (
            <Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => simulateAdvance(r.refund_id)}
                disabled={simulating}
                data-testid="refund-simulate-btn"
              >
                {simulating ? "Advancing…" : "Advance status (simulate)"}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Sandbox only — steps the refund to the next stage so you can preview
                the full flow. No funds move.
              </Typography>
            </Box>
          )}

        {r.is_dry_run && (
          <Alert severity="info" sx={{ fontSize: 13 }}>
            Preview / sandbox mode — this is a demonstration. No deposit address was
            allocated and no funds will move. On production this shows a real
            DynoPay address to send the refund to.
          </Alert>
        )}

        <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "action.hover" }}>
          <Typography variant="caption" color="text.secondary">
            Send exactly
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: "text.primary" }} data-testid="refund-deposit-amount">
            {Number(r.merchant_deposit_total)} {r.deposit_asset}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            to this DynoPay {r.chain} address:
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
            <Typography
              sx={{ fontFamily: "var(--font-mono)", wordBreak: "break-all", fontSize: 13, color: "text.primary" }}
              data-testid="refund-deposit-address"
            >
              {r.dyno_deposit_address}
            </Typography>
            {!isPlaceholder && (
              <Tooltip title={copied ? "Copied" : "Copy"}>
                <IconButton size="small" onClick={() => copy(r.dyno_deposit_address)}>
                  <ContentCopyRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>

        <Divider />
        <Stack spacing={0.5}>
          <Row label="Refund to customer" value={`${Number(r.refund_amount)} ${r.asset}`} />
          <Row
            label="Network fee (you cover)"
            value={`${Number(r.gas_buffer_native)} ${r.gas_buffer_symbol}`}
          />
          <Row
            label="Customer receives at"
            value={maskAddress(r.customer_refund_address)}
            mono
          />
        </Stack>
      </Stack>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" data-testid="crypto-refund-dialog">
      <DialogTitle>Crypto refund</DialogTitle>
      <DialogContent>
        {loading ? (
          <LinearProgress data-testid="crypto-refund-loading" />
        ) : error && !preview && !invoice ? (
          <Alert severity="error" data-testid="crypto-refund-error">
            {error}
          </Alert>
        ) : invoice ? (
          <>
            {renderInvoice(invoice)}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        ) : preview ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info" sx={{ fontSize: 13 }}>
              DynoPay-mediated, same-chain refund. You send the crypto (plus the
              network fee) to a DynoPay address on <b>{preview.chain}</b>; DynoPay
              forwards it to the customer’s saved refund address. One refund per
              payment, up to the amount paid.
            </Alert>

            <Stack spacing={0.5}>
              <Row label="Asset / chain" value={`${preview.asset} · ${preview.chain}`} />
              <Row
                label="Paid by customer"
                value={`${preview.original_crypto_amount} ${preview.asset}`}
              />
              {!preview.needs_address && (
                <Row
                  label="Customer refund address"
                  value={maskAddress(preview.customer_refund_address)}
                  mono
                />
              )}
              <Row
                label={
                  preview.gas_coverage === "in_asset"
                    ? "Network fee (added to your deposit)"
                    : "Network fee (DynoPay fronts, you cover)"
                }
                value={`~${preview.gas_buffer_native} ${preview.gas_buffer_symbol}`}
              />
            </Stack>

            {preview.needs_address && (
              <Box>
                <Alert
                  severity="warning"
                  sx={{ fontSize: 13, mb: 1 }}
                  data-testid="refund-needs-address"
                >
                  {preview.address_invalid
                    ? `The refund address on file is not a valid ${preview.chain} address. Enter the customer's ${preview.asset} address on the ${preview.chain} network.`
                    : `No customer refund address on file. Enter the customer's ${preview.asset} address on the ${preview.chain} network — the refund is sent on this chain.`}
                </Alert>
                <TextField
                  label={`Customer ${preview.asset} refund address`}
                  value={addrInput}
                  onChange={(e) => setAddrInput(e.target.value)}
                  placeholder={`${preview.chain} address`}
                  inputProps={{ "data-testid": "refund-address-input", maxLength: 255 }}
                  error={!!addrInput.trim() && !isValidAddressFor(preview.chain, addrInput)}
                  helperText={
                    !!addrInput.trim() && !isValidAddressFor(preview.chain, addrInput)
                      ? `Not a valid ${preview.chain} address`
                      : `Must be a ${preview.chain} address (refund is locked to the original chain)`
                  }
                  fullWidth
                />
              </Box>
            )}

            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button
                  size="small"
                  variant={amountPreset === "full" ? "contained" : "outlined"}
                  onClick={() => {
                    setAmountPreset("full");
                    setAmount(String(preview.max_refundable));
                  }}
                  data-testid="refund-preset-full"
                >
                  Full
                </Button>
                <Button
                  size="small"
                  variant={amountPreset === "half" ? "contained" : "outlined"}
                  onClick={() => {
                    setAmountPreset("half");
                    setAmount(String(Math.floor((preview.max_refundable / 2) * 1e8) / 1e8));
                  }}
                  data-testid="refund-preset-half"
                >
                  50%
                </Button>
                <Button
                  size="small"
                  variant={amountPreset === "custom" ? "contained" : "outlined"}
                  onClick={() => {
                    setAmountPreset("custom");
                    setAmount("");
                  }}
                  data-testid="refund-preset-custom"
                >
                  Custom
                </Button>
              </Stack>
              <TextField
                label={`Refund amount (${preview.asset})`}
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountPreset("custom");
                }}
                inputProps={{
                  min: 0,
                  max: preview.max_refundable,
                  step: "any",
                  "data-testid": "refund-amount-input",
                }}
                helperText={`Max ${preview.max_refundable} ${preview.asset} (partial allowed)`}
                fullWidth
              />
            </Box>
            <TextField
              label="Reason (optional, shown to customer)"
              multiline
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              inputProps={{ maxLength: 500, "data-testid": "refund-reason-input" }}
              fullWidth
            />
            <FormControlLabel
              sx={{ alignItems: "flex-start", m: 0 }}
              control={
                <Checkbox
                  checked={addrConfirmed}
                  onChange={(e) => setAddrConfirmed(e.target.checked)}
                  sx={{ pt: 0, mr: 1 }}
                  inputProps={{ "data-testid": "refund-confirm-checkbox" } as any}
                />
              }
              label={
                <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.4 }}>
                  I confirm the refund will be sent to{" "}
                  <b style={{ wordBreak: "break-all" }}>
                    {preview.needs_address
                      ? (addrInput.trim() ? maskAddress(addrInput.trim()) : "the address above")
                      : maskAddress(preview.customer_refund_address)}
                  </b>{" "}
                  on the <b>{preview.chain}</b> network. Crypto transfers are
                  irreversible and cannot be undone once sent.
                </Typography>
              }
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting} data-testid="crypto-refund-close-btn">
          Close
        </Button>
        {invoice && !created && invoice.status === "awaiting_deposit" && (
          <Button
            color="error"
            onClick={() => cancelRefund(invoice.refund_id)}
            disabled={submitting}
            data-testid="crypto-refund-cancel-btn"
          >
            Cancel refund
          </Button>
        )}
        {preview && !invoice && (
          <Button
            variant="contained"
            onClick={submit}
            disabled={
              submitting ||
              !addrConfirmed ||
              (!!preview.needs_address && !isValidAddressFor(preview.chain, addrInput))
            }
            data-testid="crypto-refund-submit-btn"
          >
            {submitting ? "Creating…" : "Create refund"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <Stack direction="row" justifyContent="space-between" spacing={2}>
    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography
      variant="caption"
      sx={{ fontWeight: 600, textAlign: "right", wordBreak: "break-all", fontFamily: mono ? "var(--font-mono)" : undefined }}
    >
      {value}
    </Typography>
  </Stack>
);

export default CryptoRefundModal;
