/**
 * ShopHero — brand banner for /{handle}/shop.
 *
 * Mirrors the merchant's creator-page theme 1:1 (cover image / gradient /
 * pattern / aurora + accent) so the shop and the profile read as ONE brand,
 * then layers the identity row (ring avatar, name, @handle, bio, live stats)
 * and a share tray over it.
 */
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Avatar, IconButton, Tooltip, useTheme } from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { Icon } from "@iconify/react";
import type { ShopMerchant, ShopProduct } from "./types";
import copyToClipboard from "@/helpers/copyToClipboard";
import useToast from "@/hooks/useToast";
import PublicVerifiedBadge from "@/Components/UI/PublicVerifiedBadge";
import { BRAND_ACCENT } from "@/constants/theme";
import { buildCoverBackground, GRAIN_URL, readableOn, rise, type CoverStyle } from "@/constants/creatorTheme";

interface Props {
  merchant: ShopMerchant;
  products: ShopProduct[];
  shopUrl: string;
}

const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';
const HERO = "var(--font-hero), var(--font-sans)";

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
  const canvas = theme.palette.background.default;
  const { t } = useTranslation("landing");
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  // Merchant theme — the same source of truth as the creator page.
  const accent = merchant.theme?.accent_color || merchant.accent || BRAND_ACCENT;
  const accentText = isDark ? accent : (readableOn(accent) === "#FFFFFF" ? accent : darken(accent, 0.38));
  const coverBackground = useMemo(() => {
    const style = (merchant.theme?.cover_style || (merchant.cover_image ? "image" : "solid")) as CoverStyle;
    return buildCoverBackground(
      { accentColor: merchant.theme?.accent_color || merchant.accent || null, coverStyle: style, coverGradient: merchant.theme?.cover_gradient || null },
      merchant.cover_image || null,
    );
  }, [merchant.theme, merchant.accent, merchant.cover_image]);

  const totalSold = useMemo(
    () => products.reduce((n, p) => n + (p.sold_count || 0), 0),
    [products]
  );
  const productCount = products.length;

  const shareText = t("shop.shareText", { name: merchant.name, defaultValue: `Check out ${merchant.name}'s shop on Dynopay` });
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
      showToast({ message: t("shop.linkCopied", { defaultValue: "Link copied" }), severity: "success" });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const shareBtnSx = {
    width: 42,
    height: 42,
    color: theme.palette.text.primary,
    bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
    border: `1px solid ${theme.palette.divider}`,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    transition: "border-color 160ms ease, transform 160ms ease, background-color 160ms ease",
    "&:hover": {
      bgcolor: alpha(accent, 0.1),
      borderColor: accent,
      transform: "translateY(-2px)",
    },
    "&:active": { transform: "translateY(0) scale(0.96)" },
  };

  const statChipSx = {
    display: "inline-flex",
    alignItems: "center",
    gap: 0.6,
    px: 1.4,
    minHeight: 32,
    borderRadius: "999px",
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.02em",
    border: `1px solid ${theme.palette.divider}`,
    bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
    color: theme.palette.text.primary,
  };

  return (
    <Box data-testid="shop-hero" sx={{ position: "relative", mb: { xs: 4, md: 6 }, ...rise(0) }}>
      {/* Cover band — merchant theme */}
      <Box
        sx={{
          position: "relative",
          height: { xs: 156, sm: 196, md: 232 },
          borderRadius: { xs: "20px", md: "28px" },
          overflow: "hidden",
          background: coverBackground,
          boxShadow: isDark ? "0 30px 70px rgba(0,0,0,0.5)" : `0 30px 70px ${alpha(accent, 0.16)}`,
        }}
      >
        <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN_URL, opacity: 0.09, mixBlendMode: "overlay", pointerEvents: "none" }} />
        <Box aria-hidden sx={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, ${alpha(canvas, 0)} 45%, ${alpha(canvas, 0.35)} 80%, ${alpha(canvas, 0.7)} 100%)` }} />
      </Box>

      {/* Identity row — straddles the cover */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "flex-end" },
          gap: { xs: 1.5, sm: 3 },
          mt: { xs: -6, sm: -7 },
          px: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Box
          sx={{
            p: "4px",
            borderRadius: "50%",
            flexShrink: 0,
            background: `conic-gradient(from 210deg, ${accent} 0%, #FFB300 42%, ${alpha("#0EA5E9", 0.9)} 70%, ${accent} 100%)`,
            boxShadow: `0 16px 44px ${alpha(accent, isDark ? 0.4 : 0.28)}`,
          }}
        >
          <Avatar
            src={merchant.avatar || undefined}
            alt={merchant.name}
            data-testid="shop-merchant-avatar"
            sx={{
              width: { xs: 96, md: 112 },
              height: { xs: 96, md: 112 },
              border: `4px solid ${canvas}`,
              bgcolor: theme.palette.background.paper,
              background: merchant.avatar ? undefined : `linear-gradient(135deg, ${accent} 0%, ${darken(accent, 0.28)} 100%)`,
              color: readableOn(accent),
              fontFamily: HERO,
              fontSize: { xs: 36, md: 44 },
              fontWeight: 800,
            }}
          >
            {(merchant.name || merchant.handle || "?").slice(0, 1).toUpperCase()}
          </Avatar>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, pb: { sm: 0.5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "1.7rem", md: "2.3rem" },
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                fontFamily: HERO,
                color: theme.palette.text.primary,
                overflowWrap: "anywhere",
              }}
              data-testid="shop-merchant-name"
            >
              {merchant.name}
            </Typography>
            <PublicVerifiedBadge handle={merchant.handle} size={22} ml={0} />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mt: 0.75, flexWrap: "wrap" }}>
            <Box
              sx={{
                display: "inline-flex", alignItems: "center", px: 1.25, py: 0.35, borderRadius: "999px",
                border: `1px solid ${alpha(accent, 0.38)}`, bgcolor: alpha(accent, isDark ? 0.12 : 0.08),
              }}
            >
              <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: accentText }} data-testid="shop-merchant-handle">
                @{merchant.handle}
              </Typography>
            </Box>
            <Box
              component="a"
              href={`/${merchant.handle}`}
              data-testid="shop-back-to-page"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontSize: 13, fontWeight: 700, color: theme.palette.text.secondary, textDecoration: "none", minHeight: 32, "&:hover": { color: accentText } }}
            >
              <Icon icon="mdi:account-circle-outline" width={16} />
              {t("shop.viewPage", { defaultValue: "View page" })}
            </Box>
          </Box>

          {merchant.bio && (
            <Typography
              sx={{
                mt: 1.5,
                maxWidth: 640,
                fontSize: { xs: 14.5, md: 15.5 },
                color: theme.palette.text.secondary,
                lineHeight: 1.6,
                whiteSpace: "pre-line",
              }}
              data-testid="shop-merchant-bio"
            >
              {merchant.bio}
            </Typography>
          )}
        </Box>

        {/* Share tray — right side on desktop, wraps under on mobile */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0, pb: { sm: 0.5 } }} data-testid="shop-share-tray">
          <Typography sx={{ mr: 0.5, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
            {t("shop.share", { defaultValue: "Share" })}
          </Typography>
          <Tooltip title={t("shop.shareOnX", { defaultValue: "Share on X" })}>
            <IconButton component="a" href={shareLinks.x} target="_blank" rel="noopener noreferrer" aria-label={t("shop.shareOnX", { defaultValue: "Share on X" })} sx={shareBtnSx} data-testid="shop-share-x">
              {X_ICON}
            </IconButton>
          </Tooltip>
          <Tooltip title={t("shop.shareOnThreads", { defaultValue: "Share on Threads" })}>
            <IconButton component="a" href={shareLinks.threads} target="_blank" rel="noopener noreferrer" aria-label={t("shop.shareOnThreads", { defaultValue: "Share on Threads" })} sx={shareBtnSx} data-testid="shop-share-threads">
              {THREADS_ICON}
            </IconButton>
          </Tooltip>
          <Tooltip title={t("shop.shareOnWhatsApp", { defaultValue: "Share on WhatsApp" })}>
            <IconButton component="a" href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" aria-label={t("shop.shareOnWhatsApp", { defaultValue: "Share on WhatsApp" })} sx={shareBtnSx} data-testid="shop-share-whatsapp">
              {WHATSAPP_ICON}
            </IconButton>
          </Tooltip>
          <Tooltip title={t("shop.copyLink", { defaultValue: "Copy link" })}>
            <IconButton onClick={handleCopy} aria-label={t("shop.copyShopLink", { defaultValue: "Copy shop link" })} sx={{ ...shareBtnSx, ...(copied ? { borderColor: accent, bgcolor: alpha(accent, 0.12) } : {}) }} data-testid="shop-share-copy">
              {copied ? <Icon icon="mdi:check" width={18} /> : <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stats row */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2.5, px: { xs: 2, sm: 3, md: 4 } }} data-testid="shop-stats">
        <Box sx={statChipSx} data-testid="shop-stat-products">
          <Icon icon="mdi:shopping-outline" width={15} color={accentText} />
          {t(productCount === 1 ? "shop.productOne" : "shop.productOther", { count: productCount, defaultValue: `${productCount} ${productCount === 1 ? "product" : "products"}` })}
        </Box>
        {totalSold > 0 && (
          <Box sx={{ ...statChipSx, color: isDark ? "#3FD98A" : "#05936A", borderColor: isDark ? "rgba(63,217,138,0.35)" : "rgba(5,147,106,0.28)", bgcolor: isDark ? "rgba(5,177,105,0.12)" : "rgba(5,177,105,0.08)" }} data-testid="shop-stat-sold">
            <Icon icon="mdi:fire" width={15} />
            {t("shop.soldCount", { count: totalSold, defaultValue: `${totalSold} sold` })}
          </Box>
        )}
        <Box sx={statChipSx} data-testid="shop-stat-crypto">
          <Icon icon="mdi:lightning-bolt" width={15} color="#FFB300" />
          {t("shop.instantCheckout", { defaultValue: "Instant crypto checkout" })}
        </Box>
      </Box>
    </Box>
  );
}
