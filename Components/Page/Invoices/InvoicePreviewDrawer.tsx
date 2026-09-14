import {
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Skeleton,
  Typography,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { CloseRounded, DownloadRounded, OpenInNewRounded } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getInvoicePdf } from "@/helpers/invoicePdfCache";
import { StatusPill } from "@/Components/UI/_shared";
import { BRAND_ACCENT } from "@/constants/theme";
import { formatDateI18n } from "@/utils/formatDate";

/**
 * InvoicePreviewDrawer — live PDF preview slide-out for the invoices list.
 *
 * Shipped as part of the 2026-08-05 design audit Phase 3 (invoices polish).
 * Previously the only way to see an invoice was to click the download-PDF
 * icon, which spawned a browser download — no preview, no way to check
 * without leaving the app. This drawer replaces that flow:
 *
 *   - Row click opens the drawer with the invoice metadata + a live iframe
 *     preview of the invoice PDF (blob-served, so it works offline of the
 *     browser's viewer defaults).
 *   - Header shows a StatusPill (settled tone; every invoice in Dynopay is
 *     post-payment so this is always green — the pill is there so the
 *     tone tokens are consistent with the rest of the app once we start
 *     issuing draft / overdue / void invoices in a future release).
 *   - Actions: Download (calls the same `/invoices/{id}/pdf` endpoint,
 *     forces a download), Open in new tab (uses the blob URL directly),
 *     Close (X + backdrop click + Esc).
 *
 * Preview blob URLs are revoked in the effect cleanup so we don't leak
 * memory on repeated open/close cycles.
 */

export interface InvoicePreviewInvoice {
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  total_usd: number;
  vat_amount: number;
  crypto_currency: string;
  description?: string;
  /** Total already formatted in the merchant's display currency (falls back to USD). */
  total_label?: string;
}

interface Props {
  open: boolean;
  invoice: InvoicePreviewInvoice | null;
  onClose: () => void;
}

const formatDate = (isoStr: string) => {
  if (!isoStr) return "";
  return formatDateI18n(isoStr, { year: "numeric", month: "short", day: "numeric" }) || isoStr;
};

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

export default function InvoicePreviewDrawer({ open, invoice, onClose }: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  // True once the <iframe> has finished rendering the PDF — used to keep a
  // "Rendering preview…" overlay up during the (often 300-800ms) gap between
  // the blob being ready and the browser's PDF viewer actually painting it.
  const [iframeReady, setIframeReady] = useState(false);

  // Fetch the PDF blob whenever the drawer opens on a different invoice
  useEffect(() => {
    if (!open || !invoice) {
      setBlobUrl(null);
      setErrored(false);
      setIframeReady(false);
      return;
    }
    let mounted = true;
    let objectUrl: string | null = null;
    const load = async () => {
      setLoading(true);
      setErrored(false);
      setIframeReady(false);
      try {
        const blob = await getInvoicePdf(invoice.invoice_id);
        objectUrl = window.URL.createObjectURL(blob);
        if (mounted) setBlobUrl(objectUrl);
      } catch (err) {
        console.error("[InvoicePreviewDrawer] blob fetch failed:", err);
        if (mounted) setErrored(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [open, invoice?.invoice_id]);

  // Esc closes the drawer. MUI's Modal handles Esc while focus is inside the
  // trap, but a document-level listener makes it reliable in every state
  // (e.g. immediately after opening, or after interacting with the actions).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleDownload = () => {
    if (!invoice || !blobUrl) return;
    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", `invoice-${invoice.invoice_number || invoice.invoice_id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleOpenInNewTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        "data-testid": "invoice-preview-drawer",
        sx: {
          width: { xs: "100%", sm: 560, md: 640 },
          maxWidth: "100%",
          bgcolor: theme.palette.background.paper,
          borderLeft: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.08)"}`,
          backgroundImage: "none",
          display: "flex",
          flexDirection: "column",
        },
      }}
      BackdropProps={{
        sx: {
          // §5.7: darker slate backdrop so the white PDF "paper" pops.
          backgroundColor: dark ? "rgba(2,6,23,0.72)" : "rgba(15,23,42,0.62)",
          backdropFilter: "blur(3px)",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          padding: theme.spacing(2.5, 3, 2, 3),
          borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.06)"}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
              <Typography
                sx={{
                  fontFamily: "var(--font-tech), monospace",
                  fontSize: 11,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: theme.palette.text.secondary,
                }}
              >
                {t("invoices.preview.eyebrow")}
              </Typography>
              <StatusPill tone="settled">{t("invoices.preview.paid")}</StatusPill>
            </Box>
            <Typography
              data-testid="invoice-preview-number"
              sx={{
                fontFamily: "var(--font-hero), var(--font-body)",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: theme.palette.text.primary,
                lineHeight: 1.2,
              }}
            >
              {invoice?.invoice_number || "…"}
            </Typography>
            {invoice && (
              <Typography
                sx={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: theme.palette.text.secondary,
                  mt: 0.4,
                }}
              >
                {invoice.customer_name} · {formatDate(invoice.invoice_date)} · {invoice.total_label || formatUSD(invoice.total_usd)}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small" aria-label={t("invoices.preview.close")} data-testid="invoice-preview-close" sx={{ color: theme.palette.text.secondary }}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </Box>

        {/* Actions */}
        <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
          <Box
            component="button"
            onClick={handleDownload}
            disabled={!blobUrl}
            data-testid="invoice-preview-download"
            sx={{
              display: "inline-flex", alignItems: "center", gap: 0.75,
              padding: "8px 14px",
              borderRadius: "10px",
              backgroundColor: dark ? "#818CF8" : BRAND_ACCENT,
              color: "#FFFFFF",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: blobUrl ? "pointer" : "not-allowed",
              opacity: blobUrl ? 1 : 0.55,
              "&:hover": { backgroundColor: dark ? "#7075E8" : "#4338CA" },
            }}
          >
            <DownloadRounded fontSize="small" />
            {t("invoices.downloadPdf")}
          </Box>
          <Box
            component="button"
            onClick={handleOpenInNewTab}
            disabled={!blobUrl}
            data-testid="invoice-preview-open"
            sx={{
              display: "inline-flex", alignItems: "center", gap: 0.75,
              padding: "8px 14px",
              borderRadius: "10px",
              backgroundColor: "transparent",
              color: theme.palette.text.primary,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,15,0.14)"}`,
              cursor: blobUrl ? "pointer" : "not-allowed",
              opacity: blobUrl ? 1 : 0.55,
              "&:hover": { backgroundColor: dark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)" },
            }}
          >
            <OpenInNewRounded fontSize="small" />
            {t("invoices.preview.openInNewTab")}
          </Box>
        </Box>
      </Box>

      {/* PDF preview */}
      <Box sx={{ flex: 1, backgroundColor: dark ? "#0B0F19" : "#F4F4F7", position: "relative", overflow: "hidden" }}>
        {loading && (
          <Box sx={{ p: 3 }}>
            <Skeleton variant="rectangular" width="100%" height={80} sx={{ borderRadius: 1, mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={240} sx={{ borderRadius: 1 }} />
          </Box>
        )}
        {errored && (
          <Box data-testid="invoice-preview-error" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, p: 4, textAlign: "center" }}>
            <Icon icon="mdi:file-alert-outline" width={48} color={theme.palette.text.secondary} />
            <Typography sx={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: theme.palette.text.primary }}>
              {t("invoices.preview.errorTitle")}
            </Typography>
            <Typography sx={{ fontFamily: "var(--font-body)", fontSize: 12, color: theme.palette.text.secondary }}>
              {t("invoices.preview.errorBody")}
            </Typography>
          </Box>
        )}
        {!loading && !errored && blobUrl && (
          <>
            {!iframeReady && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1.25,
                  zIndex: 1,
                  backgroundColor: dark ? "#0B0F19" : "#F4F4F7",
                }}
              >
                <CircularProgress size={26} sx={{ color: dark ? "#818CF8" : BRAND_ACCENT }} />
                <Typography sx={{ fontFamily: "var(--font-body)", fontSize: 12, color: theme.palette.text.secondary }}>
                  {t("invoices.preview.rendering")}
                </Typography>
              </Box>
            )}
            <Box
              component="iframe"
              title={`${t("invoices.preview.eyebrow")} ${invoice?.invoice_number || ""}`}
              src={blobUrl}
              onLoad={() => setIframeReady(true)}
              sx={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
                position: "relative",
                zIndex: 0,
              }}
            />
          </>
        )}
      </Box>
    </Drawer>
  );
}
