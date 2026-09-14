/**
 * DonationSettingsSection — campaign form for donation / crowdfunding links.
 * Replaces PaymentSettingsBasic + DescriptionSection when the merchant picks
 * the "Crowdfunding" link type on the create-pay-link page.
 *
 * Session 53 (2026-07-15) restructured the form into 3 sections for a
 * dramatically shorter default view:
 *   • Essentials         — ALWAYS visible (title, goal+currency, minimum,
 *                          suggested amounts, end date, blockchain fees).
 *   • Story & media      — Collapsible. Rich Markdown story + cover image +
 *                          photo gallery (up to 12 photos — NEW UI, session 53).
 *   • More details       — Collapsible. Category, minimum donation, thank-you
 *                          message, beneficiary (NEW UI, session 53), display
 *                          toggles (progress / supporters / custom / auto-close).
 *
 * Removed in session 53 (redundant fields):
 *   • Old "Purpose / story" 500-char blurb — replaced by rich `storyMd`.
 *   • Old "Campaign ends" dropdown (No/24h/7d/30d) — replaced by the
 *     specific `endsAt` date picker which is more precise.
 */
import React, { useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Menu,
  MenuItem,
  Switch,
  Typography,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { toNumber } from "@/utils/money";
import ImageDropTarget from "@/Components/UI/ImageDropTarget";

export interface DonationBeneficiary {
  name: string;
  description?: string;
}

export interface DonationSettingsState {
  title: string;
  goalAmount: string;
  minAmount: string;
  presets: number[];
  allowCustom: boolean;
  showProgress: boolean;
  showSupporters: boolean;
  autoCloseAtGoal: boolean;
  campaignImage: string | null;
  // ── Crowdfunding v2 (Phase 3 — GoFundMe-lite) ──
  /** Rich Markdown campaign body — replaces plain description for donation pages. */
  storyMd: string;
  /** Optional campaign end date (ISO local string yyyy-mm-dd or empty). */
  endsAt: string;
  /** Taxonomy: medical | community | creative | emergency | education | animal | environment | memorial | sports | faith | other. Empty = uncategorised. */
  category: string;
  /** Custom thank-you message shown post-contribution + as auto-email intro. */
  organizerThanks: string;
  /** Supporting photos (URLs) — up to 12. Cover stays in `campaignImage`. */
  gallery: Array<{ url: string; caption?: string }>;
  /** Optional beneficiary block ("Who receives the funds"). Session 53 exposed this in the UI. */
  beneficiary: DonationBeneficiary | null;
}

export interface DonationErrors {
  title?: string;
  goalAmount?: string;
  minAmount?: string;
  presets?: string;
  storyMd?: string;
  endsAt?: string;
  category?: string;
  organizerThanks?: string;
  gallery?: string;
  beneficiary?: string;
}

interface DonationSettingsSectionProps {
  isMobile: boolean;
  settings: DonationSettingsState;
  onChange: (patch: Partial<DonationSettingsState>) => void;
  errors: DonationErrors;
  clearError: (field: keyof DonationErrors) => void;
  currency: string;
  currencies: string[];
  onCurrencyChange: (c: string) => void;
  feePayer: string;
  onFeePayerChange: (v: string) => void;
  onUploadImage: (file: File) => void;
  imageUploading: boolean;
}

const MAX_PRESETS = 6;
const MAX_GALLERY_PHOTOS = 12;

// ── Collapsible section wrapper (session 53) ──
// Defined at MODULE level (not inside DonationSettingsSection) so React
// doesn't tear down its subtree on every parent re-render. See ESLint rule
// react/no-unstable-nested-components.
const CollapsibleSection = ({
  title,
  hint,
  children,
  defaultOpen = false,
  testid,
  badge,
  theme,
  isDark,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testid?: string;
  badge?: string;
  theme: any;
  isDark: boolean;
}) => {
  const green = "#10B981";
  return (
    <Box
      component="details"
      data-testid={testid}
      // NOTE: React doesn't reliably control `open` on <details> (browser owns it),
      // so we use `defaultOpen` for initial state only. Users toggle via clicks.
      {...(defaultOpen ? { open: true } : {})}
      sx={{
        border: `1px solid ${theme.palette.border.main}`,
        borderRadius: "12px",
        overflow: "hidden",
        "&[open] > summary::after": { transform: "rotate(180deg)" },
        "& > summary::-webkit-details-marker": { display: "none" },
      }}
    >
      <Box
        component="summary"
        sx={{
          px: 2,
          py: 1.5,
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          "&:hover": { backgroundColor: theme.palette.action.hover },
          "&::after": {
            content: "'▾'",
            display: "inline-block",
            transition: "transform 180ms ease",
            fontSize: 14,
            color: theme.palette.text.secondary,
            marginLeft: 8,
          },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: theme.palette.text.primary }}>
              {title}
            </Typography>
            {badge && (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  px: 0.75,
                  py: 0.125,
                  borderRadius: "6px",
                  fontSize: 11,
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  backgroundColor: isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.12)",
                  color: green,
                }}
              >
                {badge}
              </Box>
            )}
          </Box>
          {hint && (
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: theme.palette.text.secondary, mt: 0.25 }}>
              {hint}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ borderTop: `1px solid ${theme.palette.border.main}`, p: 2, display: "flex", flexDirection: "column", gap: 2.25 }}>
        {children}
      </Box>
    </Box>
  );
};

const DonationSettingsSection = ({
  isMobile,
  settings,
  onChange,
  errors,
  clearError,
  currency,
  currencies,
  onCurrencyChange,
  feePayer,
  onFeePayerChange,
  onUploadImage,
  imageUploading,
}: DonationSettingsSectionProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("createPaymentLinkScreen");
  const green = "#10B981";

  const [presetInput, setPresetInput] = useState("");
  const [currencyAnchor, setCurrencyAnchor] = useState<null | HTMLElement>(null);
  const [galleryUrlDraft, setGalleryUrlDraft] = useState("");
  const [galleryCaptionDraft, setGalleryCaptionDraft] = useState("");
  const [galleryError, setGalleryError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const labelSx = {
    fontSize: "14px",
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    color: theme.palette.text.primary,
    mb: 0.75,
  };
  const hintSx = {
    fontSize: "12px",
    fontFamily: "var(--font-sans)",
    color: theme.palette.text.secondary,
  };
  const inputSx = (hasError?: boolean) => ({
    width: "100%",
    p: "10px 14px",
    borderRadius: "10px",
    border: `1px solid ${hasError ? theme.palette.error.main : theme.palette.border.main}`,
    bgcolor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const,
    "&:focus": {
      borderColor: hasError ? theme.palette.error.main : green,
    },
    "&::placeholder": { color: theme.palette.text.disabled },
  });
  const errorSx = {
    fontSize: "12px",
    fontFamily: "var(--font-sans)",
    color: theme.palette.error.main,
    mt: "4px",
  };
  const selectTriggerSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1,
    p: "10px 14px",
    borderRadius: "10px",
    border: `1px solid ${theme.palette.border.main}`,
    cursor: "pointer",
    userSelect: "none" as const,
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
    color: theme.palette.text.primary,
    "&:hover": { borderColor: green },
  };

  const sanitizeAmount = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const safe = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    return parts[1]?.length > 2 ? `${parts[0]}.${parts[1].slice(0, 2)}` : safe;
  };

  const addPreset = () => {
    const n = toNumber(parseFloat(presetInput), 2);
    if (!Number.isFinite(n) || n <= 0) return;
    if (settings.presets.includes(n)) {
      setPresetInput("");
      return;
    }
    if (settings.presets.length >= MAX_PRESETS) return;
    onChange({ presets: [...settings.presets, n].sort((a, b) => a - b) });
    clearError("presets");
    setPresetInput("");
  };

  const removePreset = (n: number) => {
    onChange({ presets: settings.presets.filter((p) => p !== n) });
  };

  // ── Gallery helpers (session 53 — new UI) ──
  const addGalleryPhoto = () => {
    setGalleryError("");
    const url = galleryUrlDraft.trim();
    if (!url) {
      setGalleryError(t("donationGalleryEmptyUrl", { defaultValue: "Enter a photo URL first." }));
      return;
    }
    if (!/^(https?:\/\/|\/)/i.test(url)) {
      setGalleryError(t("donationGalleryInvalidUrl", { defaultValue: "URL must start with http(s):// or / (for hosted assets)." }));
      return;
    }
    if (url.length > 512) {
      setGalleryError(t("donationGalleryUrlTooLong", { defaultValue: "URL is too long (max 512 chars)." }));
      return;
    }
    if (settings.gallery.length >= MAX_GALLERY_PHOTOS) {
      setGalleryError(t("donationGalleryMaxReached", { max: MAX_GALLERY_PHOTOS, defaultValue: "Maximum {{max}} photos allowed." }));
      return;
    }
    // Duplicate URL check
    if (settings.gallery.some((p) => p.url === url)) {
      setGalleryError(t("donationGalleryDuplicate", { defaultValue: "This photo is already in the gallery." }));
      return;
    }
    const caption = galleryCaptionDraft.trim().slice(0, 240);
    const next = [...settings.gallery, { url, ...(caption ? { caption } : {}) }];
    onChange({ gallery: next });
    setGalleryUrlDraft("");
    setGalleryCaptionDraft("");
    if (errors.gallery) clearError("gallery");
  };
  const removeGalleryPhoto = (idx: number) => {
    onChange({ gallery: settings.gallery.filter((_, i) => i !== idx) });
  };

  // ── Beneficiary helpers (session 53 — new UI) ──
  const updateBeneficiary = (patch: Partial<DonationBeneficiary>) => {
    const current = settings.beneficiary || { name: "", description: "" };
    const nextName = patch.name !== undefined ? patch.name : (current.name || "");
    const nextDesc = patch.description !== undefined ? patch.description : (current.description || "");
    if (!nextName.trim() && !nextDesc.trim()) {
      onChange({ beneficiary: null });
    } else {
      onChange({
        beneficiary: {
          name: nextName,
          ...(nextDesc.trim() ? { description: nextDesc } : {}),
        },
      });
    }
    if (errors.beneficiary) clearError("beneficiary");
  };

  const toggleRow = (
    labelKey: string,
    labelDefault: string,
    hintKey: string,
    hintDefault: string,
    checked: boolean,
    onToggle: (v: boolean) => void,
    testid: string
  ) => (
    <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} py={1}>
      <Box>
        <Typography sx={{ ...labelSx, mb: 0 }}>{t(labelKey, { defaultValue: labelDefault })}</Typography>
        <Typography sx={hintSx}>{t(hintKey, { defaultValue: hintDefault })}</Typography>
      </Box>
      <Switch
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        data-testid={testid}
        sx={{
          "& .MuiSwitch-switchBase.Mui-checked": { color: green },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: green },
        }}
      />
    </Box>
  );

  // ── Collapsible section wrapper is defined at module level (see top of file). ──

  // Determine which optional sections have data so the summary hints stay accurate
  const storyHasContent = Boolean(settings.storyMd?.trim() || settings.campaignImage || (settings.gallery && settings.gallery.length > 0));
  const detailsHasContent = Boolean(
    settings.category ||
      settings.organizerThanks?.trim() ||
      (settings.beneficiary && (settings.beneficiary.name?.trim() || settings.beneficiary.description?.trim())) ||
      !settings.showProgress ||
      !settings.showSupporters ||
      !settings.allowCustom ||
      settings.autoCloseAtGoal
  );

  return (
    <Box display="flex" flexDirection="column" gap={2.25} data-testid="donation-settings-section">
      {/* ══════════ ESSENTIALS (always visible) ══════════ */}

      {/* Campaign title */}
      <Box>
        <Typography sx={labelSx}>
          {t("donationTitleLabel", { defaultValue: "Campaign title" })}{" "}
          <Typography component="span" sx={{ color: theme.palette.error.main, fontSize: 14 }}>*</Typography>
        </Typography>
        <Box
          component="input"
          type="text"
          maxLength={120}
          data-testid="donation-title-input"
          value={settings.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onChange({ title: e.target.value });
            clearError("title");
          }}
          placeholder={t("donationTitlePlaceholder", { defaultValue: "e.g. Help us build the community garden" })}
          sx={inputSx(Boolean(errors.title))}
        />
        {errors.title && <Typography sx={errorSx}>{errors.title}</Typography>}
      </Box>

      {/* Goal amount + currency / minimum */}
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={2}>
        <Box>
          <Typography sx={labelSx}>{t("donationGoalLabel", { defaultValue: "Goal amount" })}</Typography>
          <Box display="flex" gap={1}>
            <Box
              component="input"
              inputMode="decimal"
              data-testid="donation-goal-input"
              value={settings.goalAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                onChange({ goalAmount: sanitizeAmount(e.target.value) });
                clearError("goalAmount");
              }}
              placeholder={t("donationGoalPlaceholder", { defaultValue: "e.g. 5000" })}
              sx={{ ...inputSx(Boolean(errors.goalAmount)), flex: 1, fontVariantNumeric: "tabular-nums" }}
            />
            <Box
              data-testid="donation-currency-select"
              onClick={(e: React.MouseEvent<HTMLElement>) => setCurrencyAnchor(e.currentTarget)}
              sx={{ ...selectTriggerSx, minWidth: 86, flexShrink: 0 }}
            >
              <span>{currency}</span>
              <Icon icon="mdi:chevron-down" width={16} />
            </Box>
            <Menu
              anchorEl={currencyAnchor}
              open={Boolean(currencyAnchor)}
              onClose={() => setCurrencyAnchor(null)}
            >
              {currencies.map((c) => (
                <MenuItem
                  key={c}
                  selected={c === currency}
                  onClick={() => {
                    onCurrencyChange(c);
                    setCurrencyAnchor(null);
                  }}
                  sx={{ fontSize: 14, fontFamily: "var(--font-sans)" }}
                >
                  {c}
                </MenuItem>
              ))}
            </Menu>
          </Box>
          {errors.goalAmount ? (
            <Typography sx={errorSx}>{errors.goalAmount}</Typography>
          ) : (
            <Typography sx={{ ...hintSx, mt: "4px" }}>
              {t("donationGoalHint", { defaultValue: "Leave empty for an open-ended collection." })}
            </Typography>
          )}
        </Box>
        <Box>
          <Typography sx={labelSx}>{t("donationMinLabel", { defaultValue: "Minimum donation" })}</Typography>
          <Box
            component="input"
            inputMode="decimal"
            data-testid="donation-min-input"
            value={settings.minAmount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              onChange({ minAmount: sanitizeAmount(e.target.value) });
              clearError("minAmount");
            }}
            placeholder="1"
            sx={{ ...inputSx(Boolean(errors.minAmount)), fontVariantNumeric: "tabular-nums" }}
          />
          {errors.minAmount ? (
            <Typography sx={errorSx}>{errors.minAmount}</Typography>
          ) : (
            <Typography sx={{ ...hintSx, mt: "4px" }}>
              {t("donationMinHint", { defaultValue: "Protects against dust payments. Default 1." })}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Preset amounts */}
      <Box>
        <Typography sx={labelSx}>
          {t("donationPresetsLabel", { defaultValue: "Suggested amounts" })}{" "}
          <Typography component="span" sx={{ ...hintSx, display: "inline" }}>
            ({t("donationPresetsMax", { defaultValue: "up to 6" })})
          </Typography>
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={1} mb={settings.presets.length ? 1 : 0}>
          {settings.presets.map((p) => (
            <Box
              key={p}
              data-testid={`donation-preset-chip-${p}`}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 1.25,
                py: 0.5,
                borderRadius: "999px",
                border: `1px solid ${green}`,
                color: green,
                backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.07)",
                fontFamily: "var(--font-sans)",
                fontSize: 13.5,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {p} {currency}
              <Box
                component="span"
                role="button"
                aria-label={`remove ${p}`}
                onClick={() => removePreset(p)}
                sx={{ display: "inline-flex", cursor: "pointer", ml: 0.25, "&:hover": { opacity: 0.7 } }}
              >
                <Icon icon="mdi:close" width={14} />
              </Box>
            </Box>
          ))}
        </Box>
        <Box display="flex" gap={1}>
          <Box
            component="input"
            inputMode="decimal"
            data-testid="donation-preset-input"
            value={presetInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPresetInput(sanitizeAmount(e.target.value))}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPreset();
              }
            }}
            placeholder={t("donationPresetPlaceholder", { defaultValue: "e.g. 25" })}
            sx={{ ...inputSx(Boolean(errors.presets)), flex: 1, fontVariantNumeric: "tabular-nums" }}
            disabled={settings.presets.length >= MAX_PRESETS}
          />
          <Box
            role="button"
            tabIndex={0}
            data-testid="donation-preset-add"
            onClick={addPreset}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                addPreset();
              }
            }}
            sx={{
              ...selectTriggerSx,
              justifyContent: "center",
              minWidth: 88,
              flexShrink: 0,
              fontWeight: 600,
              borderColor: green,
              color: green,
              opacity: settings.presets.length >= MAX_PRESETS ? 0.4 : 1,
              pointerEvents: settings.presets.length >= MAX_PRESETS ? "none" : "auto",
            }}
          >
            <Icon icon="mdi:plus" width={16} />
            {t("donationPresetAdd", { defaultValue: "Add" })}
          </Box>
        </Box>
        {errors.presets && <Typography sx={errorSx}>{errors.presets}</Typography>}
      </Box>

      {/* End date + blockchain fees (2-col on desktop, stacked on mobile) */}
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={2}>
        <Box>
          <Typography sx={labelSx}>
            {t("donationEndsAtLabel", { defaultValue: "Campaign end date" })}{" "}
            <Typography component="span" sx={{ ...hintSx, display: "inline" }}>
              ({t("optional", { defaultValue: "Optional" })})
            </Typography>
          </Typography>
          <Box
            component="input"
            type="date"
            data-testid="donation-ends-at"
            value={settings.endsAt}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (errors.endsAt) clearError("endsAt");
              onChange({ endsAt: e.target.value });
            }}
            sx={inputSx(Boolean(errors.endsAt))}
          />
          {errors.endsAt ? (
            <Typography sx={errorSx}>{errors.endsAt}</Typography>
          ) : (
            <Typography sx={{ ...hintSx, mt: "4px" }}>
              {t("donationEndsAtHint2", { defaultValue: "Shows a countdown. Leave empty for open-ended." })}
            </Typography>
          )}
        </Box>
        <Box>
          <Typography sx={labelSx}>{t("blockchainFees", { defaultValue: "Blockchain fees" })}</Typography>
          <Box display="flex" gap={1}>
            {[
              { value: "company", label: t("feePayerCompany", { defaultValue: "I pay" }) },
              { value: "customer", label: t("feePayerDonor", { defaultValue: "Donor pays" }) },
            ].map((o) => {
              const active = (feePayer || "company") === o.value;
              return (
                <Box
                  key={o.value}
                  role="button"
                  tabIndex={0}
                  data-testid={`donation-fee-${o.value}`}
                  onClick={() => onFeePayerChange(o.value)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onFeePayerChange(o.value);
                    }
                  }}
                  sx={{
                    flex: 1,
                    textAlign: "center",
                    p: "10px 8px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    userSelect: "none",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13.5,
                    fontWeight: 600,
                    border: `1.5px solid ${active ? green : theme.palette.border.main}`,
                    color: active ? green : theme.palette.text.secondary,
                    backgroundColor: active
                      ? isDark
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(16,185,129,0.07)"
                      : "transparent",
                    transition: "all 120ms ease",
                  }}
                >
                  {o.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* ══════════ SECTION: Story & Media (collapsible) ══════════ */}
      <CollapsibleSection
        title={t("donationSectionStoryMedia", { defaultValue: "Story & media" })}
        hint={t("donationSectionStoryMediaHint", { defaultValue: "Rich Markdown story, cover image, and up to 12 gallery photos" })}
        testid="donation-section-story-media"
        defaultOpen={storyHasContent}
        badge={storyHasContent ? t("filled", { defaultValue: "Filled" }) : undefined}
        theme={theme}
        isDark={isDark}
      >
        {/* Cover image */}
        <Box>
          <Typography sx={labelSx}>
            {t("donationImageLabel", { defaultValue: "Cover image" })}{" "}
            <Typography component="span" sx={{ ...hintSx, display: "inline" }}>
              ({t("optional", { defaultValue: "Optional" })})
            </Typography>
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: "none" }}
            data-testid="donation-image-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadImage(f);
              e.target.value = "";
            }}
          />
          <ImageDropTarget onFile={(f) => onUploadImage(f)} disabled={imageUploading} radius={12} testId="donation-image-dropzone">
          {settings.campaignImage ? (
            <Box
              position="relative"
              borderRadius="12px"
              overflow="hidden"
              border={`1px solid ${theme.palette.border.main}`}
              data-testid="donation-image-preview"
            >
              <Box
                component="img"
                src={settings.campaignImage}
                alt="Campaign cover"
                sx={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
              />
              <Box
                role="button"
                data-testid="donation-image-remove"
                onClick={() => onChange({ campaignImage: null })}
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 28,
                  height: 28,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  backgroundColor: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  "&:hover": { backgroundColor: "rgba(0,0,0,0.75)" },
                }}
              >
                <Icon icon="mdi:trash-can-outline" width={16} />
              </Box>
            </Box>
          ) : (
            <Box
              role="button"
              tabIndex={0}
              data-testid="donation-image-upload"
              onClick={() => !imageUploading && fileInputRef.current?.click()}
              onKeyDown={(e: React.KeyboardEvent) => {
                if ((e.key === "Enter" || e.key === " ") && !imageUploading) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.75,
                py: 2.5,
                borderRadius: "12px",
                border: `1.5px dashed ${theme.palette.border.main}`,
                cursor: imageUploading ? "default" : "pointer",
                color: theme.palette.text.secondary,
                "&:hover": imageUploading ? {} : { borderColor: green, color: green },
                transition: "all 140ms ease",
              }}
            >
              {imageUploading ? (
                <CircularProgress size={22} sx={{ color: green }} />
              ) : (
                <Icon icon="mdi:image-plus-outline" width={24} />
              )}
              <Typography sx={{ ...hintSx, fontWeight: 500 }}>
                {imageUploading
                  ? t("donationImageUploading", { defaultValue: "Uploading…" })
                  : t("donationImageCta", { defaultValue: "Drag & drop or click to upload (PNG, JPG, WEBP — max 10MB)" })}
              </Typography>
            </Box>
          )}
          </ImageDropTarget>
        </Box>

        {/* Campaign story (Markdown) */}
        <Box>
          <Typography sx={labelSx}>
            {t("donationStoryLabel", { defaultValue: "Campaign story" })}
          </Typography>
          <Typography sx={{ ...hintSx, mb: 1 }}>
            {t("donationStoryHint", { defaultValue: "Tell your story: who this is for, why it matters, and how funds will be used. Markdown supported (headings, **bold**, lists, links)." })}
          </Typography>
          <Box
            component="textarea"
            data-testid="donation-story"
            placeholder={t("donationStoryPlaceholder", { defaultValue: "## Our story\n\nWrite something that will inspire people to contribute…\n\n**Where your contribution goes:**\n- Item 1\n- Item 2" })}
            value={settings.storyMd}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              if (errors.storyMd) clearError("storyMd");
              onChange({ storyMd: e.target.value });
            }}
            sx={{
              width: "100%",
              minHeight: 200,
              resize: "vertical",
              p: 1.5,
              borderRadius: "10px",
              border: `1px solid ${errors.storyMd ? theme.palette.error.main : theme.palette.border.main}`,
              outline: "none",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              lineHeight: 1.55,
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.background.paper,
              transition: "border-color 120ms ease",
              "&:focus": { borderColor: green },
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
            {errors.storyMd ? (
              <Typography sx={errorSx}>{errors.storyMd}</Typography>
            ) : (
              <Box />
            )}
            <Typography sx={{ ...hintSx, fontSize: 11 }}>{settings.storyMd.length}/20,000</Typography>
          </Box>
        </Box>

        {/* Gallery (NEW — session 53) */}
        <Box>
          <Typography sx={labelSx}>
            {t("donationGalleryLabel", { defaultValue: "Photo gallery" })}{" "}
            <Typography component="span" sx={{ ...hintSx, display: "inline" }}>
              ({settings.gallery.length}/{MAX_GALLERY_PHOTOS})
            </Typography>
          </Typography>
          <Typography sx={{ ...hintSx, mb: 1 }}>
            {t("donationGalleryHint", { defaultValue: "Add up to 12 photos with optional captions. Shown as a grid on your public campaign page below the story." })}
          </Typography>

          {/* Existing photos grid */}
          {settings.gallery.length > 0 && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
                gap: 1.25,
                mb: 1.5,
              }}
              data-testid="donation-gallery-grid"
            >
              {settings.gallery.map((p, idx) => (
                <Box
                  key={`${p.url}-${idx}`}
                  sx={{
                    position: "relative",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: `1px solid ${theme.palette.border.main}`,
                    backgroundColor: theme.palette.background.paper,
                  }}
                  data-testid={`donation-gallery-item-${idx}`}
                >
                  <Box
                    component="img"
                    src={p.url}
                    alt={p.caption || `Photo ${idx + 1}`}
                    sx={{ width: "100%", height: 90, objectFit: "cover", display: "block" }}
                    onError={(e: any) => {
                      // Broken URL fallback
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  {p.caption && (
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontFamily: "var(--font-sans)",
                        color: theme.palette.text.secondary,
                        p: 0.75,
                        borderTop: `1px solid ${theme.palette.border.main}`,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                      title={p.caption}
                    >
                      {p.caption}
                    </Typography>
                  )}
                  <Box
                    role="button"
                    aria-label={`Remove photo ${idx + 1}`}
                    data-testid={`donation-gallery-remove-${idx}`}
                    onClick={() => removeGalleryPhoto(idx)}
                    sx={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      backgroundColor: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      "&:hover": { backgroundColor: "rgba(0,0,0,0.8)" },
                    }}
                  >
                    <Icon icon="mdi:close" width={14} />
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Add photo form */}
          {settings.gallery.length < MAX_GALLERY_PHOTOS && (
            <Box display="flex" flexDirection="column" gap={1}>
              <Box display="flex" gap={1} flexDirection={{ xs: "column", sm: "row" }}>
                <Box
                  component="input"
                  type="url"
                  data-testid="donation-gallery-url-input"
                  value={galleryUrlDraft}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setGalleryUrlDraft(e.target.value);
                    if (galleryError) setGalleryError("");
                  }}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGalleryPhoto();
                    }
                  }}
                  placeholder={t("donationGalleryUrlPlaceholder", { defaultValue: "https://example.com/photo.jpg" })}
                  sx={{ ...inputSx(Boolean(galleryError)), flex: 2 }}
                />
                <Box
                  component="input"
                  type="text"
                  data-testid="donation-gallery-caption-input"
                  value={galleryCaptionDraft}
                  maxLength={240}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGalleryCaptionDraft(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGalleryPhoto();
                    }
                  }}
                  placeholder={t("donationGalleryCaptionPlaceholder", { defaultValue: "Caption (optional)" })}
                  sx={{ ...inputSx(false), flex: 1 }}
                />
                <Box
                  role="button"
                  tabIndex={0}
                  data-testid="donation-gallery-add"
                  onClick={addGalleryPhoto}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      addGalleryPhoto();
                    }
                  }}
                  sx={{
                    ...selectTriggerSx,
                    justifyContent: "center",
                    minWidth: 108,
                    flexShrink: 0,
                    fontWeight: 600,
                    borderColor: green,
                    color: green,
                  }}
                >
                  <Icon icon="mdi:plus" width={16} />
                  {t("donationGalleryAdd", { defaultValue: "Add photo" })}
                </Box>
              </Box>
              {galleryError && <Typography sx={errorSx}>{galleryError}</Typography>}
              {errors.gallery && !galleryError && <Typography sx={errorSx}>{errors.gallery}</Typography>}
            </Box>
          )}
          {settings.gallery.length >= MAX_GALLERY_PHOTOS && (
            <Typography sx={{ ...hintSx, mt: 1, fontStyle: "italic" }}>
              {t("donationGalleryFull", { max: MAX_GALLERY_PHOTOS, defaultValue: "Gallery is full ({{max}}/{{max}}). Remove a photo to add another." })}
            </Typography>
          )}
        </Box>
      </CollapsibleSection>

      {/* ══════════ SECTION: More details (collapsible) ══════════ */}
      <CollapsibleSection
        title={t("donationSectionDetails", { defaultValue: "More details" })}
        hint={t("donationSectionDetailsHint", { defaultValue: "Category, thank-you message, beneficiary, and display options" })}
        testid="donation-section-details"
        defaultOpen={detailsHasContent}
        badge={detailsHasContent ? t("filled", { defaultValue: "Filled" }) : undefined}
        theme={theme}
        isDark={isDark}
      >
        {/* Category */}
        <Box>
          <Typography sx={labelSx}>{t("donationCategoryLabel", { defaultValue: "Category" })}</Typography>
          <Typography sx={{ ...hintSx, mb: 1 }}>
            {t("donationCategoryHint", { defaultValue: "Helps contributors find your campaign in the directory." })}
          </Typography>
          <Box
            component="select"
            data-testid="donation-category"
            value={settings.category}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({ category: e.target.value })}
            sx={inputSx(false)}
          >
            <option value="">{t("donationCategoryNone", { defaultValue: "Uncategorised" })}</option>
            <option value="medical">{t("donationCategory_medical", { defaultValue: "Medical" })}</option>
            <option value="community">{t("donationCategory_community", { defaultValue: "Community" })}</option>
            <option value="creative">{t("donationCategory_creative", { defaultValue: "Creative" })}</option>
            <option value="emergency">{t("donationCategory_emergency", { defaultValue: "Emergency" })}</option>
            <option value="education">{t("donationCategory_education", { defaultValue: "Education" })}</option>
            <option value="animal">{t("donationCategory_animal", { defaultValue: "Animal" })}</option>
            <option value="environment">{t("donationCategory_environment", { defaultValue: "Environment" })}</option>
            <option value="memorial">{t("donationCategory_memorial", { defaultValue: "Memorial" })}</option>
            <option value="sports">{t("donationCategory_sports", { defaultValue: "Sports" })}</option>
            <option value="faith">{t("donationCategory_faith", { defaultValue: "Faith" })}</option>
            <option value="other">{t("donationCategory_other", { defaultValue: "Other" })}</option>
          </Box>
        </Box>

        {/* Organizer thank-you message */}
        <Box>
          <Typography sx={labelSx}>
            {t("donationOrganizerThanksLabel", { defaultValue: "Thank-you message" })}{" "}
            <Typography component="span" sx={{ ...hintSx, display: "inline" }}>
              ({t("optional", { defaultValue: "Optional" })})
            </Typography>
          </Typography>
          <Typography sx={{ ...hintSx, mb: 1 }}>
            {t("donationOrganizerThanksHint", { defaultValue: "Shown to contributors right after their payment succeeds, and used as the intro of the auto-thank-you email." })}
          </Typography>
          <Box
            component="textarea"
            data-testid="donation-organizer-thanks"
            placeholder={t("donationOrganizerThanksPlaceholder", { defaultValue: "Thank you so much for supporting our campaign! Your contribution means the world to us." })}
            value={settings.organizerThanks}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ organizerThanks: e.target.value })}
            sx={{
              width: "100%",
              minHeight: 70,
              resize: "vertical",
              p: 1.5,
              borderRadius: "10px",
              border: `1px solid ${theme.palette.border.main}`,
              outline: "none",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              lineHeight: 1.55,
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.background.paper,
              "&:focus": { borderColor: green },
            }}
          />
        </Box>

        {/* Beneficiary (NEW — session 53) */}
        <Box>
          <Typography sx={labelSx}>
            {t("donationBeneficiaryLabel", { defaultValue: "Beneficiary" })}{" "}
            <Typography component="span" sx={{ ...hintSx, display: "inline" }}>
              ({t("optional", { defaultValue: "Optional" })})
            </Typography>
          </Typography>
          <Typography sx={{ ...hintSx, mb: 1 }}>
            {t("donationBeneficiaryHint", { defaultValue: "Who receives the funds? Shown on the public page for trust — e.g. a charity, non-profit, or the person you are raising money for." })}
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Box
              component="input"
              type="text"
              maxLength={200}
              data-testid="donation-beneficiary-name"
              value={settings.beneficiary?.name || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBeneficiary({ name: e.target.value })}
              placeholder={t("donationBeneficiaryNamePlaceholder", { defaultValue: "Beneficiary name (e.g. Community Garden Foundation)" })}
              sx={inputSx(Boolean(errors.beneficiary))}
            />
            <Box
              component="textarea"
              maxLength={1000}
              data-testid="donation-beneficiary-description"
              value={settings.beneficiary?.description || ""}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateBeneficiary({ description: e.target.value })}
              placeholder={t("donationBeneficiaryDescPlaceholder", { defaultValue: "Short description (optional) — how they will use the funds" })}
              sx={{
                width: "100%",
                minHeight: 60,
                resize: "vertical",
                p: 1.5,
                borderRadius: "10px",
                border: `1px solid ${theme.palette.border.main}`,
                outline: "none",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                lineHeight: 1.55,
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
                "&:focus": { borderColor: green },
              }}
            />
          </Box>
          {errors.beneficiary && <Typography sx={errorSx}>{errors.beneficiary}</Typography>}
        </Box>

        {/* Display toggles */}
        <Box>
          <Typography sx={{ ...labelSx, mb: 1 }}>
            {t("donationDisplayOptionsLabel", { defaultValue: "Display options" })}
          </Typography>
          <Box
            sx={{
              border: `1px solid ${theme.palette.border.main}`,
              borderRadius: "12px",
              px: 2,
              py: 0.5,
              "& > div + div": { borderTop: `1px solid ${theme.palette.border.main}` },
            }}
          >
            {toggleRow(
              "donationToggleProgress",
              "Show progress bar",
              "donationToggleProgressHint",
              "Raised amount and % toward goal on the donation page.",
              settings.showProgress,
              (v) => onChange({ showProgress: v }),
              "donation-toggle-progress"
            )}
            {toggleRow(
              "donationToggleSupporters",
              "Show recent supporters",
              "donationToggleSupportersHint",
              "Public wall with donor names and messages.",
              settings.showSupporters,
              (v) => onChange({ showSupporters: v }),
              "donation-toggle-supporters"
            )}
            {toggleRow(
              "donationToggleCustom",
              "Allow custom amounts",
              "donationToggleCustomHint",
              "Donors can type any amount above the minimum.",
              settings.allowCustom,
              (v) => onChange({ allowCustom: v }),
              "donation-toggle-custom"
            )}
            {toggleRow(
              "donationToggleAutoClose",
              "Auto-close at goal",
              "donationToggleAutoCloseHint",
              "Stop accepting donations once the goal is reached.",
              settings.autoCloseAtGoal,
              (v) => onChange({ autoCloseAtGoal: v }),
              "donation-toggle-autoclose"
            )}
          </Box>
        </Box>
      </CollapsibleSection>
    </Box>
  );
};

export default DonationSettingsSection;
