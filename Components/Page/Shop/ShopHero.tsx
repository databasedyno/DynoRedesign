/**
 * ShopHero — brand banner for /{handle}/shop.
 *
 * Displays:
 *   • Gradient cover derived from merchant's avatar (with subtle noise / mesh)
 *   • Ring-bordered avatar + name + @handle + bio
 *   • Live stats: product count, total sold, currency
 *   • Share tray (X, Threads, WhatsApp, Copy link)
 *
 * Theme-aware (light + dark). No external image dependencies —
 * cover is a CSS gradient so we can't hit a broken asset.
 */
import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Snackbar,
  Chip,
  Stack,
  useTheme,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import type { ShopMerchant, ShopProduct } from "./types";
import copyToClipboard from "@/helpers/copyToClipboard";

interface Props {
  merchant: ShopMerchant;
  products: ShopProduct[];
  shopUrl: string;
}

const X_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2H21.5l-7.5 8.573L22.75 22h-6.813l-5.34-6.98L4.5 22H1.24l8.023-9.171L1.25 2h6.984l4.83 6.4L18.244 2Zm-1.194 18.11h1.836L6.99 3.789H5.02l12.03 16.32Z" />
  </svg>
);

const THREADS_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12.19 21.35c-3.4-.02-6.01-1.15-7.75-3.34-1.55-1.95-2.35-4.66-2.38-8.06.03-3.4.83-6.11 2.38-8.06C6.18 1.7 8.79.58 12.19.55c3.42.02 6.06 1.13 7.85 3.31 1.03 1.25 1.71 2.75 2.03 4.47l-1.9.49c-.26-1.34-.79-2.5-1.58-3.44-1.42-1.71-3.53-2.6-6.4-2.61-2.86.02-4.94.9-6.36 2.6-1.34 1.62-2.02 3.98-2.05 7.03.03 3.05.71 5.41 2.05 7.02 1.42 1.71 3.5 2.58 6.36 2.6 2.53-.02 4.29-.61 5.66-1.9 1.55-1.46 1.53-3.25 1.03-4.33-.29-.63-.83-1.16-1.55-1.53-.18 1.24-.6 2.24-1.26 2.97-.87.97-2.11 1.5-3.68 1.6-1.2.07-2.35-.21-3.26-.79-1.06-.68-1.69-1.72-1.75-2.94-.14-2.42 1.79-4.16 4.82-4.33.9-.05 1.75-.01 2.55.12-.11-.65-.34-1.16-.66-1.5-.44-.47-1.12-.71-2.03-.71h-.02c-.72 0-1.7.2-2.32 1.13l-1.62-1.09c.83-1.24 2.18-1.93 3.94-1.93h.03c2.95.02 4.7 1.83 4.87 4.99.1.04.19.09.29.13 1.34.63 2.32 1.58 2.85 2.74.72 1.62.79 4.26-1.35 6.28-1.63 1.54-3.61 2.23-6.42 2.25zm.85-8.61c-.24 0-.48.01-.72.02-1.79.1-2.87.95-2.8 2.15.07 1.27 1.46 1.86 2.79 1.78 1.22-.07 2.83-.55 3.06-3.7-.65-.14-1.36-.24-2.33-.25z" />
  </svg>
);

const WHATSAPP_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.52 3.48A11.87 11.87 0 0 0 12.05.02C5.53.02.24 5.31.24 11.83c0 2.09.55 4.13 1.6 5.93L.14 24l6.42-1.68a11.8 11.8 0 0 0 5.49 1.4h.01c6.52 0 11.81-5.29 11.81-11.81 0-3.16-1.23-6.13-3.46-8.36zM12.06 21.94h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.81 1 1.02-3.71-.24-.38a9.85 9.85 0 0 1-1.5-5.24c0-5.44 4.43-9.87 9.88-9.87a9.82 9.82 0 0 1 6.98 2.89 9.83 9.83 0 0 1 2.89 6.98c0 5.45-4.43 9.88-9.88 9.88zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.06 2.89 1.21 3.09.15.2 2.09 3.19 5.06 4.48.71.31 1.26.49 1.69.63.71.23 1.35.2 1.86.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
  </svg>
);

export default function ShopHero({ merchant, products, shopUrl }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [copied, setCopied] = useState(false);

  // Derive brand tint from merchant name (deterministic hue).
  const hue = useMemo(() => {
    const s = merchant.name || merchant.handle || "dynopay";
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }, [merchant.name, merchant.handle]);

  const totalSold = useMemo(
    () => products.reduce((n, p) => n + (p.sold_count || 0), 0),
    [products]
  );
  const productCount = products.length;

  const shareText = `Check out ${merchant.name}'s shop on Dynopay`;
  const encoded = encodeURIComponent(shareText + " " + shopUrl);
  const shareLinks = {
    x: `https://twitter.com/intent/tweet?text=${encoded}`,
    threads: `https://www.threads.net/intent/post?text=${encoded}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encoded}`,
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(shopUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const coverGradient = isDark
    ? `radial-gradient(1200px 400px at 20% 0%, hsla(${hue},70%,45%,0.35) 0%, transparent 60%),
       radial-gradient(900px 300px at 80% 30%, hsla(${(hue + 40) % 360},80%,55%,0.28) 0%, transparent 55%),
       linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%)`
    : `radial-gradient(1200px 400px at 20% 0%, hsla(${hue},80%,70%,0.55) 0%, transparent 60%),
       radial-gradient(900px 300px at 80% 30%, hsla(${(hue + 40) % 360},85%,75%,0.45) 0%, transparent 55%),
       linear-gradient(180deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.6) 100%)`;

  const shareBtnSx = {
    color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.75)",
    bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"}`,
    "&:hover": {
      bgcolor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.95)",
      transform: "translateY(-1px)",
    },
    transition: "all 0.15s ease",
  };

  return (
    <Box
      data-testid="shop-hero"
      sx={{
        position: "relative",
        borderRadius: { xs: 0, md: 3 },
        overflow: "hidden",
        mb: { xs: 3, md: 5 },
        background: coverGradient,
        backgroundColor: isDark ? "#0b0f14" : "#f5f6f9",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
        px: { xs: 3, md: 5 },
        py: { xs: 4, md: 6 },
      }}
    >
      {/* Noise overlay for texture */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: isDark ? 0.06 : 0.04,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, gap: { xs: 2, sm: 3 } }}>
        <Avatar
          src={merchant.avatar || undefined}
          alt={merchant.name}
          data-testid="shop-merchant-avatar"
          sx={{
            width: { xs: 72, md: 96 },
            height: { xs: 72, md: 96 },
            border: `3px solid ${isDark ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.95)"}`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            bgcolor: `hsl(${hue}, 60%, 55%)`,
            fontSize: { xs: 28, md: 36 },
            fontWeight: 700,
          }}
        >
          {(merchant.name || merchant.handle || "?").slice(0, 1).toUpperCase()}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              fontSize: { xs: "1.75rem", md: "2.5rem" },
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: isDark ? "rgba(255,255,255,0.98)" : "rgba(0,0,0,0.92)",
              wordBreak: "break-word",
            }}
            data-testid="shop-merchant-name"
          >
            {merchant.name}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              mt: 0.5,
              color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
            }}
            data-testid="shop-merchant-handle"
          >
            @{merchant.handle}
          </Typography>

          {merchant.bio && (
            <Typography
              variant="body1"
              sx={{
                mt: 1.5,
                maxWidth: 640,
                color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                lineHeight: 1.5,
              }}
              data-testid="shop-merchant-bio"
            >
              {merchant.bio}
            </Typography>
          )}

          {/* Stats row */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}
            data-testid="shop-stats"
          >
            <Chip
              size="small"
              label={`${productCount} ${productCount === 1 ? "product" : "products"}`}
              sx={{
                bgcolor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)",
                color: isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.85)",
                fontWeight: 600,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)"}`,
              }}
              data-testid="shop-stat-products"
            />
            {totalSold > 0 && (
              <Chip
                size="small"
                label={`${totalSold} sold`}
                sx={{
                  bgcolor: isDark ? "rgba(204,255,0,0.15)" : "rgba(90,107,0,0.12)",
                  color: isDark ? "#ccff00" : "#5a6b00",
                  fontWeight: 700,
                  border: `1px solid ${isDark ? "rgba(204,255,0,0.35)" : "rgba(90,107,0,0.28)"}`,
                }}
                data-testid="shop-stat-sold"
              />
            )}
            <Chip
              size="small"
              icon={
                <Box component="span" sx={{ fontSize: 12, ml: "8px !important" }}>
                  {"\u26A1"}
                </Box>
              }
              label="Instant crypto checkout"
              sx={{
                bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.75)",
                color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                fontWeight: 500,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.05)"}`,
              }}
              data-testid="shop-stat-crypto"
            />
          </Stack>
        </Box>

        {/* Share tray — right side on desktop, wraps under on mobile */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            mt: { xs: 1, sm: 0 },
            flexShrink: 0,
          }}
          data-testid="shop-share-tray"
        >
          <Tooltip title="Share on X">
            <IconButton
              size="small"
              component="a"
              href={shareLinks.x}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on X"
              sx={shareBtnSx}
              data-testid="shop-share-x"
            >
              {X_ICON}
            </IconButton>
          </Tooltip>
          <Tooltip title="Share on Threads">
            <IconButton
              size="small"
              component="a"
              href={shareLinks.threads}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Threads"
              sx={shareBtnSx}
              data-testid="shop-share-threads"
            >
              {THREADS_ICON}
            </IconButton>
          </Tooltip>
          <Tooltip title="Share on WhatsApp">
            <IconButton
              size="small"
              component="a"
              href={shareLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on WhatsApp"
              sx={shareBtnSx}
              data-testid="shop-share-whatsapp"
            >
              {WHATSAPP_ICON}
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy link">
            <IconButton
              size="small"
              onClick={handleCopy}
              aria-label="Copy shop link"
              sx={shareBtnSx}
              data-testid="shop-share-copy"
            >
              <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2200}
        onClose={() => setCopied(false)}
        message="Link copied"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
