import React, { useEffect, useState } from "react";
import { Box, Button, IconButton, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import useProfile from "@/hooks/useProfile";
import { useTranslation } from "react-i18next";
import { prettyCreatorDomain } from "@/helpers/creatorUrl";
import { BRAND_ACCENT } from "@/constants/theme";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";
import { useCompanyStore } from "@/contexts/CompanyDataContext";

const DISMISS_KEY = "dynopay.claim-handle-banner.dismissed";
// Session 82: LIME const preserves the name but now holds aurora indigo #4F46E5
const LIME = BRAND_ACCENT;
const INK = "#0A0A0B";

/**
 * Dashboard top banner — only shown when the merchant has NOT claimed a
 * dynopay.com handle yet. Dismissible (persists in localStorage). Directs
 * the user to /creator for the full claim + publish flow.
 *
 * Companion to CreatorPageCard's inline State-1 claim input — the banner is
 * the "you can't miss this" nudge, the card is the "do it right here" input.
 */
const ClaimHandleBanner: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const profile = useProfile().profile as any;
  // Storefront-per-company: base the "needs a handle" decision on the SELECTED
  // company (not the account), so the banner matches the per-company page.
  const { profile: storefront } = useStorefrontProfile();
  // Personalise CTA copy on multi-company accounts so users know WHICH company
  // is missing a handle. Single-company accounts keep the original short copy.
  const { companyList, selectedCompanyId } = useCompanyStore();
  const currentCompany = companyList.find(
    (c: any) => Number(c.company_id) === Number(selectedCompanyId),
  );
  const currentCompanyName =
    (currentCompany?.company_name as string) || (currentCompany?.name as string) || "";
  const showCompanyLabel = companyList.length > 1 && Boolean(currentCompanyName);
  const [dismissed, setDismissed] = useState(true); // hidden by default until client mounts
  // Handle the visitor claimed on the landing hero (carried through signup via
  // localStorage). When present we personalise this banner so the reservation
  // feels continuous across the journey.
  const [pendingHandle, setPendingHandle] = useState("");

  const domain = prettyCreatorDomain() || "dynopay.com";
  const handle = (storefront?.handle as string) || "";

  useEffect(() => {
    // Only run client-side (localStorage). Also gates SSR/hydration mismatch.
    try {
      const stored = window.localStorage.getItem(DISMISS_KEY);
      setDismissed(stored === "1");
      const pending = (window.localStorage.getItem("dynopay.claimedHandle") || "")
        .trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
      if (pending.length >= 3) setPendingHandle(pending);
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  // Don't show if: not logged in, storefront still loading, the active company
  // already has a handle, or dismissed.
  if (!profile?.user_id) return null;
  if (storefront === undefined) return null;
  // Non-primary company pre-migration: it can't claim a handle yet — no nudge.
  if (storefront?.storefront_pending) return null;
  if (handle) return null;
  if (dismissed) return null;

  const isDark = theme.palette.mode === "dark";
  const bg = isDark
    ? "linear-gradient(90deg, rgba(79,70,229,0.12) 0%, rgba(0,229,255,0.10) 100%)"
    : "linear-gradient(90deg, rgba(129,140,248,0.22) 0%, rgba(0,229,255,0.16) 100%)";

  return (
    <Box
      data-testid="claim-handle-banner"
      sx={{
        position: "relative",
        borderRadius: "14px",
        border: `1px solid ${theme.palette.divider}`,
        background: bg,
        px: { xs: 2, sm: 2.5 },
        py: { xs: 1.75, sm: 1.5 },
        mb: 2,
        display: "flex",
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        gap: 2,
        flexWrap: { xs: "wrap", sm: "nowrap" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: "10px",
            backgroundColor: LIME,
            color: INK,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon icon="mdi:at" width={22} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: 13.5, sm: 14 }, fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.25 }}>
            {pendingHandle
              ? t("claimBannerTitlePending", {
                  defaultValue: `Finish claiming @${pendingHandle}`,
                  handle: pendingHandle,
                })
              : showCompanyLabel
                ? t("claimBannerTitleCompany", {
                    defaultValue: `Reserve ${currentCompanyName}'s handle`,
                    company: currentCompanyName,
                  })
                : t("claimBannerTitle", { defaultValue: "Reserve your creator handle" })}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, mt: 0.25 }}>
            {pendingHandle
              ? t("claimBannerSubtitlePending", {
                  defaultValue: `${domain}/${pendingHandle} is reserved for you — tap Claim to lock it in.`,
                  domain,
                  handle: pendingHandle,
                })
              : showCompanyLabel
                ? t("claimBannerSubtitleCompany", {
                    defaultValue: `Give ${currentCompanyName} its own ${domain}/handle so its public page and checkout URL go live.`,
                    company: currentCompanyName,
                    domain,
                  })
                : t("claimBannerSubtitle", {
                    defaultValue: `Grab your one-tap payment link — ${domain}/yourname — before someone else does.`,
                    domain,
                  })}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <Button
          variant="contained"
          disableElevation
          size="small"
          onClick={() => router.push("/storefront")}
          data-testid="claim-banner-cta"
          sx={{
            textTransform: "none",
            fontWeight: 700,
            fontSize: 13,
            borderRadius: "10px",
            px: 2,
            py: 0.85,
            backgroundColor: INK,
            color: LIME,
            "&:hover": { backgroundColor: INK, filter: "brightness(1.1)" },
          }}
        >
          {t("claimBannerCta", { defaultValue: "Claim now →" })}
        </Button>
        <IconButton
          size="small"
          onClick={dismiss}
          data-testid="claim-banner-dismiss"
          aria-label="Dismiss banner"
          sx={{
            color: theme.palette.text.secondary,
            // Session 74 P1: 44×44 tap target on mobile (WCAG 2.5.5).
            width: { xs: 44, md: 32 },
            height: { xs: 44, md: 32 },
          }}
        >
          <Icon icon="mdi:close" width={18} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default ClaimHandleBanner;
