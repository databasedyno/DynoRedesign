import React, { useEffect, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { trackOnboarding } from "@/utils/trackOnboarding";
import type { SetupProgress } from "./useSetupProgress";

interface Props {
  progress: SetupProgress;
}

const COLLAPSE_KEY = (companyId?: number) => `dyno_gs_strip_collapsed:${companyId ?? "x"}`;

/**
 * SetupCompleteStrip — brand state 2 ("Ready · waiting for first payment").
 * Replaces the faded, inert dashboard preview: the merchant now sees the FULL
 * interactive dashboard with empty states, and this slim strip sits on top to
 * (a) celebrate that setup is done, (b) carry the fee-free promise, and
 * (c) give a per-track way to get their first payment (share again / open page
 * / open developers). Collapsible, remembered per brand.
 */
const SetupCompleteStrip: React.FC<Props> = ({ progress }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const { track, companyId } = progress;

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY(companyId)) === "1");
    } catch { /* noop */ }
  }, [companyId]);
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem(COLLAPSE_KEY(companyId), next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

  const go = (path: string, action: string) => {
    trackOnboarding({ event_type: "step_clicked", step_key: "payment", metadata: { surface: "setup_complete_strip", action } });
    router.push(path);
  };

  const title = track === "developers"
    ? t("gs.stripTitleDev", { defaultValue: "Setup complete — your integration works in sandbox" })
    : track === "creators"
      ? t("gs.stripTitleCreator", { defaultValue: "Setup complete — your page is live" })
      : track === "fundraisers"
        ? t("gs.stripTitleFundraiser", { defaultValue: "Setup complete — your campaign is live" })
        : t("gs.stripTitle", { defaultValue: "Setup complete — waiting for your first payment" });

  const subtitle = track === "developers"
    ? t("gs.stripSubtitleDev", { defaultValue: "Your dashboard is live. It fills with real numbers the moment your first live payment settles." })
    : t("gs.stripSubtitle", { defaultValue: "Your dashboard is ready. The moment your first payment lands, the numbers below come alive." });

  type Cta = { label: string; path: string; action: string; primary?: boolean };
  const ctas: Cta[] = (() => {
    switch (track) {
      case "developers":
        return [{ label: t("gs.stripOpenDevelopers", { defaultValue: "Open Developers" }), path: "/developer-keys", action: "open_developers", primary: true }];
      case "creators":
        return [
          { label: t("gs.stripOpenPage", { defaultValue: "Open your page" }), path: "/storefront?tab=page", action: "open_page", primary: true },
          { label: t("gs.stripShareAgain", { defaultValue: "Share again" }), path: "/get-started?step=share", action: "share_again" },
        ];
      case "fundraisers":
        return [
          { label: t("gs.stripOpenCampaigns", { defaultValue: "Open campaigns" }), path: "/pay-links", action: "open_campaigns", primary: true },
          { label: t("gs.stripShareAgain", { defaultValue: "Share again" }), path: "/get-started?step=share", action: "share_again" },
        ];
      default:
        return [{ label: t("gs.stripShareAgain", { defaultValue: "Share it again" }), path: "/get-started?step=share", action: "share_again", primary: true }];
    }
  })();

  const feeFreeChip = (
    <Box
      data-testid="gs-strip-feefree-chip"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.625,
        px: 1,
        py: 0.375,
        borderRadius: 999,
        border: `1px solid ${isDark ? "rgba(63,217,138,0.35)" : "rgba(34,150,90,0.3)"}`,
        backgroundColor: isDark ? "rgba(63,217,138,0.1)" : "rgba(34,150,90,0.08)",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 700,
        color: positive,
        whiteSpace: "nowrap",
      }}
    >
      <Icon name="badge-check" size={13} />
      {t("gs.stripFeeFree", { defaultValue: "First payment is fee-free" })}
    </Box>
  );

  return (
    <Box
      data-testid="gs-setup-complete-strip"
      data-collapsed={collapsed}
      data-track={track}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "16px",
        border: `1px solid ${indigo}`,
        backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow,
        px: { xs: 2, md: 2.5 },
        py: collapsed ? { xs: 1, md: 1.125 } : { xs: 2, md: 2.25 },
        transition: "padding 180ms ease",
      }}
    >
      <Box sx={{ display: "flex", alignItems: collapsed ? "center" : "flex-start", gap: 1.5 }}>
        <Box
          sx={{
            width: collapsed ? 28 : 36,
            height: collapsed ? 28 : 36,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            backgroundColor: positive,
            transition: "width 180ms ease, height 180ms ease",
          }}
        >
          <Icon name="check" size={collapsed ? 15 : 19} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Box
              data-testid="gs-strip-title"
              sx={{
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: { xs: 14, md: 15 },
                letterSpacing: "-0.01em",
                color: ink,
                overflow: collapsed ? "hidden" : "visible",
                textOverflow: "ellipsis",
                whiteSpace: collapsed ? "nowrap" : "normal",
              }}
            >
              {title}
            </Box>
            {!collapsed && feeFreeChip}
          </Box>

          {!collapsed && (
            <>
              <Box sx={{ mt: 0.75, fontFamily: "var(--font-sans)", fontSize: { xs: 13, md: 13.5 }, lineHeight: 1.5, color: muted, maxWidth: 640 }}>
                {subtitle}
              </Box>
              <Box sx={{ mt: 1.75, display: "flex", flexWrap: "wrap", gap: 1 }}>
                {ctas.map((c) => (
                  <Box
                    key={c.action}
                    component="button"
                    type="button"
                    data-testid={`gs-strip-cta-${c.action}`}
                    onClick={() => go(c.path, c.action)}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      minHeight: 40,
                      px: 2,
                      borderRadius: 999,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: 13.5,
                      fontWeight: 700,
                      transition: "transform 140ms ease, filter 140ms ease, background-color 140ms ease",
                      border: c.primary ? "none" : `1px solid ${border}`,
                      color: c.primary ? "#FFFFFF" : ink,
                      backgroundColor: c.primary ? indigo : "transparent",
                      "&:hover": { transform: "translateY(-1px)", filter: c.primary ? "brightness(1.05)" : "none", backgroundColor: c.primary ? indigo : (isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.035)") },
                    }}
                  >
                    {c.label}
                    <Icon name="arrow-right" size={15} />
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {collapsed && feeFreeChip}
          <Box
            component="button"
            type="button"
            data-testid="gs-strip-collapse-toggle"
            aria-expanded={!collapsed}
            onClick={toggle}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "10px",
              border: `1px solid ${border}`,
              background: "transparent",
              cursor: "pointer",
              color: muted,
              "&:hover": { color: ink, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.035)" },
            }}
          >
            <Icon name={collapsed ? "chevron-down" : "chevron-up"} size={16} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SetupCompleteStrip;
