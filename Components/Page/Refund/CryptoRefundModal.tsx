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
  Box,
  LinearProgress,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { useTranslation, Trans } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { maskAddress } from "./refundStatus";
import { toNumber } from "@/utils/money";

import { Preview, RefundRow, RefundSourceType, Row, isValidAddressFor } from "./refundModalShared";
import { RefundInvoiceView } from "./RefundInvoiceView";

export type { RefundSourceType } from "./refundModalShared";

interface Props {
  open: boolean;
  onClose: () => void;
  sourceType: RefundSourceType;
  sourceRef: string;
  onDone?: () => void;
}


const CryptoRefundModal: React.FC<Props> = ({ open, onClose, sourceType, sourceRef, onDone }) => {
  const { t } = useTranslation("common");
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
        e?.response?.data?.message || e?.message || t("refund.errLoad")
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
      setError(t("refund.errAmountZero"));
      return;
    }
    if (amt > preview.max_refundable) {
      setError(t("refund.errAmountMax", { max: preview.max_refundable, asset: preview.asset }));
      return;
    }
    let refundAddr: string | undefined;
    if (preview.needs_address) {
      const a = addrInput.trim();
      if (!isValidAddressFor(preview.chain, a)) {
        setError(t("refund.errAddress", { asset: preview.asset, chain: preview.chain }));
        return;
      }
      refundAddr = a;
    }
    if (!addrConfirmed) {
      setError(t("refund.errConfirm"));
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
        e?.response?.data?.message || e?.message || t("refund.errCreate")
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
      setError(e?.response?.data?.message || e?.message || t("refund.errCancel"));
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
      setError(e?.response?.data?.message || e?.message || t("refund.errAdvance"));
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

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" data-testid="crypto-refund-dialog">
      <DialogTitle>{t("refund.title")}</DialogTitle>
      <DialogContent>
        {loading ? (
          <LinearProgress data-testid="crypto-refund-loading" />
        ) : error && !preview && !invoice ? (
          <Alert severity="error" data-testid="crypto-refund-error">
            {error}
          </Alert>
        ) : invoice ? (
          <>
            <RefundInvoiceView r={invoice} copied={copied} onCopy={copy} simulating={simulating} onSimulate={simulateAdvance} />
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        ) : preview ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info" sx={{ fontSize: 13 }}>
              <Trans t={t} i18nKey="refund.intro" values={{ chain: preview.chain }} components={{ b: <b /> }} />
            </Alert>

            <Stack spacing={0.5}>
              <Row label={t("refund.assetChain")} value={`${preview.asset} · ${preview.chain}`} />
              <Row
                label={t("refund.paidByCustomer")}
                value={`${preview.original_crypto_amount} ${preview.asset}`}
              />
              {!preview.needs_address && (
                <Row
                  label={t("refund.customerRefundAddress")}
                  value={maskAddress(preview.customer_refund_address)}
                  mono
                />
              )}
              <Row
                label={
                  preview.gas_coverage === "in_asset"
                    ? t("refund.networkFeeInAsset")
                    : t("refund.networkFeeFronted")
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
                    ? t("refund.addressInvalid", { asset: preview.asset, chain: preview.chain })
                    : t("refund.addressMissing", { asset: preview.asset, chain: preview.chain })}
                </Alert>
                <TextField
                  label={t("refund.addressLabel", { asset: preview.asset })}
                  value={addrInput}
                  onChange={(e) => setAddrInput(e.target.value)}
                  placeholder={t("refund.addressPlaceholder", { chain: preview.chain })}
                  inputProps={{ "data-testid": "refund-address-input", maxLength: 255 }}
                  error={!!addrInput.trim() && !isValidAddressFor(preview.chain, addrInput)}
                  helperText={
                    !!addrInput.trim() && !isValidAddressFor(preview.chain, addrInput)
                      ? t("refund.addressNotValid", { chain: preview.chain })
                      : t("refund.addressMustBe", { chain: preview.chain })
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
                  {t("refund.presetFull")}
                </Button>
                <Button
                  size="small"
                  variant={amountPreset === "half" ? "contained" : "outlined"}
                  onClick={() => {
                    setAmountPreset("half");
                    setAmount(String(toNumber((preview.max_refundable / 2), 8, "down")));
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
                  {t("refund.presetCustom")}
                </Button>
              </Stack>
              <TextField
                label={t("refund.amountLabel", { asset: preview.asset })}
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
                helperText={t("refund.amountHelper", { max: preview.max_refundable, asset: preview.asset })}
                fullWidth
              />
            </Box>
            <TextField
              label={t("refund.reasonLabel")}
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
                  <Trans
                    t={t}
                    i18nKey="refund.confirmLabel"
                    values={{
                      address: preview.needs_address
                        ? (addrInput.trim() ? maskAddress(addrInput.trim()) : t("refund.theAddressAbove"))
                        : maskAddress(preview.customer_refund_address),
                      chain: preview.chain,
                    }}
                    components={{ addr: <b style={{ wordBreak: "break-all" }} />, b: <b /> }}
                  />
                </Typography>
              }
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting} data-testid="crypto-refund-close-btn">
          {t("close", { defaultValue: "Close" })}
        </Button>
        {invoice && !created && invoice.status === "awaiting_deposit" && (
          <Button
            color="error"
            onClick={() => cancelRefund(invoice.refund_id)}
            disabled={submitting}
            data-testid="crypto-refund-cancel-btn"
          >
            {t("refund.cancelRefund")}
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
            {submitting ? t("refund.creating") : t("refund.create")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CryptoRefundModal;
