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
import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_DELETE, COMPANY_UPDATE } from "@/Redux/Actions/CompanyAction";
import { ICompany, rootReducer } from "@/utils/types";
import axiosBaseApi from "@/axiosConfig";

import Toast from "../Toast";
import CustomAlert from "../CustomAlert";
import CompanyDetailsSection from "./CompanyDetailsSection";
import CryptoConversionSection from "./CryptoConversionSection";
import PaymentToleranceSection from "./PaymentToleranceSection";
import WebhookNotificationsSection from "./WebhookNotificationsSection";

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
  accept_underpayments_up_to: string;
  flag_overpayments_above: string;
  time_for_partial_payments: string;
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
  accept_underpayments_up_to: "1.00",
  flag_overpayments_above: "5.00",
  time_for_partial_payments: "30",
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
  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );

  const [formKey, setFormKey] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const [mediaFile, setMediaFile] = useState<File | undefined>();
  const [expanded, setExpanded] = useState<string | false>("company");
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

  const handleDeleteCompany = () => {
    if (company?.company_id) {
      dispatch({
        type: COMPANY_DELETE,
        payload: company.company_id,
      });
      setDeleteAlertOpen(false);
      onClose();
    }
  };

  const showToast = (message: string, severity: "success" | "error" = "success") => {
    setOpenToast(false);
    setToastMessage(message);
    setToastSeverity(severity);
    setTimeout(() => setOpenToast(true), 0);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setOpenToast(false), 3000);
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
      };
    }
    return { ...initialFormValues };
  }, [company, autoConvertData]);

  const schema = useMemo(
    () =>
      yup.object().shape({
        company_name: yup
          .string()
          .required(t("validation.companyNameRequired")),
        email: yup
          .string()
          .email(t("validation.emailInvalid"))
          .required(t("validation.emailRequired")),
        mobile: yup
          .string()
          .notRequired()
          .test(
            "mobile-len",
            t("validation.mobileMin"),
            (v) => !v || v.replace(/\D/g, "").length >= 10
          ),
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
        accept_underpayments_up_to: yup.string().nullable(),
        flag_overpayments_above: yup.string().nullable(),
        time_for_partial_payments: yup.string().nullable(),
        auto_convert_volatile_crypto: yup.string().nullable(),
        convert_to_stablecoin: yup.string().nullable(),
      }),
    [t],
  );

  // When dialog opens with a company, remount form and expand first visible section
  useEffect(() => {
    if (open) {
      setExpanded(sections[0] ?? "company");
      if (company) setFormKey((prev) => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company]);

  // Fetch auto-convert settings from dedicated endpoint
  useEffect(() => {
    if (open && company?.company_id) {
      axiosBaseApi
        .get(`/company/auto-convert/${company.company_id}`)
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
                data.target_stablecoin ?? data.convert_to_stablecoin ?? "usdt_trc20",
            });
          }
        })
        .catch(() => {
          // Fallback to company data
        });

      // Fetch webhook settings from dedicated endpoint
      axiosBaseApi
        .get(`/company/webhook-settings/${company.company_id}`)
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

  const handleFileChange = (file?: File) => {
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setMediaFile(file);
  };

  const handleSubmit = (values: Values) => {
    if (!company?.company_id) return;
    const formData = new FormData();
    formData.append("data", JSON.stringify(values));
    if (mediaFile) formData.append("image", mediaFile);
    dispatch(
      CompanyAction(COMPANY_UPDATE, { id: company.company_id, formData }),
    );

    // Save auto-convert settings via dedicated endpoint
    axiosBaseApi
      .put(`/company/auto-convert/${company.company_id}`, {
        auto_convert_enabled: values.auto_convert_volatile_crypto === "yes",
        target_stablecoin: values.convert_to_stablecoin,
      })
      .catch(() => {
        // Silently fail — company update is the primary action
      });

    // Save webhook settings via dedicated endpoint
    const webhookUrl = values.webhook_notification_url || webhookData?.webhook_url;
    if (webhookUrl) {
      axiosBaseApi
        .put(`/company/webhook-settings/${company.company_id}`, {
          webhook_url: webhookUrl,
        })
        .catch(() => {
          // Silently fail — company update is the primary action
        });
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
                    isMobile={isMobile}
                    expanded={expanded === "company"}
                    onAccordionChange={handleAccordionChange("company")}
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
                          `/company/webhook-settings/${company.company_id}`,
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
                          `/company/webhook-test/${company.company_id}`
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
                      accept_underpayments_up_to:
                        values.accept_underpayments_up_to,
                      flag_overpayments_above: values.flag_overpayments_above,
                      time_for_partial_payments:
                        values.time_for_partial_payments,
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
                        label="Delete Company"
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

      <CustomAlert
        open={deleteAlertOpen}
        handleClose={() => setDeleteAlertOpen(false)}
        message="Are you sure you want to remove this company? This will remove all associated users, transactions, and API keys."
        confirmText="Delete"
        onConfirm={handleDeleteCompany}
      />
    </>
  );
}
