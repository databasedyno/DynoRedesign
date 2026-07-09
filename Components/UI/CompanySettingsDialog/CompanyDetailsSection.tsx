import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Grid,
  InputBase,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { ICity, ICountry, IState } from "country-state-city";
import { City, Country, State } from "country-state-city";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import DownloadIcon from "@/assets/Icons/download-icon.svg";
import { Text } from "@/Components/Page/CreatePaymentLink/styled";
import CustomButton from "@/Components/UI/Buttons";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import {
  CryptocurrencyDividerLine,
  CryptocurrencyDropdown,
  CryptocurrencyTrigger,
} from "@/Components/UI/CryptocurrencySelector/styled";
import SettingsAccordion from "@/Components/UI/SettingsAccordion";
import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_VALIDATE_TAX } from "@/Redux/Actions/CompanyAction";
import { rootReducer } from "@/utils/types";

const useLocationData = (
  formValues: { country?: string; state?: string },
  countries: ICountry[],
) => {
  const [states, setStates] = useState<IState[]>([]);
  const [cities, setCities] = useState<ICity[]>([]);
  const prevCountryRef = useRef<string>("");
  const prevStateRef = useRef<string>("");

  useEffect(() => {
    const getCountryByName = (name: string): ICountry | undefined =>
      countries.find((c) => c.name === name);
    const countryValue = String(formValues.country || "");
    if (countryValue && countryValue !== prevCountryRef.current) {
      const country = getCountryByName(countryValue);
      if (country) {
        setStates(State.getStatesOfCountry(country.isoCode));
        setCities([]);
      }
    } else if (!countryValue) {
      setStates([]);
      setCities([]);
    }
    prevCountryRef.current = countryValue;
  }, [formValues.country, countries]);

  useEffect(() => {
    const getCountryByName = (name: string): ICountry | undefined =>
      countries.find((c) => c.name === name);
    const stateValue = String(formValues.state || "");
    const countryValue = String(formValues.country || "");
    if (stateValue && countryValue && stateValue !== prevStateRef.current) {
      const country = getCountryByName(countryValue);
      if (country) {
        const statesOfCountry = State.getStatesOfCountry(country.isoCode);
        const state = statesOfCountry.find((s) => s.name === stateValue);
        if (state) {
          setCities(City.getCitiesOfState(country.isoCode, state.isoCode));
        }
      }
    } else if (!stateValue) {
      setCities([]);
    }
    prevStateRef.current = stateValue;
  }, [formValues.state, formValues.country, countries]);

  return { states, cities };
};

const vatCountries = [
  { code: "AT", label: "Austria", taxCode: "VAT" },
  { code: "BE", label: "Belgium", taxCode: "VAT" },
  { code: "BG", label: "Bulgaria", taxCode: "VAT" },
  { code: "CY", label: "Cyprus", taxCode: "VAT" },
  { code: "CZ", label: "Czech Republic", taxCode: "VAT" },
  { code: "DE", label: "Germany", taxCode: "VAT" },
  { code: "DK", label: "Denmark", taxCode: "VAT" },
  { code: "EE", label: "Estonia", taxCode: "VAT" },
  { code: "ES", label: "Spain", taxCode: "VAT" },
  { code: "FI", label: "Finland", taxCode: "VAT" },
  { code: "FR", label: "France", taxCode: "VAT" },
  { code: "GR", label: "Greece", taxCode: "VAT" },
  { code: "HR", label: "Croatia", taxCode: "VAT" },
  { code: "HU", label: "Hungary", taxCode: "VAT" },
  { code: "IE", label: "Ireland", taxCode: "VAT" },
  { code: "IT", label: "Italy", taxCode: "VAT" },
  { code: "LT", label: "Lithuania", taxCode: "VAT" },
  { code: "LU", label: "Luxembourg", taxCode: "VAT" },
  { code: "LV", label: "Latvia", taxCode: "VAT" },
  { code: "MT", label: "Malta", taxCode: "VAT" },
  { code: "NL", label: "Netherlands", taxCode: "VAT" },
  { code: "PL", label: "Poland", taxCode: "VAT" },
  { code: "PT", label: "Portugal", taxCode: "VAT" },
  { code: "RO", label: "Romania", taxCode: "VAT" },
  { code: "SE", label: "Sweden", taxCode: "VAT" },
  { code: "SI", label: "Slovenia", taxCode: "VAT" },
  { code: "SK", label: "Slovakia", taxCode: "VAT" },
  { code: "AD", label: "Andorra", taxCode: "NRT" },
  { code: "AE", label: "United Arab Emirates", taxCode: "TRN" },
  { code: "AF", label: "Afghanistan", taxCode: "TIN" },
  { code: "AL", label: "Albania", taxCode: "TIN" },
  { code: "AR", label: "Argentina", taxCode: "CUIT" },
  { code: "AU", label: "Australia", taxCode: "ABN" },
  { code: "BR", label: "Brazil (Business)", taxCode: "CNPJ" },
  { code: "CA", label: "Canada", taxCode: "BN" },
  { code: "CH", label: "Switzerland", taxCode: "VAT" },
  { code: "CN", label: "China", taxCode: "TIN" },
  { code: "GB", label: "United Kingdom", taxCode: "VAT" },
  { code: "IN", label: "India", taxCode: "GST" },
  { code: "JP", label: "Japan", taxCode: "CN" },
  { code: "MX", label: "Mexico", taxCode: "RFC" },
  { code: "NO", label: "Norway", taxCode: "VAT" },
  { code: "NZ", label: "New Zealand", taxCode: "GST" },
  { code: "SG", label: "Singapore", taxCode: "UEN" },
  { code: "US", label: "United States", taxCode: "EIN" },
  { code: "ZA", label: "South Africa", taxCode: "VAT" },
];

export type CompanyDetailsSectionValues = {
  company_name: string;
  email: string;
  mobile: string;
  website: string;
  country: string;
  state: string;
  city: string;
  address_line_1: string;
  address_line_2: string;
  zip_code: string;
  VAT_number: string;
};

export type CompanyDetailsSectionProps = {
  values: CompanyDetailsSectionValues;
  errors: Record<string, string | undefined>;
  touched: Record<string, boolean | undefined>;
  handleChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  handleBlur: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  handleFieldsChange: (fields: Record<string, unknown>) => void;
  imagePreview?: string;
  onFileChange: (file?: File) => void;
  isMobile?: boolean;
  expanded: boolean;
  onAccordionChange: (event: React.SyntheticEvent, isExpanded: boolean) => void;
  infoBannerMessage?: string;
  infoBannerChildren?: React.ReactNode;
  infoBannerSx?: object;
};

export default function CompanyDetailsSection({
  values,
  errors,
  touched,
  handleChange,
  handleBlur,
  handleFieldsChange,
  imagePreview,
  onFileChange,
  isMobile = false,
  expanded,
  onAccordionChange,
}: CompanyDetailsSectionProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("companyDialog");
  const { t: tSettings } = useTranslation("companySettings");
  const companyState = useSelector((state: rootReducer) => state.companyReducer);
  const taxValidation = companyState.taxValidation;

  const triggerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const selectedStateRef = useRef<HTMLDivElement>(null);
  const selectedCityRef = useRef<HTMLDivElement>(null);
  const selectedVatRef = useRef<HTMLDivElement | null>(null);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [stateAnchor, setStateAnchor] = useState<HTMLElement | null>(null);
  const [cityAnchor, setCityAnchor] = useState<HTMLElement | null>(null);
  const [vatAnchorEl, setVatAnchorEl] = useState<HTMLElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stateSearchTerm, setStateSearchTerm] = useState("");
  const [citySearchTerm, setCitySearchTerm] = useState("");
  const [countries, setCountries] = useState<ICountry[]>([]);
  const [vatValue, setVatValue] = useState({ code: "AT", taxCode: "VAT" });

  const isOpen = Boolean(anchorEl);

  const { states, cities } = useLocationData(values, countries);

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const filteredStates = states.filter((s) =>
    s.name.toLowerCase().includes(stateSearchTerm.toLowerCase()),
  );
  const filteredCities = cities.filter((c) =>
    c.name.toLowerCase().includes(citySearchTerm.toLowerCase()),
  );

  useEffect(() => {
    setCountries(Country.getAllCountries());
  }, []);

  return (
    <SettingsAccordion
      icon={
        <BusinessCenterIcon
          sx={{
            color: "text.primary",
            fontSize: isMobile ? "16px" : "18px",
            marginTop: "-2px",
          }}
        />
      }
      title={tSettings("title")}
      subtitle={tSettings("subtitle")}
      expanded={expanded}
      onChange={onAccordionChange}
      isMobile={isMobile}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Grid
          container
          columnSpacing={"12px"}
          rowSpacing={isMobile ? "16px" : "14px"}
        >
          <Grid item xs={isMobile ? 12 : 6}>
            <InputField
              fullWidth
              inputHeight={isMobile ? "32px" : "40px"}
              label={t("fields.companyName.label")}
              placeholder={t("fields.companyName.placeholder")}
              name="company_name"
              value={String(values.company_name || "")}
              error={Boolean(touched.company_name && errors.company_name)}
              helperText={
                touched.company_name && errors.company_name
                  ? String(errors.company_name)
                  : undefined
              }
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </Grid>
          <Grid item xs={isMobile ? 12 : 6}>
            <InputField
              fullWidth
              inputHeight={isMobile ? "32px" : "40px"}
              label={t("fields.website.label")}
              placeholder={t("fields.website.placeholder")}
              name="website"
              value={String(values.website || "")}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </Grid>
          <Grid item xs={isMobile ? 12 : 6}>
            <InputField
              fullWidth
              inputHeight={isMobile ? "32px" : "40px"}
              label={t("fields.email.label")}
              placeholder={t("fields.email.placeholder")}
              name="email"
              value={String(values.email || "")}
              error={Boolean(touched.email && errors.email)}
              helperText={
                touched.email && errors.email ? String(errors.email) : undefined
              }
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </Grid>
          <Grid item xs={isMobile ? 12 : 6}>
            <Text
              sx={{
                fontSize: isMobile ? "13px" : "15px",
                mb: isMobile ? "6px" : "8px",
              }}
            >
              {t("fields.mobile.label")} ({t("optional", { defaultValue: "optional" })})
            </Text>
            <CountryPhoneInput
              fullWidth
              placeholder={t("mobilePlaceholder")}
              name="mobile"
              defaultCountry="US"
              value={String(values.mobile || "")}
              inputHeight={isMobile ? "32px" : "40px"}
              onChange={(newValue) => handleFieldsChange({ mobile: newValue })}
              onBlur={handleBlur}
            />
          </Grid>

          {/* Country */}
          <Grid item xs={12}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text sx={{ fontSize: isMobile ? "13px" : "15px" }}>
                {t("fields.country.label")}
              </Text>
              <CryptocurrencyTrigger
                ref={triggerRef}
                onClick={(e) => {
                  setSearchTerm("");
                  setAnchorEl(e.currentTarget);
                }}
                isOpen={isOpen}
                isMobile={isMobile}
                fullWidth
                sx={{ borderRadius: "6px", padding: "0 14px", cursor: "text" }}
              >
                <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
                  <InputBase
                    id="country"
                    fullWidth
                    placeholder="Select Country"
                    value={isOpen ? searchTerm : String(values.country || "")}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: isMobile ? "13px" : "15px",
                      "& .MuiInputBase-input::placeholder": {
                        fontFamily: "var(--font-sans)",
                        fontSize: isMobile ? "10px" : "13px",
                        color: "rgba(189, 189, 189, 1)",
                      },
                    }}
                  />
                </Box>
                <Box
                  component="label"
                  htmlFor="country"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    color: "rgba(103, 103, 104, 1)",
                  }}
                >
                  <CryptocurrencyDividerLine />
                  {isOpen ? (
                    <ExpandLessIcon
                      sx={{ width: isMobile ? "20px" : "24px" }}
                    />
                  ) : (
                    <ExpandMoreIcon
                      sx={{ width: isMobile ? "20px" : "24px" }}
                    />
                  )}
                </Box>
              </CryptocurrencyTrigger>
              <Popover
                open={isOpen}
                anchorEl={anchorEl}
                onClose={() => {
                  setAnchorEl(null);
                  setSearchTerm("");
                }}
                disableAutoFocus
                disableEnforceFocus
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                transitionDuration={0}
                TransitionProps={{
                  onEntering: () => {
                    selectedItemRef.current?.scrollIntoView({
                      block: "center",
                      behavior: "auto",
                    });
                  },
                }}
                PaperProps={{
                  sx: {
                    mt: "-1px",
                    borderRadius: "6px",
                    width: triggerRef.current?.offsetWidth,
                    maxHeight: 220,
                    border: `1px solid ${theme.palette.border.main}`,
                    borderTop: "none",
                    boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
                  },
                }}
              >
                <CryptocurrencyDropdown>
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map((c) => {
                      const isSelected = c.name === values.country;
                      return (
                        <ListItemButton
                          key={c.isoCode}
                          ref={isSelected ? selectedItemRef : null}
                          selected={isSelected}
                          onClick={() => {
                            handleFieldsChange({
                              country: c.name,
                              state: "",
                              city: "",
                            });
                            setAnchorEl(null);
                            setSearchTerm("");
                          }}
                          sx={{
                            p: "8px 14px",
                            height: isMobile ? "32px" : "40px",
                            borderRadius: "100px",
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                          }}
                        >
                          <img
                            width={isMobile ? 16 : 18}
                            height={isMobile ? 16 : 18}
                            src={`https://flagcdn.com/w20/${c.isoCode.toLowerCase()}.png`}
                            alt={c.name}
                            style={{ borderRadius: "100%" }}
                          />
                          <ListItemText
                            primary={c.name}
                            primaryTypographyProps={{
                              sx: {
                                fontFamily: "var(--font-sans)",
                                fontWeight: 500,
                                fontSize: isMobile ? "13px" : "15px",
                                lineHeight: "100%",
                                letterSpacing: 0,
                              },
                            }}
                          />
                          {isSelected && (
                            <CheckIcon sx={{ ml: "auto", fontSize: 18 }} />
                          )}
                        </ListItemButton>
                      );
                    })
                  ) : (
                    <Box
                      sx={{
                        p: 2,
                        textAlign: "center",
                        color: "text.secondary",
                      }}
                    >
                      <Typography variant="body2">{t("noResultsFound")}</Typography>
                    </Box>
                  )}
                </CryptocurrencyDropdown>
              </Popover>
            </Box>
          </Grid>

          {/* State */}
          <Grid item xs={isMobile ? 12 : 6}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text sx={{ fontSize: isMobile ? "13px" : "15px" }}>
                {t("fields.state.label")}
              </Text>
              <CryptocurrencyTrigger
                ref={stateRef}
                onClick={(e) => {
                  if (!values.country) return;
                  setStateSearchTerm("");
                  setStateAnchor(e.currentTarget);
                }}
                isOpen={Boolean(stateAnchor)}
                isMobile={isMobile}
                fullWidth
                sx={{
                  borderRadius: "6px",
                  padding: "0 14px",
                  opacity: values.country ? 1 : 0.5,
                  cursor: values.country ? "text" : "not-allowed",
                  pointerEvents: values.country ? "auto" : "none",
                }}
              >
                <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
                  <InputBase
                    id="state"
                    fullWidth
                    placeholder="Select State"
                    value={
                      stateAnchor ? stateSearchTerm : String(values.state || "")
                    }
                    onChange={(e) => setStateSearchTerm(e.target.value)}
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: isMobile ? "13px" : "15px",
                      "& .MuiInputBase-input::placeholder": {
                        fontFamily: "var(--font-sans)",
                        fontSize: isMobile ? "10px" : "13px",
                        color: "rgba(189, 189, 189, 1)",
                      },
                    }}
                  />
                </Box>
                <Box
                  component="label"
                  htmlFor="state"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    color: "rgba(103, 103, 104, 1)",
                  }}
                >
                  <CryptocurrencyDividerLine />
                  {stateAnchor ? (
                    <ExpandLessIcon
                      sx={{ width: isMobile ? "20px" : "24px" }}
                    />
                  ) : (
                    <ExpandMoreIcon
                      sx={{ width: isMobile ? "20px" : "24px" }}
                    />
                  )}
                </Box>
              </CryptocurrencyTrigger>
              <Popover
                open={Boolean(stateAnchor)}
                anchorEl={stateAnchor}
                onClose={() => {
                  setStateAnchor(null);
                  setStateSearchTerm("");
                }}
                disableAutoFocus
                disableEnforceFocus
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                transitionDuration={0}
                TransitionProps={{
                  onEntering: () => {
                    selectedStateRef.current?.scrollIntoView({
                      block: "center",
                      behavior: "auto",
                    });
                  },
                }}
                PaperProps={{
                  sx: {
                    mt: "-1px",
                    borderRadius: "6px",
                    width: "fit-content",
                    maxHeight: 220,
                    border: `1px solid ${theme.palette.border.main}`,
                    borderTop: "none",
                    boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
                  },
                }}
              >
                <CryptocurrencyDropdown>
                  {filteredStates.length > 0 ? (
                    filteredStates.map((s) => {
                      const isSelected = s.name === values.state;
                      return (
                        <ListItemButton
                          key={s.isoCode}
                          ref={isSelected ? selectedStateRef : null}
                          selected={isSelected}
                          onClick={() => {
                            handleFieldsChange({ state: s.name, city: "" });
                            setStateAnchor(null);
                            setStateSearchTerm("");
                          }}
                          sx={{
                            p: "8px 14px",
                            minHeight: isMobile ? "32px" : "40px",
                            borderRadius: "100px",
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                          }}
                        >
                          <ListItemText
                            primary={s.name}
                            primaryTypographyProps={{
                              sx: {
                                fontFamily: "var(--font-sans)",
                                fontWeight: 500,
                                fontSize: isMobile ? "13px" : "15px",
                                lineHeight: "100%",
                                letterSpacing: 0,
                                whiteSpace: "nowrap",
                              },
                            }}
                          />
                          {isSelected && (
                            <CheckIcon sx={{ ml: "auto", fontSize: 18 }} />
                          )}
                        </ListItemButton>
                      );
                    })
                  ) : (
                    <Box
                      sx={{
                        p: 2,
                        textAlign: "center",
                        color: "text.secondary",
                      }}
                    >
                      <Typography variant="body2">{t("noResultsFound")}</Typography>
                    </Box>
                  )}
                </CryptocurrencyDropdown>
              </Popover>
            </Box>
          </Grid>

          {/* City */}
          <Grid item xs={isMobile ? 12 : 6}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text sx={{ fontSize: isMobile ? "13px" : "15px" }}>
                {t("fields.city.label")}
              </Text>
              <CryptocurrencyTrigger
                ref={cityRef}
                onClick={(e) => {
                  if (!values.state) return;
                  setCitySearchTerm("");
                  setCityAnchor(e.currentTarget);
                }}
                isOpen={Boolean(cityAnchor)}
                isMobile={isMobile}
                fullWidth
                sx={{
                  borderRadius: "6px",
                  padding: "0 14px",
                  opacity: values.state ? 1 : 0.5,
                  cursor: values.state ? "text" : "not-allowed",
                  pointerEvents: values.state ? "auto" : "none",
                }}
              >
                <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
                  <InputBase
                    id="city"
                    fullWidth
                    placeholder="Select City"
                    value={
                      cityAnchor ? citySearchTerm : String(values.city || "")
                    }
                    onChange={(e) => setCitySearchTerm(e.target.value)}
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: isMobile ? "13px" : "15px",
                      "& .MuiInputBase-input::placeholder": {
                        fontFamily: "var(--font-sans)",
                        fontSize: isMobile ? "10px" : "13px",
                        color: "rgba(189, 189, 189, 1)",
                      },
                    }}
                  />
                </Box>
                <Box
                  component="label"
                  htmlFor="city"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    color: "rgba(103, 103, 104, 1)",
                  }}
                >
                  <CryptocurrencyDividerLine />
                  {cityAnchor ? (
                    <ExpandLessIcon
                      sx={{ width: isMobile ? "20px" : "24px" }}
                    />
                  ) : (
                    <ExpandMoreIcon
                      sx={{ width: isMobile ? "20px" : "24px" }}
                    />
                  )}
                </Box>
              </CryptocurrencyTrigger>
              <Popover
                open={Boolean(cityAnchor)}
                anchorEl={cityAnchor}
                onClose={() => {
                  setCityAnchor(null);
                  setCitySearchTerm("");
                }}
                disableAutoFocus
                disableEnforceFocus
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                transitionDuration={0}
                TransitionProps={{
                  onEntering: () => {
                    selectedCityRef.current?.scrollIntoView({
                      block: "center",
                      behavior: "auto",
                    });
                  },
                }}
                PaperProps={{
                  sx: {
                    mt: "-1px",
                    borderRadius: "6px",
                    width: "fit-content",
                    maxHeight: 220,
                    border: `1px solid ${theme.palette.border.main}`,
                    borderTop: "none",
                    boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
                  },
                }}
              >
                <CryptocurrencyDropdown>
                  {filteredCities.length > 0 ? (
                    filteredCities.map((c) => {
                      const isSelected = c.name === values.city;
                      return (
                        <ListItemButton
                          key={c.name}
                          ref={isSelected ? selectedCityRef : null}
                          selected={isSelected}
                          onClick={() => {
                            handleFieldsChange({ city: c.name });
                            setCityAnchor(null);
                            setCitySearchTerm("");
                          }}
                          sx={{
                            p: "8px 14px",
                            minHeight: isMobile ? "32px" : "40px",
                            borderRadius: "100px",
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                          }}
                        >
                          <ListItemText
                            primary={c.name}
                            primaryTypographyProps={{
                              sx: {
                                fontFamily: "var(--font-sans)",
                                fontWeight: 500,
                                fontSize: isMobile ? "13px" : "15px",
                                lineHeight: "100%",
                                letterSpacing: 0,
                                whiteSpace: "nowrap",
                              },
                            }}
                          />
                          {isSelected && (
                            <CheckIcon sx={{ ml: "auto", fontSize: 18 }} />
                          )}
                        </ListItemButton>
                      );
                    })
                  ) : (
                    <Box
                      sx={{
                        p: 2,
                        textAlign: "center",
                        color: "text.secondary",
                      }}
                    >
                      <Typography variant="body2">{t("noResultsFound")}</Typography>
                    </Box>
                  )}
                </CryptocurrencyDropdown>
              </Popover>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <InputField
              fullWidth
              inputHeight={isMobile ? "32px" : "40px"}
              label={t("fields.addressLine1.label")}
              placeholder={t("fields.addressLine1.placeholder")}
              name="address_line_1"
              value={String(values.address_line_1 || "")}
              error={Boolean(touched.address_line_1 && errors.address_line_1)}
              helperText={
                touched.address_line_1 && errors.address_line_1
                  ? String(errors.address_line_1)
                  : undefined
              }
              onChange={handleChange}
              onBlur={handleBlur}
              sx={{ gap: "8px" }}
            />
          </Grid>

          <Grid item xs={12}>
            <InputField
              fullWidth
              inputHeight={isMobile ? "32px" : "40px"}
              label={t("fields.addressLine2.label")}
              placeholder={t("fields.addressLine2.placeholder")}
              name="address_line_2"
              value={String(values.address_line_2 || "")}
              error={Boolean(touched.address_line_2 && errors.address_line_2)}
              helperText={
                touched.address_line_2 && errors.address_line_2
                  ? String(errors.address_line_2)
                  : undefined
              }
              onChange={handleChange}
              onBlur={handleBlur}
              sx={{ gap: "8px" }}
            />
          </Grid>

          <Grid item xs={12}>
            <InputField
              fullWidth
              inputHeight={isMobile ? "32px" : "40px"}
              label={t("fields.zipCode.label")}
              placeholder={t("fields.zipCode.placeholder")}
              name="zip_code"
              value={String(values.zip_code || "")}
              error={Boolean(touched.zip_code && errors.zip_code)}
              helperText={
                touched.zip_code && errors.zip_code
                  ? String(errors.zip_code)
                  : undefined
              }
              onChange={handleChange}
              onBlur={handleBlur}
              sx={{ gap: "8px" }}
            />
          </Grid>

          {/* VAT Number */}
          <Grid item xs={12}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text sx={{ fontSize: isMobile ? "13px" : "15px" }}>
                {t("vatNumber")}
              </Text>
              <Grid container spacing={isMobile ? "8px" : "0px"}>
                <Grid item xs={5} md={3.6}>
                  <Box
                    maxWidth="150px"
                    onClick={(e) =>
                      setVatAnchorEl(
                        vatAnchorEl ? null : (e.currentTarget as HTMLElement),
                      )
                    }
                    sx={{
                      cursor: "pointer",
                      border: `1px solid ${theme.palette.border.main}`,
                      borderRadius: "6px",
                      width: "100%",
                      height: isMobile ? "32px" : "40px",
                      padding: isMobile ? "8px" : "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <img
                      width={isMobile ? 14 : 20}
                      height={isMobile ? 14 : 20}
                      src={`https://flagcdn.com/w20/${vatValue.code.toLowerCase()}.png`}
                      alt={vatValue.code}
                      style={{ borderRadius: "100%" }}
                    />
                    <Typography
                      sx={{
                        fontSize: isMobile ? "10px" : "13px",
                        fontFamily: "var(--font-sans)",
                        lineHeight: "100%",
                        letterSpacing: 0,
                        fontWeight: 500,
                      }}
                    >
                      {vatValue.code} {vatValue.taxCode}
                    </Typography>
                    <Box
                      sx={{
                        width: "1px",
                        height: "20px",
                        backgroundColor: "#D9D9D9",
                      }}
                    />
                    {vatAnchorEl ? (
                      <ExpandLessIcon
                        sx={{ width: "20px", color: theme.palette.text.secondary }}
                      />
                    ) : (
                      <ExpandMoreIcon
                        sx={{ width: "20px", color: theme.palette.text.secondary }}
                      />
                    )}
                  </Box>
                  <Popover
                    open={Boolean(vatAnchorEl)}
                    anchorEl={vatAnchorEl}
                    onClose={() => setVatAnchorEl(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                    transformOrigin={{ vertical: "top", horizontal: "left" }}
                    transitionDuration={0}
                    TransitionProps={{
                      onEntering: () => {
                        selectedVatRef.current?.scrollIntoView({
                          block: "center",
                          behavior: "auto",
                        });
                      },
                    }}
                    PaperProps={{
                      sx: {
                        width: "170px",
                        height: "220px",
                        padding: "5px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "5px",
                        borderRadius: "6px",
                      },
                    }}
                  >
                    {vatCountries.map((country, idx) => (
                      <Box
                        key={`${country.code}-${country.taxCode}-${idx}`}
                        ref={
                          country.code === vatValue.code &&
                          country.taxCode === vatValue.taxCode
                            ? selectedVatRef
                            : null
                        }
                        onClick={() => {
                          setVatValue({
                            ...vatValue,
                            code: country.code,
                            taxCode: country.taxCode,
                          });
                          setVatAnchorEl(null);
                        }}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          cursor: "pointer",
                          backgroundColor:
                            country.code === vatValue.code &&
                            country.taxCode === vatValue.taxCode
                              ? "primary.light"
                              : "",
                          borderRadius: "63px",
                          height: "40px",
                          padding: "10px 14px",
                          alignItems: "center",
                          "&:hover": {
                            backgroundColor:
                              country.code === vatValue.code &&
                              country.taxCode === vatValue.taxCode
                                ? "primary.light"
                                : "action.hover",
                          },
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                          }}
                        >
                          <img
                            width={isMobile ? 16 : 20}
                            height={isMobile ? 16 : 20}
                            src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`}
                            alt={country.label}
                            style={{ borderRadius: "100%" }}
                          />
                          <Typography
                            sx={{
                              fontSize: "13px",
                              fontFamily: "var(--font-sans)",
                              lineHeight: "100%",
                              letterSpacing: 0,
                              fontWeight: 500,
                            }}
                          >
                            {country.code} {country.taxCode}
                          </Typography>
                        </Box>
                        {country.code === vatValue.code &&
                          country.taxCode === vatValue.taxCode && (
                            <CheckIcon sx={{ width: "20px", height: "15px" }} />
                          )}
                      </Box>
                    ))}
                  </Popover>
                </Grid>
                <Grid item xs={7} md={8.4}>
                  <InputField
                    fullWidth
                    placeholder="Enter VAT number"
                    value={values.VAT_number || ""}
                    onChange={(e) =>
                      handleFieldsChange({ VAT_number: e.target.value })
                    }
                    inputHeight={isMobile ? "32px" : "38px"}
                  />
                </Grid>
                <Grid item xs={12} md={12}>
                  <CustomButton
                    data-testid="validate-tax-btn"
                    label={companyState.loading ? "Validating..." : t("validateTax", { defaultValue: "Validate Tax ID" })}
                    variant="secondary"
                    size="small"
                    disabled={!values.VAT_number || companyState.loading}
                    onClick={() => {
                      dispatch(
                        CompanyAction(COMPANY_VALIDATE_TAX, {
                          taxId: values.VAT_number,
                          country: vatValue.code,
                        })
                      );
                    }}
                    sx={{ height: 32, fontSize: 12, mt: 0.5 }}
                  />
                </Grid>
              </Grid>
            </Box>
            {taxValidation && (
            <Box
              sx={{
                mt: "8px",
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 12px",
                backgroundColor: taxValidation.valid !== false ? "#DDF5DC" : "#FDE8E8",
                borderRadius: "7px",
              }}
            >
              <Box sx={{ display: "flex", gap: "5px", alignItems: "center" }}>
                <CheckIcon
                  sx={{ width: "16px", height: "16px", color: taxValidation.valid !== false ? "#1B902B" : "#E84848" }}
                />
                <Typography
                  sx={{
                    fontSize: "12px",
                    color: taxValidation.valid !== false ? "#1B902B" : "#E84848",
                    fontWeight: 500,
                    fontFamily: "var(--font-sans)",
                    lineHeight: "100%",
                    letterSpacing: 0,
                  }}
                >
                  {taxValidation.valid !== false ? t("vatVerify") : (taxValidation.message || "Tax ID validation failed")}
                </Typography>
              </Box>
              <CloseIcon sx={{ width: "16px", height: "16px" }} />
            </Box>
            )}
          </Grid>

          {/* Brand Logo / Profile Image */}
          <Grid item xs={12}>
            <Text sx={{ fontSize: "15px", mb: "8px" }}>
              {t("fields.brandLogo.label")}
            </Text>
            <Box
              sx={{
                border: "1px dashed #E9ECF2",
                borderRadius: "8px",
                px: 2,
                py: 2,
                textAlign: "center",
                cursor: "pointer",
                userSelect: "none",
                backgroundColor: theme.palette.background.paper,
                transition: "all 0.2s ease",
                "&:hover": {
                  borderColor: theme.palette.primary.light,
                  backgroundColor: "#FAFBFF",
                },
              }}
              onClick={() => fileRef.current?.click()}
            >
              <input
                type="file"
                ref={fileRef}
                hidden
                accept="image/*"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  onFileChange(file);
                  e.target.value = "";
                }}
              />
              {!imagePreview ? (
                <>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "fit-content",
                      height: "fit-content",
                      gap: 1,
                      backgroundColor: theme.palette.text.secondary,
                      borderRadius: "6px",
                      padding: "4px",
                      mx: "auto",
                      mb: 1,
                    }}
                  >
                    <Image
                      src={DownloadIcon.src}
                      alt="download-icon"
                      width={12}
                      height={12}
                      draggable={false}
                    />
                  </Box>
                  <Typography
                    sx={{
                      fontSize: isMobile ? 10 : 13,
                      color: theme.palette.text.secondary,
                      mb: 0.5,
                      fontWeight: 400,
                    }}
                  >
                    {t("fields.brandLogo.uploadCta")}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: isMobile ? 9 : 12,
                      color: theme.palette.text.secondary,
                      fontWeight: 400,
                    }}
                  >
                    {t("fields.brandLogo.uploadHint")}
                  </Typography>
                </>
              ) : (
                <Box sx={{ mt: 1.5 }}>
                  <Image
                    src={imagePreview}
                    alt="logo preview"
                    crossOrigin="anonymous"
                    width={64}
                    height={64}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      objectFit: "cover",
                    }}
                    draggable={false}
                  />
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </SettingsAccordion>
  );
}
