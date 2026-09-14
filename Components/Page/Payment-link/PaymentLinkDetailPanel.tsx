import React, { useRef, useState } from "react";
import { Box, Drawer, IconButton, Skeleton, Typography, useTheme } from "@mui/material";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import CoinChips from "@/Components/UI/CoinChips";
import LinkCoinsBadge from "./LinkCoinsBadge";
import CopyInline from "@/Components/UX/CopyInline";
import CustomButton from "@/Components/UI/Buttons";
import StatusChip from "@/Components/UI/StatusChip";
import { StatusDot } from "@/Components/UI/StatusDot";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import { downloadQrPng } from "@/helpers/downloadQrPng";
import { formatDisplayDateTime } from "@/helpers/displayDate";
import { extractPayRef, toShortPayLink } from "@/helpers/payLinkUrl";
import { formatWithSeparators } from "@/utils/currencyFormat";
import useIsMobile from "@/hooks/useIsMobile";
import type { PaymentLinkData } from "@/utils/types/paymentLink";
import EmbedSnippet from "./EmbedSnippet";
import { isLinkEditable, isLinkPaid, linkStatusLabelKey, linkStatusTone } from "./linkStatus";
import { useLinkPayments } from "./useLinkPayments";

interface Props {
  open: boolean;
  link: PaymentLinkData | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRefund?: (id: string) => void;
  refundStatus?: string | null;
}

/** Parse the API's "DD/MM/YYYY HH:MM:SS" (or ISO) into a display string. */
const displayDate = (raw: string): string => {
  if (!raw) return "—";
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  const d = m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}Z`) : new Date(raw);
  return isNaN(d.getTime()) ? raw : formatDisplayDateTime(d);
};

/**
 * PaymentLinkDetailPanel — plan 2.2. Right-side drawer (full-screen sheet on
 * phone) with share tools (copy / QR / share / open / embed), stats and the
 * link's recent payments. Replaces the old view dialog + the paid→/transactions
 * jump on the list; edit / delete / refund stay available in the footer.
 */
const PaymentLinkDetailPanel: React.FC<Props> = ({ open, link, onClose, onEdit, onDelete, onRefund, refundStatus }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useIsMobile("sm");
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation("paymentLinks");
  const { selectedCompanyId } = useCompanyStore();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const linkId = link ? String(link.id) : null;
  const { detail, payments, collectedUsd, lastPaymentAt, loading } = useLinkPayments(linkId, selectedCompanyId, open && !!link);

  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const secondary = isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(10,10,15,0.02)";
  const eyebrowSx = { fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: muted };
  const iconBtnSx = { border: `1px solid ${border}`, borderRadius: "12px", minWidth: 44, minHeight: 44, color: ink, "&:hover": { backgroundColor: theme.palette.action.hover } };

  const url = link ? toShortPayLink(link.paymentUrl) : "";
  const title = link?.description || t("paymentLinkFallback", { defaultValue: "Payment Link" });
  const isDonation = link?.linkType === "donation";
  const editable = isLinkEditable(link?.status);
  const paid = isLinkPaid(link?.status);

  const toast = (message: string, severity: "success" | "error") =>
    dispatch({ type: "TOAST_SHOW", payload: { message, severity } });
  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast(t("copyFailed", { ns: "common", defaultValue: "Copy failed" }), "error");
    }
  };
  const handleShare = async () => {
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title, text: `${title} — ${link?.usdValue ?? ""}`.trim(), url });
        return;
      } catch {
        /* cancelled → copy instead */
      }
    }
    handleCopy();
  };
  const handleDownloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    downloadQrPng(canvas, { caption: url.replace(/^https?:\/\//, ""), filename: `dynopay-${extractPayRef(url) || linkId || "link"}.png` });
  };
  const viewInTransactions = () => {
    onClose();
    const ref = detail?.transaction_reference;
    router.push(ref ? { pathname: "/transactions", query: { search: ref } } : { pathname: "/transactions", query: { source: isDonation ? "contribution" : "payment_link" } });
  };

  const collectedLabel = isDonation && link?.donation
    ? `${formatWithSeparators(Number(link.donation.raisedAmount || 0), undefined, 2)} USD`
    : `$${formatWithSeparators(collectedUsd, undefined, 2)} USD`;

  const stats = [
    { key: "received", label: t("detail.statPayments", { defaultValue: "Payments received" }), value: String(Math.max(Number(link?.timesUsed ?? 0), payments.length)), mono: true },
    { key: "collected", label: t("detail.statCollected", { defaultValue: "Collected" }), value: loading && !payments.length ? null : collectedLabel, mono: true },
    { key: "last", label: t("detail.statLast", { defaultValue: "Last payment" }), value: loading && !payments.length ? null : lastPaymentAt ? displayDate(lastPaymentAt) : "—", mono: false },
  ];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      keepMounted={false}
      transitionDuration={{ enter: 260, exit: 200 }}
      PaperProps={{
        "data-testid": "paylink-detail-panel",
        sx: {
          width: { xs: "100%", sm: 480, md: 520 },
          maxWidth: "100%",
          bgcolor: theme.palette.background.paper,
          borderLeft: `1px solid ${border}`,
          backgroundImage: "none",
          display: "flex",
          flexDirection: "column",
        },
      } as any}
      BackdropProps={{ sx: { backgroundColor: isDark ? "rgba(0,0,0,0.55)" : "rgba(10,10,15,0.35)", backdropFilter: "blur(2px)" } }}
    >
      {link && (
        <>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, p: theme.spacing(2.25, 2.5, 2, 3), borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={eyebrowSx}>{isDonation ? t("detail.eyebrowCampaign", { defaultValue: "Donation campaign" }) : t("detail.eyebrow", { defaultValue: "Payment link" })}</Box>
              <Typography component="h2" data-testid="paylink-detail-title" sx={{ mt: 0.5, fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: ink, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {title}
              </Typography>
            </Box>
            <Box sx={{ pt: 0.5 }} data-testid="paylink-detail-status" data-status={link.status}>
              <StatusDot tone={linkStatusTone(link.status)}>{t(linkStatusLabelKey(link.status))}</StatusDot>
            </Box>
            <IconButton onClick={onClose} data-testid="paylink-detail-close" aria-label={t("detail.close", { defaultValue: "Close" })} size="small" sx={{ color: secondary, mt: -0.25, "&:hover": { color: ink, backgroundColor: theme.palette.action.hover } }}>
              <Icon name="x" size={18} />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", p: isMobile ? 2 : 3, display: "grid", gap: 3, alignContent: "start" }}>
            <Box>
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                <Box data-testid="paylink-detail-amount" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: ink, lineHeight: 1.1 }}>
                  {link.usdValue}
                </Box>
                <LinkCoinsBadge value={link.cryptoValue} max={4} />
              </Box>
              {isDonation && link.donation?.goalAmount ? (
                <Box sx={{ mt: 1.5 }} data-testid="paylink-detail-donation">
                  <Box sx={{ height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)" }}>
                    <Box sx={{ width: `${Math.min(100, link.donation.progressPercent || 0)}%`, height: "100%", borderRadius: 999, backgroundColor: "#10B981" }} />
                  </Box>
                  <Box sx={{ mt: 0.75, display: "flex", justifyContent: "space-between", fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
                    <span>{t("detail.goal", { goal: formatWithSeparators(Number(link.donation.goalAmount), undefined, 2), defaultValue: "Goal {{goal}}" })}</span>
                    <span>{t("detail.supporters", { count: link.donation.supportersCount, defaultValue: "{{count}} supporters" })}</span>
                  </Box>
                </Box>
              ) : null}
              <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
                {[
                  { k: "created", label: t("created", { defaultValue: "Created" }), value: displayDate(link.createdAt) },
                  { k: "expires", label: t("expires", { defaultValue: "Expires" }), value: link.expiresAt ? displayDate(link.expiresAt) : t("detail.never", { defaultValue: "Never" }) },
                ].map((m) => (
                  <Box key={m.k} data-testid={`paylink-detail-${m.k}`}>
                    <Box sx={eyebrowSx}>{m.label}</Box>
                    <Box sx={{ mt: 0.5, fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: ink }}>{m.value}</Box>
                  </Box>
                ))}
                <Box data-testid="paylink-detail-id">
                  <Box sx={eyebrowSx}>{t("linkId", { defaultValue: "Link ID" })}</Box>
                  <Box sx={{ mt: 0.25, display: "inline-flex", alignItems: "center", gap: 0.25 }}>
                    <Box sx={{ fontFamily: MONO, fontSize: 13.5, color: ink }}>{link.id}</Box>
                    <CopyInline value={String(link.id)} size={14} testId="paylink-detail-copy-id" copyLabel={t("detail.copyId", { defaultValue: "Copy ID" })} />
                  </Box>
                </Box>
                <Box data-testid="paylink-detail-ref">
                  <Box sx={eyebrowSx}>{t("detail.reference", { defaultValue: "Reference" })}</Box>
                  <Box sx={{ mt: 0.25, display: "flex", alignItems: "center", gap: 0.25, minWidth: 0 }}>
                    <Box sx={{ fontFamily: MONO, fontSize: 13.5, color: detail?.transaction_reference ? ink : muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {detail?.transaction_reference || extractPayRef(url) || "—"}
                    </Box>
                    {detail?.transaction_reference && (
                      <CopyInline value={detail.transaction_reference} size={14} testId="paylink-detail-copy-ref" copyLabel={t("detail.copyReference", { defaultValue: "Copy reference" })} />
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box data-testid="paylink-detail-share">
              <Box sx={eyebrowSx}>{t("detail.shareTitle", { defaultValue: "Share" })}</Box>
              <Box sx={{ mt: 1.25, display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "132px minmax(0, 1fr)" }, gap: 2, alignItems: "start" }}>
                <Box sx={{ display: "flex", justifyContent: { xs: "center", sm: "flex-start" } }}>
                  <Box ref={qrRef} data-testid="paylink-detail-qr" sx={{ p: 1, borderRadius: "14px", backgroundColor: "#FFFFFF", border: `1px solid ${border}`, lineHeight: 0 }}>
                    <QRCodeCanvas value={url} size={112} />
                  </Box>
                </Box>
                <Box sx={{ minWidth: 0, display: "grid", gap: 1.25 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, overflow: "hidden", border: `1px solid ${border}`, borderRadius: "12px", backgroundColor: surface, pl: 1.5, pr: 0.5, py: 0.5 }}>
                    <Box data-testid="paylink-detail-url" sx={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 12.5, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {url}
                    </Box>
                    <CopyInline value={url} size={16} testId="paylink-detail-copy-inline" copyLabel={t("copyLinkTooltip", { defaultValue: "Copy link" })} sx={{ minWidth: 38, minHeight: 38 }} />
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
                    <Box sx={{ flex: "1 1 120px", minWidth: 0, "& button": { width: "100%", minHeight: 44 } }}>
                      <CustomButton label={copied ? t("detail.copied", { defaultValue: "Copied ✓" }) : t("copyLinkTooltip", { defaultValue: "Copy link" })} variant="primary" onClick={handleCopy} data-testid="paylink-detail-copy" data-copied={copied ? "true" : "false"} />
                    </Box>
                    <IconButton onClick={handleShare} data-testid="paylink-detail-share-native" aria-label={t("detail.share", { defaultValue: "Share" })} sx={iconBtnSx}><Icon name="share-2" size={17} /></IconButton>
                    <IconButton onClick={() => window.open(url, "_blank", "noopener")} data-testid="paylink-detail-open" aria-label={t("detail.open", { defaultValue: "Open link" })} sx={iconBtnSx}><Icon name="external-link" size={17} /></IconButton>
                    <IconButton onClick={handleDownloadQr} data-testid="paylink-detail-download-qr" aria-label={t("detail.downloadQr", { defaultValue: "Download QR" })} sx={iconBtnSx}><Icon name="download" size={17} /></IconButton>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ mt: 1.5 }}>
                <EmbedSnippet url={url} />
              </Box>
            </Box>

            {/* Stats: 3 tiles side-by-side from sm up; label/value rows on phones so nothing truncates. */}
            <Box data-testid="paylink-detail-stats" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
              {stats.map((s) => (
                <Box key={s.key} data-testid={`paylink-stat-${s.key}`} sx={{ p: { xs: "10px 14px", sm: 1.5 }, borderRadius: "14px", border: `1px solid ${border}`, minWidth: 0, display: "flex", flexDirection: { xs: "row", sm: "column" }, alignItems: { xs: "center", sm: "stretch" }, justifyContent: "space-between", gap: { xs: 1.5, sm: 0.5 } }}>
                  <Box sx={{ ...eyebrowSx, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</Box>
                  {s.value == null ? (
                    <Skeleton variant="text" width={64} height={22} />
                  ) : (
                    <Box sx={{ fontFamily: s.mono ? MONO : "var(--font-sans)", fontVariantNumeric: "tabular-nums", fontSize: s.mono ? { xs: 14.5, sm: 16 } : 12.5, fontWeight: s.mono ? 700 : 500, color: ink, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: { xs: "right", sm: "left" } }}>
                      {s.value}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>

            <Box data-testid="paylink-detail-payments">
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Box sx={eyebrowSx}>{t("detail.recentPayments", { defaultValue: "Recent payments" })}</Box>
                <Box component="button" type="button" data-testid="paylink-detail-view-transactions" onClick={viewInTransactions} sx={{ border: 0, background: "transparent", cursor: "pointer", p: 0.5, borderRadius: 6, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  {t("detail.viewInTransactions", { defaultValue: "View in transactions" })}
                  <Icon name="arrow-right" size={14} />
                </Box>
              </Box>
              <Box sx={{ mt: 1.25, border: `1px solid ${border}`, borderRadius: "14px", overflow: "hidden" }}>
                {loading && !payments.length ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Box key={i} sx={{ px: 1.75, py: 1.5, borderTop: i ? `1px solid ${border}` : 0 }}>
                      <Skeleton variant="text" width="70%" height={18} />
                    </Box>
                  ))
                ) : payments.length === 0 ? (
                  <Box data-testid="paylink-detail-no-payments" sx={{ px: 1.75, py: 2.5, textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 13, color: muted, lineHeight: 1.5 }}>
                    {paid ? t("detail.noPaymentsMatched", { defaultValue: "Payments for this link are in your transactions." }) : t("detail.noPaymentsYet", { defaultValue: "No payments yet — share the link to get paid." })}
                  </Box>
                ) : (
                  payments.slice(0, 5).map((p, i) => (
                    <Box key={p.id} data-testid="paylink-payment-row" sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.75, py: 1.25, borderTop: i ? `1px solid ${border}` : 0 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 600, color: ink }}>
                          {formatWithSeparators(p.cryptoAmount, undefined, 8).replace(/\.?0+$/, "")} {p.cryptoCurrency}
                          {p.usdValue != null && <Box component="span" sx={{ color: muted, fontWeight: 500 }}> · ${formatWithSeparators(p.usdValue, undefined, 2)}</Box>}
                        </Box>
                        <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 12, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {displayDate(p.createdAt)}{p.customer ? ` · ${p.customer}` : ""}
                        </Box>
                      </Box>
                      <StatusChip status={p.status} variant="inline" short />
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{ flexShrink: 0, p: isMobile ? 2 : 2.5, borderTop: `1px solid ${border}`, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            {editable && (
              <Box sx={{ flex: "1 1 140px", "& button": { width: "100%", minHeight: 44 } }}>
                <CustomButton label={t("editLinkTooltip", { defaultValue: "Edit link" })} variant="secondary" onClick={() => onEdit(String(link.id))} data-testid="paylink-detail-edit" />
              </Box>
            )}
            <Box sx={{ flex: "1 1 140px", "& button": { width: "100%", minHeight: 44 } }}>
              <CustomButton
                label={t("duplicateLink", { defaultValue: "Duplicate" })}
                variant="secondary"
                onClick={() => router.push(`/create-pay-link?duplicate=${encodeURIComponent(String(link.id))}`)}
                data-testid="paylink-detail-duplicate"
              />
            </Box>
            {paid && (
              <Box sx={{ flex: "1 1 140px", "& button": { width: "100%", minHeight: 44 } }}>
                <CustomButton label={t("viewTransactionsTooltip", { defaultValue: "View transactions" })} variant="secondary" onClick={viewInTransactions} data-testid="paylink-detail-view-transactions-footer" />
              </Box>
            )}
            {onRefund && paid && (
              <Box sx={{ flex: "1 1 140px", "& button": { width: "100%", minHeight: 44 } }}>
                <CustomButton label={refundStatus ? t("detail.refundStatus", { status: refundStatus, defaultValue: "Refund: {{status}}" }) : t("cryptoRefundTooltip", { defaultValue: "Crypto refund" })} variant="secondary" disabled={!!refundStatus} onClick={() => onRefund(String(link.id))} data-testid="paylink-detail-refund" />
              </Box>
            )}
            {editable && (
              <Box component="button" type="button" data-testid="paylink-detail-delete" onClick={() => onDelete(String(link.id))} sx={{ ml: "auto", minHeight: 44, px: 1.5, border: 0, borderRadius: 999, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: isDark ? CB_TOKENS.semantic.negative.dark : CB_TOKENS.semantic.negative.light, display: "inline-flex", alignItems: "center", gap: 0.75, "&:hover": { backgroundColor: isDark ? "rgba(251,113,133,0.10)" : "rgba(244,63,94,0.08)" } }}>
                <Icon name="trash-2" size={16} />
                {t("delete", { defaultValue: "Delete" })}
              </Box>
            )}
          </Box>
        </>
      )}
    </Drawer>
  );
};

export default PaymentLinkDetailPanel;
