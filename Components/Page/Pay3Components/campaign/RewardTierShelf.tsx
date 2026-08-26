/**
 * RewardTierShelf — horizontal reward-tier browser.
 *
 * Improvements over the previous vertical stack:
 *   • Horizontal snap-scroll on all breakpoints (touch-friendly)
 *   • Each card has a sticky bottom "Pledge $X" CTA that calls back to the
 *     parent form (setting the amount + scrolling into the donate box).
 *   • "Most popular" ribbon on the middle-priced tier.
 *   • Hover elevates + darkens border in the accent colour.
 *   • Empty state omitted — parent decides whether to render.
 */
import React from "react";
import { Box, Typography, useTheme, Button, IconButton } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import useEdgeFade from "@/hooks/useEdgeFade";

export interface Tier {
  tier_id: number;
  min_amount: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
}

interface Props {
  tiers: Tier[];
  currencySymbol: string;
  formatAmount: (n: number) => string;
  onPledge: (tier: Tier) => void;
}

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';

export default function RewardTierShelf({
  tiers,
  currencySymbol,
  formatAmount,
  onPledge,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const accent = BRAND_ACCENT;
  const onAccent = "#0A0A0B";
  const border = theme.palette.divider;
  // Public-surfaces pass: visible edge fade = honest scroll affordance
  // (chevrons alone are easy to miss on touch).
  const shelfFade = useEdgeFade<HTMLDivElement>();
  const scrollerRef = shelfFade.ref;

  // Determine "most popular" by picking the median-priced tier as a reasonable
  // heuristic (mid-tier is what most Kickstarter campaigns highlight).
  const mostPopularTierId = React.useMemo(() => {
    if (tiers.length < 3) return null;
    const sorted = [...tiers].sort((a, b) => a.min_amount - b.min_amount);
    return sorted[Math.floor(sorted.length / 2)].tier_id;
  }, [tiers]);

  const scroll = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.75 * dir;
    el.scrollBy({ left: step, behavior: "smooth" });
  };

  const navBtnSx = {
    bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
    border: `1px solid ${border}`,
    width: 34,
    height: 34,
    "&:hover": {
      bgcolor: isDark ? "rgba(255,255,255,0.15)" : "#fff",
    },
  };

  return (
    <Box data-testid="donation-tiers" sx={{ position: "relative" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.25,
        }}
      >
        <Typography
          component="span"
          sx={{
            fontFamily: MONO,
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
          }}
        >
          Reward tiers
        </Typography>
        <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 0.75 }}>
          <IconButton
            aria-label="Scroll tiers left"
            onClick={() => scroll(-1)}
            sx={navBtnSx}
            data-testid="donation-tiers-scroll-left"
          >
            <Icon icon="mdi:chevron-left" width={20} />
          </IconButton>
          <IconButton
            aria-label="Scroll tiers right"
            onClick={() => scroll(1)}
            sx={navBtnSx}
            data-testid="donation-tiers-scroll-right"
          >
            <Icon icon="mdi:chevron-right" width={20} />
          </IconButton>
        </Box>
      </Box>

      <Box
        ref={scrollerRef}
        data-testid="donation-tiers-scroller"
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          pb: 1,
          mx: { xs: -1.5, sm: 0 },
          px: { xs: 1.5, sm: 0 },
          // Hide scrollbar
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
          // Edge fade — signals more tiers off-screen.
          maskImage: shelfFade.maskImage,
          WebkitMaskImage: shelfFade.WebkitMaskImage,
        }}
      >
        {tiers.map((tier) => {
          const isPopular = tier.tier_id === mostPopularTierId;
          return (
            <Box
              key={tier.tier_id}
              data-testid={`donation-tier-${tier.tier_id}`}
              sx={{
                position: "relative",
                flex: "0 0 auto",
                width: { xs: 260, sm: 280 },
                display: "flex",
                flexDirection: "column",
                borderRadius: "16px",
                border: `1.5px solid ${isPopular ? accent : border}`,
                backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "background.paper",
                boxShadow: isPopular
                  ? isDark
                    ? "0 8px 24px rgba(79,70,229,0.10)"
                    : "0 8px 24px rgba(79,70,229,0.20)"
                  : "none",
                scrollSnapAlign: "start",
                transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: isDark
                    ? "0 12px 32px rgba(0,0,0,0.4)"
                    : "0 12px 32px rgba(0,0,0,0.10)",
                  borderColor: accent,
                },
              }}
            >
              {isPopular && (
                <Box
                  data-testid={`donation-tier-popular-${tier.tier_id}`}
                  sx={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    bgcolor: accent,
                    color: onAccent,
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    px: 1.25,
                    py: 0.35,
                    borderRadius: 999,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    zIndex: 2,
                    whiteSpace: "nowrap",
                  }}
                >
                  ★ Most popular
                </Box>
              )}

              {/* Cover / gift icon */}
              <Box
                sx={{
                  width: "100%",
                  aspectRatio: "16/9",
                  overflow: "hidden",
                  borderTopLeftRadius: 14,
                  borderTopRightRadius: 14,
                  bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {tier.image_url ? (
                  <Box
                    component="img"
                    src={tier.image_url}
                    alt=""
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      bgcolor: isDark ? "rgba(79,70,229,0.15)" : "rgba(79,70,229,0.22)",
                    }}
                  >
                    <Icon icon="mdi:gift-outline" width={32} color={accent} />
                  </Box>
                )}
              </Box>

              {/* Body */}
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  p: 2,
                  pb: 1,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: MONO,
                    fontWeight: 800,
                    fontSize: 20,
                    color: accent,
                    letterSpacing: "-0.01em",
                  }}
                  data-testid={`donation-tier-price-${tier.tier_id}`}
                >
                  {currencySymbol}{formatAmount(tier.min_amount)}+
                </Typography>
                <Typography
                  component="h4"
                  sx={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: theme.palette.text.primary,
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {tier.title}
                </Typography>
                {tier.description && (
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: theme.palette.text.secondary,
                      whiteSpace: "pre-line",
                      display: "-webkit-box",
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      lineHeight: 1.5,
                    }}
                  >
                    {tier.description}
                  </Typography>
                )}
              </Box>

              {/* Sticky CTA */}
              <Box sx={{ p: 2, pt: 1 }}>
                <Button
                  fullWidth
                  disableElevation
                  onClick={() => onPledge(tier)}
                  variant="contained"
                  data-testid={`donation-tier-pledge-${tier.tier_id}`}
                  sx={{
                    py: 1.1,
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: "-0.01em",
                    backgroundColor: accent,
                    color: onAccent,
                    "&:hover": {
                      backgroundColor: accent,
                      filter: "brightness(1.06)",
                    },
                  }}
                >
                  Pledge {currencySymbol}{formatAmount(tier.min_amount)}
                </Button>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
