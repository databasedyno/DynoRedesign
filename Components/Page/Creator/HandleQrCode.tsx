import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { QRCodeCanvas } from "qrcode.react";
import { buildCreatorUrl, prettyCreatorUrl } from "@/helpers/creatorUrl";
import copyToClipboard from "@/helpers/copyToClipboard";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * Handle QR Code (Session 60).
 *
 * Renders a QR that encodes dynopay.me/{handle}. Creators can download it as
 * PNG (share in videos, print flyers/stickers). Two sizes:
 *   - `compact` (200 px, sidebar/card usage)
 *   - `full`    (320 px, settings page)
 *
 * Uses `qrcode.react`'s `QRCodeCanvas` so we can grab the underlying canvas
 * for the download. Rendered client-side only (no SSR needed).
 */

interface Props {
  handle: string;
  size?: "compact" | "full";
  accentColor?: string | null;
}

const HandleQrCode: React.FC<Props> = ({ handle, size = "full", accentColor }) => {
  const { t } = useTranslation("landing");
  const theme = useTheme();
  const border = theme.palette.divider;
  const containerRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = buildCreatorUrl(handle);
  const pretty = prettyCreatorUrl(handle);

  const qrSize = size === "full" ? 240 : 160;
  const fg = "#0A0A0B";     // Always black on white for max scannability
  const bg = "#FFFFFF";

  const download = async () => {
    if (!containerRef.current) return;
    const canvas = containerRef.current.querySelector("canvas");
    if (!canvas) return;
    setDownloading(true);
    try {
      // Composite: draw QR canvas onto a padded white square with the handle text below
      const PAD = 40;
      const TEXT_H = 60;
      const out = document.createElement("canvas");
      const w = canvas.width + PAD * 2;
      const h = canvas.height + PAD * 2 + TEXT_H;
      out.width = w;
      out.height = h;
      const ctx = out.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        // Accent stripe at top
        if (accentColor) {
          ctx.fillStyle = accentColor;
          ctx.fillRect(0, 0, w, 8);
        }
        ctx.drawImage(canvas, PAD, PAD);
        // Text
        ctx.fillStyle = "#0A0A0B";
        ctx.textAlign = "center";
        ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(pretty, w / 2, canvas.height + PAD + 34);
        ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillStyle = "#6B7280";
        ctx.fillText("Powered by Dynopay", w / 2, canvas.height + PAD + 56);
      }
      out.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `dynopay-${handle}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, "image/png");
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  const copyUrl = () => {
    if (!url) return;
    copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!handle) {
    return (
      <Box
        sx={{
          p: 2, borderRadius: "12px", border: `1px dashed ${border}`,
          textAlign: "center", color: theme.palette.text.secondary, fontSize: 13,
        }}
      >
        {t("creator.qr.claimFirst")}
      </Box>
    );
  }

  return (
    <Box data-testid="handle-qr-code" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25 }}>
      <Box
        ref={containerRef}
        sx={{
          p: 2,
          borderRadius: "16px",
          backgroundColor: "#FFFFFF",
          border: `1px solid ${border}`,
          position: "relative",
        }}
      >
        {accentColor && (
          <Box
            sx={{
              position: "absolute", top: 0, left: 0, right: 0, height: 6,
              backgroundColor: accentColor,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }}
          />
        )}
        <QRCodeCanvas
          value={url || `https://dynopay.me/${handle}`}
          size={qrSize}
          fgColor={fg}
          bgColor={bg}
          level="M"
          marginSize={2}
        />
      </Box>

      <Typography
        sx={{
          fontFamily: 'ui-monospace, "Roboto Mono", monospace',
          fontSize: 13,
          fontWeight: 700,
          color: theme.palette.text.primary,
        }}
        data-testid="qr-url"
      >
        {pretty}
      </Typography>

      <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          onClick={copyUrl}
          data-testid="qr-copy-url"
          startIcon={<Icon icon={copied ? "mdi:check" : "mdi:content-copy"} width={14} />}
          sx={{ textTransform: "none", fontSize: 12.5, fontWeight: 600, borderRadius: "10px" }}
        >
          {copied ? "Copied!" : "Copy link"}
        </Button>
        <Button
          fullWidth
          size="small"
          variant="contained"
          onClick={download}
          disabled={downloading}
          data-testid="qr-download"
          disableElevation
          startIcon={<Icon icon="mdi:download" width={14} />}
          sx={{
            textTransform: "none", fontSize: 12.5, fontWeight: 700, borderRadius: "10px",
            backgroundColor: accentColor || BRAND_ACCENT,
            color: "#FFFFFF",
            "&:hover": { backgroundColor: accentColor || BRAND_ACCENT, filter: "brightness(1.05)" },
          }}
        >
          {downloading ? "Saving…" : "Download PNG"}
        </Button>
      </Box>

      <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, textAlign: "center", maxWidth: 280 }}>
        {t("creator.qr.printHint")}
      </Typography>
    </Box>
  );
};

export default HandleQrCode;
