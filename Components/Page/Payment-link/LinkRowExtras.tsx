import React, { useState } from "react";
import { Box, Popover, Tooltip, Typography, useTheme } from "@mui/material";
import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { formatWithSeparators } from "@/utils/currencyFormat";
import { toShortPayLink } from "@/helpers/payLinkUrl";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import type { PaymentLinkData } from "@/utils/types/paymentLink";
import { RowActionButton } from "./styled";
import { isExpiringSoon } from "./linkStatus";

/** "Expiring soon" pill — live links closing within 48 h. */
export const ExpiringSoonBadge: React.FC<{ link: PaymentLinkData; testId: string }> = ({ link, testId }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("paymentLinks");
  if (!isExpiringSoon(link)) return null;
  const hrs = Math.max(1, Math.round((new Date(link.expiresAtIso as string).getTime() - Date.now()) / 3_600_000));
  const tone = isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light;
  return (
    <Tooltip arrow title={t("expiringSoonTip", { count: hrs, defaultValue: "Closes in about {{count}} h — extend it or share it now." })}>
      <Box
        component="span"
        data-testid={testId}
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.8, py: 0.2, borderRadius: 999, fontFamily: "var(--font-sans)", fontSize: 10.5, fontWeight: 700, color: tone, backgroundColor: isDark ? CB_TOKENS.semantic.warning.glowDark : CB_TOKENS.semantic.warning.glowLight, whiteSpace: "nowrap" }}
      >
        <Icon name="clock" size={11} />
        {t("expiringSoon", { defaultValue: "Expiring soon" })}
      </Box>
    </Tooltip>
  );
};

/** "3 paid · $120" for the last 30 days (settled only), with all-time count on hover. */
export const Last30Cell: React.FC<{ link: PaymentLinkData; compact?: boolean }> = ({ link, compact }) => {
  const theme = useTheme();
  const { t } = useTranslation("paymentLinks");
  const count = link.paid30dCount ?? 0;
  const usd = link.paid30dUsd ?? 0;
  const muted = theme.palette.text.secondary;
  return (
    <Tooltip arrow title={t("last30Tip", { count: link.paidTotalCount ?? link.timesUsed ?? 0, defaultValue: "{{count}} settled payments all-time" })}>
      <Box data-testid={`paylink-last30-${link.id}`} data-count={count} sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: compact ? 11.5 : 13, color: count > 0 ? theme.palette.text.primary : muted, whiteSpace: "nowrap" }}>
        {count > 0 ? (
          <>
            <Box component="span" sx={{ fontWeight: 600 }}>{t("paidCount", { count, defaultValue: "{{count}} paid" })}</Box>
            <Box component="span" sx={{ color: muted }}>·</Box>
            <Box component="span">${formatWithSeparators(usd, "USD", 2)}</Box>
          </>
        ) : (
          <Box component="span">{t("noPayments30d", { defaultValue: "— none in 30d" })}</Box>
        )}
      </Box>
    </Tooltip>
  );
};

interface QrShareProps {
  link: PaymentLinkData;
  onToast: (message: string, severity: "success" | "error") => void;
  compact?: boolean;
}

/** Inline QR (popover) + share (native share sheet, clipboard fallback) row actions. */
export const QrShareActions: React.FC<QrShareProps> = ({ link, onToast, compact }) => {
  const theme = useTheme();
  const { t } = useTranslation(["paymentLinks", "common"]);
  const [qrAnchor, setQrAnchor] = useState<HTMLElement | null>(null);
  const url = toShortPayLink(link.paymentUrl);
  const disabled = !url || link.status === "expired";
  const btnSx = compact ? { width: 36, height: 36, minWidth: 36, borderRadius: "10px" } : undefined;
  const share = async () => {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    const title = link.description || t("paymentLinks:paymentLinkFallback", { defaultValue: "Payment Link" });
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title, text: `${title} — ${link.usdValue}`.trim(), url });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    const ok = await copyToClipboard(url);
    onToast(ok ? String(t("common:copiedToClipboard")) : String(t("common:copyFailed")), ok ? "success" : "error");
  };
  if (disabled) return null;
  return (
    <>
      <Tooltip title={t("paymentLinks:qrTooltip", { defaultValue: "Show QR code" })} arrow>
        <RowActionButton aria-label={t("paymentLinks:qrTooltip", { defaultValue: "Show QR code" }) as string} data-testid={`paylink-qr-${link.id}`} onClick={(e) => setQrAnchor(e.currentTarget)} sx={btnSx}>
          <Icon name="qr-code" size={compact ? 14 : 16} />
        </RowActionButton>
      </Tooltip>
      <Tooltip title={t("paymentLinks:shareTooltip", { defaultValue: "Share link" })} arrow>
        <RowActionButton aria-label={t("paymentLinks:shareTooltip", { defaultValue: "Share link" }) as string} data-testid={`paylink-share-${link.id}`} onClick={share} sx={btnSx}>
          <Icon name="share-2" size={compact ? 14 : 16} />
        </RowActionButton>
      </Tooltip>
      <Popover
        open={!!qrAnchor}
        anchorEl={qrAnchor}
        onClose={() => setQrAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { p: 1.5, borderRadius: "14px", backgroundImage: "none", border: `1px solid ${theme.palette.divider}` } } }}
        data-testid={`paylink-qr-popover-${link.id}`}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }} onClick={(e) => e.stopPropagation()}>
          <Box sx={{ p: 1, borderRadius: "10px", backgroundColor: "#FFFFFF" }}>
            <QRCodeCanvas value={url} size={148} />
          </Box>
          <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: theme.palette.text.secondary, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</Typography>
        </Box>
      </Popover>
    </>
  );
};
