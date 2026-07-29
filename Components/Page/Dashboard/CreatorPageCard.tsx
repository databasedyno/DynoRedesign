import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, InputBase, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import PanelCard from "@/Components/UI/PanelCard";
import { rootReducer } from "@/utils/types";
import { buildCreatorUrl, prettyCreatorUrl, prettyCreatorDomain } from "@/helpers/creatorUrl";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import HandleQrCode from "@/Components/Page/Creator/HandleQrCode";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';
// Session 82: LIME const preserves the name but now holds aurora indigo #4F46E5
const LIME = "#4F46E5";
const INK = "#0A0A0B";
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

interface CreatorStats {
  total_visits: number;
  this_week_visits: number;
  supporters_count: number;
  top_referrers: Array<{ domain: string; clicks: number }>;
  daily_visits: Array<{ date: string; count: number }>;
  has_handle: boolean;
}

/**
 * Dashboard right-column card that surfaces the Creator page feature.
 * Session 60 upgrades:
 *   - State 1 (no handle): inline "Reserve" input with availability check
 *   - State 3 (live): now shows top referrers + 14d sparkline + analytics dialog
 *   - QR code button (opens dialog) on live state
 */
const CreatorPageCard: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation("dashboardLayout");
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;

  const siteUrl = prettyCreatorDomain();
  const handle = profile?.handle || "";
  const published = Boolean(profile?.creator_page_enabled);
  const publicUrl = buildCreatorUrl(handle);
  const prettyUrl = prettyCreatorUrl(handle);
  const accentColor = profile?.theme_accent_color || LIME;

  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // ── Inline "Reserve my handle" state (State 1) ──
  const [claimDraft, setClaimDraft] = useState("");
  const [claimChecking, setClaimChecking] = useState(false);
  const [claimAvail, setClaimAvail] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [claiming, setClaiming] = useState(false);
  // Persistent confirmation: the handle the user just reserved this session.
  // Set immediately on a successful reserve so the "it's yours" confirmation
  // shows even before the profile refetch lands (no reliance on refetch timing).
  const [justReserved, setJustReserved] = useState<string | null>(null);
  const claimDebRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill the reserve input with a handle the visitor claimed on the landing
  // hero (persisted in localStorage during signup), so the username carries all
  // the way through to the actual claim step. Only when no handle is set yet and
  // the user hasn't started typing their own.
  useEffect(() => {
    if (handle || claimDraft) return;
    try {
      const pending = localStorage.getItem("dynopay.claimedHandle") || "";
      const clean = pending.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
      if (clean.length >= 3) setClaimDraft(clean);
    } catch {
      /* ignore storage errors */
    }
  }, [handle]);

  const claimFormatError = useMemo(() => {
    if (!claimDraft) return null;
    if (!HANDLE_RE.test(claimDraft)) return "3–30 chars: lowercase letters, numbers, - or _ (start with a letter/number)";
    return null;
  }, [claimDraft]);

  useEffect(() => {
    // Stats are only meaningful once a handle is set & page is live.
    if (!handle || !published) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axiosBaseApi.get("/user/creator/stats");
        if (cancelled) return;
        const d = r?.data?.data || {};
        setStats({
          total_visits: Number(d.total_visits || 0),
          this_week_visits: Number(d.this_week_visits || 0),
          supporters_count: Number(d.supporters_count || 0),
          top_referrers: Array.isArray(d.top_referrers) ? d.top_referrers : [],
          daily_visits: Array.isArray(d.daily_visits) ? d.daily_visits : [],
          has_handle: Boolean(d.has_handle),
        });
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

  // Debounced availability check for the inline claim input
  useEffect(() => {
    if (claimDebRef.current) clearTimeout(claimDebRef.current);
    setClaimAvail(null);
    const h = claimDraft.trim().toLowerCase();
    if (!h || claimFormatError) return;
    setClaimChecking(true);
    claimDebRef.current = setTimeout(async () => {
      try {
        const tok = (typeof window !== "undefined" && localStorage.getItem("dynopay.claimedHandleToken")) || "";
        const r = await axiosBaseApi.get(
          `/user/creator/check-handle?handle=${encodeURIComponent(h)}${tok ? `&token=${encodeURIComponent(tok)}` : ""}`,
        );
        setClaimAvail(r?.data?.data || null);
      } catch {
        setClaimAvail(null);
      } finally {
        setClaimChecking(false);
      }
    }, 400);
    return () => { if (claimDebRef.current) clearTimeout(claimDebRef.current); };
  }, [claimDraft, claimFormatError]);

  const reserveHandle = async () => {
    if (!claimDraft || claimFormatError || claimAvail?.available !== true) return;
    const reserved = claimDraft.trim().toLowerCase();
    setClaiming(true);
    try {
      const reservationToken =
        (typeof window !== "undefined" && localStorage.getItem("dynopay.claimedHandleToken")) || undefined;
      await axiosBaseApi.put("/user/creator/profile", {
        handle: reserved,
        handle_reservation_token: reservationToken,
      });
      // Show the persistent confirmation immediately (optimistic) so the user
      // unmistakably knows the name is reserved — independent of the refetch.
      setJustReserved(reserved);
      try {
        // Landing-page claim fulfilled — clear the carried handle + token.
        localStorage.removeItem("dynopay.claimedHandle");
        localStorage.removeItem("dynopay.claimedHandleToken");
      } catch {
        /* ignore */
      }
      dispatch({
        type: TOAST_SHOW,
        payload: { message: `Reserved! ${siteUrl}/${reserved} is yours 🎉` },
      });
      dispatch(UserAction(USER_PROFILE_FETCH));
    } catch (e: any) {
      dispatch({ type: TOAST_SHOW, payload: { message: e?.response?.data?.message || "Could not reserve handle", severity: "error" } });
    } finally {
      setClaiming(false);
    }
  };

  // Common panel wrapper for the 3 states
  const isDark = theme.palette.mode === "dark";
  const accentTint = isDark ? `${accentColor}14` : `${accentColor}1F`;
  const border = theme.palette.divider;

  // ── STATE 3: Published (has handle + published) ─────────────────────
  if (handle && published) {
    const totalVisits = stats?.total_visits ?? 0;
    const weekVisits = stats?.this_week_visits ?? 0;
    const supporters = stats?.supporters_count ?? 0;
    const topReferrers = stats?.top_referrers || [];
    const daily = stats?.daily_visits || [];
    const maxDaily = Math.max(1, ...daily.map((d) => d.count));

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
              backgroundColor: accentTint,
              border: `1px solid ${border}`,
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
              {copied ? t("creatorCardCopied", { defaultValue: "Copied!" }) : t("creatorCardCopy", { defaultValue: "Copy" })}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setQrOpen(true)}
              data-testid="creator-card-qr"
              startIcon={<Icon icon="mdi:qrcode" width={15} />}
              sx={{ textTransform: "none", fontSize: 12.5, fontWeight: 600, borderRadius: "10px", py: 0.75, minWidth: 68 }}
              title={t("creatorCardQrTitle", { defaultValue: "Show QR code" })}
            >
              QR
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
              sx={{ textTransform: "none", fontSize: 12.5, fontWeight: 700, borderRadius: "10px", py: 0.75, backgroundColor: accentColor, color: INK, "&:hover": { backgroundColor: accentColor, filter: "brightness(1.05)" } }}
            >
              {t("creatorCardView", { defaultValue: "View" })}
            </Button>
          </Box>

          {/* Mini stats strip */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, mt: 0.5 }}>
            {[
              { label: t("statTotalVisitsShort", { defaultValue: "Visits" }), val: totalVisits, icon: "mdi:eye-outline" },
              { label: t("statThisWeekShort", { defaultValue: "7d" }), val: weekVisits, icon: "mdi:trending-up" },
              { label: t("statSupportersShort", { defaultValue: "Supporters" }), val: supporters, icon: "mdi:heart-outline" },
            ].map((s) => (
              <Box
                key={s.label}
                sx={{
                  p: 1, borderRadius: "10px",
                  border: `1px solid ${border}`,
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

          {/* 14-day sparkline (Session 60) */}
          {daily.length > 0 && (
            <Box
              data-testid="creator-card-sparkline"
              sx={{
                mt: 0.25,
                p: 1.25,
                borderRadius: "10px",
                border: `1px solid ${border}`,
                display: "flex", flexDirection: "column", gap: 0.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
                  {t("creatorCardSparklineLabel", { defaultValue: "Visits · Last 14 days" })}
                </Typography>
                <Icon icon="mdi:chart-line" width={12} color={theme.palette.text.secondary} />
              </Box>
              <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", height: 32, mt: 0.25 }}>
                {daily.map((d) => {
                  const pct = Math.max(4, Math.round((d.count / maxDaily) * 100));
                  return (
                    <Box
                      key={d.date}
                      title={`${d.date}: ${d.count}`}
                      sx={{
                        flex: 1,
                        height: `${pct}%`,
                        borderRadius: "3px 3px 0 0",
                        backgroundColor: d.count > 0 ? accentColor : theme.palette.divider,
                        opacity: d.count > 0 ? 1 : 0.6,
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Top referrers (Session 60) */}
          {topReferrers.length > 0 && (
            <Box
              data-testid="creator-card-referrers"
              sx={{
                p: 1.25,
                borderRadius: "10px",
                border: `1px solid ${border}`,
                display: "flex", flexDirection: "column", gap: 0.6,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
                  {t("creatorCardTopReferrers", { defaultValue: "Top referrers" })}
                </Typography>
                <Icon icon="mdi:share-outline" width={12} color={theme.palette.text.secondary} />
              </Box>
              {topReferrers.slice(0, 3).map((r, i) => (
                <Box key={r.domain} data-testid={`creator-referrer-${i}`} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography sx={{ fontSize: 12, color: theme.palette.text.primary, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {r.domain}
                  </Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: theme.palette.text.primary }}>
                    {r.clicks.toLocaleString()}
                  </Typography>
                </Box>
              ))}
              {topReferrers.length > 3 && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setAnalyticsOpen(true)}
                  data-testid="creator-view-analytics"
                  sx={{
                    textTransform: "none",
                    fontSize: 11.5,
                    alignSelf: "flex-start",
                    p: 0,
                    minWidth: 0,
                    color: theme.palette.text.secondary,
                    "&:hover": { color: theme.palette.primary.main, backgroundColor: "transparent" },
                    // Session 75 P1 fix — WCAG 2.5.5: mobile-only 44px tap
                    // target so text-only "→" CTAs are as reachable as icon
                    // buttons. Desktop retains its compact typographic feel.
                    minHeight: { xs: "44px", md: "auto" },
                    px: { xs: "8px", md: 0 },
                    ml: { xs: "-8px", md: 0 },
                  }}
                >
                  {t("creatorViewAnalytics", { defaultValue: "See all referrers →" })}
                </Button>
              )}
            </Box>
          )}

          <Button
            size="small"
            variant="text"
            onClick={() => router.push("/creator")}
            data-testid="creator-card-manage"
            sx={{
              textTransform: "none",
              fontSize: 12,
              color: theme.palette.text.secondary,
              alignSelf: "flex-start",
              mt: 0.25,
              "&:hover": { color: theme.palette.primary.main },
              // Session 75 P1 fix — WCAG 2.5.5 mobile touch target.
              minHeight: { xs: "44px", md: "auto" },
              px: { xs: "8px", md: 0 },
              ml: { xs: "-8px", md: 0 },
            }}
          >
            {t("creatorCardManage", { defaultValue: "Manage page →" })}
          </Button>
        </Box>

        {/* QR Dialog */}
        <Dialog open={qrOpen} onClose={() => setQrOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Icon icon="mdi:qrcode-scan" width={20} /> Your QR code
          </DialogTitle>
          <DialogContent>
            <HandleQrCode handle={handle} size="full" accentColor={accentColor} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setQrOpen(false)} sx={{ textTransform: "none" }}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Analytics Dialog (full referrer list) */}
        <Dialog open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }} data-testid="creator-analytics-dialog">
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Icon icon="mdi:chart-arc" width={20} /> Vanity link analytics
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                <Box sx={{ p: 1.25, borderRadius: "10px", border: `1px solid ${border}` }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary }}>Total visits</Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: 22, fontWeight: 800 }}>{totalVisits.toLocaleString()}</Typography>
                </Box>
                <Box sx={{ p: 1.25, borderRadius: "10px", border: `1px solid ${border}` }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary }}>Last 7 days</Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: 22, fontWeight: 800 }}>{weekVisits.toLocaleString()}</Typography>
                </Box>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary, mb: 0.75 }}>
                  Referrers ({topReferrers.length})
                </Typography>
                {topReferrers.length === 0 && (
                  <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>
                    No referrer data yet — visits will start showing up here as your link is shared.
                  </Typography>
                )}
                {topReferrers.map((r) => (
                  <Box key={r.domain} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.5, borderBottom: `1px solid ${border}` }}>
                    <Typography sx={{ fontSize: 13, color: theme.palette.text.primary }}>{r.domain}</Typography>
                    <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>{r.clicks.toLocaleString()}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAnalyticsOpen(false)} sx={{ textTransform: "none" }}>Close</Button>
          </DialogActions>
        </Dialog>
      </PanelCard>
    );
  }

  // ── STATE 2: Handle reserved, NOT published yet ─────────────────────
  // Uses `justReserved` as a fallback so the confirmation appears the instant
  // a reserve succeeds, even before the profile refetch updates `handle`.
  const reservedHandle = handle || justReserved || "";
  if (reservedHandle && !published) {
    const reservedPretty = prettyCreatorUrl(reservedHandle);
    const reservedUrl = buildCreatorUrl(reservedHandle);
    const copyReserved = () => {
      if (!reservedUrl) return;
      navigator.clipboard?.writeText(reservedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    return (
      <PanelCard
        title={t("creatorCardDraftTitle", { defaultValue: "Your handle is reserved" })}
        subTitle={t("creatorCardDraftSubtitle", { defaultValue: "It's locked to your account. Publish to start accepting support." })}
        showHeaderBorder={false}
        headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
        bodyPadding={theme.spacing(1.5, 2.5, 2.5, 2.5)}
      >
        <Box data-testid="creator-card-draft" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* Persistent "reserved — it's yours" confirmation */}
          <Box
            data-testid="creator-card-reserved-confirm"
            sx={{
              display: "flex", alignItems: "center", gap: 1.25,
              px: 1.5, py: 1.5, borderRadius: "12px",
              backgroundColor: isDark ? "rgba(46,204,113,0.12)" : "rgba(46,204,113,0.10)",
              border: `1px solid ${isDark ? "rgba(46,204,113,0.35)" : "rgba(46,204,113,0.30)"}`,
            }}
          >
            <Icon icon="mdi:check-decagram" width={26} color="#22B573" />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: theme.palette.text.primary, lineHeight: 1.2 }}>
                {t("creatorReservedTitle", { defaultValue: "Reserved — it's yours!" })}
              </Typography>
              <Typography
                data-testid="creator-card-reserved-url"
                sx={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: theme.palette.text.secondary, mt: 0.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {reservedPretty}
              </Typography>
            </Box>
          </Box>

          {/* Copy + Go live */}
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={copyReserved}
              data-testid="creator-card-reserved-copy"
              startIcon={<Icon icon={copied ? "mdi:check" : "mdi:content-copy"} width={15} />}
              sx={{ textTransform: "none", fontSize: 12.5, fontWeight: 600, borderRadius: "10px", py: 0.85, minWidth: 108 }}
            >
              {copied ? t("creatorCardCopied", { defaultValue: "Copied!" }) : t("creatorCardCopyLink", { defaultValue: "Copy link" })}
            </Button>
            <Button
              variant="contained"
              disableElevation
              fullWidth
              onClick={() => router.push("/creator")}
              data-testid="creator-card-publish"
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", py: 0.85, fontSize: 13.5, backgroundColor: accentColor, color: INK, "&:hover": { backgroundColor: accentColor, filter: "brightness(1.05)" } }}
            >
              {t("creatorCardGoLive", { defaultValue: "Publish page" })}
            </Button>
          </Box>
        </Box>
      </PanelCard>
    );
  }

  // ── STATE 1: No handle yet — inline claim (Session 60 upgrade) ───────
  const availState: "idle" | "checking" | "available" | "taken" =
    !claimDraft ? "idle"
    : claimChecking ? "checking"
    : claimAvail?.available ? "available"
    : claimAvail?.available === false ? "taken"
    : "idle";

  return (
    <PanelCard
      title={t("creatorCardClaimTitle", { defaultValue: "Claim your creator page" })}
      subTitle={t("creatorCardClaimSubtitle", { defaultValue: "One link for tips & payments." })}
      showHeaderBorder={false}
      headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
      bodyPadding={theme.spacing(1.5, 2.5, 2.5, 2.5)}
    >
      <Box data-testid="creator-card-claim" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {/* Inline claim input with live URL preview */}
        <Box
          sx={{
            p: 1.5, borderRadius: "12px",
            border: `1px dashed ${claimFormatError || availState === "taken" ? theme.palette.error.main : border}`,
            backgroundColor: accentTint,
            display: "flex", alignItems: "center", gap: 0.5,
          }}
        >
          <Icon icon="mdi:auto-awesome" width={18} color={isDark ? accentColor : INK} />
          <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: theme.palette.text.secondary, whiteSpace: "nowrap" }}>
            {siteUrl.replace(/^https?:\/\//, "")}/
          </Typography>
          <InputBase
            value={claimDraft}
            onChange={(e) => setClaimDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30))}
            onKeyDown={(e) => { if (e.key === "Enter" && availState === "available") reserveHandle(); }}
            placeholder="yourname"
            data-testid="creator-card-claim-input"
            sx={{
              flex: 1, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: theme.palette.text.primary,
              "& input": { p: 0 },
              "& input::placeholder": { color: theme.palette.text.disabled, opacity: 1 },
            }}
            inputProps={{ "aria-label": "Your handle", spellCheck: false, autoComplete: "off" }}
          />
          {availState === "checking" && <Icon icon="mdi:loading" className="mdi-spin" width={16} color={theme.palette.text.secondary} />}
          {availState === "available" && <Icon icon="mdi:check-circle" width={16} color={theme.palette.success.main} />}
          {availState === "taken" && <Icon icon="mdi:close-circle" width={16} color={theme.palette.error.main} />}
        </Box>

        {claimFormatError && (
          <Typography sx={{ fontSize: 11.5, color: theme.palette.error.main, mt: -0.75 }}>
            {claimFormatError}
          </Typography>
        )}
        {!claimFormatError && availState === "taken" && (
          <Typography sx={{ fontSize: 11.5, color: theme.palette.error.main, mt: -0.75 }}>
            {claimAvail?.reason || "Already taken"}
          </Typography>
        )}
        {!claimFormatError && availState === "available" && (
          <Typography sx={{ fontSize: 11.5, color: theme.palette.success.main, mt: -0.75 }}>
            ✓ Available — reserve it now!
          </Typography>
        )}

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
          disabled={claiming || availState !== "available"}
          onClick={reserveHandle}
          data-testid="creator-card-reserve-cta"
          startIcon={claiming ? <Icon icon="mdi:loading" className="mdi-spin" width={16} /> : <Icon icon="mdi:bookmark-check" width={16} />}
          sx={{
            textTransform: "none", fontWeight: 700, borderRadius: "10px", py: 1, fontSize: 13.5,
            backgroundColor: accentColor, color: INK,
            "&:hover": { backgroundColor: accentColor, filter: "brightness(1.05)" },
            "&.Mui-disabled": { backgroundColor: theme.palette.action.disabledBackground, color: theme.palette.action.disabled },
          }}
        >
          {claiming
            ? t("creatorCardReserving", { defaultValue: "Reserving…" })
            : t("creatorCardReserveCta", { defaultValue: "Reserve my handle" })}
        </Button>

        <Button
          size="small"
          variant="text"
          onClick={() => router.push("/creator")}
          data-testid="creator-card-full-setup"
          sx={{ textTransform: "none", fontSize: 12, color: theme.palette.text.secondary, alignSelf: "center", mt: -0.5, "&:hover": { color: theme.palette.primary.main } }}
        >
          {t("creatorCardFullSetup", { defaultValue: "Full setup on /creator →" })}
        </Button>
      </Box>
    </PanelCard>
  );
};

export default CreatorPageCard;
