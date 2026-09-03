/**
 * QuickCreateLinkPanel — Move 2 of the usability restructuring.
 *
 * The DEFAULT way to create a payment link: a right-side panel that slides
 * over the current page (full-screen sheet <768px) so the merchant never
 * loses their place. Includes a live preview while typing and an in-panel
 * success state (copy + QR + share) — no navigation, no pop-up.
 *
 * The full-page creator (/create-pay-link) stays reachable via the
 * "All options" link for complex cases (taxes, expiry, redirects, donations).
 */
import React, { useMemo, useRef, useState } from "react";
import {
  Box,
  Drawer,
  IconButton,
  MenuItem,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import { QRCodeCanvas } from "qrcode.react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import axiosBaseApi from "@/axiosConfig";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { PaymentLinkAction, PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import CustomButton from "@/Components/UI/Buttons";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import { toShortPayLink, extractPayRef } from "@/helpers/payLinkUrl";
import { downloadQrPng } from "@/helpers/downloadQrPng";
import { MONO } from "@/styles/uiKit";
import { toFixedStr } from "@/utils/money";

const FIAT_OPTIONS = ["USD", "EUR", "GBP"] as const;

const fmtAmount = (value: string, currency: string) => {
  const n = parseFloat(value);
  if (!isFinite(n) || n <= 0) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${toFixedStr(n, 2)}`;
  }
};

type CreatedLink = { url: string; amount: string; currency: string; description: string };

const QuickCreateLinkPanel = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const router = useRouter();
  const { t } = useTranslation("paymentLinks");
  const { selectedCompanyId } = useCompanyStore();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; description?: string; email?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const preview = useMemo(() => fmtAmount(amount, currency), [amount, currency]);

  const border = isDark ? "rgba(255,255,255,0.10)" : "#E9ECF2";
  const surface = isDark ? "rgba(255,255,255,0.04)" : "#F8F9FC";

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setEmail("");
    setErrors({});
    setApiError("");
    setCreated(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    onClose();
    // Reset after the slide-out animation so the success state doesn't flash empty.
    setTimeout(resetForm, 250);
  };

  const validate = () => {
    const next: typeof errors = {};
    const n = parseFloat(amount);
    if (!amount || !isFinite(n) || n <= 0) {
      next.amount = t("quickCreate.errorAmount", { defaultValue: "Enter an amount greater than 0" });
    }
    if (!description.trim()) {
      next.description = t("quickCreate.errorDescription", { defaultValue: "A short description is required" });
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email = t("quickCreate.errorEmail", { defaultValue: "Enter a valid email or leave empty" });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    setApiError("");
    try {
      const payload: Record<string, unknown> = {
        amount: parseFloat(amount),
        currency,
        description: description.trim(),
        name: "",
        expire: "No",
        fee_payer: "company",
        accepted_currencies: [],
        redirect_url: "",
        webhook_url: "",
        callback_url: "",
        apply_tax: false,
        tax_inclusive: false,
        company_id: selectedCompanyId,
      };
      if (email.trim()) payload.customer_email = email.trim();
      const res = await axiosBaseApi.post("/pay/createPaymentLink", payload);
      const data = res?.data?.data;
      if (data?.payment_link) {
        setCreated({ url: toShortPayLink(data.payment_link), amount, currency, description: description.trim() });
        // Refresh the pay-links list behind the panel (no-op elsewhere).
        dispatch(PaymentLinkAction(PAYLINK_FETCH, { company_id: selectedCompanyId }));
      } else {
        setApiError(res?.data?.message || t("quickCreate.errorGeneric", { defaultValue: "Could not create the link — please try again." }));
      }
    } catch (e: any) {
      setApiError(
        e?.response?.data?.message ||
          t("quickCreate.errorGeneric", { defaultValue: "Could not create the link — please try again." }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    const ok = await copyToClipboard(created.url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
    dispatch({
      type: "TOAST_SHOW",
      payload: {
        message: ok
          ? t("quickCreate.copied", { defaultValue: "Payment link copied!" })
          : t("quickCreate.copyFailed", { defaultValue: "Copy failed — select and copy manually." }),
        severity: ok ? "success" : "error",
      },
    });
  };

  const handleShare = async () => {
    if (!created) return;
    const text = `${created.description} — ${fmtAmount(created.amount, created.currency) || ""}`.trim();
    if (typeof navigator !== "undefined" && typeof (navigator as any).share === "function") {
      try {
        await (navigator as any).share({ title: text, text, url: created.url });
        return;
      } catch {
        /* cancelled — fall through to copy */
      }
    }
    handleCopy();
  };

  const handleDownloadQr = () => {
    if (!created) return;
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    const code = extractPayRef(created.url);
    downloadQrPng(canvas, {
      caption: created.url.replace(/^https?:\/\//, ""),
      filename: `dynopay-${code || "payment-qr"}.png`,
    });
  };

  const goAllOptions = () => {
    handleClose();
    router.push("/create-pay-link");
  };

  const labelSx = {
    fontFamily: "var(--font-sans)",
    fontSize: 12.5,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    mb: 0.5,
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 480 },
          maxWidth: "100vw",
          backgroundColor: theme.palette.background.paper,
          backgroundImage: "none",
        },
      }}
      data-testid="quick-create-panel"
    >
      {/* ── Header ── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 1.75,
          borderBottom: `1px solid ${border}`,
        }}
      >
        <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16 }}>
          {created
            ? t("quickCreate.successTitle", { defaultValue: "Link ready to share" })
            : t("quickCreate.title", { defaultValue: "Create payment link" })}
        </Typography>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label={t("quickCreate.close", { defaultValue: "Close" })}
          data-testid="quick-create-close"
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* ── Body ── */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2.5 }}>
        {!created ? (
          <>
            {/* Live preview — updates as the merchant types. */}
            <Box
              data-testid="quick-create-preview"
              sx={{
                border: `1px solid ${border}`,
                borderRadius: "14px",
                backgroundColor: surface,
                px: 2,
                py: 1.75,
                mb: 2.5,
              }}
            >
              <Typography sx={{ fontFamily: "var(--font-tech), monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
                {t("quickCreate.previewLabel", { defaultValue: "Buyer will see" })}
              </Typography>
              <Typography noWrap sx={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, mt: 0.75, color: description.trim() ? theme.palette.text.primary : theme.palette.text.secondary }}>
                {description.trim() || t("quickCreate.previewPlaceholder", { defaultValue: "What is this payment for?" })}
              </Typography>
              <Typography sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 700, mt: 0.5, color: preview ? theme.palette.text.primary : theme.palette.text.secondary }}>
                {preview || "—"}
              </Typography>
            </Box>

            <Typography sx={labelSx}>{t("quickCreate.amountLabel", { defaultValue: "Amount" })}</Typography>
            <Box sx={{ display: "flex", gap: 1.25, mb: 2 }}>
              <TextField
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
                error={!!errors.amount}
                helperText={errors.amount || ""}
                fullWidth
                size="small"
                inputProps={{ "data-testid": "quick-create-amount", style: { fontFamily: "var(--font-mono, monospace)" } }}
              />
              <TextField
                select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                size="small"
                sx={{ width: 110 }}
                inputProps={{ "data-testid": "quick-create-currency" }}
              >
                {FIAT_OPTIONS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Typography sx={labelSx}>{t("quickCreate.descriptionLabel", { defaultValue: "Description" })}</Typography>
            <TextField
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("quickCreate.descriptionPlaceholder", { defaultValue: "e.g. Logo design — final payment" })}
              error={!!errors.description}
              helperText={errors.description || ""}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              inputProps={{ "data-testid": "quick-create-description", maxLength: 120 }}
            />

            <Typography sx={labelSx}>
              {t("quickCreate.emailLabel", { defaultValue: "Customer email (optional)" })}
            </Typography>
            <TextField
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@email.com"
              error={!!errors.email}
              helperText={errors.email || ""}
              fullWidth
              size="small"
              sx={{ mb: 2.5 }}
              inputProps={{ "data-testid": "quick-create-email", inputMode: "email" }}
            />

            {apiError && (
              <Typography data-testid="quick-create-error" sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#E11D48", mb: 1.5 }}>
                {apiError}
              </Typography>
            )}

            <Box data-testid="quick-create-submit" sx={{ "& button": { width: "100%", minHeight: 46 } }}>
              <CustomButton
                label={
                  submitting
                    ? t("quickCreate.creating", { defaultValue: "Creating…" })
                    : t("quickCreate.submit", { defaultValue: "Create link" })
                }
                variant="primary"
                onClick={handleSubmit}
                disabled={submitting}
              />
            </Box>

            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: theme.palette.text.secondary, mt: 2, textAlign: "center" }}>
              {t("quickCreate.allOptionsHint", { defaultValue: "Need taxes, expiry, redirects or a donation?" })}{" "}
              <Box
                component="button"
                type="button"
                onClick={goAllOptions}
                data-testid="quick-create-all-options"
                sx={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: isDark ? "#A5B4FC" : "#4F46E5",
                  textDecoration: "underline",
                }}
              >
                {t("quickCreate.allOptions", { defaultValue: "All options" })}
              </Box>
            </Typography>
          </>
        ) : (
          /* ── Success state — stays INSIDE the panel (no pop-up, no redirect) ── */
          <Box data-testid="quick-create-success" sx={{ textAlign: "center" }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 44, color: "#059669", mb: 1 }} />
            <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 17 }}>
              {fmtAmount(created.amount, created.currency)}
            </Typography>
            <Typography noWrap sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: theme.palette.text.secondary, mb: 2.5 }}>
              {created.description}
            </Typography>

            <Box sx={{ display: "flex", justifyContent: "center", mb: 2.5 }}>
              <Box ref={qrRef} sx={{ p: 1.5, borderRadius: "14px", backgroundColor: "#FFFFFF", border: `1px solid ${border}` }}>
                <QRCodeCanvas value={created.url} size={148} data-testid="quick-create-qr" />
              </Box>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                border: `1px solid ${border}`,
                borderRadius: "10px",
                backgroundColor: surface,
                px: 1.5,
                py: 1,
                mb: 2,
              }}
            >
              <Typography
                noWrap
                data-testid="quick-create-url"
                sx={{ flex: 1, textAlign: "left", fontFamily: MONO, fontSize: 12.5, color: theme.palette.text.primary }}
              >
                {created.url}
              </Typography>
              <IconButton onClick={handleCopy} size="small" data-testid="quick-create-copy" aria-label="Copy link" sx={{ minWidth: 40, minHeight: 40 }}>
                <ContentCopyRoundedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Box>

            <Box sx={{ display: "flex", gap: 1.25, mb: 2 }}>
              <Box sx={{ flex: 1, "& button": { width: "100%", minHeight: 44 } }}>
                <CustomButton
                  label={t("quickCreate.copyLink", { defaultValue: "Copy link" })}
                  variant="primary"
                  onClick={handleCopy}
                />
              </Box>
              <IconButton
                onClick={handleShare}
                data-testid="quick-create-share"
                aria-label={t("quickCreate.share", { defaultValue: "Share" })}
                sx={{ border: `1px solid ${border}`, borderRadius: "10px", minWidth: 44, minHeight: 44 }}
              >
                <IosShareRoundedIcon sx={{ fontSize: 19 }} />
              </IconButton>
              <IconButton
                onClick={() => window.open(created.url, "_blank", "noopener")}
                data-testid="quick-create-open"
                aria-label={t("quickCreate.openLink", { defaultValue: "Open link" })}
                sx={{ border: `1px solid ${border}`, borderRadius: "10px", minWidth: 44, minHeight: 44 }}
              >
                <OpenInNewRoundedIcon sx={{ fontSize: 19 }} />
              </IconButton>
              <IconButton
                onClick={handleDownloadQr}
                data-testid="quick-create-download-qr"
                aria-label={t("quickCreate.downloadQr", { defaultValue: "Download QR" })}
                sx={{ border: `1px solid ${border}`, borderRadius: "10px", minWidth: 44, minHeight: 44 }}
              >
                <FileDownloadRoundedIcon sx={{ fontSize: 19 }} />
              </IconButton>
            </Box>

            {copied && (
              <Typography
                data-testid="quick-create-copied-note"
                sx={{ fontSize: 12, fontWeight: 600, color: "#059669", mb: 1.5, mt: -0.5 }}
              >
                {t("quickCreate.copiedOpensCheckout", { defaultValue: "Link copied — opens your checkout" })}
              </Typography>
            )}

            <Box sx={{ display: "flex", gap: 1.25 }}>
              <Box sx={{ flex: 1, "& button": { width: "100%", minHeight: 44 } }}>
                <CustomButton
                  label={t("quickCreate.createAnother", { defaultValue: "Create another" })}
                  variant="secondary"
                  onClick={resetForm}
                />
              </Box>
              <Box sx={{ flex: 1, "& button": { width: "100%", minHeight: 44 } }}>
                <CustomButton
                  label={t("quickCreate.done", { defaultValue: "Done" })}
                  variant="secondary"
                  onClick={handleClose}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default QuickCreateLinkPanel;
