import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { Box, useTheme } from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";

import FormManager from "@/Components/Page/Common/FormManager";
import type { Values } from "@/Components/Page/Common/FormManager/types";
import CustomButton from "@/Components/UI/Buttons";
import PopupModal from "@/Components/UI/PopupModal";
import useIsMobile from "@/hooks/useIsMobile";
import { ICompany, rootReducer } from "@/utils/types";
import axiosBaseApi from "@/axiosConfig";

import Toast from "../Toast";
import DeleteBrandModal from "../DeleteBrandModal";
import CompanyDetailsSection from "./CompanyDetailsSection";
import ImageCropperDialog from "@/Components/UI/ImageCropperDialog";
import { isCroppableImage } from "@/Components/UI/ImageCropperDialog/cropImage";
import CryptoConversionSection from "./CryptoConversionSection";
import PaymentToleranceSection from "./PaymentToleranceSection";
import WebhookNotificationsSection from "./WebhookNotificationsSection";
import { API_ENDPOINTS } from "@/api/endpoints";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";

// Settings radio value ↔ backend settlement pair. The auto-convert endpoint
// needs the concrete currency + chain; a bare `target_stablecoin` key used to be
// ignored (200 "select_wallet"), leaving auto-convert OFF while the UI said saved.
const STABLECOIN_OPTIONS: Record<string, [string, string]> = {
  usdt_trc20: ["USDT", "TRC20"],
  usdt_erc20: ["USDT", "ERC20"],
  usdc_erc20: ["USDC", "ERC20"],
};
const toStablecoinOption = (currency?: string | null, chain?: string | null) =>
  Object.keys(STABLECOIN_OPTIONS).find(
    (k) => STABLECOIN_OPTIONS[k][0] === currency && STABLECOIN_OPTIONS[k][1] === chain,
  ) ?? null;

export type CompanySettingsDialogProps = {
  open: boolean;
  company: ICompany | null;
  onClose: () => void;
  /** Render inline (no modal chrome) — used by the /settings page */
  inline?: boolean;
  /** Only render these form sections (default: all four) */
  visibleSections?: Array<"company" | "crypto" | "webhook" | "payment">;
};

type CompanySettingsFormValues = {
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
  webhook_notification_url: string;
  webhook_secret_key: string;
  underpayment_threshold_usd: string;
  grace_period_minutes: string;
  auto_convert_volatile_crypto: string;
  convert_to_stablecoin: string;
};

const initialFormValues: CompanySettingsFormValues = {
  company_name: "",
  email: "",
  mobile: "",
  website: "",
  country: "",
  state: "",
  city: "",
  address_line_1: "",
  address_line_2: "",
  zip_code: "",
  VAT_number: "",
  webhook_notification_url: "https://mystore.com/dynopay-webhook",
  webhook_secret_key: "wh_sec_....................xyz123",
  underpayment_threshold_usd: "1.00",
  grace_period_minutes: "30",
  auto_convert_volatile_crypto: "no",
  convert_to_stablecoin: "usdt_trc20",
};

export default function CompanySettingsDialog({
  open,
  company,
  onClose,
  inline = false,
  visibleSections,
}: CompanySettingsDialogProps) {
  const sections = visibleSections ?? ["company", "crypto", "webhook", "payment"];
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const { t } = useTranslation("companyDialog");
  const { t: tSettings } = useTranslation("companySettings");
  const dispatch = useDispatch();
  const companyState = useCompanyStore();

  const [formKey, setFormKey] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const [mediaFile, setMediaFile] = useState<File | undefined>();
  const [savingLogo, setSavingLogo] = useState(false);
  const [expanded, setExpanded] = useState<string | false>("company");
  // Account-type choice (individual <-> business). Seeded from the company row;
  // a business account cannot be switched back to individual (no downgrade).
  const originalAccountType: "individual" | "business" =
    String((company as unknown as Record<string, unknown>)?.account_type ?? "business").toLowerCase() === "individual"
      ? "individual"
      : "business";
  const [accountTypeChoice, setAccountTypeChoice] = useState<"individual" | "business">(originalAccountType);
  const [openToast, setOpenToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoConvertData, setAutoConvertData] = useState<{
    auto_convert_volatile_crypto: string;
    convert_to_stablecoin: string;
  } | null>(null);
  const [webhookData, setWebhookData] = useState<{
    webhook_url: string;
    webhook_secret: string;
  } | null>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

  const companyName = company?.company_name ?? "";

  const handleDeleteCompany = async (otp: string) => {
    if (!company?.company_id) return;
    await companyState.deleteCompany(company.company_id, otp);
    onClose();
  };

  const showToast = (message: string, severity: "success" | "error" = "success") => {
    setOpenToast(false);
    setToastMessage(message);
    setToastSeverity(severity);
    setTimeout(() => setOpenToast(true), 0);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setOpenToast(false), 5000);
  };

  const handleAccordionChange =
    (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
    };

  const initialValues = useMemo<CompanySettingsFormValues>(() => {
    if (company) {
      const companyAny = company as unknown as Record<string, unknown>;
      return {
        ...initialFormValues,
        company_name: company.company_name ?? "",
        email: company.email ?? "",
        mobile: company.mobile ?? "",
        website: company.website ?? "",
        country: company.country ?? "",
        state: company.state ?? "",
        city: company.city ?? "",
        address_line_1: company.address_line_1 ?? "",
        address_line_2: company.address_line_2 ?? "",
        zip_code: company.zip_code ?? "",
        VAT_number: company.VAT_number ?? "",
        webhook_notification_url:
          (companyAny.webhook_notification_url as string | undefined) ??
          initialFormValues.webhook_notification_url,
        webhook_secret_key:
          (companyAny.webhook_secret_key as string | undefined) ??
          initialFormValues.webhook_secret_key,
        auto_convert_volatile_crypto:
          autoConvertData?.auto_convert_volatile_crypto ??
          (companyAny.auto_convert_volatile_crypto as string | undefined) ??
          initialFormValues.auto_convert_volatile_crypto,
        convert_to_stablecoin:
          autoConvertData?.convert_to_stablecoin ??
          (companyAny.convert_to_stablecoin as string | undefined) ??
          initialFormValues.convert_to_stablecoin,
        underpayment_threshold_usd:
          companyAny.underpayment_threshold_usd != null
            ? String(companyAny.underpayment_threshold_usd)
            : initialFormValues.underpayment_threshold_usd,
        grace_period_minutes:
          companyAny.grace_period_minutes != null
            ? String(companyAny.grace_period_minutes)
            : initialFormValues.grace_period_minutes,
      };
    }
    return { ...initialFormValues };
  }, [company, autoConvertData]);

  const schema = useMemo(
    () => {
      // Only validate fields the user can actually see. The Payments-only view
      // (Settings → Payments) hides the Company fields, so a missing company
      // email must not silently disable "Save Changes" there.
      const showsCompany = sections.includes("company");
      return yup.object().shape({
        company_name: showsCompany
          ? yup.string().required(t("validation.companyNameRequired"))
          : yup.string().nullable(),
        email: showsCompany
          ? yup
              .string()
              .email(t("validation.emailInvalid"))
              .required(t("validation.emailRequired"))
          : yup.string().nullable(),
        mobile: showsCompany
          ? yup
              .string()
              .notRequired()
              .test(
                "mobile-len",
                t("validation.mobileMin"),
                (v) => !v || v.replace(/\D/g, "").length >= 10
              )
          : yup.string().nullable(),
        website: yup.string().nullable(),
        country: yup.string().nullable(),
        state: yup.string().nullable(),
        city: yup.string().nullable(),
        address_line_1: yup.string().nullable(),
        address_line_2: yup.string().nullable(),
        zip_code: yup.string().nullable(),
        VAT_number: yup.string().nullable(),
        webhook_notification_url: yup.string().nullable(),
        webhook_secret_key: yup.string().nullable(),
        underpayment_threshold_usd: yup.string().nullable(),
        grace_period_minutes: yup.string().nullable(),
        auto_convert_volatile_crypto: yup.string().nullable(),
        convert_to_stablecoin: yup.string().nullable(),
      });
    },
    [t, sections],
  );

  // When dialog opens with a company, remount form and expand first visible section
  useEffect(() => {
    if (open) {
      setExpanded(sections[0] ?? "company");
      if (company) setFormKey((prev) => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company]);

  // Keep the account-type choice in sync with the selected company.
  useEffect(() => {
    setAccountTypeChoice(originalAccountType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.company_id, open]);

  // Fetch auto-convert settings from dedicated endpoint
  useEffect(() => {
    if (open && company?.company_id) {
      axiosBaseApi
        .get(API_ENDPOINTS.company.autoConvert(company.company_id))
        .then((res) => {
          const data = res?.data?.data;
          if (data) {
            setAutoConvertData({
              auto_convert_volatile_crypto:
                data.auto_convert_enabled === true
                  ? "yes"
                  : data.auto_convert_enabled === false
                    ? "no"
                    : data.auto_convert_volatile_crypto ?? "no",
              convert_to_stablecoin:
                toStablecoinOption(data.settlement_currency, data.settlement_chain) ??
                data.target_stablecoin ??
                data.convert_to_stablecoin ??
                "usdt_trc20",
            });
          }
        })
        .catch(() => {
          // Fallback to company data
        });

      // Fetch webhook settings from dedicated endpoint
      axiosBaseApi
        .get(API_ENDPOINTS.company.webhookSettings(company.company_id))
        .then((res) => {
          const data = res?.data?.data;
          if (data) {
            setWebhookData({
              webhook_url: data.webhook_url ?? "",
              webhook_secret: data.webhook_secret ?? "",
            });
          }
        })
        .catch(() => {
          // Fallback to company data
        });
    }
  }, [open, company?.company_id]);

  useEffect(() => {
    if (!open) return;
    if (company?.photo) setImagePreview(company.photo);
    else setImagePreview(undefined);
  }, [open, company]);

  // Remount form when auto-convert data arrives from API
  useEffect(() => {
    if (autoConvertData && open) {
      setFormKey((prev) => prev + 1);
    }
  }, [autoConvertData, open]);

  const handleClose = () => {
    setMediaFile(undefined);
    setImagePreview(undefined);
    setFormKey((prev) => prev + 1);
    onClose();
  };

  const handleRequestClose = () => {
    handleClose();
  };

  // Upload the (possibly cropped) brand logo — auto-saves, no Save press needed.
  const uploadLogo = async (file: File, previewUrl?: string) => {
    setImagePreview(previewUrl || URL.createObjectURL(file));
    setMediaFile(file);
    if (!company?.company_id) return;
    const formData = new FormData();
    formData.append("data", JSON.stringify({})); // logo-only partial update
    formData.append("image", file);
    setSavingLogo(true);
    try {
      await companyState.updateCompany({ id: company.company_id, formData });
      // Persisted — clear the pending file so the main Save won't re-upload it.
      setMediaFile(undefined);
    } catch {
      // error toast is handled inside the store; revert preview to saved logo
      setImagePreview(company?.photo);
      setMediaFile(undefined);
    } finally {
      setSavingLogo(false);
    }
  };

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    // Crop & zoom step first (sharp logos). SVG/GIF/HEIC bypass the cropper
    // (vector/animation/undecodable) and upload untouched.
    if (isCroppableImage(file.type)) {
      setLogoCropFile(file);
      setLogoCropSrc(URL.createObjectURL(file));
      return; // upload happens in handleLogoCropApply
    }
    await uploadLogo(file);
  };

  // --- Crop & zoom step (brand logo) ---
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const [logoCropFile, setLogoCropFile] = useState<File | null>(null);

  const closeLogoCropper = () => {
    if (logoCropSrc) URL.revokeObjectURL(logoCropSrc);
    setLogoCropSrc(null);
    setLogoCropFile(null);
  };

  const handleLogoCropApply = (file: File, previewUrl: string) => {
    closeLogoCropper();
    uploadLogo(file, previewUrl);
  };

  const handleSubmit = async (values: Values) => {
    if (!company?.company_id) return;

    const convertingToBusiness =
      originalAccountType === "individual" && accountTypeChoice === "business";

    // Business accounts need a name + country for invoices/tax — block the
    // switch (not the whole save) with a clear message when they're missing.
    if (convertingToBusiness) {
      if (!String(values.company_name ?? "").trim()) {
        showToast("Add your business name to switch to a business account.", "error");
        return;
      }
      if (!String(values.country ?? "").trim()) {
        showToast("Add your country to switch to a business account.", "error");
        return;
      }
    }

    // Only send the fields that belong to the sections on screen. In the
    // Payments-only view this keeps hidden Company identity fields (email,
    // address, …) from being overwritten with empty strings.
    const COMPANY_FIELDS = [
      "company_name", "email", "mobile", "website", "country", "state", "city",
      "address_line_1", "address_line_2", "zip_code", "VAT_number", "first_name", "last_name",
    ];
    const PAYMENT_FIELDS = ["underpayment_threshold_usd", "grace_period_minutes"];
    const WEBHOOK_FIELDS = ["webhook_notification_url", "webhook_secret_key"];
    const CRYPTO_FIELDS = ["auto_convert_volatile_crypto", "convert_to_stablecoin"];
    const allowedKeys = new Set<string>([
      ...(sections.includes("company") ? COMPANY_FIELDS : []),
      ...(sections.includes("payment") ? PAYMENT_FIELDS : []),
      ...(sections.includes("webhook") ? WEBHOOK_FIELDS : []),
      ...(sections.includes("crypto") ? CRYPTO_FIELDS : []),
    ]);
    const KNOWN_FIELDS = new Set([...COMPANY_FIELDS, ...PAYMENT_FIELDS, ...WEBHOOK_FIELDS, ...CRYPTO_FIELDS]);
    const scopedValues = Object.fromEntries(
      Object.entries(values as Record<string, unknown>).filter(
        // keep visible-section fields; pass through anything not owned by a section
        ([k]) => allowedKeys.has(k) || !KNOWN_FIELDS.has(k),
      ),
    );

    const formData = new FormData();
    formData.append("data", JSON.stringify(scopedValues));
    if (mediaFile) formData.append("image", mediaFile);

    try {
      await companyState.updateCompany({ id: company.company_id, formData });
    } catch {
      // error toast handled inside the store — stop here so we don't flip type
      return;
    }

    // Flip individual -> business by reusing the dedicated endpoint, so the
    // Settings save is the single place this conversion happens.
    if (convertingToBusiness) {
      try {
        await axiosBaseApi.put(
          API_ENDPOINTS.company.upgradeToBusiness(company.company_id),
          {
            company_name: String(values.company_name ?? "").trim(),
            country: String(values.country ?? "").trim(),
            website: String(values.website ?? "").trim(),
            vat_number: String(values.VAT_number ?? "").trim(),
          },
        );
        await companyState.refetchCompanies();
        showToast("Your account is now a business account.");
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Could not switch to a business account. Please try again.";
        showToast(msg, "error");
      }
    }

    // Save webhook settings via dedicated endpoint
    const webhookUrl = values.webhook_notification_url || webhookData?.webhook_url;
    if (webhookUrl) {
      axiosBaseApi
        .put(API_ENDPOINTS.company.webhookSettings(company.company_id), {
          webhook_url: webhookUrl,
        })
        .catch(() => {
          // Silently fail — company update is the primary action
        });
    }

    // Save auto-convert settings via dedicated endpoint (awaited: a failure here
    // must be visible — otherwise payments silently keep settling in the raw coin).
    const enableAutoConvert = values.auto_convert_volatile_crypto === "yes";
    const [settlementCurrency, settlementChain] =
      STABLECOIN_OPTIONS[String(values.convert_to_stablecoin)] ?? STABLECOIN_OPTIONS.usdt_trc20;
    try {
      const res = await axiosBaseApi.put(
        API_ENDPOINTS.company.autoConvert(company.company_id),
        enableAutoConvert
          ? { auto_convert_enabled: true, settlement_currency: settlementCurrency, settlement_chain: settlementChain }
          : { auto_convert_enabled: false },
      );
      if (enableAutoConvert && res?.data?.data?.auto_convert_enabled !== true) {
        showToast(res?.data?.message || tSettings("cryptoConversionSaveFailed"), "error");
        return;
      }
      if (enableAutoConvert) {
        // Global toast: this dialog unmounts on close, so its local <Toast/> would never show.
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: tSettings("cryptoConversionEnabledToast", { currency: settlementCurrency, chain: settlementChain }),
            severity: "success",
          },
        });
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || tSettings("cryptoConversionSaveFailed"), "error");
      return;
    }

    handleClose();
  };

  const body = (
        <Box
          sx={{
            width: "100%",
            maxWidth: inline ? "800px" : "705px",
            mx: inline ? 0 : "auto",
            borderRadius: "14px",
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
            bgcolor: "background.paper",
            boxShadow: inline ? "none" : "0px 8px 24px rgba(0,0,0,0.08)",
            p: isMobile ? "4px 16px 16px 16px" : inline ? "5px 24px 24px 24px" : "5px 29px 29px 29px",
          }}
        >
          <FormManager
            key={formKey}
            initialValues={initialValues}
            yupSchema={schema}
            onSubmit={handleSubmit}
          >
            {({
              errors,
              handleBlur,
              handleChange,
              handleFieldsChange,
              submitDisable,
              touched,
              values,
            }) => {
              return (
                <>
                  {sections.includes("company") && (
                  <CompanyDetailsSection
                    values={{
                      company_name: values.company_name,
                      email: values.email,
                      mobile: values.mobile,
                      website: values.website,
                      country: values.country ?? "",
                      state: values.state ?? "",
                      city: values.city ?? "",
                      address_line_1: values.address_line_1 ?? "",
                      address_line_2: values.address_line_2 ?? "",
                      zip_code: values.zip_code ?? "",
                      VAT_number: values.VAT_number ?? "",
                    }}
                    errors={errors}
                    touched={touched}
                    handleChange={handleChange}
                    handleBlur={handleBlur}
                    handleFieldsChange={handleFieldsChange}
                    imagePreview={imagePreview}
                    onFileChange={handleFileChange}
                    uploadingLogo={savingLogo}
                    isMobile={isMobile}
                    expanded={expanded === "company"}
                    onAccordionChange={handleAccordionChange("company")}
                    accountType={accountTypeChoice}
                    canChangeType={originalAccountType === "individual"}
                    onAccountTypeChange={setAccountTypeChoice}
                  />
                  )}

                  {sections.includes("crypto") && (
                  <CryptoConversionSection
                    value={values.auto_convert_volatile_crypto ?? "no"}
                    convertTo={values.convert_to_stablecoin ?? "usdt_trc20"}
                    onFieldsChange={handleFieldsChange}
                    isMobile={isMobile}
                    expanded={expanded === "crypto"}
                    onAccordionChange={handleAccordionChange("crypto")}
                  />
                  )}

                  {sections.includes("webhook") && (
                  <WebhookNotificationsSection
                    notificationUrl={
                      webhookData?.webhook_url ??
                      values.webhook_notification_url ??
                      initialFormValues.webhook_notification_url
                    }
                    secretKey={
                      webhookData?.webhook_secret ??
                      values.webhook_secret_key ??
                      initialFormValues.webhook_secret_key
                    }
                    onNotificationUrlChange={(value) => {
                      handleFieldsChange({ webhook_notification_url: value });
                      setWebhookData((prev) => prev ? { ...prev, webhook_url: value } : { webhook_url: value, webhook_secret: "" });
                    }}
                    onSecretKeyChange={(value) => {
                      handleFieldsChange({ webhook_secret_key: value });
                      setWebhookData((prev) => prev ? { ...prev, webhook_secret: value } : { webhook_url: "", webhook_secret: value });
                    }}
                    onRegenerateSecret={async () => {
                      if (!company?.company_id) return;
                      try {
                        const res = await axiosBaseApi.put(
                          API_ENDPOINTS.company.webhookSettings(company.company_id),
                          { webhook_secret: "generate" }
                        );
                        const data = res?.data?.data;
                        if (data?.webhook_secret) {
                          setWebhookData((prev) => prev
                            ? { ...prev, webhook_secret: data.webhook_secret }
                            : { webhook_url: "", webhook_secret: data.webhook_secret }
                          );
                          handleFieldsChange({ webhook_secret_key: data.webhook_secret });
                          showToast("Webhook secret regenerated successfully!");
                        }
                      } catch {
                        showToast("Failed to regenerate webhook secret", "error");
                      }
                    }}
                    onSendTest={async () => {
                      if (!company?.company_id) return;
                      try {
                        await axiosBaseApi.post(
                          API_ENDPOINTS.company.webhookTest(company.company_id)
                        );
                        showToast("Test webhook sent successfully!");
                      } catch {
                        showToast("Failed to send test webhook", "error");
                      }
                    }}
                    isMobile={isMobile}
                    expanded={expanded === "webhook"}
                    onAccordionChange={handleAccordionChange("webhook")}
                  />
                  )}

                  {sections.includes("payment") && (
                  <PaymentToleranceSection
                    values={{
                      underpayment_threshold_usd:
                        values.underpayment_threshold_usd,
                      grace_period_minutes: values.grace_period_minutes,
                    }}
                    handleChange={handleChange}
                    handleBlur={handleBlur}
                    isMobile={isMobile}
                    expanded={expanded === "payment"}
                    onAccordionChange={handleAccordionChange("payment")}
                  />
                  )}

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1.5,
                      mt: 1,
                    }}
                  >
                    {sections.includes("company") ? (
                      <CustomButton
                        label={tSettings("actions.delete", { defaultValue: "Delete brand" })}
                        data-testid="settings-delete-brand-btn"
                        variant="outlined"
                        size={isMobile ? "small" : "medium"}
                        onClick={() => setDeleteAlertOpen(true)}
                        sx={{
                          fontSize: "13px",
                          color: theme.palette.error.main,
                          borderColor: theme.palette.error.main,
                          "&:hover": {
                            borderColor: theme.palette.error.dark,
                            backgroundColor: `${theme.palette.error.main}10`,
                          },
                        }}
                      />
                    ) : (
                      <Box />
                    )}
                    <Box sx={{ display: "flex", gap: 1.5 }}>
                      {!inline && (
                      <CustomButton
                        label={tSettings("actions.cancel")}
                        variant="outlined"
                        size={isMobile ? "small" : "medium"}
                        onClick={handleClose}
                        disabled={companyState.loading}
                        sx={{
                          fontSize: "15px",
                          [theme.breakpoints.down("md")]: { fontSize: "13px" },
                        }}
                      />
                      )}
                      <CustomButton
                        label={tSettings("actions.saveChanges")}
                        data-testid="settings-save-changes-btn"
                        variant="primary"
                        size={isMobile ? "small" : "medium"}
                        onClick={() => handleSubmit(values)}
                        disabled={submitDisable || companyState.loading}
                        sx={{
                          fontSize: "15px",
                          [theme.breakpoints.down("md")]: { fontSize: "13px" },
                        }}
                      />
                    </Box>
                  </Box>
                </>
              );
            }}
          </FormManager>
        </Box>
  );

  return (
    <>
      {inline ? (
        body
      ) : (
        <PopupModal
          open={open}
          showHeader={false}
          transparent
          handleClose={handleRequestClose}
          sx={{
            "& .MuiDialog-paper": {
              minWidth: isMobile ? "100%" : "641px",
              maxWidth: isMobile ? "358px" : "605px",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              p: 2,
            },
          }}
        >
          {body}
        </PopupModal>
      )}

      <Toast
        open={openToast}
        message={toastMessage}
        severity={toastSeverity}
      />

      {logoCropSrc && (
        <ImageCropperDialog
          open
          imageSrc={logoCropSrc}
          sourceFile={logoCropFile}
          cropShape="rect"
          aspect={1}
          onCancel={closeLogoCropper}
          onApply={handleLogoCropApply}
        />
      )}

      <DeleteBrandModal
        open={deleteAlertOpen}
        onClose={() => setDeleteAlertOpen(false)}
        companyId={company?.company_id}
        companyName={companyName}
        onDelete={handleDeleteCompany}
      />
    </>
  );
}
