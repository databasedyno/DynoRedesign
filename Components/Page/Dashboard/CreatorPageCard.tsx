import React, { useEffect, useState } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import PanelCard from "@/Components/UI/PanelCard";
import { rootReducer } from "@/utils/types";
import { buildCreatorUrl, prettyCreatorUrl, prettyCreatorDomain } from "@/helpers/creatorUrl";

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';
const LIME = "#CCFF00";
const INK = "#0A0A0B";

/**
 * Dashboard right-column card that surfaces the Creator page feature.
 * Three states, based on `profile.handle` + `profile.creator_page_enabled`:
 *   1. No handle          → "Claim your dynopay.me/handle" (empty-state CTA)
 *   2. Handle, not live   → "Turn on your public page" (publish nudge)
 *   3. Live               → URL + Copy + View + tiny visit/supporters stats
 */
const CreatorPageCard: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;

  const siteUrl = prettyCreatorDomain();
  const handle = profile?.handle || "";
  const published = Boolean(profile?.creator_page_enabled);
  const publicUrl = buildCreatorUrl(handle);
  const prettyUrl = prettyCreatorUrl(handle);

  const [visits, setVisits] = useState<number | null>(null);
  const [weekVisits, setWeekVisits] = useState<number | null>(null);
  const [supporters, setSupporters] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Stats are only meaningful once a handle is set & page is live.
    if (!handle || !published) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axiosBaseApi.get("/user/creator/stats");
        if (cancelled) return;
        setVisits(Number(r?.data?.data?.total_visits ?? 0));
        setWeekVisits(Number(r?.data?.data?.this_week_visits ?? 0));
        setSupporters(Number(r?.data?.data?.supporters_count ?? 0));
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [handle, published]);

  const copyUrl = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  // Common panel wrapper for the 3 states
  const isDark = theme.palette.mode === "dark";
  const limeTint = isDark ? "rgba(204,255,0,0.08)" : "rgba(204,255,0,0.12)";

  // ── STATE 3: Published (has handle + published) ─────────────────────
  if (handle && published) {
    return (
      <PanelCard
        title={t("creatorCardLiveTitle", { defaultValue: "Your creator page" })}
        subTitle={t("creatorCardLiveSubtitle", { defaultValue: "Live and accepting support." })}
        showHeaderBorder={false}
        headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
        bodyPadding={theme.spacing(1.5, 2.5, 2.5, 2.5)}
      >
        <Box data-testid="creator-card-live" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* URL pill */}
          <Box
            sx={{
              display: "flex", alignItems: "center", gap: 1,
              px: 1.5, py: 1.25, borderRadius: "10px",
              backgroundColor: limeTint,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Icon icon="mdi:link-variant" width={16} color={theme.palette.text.secondary} />
            <Typography
              sx={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: theme.palette.text.primary, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              data-testid="creator-card-url"
            >
              {prettyUrl}
            </Typography>
          </Box>

          {/* Actions */}
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              fullWidth
              variant="outlined"
              onClick={copyUrl}
              data-testid="creator-card-copy"
              startIcon={<Icon icon={copied ? "mdi:check" : "mdi:content-copy"} width={15} />}
              sx={{ textTransform: "none", fontSize: 12.5, fontWeight: 600, borderRadius: "10px", py: 0.75 }}
            >
              {copied ? t("creatorCardCopied", { defaultValue: "Copied!" }) : t("creatorCardCopy", { defaultValue: "Copy link" })}
            </Button>
            <Button
              size="small"
              fullWidth
              variant="contained"
              href={publicUrl}
              target="_blank"
              rel="noopener"
              disableElevation
              data-testid="creator-card-view"
              endIcon={<Icon icon="mdi:open-in-new" width={14} />}
              sx={{ textTransform: "none", fontSize: 12.5, fontWeight: 700, borderRadius: "10px", py: 0.75, backgroundColor: LIME, color: INK, "&:hover": { backgroundColor: LIME, filter: "brightness(1.05)" } }}
            >
              {t("creatorCardView", { defaultValue: "View" })}
            </Button>
          </Box>

          {/* Mini stats strip (only when at least one number is known) */}
          {(visits !== null || weekVisits !== null || supporters !== null) && (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, mt: 0.5 }}>
              {[
                { label: t("statTotalVisitsShort", { defaultValue: "Visits" }), val: visits ?? 0, icon: "mdi:eye-outline" },
                { label: t("statThisWeekShort", { defaultValue: "7d" }), val: weekVisits ?? 0, icon: "mdi:trending-up" },
                { label: t("statSupportersShort", { defaultValue: "Supporters" }), val: supporters ?? 0, icon: "mdi:heart-outline" },
              ].map((s) => (
                <Box
                  key={s.label}
                  sx={{
                    p: 1, borderRadius: "10px",
                    border: `1px solid ${theme.palette.divider}`,
                    display: "flex", flexDirection: "column", gap: 0.25,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Icon icon={s.icon} width={11} color={theme.palette.text.secondary} />
                    <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
                      {s.label}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: theme.palette.text.primary, letterSpacing: "-0.01em" }}>
                    {s.val.toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          <Button
            size="small"
            variant="text"
            onClick={() => router.push("/creator")}
            data-testid="creator-card-manage"
            sx={{ textTransform: "none", fontSize: 12, color: theme.palette.text.secondary, alignSelf: "flex-start", mt: 0.25, "&:hover": { color: theme.palette.primary.main } }}
          >
            {t("creatorCardManage", { defaultValue: "Manage page →" })}
          </Button>
        </Box>
      </PanelCard>
    );
  }

  // ── STATE 2: Has handle, NOT published (draft) ──────────────────────
  if (handle && !published) {
    return (
      <PanelCard
        title={t("creatorCardDraftTitle", { defaultValue: "Publish your creator page" })}
        subTitle={t("creatorCardDraftSubtitle", { defaultValue: "Your handle is ready. Turn on the page to accept support." })}
        showHeaderBorder={false}
        headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
        bodyPadding={theme.spacing(1.5, 2.5, 2.5, 2.5)}
      >
        <Box data-testid="creator-card-draft" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box
            sx={{
              display: "flex", alignItems: "center", gap: 1,
              px: 1.5, py: 1.25, borderRadius: "10px",
              backgroundColor: limeTint,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Icon icon="mdi:link-variant-off" width={16} color={theme.palette.text.secondary} />
            <Typography sx={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: theme.palette.text.primary, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {prettyUrl}
            </Typography>
          </Box>
          <Button
            variant="contained"
            disableElevation
            fullWidth
            onClick={() => router.push("/creator")}
            data-testid="creator-card-publish"
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", py: 1, fontSize: 13.5, backgroundColor: LIME, color: INK, "&:hover": { backgroundColor: LIME, filter: "brightness(1.05)" } }}
          >
            {t("creatorCardGoLive", { defaultValue: "Go live" })}
          </Button>
        </Box>
      </PanelCard>
    );
  }

  // ── STATE 1: No handle yet — biggest opportunity, boldest CTA ───────
  return (
    <PanelCard
      title={t("creatorCardClaimTitle", { defaultValue: "Claim your creator page" })}
      subTitle={t("creatorCardClaimSubtitle", { defaultValue: "One link for tips & payments." })}
      showHeaderBorder={false}
      headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
      bodyPadding={theme.spacing(1.5, 2.5, 2.5, 2.5)}
    >
      <Box data-testid="creator-card-claim" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box
          sx={{
            p: 1.5, borderRadius: "12px",
            border: `1px dashed ${theme.palette.divider}`,
            backgroundColor: limeTint,
            display: "flex", alignItems: "center", gap: 1,
          }}
        >
          <Icon icon="mdi:auto-awesome" width={18} color={isDark ? LIME : INK} />
          <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: theme.palette.text.primary, flex: 1, minWidth: 0 }}>
            {siteUrl.replace(/^https?:\/\//, "")}/<Box component="span" sx={{ color: theme.palette.text.secondary }}>yourname</Box>
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
          {[
            { icon: "mdi:heart-outline", label: t("creatorBenefit1", { defaultValue: "Collect tips" }) },
            { icon: "mdi:link-variant", label: t("creatorBenefit2", { defaultValue: "One link for all your pay links" }) },
            { icon: "mdi:share-variant", label: t("creatorBenefit3", { defaultValue: "Share on socials in one tap" }) },
          ].map((b) => (
            <Box key={b.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Icon icon={b.icon} width={13} color={theme.palette.text.secondary} />
              <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary }}>{b.label}</Typography>
            </Box>
          ))}
        </Box>

        <Button
          variant="contained"
          disableElevation
          fullWidth
          onClick={() => router.push("/creator")}
          data-testid="creator-card-claim-cta"
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", py: 1, fontSize: 13.5, backgroundColor: LIME, color: INK, "&:hover": { backgroundColor: LIME, filter: "brightness(1.05)" } }}
        >
          {t("creatorCardClaimCta", { defaultValue: "Claim my handle" })}
        </Button>
      </Box>
    </PanelCard>
  );
};

export default CreatorPageCard;
