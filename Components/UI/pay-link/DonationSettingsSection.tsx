/**
 * DonationSettingsSection — campaign form for donation / crowdfunding links.
 * Replaces PaymentSettingsBasic + DescriptionSection when the merchant picks
 * the "Donation / Crowdfunding" link type on the create-pay-link page.
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
}

export interface DonationErrors {
  title?: string;
  goalAmount?: string;
  minAmount?: string;
  presets?: string;
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
  purpose: string;
  onPurposeChange: (v: string) => void;
  purposeError?: string;
  expire: string;
  onExpireChange: (v: string) => void;
  feePayer: string;
  onFeePayerChange: (v: string) => void;
  onUploadImage: (file: File) => void;
  imageUploading: boolean;
}

const MAX_PRESETS = 6;

const DonationSettingsSection = ({
  isMobile,
  settings,
  onChange,
  errors,
  clearError,
  currency,
  currencies,
  onCurrencyChange,
  purpose,
  onPurposeChange,
  purposeError,
  expire,
  onExpireChange,
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
  const [expireAnchor, setExpireAnchor] = useState<null | HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const expireOptions: Array<{ value: string; label: string }> = [
    { value: "no", label: t("donationEndNever", { defaultValue: "No end date" }) },
    { value: "24h", label: t("donationEnd24h", { defaultValue: "Ends in 24 hours" }) },
    { value: "7d", label: t("donationEnd7d", { defaultValue: "Ends in 7 days" }) },
    { value: "30d", label: t("donationEnd30d", { defaultValue: "Ends in 30 days" }) },
  ];
  const expireLabel = expireOptions.find((o) => o.value === (expire || "no"))?.label || expireOptions[0].label;

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
    const n = Math.round(parseFloat(presetInput) * 100) / 100;
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

  return (
    <Box display="flex" flexDirection="column" gap={2.25} data-testid="donation-settings-section">
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

      {/* Purpose / story */}
      <Box>
        <Typography sx={labelSx}>
          {t("donationPurposeLabel", { defaultValue: "Purpose / story" })}{" "}
          <Typography component="span" sx={{ ...hintSx, display: "inline" }}>
            ({t("optional", { defaultValue: "Optional" })})
          </Typography>
        </Typography>
        <Box
          component="textarea"
          rows={3}
          maxLength={500}
          data-testid="donation-purpose-input"
          value={purpose}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onPurposeChange(e.target.value)}
          placeholder={t("donationPurposePlaceholder", { defaultValue: "Tell donors what you are raising funds for and why it matters…" })}
          sx={{ ...inputSx(Boolean(purposeError)), resize: "vertical", minHeight: 76, display: "block" }}
        />
        {purposeError && <Typography sx={errorSx}>{purposeError}</Typography>}
      </Box>

      {/* Goal + currency / minimum */}
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
                : t("donationImageCta", { defaultValue: "Click to upload (PNG, JPG, WEBP — max 10MB)" })}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Campaign end + blockchain fees */}
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={2}>
        <Box>
          <Typography sx={labelSx}>{t("donationEndLabel", { defaultValue: "Campaign ends" })}</Typography>
          <Box
            data-testid="donation-expire-select"
            onClick={(e: React.MouseEvent<HTMLElement>) => setExpireAnchor(e.currentTarget)}
            sx={selectTriggerSx}
          >
            <span>{expireLabel}</span>
            <Icon icon="mdi:chevron-down" width={16} />
          </Box>
          <Menu anchorEl={expireAnchor} open={Boolean(expireAnchor)} onClose={() => setExpireAnchor(null)}>
            {expireOptions.map((o) => (
              <MenuItem
                key={o.value}
                selected={o.value === (expire || "no")}
                onClick={() => {
                  onExpireChange(o.value);
                  setExpireAnchor(null);
                }}
                sx={{ fontSize: 14, fontFamily: "var(--font-sans)" }}
              >
                {o.label}
              </MenuItem>
            ))}
          </Menu>
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

      {/* Display toggles */}
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
  );
};

export default DonationSettingsSection;
