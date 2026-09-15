import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Box, Button, CircularProgress, Switch, Typography, useTheme, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { Icon } from "@iconify/react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation, Trans } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useImageDrop } from "@/hooks/useImageDrop";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import { getCreatorBaseUrl } from "@/helpers/creatorUrl";
import { isPlaceholderBrandName } from "@/helpers/brandName";
import CreatorThemePicker, { CreatorTheme, CoverStyle } from "@/Components/Page/Creator/CreatorThemePicker";
import HandleQrCode from "@/Components/Page/Creator/HandleQrCode";
import AnalyticsWidget, { CreatorAnalyticsData } from "@/Components/Page/Creator/AnalyticsWidget";
import { BRAND_ACCENT, brandFg } from "@/constants/theme";
import { SUPPORTED_FIAT_CURRENCIES } from "@/constants/currencies";
import { API_ENDPOINTS } from "@/api/endpoints";
import useDebounce from "@/hooks/useDebounce";
import useCopyToClipboard from "@/hooks/useCopyToClipboard";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export interface CreatorFormState {
  handle: string;
  bio: string;
  enabled: boolean;
  coverImage: string | null;
  socialLinks: Record<string, string>;
  // Support Widget (always-on tip / coffee / support box on the public page)
  swEnabled: boolean;
  swStyle: SupportStyle;
  swLabel: string;
  swPresets: number[];
  swCurrency: string;
  swMinAmount: number;
  swAllowMessage: boolean;
  swThanks: string;
  swShowSupporters: boolean;
  swShowWall?: boolean;
  swMonthlyGoal?: string;
  // Store visibility (Session 2026-08-26)
  storeEnabled: boolean;
  showProductsOnPage: boolean;
  // Custom theme (Session 60) — mirrored to the live preview so it renders
  // exactly what CreatorProfile publishes (accent / cover style / gradient).
  accentColor: string | null;
  coverStyle: CoverStyle | null;
  coverGradient: string | null;
}

type SupportStyle = "coffee" | "tip" | "support";

const SUPPORT_STYLES: { key: SupportStyle; label: string; icon: string; sample: string }[] = [
  { key: "coffee", label: "Buy me a coffee", icon: "mdi:coffee", sample: "Buy me a coffee" },
  { key: "tip", label: "Send a tip", icon: "mdi:hand-coin", sample: "Send a tip" },
  { key: "support", label: "Support me", icon: "mdi:heart", sample: "Support me" },
];

const SUPPORT_CURRENCIES = SUPPORTED_FIAT_CURRENCIES;

interface Props {
  /** Notified on every form change so the live preview outside can mirror. */
  onChange?: (s: CreatorFormState) => void;
}

const SOCIAL_PLATFORMS = [
  { key: "twitter",   label: "Twitter / X",  icon: "mdi:twitter",     placeholder: "@yourname or full URL" },
  { key: "instagram", label: "Instagram",     icon: "mdi:instagram",   placeholder: "@yourname or full URL" },
  { key: "youtube",   label: "YouTube",       icon: "mdi:youtube",     placeholder: "channel URL" },
  { key: "tiktok",    label: "TikTok",        icon: "mdi:music-note",  placeholder: "@yourname or full URL" },
  { key: "telegram",  label: "Telegram",      icon: "mdi:telegram",    placeholder: "@yourname or t.me/yourname" },
  { key: "facebook",  label: "Facebook",      icon: "mdi:facebook",    placeholder: "page URL or username" },
  { key: "website",   label: "Website",       icon: "mdi:web",         placeholder: "https://yourwebsite.com" },
] as const;

type PlatformKey = typeof SOCIAL_PLATFORMS[number]["key"];

const CreatorPageSettings: React.FC<Props> = ({ onChange }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const dispatch = useDispatch();
  const reduxProfile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;
  const selectedCompanyId = useSelectedCompanyId();
  // Storefront-per-company: read the ACTIVE company's storefront settings from
  // the backend (resolves to the company when the flag is ON, else the account).
  // Keyed by company so switching companies reloads that company's page.
  const { data: storefrontData, mutate: mutateStorefront } = useSWR(
    ["user/creator/profile", selectedCompanyId],
    async () => {
      const r = await axiosBaseApi.get("user/creator/profile");
      return (r?.data?.data ?? null) as any;
    },
  );
  const profile = (storefrontData ?? reduxProfile) as any;

  const siteUrl = getCreatorBaseUrl();
  const border = theme.palette.divider;

  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [uploadingCover, setUploadingCover] = useState(false);
  // ── Custom Creator Theme state (Session 60) ──
  const [themeAccent, setThemeAccent] = useState<string | null>(null);
  const [themeCoverStyle, setThemeCoverStyle] = useState<CoverStyle | null>(null);
  const [themeCoverGradient, setThemeCoverGradient] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  // ── Support Widget state ──
  const [swEnabled, setSwEnabled] = useState(false);
  const [swStyle, setSwStyle] = useState<SupportStyle>("coffee");
  const [swLabel, setSwLabel] = useState("");
  const [swPresets, setSwPresets] = useState<number[]>([10, 25, 50, 100]);
  const [swPresetDraft, setSwPresetDraft] = useState("");
  const [swCurrency, setSwCurrency] = useState("USD");
  const [swMinAmount, setSwMinAmount] = useState(10);
  const [swAllowMessage, setSwAllowMessage] = useState(true);
  const [swThanks, setSwThanks] = useState("");
  const [swShowSupporters, setSwShowSupporters] = useState(true);
  const [swShowWall, setSwShowWall] = useState(false);
  const [swMonthlyGoal, setSwMonthlyGoal] = useState<string>("");
  // ── Public Analytics widget (Session 2026-08-05) ──
  // Controls whether the 30-day tips chart + top supporters is publicly
  // visible on the creator's /:handle page. Merchant always sees their own
  // analytics in the panel below regardless of this toggle.
  const [publicAnalyticsEnabled, setPublicAnalyticsEnabled] = useState(true);
  // Store visibility (Session 2026-08-26)
  const [storeEnabled, setStoreEnabled] = useState(true);
  const [showProductsOnPage, setShowProductsOnPage] = useState(true);
  // analyticsData / analyticsLoading are SWR-derived below (keyed by handle).
  const [analyticsTogglingBusy, setAnalyticsTogglingBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  // Change-warning modal for handle edits (spec §C — Doc 3)
  const [handleWarnOpen, setHandleWarnOpen] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const handleInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Ensure the account profile is loaded even when landing directly on this page
  useEffect(() => {
    if (!reduxProfile?.user_id) dispatch(UserAction(USER_PROFILE_FETCH));
  }, [dispatch, reduxProfile?.user_id]);

  // Re-seed the form when the selected company changes (storefront-per-company).
  useEffect(() => {
    setSeeded(false);
  }, [selectedCompanyId]);

  // Seed from the active storefront once loaded (waits for the SWR fetch).
  useEffect(() => {
    if (storefrontData !== undefined && !seeded) {
      const p = (storefrontData || {}) as any;
      setHandle(p.handle || "");
      setName(p.name || "");
      setBio(p.bio || "");
      setEnabled(Boolean(p.creator_page_enabled));
      setCoverImage(p.cover_image || null);
      setSocialLinks(
        (p.social_links && typeof p.social_links === "object") ? p.social_links : {},
      );
      // Support Widget seed
      setSwEnabled(Boolean(p.support_widget_enabled));
      setSwStyle(
        ["coffee", "tip", "support"].includes(p.support_widget_style)
          ? p.support_widget_style
          : "coffee",
      );
      setSwLabel(p.support_widget_label || "");
      setSwPresets(
        Array.isArray(p.support_widget_preset_amounts) && p.support_widget_preset_amounts.length
          ? p.support_widget_preset_amounts.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
          : [10, 25, 50],
      );
      setSwCurrency(p.support_widget_currency || "USD");
      setSwMinAmount(Math.max(10, Number(p.support_widget_min_amount) || 0));
      setSwAllowMessage(p.support_widget_allow_message !== false);
      setSwThanks(p.support_widget_thanks_message || "");
      setSwShowSupporters(p.support_widget_show_supporters !== false);
      setSwShowWall(p.support_widget_show_wall === true);
      setSwMonthlyGoal(p.support_widget_monthly_goal != null && Number(p.support_widget_monthly_goal) > 0 ? String(Number(p.support_widget_monthly_goal)) : "");
      setPublicAnalyticsEnabled(p.public_analytics_enabled !== false);
      setStoreEnabled(p.store_enabled !== false);
      setShowProductsOnPage(p.creator_page_show_products !== false);
      // Theme (Session 60)
      setThemeAccent(p.theme_accent_color || null);
      setThemeCoverStyle((p.theme_cover_style as CoverStyle) || null);
      setThemeCoverGradient(p.theme_cover_gradient || null);
      setSeeded(true);
    }
  }, [storefrontData, seeded]);

  // Broadcast form state to parent (for the live preview)
  useEffect(() => {
    onChange?.({
      handle, bio, enabled, coverImage, socialLinks,
      swEnabled, swStyle, swLabel, swPresets, swCurrency, swMinAmount, swAllowMessage, swThanks, swShowSupporters, swShowWall, swMonthlyGoal,
      storeEnabled, showProductsOnPage,
      name,
      // Theme (Session 60) — so the live preview matches the published page.
      accentColor: themeAccent, coverStyle: themeCoverStyle, coverGradient: themeCoverGradient,
    } as any);
  }, [handle, name, bio, enabled, coverImage, socialLinks, swEnabled, swStyle, swLabel, swPresets, swCurrency, swMinAmount, swAllowMessage, swThanks, swShowSupporters, swShowWall, swMonthlyGoal, storeEnabled, showProductsOnPage, themeAccent, themeCoverStyle, themeCoverGradient, onChange]);

  // Open + reveal the tip box (Support Widget) when the dashboard "Set up tips" CTA fires.
  useEffect(() => {
    const open = () => {
      setSwEnabled(true);
      requestAnimationFrame(() => {
        document
          .getElementById("support-widget")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };
    window.addEventListener("dynopay:open-tip-setup", open);
    return () => window.removeEventListener("dynopay:open-tip-setup", open);
  }, []);

  // Fetch the merchant's own analytics data (30-day chart + top supporters
  // + lifetime totals). The endpoint always returns data for the merchant
  // regardless of public toggle. Refetch when the profile handle changes.
  // Merchant analytics (30-day chart + top supporters + lifetime totals) —
  // SWR-backed, keyed by handle so switching profile refetches and the result
  // is cached across re-mounts. Auto-refetches when the handle changes, exactly
  // like the previous effect (no manual refresh path was used elsewhere).
  const { data: analyticsSWR, isLoading: analyticsSWRLoading } = useSWR<
    (CreatorAnalyticsData & { has_handle?: boolean }) | null
  >(
    profile?.handle ? ["creator-analytics", profile.handle] : null,
    async () => {
      const r = await axiosBaseApi.get(API_ENDPOINTS.creator.analytics);
      return (r?.data?.data || null) as
        | (CreatorAnalyticsData & { has_handle?: boolean })
        | null;
    },
    { dedupingInterval: 30_000 },
  );
  const analyticsData = analyticsSWR ?? null;
  const analyticsLoading = profile?.handle
    ? analyticsSWRLoading && analyticsSWR === undefined
    : false;


  const savedHandle = profile?.handle || "";
  const formatError = useMemo(() => {
    if (!handle) return null;
    if (!HANDLE_RE.test(handle)) return "3–30 chars: lowercase letters, numbers, - or _ (start with a letter/number)";
    return null;
  }, [handle]);

  // Debounced availability check (useDebounce shared hook)
  const debouncedHandle = useDebounce(handle, 400);

  // Show the spinner immediately as the user types (before the debounce settles).
  useEffect(() => {
    const h = handle.trim().toLowerCase();
    setAvailability(null);
    setChecking(Boolean(h && !formatError && h !== savedHandle));
  }, [handle, formatError, savedHandle]);

  // Fire the availability check once typing settles.
  useEffect(() => {
    const h = debouncedHandle.trim().toLowerCase();
    if (!h || formatError || h === savedHandle) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await axiosBaseApi.get(`${API_ENDPOINTS.creator.checkHandle}?handle=${encodeURIComponent(h)}`);
        if (!cancelled) setAvailability(r?.data?.data || null);
      } catch {
        if (!cancelled) setAvailability(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedHandle, formatError, savedHandle]);

  const socialsEqualSaved = useMemo(() => {
    const saved = (profile?.social_links && typeof profile.social_links === "object") ? profile.social_links : {};
    const keys = new Set([...Object.keys(saved), ...Object.keys(socialLinks)]);
    for (const k of Array.from(keys)) {
      if ((saved[k] || "") !== (socialLinks[k] || "")) return false;
    }
    return true;
  }, [socialLinks, profile?.social_links]);

  const savedPresets = useMemo(() => {
    const p = profile?.support_widget_preset_amounts;
    return Array.isArray(p) && p.length ? p.map((n: unknown) => Number(n)) : [10, 25, 50];
  }, [profile?.support_widget_preset_amounts]);

  const supportWidgetChanged = useMemo(() => (
    swEnabled !== Boolean(profile?.support_widget_enabled) ||
    swStyle !== (profile?.support_widget_style || "coffee") ||
    swLabel !== (profile?.support_widget_label || "") ||
    JSON.stringify(swPresets) !== JSON.stringify(savedPresets) ||
    swCurrency !== (profile?.support_widget_currency || "USD") ||
    Number(swMinAmount) !== Math.max(10, Number(profile?.support_widget_min_amount) || 0) ||
    swAllowMessage !== (profile?.support_widget_allow_message !== false) ||
    swThanks !== (profile?.support_widget_thanks_message || "") ||
    swShowSupporters !== (profile?.support_widget_show_supporters !== false) ||
    swShowWall !== (profile?.support_widget_show_wall === true) ||
    (swMonthlyGoal.trim() ? Number(swMonthlyGoal) : null) !== (profile?.support_widget_monthly_goal != null && Number(profile.support_widget_monthly_goal) > 0 ? Number(profile.support_widget_monthly_goal) : null)
  ), [swEnabled, swStyle, swLabel, swPresets, swCurrency, swMinAmount, swAllowMessage, swThanks, swShowSupporters, swShowWall, swMonthlyGoal, savedPresets, profile]);

  const themeChanged = useMemo(() => (
    (themeAccent || null) !== (profile?.theme_accent_color || null) ||
    (themeCoverStyle || null) !== (profile?.theme_cover_style || null) ||
    (themeCoverGradient || null) !== (profile?.theme_cover_gradient || null)
  ), [themeAccent, themeCoverStyle, themeCoverGradient, profile]);

  const canSave =
    seeded &&
    !saving &&
    !!handle &&
    !formatError &&
    swPresets.length > 0 &&
    (handle === savedHandle || availability?.available === true) &&
    (
      handle !== savedHandle ||
      name !== (profile?.name || "") ||
      bio !== (profile?.bio || "") ||
      enabled !== Boolean(profile?.creator_page_enabled) ||
      (coverImage || null) !== (profile?.cover_image || null) ||
      !socialsEqualSaved ||
      supportWidgetChanged ||
      themeChanged ||
      publicAnalyticsEnabled !== (profile?.public_analytics_enabled !== false) ||
      storeEnabled !== (profile?.store_enabled !== false) ||
      showProductsOnPage !== (profile?.creator_page_show_products !== false)
    );

  // If the user changed their handle, open the change-warning modal first
  // so they explicitly acknowledge that old-URL shares will break. Fall
  // through to persistProfile() when there's no change or they confirmed.
  const handleSaveClick = () => {
    if (!canSave) return;
    if (handle !== savedHandle && savedHandle) {
      setHandleWarnOpen(true);
      return;
    }
    void persistProfile();
  };

  const persistProfile = async () => {
    setHandleWarnOpen(false);
    setSaving(true);
    const normalizedHandle = handle.trim().toLowerCase();
    const isFirstReserve = !savedHandle && !!normalizedHandle;
    try {
      await axiosBaseApi.put(API_ENDPOINTS.creator.profile, {
        handle: normalizedHandle,
        name: name.trim() || null,
        bio,
        creator_page_enabled: enabled,
        cover_image: coverImage,
        social_links: socialLinks,
        support_widget_enabled: swEnabled,
        support_widget_style: swStyle,
        support_widget_label: swLabel.trim() || null,
        support_widget_preset_amounts: swPresets,
        support_widget_currency: swCurrency.trim().toUpperCase(),
        support_widget_min_amount: Math.max(10, Number(swMinAmount) || 10),
        support_widget_allow_message: swAllowMessage,
        support_widget_thanks_message: swThanks.trim() || null,
        support_widget_show_supporters: swShowSupporters,
        support_widget_show_wall: swShowWall,
        support_widget_monthly_goal: swMonthlyGoal.trim() ? Number(swMonthlyGoal) : null,
        theme_accent_color: themeAccent,
        theme_cover_style: themeCoverStyle,
        theme_cover_gradient: themeCoverGradient,
        public_analytics_enabled: publicAnalyticsEnabled,
        store_enabled: storeEnabled,
        creator_page_show_products: showProductsOnPage,
      });
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: isFirstReserve
            ? `Reserved! ${siteUrl.replace(/^https?:\/\//, "")}/${normalizedHandle} is yours 🎉`
            : "Creator page saved",
        },
      });
      dispatch(UserAction(USER_PROFILE_FETCH));
      mutateStorefront();
    } catch (e: any) {
      dispatch({ type: TOAST_SHOW, payload: { message: e?.response?.data?.message || "Could not save", severity: "error" } });
    } finally {
      setSaving(false);
    }
  };

  // Legacy hook kept for external callers (never used internally now); routes
  // through the warning gate too.
  const handleSave = handleSaveClick;

  const publicUrl = savedHandle ? `${siteUrl}/${savedHandle}` : "";
  const prettyUrl = savedHandle ? `${siteUrl.replace(/^https?:\/\//, "")}/${savedHandle}` : "";

  const copyUrl = () => {
    if (!publicUrl) return;
    void copy(publicUrl);
  };

  // Shared cover uploader — used by the file <input>, the "Upload image"
  // button, and drag-and-drop. On success it also flips the page cover style
  // to "image" so the uploaded banner actually renders on the public page
  // (a "solid"/"gradient" style would otherwise hide it behind a lime cover).
  const uploadCoverFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      dispatch({ type: TOAST_SHOW, payload: { message: "Please choose an image file (JPEG, PNG, GIF, WebP or SVG)", severity: "error" } });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      dispatch({ type: TOAST_SHOW, payload: { message: "Image must be under 10 MB", severity: "error" } });
      return;
    }
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await axiosBaseApi.post(API_ENDPOINTS.creator.uploadCover, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = r?.data?.data?.url;
      if (url) {
        setCoverImage(url);
        setThemeCoverStyle("image");
        // Auto-save: persist the cover immediately (like the profile photo) so it
        // sticks without pressing Save — but only when the creator page already
        // exists (has a saved handle); otherwise it's saved with the first Save.
        if (savedHandle) {
          try {
            await axiosBaseApi.put(API_ENDPOINTS.creator.profile, {
              cover_image: url,
              theme_cover_style: "image",
            });
            dispatch({ type: TOAST_SHOW, payload: { message: "Cover image saved" } });
            mutateStorefront();
            dispatch(UserAction(USER_PROFILE_FETCH));
          } catch (persistErr: any) {
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: persistErr?.response?.data?.message || "Cover uploaded — press Save to keep it",
                severity: "error",
              },
            });
          }
        }
      }
    } catch (err: any) {
      dispatch({ type: TOAST_SHOW, payload: { message: err?.response?.data?.message || "Upload failed", severity: "error" } });
    } finally {
      setUploadingCover(false);
      if (coverFileRef.current) coverFileRef.current.value = "";
    }
  };

  const onCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    void uploadCoverFile(e.target.files?.[0]);
  };

  // Remove the cover — clears locally and, when the creator page already exists,
  // persists the removal immediately (matches the upload auto-save behaviour).
  const removeCover = async () => {
    setCoverImage(null);
    if (!savedHandle) return;
    try {
      await axiosBaseApi.put(API_ENDPOINTS.creator.profile, { cover_image: null });
      dispatch({ type: TOAST_SHOW, payload: { message: "Cover image removed" } });
      mutateStorefront();
      dispatch(UserAction(USER_PROFILE_FETCH));
    } catch (err: any) {
      dispatch({ type: TOAST_SHOW, payload: { message: err?.response?.data?.message || "Could not remove cover", severity: "error" } });
    }
  };

  // Drag-and-drop (shared hook): depth-counted enter/leave so the highlight
  // doesn't flicker over children, and a clear toast when the drop is a link
  // (image dragged from another site) rather than a real file.
  const { active: coverDragActive, bind: coverDropBind } = useImageDrop({
    onFile: (file) => void uploadCoverFile(file),
    disabled: uploadingCover,
    onReject: (reason) => {
      if (reason === "disabled") return;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          severity: "error",
          message:
            reason === "not-a-file"
              ? t("dropZone.notFile", { defaultValue: "Drop an image file from your computer — images dragged from other websites arrive as links and can't be uploaded." })
              : t("dropZone.notImage", { defaultValue: "Only image files can be dropped here (JPG, PNG, GIF, WebP or SVG)." }),
        },
      });
    },
  });

  const inputSx = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "10px",
    border: `1px solid ${border}`,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    "&:focus": { borderColor: theme.palette.primary.main },
  };

  const labelSx = { fontSize: 13, fontWeight: 600, color: theme.palette.text.primary, mb: 0.75, display: "block", fontFamily: "var(--font-sans)" };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-testid="creator-settings">
      {/* Live URL banner */}
      {savedHandle && (
        <Box
          sx={{
            p: 2, borderRadius: "14px", border: `1px solid ${border}`,
            backgroundColor: theme.palette.mode === "dark" ? "rgba(79,70,229,0.06)" : "rgba(79,70,229,0.10)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {profile?.creator_page_enabled ? (
              <Typography fontSize={11.5} color={theme.palette.text.secondary}>{t("storefront.yourPublicPage", { defaultValue: "Your public page" })}</Typography>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }} data-testid="creator-reserved-confirm">
                <Icon icon="mdi:check-decagram" width={15} color="#22B573" />
                <Typography fontSize={11.5} sx={{ fontWeight: 800, color: "#22B573" }}>
                  {t("storefront.form.reservedYours", { defaultValue: "Reserved — it's yours" })}
                </Typography>
              </Box>
            )}
            <Typography sx={{ fontFamily: "ui-monospace, monospace", fontSize: 14, fontWeight: 600, color: theme.palette.text.primary, wordBreak: "break-all" }}>
              {prettyUrl}
            </Typography>
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Button
              size="small"
              onClick={() => {
                handleInputRef.current?.focus();
                handleInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              data-testid="creator-edit-handle-btn"
              startIcon={<Icon icon="mdi:pencil-outline" width={15} />}
              sx={{ textTransform: "none", fontSize: 12.5, color: theme.palette.text.primary }}
              title={t("storefront.form.editHandleTitle", { defaultValue: "Edit your handle" })}
            >
              {t("storefront.form.edit", { defaultValue: "Edit" })}
            </Button>
            <Button size="small" onClick={copyUrl} data-testid="creator-copy-url" startIcon={<Icon icon={copied ? "mdi:check" : "mdi:content-copy"} width={16} />} sx={{ textTransform: "none", fontSize: 12.5, color: theme.palette.text.primary }}>
              {copied ? t("storefront.form.copied", { defaultValue: "Copied" }) : t("storefront.form.copy", { defaultValue: "Copy" })}
            </Button>
            <Button
              size="small"
              onClick={() => setQrOpen(true)}
              data-testid="creator-qr-btn"
              startIcon={<Icon icon="mdi:qrcode" width={16} />}
              sx={{ textTransform: "none", fontSize: 12.5, color: theme.palette.text.primary }}
              title={t("storefront.form.qrTitle", { defaultValue: "Show QR code" })}
            >
              QR
            </Button>
            <Button size="small" href={publicUrl} target="_blank" rel="noopener" data-testid="creator-view-page" endIcon={<Icon icon="mdi:open-in-new" width={15} />} sx={{ textTransform: "none", fontSize: 12.5, color: brandFg(theme.palette.mode === "dark") }}>
              {t("storefront.form.view", { defaultValue: "View" })}
            </Button>
          </Box>
        </Box>
      )}

      {/* Custom Theme (Session 60) */}
      <Box
        sx={{
          p: 2.5, borderRadius: "14px", border: `1px solid ${border}`,
          backgroundColor: theme.palette.background.paper,
        }}
        data-testid="creator-theme-section"
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: theme.palette.text.primary }}>
              {t("storefront.pageTheme", { defaultValue: "Page theme" })}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, mt: 0.25 }}>
              {t("storefront.pageThemeDesc", {
                defaultValue:
                  "Colors and cover style for your dynopay.com page — make it feel on-brand.",
              })}
            </Typography>
            {/* Storefront-per-company scope hint: makes it obvious the palette
                applies to the ACTIVE company only, not the whole account. */}
            <Box
              data-testid="creator-theme-scope-chip"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                mt: 0.85,
                px: 1.15,
                py: 0.35,
                borderRadius: 999,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === "dark" ? "rgba(129,140,248,0.08)" : "rgba(79,70,229,0.06)",
              }}
            >
              <Icon
                icon="mdi:storefront-outline"
                width={12}
                color={theme.palette.mode === "dark" ? "#818CF8" : "#4F46E5"}
              />
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: theme.palette.text.secondary, letterSpacing: 0.2 }}>
                {t("appliesToThisCompanyOnly", { defaultValue: "Applies to this brand only" })}
              </Typography>
            </Box>
          </Box>
          <Icon icon="mdi:palette-swatch-outline" width={24} color={theme.palette.text.secondary} />
        </Box>
        <CreatorThemePicker
          value={{ accentColor: themeAccent, coverStyle: themeCoverStyle, coverGradient: themeCoverGradient }}
          onChange={(next) => {
            setThemeAccent(next.accentColor);
            setThemeCoverStyle(next.coverStyle);
            setThemeCoverGradient(next.coverGradient);
          }}
          hasCoverImage={Boolean(coverImage)}
        />
      </Box>

      {/* QR Code Dialog */}
      <Dialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px" } }}
        data-testid="creator-qr-dialog"
      >
        <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <Icon icon="mdi:qrcode-scan" width={20} />
          {t("storefront.form.qrDialogTitle", { defaultValue: "Your QR code" })}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <HandleQrCode
            handle={savedHandle}
            size="full"
            accentColor={themeAccent || BRAND_ACCENT}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrOpen(false)} sx={{ textTransform: "none" }}>{t("storefront.form.close", { defaultValue: "Close" })}</Button>
        </DialogActions>
      </Dialog>

      {/* Cover image */}
      <Box>
        <Typography sx={labelSx}>{t("storefront.form.coverImage", { defaultValue: "Cover image" })} <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>{t("storefront.form.coverHint", { defaultValue: "(optional, recommended 1200×400)" })}</Typography></Typography>
        <Box
          data-testid="creator-cover-preview"
          onClick={() => { if (!uploadingCover) coverFileRef.current?.click(); }}
          {...coverDropBind}
          data-drag-active={coverDragActive ? "true" : "false"}
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "3 / 1",
            borderRadius: "14px",
            border: `${coverDragActive ? 2 : 1}px dashed ${coverDragActive ? theme.palette.primary.main : border}`,
            overflow: "hidden",
            cursor: uploadingCover ? "default" : "pointer",
            transition: "border-color .15s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.palette.background.default,
            backgroundImage: coverImage ? `url(${coverImage})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {!coverImage && !uploadingCover && (
            <Box sx={{ textAlign: "center", color: theme.palette.text.secondary, px: 2, pointerEvents: "none" }}>
              <Icon icon="mdi:image-plus-outline" width={26} />
              <Typography fontSize={12.5} mt={0.5}>
                {coverDragActive ? t("storefront.form.dropToUpload", { defaultValue: "Drop image to upload" }) : t("storefront.form.dragDrop", { defaultValue: "Drag & drop an image here, or click to upload (up to 10 MB)" })}
              </Typography>
            </Box>
          )}
          {uploadingCover && <CircularProgress size={22} />}
          {coverImage && !uploadingCover && (
            <Box sx={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 0.75 }}>
              <Button
                size="small"
                variant="contained"
                data-testid="creator-cover-remove"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); void removeCover(); }}
                sx={{ textTransform: "none", fontSize: 11.5, minWidth: 0, py: 0.4, px: 1, backgroundColor: "rgba(0,0,0,0.65)", color: "#fff", "&:hover": { backgroundColor: "rgba(0,0,0,0.8)" } }}
              >
                {t("storefront.form.remove", { defaultValue: "Remove" })}
              </Button>
            </Box>
          )}
        </Box>
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*"
          data-testid="creator-cover-input"
          onChange={onCoverFile}
          style={{ display: "none" }}
        />
        <Button
          size="small"
          onClick={() => coverFileRef.current?.click()}
          disabled={uploadingCover}
          startIcon={<Icon icon={coverImage ? "mdi:image-edit-outline" : "mdi:cloud-upload-outline"} width={16} />}
          sx={{ mt: 1, textTransform: "none", fontSize: 12.5 }}
          data-testid="creator-cover-upload-btn"
        >
          {coverImage ? t("storefront.form.replaceImage", { defaultValue: "Replace image" }) : t("storefront.form.uploadImage", { defaultValue: "Upload image" })}
        </Button>
      </Box>

      {/* Display name (shown as the header on your public /{handle} page) */}
      <Box>
        <Typography sx={labelSx}>{t("storefront.form.displayName", { defaultValue: "Display name" })} <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>{t("storefront.form.shownAtTop", { defaultValue: "(shown at the top of your public page)" })}</Typography></Typography>
        <Box
          component="input"
          ref={nameInputRef}
          data-testid="creator-name-input"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value.slice(0, 80))}
          placeholder="Alice Cooper"
          sx={inputSx}
        />
        <Typography fontSize={11.5} color={theme.palette.text.secondary} mt={0.5}>
          {t("storefront.form.nameHelp", { defaultValue: "Buyers see this above your handle. Leave blank to use your handle as the name." })}
        </Typography>
        {/* A1 — the auto-provisioned brand name (e-mail local part) must never be what visitors see */}
        {storefrontData?.name_is_placeholder && isPlaceholderBrandName(name, [reduxProfile?.email]) && (
          <Box
            role="alert"
            data-testid="creator-name-placeholder-warning"
            sx={{ mt: 1, display: "flex", gap: 1, alignItems: "flex-start", p: 1.25, borderRadius: "10px", border: `1px solid ${theme.palette.warning.main}`, backgroundColor: theme.palette.mode === "dark" ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.08)" }}
          >
            <Icon icon="mdi:alert-circle-outline" width={18} style={{ flexShrink: 0, marginTop: 1, color: theme.palette.warning.main }} />
            <Typography fontSize={12.5} lineHeight={1.5} color={theme.palette.text.primary}>
              {t("storefront.form.namePlaceholderWarning", {
                defaultValue: "This looks like an auto-generated name. Visitors see it as your page title, heading and share text — enter the name you want to be known by. Until then, your public page shows your account name instead.",
              })}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Handle */}
      <Box>
        <Typography sx={labelSx}>{t("storefront.form.handle", { defaultValue: "Handle" })}</Typography>
        <Box sx={{ display: "flex", alignItems: "stretch", border: `1px solid ${availability && !availability.available ? theme.palette.error.main : border}`, borderRadius: "10px", overflow: "hidden", backgroundColor: theme.palette.background.default }}>
          <Box title={`${siteUrl.replace(/^https?:\/\//, "")}/`} sx={{ display: "flex", alignItems: "center", px: 1.5, minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", fontFamily: "ui-monospace, monospace", fontSize: 13, color: theme.palette.text.secondary, whiteSpace: "nowrap" }}>
            <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{siteUrl.replace(/^https?:\/\//, "")}/</Box>
          </Box>
          <Box
            component="input"
            ref={handleInputRef}
            data-testid="creator-handle-input"
            value={handle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandle(e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="yourname"
            sx={{ flex: "1 0 45%", border: "none", outline: "none", background: "transparent", padding: "11px 12px", fontFamily: "ui-monospace, monospace", fontSize: 14, color: theme.palette.text.primary, minWidth: 0 }}
          />
          <Box sx={{ display: "flex", alignItems: "center", px: 1.5 }}>
            {checking ? <CircularProgress size={15} /> :
              handle && handle !== savedHandle && availability?.available ? <Icon icon="mdi:check-circle" width={18} color="#22c55e" /> :
              handle && availability && !availability.available ? <Icon icon="mdi:close-circle" width={18} color={theme.palette.error.main} /> : null}
          </Box>
        </Box>
        <Typography fontSize={11.5} color={formatError || (availability && !availability.available) ? theme.palette.error.main : theme.palette.text.secondary} mt={0.5} data-testid="creator-handle-hint">
          {formatError || (availability && !availability.available ? availability.reason : t("storefront.form.handleHelp", { defaultValue: "This is your unique, shareable Dynopay address." }))}
        </Typography>
      </Box>

      {/* Bio */}
      <Box>
        <Typography sx={labelSx}>{t("storefront.form.bio", { defaultValue: "Bio" })} <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>{t("storefront.form.optional", { defaultValue: "(optional)" })}</Typography></Typography>
        <Box
          component="textarea"
          rows={3}
          maxLength={500}
          data-testid="creator-bio-input"
          value={bio}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
          placeholder={t("storefront.form.bioPlaceholder", { defaultValue: "Tell visitors who you are and what you're raising for…" })}
          sx={{ ...inputSx, resize: "vertical", minHeight: 74, display: "block" }}
        />
        <Typography fontSize={10.5} color={theme.palette.text.disabled} textAlign="right" mt={0.25}>{bio.length}/500</Typography>
      </Box>

      {/* Social links */}
      <Box>
        <Typography sx={labelSx}>{t("storefront.form.socialLinks", { defaultValue: "Social links" })} <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>{t("storefront.form.optional", { defaultValue: "(optional)" })}</Typography></Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {SOCIAL_PLATFORMS.map((p) => (
            <Box key={p.key} sx={{ display: "flex", alignItems: "stretch", border: `1px solid ${border}`, borderRadius: "10px", overflow: "hidden", backgroundColor: theme.palette.background.default }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", px: 1.25, backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", minWidth: 44 }}>
                <Icon icon={p.icon} width={18} color={theme.palette.text.secondary} />
              </Box>
              <Box
                component="input"
                data-testid={`creator-social-${p.key}`}
                value={socialLinks[p.key] || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value.trim();
                  setSocialLinks((prev) => {
                    const next = { ...prev };
                    if (v) next[p.key as PlatformKey] = v;
                    else delete next[p.key as PlatformKey];
                    return next;
                  });
                }}
                placeholder={p.placeholder}
                sx={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 12px", fontFamily: "var(--font-sans)", fontSize: 13.5, color: theme.palette.text.primary, minWidth: 0 }}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Support Widget ── */}
      <Box id="support-widget" sx={{ borderRadius: "12px", border: `1px solid ${border}`, p: 2 }} data-testid="support-widget-settings">
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ pr: 1 }}>
            <Typography fontSize={14} fontWeight={700} color={theme.palette.text.primary}>{t("storefront.form.supportWidget", { defaultValue: "Support widget" })}</Typography>
            <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>
              {t("storefront.form.supportWidgetDesc", { defaultValue: 'An always-on "Buy me a coffee" / tip box at the top of your page. Supporters pick an amount and pay with crypto — no account needed.' })}
            </Typography>
          </Box>
          <Switch
            checked={swEnabled}
            onChange={(e) => setSwEnabled(e.target.checked)}
            data-testid="support-widget-enabled-switch"
            sx={{ "& .Mui-checked": { color: brandFg(theme.palette.mode === "dark") }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
          />
        </Box>

        {swEnabled && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 2.5, pt: 2.5, borderTop: `1px solid ${border}` }}>
            {/* Style */}
            <Box>
              <Typography sx={labelSx}>{t("storefront.form.style", { defaultValue: "Style" })}</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1 }}>
                {SUPPORT_STYLES.map((s) => {
                  const active = swStyle === s.key;
                  return (
                    <Box
                      key={s.key}
                      role="button"
                      tabIndex={0}
                      data-testid={`support-style-${s.key}`}
                      onClick={() => setSwStyle(s.key)}
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSwStyle(s.key); } }}
                      sx={{
                        display: "flex", alignItems: "center", gap: 1, p: 1.25, borderRadius: "10px", cursor: "pointer",
                        border: `1.5px solid ${active ? theme.palette.primary.main : border}`,
                        backgroundColor: active ? (theme.palette.mode === "dark" ? "rgba(79,70,229,0.08)" : "rgba(79,70,229,0.12)") : theme.palette.background.default,
                        transition: "border-color 140ms ease",
                      }}
                    >
                      <Icon icon={s.icon} width={20} color={theme.palette.text.primary} />
                      <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.primary}>{t(`storefront.form.supportStyle_${s.key}`, { defaultValue: s.label })}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Custom label */}
            <Box>
              <Typography sx={labelSx}>{t("storefront.form.customLabel", { defaultValue: "Custom label" })} <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>{t("storefront.form.optional", { defaultValue: "(optional)" })}</Typography></Typography>
              <Box
                component="input"
                data-testid="support-widget-label"
                value={swLabel}
                maxLength={80}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSwLabel(e.target.value)}
                placeholder={SUPPORT_STYLES.find((s) => s.key === swStyle)?.sample || "Support me"}
                sx={inputSx}
              />
            </Box>

            {/* Preset amounts */}
            <Box>
              <Typography sx={labelSx}>{t("storefront.form.presetAmounts", { defaultValue: "Preset amounts" })} <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>{t("storefront.form.upTo5", { defaultValue: "(up to 5)" })}</Typography></Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }} data-testid="support-preset-chips">
                {swPresets.map((p) => (
                  <Box
                    key={p}
                    data-testid={`support-preset-chip-${p}`}
                    data-below-floor={p < 10 ? "true" : "false"}
                    title={p < 10 ? t("storefront.form.presetBelowFloor", { defaultValue: "Below the $10 minimum — hidden on your page" }) : undefined}
                    sx={{
                      display: "flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.6, borderRadius: "999px",
                      border: `1px ${p < 10 ? "dashed" : "solid"} ${p < 10 ? theme.palette.warning.main : border}`, backgroundColor: theme.palette.background.default,
                      fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700, color: p < 10 ? theme.palette.text.disabled : theme.palette.text.primary,
                      textDecoration: p < 10 ? "line-through" : "none",
                    }}
                  >
                    {p}
                    <Box
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${p}`}
                      data-testid={`support-preset-remove-${p}`}
                      onClick={() => setSwPresets((prev) => prev.filter((x) => x !== p))}
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSwPresets((prev) => prev.filter((x) => x !== p)); } }}
                      sx={{ display: "flex", cursor: "pointer", color: theme.palette.text.secondary, "&:hover": { color: theme.palette.error.main } }}
                    >
                      <Icon icon="mdi:close" width={14} />
                    </Box>
                  </Box>
                ))}
              </Box>
              {swPresets.length < 5 && (
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Box
                    component="input"
                    type="number"
                    data-testid="support-preset-input"
                    value={swPresetDraft}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSwPresetDraft(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const n = parseFloat(swPresetDraft);
                        if (Number.isFinite(n) && n >= 10 && !swPresets.includes(n) && swPresets.length < 5) {
                          setSwPresets((prev) => [...prev, n].sort((a, b) => a - b));
                          setSwPresetDraft("");
                        }
                      }
                    }}
                    placeholder={t("storefront.form.presetPlaceholderV2", { defaultValue: "e.g. 15" })}
                    sx={{ ...inputSx, maxWidth: 140 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    data-testid="support-preset-add"
                    disabled={!Number.isFinite(parseFloat(swPresetDraft)) || parseFloat(swPresetDraft) < 10}
                    onClick={() => {
                      const n = parseFloat(swPresetDraft);
                      if (Number.isFinite(n) && n >= 10 && !swPresets.includes(n) && swPresets.length < 5) {
                        setSwPresets((prev) => [...prev, n].sort((a, b) => a - b));
                        setSwPresetDraft("");
                      }
                    }}
                    sx={{ textTransform: "none", fontSize: 12.5, borderRadius: "10px" }}
                  >
                    {t("storefront.form.add", { defaultValue: "Add" })}
                  </Button>
                </Box>
              )}
              {swPresets.length === 0 && (
                <Typography fontSize={11.5} color={theme.palette.error.main} mt={0.5}>{t("storefront.form.addPresetHint", { defaultValue: "Add at least one preset amount." })}</Typography>
              )}
              {/* C3: explain the platform floor where the creator sets amounts, instead of silently dropping presets */}
              {swPresetDraft !== "" && Number.isFinite(parseFloat(swPresetDraft)) && parseFloat(swPresetDraft) < 10 && (
                <Typography fontSize={11.5} color={theme.palette.warning.main} mt={0.5} data-testid="support-preset-floor-warning">
                  {t("storefront.form.presetFloorWarning", { defaultValue: "Presets must be $10 or more." })}
                </Typography>
              )}
              <Typography fontSize={11.5} color={theme.palette.text.secondary} mt={0.75} sx={{ lineHeight: 1.5 }} data-testid="support-floor-note">
                {t("storefront.form.floorExplainer", { defaultValue: "Dynopay's minimum for any crypto payment is $10 — network fees make smaller amounts uneconomical. Presets below $10 are not shown to supporters." })}
                {swPresets.some((p) => p < 10) && (
                  <> {t("storefront.form.floorHiddenPresets", { defaultValue: "Crossed-out presets are hidden on your page — remove them or raise them to $10+." })}</>
                )}
              </Typography>
            </Box>

            {/* Currency + Min amount */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <Box>
                <Typography sx={labelSx}>{t("storefront.form.currency", { defaultValue: "Currency" })}</Typography>
                <Box
                  component="select"
                  data-testid="support-widget-currency"
                  value={swCurrency}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSwCurrency(e.target.value)}
                  sx={{ ...inputSx, appearance: "auto" }}
                >
                  {SUPPORT_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Box>
              </Box>
              <Box>
                <Typography sx={labelSx}>{t("storefront.form.minAmount", { defaultValue: "Minimum amount" })} <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>({t("storefront.form.minFloorNote", { defaultValue: "min $10" })})</Typography></Typography>
                <Box
                  component="input"
                  type="number"
                  data-testid="support-widget-min"
                  aria-label={t("storefront.form.minAmount", { defaultValue: "Minimum amount" })}
                  value={swMinAmount}
                  min={10}
                  step="any"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSwMinAmount(Number(e.target.value))}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => setSwMinAmount(Math.max(10, Number(e.target.value) || 10))}
                  sx={inputSx}
                />
              </Box>
            </Box>

            {/* Monthly tip goal (opt-in) */}
            <Box>
              <Typography sx={labelSx}>{t("storefront.form.monthlyGoal", { defaultValue: "Monthly tip goal" })} <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>{t("storefront.form.monthlyGoalNote", { defaultValue: "(optional — leave empty to hide the bar)" })}</Typography></Typography>
              <Box
                component="input"
                type="number"
                data-testid="support-widget-monthly-goal"
                aria-label={t("storefront.form.monthlyGoal", { defaultValue: "Monthly tip goal" })}
                value={swMonthlyGoal}
                min={10}
                step="any"
                placeholder="e.g. 500"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSwMonthlyGoal(e.target.value)}
                onBlur={(e: React.FocusEvent<HTMLInputElement>) => { const v = Number(e.target.value); setSwMonthlyGoal(e.target.value.trim() && Number.isFinite(v) ? String(Math.max(10, v)) : ""); }}
                sx={inputSx}
              />
              <Typography fontSize={11.5} color={theme.palette.text.disabled} mt={0.5}>
                {t("storefront.form.monthlyGoalHint", { defaultValue: "Shows \"$X of $Y this month\" on your page. Counts confirmed tips and resets on the 1st." })}
              </Typography>
            </Box>

            {/* Thanks message */}
            <Box>
              <Typography sx={labelSx}>{t("storefront.form.thanksMessage", { defaultValue: "Welcome / thank-you message" })} <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>{t("storefront.form.optional", { defaultValue: "(optional)" })}</Typography></Typography>
              <Box
                component="textarea"
                rows={2}
                maxLength={280}
                data-testid="support-widget-thanks"
                value={swThanks}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSwThanks(e.target.value)}
                placeholder={t("storefront.form.thanksPlaceholder", { defaultValue: "e.g. Thanks for keeping the coffee flowing! ☕" })}
                sx={{ ...inputSx, resize: "vertical", minHeight: 60, display: "block" }}
              />
            </Box>

            {/* Toggles */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography fontSize={13.5} color={theme.palette.text.primary}>{t("storefront.form.allowMessage", { defaultValue: "Let supporters leave a message" })}</Typography>
              <Switch
                checked={swAllowMessage}
                onChange={(e) => setSwAllowMessage(e.target.checked)}
                data-testid="support-widget-allow-message"
                sx={{ "& .Mui-checked": { color: brandFg(theme.palette.mode === "dark") }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
              />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography fontSize={13.5} color={theme.palette.text.primary}>{t("storefront.form.showSupporters", { defaultValue: "Show supporter count & total raised" })}</Typography>
              <Switch
                checked={swShowSupporters}
                onChange={(e) => setSwShowSupporters(e.target.checked)}
                data-testid="support-widget-show-supporters"
                sx={{ "& .Mui-checked": { color: brandFg(theme.palette.mode === "dark") }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
              />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Box>
                <Typography fontSize={13.5} color={theme.palette.text.primary}>{t("storefront.form.showWall", { defaultValue: "Supporter wall — show recent public tips" })}</Typography>
                <Typography fontSize={11.5} color={theme.palette.text.disabled}>{t("storefront.form.showWallHint", { defaultValue: "First name, amount and message of your last 8 supporters. Anonymous tips show as \"Someone\". Off by default." })}</Typography>
              </Box>
              <Switch
                checked={swShowWall}
                onChange={(e) => setSwShowWall(e.target.checked)}
                data-testid="support-widget-show-wall"
                sx={{ "& .Mui-checked": { color: brandFg(theme.palette.mode === "dark") }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Analytics (30-day tips chart + top supporters — Session 2026-08-05) ── */}
      <Box
        id="analytics"
        sx={{ borderRadius: "12px", border: `1px solid ${border}`, p: 2 }}
        data-testid="creator-analytics-section"
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 1 }}>
          <Box sx={{ pr: 1 }}>
            <Typography fontSize={14} fontWeight={700} color={theme.palette.text.primary}>{t("storefront.form.analytics", { defaultValue: "Analytics" })}</Typography>
            <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>
              {t("storefront.form.analyticsDesc", { defaultValue: "A 30-day view of your tips and top supporters. Toggle to hide it from your public creator page — you'll still see it here." })}
            </Typography>
          </Box>
          <Switch
            checked={publicAnalyticsEnabled}
            onChange={(e) => setPublicAnalyticsEnabled(e.target.checked)}
            data-testid="public-analytics-switch"
            sx={{ "& .Mui-checked": { color: brandFg(theme.palette.mode === "dark") }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
          />
        </Box>
        <AnalyticsWidget
          variant="full"
          data={analyticsData}
          loading={analyticsLoading}
          toggleState={publicAnalyticsEnabled ? "shown" : "hidden"}
          onToggle={() => setPublicAnalyticsEnabled((v) => !v)}
          toggleBusy={analyticsTogglingBusy}
        />
      </Box>

      {/* ── Store visibility (Session 2026-08-26) ── */}
      <Box
        id="store-visibility"
        sx={{ borderRadius: "12px", border: `1px solid ${border}`, p: 2 }}
        data-testid="creator-store-section"
      >
        {/* Master: store on / off */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ pr: 1 }}>
            <Typography fontSize={14} fontWeight={700} color={theme.palette.text.primary}>{t("storefront.form.storeTitle", { defaultValue: "Online store" })}</Typography>
            <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>
              {t("storefront.form.storeDesc", { defaultValue: "Turn your store OFF to hide your shop page and every product link everywhere — this page becomes tip-only. Your products are saved and come back the moment you turn the store on again." })}
            </Typography>
          </Box>
          <Switch
            checked={storeEnabled}
            onChange={(e) => setStoreEnabled(e.target.checked)}
            data-testid="store-enabled-switch"
            sx={{ "& .Mui-checked": { color: brandFg(theme.palette.mode === "dark") }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
          />
        </Box>

        {/* Sub: show the shop on the creator page (only relevant when the store is on) */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mt: 1.5, pt: 1.5, borderTop: `1px solid ${border}`, opacity: storeEnabled ? 1 : 0.5 }}>
          <Box sx={{ pr: 1 }}>
            <Typography fontSize={14} fontWeight={600} color={theme.palette.text.primary}>{t("storefront.form.showProductsTitle", { defaultValue: "Show my shop on this page" })}</Typography>
            <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>
              {t("storefront.form.showProductsDesc", { defaultValue: "Show the shop section on this creator page. Turn it OFF for a clean tip-only page — your shop page and direct product links keep working." })}
            </Typography>
          </Box>
          <Switch
            checked={storeEnabled && showProductsOnPage}
            disabled={!storeEnabled}
            onChange={(e) => setShowProductsOnPage(e.target.checked)}
            data-testid="show-products-switch"
            sx={{ "& .Mui-checked": { color: brandFg(theme.palette.mode === "dark") }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
          />
        </Box>

        {/* Live preview of the effective public-page state */}
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${border}` }}>
          <Box
            data-testid="store-visibility-preview"
            sx={{
              display: "inline-flex", alignItems: "center", gap: 0.75,
              px: 1.25, py: 0.6, borderRadius: 999,
              bgcolor: !storeEnabled
                ? (theme.palette.mode === "dark" ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.10)")
                : !showProductsOnPage
                  ? (theme.palette.mode === "dark" ? "rgba(251,191,36,0.16)" : "rgba(217,119,6,0.10)")
                  : (theme.palette.mode === "dark" ? "rgba(52,211,153,0.16)" : "rgba(5,150,105,0.10)"),
              color: !storeEnabled
                ? theme.palette.text.secondary
                : !showProductsOnPage
                  ? (theme.palette.mode === "dark" ? "#FBBF24" : "#B45309")
                  : (theme.palette.mode === "dark" ? "#34D399" : "#059669"),
            }}
          >
            <Icon
              icon={!storeEnabled ? "mdi:storefront-off-outline" : !showProductsOnPage ? "mdi:eye-off-outline" : "mdi:eye-check-outline"}
              width={16}
            />
            <Typography fontSize={12.5} fontWeight={600}>
              {!storeEnabled
                ? t("storefront.form.storePreviewStoreOff", { defaultValue: "Preview: tip-only page — shop & product links hidden" })
                : !showProductsOnPage
                  ? t("storefront.form.storePreviewProductsHidden", { defaultValue: "Preview: shop hidden from this page" })
                  : t("storefront.form.storePreviewBoth", { defaultValue: "Preview: tips + shop shown" })}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Enable toggle */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderRadius: "12px", border: `1px solid ${border}` }}>
        <Box sx={{ pr: 2 }}>
          <Typography fontSize={14} fontWeight={600} color={theme.palette.text.primary}>{t("storefront.form.publishPage", { defaultValue: "Publish my creator page" })}</Typography>
          <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>{t("storefront.form.publishDesc", { defaultValue: "When on, anyone with your link can view your page and support you." })}</Typography>
        </Box>
        <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} data-testid="creator-enabled-switch" sx={{ "& .Mui-checked": { color: brandFg(theme.palette.mode === "dark") }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }} />
      </Box>

      <Box>
        <Button
          variant="contained"
          disableElevation
          onClick={handleSave}
          disabled={!canSave}
          data-testid="creator-save-btn"
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", px: 3, py: 1.1, fontSize: 14 }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : t("storefront.form.saveChanges", { defaultValue: "Save changes" })}
        </Button>
      </Box>

      {/* Handle change-warning modal (spec Doc-3 §C). Only opens when the
          merchant is about to persist a NEW handle (and they had one saved
          already). Cancel → keep editing; Continue → persistProfile(). */}
      <Dialog
        open={handleWarnOpen}
        onClose={() => setHandleWarnOpen(false)}
        maxWidth="xs"
        fullWidth
        data-testid="handle-change-warning"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{t("storefront.form.changeHandleTitle", { defaultValue: "Change your handle?" })}</DialogTitle>
        <DialogContent>
          <Typography fontSize={13.5} color={theme.palette.text.secondary} sx={{ mb: 1.5 }}>
            <Trans
              i18nKey="storefront.form.changeHandleBody"
              ns="common"
              values={{
                oldUrl: `${siteUrl.replace(/^https?:\/\//, "")}/${savedHandle}`,
                newUrl: `${siteUrl.replace(/^https?:\/\//, "")}/${handle}`,
              }}
              defaults="You're about to change your public URL from <old>{{oldUrl}}</old> to <new>{{newUrl}}</new>."
              components={{
                old: <Box component="span" sx={{ fontFamily: "ui-monospace, monospace" }} />,
                new: <Box component="span" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }} />,
              }}
            />
          </Typography>
          <Typography fontSize={13} color={theme.palette.warning.main}>
            {t("storefront.form.changeHandleWarn", { defaultValue: "Any existing shared links, QR codes, or social bios pointing at the old URL will stop working. Nobody will be redirected — they'll just see a 404." })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setHandleWarnOpen(false)}
            data-testid="handle-warning-cancel"
            sx={{ textTransform: "none" }}
          >
            {t("storefront.form.keepOldHandle", { defaultValue: "Keep old handle" })}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={persistProfile}
            disabled={saving}
            data-testid="handle-warning-confirm"
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {saving ? t("storefront.form.savingEllipsis", { defaultValue: "Saving…" }) : t("storefront.form.changeMyHandle", { defaultValue: "Change my handle" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CreatorPageSettings;
