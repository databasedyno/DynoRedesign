import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Dialog,
  IconButton,
  Slide,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  CloseRounded,
  CheckCircleRounded,
  StorefrontRounded,
} from "@mui/icons-material";
import { TransitionProps } from "@mui/material/transitions";
import type { ICountry } from "country-state-city";
import { useTranslation } from "react-i18next";

import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import { useCountryStateCity } from "@/hooks/useCountryStateCity";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface UpgradeToBusinessModalProps {
  open: boolean;
  onClose: () => void;
  /** The individual account (tbl_company row) being upgraded. */
  company: any | null;
  /** Called after a successful upgrade (parent should refetch companies). */
  onSuccess?: (updated: any) => void;
}

/**
 * UpgradeToBusinessModal — a guided flow that turns an INDIVIDUAL account into a
 * BUSINESS account in place (no second company is created). Collects the minimum
 * a business profile needs (name + country) plus optional website / VAT.
 * Responsive: full-screen sheet on phones, centered dialog on larger screens.
 */
const UpgradeToBusinessModal: React.FC<UpgradeToBusinessModalProps> = ({
  open,
  onClose,
  company,
  onSuccess,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { t } = useTranslation("common");
  const companyState = useCompanyStore();

  const csc = useCountryStateCity();
  const allCountries = useMemo<ICountry[]>(
    () => csc?.Country.getAllCountries() ?? [],
    [csc],
  );

  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState<ICountry | null>(null);
  const [website, setWebsite] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Prefill from the current account each time the modal opens.
  useEffect(() => {
    if (!open || !company) return;
    setDone(false);
    setSubmitting(false);
    setErrors({});
    setBusinessName(String(company.company_name ?? "").trim());
    setWebsite(String(company.website ?? "").trim());
    setVatNumber(String(company.vat_number ?? "").trim());
    const existing = String(company.country ?? "").trim().toUpperCase();
    if (existing) {
      const match = allCountries.find(
        (c) =>
          c.isoCode.toUpperCase() === existing ||
          c.name.toUpperCase() === existing,
      );
      setCountry(match ?? null);
    } else {
      setCountry(null);
    }
  }, [open, company, allCountries]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!businessName.trim())
      next.businessName = t("upgradeBusiness.nameRequired", {
        defaultValue: "Business name is required",
      });
    if (!country)
      next.country = t("upgradeBusiness.countryRequired", {
        defaultValue: "Country is required",
      });
    if (website.trim()) {
      const urlPattern =
        /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;
      if (!urlPattern.test(website.trim()))
        next.website = t("upgradeBusiness.websiteInvalid", {
          defaultValue: "Enter a valid website URL",
        });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting || !company) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res: any = await axiosBaseApi.put(
        API_ENDPOINTS.company.upgradeToBusiness(company.company_id),
        {
          company_name: businessName.trim(),
          country: country?.isoCode ?? "",
          website: website.trim(),
          vat_number: vatNumber.trim(),
        },
      );
      const updated = res?.data?.data ?? null;
      await companyState.refetchCompanies();
      setDone(true);
      onSuccess?.(updated);
      // Let the success state show briefly, then close.
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        t("upgradeBusiness.genericError", {
          defaultValue: "Could not upgrade the account. Please try again.",
        });
      setErrors((prev) => ({ ...prev, submit: String(message) }));
      setSubmitting(false);
    }
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "10px",
      fontSize: isMobile ? "14px" : "15px",
      fontFamily: "var(--font-sans)",
      minHeight: isMobile ? "44px" : "46px",
    },
    "& .MuiFormHelperText-root": {
      fontFamily: "var(--font-sans)",
      fontSize: "12px",
      marginLeft: "4px",
    },
  } as const;

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      TransitionComponent={Transition}
      fullScreen={isMobile}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : "14px",
          maxWidth: isMobile ? "100%" : "520px",
          maxHeight: isMobile ? "100%" : "92vh",
          display: "flex",
          flexDirection: "column",
          border: (th) =>
            `1px solid ${
              th.palette.mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(15,15,20,0.08)"
            }`,
        },
      }}
      data-testid="upgrade-business-modal"
    >
      {/* Close */}
      <IconButton
        onClick={onClose}
        aria-label="Close"
        disabled={submitting}
        sx={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 2,
          color: theme.palette.text.secondary,
        }}
        data-testid="upgrade-business-cancel-btn"
      >
        <CloseRounded sx={{ fontSize: 22 }} />
      </IconButton>

      {done ? (
        <Box
          data-testid="upgrade-business-success"
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 1.5,
            px: 4,
            py: 8,
          }}
        >
          <CheckCircleRounded sx={{ fontSize: 56, color: "#12B76A" }} />
          <Typography
            sx={{
              fontSize: "20px",
              fontWeight: 700,
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
            }}
          >
            {t("upgradeBusiness.successTitle", {
              defaultValue: "You're now a Business account",
            })}
          </Typography>
          <Typography
            sx={{
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.secondary,
              maxWidth: 360,
            }}
          >
            {t("upgradeBusiness.successBody", {
              defaultValue:
                "Your wallets, keys, team and payment history are unchanged — you've simply unlocked full business features.",
            })}
          </Typography>
        </Box>
      ) : (
        <>
          {/* Header */}
          <Box sx={{ px: isMobile ? 3 : 4, pt: isMobile ? 3.5 : 3.5, pb: 0 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1.5,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(120,140,248,0.14)"
                    : "rgba(79,70,229,0.08)",
              }}
            >
              <StorefrontRounded sx={{ fontSize: 24, color: "#4F46E5" }} />
            </Box>
            <Typography
              data-testid="upgrade-business-title"
              sx={{
                fontSize: isMobile ? "20px" : "22px",
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                color: theme.palette.text.primary,
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
              }}
            >
              {t("upgradeBusiness.title", {
                defaultValue: "Upgrade to a Business account",
              })}
            </Typography>
            <Typography
              sx={{
                mt: 0.75,
                fontSize: isMobile ? "13px" : "14px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                color: theme.palette.text.secondary,
                lineHeight: 1.5,
              }}
            >
              {t("upgradeBusiness.subtitle", {
                defaultValue:
                  "Complete your business profile to unlock invoices, tax reporting and team features. Nothing else about your account changes.",
              })}
            </Typography>
          </Box>

          {/* Form */}
          <Box
            sx={{
              px: isMobile ? 3 : 4,
              py: isMobile ? 2.5 : 3,
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              overflowY: "auto",
              flexGrow: 1,
            }}
          >
            <InputField
              label={t("upgradeBusiness.nameLabel", {
                defaultValue: "Business name",
              })}
              placeholder={t("upgradeBusiness.namePlaceholder", {
                defaultValue: "Acme Inc.",
              })}
              value={businessName}
              onChange={(e: any) => {
                setBusinessName(e.target.value);
                if (errors.businessName)
                  setErrors({ ...errors, businessName: "" });
              }}
              error={!!errors.businessName}
              helperText={errors.businessName}
              data-testid="upgrade-business-name-input"
            />

            <Box>
              <Typography
                sx={{
                  fontSize: "13px",
                  fontWeight: 500,
                  fontFamily: "var(--font-sans)",
                  color: theme.palette.text.primary,
                  mb: 0.5,
                  ml: 0.25,
                }}
              >
                {t("upgradeBusiness.countryLabel", { defaultValue: "Country" })}
              </Typography>
              <Autocomplete
                fullWidth
                options={allCountries}
                value={country}
                onChange={(_, v) => {
                  setCountry(v);
                  if (errors.country) setErrors({ ...errors, country: "" });
                }}
                getOptionLabel={(o) => o?.name || ""}
                isOptionEqualToValue={(a, b) => a?.isoCode === b?.isoCode}
                filterOptions={(opts, state) => {
                  const q = state.inputValue.trim().toLowerCase();
                  if (!q) return opts;
                  return opts.filter(
                    (o) =>
                      o.name.toLowerCase().includes(q) ||
                      o.isoCode.toLowerCase().startsWith(q),
                  );
                }}
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props as any;
                  return (
                    <Box
                      component="li"
                      key={key}
                      {...optionProps}
                      sx={{
                        display: "flex",
                        gap: 1,
                        py: 0.75,
                        fontFamily: "var(--font-sans)",
                        fontSize: "14px",
                      }}
                      data-testid={`upgrade-country-option-${option.isoCode}`}
                    >
                      <span style={{ fontSize: "18px" }}>{option.flag}</span>
                      <span style={{ flex: 1 }}>{option.name}</span>
                      <span
                        style={{
                          color: theme.palette.text.secondary,
                          fontSize: "12px",
                        }}
                      >
                        {option.isoCode}
                      </span>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t("upgradeBusiness.countryPlaceholder", {
                      defaultValue: "Select your country",
                    })}
                    error={!!errors.country}
                    helperText={errors.country}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: country ? (
                        <Box sx={{ pl: 0.5, pr: 0.5, fontSize: "18px" }}>
                          {country.flag}
                        </Box>
                      ) : (
                        params.InputProps.startAdornment
                      ),
                    }}
                    sx={fieldSx}
                    data-testid="upgrade-business-country-input"
                  />
                )}
              />
            </Box>

            <InputField
              label={t("upgradeBusiness.websiteLabel", {
                defaultValue: "Website (optional)",
              })}
              placeholder="https://yourcompany.com"
              value={website}
              onChange={(e: any) => {
                setWebsite(e.target.value);
                if (errors.website) setErrors({ ...errors, website: "" });
              }}
              error={!!errors.website}
              helperText={errors.website}
              data-testid="upgrade-business-website-input"
            />

            <InputField
              label={t("upgradeBusiness.vatLabel", {
                defaultValue: "VAT / Tax ID (optional)",
              })}
              placeholder={t("upgradeBusiness.vatPlaceholder", {
                defaultValue: "e.g. DE123456789",
              })}
              value={vatNumber}
              onChange={(e: any) => {
                setVatNumber(e.target.value);
              }}
              data-testid="upgrade-business-vat-input"
            />

            {errors.submit && (
              <Typography
                data-testid="upgrade-business-error"
                sx={{
                  color: theme.palette.error.main,
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {errors.submit}
              </Typography>
            )}
          </Box>

          {/* Footer */}
          <Box
            sx={{
              px: isMobile ? 3 : 4,
              pb: isMobile ? 3 : 3,
              pt: 0.5,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              flexShrink: 0,
            }}
          >
            <CustomButton
              data-testid="upgrade-business-submit-btn"
              label={t("upgradeBusiness.submit", {
                defaultValue: "Upgrade to Business",
              })}
              variant="primary"
              size="medium"
              fullWidth
              loading={submitting}
              onClick={handleSubmit}
            />
          </Box>
        </>
      )}
    </Dialog>
  );
};

export default UpgradeToBusinessModal;
