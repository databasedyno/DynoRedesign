import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { Icon, MONO } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import useDebounce from "@/hooks/useDebounce";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";
import { getCreatorBaseUrl } from "@/helpers/creatorUrl";
import { trackOnboarding } from "@/utils/trackOnboarding";
import { StepFooter, StepHeader } from "./StepChrome";
import type { SetupProgress } from "./useSetupProgress";

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

interface Props {
  progress: SetupProgress;
  onBack: () => void;
  onNext: (handle?: string) => void;
}

/**
 * Creator track — Step 4: claim your @handle. Reserving it makes the public
 * creator page + checkout URL (dynopay.com/<handle>) go live immediately — the
 * one thing a creator needs before they can be tipped. Reuses the same
 * check-handle / creator-profile endpoints as the storefront settings.
 */
const StepClaimHandle: React.FC<Props> = ({ progress, onBack, onNext }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation("dashboardLayout");
  const { account, hasHandle, handle: currentHandle } = progress;
  const { mutate: mutateStorefront } = useStorefrontProfile();

  const siteDomain = useMemo(() => getCreatorBaseUrl().replace(/^https?:\/\//, "").replace(/\/+$/, ""), []);

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(10,10,15,0.02)";
  const chipBtn = { display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.5, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" } as const;

  const brandName = String((account as any)?.company_name || (account as any)?.first_name || "");
  const suggestion = useMemo(
    () => brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30),
    [brandName],
  );

  const [handle, setHandle] = useState("");
  const [availability, setAvailability] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional cover + bio — collapsed by default to keep the step focused (2b).
  const [showExtras, setShowExtras] = useState(false);
  const [bio, setBio] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverDrag, setCoverDrag] = useState(false);
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  const uploadCoverFile = async (file?: File | null) => {
    if (!file) return;
    setCoverError(null);
    if (!file.type || !file.type.startsWith("image/")) {
      setCoverError(t("gs.handleCoverNotImage", { defaultValue: "Please choose an image file" }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCoverError(t("gs.handleCoverTooBig", { defaultValue: "Image must be under 10 MB" }));
      return;
    }
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await axiosBaseApi.post(API_ENDPOINTS.creator.uploadCover, fd, { headers: { "Content-Type": "multipart/form-data" } });
      const url = r?.data?.data?.url;
      if (url) setCoverImage(url);
      else setCoverError(t("gs.handleCoverFailed", { defaultValue: "Couldn't upload that image — please try again." }));
    } catch {
      setCoverError(t("gs.handleCoverFailed", { defaultValue: "Couldn't upload that image — please try again." }));
    } finally {
      setUploadingCover(false);
      if (coverFileRef.current) coverFileRef.current.value = "";
    }
  };

  // Prefill once with a slug of the brand name.
  useEffect(() => {
    if (!handle && suggestion.length >= 3) setHandle(suggestion);
  }, [suggestion, handle]);

  const formatError = useMemo(() => {
    if (!handle) return null;
    if (!HANDLE_RE.test(handle)) {
      return t("gs.handleFormatError", { defaultValue: "3–30 chars: lowercase letters, numbers, - or _" });
    }
    return null;
  }, [handle, t]);

  const debounced = useDebounce(handle, 400);
  useEffect(() => {
    setAvailability(null);
    setChecking(Boolean(handle && !formatError));
  }, [handle, formatError]);

  useEffect(() => {
    const h = debounced.trim().toLowerCase();
    if (!h || formatError) {
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
  }, [debounced, formatError]);

  const canClaim = !!handle && !formatError && !checking && availability?.available === true && !saving;

  const claim = async () => {
    if (!canClaim) return;
    setSaving(true);
    setError(null);
    try {
      const profilePayload: Record<string, unknown> = { handle: handle.trim().toLowerCase() };
      if (bio.trim()) profilePayload.bio = bio.trim();
      if (coverImage) {
        profilePayload.cover_image = coverImage;
        profilePayload.theme_cover_style = "image";
      }
      await axiosBaseApi.put(API_ENDPOINTS.creator.profile, profilePayload);
      dispatch(UserAction(USER_PROFILE_FETCH));
      await mutateStorefront();
      trackOnboarding({ event_type: "step_completed", step_key: "link", metadata: { surface: "wizard", track: "creators" } });
      onNext(handle.trim().toLowerCase());
    } catch (e: any) {
      setError(e?.response?.data?.message || t("gs.handleClaimFailed", { defaultValue: "Couldn't claim that handle — please try again." }));
    } finally {
      setSaving(false);
    }
  };

  const hintColor = formatError || availability?.available === false
    ? theme.palette.error.main
    : availability?.available
      ? positive
      : muted;
  const hintText =
    formatError
    || (availability && availability.available === false && (availability.reason || t("gs.handleTaken", { defaultValue: "That handle is taken — try another." })))
    || (availability?.available
      ? t("gs.handleAvailable", { url: `${siteDomain}/${handle}`, defaultValue: "{{url}} is available — grab it!" })
      : t("gs.handlePickHint", { defaultValue: "Pick a short, memorable handle for your public page." }));

  // Already has a handle → summary + keep it.
  if (hasHandle && currentHandle) {
    return (
      <Box data-testid="gs-step-handle">
        <StepHeader
          eyebrow={t("gs.stepOf", { n: 4, total: 5, defaultValue: "Step {{n}} of {{total}}" })}
          title={t("gs.handleDoneTitle", { defaultValue: "Your page is claimed" })}
          subtitle={t("gs.handleDoneSubtitle", { defaultValue: "Your public creator page and checkout URL are live. You can fine-tune the look anytime." })}
        />
        <Box
          data-testid="gs-existing-handle"
          sx={{ mb: 1, p: 2, borderRadius: "14px", border: `1px solid ${indigo}`, backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <Box sx={{ color: positive, display: "flex" }}><Icon name="circle-check" size={22} /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>
              {t("gs.handleYourPage", { defaultValue: "Your page" })}
            </Box>
            <Box sx={{ fontFamily: MONO, fontSize: 13.5, color: ink, mt: 0.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {siteDomain}/{currentHandle}
            </Box>
          </Box>
        </Box>
        <StepFooter
          onBack={onBack}
          primaryLabel={t("gs.keepHandle", { handle: currentHandle, defaultValue: "Keep @{{handle}}" })}
          onPrimary={() => {
            trackOnboarding({ event_type: "step_completed", step_key: "link", metadata: { surface: "wizard", track: "creators" } });
            onNext(currentHandle);
          }}
          primaryTestId="gs-use-existing-handle"
          secondaryLabel={t("gs.handleOpenEditor", { defaultValue: "Open page editor" })}
          onSecondary={() => router.push("/storefront?tab=page")}
          secondaryTestId="gs-handle-open-editor"
        />
      </Box>
    );
  }

  return (
    <Box data-testid="gs-step-handle">
      <StepHeader
        eyebrow={t("gs.stepOf", { n: 4, total: 5, defaultValue: "Step {{n}} of {{total}}" })}
        title={t("gs.handleTitle", { defaultValue: "Claim your @handle" })}
        subtitle={t("gs.handleSubtitle", { defaultValue: "This becomes your public page and checkout link. Fans open it and tips land straight in your wallet — no other setup needed." })}
      />

      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          border: `1px solid ${availability && availability.available === false ? theme.palette.error.main : border}`,
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: surface,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", px: 1.5, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", fontFamily: MONO, fontSize: 13, color: muted, whiteSpace: "nowrap" }}>
          {siteDomain}/
        </Box>
        <Box
          component="input"
          data-testid="gs-handle-input"
          value={handle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setHandle(e.target.value.toLowerCase().replace(/\s/g, "").replace(/[^a-z0-9_-]/g, "").slice(0, 30))
          }
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" && canClaim) { e.preventDefault(); void claim(); } }}
          placeholder={suggestion || "yourname"}
          sx={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "12px", fontFamily: MONO, fontSize: 14.5, color: ink, minWidth: 0 }}
        />
        <Box sx={{ display: "flex", alignItems: "center", px: 1.5 }}>
          {checking ? (
            <CircularProgress size={15} />
          ) : handle && availability?.available ? (
            <Icon name="circle-check" size={18} color={positive} />
          ) : handle && availability && !availability.available ? (
            <Icon name="circle-x" size={18} color={theme.palette.error.main} />
          ) : null}
        </Box>
      </Box>
      <Box data-testid="gs-handle-hint" sx={{ mt: 0.75, ml: 0.25, fontFamily: "var(--font-sans)", fontSize: 12.5, color: hintColor }}>
        {hintText}
      </Box>

      {error && (
        <Box role="alert" data-testid="gs-handle-error" sx={{ mt: 1, fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.error.main }}>
          {error}
        </Box>
      )}

      {/* Optional cover + bio — collapsed by default so the step stays focused (2b). */}
      <Box sx={{ mt: 2.5 }}>
        <Box
          component="button"
          type="button"
          data-testid="gs-handle-extras-toggle"
          aria-expanded={showExtras}
          onClick={() => setShowExtras((v) => !v)}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, border: 0, p: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 700, color: indigo }}
        >
          <Icon name="image" size={16} />
          {t("gs.handleExtrasToggle", { defaultValue: "Add a cover image & bio" })}
          <Icon name={showExtras ? "chevron-up" : "chevron-down"} size={16} />
        </Box>

        {showExtras && (
          <Box data-testid="gs-handle-extras" sx={{ mt: 1.5, display: "grid", gap: 2 }}>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, lineHeight: 1.5 }}>
              {t("gs.handleExtrasNote", { defaultValue: "A cover and bio make your page feel complete from day one — you can change them anytime." })}
            </Box>

            <Box>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: ink, mb: 0.75, ml: 0.25 }}>
                {t("gs.handleCoverLabel", { defaultValue: "Cover image" })}
              </Box>
              <input ref={coverFileRef} type="file" accept="image/*" data-testid="gs-handle-cover-file" style={{ display: "none" }} onChange={(e) => void uploadCoverFile(e.target.files?.[0])} />
              {coverImage ? (
                <Box data-testid="gs-handle-cover-preview" sx={{ position: "relative", borderRadius: "14px", overflow: "hidden", border: `1px solid ${border}` }}>
                  <Box component="img" src={coverImage} alt="" sx={{ display: "block", width: "100%", height: 140, objectFit: "cover" }} />
                  <Box sx={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 1 }}>
                    <Box component="button" type="button" data-testid="gs-handle-cover-replace" onClick={() => { if (!uploadingCover) coverFileRef.current?.click(); }} sx={chipBtn}>
                      <Icon name="pencil" size={13} /> {t("gs.handleCoverReplace", { defaultValue: "Replace image" })}
                    </Box>
                    <Box component="button" type="button" data-testid="gs-handle-cover-remove" onClick={() => setCoverImage(null)} sx={chipBtn}>
                      <Icon name="trash-2" size={13} /> {t("gs.handleCoverRemove", { defaultValue: "Remove" })}
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box
                  data-testid="gs-handle-cover-dropzone"
                  onClick={() => { if (!uploadingCover) coverFileRef.current?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); setCoverDrag(true); }}
                  onDragLeave={() => setCoverDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setCoverDrag(false); void uploadCoverFile(e.dataTransfer.files?.[0]); }}
                  sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, minHeight: 112, borderRadius: "14px", border: `1.5px dashed ${coverDrag ? indigo : border}`, backgroundColor: coverDrag ? (isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow) : surface, cursor: uploadingCover ? "default" : "pointer", textAlign: "center", px: 2 }}
                >
                  {uploadingCover ? (
                    <>
                      <CircularProgress size={22} />
                      <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>{t("gs.handleCoverUploading", { defaultValue: "Uploading…" })}</Box>
                    </>
                  ) : (
                    <>
                      <Box sx={{ color: indigo, display: "flex" }}><Icon name="image" size={24} /></Box>
                      <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
                        {coverDrag ? t("gs.handleCoverDrop", { defaultValue: "Drop image to upload" }) : t("gs.handleCoverHint", { defaultValue: "Drag & drop or click to upload (up to 10 MB)" })}
                      </Box>
                    </>
                  )}
                </Box>
              )}
              {coverError && (
                <Box role="alert" data-testid="gs-handle-cover-error" sx={{ mt: 0.75, fontFamily: "var(--font-sans)", fontSize: 12.5, color: theme.palette.error.main }}>{coverError}</Box>
              )}
            </Box>

            <Box>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: ink, mb: 0.75, ml: 0.25 }}>{t("gs.handleBioLabel", { defaultValue: "Bio" })}</Box>
              <Box
                component="textarea"
                data-testid="gs-handle-bio-input"
                value={bio}
                maxLength={500}
                rows={3}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
                placeholder={t("gs.handleBioPlaceholder", { defaultValue: "Tell visitors who you are and what you're about…" })}
                sx={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: `1px solid ${border}`, borderRadius: "12px", outline: "none", background: surface, padding: "12px", fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: ink, "&:focus": { borderColor: theme.palette.primary.main } }}
              />
              <Box sx={{ mt: 0.25, textAlign: "right", fontFamily: MONO, fontSize: 11, color: muted }}>{bio.length}/500</Box>
            </Box>
          </Box>
        )}
      </Box>

      <StepFooter
        onBack={onBack}
        primaryLabel={saving ? t("gs.claiming", { defaultValue: "Claiming…" }) : t("gs.claimHandle", { handle: handle || "handle", defaultValue: "Claim @{{handle}}" })}
        onPrimary={claim}
        primaryLoading={saving}
        primaryDisabled={!canClaim}
        primaryTestId="gs-handle-claim"
        secondaryLabel={t("gs.handleOpenEditor", { defaultValue: "Open page editor" })}
        onSecondary={() => router.push("/storefront?tab=page")}
        secondaryTestId="gs-handle-open-editor"
      />
    </Box>
  );
};

export default StepClaimHandle;
