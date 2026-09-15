import React from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "../../coinbase/styled";
import { money } from "./format";
import type { OverviewSource } from "./useDashboardOverview";

interface Props {
  sources: OverviewSource[];
  loading: boolean;
  currencySymbol: string;
  currency: string;
  rangeLabel: string;
}

const iconFor = (s: OverviewSource) => {
  if (s.kind === "product") return "package";
  if (s.is_tip_jar) return "coffee";
  if (s.link_type === "donation" || s.link_type === "contribution") return "heart-handshake";
  if (s.link_type === "cart") return "shopping-cart";
  return "link";
};

const hrefFor = (s: OverviewSource) => (s.kind === "product" ? `/pay-links/products/${s.id}` : "/pay-links");

/** Zone 5 (right) — revenue attribution: which links and products earned in the range. */
const TopSourcesCard: React.FC<Props> = ({ sources, loading, currencySymbol, currency, rangeLabel }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const max = Math.max(1, ...sources.map((s) => s.amount));

  return (
    <SurfaceCard data-testid="top-products-list" sx={{ p: 0, overflow: "hidden", height: "100%" }}>
      <Box sx={{ px: { xs: 2, md: 2.5 }, pt: { xs: 1.75, md: 2 }, pb: 1 }}>
        <Eyebrow>{`${t("command.topSources", { defaultValue: "Top links & products" })} · ${rangeLabel}`}</Eyebrow>
      </Box>
      {loading ? (
        <Box sx={{ px: 2.5, pb: 2 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}
        </Box>
      ) : sources.length === 0 ? (
        <Box data-testid="top-products-empty" sx={{ px: 2.5, py: 3, fontFamily: "var(--font-sans)", fontSize: 13, color: muted, lineHeight: 1.5 }}>
          {t("command.topSourcesEmpty", { defaultValue: "No paid links or products in this range yet. Payments through your links and store show up here." })}
        </Box>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, pb: 1 }}>
          {sources.map((s, i) => (
            <Box
              component="li"
              key={`${s.kind}-${s.id}`}
              role="link"
              tabIndex={0}
              data-testid="top-source-row"
              data-kind={s.kind}
              onClick={() => router.push(hrefFor(s))}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter") router.push(hrefFor(s));
              }}
              sx={{
                display: "grid",
                gridTemplateColumns: "28px minmax(0, 1fr) auto",
                alignItems: "center",
                columnGap: 1.25,
                px: { xs: 2, md: 2.5 },
                py: 1.1,
                cursor: "pointer",
                position: "relative",
                transition: "background-color 150ms ease",
                "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(10,10,15,0.02)" },
                "&:focus-visible": { outline: `2px solid ${indigo}`, outlineOffset: -2 },
              }}
            >
              <Box aria-hidden sx={{ width: 28, height: 28, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: muted, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)" }}>
                <Icon name={iconFor(s)} size={15} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box data-testid="top-source-title" sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.title?.trim() || t("command.untitledLink", { id: s.id, defaultValue: "Untitled link #{{id}}" })}
                </Box>
                <Box sx={{ mt: 0.5, height: 3, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.06)", overflow: "hidden" }}>
                  <Box sx={{ width: `${Math.max(3, (s.amount / max) * 100)}%`, height: "100%", backgroundColor: indigo, opacity: Math.max(0.35, 1 - i * 0.12) }} />
                </Box>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Box data-testid="top-source-amount" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 600, color: ink }}>
                  {money(s.amount, currencySymbol, currency)}
                </Box>
                <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: muted }}>
                  {t("command.paidCount", { count: s.paid_count, defaultValue: "{{count}} paid" })}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </SurfaceCard>
  );
};

export default TopSourcesCard;
