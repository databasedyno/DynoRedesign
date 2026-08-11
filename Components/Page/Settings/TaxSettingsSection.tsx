import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  CircularProgress,
  Switch,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import {
  CheckCircleRounded,
  ErrorOutlineRounded,
  ReceiptLongRounded,
} from "@mui/icons-material";
import { Country } from "country-state-city";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";

import axiosBaseApi from "@/axiosConfig";
import CustomButton from "@/Components/UI/Buttons";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";

/* ------------------------------------------------------------------ */
/* Structural VAT-ID validation — mirrors backend taxService regexes   */
/* (client-side hint only; the backend re-validates authoritatively).  */
/* ------------------------------------------------------------------ */
const VAT_ID_REGEX: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE0?\d{9,10}$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  ES: /^ES[0-9A-Z]\d{7}[0-9A-Z]$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[0-9A-Z]{2}\d{9}$/,
  GR: /^(GR|EL)\d{9}$/,
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d{7}[A-Z]{1,2}$/,
  IT: /^IT\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
  GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
};

const normalizeVat = (raw: string) =>
  String(raw || "").toUpperCase().replace(/[\s.\-]/g, "");

const isStructurallyValidVat = (raw: string): boolean => {
  const n = normalizeVat(raw);
  if (!n) return false;
  const cc = n.slice(0, 2);
  const rx = VAT_ID_REGEX[cc];
  return rx ? rx.test(n) : false;
};

interface CountryOption {
  code: string;
  label: string;
  flag: string;
}

interface TaxSettings {
  default_apply_tax: boolean;
  default_tax_inclusive: boolean;
  merchant_country_code: string | null;
  merchant_vat_id: string | null;
}

const TaxSettingsSection: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("common");
  const isDark = theme.palette.mode === "dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [applyTax, setApplyTax] = useState(false);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [vatId, setVatId] = useState("");
  const [initial, setInitial] = useState<TaxSettings | null>(null);

  const countryOptions = useMemo<CountryOption[]>(
    () =>
      Country.getAllCountries().map((c) => ({
        code: c.isoCode,
        label: c.name,
        flag: c.flag,
      })),
    [],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axiosBaseApi.get("user/tax-settings");
        const d: TaxSettings = res?.data?.data || {};
        if (!mounted) return;
        setApplyTax(!!d.default_apply_tax);
        setTaxInclusive(!!d.default_tax_inclusive);
        setCountryCode(d.merchant_country_code || null);
        setVatId(d.merchant_vat_id || "");
        setInitial({
          default_apply_tax: !!d.default_apply_tax,
          default_tax_inclusive: !!d.default_tax_inclusive,
          merchant_country_code: d.merchant_country_code || null,
          merchant_vat_id: d.merchant_vat_id || null,
        });
      } catch (e) {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t("taxSettings.loadError", {
              defaultValue: "Couldn't load tax settings.",
            }),
            severity: "error",
          },
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const vatDirty = normalizeVat(vatId) !== normalizeVat(initial?.merchant_vat_id || "");
  const isDirty =
    !!initial &&
    (applyTax !== initial.default_apply_tax ||
      taxInclusive !== initial.default_tax_inclusive ||
      (countryCode || null) !== (initial.merchant_country_code || null) ||
      vatDirty);

  const vatValid = vatId.trim().length > 0 ? isStructurallyValidVat(vatId) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        default_apply_tax: applyTax,
        default_tax_inclusive: taxInclusive,
        merchant_country_code: countryCode ? countryCode.toUpperCase() : null,
        merchant_vat_id: vatId.trim() ? normalizeVat(vatId) : null,
      };
      const res = await axiosBaseApi.patch("user/tax-settings", payload);
      const d: TaxSettings = res?.data?.data || payload;
      setApplyTax(!!d.default_apply_tax);
      setTaxInclusive(!!d.default_tax_inclusive);
      setCountryCode(d.merchant_country_code || null);
      setVatId(d.merchant_vat_id || "");
      setInitial({
        default_apply_tax: !!d.default_apply_tax,
        default_tax_inclusive: !!d.default_tax_inclusive,
        merchant_country_code: d.merchant_country_code || null,
        merchant_vat_id: d.merchant_vat_id || null,
      });
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: t("taxSettings.saved", { defaultValue: "Tax settings saved." }),
          severity: "success",
        },
      });
    } catch (e: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            e?.response?.data?.message ||
            t("taxSettings.saveError", { defaultValue: "Couldn't save tax settings." }),
          severity: "error",
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const cardSx = {
    borderRadius: "14px",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "#E9ECF2"}`,
    bgcolor: isDark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
    p: { xs: 2, md: 2.5 },
  };

  const rowSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 2,
    py: 1.5,
  };

  const labelSx = {
    fontSize: 14,
    fontWeight: 600,
    color: theme.palette.text.primary,
    fontFamily: "var(--font-sans)",
  };
  const descSx = {
    fontSize: 12.5,
    color: theme.palette.text.secondary,
    fontFamily: "var(--font-sans)",
    mt: 0.25,
    maxWidth: 460,
  };
  const dividerSx = {
    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#F1F2F5"}`,
  };

  if (loading) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={26} sx={{ color: theme.palette.primary.main }} />
      </Box>
    );
  }

  return (
    <Box data-testid="tax-settings-section" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Intro banner */}
      <Box
        sx={{
          ...cardSx,
          display: "flex",
          gap: 1.5,
          alignItems: "flex-start",
          bgcolor: isDark ? "rgba(129,140,248,0.06)" : "#F5F6FE",
          border: `1px solid ${isDark ? "rgba(129,140,248,0.20)" : "#E0E3F7"}`,
        }}
      >
        <ReceiptLongRounded sx={{ fontSize: 20, color: theme.palette.text.secondary, mt: "1px" }} />
        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", lineHeight: 1.55 }}>
          {t("taxSettings.intro", {
            defaultValue:
              "Set your default VAT/tax behavior for storefront checkouts and payment links. Dynopay computes and collects tax on your behalf — you remain responsible for remitting it. Per-product and per-link overrides always take precedence over these defaults.",
          })}
        </Typography>
      </Box>

      {/* Main settings card */}
      <Box sx={cardSx}>
        {/* Charge tax toggle */}
        <Box sx={{ ...rowSx, ...dividerSx, pt: 0 }}>
          <Box>
            <Typography sx={labelSx}>
              {t("taxSettings.applyTaxLabel", { defaultValue: "Charge tax on checkouts" })}
            </Typography>
            <Typography sx={descSx}>
              {t("taxSettings.applyTaxDesc", {
                defaultValue:
                  "When on, tax is added to store checkouts and new payment links by default (based on the buyer's location).",
              })}
            </Typography>
          </Box>
          <Switch
            checked={applyTax}
            onChange={(e) => setApplyTax(e.target.checked)}
            data-testid="tax-apply-toggle"
            inputProps={{ "aria-label": "Charge tax on checkouts" }}
          />
        </Box>

        {/* Tax inclusive toggle (only relevant when applyTax on) */}
        <Box
          sx={{
            ...rowSx,
            ...dividerSx,
            opacity: applyTax ? 1 : 0.5,
            pointerEvents: applyTax ? "auto" : "none",
          }}
        >
          <Box>
            <Typography sx={labelSx}>
              {t("taxSettings.inclusiveLabel", { defaultValue: "Prices already include tax" })}
            </Typography>
            <Typography sx={descSx}>
              {t("taxSettings.inclusiveDesc", {
                defaultValue:
                  "Treat your listed prices as tax-inclusive (gross). The tax portion is backed out of the price instead of added on top.",
              })}
            </Typography>
          </Box>
          <Switch
            checked={taxInclusive}
            onChange={(e) => setTaxInclusive(e.target.checked)}
            disabled={!applyTax}
            data-testid="tax-inclusive-toggle"
            inputProps={{ "aria-label": "Prices already include tax" }}
          />
        </Box>

        {/* Merchant country */}
        <Box sx={{ ...rowSx, ...dividerSx, flexDirection: { xs: "column", sm: "row" } }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={labelSx}>
              {t("taxSettings.countryLabel", { defaultValue: "Your business country" })}
            </Typography>
            <Typography sx={descSx}>
              {t("taxSettings.countryDesc", {
                defaultValue:
                  "Used as the tax jurisdiction fallback and to determine EU cross-border B2B reverse-charge.",
              })}
            </Typography>
          </Box>
          <Autocomplete
            options={countryOptions}
            getOptionLabel={(o) => `${o.flag ? o.flag + " " : ""}${o.label} (${o.code})`}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            value={countryOptions.find((c) => c.code === countryCode) || null}
            onChange={(_, val) => setCountryCode(val ? val.code : null)}
            data-testid="tax-country-select"
            sx={{ width: { xs: "100%", sm: 280 } }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder={t("taxSettings.countryPlaceholder", { defaultValue: "Select country" })}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", fontFamily: "var(--font-sans)", fontSize: 14 } }}
              />
            )}
          />
        </Box>

        {/* Merchant VAT ID */}
        <Box sx={{ ...rowSx, pb: 0, flexDirection: { xs: "column", sm: "row" } }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={labelSx}>
              {t("taxSettings.vatLabel", { defaultValue: "Your VAT / Tax ID" })}
            </Typography>
            <Typography sx={descSx}>
              {t("taxSettings.vatDesc", {
                defaultValue:
                  "Shown on receipts. Enables EU reverse-charge validation when your buyers provide their own VAT ID.",
              })}
            </Typography>
          </Box>
          <Box sx={{ width: { xs: "100%", sm: 280 } }}>
            <TextField
              fullWidth
              size="small"
              value={vatId}
              onChange={(e) => setVatId(e.target.value)}
              placeholder="e.g. DE123456789"
              data-testid="tax-vat-input"
              InputProps={{
                endAdornment:
                  vatValid === null ? null : vatValid ? (
                    <CheckCircleRounded sx={{ fontSize: 18, color: theme.palette.success?.main || "#2E7D32" }} />
                  ) : (
                    <ErrorOutlineRounded sx={{ fontSize: 18, color: theme.palette.warning?.main || "#ED6C02" }} />
                  ),
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", fontFamily: "var(--font-sans)", fontSize: 14 } }}
            />
            {vatValid === false && (
              <Typography sx={{ fontSize: 11.5, color: theme.palette.warning?.main || "#ED6C02", mt: 0.5, fontFamily: "var(--font-sans)" }}>
                {t("taxSettings.vatInvalidHint", {
                  defaultValue: "This doesn't match a known EU/GB VAT format — it will still be saved as entered.",
                })}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Save */}
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <CustomButton
          label={t("taxSettings.save", { defaultValue: "Save tax settings" })}
          variant="primary"
          size="small"
          onClick={handleSave}
          loading={saving}
          disabled={!isDirty || saving}
          data-testid="tax-save-btn"
        />
      </Box>
    </Box>
  );
};

export default TaxSettingsSection;
