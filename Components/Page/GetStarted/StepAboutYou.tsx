import React, { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, Box, TextField, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { ICountry } from "country-state-city";
import { Icon } from "@/styles/uiKit";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import useIdentityVerified from "@/hooks/useIdentityVerified";
import { useCountryStateCity } from "@/hooks/useCountryStateCity";
import { fetchGeoDefaults } from "@/utils/geoDefaults";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { rootReducer } from "@/utils/types";
import { trackOnboarding } from "@/utils/trackOnboarding";
import { isPlaceholderBrandName } from "@/helpers/brandName";
import { StepFooter, StepHeader } from "./StepChrome";
import ImageDropTarget from "@/Components/UI/ImageDropTarget";
import type { SetupProgress } from "./useSetupProgress";

interface Props {
  progress: SetupProgress;
  onBack?: () => void;
  onNext: () => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

/** Step 1 — About you: name, brand, country (+ optional logo). Updates the auto-provisioned account. */
const StepAboutYou: React.FC<Props> = ({ progress, onBack, onNext }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const companyState = useCompanyStore();
  const { verified: nameLocked } = useIdentityVerified();
  const userState = useSelector((s: rootReducer) => s.userReducer) as any;
  const { account, hasAccount } = progress;
  const fileRef = useRef<HTMLInputElement>(null);

  const csc = useCountryStateCity();
  const allCountries = useMemo<ICountry[]>(() => csc?.Country.getAllCountries() ?? [], [csc]);

  const currentType: "individual" | "business" =
    String(account?.account_type ?? "individual").toLowerCase() === "business" ? "business" : "individual";
  const [accountType, setAccountType] = useState<"individual" | "business">(currentType);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [country, setCountry] = useState<ICountry | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const seeded = useRef(false);
  // A3: registration already captured the name (and the purpose) — show them as
  // a compact summary instead of asking again; "Edit" / "Change" re-open the fields.
  const [identityKnown, setIdentityKnown] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  // Prefill from the account row (DB truth) → user profile → nothing.
  useEffect(() => {
    if (seeded.current || !allCountries.length) return;
    if (!companyState.fetched) return;
    seeded.current = true;
    const profile = userState?.profile ?? {};
    const fullName = String(profile.name || userState?.name || "").trim();
    const [pf, ...prest] = fullName.split(/\s+/);
    const seededFirst = String(account?.contact_first_name || profile.first_name || pf || "");
    const seededLast = String(account?.contact_last_name || profile.last_name || prest.join(" ") || "");
    setFirstName(seededFirst);
    setLastName(seededLast);
    setIdentityKnown(Boolean(seededFirst.trim() && seededLast.trim()));
    // A1: never pre-fill the brand with the generated placeholder — make them type a real one.
    const seededBrand = String(account?.company_name || "");
    setBrandName(isPlaceholderBrandName(seededBrand, [account?.email, profile.email]) ? "" : seededBrand);
    setAccountType(currentType);
    if (account?.photo) setImagePreview(String(account.photo));
    const iso = String(account?.country || "").toUpperCase();
    const found = iso ? allCountries.find((c) => c.isoCode.toUpperCase() === iso) : undefined;
    if (found) {
      setCountry(found);
    } else {
      fetchGeoDefaults().then((d) => {
        if (!d.country) return;
        const geo = allCountries.find((c) => c.isoCode.toUpperCase() === d.country);
        if (geo) setCountry((prev) => prev ?? geo);
      }).catch(() => {});
    }
  }, [allCountries, companyState.fetched, account, userState, currentType]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!nameLocked && !firstName.trim()) next.firstName = t("gs.errFirstName", { defaultValue: "Enter your first name" });
    if (!nameLocked && !lastName.trim()) next.lastName = t("gs.errLastName", { defaultValue: "Enter your last name" });
    if (!brandName.trim()) next.brandName = t("gs.errBrandName", { defaultValue: "Enter a brand or display name" });
    if (!country) next.country = t("gs.errCountry", { defaultValue: "Choose your country" });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setErrors((e) => ({ ...e, logo: t("gs.errFile", { defaultValue: "Use a PNG, JPG, GIF, WEBP or SVG under 5 MB" }) }));
      return;
    }
    setErrors((e) => ({ ...e, logo: "" }));
    setMediaFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    const data: Record<string, unknown> = {
      company_name: brandName.trim(),
      country: country?.isoCode ?? "",
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    };
    const formData = new FormData();
    if (mediaFile) formData.append("image", mediaFile);
    try {
      if (hasAccount && account?.company_id) {
        formData.append("data", JSON.stringify(data));
        await companyState.updateCompany({ id: account.company_id, formData });
        if (accountType === "business" && currentType === "individual") {
          await axiosBaseApi.put(API_ENDPOINTS.company.upgradeToBusiness(account.company_id), {
            company_name: brandName.trim(),
            country: country?.isoCode ?? "",
          });
          await companyState.refetchCompanies();
        }
      } else {
        formData.append(
          "data",
          JSON.stringify({ ...data, country_name: country?.name ?? "", account_type: accountType, currency: "USD" }),
        );
        const created = await companyState.addCompany(formData);
        const id = Number((created as any)?.company_id);
        if (Number.isFinite(id) && id > 0) companyState.selectCompany(id);
      }
      trackOnboarding({ event_type: "step_completed", step_key: "company", metadata: { surface: "wizard" } });
      setSubmitting(false);
      onNext();
    } catch (e: any) {
      setSubmitting(false);
      setErrors((prev) => ({
        ...prev,
        form: e?.response?.data?.message || t("gs.errGeneric", { defaultValue: "Couldn't save — please try again." }),
      }));
    }
  };

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const labelSx = { fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: ink, mb: 0.5, ml: 0.25 };
  const inputSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "10px",
      fontSize: 15,
      fontFamily: "var(--font-sans)",
      minHeight: 44,
      "& fieldset": { borderColor: theme.palette.divider },
      "&:hover fieldset": { borderColor: theme.palette.divider },
      "&.Mui-focused fieldset": { borderColor: theme.palette.primary.main },
    },
    "& .MuiFormHelperText-root": { fontFamily: "var(--font-sans)", fontSize: 12, ml: "4px" },
  };

  return (
    <Box data-testid="gs-step-about">
      <StepHeader
        eyebrow={t("gs.stepOf", { n: 2, total: 5, defaultValue: "Step {{n}} of {{total}}" })}
        title={t("gs.aboutTitle", { defaultValue: "Tell us about you" })}
        subtitle={t("gs.aboutSubtitle", {
          defaultValue: "This appears on your checkout and receipts. You can change it anytime in Settings.",
        })}
      />

      <Box sx={{ display: "grid", gap: 2.25, maxWidth: 640 }}>
        {currentType === "individual" && !typeOpen ? (
          <Box data-testid="gs-type-summary" sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.125, borderRadius: "12px", border: `1px solid ${border}` }}>
            <Box sx={{ color: indigo, display: "flex" }}><Icon name={accountType === "business" ? "store" : "user-round"} size={18} /></Box>
            <Box sx={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 13.5, color: ink }}>
              <Box component="span" sx={{ color: muted }}>{t("gs.accountTypeShort", { defaultValue: "Account type" })}: </Box>
              <Box component="span" sx={{ fontWeight: 700 }}>
                {accountType === "business" ? t("gs.typeBusiness", { defaultValue: "Registered business" }) : t("gs.typeIndividual", { defaultValue: "Individual / creator" })}
              </Box>
            </Box>
            <Box component="button" type="button" data-testid="gs-type-change" onClick={() => setTypeOpen(true)} sx={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: indigo, p: 0.5, borderRadius: 6, "&:focus-visible": { outline: `2px solid ${indigo}` } }}>
              {t("gs.change", { defaultValue: "Change" })}
            </Box>
          </Box>
        ) : currentType === "individual" ? (
          <Box>
            <Box sx={{ ...labelSx, mb: 1 }}>{t("gs.accountTypeLabel", { defaultValue: "How will you get paid?" })}</Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
              {(
                [
                  { key: "individual", icon: "user-round", title: t("gs.typeIndividual", { defaultValue: "Individual / creator" }), desc: t("gs.typeIndividualDesc", { defaultValue: "Personal payments, tips and a public page." }) },
                  { key: "business", icon: "store", title: t("gs.typeBusiness", { defaultValue: "Registered business" }), desc: t("gs.typeBusinessDesc", { defaultValue: "Invoices, VAT/tax and team access." }) },
                ] as const
              ).map((opt) => {
                const selected = accountType === opt.key;
                return (
                  <Box
                    key={opt.key}
                    role="radio"
                    aria-checked={selected}
                    tabIndex={0}
                    data-testid={`gs-type-${opt.key}`}
                    onClick={() => setAccountType(opt.key)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setAccountType(opt.key);
                      }
                    }}
                    sx={{
                      display: "flex",
                      gap: 1.25,
                      p: 1.5,
                      borderRadius: "12px",
                      cursor: "pointer",
                      outline: "none",
                      border: `1.5px solid ${selected ? indigo : border}`,
                      backgroundColor: selected ? (isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow) : "transparent",
                      transition: "border-color 160ms ease, background-color 160ms ease",
                      "&:focus-visible": { boxShadow: `0 0 0 2px ${indigo}` },
                    }}
                  >
                    <Box sx={{ color: selected ? indigo : muted, mt: "2px" }}>
                      <Icon name={opt.icon} size={20} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink, display: "flex", alignItems: "center", gap: 0.5 }}>
                        {opt.title}
                        {selected && <Icon name="check" size={15} color={indigo} />}
                      </Box>
                      <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, lineHeight: 1.4 }}>{opt.desc}</Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : (
          <Box data-testid="gs-type-business-chip" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, alignSelf: "flex-start", px: 1.25, py: 0.5, borderRadius: 999, border: `1px solid ${indigo}`, color: indigo, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            <Icon name="store" size={14} />
            {t("gs.typeBusiness", { defaultValue: "Registered business" })}
          </Box>
        )}

        {identityKnown && !editingName ? (
          <Box data-testid="gs-name-summary" sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.125, borderRadius: "12px", border: `1px solid ${border}` }}>
            <Box sx={{ color: indigo, display: "flex" }}><Icon name="check" size={18} /></Box>
            <Box sx={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 13.5, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <Box component="span" sx={{ color: muted }}>{t("gs.signedUpAs", { defaultValue: "Signed up as" })} </Box>
              <Box component="span" sx={{ fontWeight: 700 }}>{firstName} {lastName}</Box>
            </Box>
            {!nameLocked && (
              <Box component="button" type="button" data-testid="gs-name-edit" onClick={() => setEditingName(true)} sx={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: indigo, p: 0.5, borderRadius: 6, "&:focus-visible": { outline: `2px solid ${indigo}` } }}>
                {t("gs.edit", { defaultValue: "Edit" })}
              </Box>
            )}
          </Box>
        ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          <InputField
            data-testid="gs-first-name"
            label={t("gs.firstName", { defaultValue: "First name" })}
            value={firstName}
            disabled={nameLocked}
            onChange={(e) => { setFirstName(e.target.value); if (errors.firstName) setErrors({ ...errors, firstName: "" }); }}
            error={!!errors.firstName}
            helperText={errors.firstName}
          />
          <InputField
            data-testid="gs-last-name"
            label={t("gs.lastName", { defaultValue: "Last name" })}
            value={lastName}
            disabled={nameLocked}
            onChange={(e) => { setLastName(e.target.value); if (errors.lastName) setErrors({ ...errors, lastName: "" }); }}
            error={!!errors.lastName}
            helperText={errors.lastName}
          />
        </Box>
        )}
        {nameLocked && (!identityKnown || editingName) && (
          <Box sx={{ mt: -1.25, fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
            {t("gs.nameLocked", { defaultValue: "Your name is verified and can't be changed here." })}
          </Box>
        )}

        <InputField
          data-testid="gs-brand-name"
          label={t("gs.brandName", { defaultValue: "Brand or display name" })}
          placeholder={t("gs.brandNamePlaceholder", { defaultValue: "e.g. Ada's Studio" })}
          value={brandName}
          onChange={(e) => { setBrandName(e.target.value); if (errors.brandName) setErrors({ ...errors, brandName: "" }); }}
          error={!!errors.brandName}
          helperText={errors.brandName || t("gs.brandNameHelp", { defaultValue: "Shown to customers at checkout." })}
        />

        <Box>
          <Box sx={labelSx}>{t("gs.country", { defaultValue: "Country" })}</Box>
          <Autocomplete
            fullWidth
            options={allCountries}
            value={country}
            onChange={(_, v) => { setCountry(v); if (errors.country) setErrors({ ...errors, country: "" }); }}
            getOptionLabel={(o) => o?.name || ""}
            isOptionEqualToValue={(a, b) => a?.isoCode === b?.isoCode}
            filterOptions={(opts, state) => {
              const q = state.inputValue.trim().toLowerCase();
              if (!q) return opts;
              return opts.filter((o) => o.name.toLowerCase().includes(q) || o.isoCode.toLowerCase().startsWith(q));
            }}
            renderOption={(props, option) => (
              <Box component="li" {...props} data-testid={`gs-country-option-${option.isoCode}`} sx={{ display: "flex", gap: 1, py: 0.75, fontFamily: "var(--font-sans)", fontSize: 14 }}>
                <span style={{ fontSize: 18 }}>{option.flag}</span>
                <span style={{ flex: 1 }}>{option.name}</span>
                <span style={{ color: muted, fontSize: 12 }}>{option.isoCode}</span>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t("gs.countryPlaceholder", { defaultValue: "Search your country" })}
                error={!!errors.country}
                helperText={errors.country || t("gs.countryHelp", { defaultValue: "Sets the right currency, tax and receipt format." })}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: country ? <Box sx={{ px: 0.5, fontSize: 18 }}>{country.flag}</Box> : params.InputProps.startAdornment,
                }}
                sx={inputSx}
                inputProps={{ ...params.inputProps, "data-testid": "gs-country-input" }}
              />
            )}
          />
        </Box>

        <Box>
          <Box sx={labelSx}>{t("gs.logo", { defaultValue: "Logo (optional)" })}</Box>
          <ImageDropTarget onFile={handleFile} radius={10} testId="gs-logo-dropzone">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", minHeight: 44 }}>
            <Box
              component="button"
              type="button"
              data-testid="gs-logo-upload"
              onClick={() => fileRef.current?.click()}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                minHeight: 40,
                px: 1.5,
                borderRadius: "10px",
                border: `1px solid ${border}`,
                background: "transparent",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 13.5,
                fontWeight: 600,
                color: isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight,
                "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.035)" },
              }}
            >
              <Icon name="upload" size={16} />
              {imagePreview ? t("gs.logoChange", { defaultValue: "Change logo" }) : t("gs.logoUpload", { defaultValue: "Upload logo" })}
            </Box>
            {imagePreview && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }} data-testid="gs-logo-preview">
                <Box component="img" src={imagePreview} alt="" sx={{ width: 44, height: 44, borderRadius: "10px", objectFit: "cover", border: `1px solid ${border}` }} />
                {mediaFile && (
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: muted }}>
                    <Icon name="check" size={14} color={isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light} />
                    {t("gs.logoAdded", { defaultValue: "Logo added" })}
                  </Box>
                )}
              </Box>
            )}
            <input type="file" ref={fileRef} hidden accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </Box>
          </ImageDropTarget>
          {errors.logo && <Box sx={{ mt: 0.5, fontFamily: "var(--font-sans)", fontSize: 12, color: theme.palette.error.main }}>{errors.logo}</Box>}
        </Box>

        {errors.form && (
          <Box role="alert" data-testid="gs-about-error" sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.error.main }}>
            {errors.form}
          </Box>
        )}
      </Box>

      <StepFooter
        onBack={onBack}
        primaryLabel={submitting ? t("gs.saving", { defaultValue: "Saving…" }) : t("gs.saveContinue", { defaultValue: "Save and continue" })}
        onPrimary={handleSave}
        primaryLoading={submitting}
        primaryDisabled={submitting}
        primaryTestId="gs-about-save"
      />
    </Box>
  );
};

export default StepAboutYou;
