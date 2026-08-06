import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, CircularProgress, Switch, Typography, useTheme, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { Icon } from "@iconify/react";
import { useDispatch, useSelector } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import { getCreatorBaseUrl } from "@/helpers/creatorUrl";
import CreatorThemePicker, { CreatorTheme, CoverStyle } from "@/Components/Page/Creator/CreatorThemePicker";
import HandleQrCode from "@/Components/Page/Creator/HandleQrCode";
import AnalyticsWidget, { CreatorAnalyticsData } from "@/Components/Page/Creator/AnalyticsWidget";
import { BRAND_ACCENT } from "@/constants/theme";
import { SUPPORTED_FIAT_CURRENCIES } from "@/constants/currencies";
import { API_ENDPOINTS } from "@/api/endpoints";
import useDebounce from "@/hooks/useDebounce";
import useCopyToClipboard from "@/hooks/useCopyToClipboard";

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
  { key: "website",   label: "Website",       icon: "mdi:web",         placeholder: "https://yourwebsite.com" },
] as const;

type PlatformKey = typeof SOCIAL_PLATFORMS[number]["key"];

const CreatorPageSettings: React.FC<Props> = ({ onChange }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;

  const siteUrl = getCreatorBaseUrl();
  const border = theme.palette.divider;

  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverDragActive, setCoverDragActive] = useState(false);
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
  const [swPresets, setSwPresets] = useState<number[]>([3, 5, 10, 25]);
  const [swPresetDraft, setSwPresetDraft] = useState("");
  const [swCurrency, setSwCurrency] = useState("USD");
  const [swMinAmount, setSwMinAmount] = useState(1);
  const [swAllowMessage, setSwAllowMessage] = useState(true);
  const [swThanks, setSwThanks] = useState("");
  const [swShowSupporters, setSwShowSupporters] = useState(true);
  // ── Public Analytics widget (Session 2026-08-05) ──
  // Controls whether the 30-day tips chart + top supporters is publicly
  // visible on the creator's /:handle page. Merchant always sees their own
  // analytics in the panel below regardless of this toggle.
  const [publicAnalyticsEnabled, setPublicAnalyticsEnabled] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<CreatorAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
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

  // Ensure the profile is loaded even when landing directly on this page
  useEffect(() => {
    if (!profile?.user_id) dispatch(UserAction(USER_PROFILE_FETCH));
  }, [dispatch, profile?.user_id]);

  // Seed from profile once loaded (wait for a real profile, not the empty {} default)
  useEffect(() => {
    if (profile?.user_id && !seeded) {
      setHandle(profile.handle || "");
      setName(profile.name || "");
      setBio(profile.bio || "");
      setEnabled(Boolean(profile.creator_page_enabled));
      setCoverImage(profile.cover_image || null);
      setSocialLinks(
        (profile.social_links && typeof profile.social_links === "object") ? profile.social_links : {},
      );
      // Support Widget seed
      setSwEnabled(Boolean(profile.support_widget_enabled));
      setSwStyle(
        ["coffee", "tip", "support"].includes(profile.support_widget_style)
          ? profile.support_widget_style
          : "coffee",
      );
      setSwLabel(profile.support_widget_label || "");
      setSwPresets(
        Array.isArray(profile.support_widget_preset_amounts) && profile.support_widget_preset_amounts.length
          ? profile.support_widget_preset_amounts.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
          : [3, 5, 10, 25],
      );
      setSwCurrency(profile.support_widget_currency || "USD");
      setSwMinAmount(Number(profile.support_widget_min_amount) > 0 ? Number(profile.support_widget_min_amount) : 1);
      setSwAllowMessage(profile.support_widget_allow_message !== false);
      setSwThanks(profile.support_widget_thanks_message || "");
      setSwShowSupporters(profile.support_widget_show_supporters !== false);
      setPublicAnalyticsEnabled(profile.public_analytics_enabled !== false);
      // Theme (Session 60)
      setThemeAccent(profile.theme_accent_color || null);
      setThemeCoverStyle((profile.theme_cover_style as CoverStyle) || null);
      setThemeCoverGradient(profile.theme_cover_gradient || null);
      setSeeded(true);
    }
  }, [profile, seeded]);

  // Broadcast form state to parent (for the live preview)
  useEffect(() => {
    onChange?.({
      handle, bio, enabled, coverImage, socialLinks,
      swEnabled, swStyle, swLabel, swPresets, swCurrency, swMinAmount, swAllowMessage, swThanks, swShowSupporters,
      name,
      // Theme (Session 60) — so the live preview matches the published page.
      accentColor: themeAccent, coverStyle: themeCoverStyle, coverGradient: themeCoverGradient,
    } as any);
  }, [handle, name, bio, enabled, coverImage, socialLinks, swEnabled, swStyle, swLabel, swPresets, swCurrency, swMinAmount, swAllowMessage, swThanks, swShowSupporters, themeAccent, themeCoverStyle, themeCoverGradient, onChange]);

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
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const r = await axiosBaseApi.get(API_ENDPOINTS.creator.analytics);
      const d = (r?.data?.data || null) as CreatorAnalyticsData & { has_handle?: boolean } | null;
      setAnalyticsData(d);
    } catch {
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.handle) void loadAnalytics();
    else setAnalyticsLoading(false);
  }, [profile?.handle, loadAnalytics]);


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
    return Array.isArray(p) && p.length ? p.map((n: unknown) => Number(n)) : [3, 5, 10, 25];
  }, [profile?.support_widget_preset_amounts]);

  const supportWidgetChanged = useMemo(() => (
    swEnabled !== Boolean(profile?.support_widget_enabled) ||
    swStyle !== (profile?.support_widget_style || "coffee") ||
    swLabel !== (profile?.support_widget_label || "") ||
    JSON.stringify(swPresets) !== JSON.stringify(savedPresets) ||
    swCurrency !== (profile?.support_widget_currency || "USD") ||
    Number(swMinAmount) !== (Number(profile?.support_widget_min_amount) > 0 ? Number(profile?.support_widget_min_amount) : 1) ||
    swAllowMessage !== (profile?.support_widget_allow_message !== false) ||
    swThanks !== (profile?.support_widget_thanks_message || "") ||
    swShowSupporters !== (profile?.support_widget_show_supporters !== false)
  ), [swEnabled, swStyle, swLabel, swPresets, swCurrency, swMinAmount, swAllowMessage, swThanks, swShowSupporters, savedPresets, profile]);

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
      publicAnalyticsEnabled !== (profile?.public_analytics_enabled !== false)
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
        support_widget_min_amount: Number(swMinAmount) > 0 ? Number(swMinAmount) : 1,
        support_widget_allow_message: swAllowMessage,
        support_widget_thanks_message: swThanks.trim() || null,
        support_widget_show_supporters: swShowSupporters,
        theme_accent_color: themeAccent,
        theme_cover_style: themeCoverStyle,
        theme_cover_gradient: themeCoverGradient,
        public_analytics_enabled: publicAnalyticsEnabled,
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

  // Drag-and-drop — preventDefault stops the browser from just opening the
  // dropped image in a new tab; instead we upload it.
  const onCoverDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!coverDragActive) setCoverDragActive(true);
  };
  const onCoverDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setCoverDragActive(false);
  };
  const onCoverDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setCoverDragActive(false);
    void uploadCoverFile(e.dataTransfer?.files?.[0]);
  };

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
              <Typography fontSize={11.5} color={theme.palette.text.secondary}>Your public page</Typography>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }} data-testid="creator-reserved-confirm">
                <Icon icon="mdi:check-decagram" width={15} color="#22B573" />
                <Typography fontSize={11.5} sx={{ fontWeight: 800, color: "#22B573" }}>
                  Reserved — it&apos;s yours
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
              title="Edit your handle"
            >
              Edit
            </Button>
            <Button size="small" onClick={copyUrl} data-testid="creator-copy-url" startIcon={<Icon icon={copied ? "mdi:check" : "mdi:content-copy"} width={16} />} sx={{ textTransform: "none", fontSize: 12.5, color: theme.palette.text.primary }}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              size="small"
              onClick={() => setQrOpen(true)}
              data-testid="creator-qr-btn"
              startIcon={<Icon icon="mdi:qrcode" width={16} />}
              sx={{ textTransform: "none", fontSize: 12.5, color: theme.palette.text.primary }}
              title="Show QR code"
            >
              QR
            </Button>
            <Button size="small" href={publicUrl} target="_blank" rel="noopener" data-testid="creator-view-page" endIcon={<Icon icon="mdi:open-in-new" width={15} />} sx={{ textTransform: "none", fontSize: 12.5, color: theme.palette.primary.main }}>
              View
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
              Page theme
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, mt: 0.25 }}>
              Colors and cover style for your dynopay.me page — make it feel on-brand.
            </Typography>
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
          Your QR code
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <HandleQrCode
            handle={savedHandle}
            size="full"
            accentColor={themeAccent || BRAND_ACCENT}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrOpen(false)} sx={{ textTransform: "none" }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Cover image */}
      <Box>
        <Typography sx={labelSx}>Cover image <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>(optional, recommended 1200×400)</Typography></Typography>
        <Box
          data-testid="creator-cover-preview"
          onClick={() => { if (!uploadingCover) coverFileRef.current?.click(); }}
          onDragOver={onCoverDragOver}
          onDragEnter={onCoverDragOver}
          onDragLeave={onCoverDragLeave}
          onDrop={onCoverDrop}
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
                {coverDragActive ? "Drop image to upload" : "Drag & drop an image here, or click to upload (up to 10 MB)"}
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
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setCoverImage(null); }}
                sx={{ textTransform: "none", fontSize: 11.5, minWidth: 0, py: 0.4, px: 1, backgroundColor: "rgba(0,0,0,0.65)", color: "#fff", "&:hover": { backgroundColor: "rgba(0,0,0,0.8)" } }}
              >
                Remove
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
          {coverImage ? "Replace image" : "Upload image"}
        </Button>
      </Box>

      {/* Display name (shown as the header on your public /{handle} page) */}
      <Box>
        <Typography sx={labelSx}>Display name <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>(shown at the top of your public page)</Typography></Typography>
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
          Buyers see this above your handle. Leave blank to use your handle as the name.
        </Typography>
      </Box>

      {/* Handle */}
      <Box>
        <Typography sx={labelSx}>Handle</Typography>
        <Box sx={{ display: "flex", alignItems: "stretch", border: `1px solid ${availability && !availability.available ? theme.palette.error.main : border}`, borderRadius: "10px", overflow: "hidden", backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: "flex", alignItems: "center", px: 1.5, backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", fontFamily: "ui-monospace, monospace", fontSize: 13, color: theme.palette.text.secondary, whiteSpace: "nowrap" }}>
            {siteUrl.replace(/^https?:\/\//, "")}/
          </Box>
          <Box
            component="input"
            ref={handleInputRef}
            data-testid="creator-handle-input"
            value={handle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandle(e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="yourname"
            sx={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "11px 12px", fontFamily: "ui-monospace, monospace", fontSize: 14, color: theme.palette.text.primary, minWidth: 0 }}
          />
          <Box sx={{ display: "flex", alignItems: "center", px: 1.5 }}>
            {checking ? <CircularProgress size={15} /> :
              handle && handle !== savedHandle && availability?.available ? <Icon icon="mdi:check-circle" width={18} color="#22c55e" /> :
              handle && availability && !availability.available ? <Icon icon="mdi:close-circle" width={18} color={theme.palette.error.main} /> : null}
          </Box>
        </Box>
        <Typography fontSize={11.5} color={formatError || (availability && !availability.available) ? theme.palette.error.main : theme.palette.text.secondary} mt={0.5} data-testid="creator-handle-hint">
          {formatError || (availability && !availability.available ? availability.reason : "This is your unique, shareable Dynopay address.")}
        </Typography>
      </Box>

      {/* Bio */}
      <Box>
        <Typography sx={labelSx}>Bio <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>(optional)</Typography></Typography>
        <Box
          component="textarea"
          rows={3}
          maxLength={500}
          data-testid="creator-bio-input"
          value={bio}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
          placeholder="Tell visitors who you are and what you're raising for…"
          sx={{ ...inputSx, resize: "vertical", minHeight: 74, display: "block" }}
        />
        <Typography fontSize={10.5} color={theme.palette.text.disabled} textAlign="right" mt={0.25}>{bio.length}/500</Typography>
      </Box>

      {/* Social links */}
      <Box>
        <Typography sx={labelSx}>Social links <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>(optional)</Typography></Typography>
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
            <Typography fontSize={14} fontWeight={700} color={theme.palette.text.primary}>Support widget</Typography>
            <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>
              An always-on “Buy me a coffee” / tip box at the top of your page. Supporters pick an amount and pay with crypto — no account needed.
            </Typography>
          </Box>
          <Switch
            checked={swEnabled}
            onChange={(e) => setSwEnabled(e.target.checked)}
            data-testid="support-widget-enabled-switch"
            sx={{ "& .Mui-checked": { color: theme.palette.primary.main }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
          />
        </Box>

        {swEnabled && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 2.5, pt: 2.5, borderTop: `1px solid ${border}` }}>
            {/* Style */}
            <Box>
              <Typography sx={labelSx}>Style</Typography>
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
                      <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.primary}>{s.label}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Custom label */}
            <Box>
              <Typography sx={labelSx}>Custom label <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>(optional)</Typography></Typography>
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
              <Typography sx={labelSx}>Preset amounts <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>(up to 5)</Typography></Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }} data-testid="support-preset-chips">
                {swPresets.map((p) => (
                  <Box
                    key={p}
                    sx={{
                      display: "flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.6, borderRadius: "999px",
                      border: `1px solid ${border}`, backgroundColor: theme.palette.background.default,
                      fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700, color: theme.palette.text.primary,
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
                        if (Number.isFinite(n) && n > 0 && !swPresets.includes(n) && swPresets.length < 5) {
                          setSwPresets((prev) => [...prev, n].sort((a, b) => a - b));
                          setSwPresetDraft("");
                        }
                      }
                    }}
                    placeholder="e.g. 5"
                    sx={{ ...inputSx, maxWidth: 140 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    data-testid="support-preset-add"
                    onClick={() => {
                      const n = parseFloat(swPresetDraft);
                      if (Number.isFinite(n) && n > 0 && !swPresets.includes(n) && swPresets.length < 5) {
                        setSwPresets((prev) => [...prev, n].sort((a, b) => a - b));
                        setSwPresetDraft("");
                      }
                    }}
                    sx={{ textTransform: "none", fontSize: 12.5, borderRadius: "10px" }}
                  >
                    Add
                  </Button>
                </Box>
              )}
              {swPresets.length === 0 && (
                <Typography fontSize={11.5} color={theme.palette.error.main} mt={0.5}>Add at least one preset amount.</Typography>
              )}
            </Box>

            {/* Currency + Min amount */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <Box>
                <Typography sx={labelSx}>Currency</Typography>
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
                <Typography sx={labelSx}>Minimum amount</Typography>
                <Box
                  component="input"
                  type="number"
                  data-testid="support-widget-min"
                  value={swMinAmount}
                  min={0.01}
                  step="any"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSwMinAmount(Number(e.target.value))}
                  sx={inputSx}
                />
              </Box>
            </Box>

            {/* Thanks message */}
            <Box>
              <Typography sx={labelSx}>Welcome / thank-you message <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>(optional)</Typography></Typography>
              <Box
                component="textarea"
                rows={2}
                maxLength={280}
                data-testid="support-widget-thanks"
                value={swThanks}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSwThanks(e.target.value)}
                placeholder="e.g. Thanks for keeping the coffee flowing! ☕"
                sx={{ ...inputSx, resize: "vertical", minHeight: 60, display: "block" }}
              />
            </Box>

            {/* Toggles */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography fontSize={13.5} color={theme.palette.text.primary}>Let supporters leave a message</Typography>
              <Switch
                checked={swAllowMessage}
                onChange={(e) => setSwAllowMessage(e.target.checked)}
                data-testid="support-widget-allow-message"
                sx={{ "& .Mui-checked": { color: theme.palette.primary.main }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
              />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography fontSize={13.5} color={theme.palette.text.primary}>Show supporter count &amp; total raised</Typography>
              <Switch
                checked={swShowSupporters}
                onChange={(e) => setSwShowSupporters(e.target.checked)}
                data-testid="support-widget-show-supporters"
                sx={{ "& .Mui-checked": { color: theme.palette.primary.main }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
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
            <Typography fontSize={14} fontWeight={700} color={theme.palette.text.primary}>Analytics</Typography>
            <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>
              A 30-day view of your tips and top supporters. Toggle to hide it from your public creator page — you&apos;ll still see it here.
            </Typography>
          </Box>
          <Switch
            checked={publicAnalyticsEnabled}
            onChange={(e) => setPublicAnalyticsEnabled(e.target.checked)}
            data-testid="public-analytics-switch"
            sx={{ "& .Mui-checked": { color: theme.palette.primary.main }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }}
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

      {/* Enable toggle */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderRadius: "12px", border: `1px solid ${border}` }}>
        <Box sx={{ pr: 2 }}>
          <Typography fontSize={14} fontWeight={600} color={theme.palette.text.primary}>Publish my creator page</Typography>
          <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>When on, anyone with your link can view your page and support you.</Typography>
        </Box>
        <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} data-testid="creator-enabled-switch" sx={{ "& .Mui-checked": { color: theme.palette.primary.main }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }} />
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
          {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Save changes"}
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
        <DialogTitle sx={{ fontWeight: 700 }}>Change your handle?</DialogTitle>
        <DialogContent>
          <Typography fontSize={13.5} color={theme.palette.text.secondary} sx={{ mb: 1.5 }}>
            You&apos;re about to change your public URL from{" "}
            <Box component="span" sx={{ fontFamily: "ui-monospace, monospace" }}>
              {siteUrl.replace(/^https?:\/\//, "")}/{savedHandle}
            </Box>{" "}
            to{" "}
            <Box component="span" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
              {siteUrl.replace(/^https?:\/\//, "")}/{handle}
            </Box>
            .
          </Typography>
          <Typography fontSize={13} color={theme.palette.warning.main}>
            Any existing shared links, QR codes, or social bios pointing at
            the old URL will stop working. Nobody will be redirected — they&apos;ll
            just see a 404.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setHandleWarnOpen(false)}
            data-testid="handle-warning-cancel"
            sx={{ textTransform: "none" }}
          >
            Keep old handle
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={persistProfile}
            disabled={saving}
            data-testid="handle-warning-confirm"
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {saving ? "Saving…" : "Change my handle"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CreatorPageSettings;
