import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import SteppedProgressPanel from "@/Components/UI/SteppedProgressPanel";
import useIsMobile from "@/hooks/useIsMobile";
import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_INSERT } from "@/Redux/Actions/CompanyAction";
import { rootReducer } from "@/utils/types";
import { fetchGeoDefaults, currencyForCountry } from "@/utils/geoDefaults";
import {
  BusinessRounded,
  CloudUploadRounded,
  CloseRounded,
} from "@mui/icons-material";
import {
  Autocomplete,
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Slide,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { Country, type ICountry } from "country-state-city";
import StepIndicator from "./StepIndicator";
import { TransitionProps } from "@mui/material/transitions";
import { MuiTelInput } from "mui-tel-input";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface CreateCompanyModalProps {
  open: boolean;
  onSuccess: () => void;
  onClose?: () => void;
  closeLabel?: string;
  /** When false, the "Step 1 of 2" indicator is hidden (use for "Add another
   *  company" outside the onboarding flow). Default: true. */
  showStepIndicator?: boolean;
  /** Override the modal heading. Default: "Create Your Company". */
  title?: string;
  /** Override the modal sub-heading. Default copy matches onboarding. */
  subtitle?: string;
}

const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({
  open,
  onSuccess,
  onClose,
  closeLabel,
  showStepIndicator = true,
  title,
  subtitle,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isMobile = useIsMobile("sm");
  const { t } = useTranslation("companyDialog");
  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const userState = useSelector((state: rootReducer) => state.userReducer);
  const fileRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState<ICountry | null>(null);
  const [currency, setCurrency] = useState<string>("USD");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Preloaded list of ISO countries with dial codes + flags. Cheap to
  // memoize since Country.getAllCountries() reads static JSON.
  const allCountries = useMemo<ICountry[]>(() => Country.getAllCountries(), []);

  // A) Prefill business email & mobile from the account the user just created,
  // so they don't have to re-type details they already provided at signup.
  React.useEffect(() => {
    if (!open) return;
    setEmail((prev) => prev || userState.email || "");
    setMobile((prev) => prev || userState.mobile || "");
    // Prefill first/last name from user profile if available
    if (userState.name) {
      const parts = (userState.name || "").trim().split(/\s+/);
      if (parts.length >= 2) {
        setFirstName((prev) => prev || parts[0]);
        setLastName((prev) => prev || parts.slice(1).join(" "));
      } else if (parts.length === 1) {
        setFirstName((prev) => prev || parts[0]);
      }
    }
  }, [open, userState.email, userState.mobile, userState.name]);

  // B) Fetch geo-detect once when the modal opens (only if country is still
  // empty — never override a user-chosen value). Silently no-ops on error.
  useEffect(() => {
    if (!open) return;
    if (country) return;
    let cancelled = false;
    (async () => {
      const defaults = await fetchGeoDefaults();
      if (cancelled) return;
      if (defaults.country) {
        const c = allCountries.find(
          (x) => x.isoCode.toUpperCase() === defaults.country,
        );
        if (c) {
          setCountry(c);
          setCurrency((prev) => prev || defaults.currency || "USD");
        }
      } else if (defaults.currency) {
        setCurrency((prev) => prev || defaults.currency);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, allCountries, country]);

  // C) Field-hinted backend errors — surface inline on the offending field.
  //   Watches createErrorNonce so identical repeated errors still trigger.
  const lastNonceRef = useRef<number>((companyState as any)?.createErrorNonce || 0);
  useEffect(() => {
    const nonce = (companyState as any)?.createErrorNonce || 0;
    if (nonce === lastNonceRef.current) return;
    lastNonceRef.current = nonce;
    const field = (companyState as any)?.createErrorField as string | null;
    const message = (companyState as any)?.createError as string | null;
    if (!field || !message) return;
    // Any create error means we're no longer submitting
    setSubmitting(false);
    submittedRef.current = false;
    // Map backend field name to local form field name (mostly 1:1)
    const local: string =
      field === "company_name" ? "companyName" :
      field === "first_name" ? "firstName" :
      field === "last_name" ? "lastName" :
      field; // email / mobile / website / country / currency / tax_id / image
    setErrors((prev) => ({ ...prev, [local]: message }));
  }, [
    (companyState as any)?.createErrorNonce,
    (companyState as any)?.createErrorField,
    (companyState as any)?.createError,
  ]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = t("createModal.validation.firstNameRequired");
    if (!lastName.trim()) newErrors.lastName = t("createModal.validation.lastNameRequired");
    if (!companyName.trim()) newErrors.companyName = t("createModal.validation.companyNameRequired");
    if (!email.trim()) newErrors.email = t("createModal.validation.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = t("createModal.validation.emailInvalid");
    // D) Mobile is optional — only validate the format if a value was entered.
    if (mobile && mobile.replace(/\D/g, "").length < 10)
      newErrors.mobile = t("createModal.validation.mobileInvalid");
    if (website.trim()) {
      const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;
      if (!urlPattern.test(website.trim()))
        newErrors.website = t("createModal.validation.websiteInvalid");
    }
    if (!country) newErrors.country = t("createModal.validation.countryRequired");
    if (!currency) newErrors.currency = t("createModal.validation.currencyRequired");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [fileError, setFileError] = useState("");

  const handleFileChange = (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setFileError(t("createModal.fileTypeError"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError(t("createModal.fileSizeError"));
      return;
    }
    setFileError("");
    setMediaFile(file);
    setFileName(file.name);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);

    const values = {
      company_name: companyName.trim(),
      email: email.trim(),
      mobile,
      website: website.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      country: country?.isoCode ?? "",
      country_name: country?.name ?? "",
      currency: currency || "USD",
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(values));
    if (mediaFile) formData.append("image", mediaFile);

    dispatch(CompanyAction(COMPANY_INSERT, formData));
    submittedRef.current = true;
  };

  // Watch for successful company creation
  const prevLoading = useRef(false);
  const submittedRef = useRef(false);
  React.useEffect(() => {
    // Only trigger success if the modal is actually open AND the user submitted
    if (open && submittedRef.current && prevLoading.current && !companyState.loading) {
      submittedRef.current = false;
      if (companyState.companyList?.length > 0) {
        setSubmitting(false);
        onSuccess();
      } else {
        setSubmitting(false);
      }
    }
    prevLoading.current = companyState.loading;
  }, [companyState.loading, companyState.companyList, onSuccess, open]);

  return (
    <Dialog
      open={open}
      TransitionComponent={Transition}
      maxWidth="sm"
      fullWidth
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: "16px",
          overflow: "visible",
          maxWidth: isMobile ? "95vw" : "520px",
          maxHeight: "90vh",
          mx: "auto",
          display: "flex",
          flexDirection: "column",
        },
      }}
      data-testid="create-company-modal"
    >
      {/* Close Button */}
      {onClose && (
        <IconButton
          onClick={onClose}
          aria-label="Close"
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1,
            color: theme.palette.text.secondary,
            "&:hover": {
              backgroundColor: theme.palette.action.hover,
            },
          }}
          data-testid="close-company-modal-btn"
        >
          <CloseRounded sx={{ fontSize: 22 }} />
        </IconButton>
      )}
      {/* Step Indicator */}
      {showStepIndicator && (
        <Box
          sx={{
            px: isMobile ? 2.5 : 3.5,
            pt: isMobile ? 2 : 2.5,
            pb: 0,
          }}
        >
          <StepIndicator currentStep={1} totalSteps={2} />
        </Box>
      )}

      {/* Header */}
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          pt: isMobile ? 1.5 : 2,
          pb: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              backgroundColor: theme.palette.primary.light || "#E5EDFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BusinessRounded
              sx={{ fontSize: 22, color: theme.palette.primary.main }}
            />
          </Box>
          <Box>
            <Typography
              data-testid="create-company-title"
              sx={{
                fontSize: isMobile ? "18px" : "20px",
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                color: theme.palette.text.primary,
                lineHeight: 1.3,
              }}
            >
              {title || t("createModal.title")}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "12px" : "13px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                color: theme.palette.text.secondary,
                lineHeight: 1.4,
              }}
            >
              {subtitle || t("createModal.subtitle")}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Form */}
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          py: isMobile ? 2 : 2.5,
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          overflowY: "auto",
          flexGrow: 1,
        }}
      >
        {/* While submitting, hide the entire form and show the stepped-progress
            panel so the ~4–6s wait feels intentional. Users can't edit during
            the network call anyway. */}
        {submitting ? (
          <SteppedProgressPanel
            active={submitting}
            title={t("createModal.progressTitle")}
            steps={[
              t("createModal.progressStep1"),
              t("createModal.progressStep2"),
              t("createModal.progressStep3"),
              t("createModal.progressStep4"),
              t("createModal.progressStep5"),
            ]}
            intervalMs={2000}
            data-testid="create-company-progress"
          />
        ) : (
          <>
        {/* Your Name Section */}
        <Box>
          <Typography
            sx={{
              fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-sans)",
              color: theme.palette.text.secondary, mb: 1, textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {t("createModal.sectionYourName")}
          </Typography>
          <Box sx={{ display: "flex", gap: "12px" }}>
            <Box sx={{ flex: 1 }}>
              <InputField
                label={t("createModal.firstNameLabel")}
                placeholder={t("createModal.firstNamePlaceholder")}
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors({ ...errors, firstName: "" });
                }}
                error={!!errors.firstName}
                helperText={errors.firstName}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <InputField
                label={t("createModal.lastNameLabel")}
                placeholder={t("createModal.lastNamePlaceholder")}
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) setErrors({ ...errors, lastName: "" });
                }}
                error={!!errors.lastName}
                helperText={errors.lastName}
              />
            </Box>
          </Box>
        </Box>

        {/* Company Section */}
        <Box>
          <Typography
            sx={{
              fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-sans)",
              color: theme.palette.text.secondary, mb: 1, textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {t("createModal.sectionCompanyDetails")}
          </Typography>
        </Box>

        <InputField
          label={t("createModal.companyNameLabel")}
          placeholder={t("createModal.companyNamePlaceholder")}
          value={companyName}
          onChange={(e) => {
            setCompanyName(e.target.value);
            if (errors.companyName) setErrors({ ...errors, companyName: "" });
          }}
          error={!!errors.companyName}
          helperText={errors.companyName}
          data-testid="company-name-input"
        />

        <InputField
          label={t("createModal.businessEmailLabel")}
          placeholder={t("createModal.businessEmailPlaceholder")}
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors({ ...errors, email: "" });
          }}
          error={!!errors.email}
          helperText={errors.email}
          data-testid="company-email-input"
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
            {t("createModal.mobileLabel")}
          </Typography>
          <MuiTelInput
            fullWidth
            placeholder={t("createModal.mobilePlaceholder")}
            forceCallingCode
            disableFormatting
            defaultCountry="US"
            value={mobile}
            error={!!errors.mobile}
            helperText={errors.mobile}
            onChange={(newValue) => {
              setMobile(newValue);
              if (errors.mobile) setErrors({ ...errors, mobile: "" });
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: isMobile ? "13px" : "15px",
                fontFamily: "var(--font-sans)",
                height: isMobile ? "40px" : "44px",
                "& fieldset": {
                  borderColor: errors.mobile
                    ? theme.palette.error.main
                    : "#E9ECF2",
                },
                "&:hover fieldset": {
                  borderColor: errors.mobile
                    ? theme.palette.error.main
                    : "#D0D5DD",
                },
                "&.Mui-focused fieldset": {
                  borderColor: errors.mobile
                    ? theme.palette.error.main
                    : theme.palette.primary.main,
                },
              },
              "& .MuiFormHelperText-root": {
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                marginLeft: "4px",
              },
            }}
            data-testid="company-mobile-input"
          />
        </Box>

        <InputField
          label={t("createModal.websiteLabel")}
          placeholder="https://yourcompany.com"
          value={website}
          onChange={(e) => {
            setWebsite(e.target.value);
            if (errors.website) setErrors({ ...errors, website: "" });
          }}
          error={!!errors.website}
          helperText={errors.website}
          data-testid="company-website-input"
        />

        {/* Country autocomplete — typeahead-searchable dropdown pre-filled from geo-detect.
            User can type to filter (e.g. "Nige…" → Nigeria) and pick any ISO country.
            Currency below is auto-derived from this selection but can be overridden. */}
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
            {t("createModal.countryLabel")}
          </Typography>
          <Autocomplete
            fullWidth
            options={allCountries}
            value={country}
            onChange={(_, newValue) => {
              setCountry(newValue);
              if (newValue) {
                // Auto-derive currency but keep any user override
                setCurrency((prev) => prev || currencyForCountry(newValue.isoCode));
              }
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
                  o.isoCode.toLowerCase().startsWith(q) ||
                  (o.phonecode || "").toLowerCase().includes(q),
              );
            }}
            renderOption={(props, option) => (
              <Box
                component="li"
                {...props}
                sx={{
                  display: "flex",
                  gap: 1,
                  py: 0.75,
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                }}
                data-testid={`country-option-${option.isoCode}`}
              >
                <span style={{ fontSize: "18px" }}>{option.flag}</span>
                <span style={{ flex: 1 }}>{option.name}</span>
                <span style={{ color: theme.palette.text.secondary, fontSize: "12px" }}>
                  {option.isoCode}
                </span>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t("createModal.countryPlaceholder")}
                error={!!errors.country}
                helperText={errors.country}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: country ? (
                    <Box sx={{ pl: 0.5, pr: 0.5, fontSize: "18px" }}>{country.flag}</Box>
                  ) : (
                    params.InputProps.startAdornment
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    fontSize: isMobile ? "13px" : "15px",
                    fontFamily: "var(--font-sans)",
                    minHeight: isMobile ? "40px" : "44px",
                    "& fieldset": { borderColor: errors.country ? theme.palette.error.main : "#E9ECF2" },
                    "&:hover fieldset": { borderColor: errors.country ? theme.palette.error.main : "#D0D5DD" },
                    "&.Mui-focused fieldset": { borderColor: errors.country ? theme.palette.error.main : theme.palette.primary.main },
                  },
                  "& .MuiFormHelperText-root": { fontFamily: "var(--font-sans)", fontSize: "12px", marginLeft: "4px" },
                }}
                data-testid="company-country-input"
              />
            )}
          />
        </Box>

        {/* Currency — auto-derived from country but overridable. Small controlled
            list of the 20 most common codes; add more as needed. */}
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
            {t("createModal.currencyLabel")}
          </Typography>
          <Autocomplete
            fullWidth
            options={[
              "USD","EUR","GBP","NGN","INR","CAD","AUD","JPY","SGD","AED",
              "ZAR","KES","GHS","MXN","BRL","CNY","HKD","CHF","SEK","NOK",
              "KRW","IDR","MYR","THB","PHP","VND","PLN","CZK","HUF","TRY",
              "SAR","QAR","KWD","BHD","OMR","JOD","ILS","EGP","RUB","UAH",
            ]}
            value={currency}
            onChange={(_, v) => {
              setCurrency(v || "USD");
              if (errors.currency) setErrors({ ...errors, currency: "" });
            }}
            disableClearable
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t("createModal.currencyPlaceholder")}
                error={!!errors.currency}
                helperText={errors.currency}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    fontSize: isMobile ? "13px" : "15px",
                    fontFamily: "var(--font-sans)",
                    minHeight: isMobile ? "40px" : "44px",
                    "& fieldset": { borderColor: errors.currency ? theme.palette.error.main : "#E9ECF2" },
                    "&:hover fieldset": { borderColor: errors.currency ? theme.palette.error.main : "#D0D5DD" },
                    "&.Mui-focused fieldset": { borderColor: errors.currency ? theme.palette.error.main : theme.palette.primary.main },
                  },
                  "& .MuiFormHelperText-root": { fontFamily: "var(--font-sans)", fontSize: "12px", marginLeft: "4px" },
                }}
                data-testid="company-currency-input"
              />
            )}
          />
        </Box>

        {/* Logo upload */}
        <Box>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
              mb: 0.75,
              ml: 0.25,
            }}
          >
            {t("createModal.brandLogoLabel")}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box
              onClick={() => fileRef.current?.click()}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.5,
                py: 0.75,
                borderRadius: "8px",
                border: `1px solid #E9ECF2`,
                cursor: "pointer",
                transition: "background-color 0.15s",
                "&:hover": { backgroundColor: "#F4F6FA" },
              }}
            >
              <CloudUploadRounded
                sx={{ fontSize: 16, color: theme.palette.text.secondary }}
              />
              <Typography
                sx={{
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                }}
              >
                {fileName ? t("createModal.uploadChange") : t("createModal.uploadUpload")}
              </Typography>
            </Box>
            {imagePreview && (
              <Box
                component="img"
                src={imagePreview}
                alt="logo preview"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "8px",
                  objectFit: "cover",
                  border: `1px solid #E9ECF2`,
                }}
              />
            )}
            {fileName && !imagePreview && (
              <Typography
                sx={{
                  fontSize: "12px",
                  color: theme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {fileName}
              </Typography>
            )}
            <input
              type="file"
              ref={fileRef}
              hidden
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
              }}
            />
          </Box>
          {fileError && (
            <Typography
              sx={{
                color: theme.palette.error.main,
                fontSize: "12px",
                fontFamily: "var(--font-sans)",
                mt: 0.5,
              }}
            >
              {fileError}
            </Typography>
          )}
        </Box>
          </>
        )}
      </Box>

      {/* Footer — hidden while submitting so the progress panel gets the whole card. */}
      {!submitting && (
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          pb: isMobile ? 2.5 : 3,
          pt: 0.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          flexShrink: 0,
        }}
      >
        <CustomButton
          data-testid="create-company-submit-btn"
          label={t("createModal.submit")}
          variant="primary"
          size={isMobile ? "small" : "medium"}
          fullWidth
          disabled={submitting}
          onClick={handleSubmit}
        />
        {onClose && (
          <CustomButton
            data-testid="cancel-company-btn"
            label={closeLabel || t("createModal.closeLater")}
            variant="secondary"
            size={isMobile ? "small" : "medium"}
            fullWidth
            disabled={submitting}
            onClick={onClose}
          />
        )}
      </Box>
      )}
    </Dialog>
  );
};

export default CreateCompanyModal;
