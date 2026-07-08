import { Box, CircularProgress, Grid, Typography, MenuItem, Select, FormControl } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import axiosBaseApi from "@/axiosConfig";

import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";

import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";

import { ApiAction, CompanyAction } from "@/Redux/Actions";
import { API_DELETE, API_FETCH, API_REGENERATE, API_TOGGLE_STATUS } from "@/Redux/Actions/ApiAction";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import CopyIcon from "@/assets/Icons/copy-icon.svg";
import EyeIcon from "@/assets/Icons/eye-icon.svg";
import InfoIcon from "@/assets/Icons/info-icon.svg";
import TrashIcon from "@/assets/Icons/trash-icon.svg";
import BgImage from "@/assets/Images/card-bg.png";
import { formatDate, getTime } from "@/helpers/dateTimeFormatter";
import { IApi, rootReducer } from "@/utils/types";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

import CreateApiModel from "@/Components/UI/ApiKeysModel/CreateApiModel";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import DeleteModel from "@/Components/UI/DeleteModel";
import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import UnitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";
import { stringShorten } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { useTheme } from "@mui/material";
import { ApiKeyCardProps, ApiKeysPageProps } from "@/utils/types/apis";
import Image from "next/image";
import * as yup from "yup";
import {
  ApiDocumentationCardDescription,
  ApiKeyCardBody,
  ApiKeyCardSubTitle,
  ApiKeyCardTopRow,
  ApiKeyCopyButton,
  ApiKeyCreatedText,
  ApiKeyDeleteButton,
  ApiKeyViewButton,
  InfoText,
  Tags,
} from "./styled";

const ApiDocumentationCard = ({ docsUrl }: { docsUrl: string }) => {
  const { t } = useTranslation("apiScreen");
  const isMobile = useIsMobile("md");
  const theme = useTheme();

  return (
    <PanelCard
      title={t("documentation.title")}
      headerIcon={
        <Image
          src={InfoIcon.src}
          style={{
            filter:
              "brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(100%)",
          }}
          alt={t("documentation.infoIconAlt")}
          width={isMobile ? 14 : 16}
          height={isMobile ? 14 : 16}
          draggable={false}
        />
      }
      showHeaderBorder={false}
      headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
      bodyPadding={
        isMobile
          ? theme.spacing("12px", 2.5, 2.5, 2.5)
          : theme.spacing(1.75, 2.5, 2.5, 2.5)
      }
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "14px",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${BgImage.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
          pointerEvents: "none",
          width: "70%",
          height: "100%",
          marginLeft: "auto",
          marginRight: "0.5rem",
          [theme.breakpoints.down("md")]: {
            backgroundPosition: "left",
            marginRight: "0",
          },
        },
      }}
      headerSx={{
        position: "relative",
        zIndex: 1,
        backgroundColor: "transparent",
        fontSize: { xs: "13px", md: "15px" },
      }}
      subTitleSx={{
        fontSize: { xs: "10px", md: "13px" },
      }}
      bodySx={{
        position: "relative",
        zIndex: 1,
        backgroundColor: "transparent",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? "17px" : 4.5,
        }}
      >
        <ApiDocumentationCardDescription>
          {t("documentation.description")}
        </ApiDocumentationCardDescription>
        <CustomButton
          label={t("documentation.viewDocumentation")}
          variant="secondary"
          size={isMobile ? "small" : "medium"}
          endIcon={<ArrowOutwardIcon sx={{ fontSize: 14 }} />}
          onClick={() => {
            if (!docsUrl) return;
            window.open(docsUrl, "_blank", "noopener,noreferrer");
          }}
          sx={{
            width: "fit-content",
          }}
        />
      </Box>
    </PanelCard>
  );
};

const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "NGN", "BRL",
  "INR", "JPY", "CNY", "AUD", "CAD", "CHF",
  "ZAR", "MXN", "AED", "SGD", "HKD", "SEK", "NZD",
  "BTC",
];

const ApiKeyCard = ({ title, apiRow, onCopy, onDelete, onRegenerate, onToggleStatus }: ApiKeyCardProps & { onRegenerate?: (id: string | number) => void; onToggleStatus?: (id: string | number, status: string) => void }) => {
  const { t } = useTranslation("apiScreen");
  const dispatch = useDispatch();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdminToken, setShowAdminToken] = useState(false);
  const isMobile = useIsMobile("md");
  const theme = useTheme();

  const apiKey: string = apiRow?.apiKey || "";
  const adminToken: string =
    (apiRow as { admin_token?: string })?.admin_token || apiRow?.adminToken || "";
  const [baseCurrency, setBaseCurrency] = useState<string>(apiRow?.base_currency || "USD");
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);
  useEffect(() => {
    setBaseCurrency(apiRow?.base_currency || "USD");
  }, [apiRow?.base_currency]);

  const currencyOptions = useMemo(() => {
    // Ensure the currently selected currency is always present in the list,
    // even if it's some legacy/typed-in value the backend allowed previously.
    const set = new Set(SUPPORTED_CURRENCIES);
    if (baseCurrency) set.add(baseCurrency.toUpperCase());
    return Array.from(set);
  }, [baseCurrency]);

  const handleCurrencyChange = async (next: string) => {
    const upper = String(next || "").toUpperCase();
    if (!upper || upper === baseCurrency) return;
    const previous = baseCurrency;
    setBaseCurrency(upper);
    setSavingCurrency(true);
    setCurrencySaved(false);
    try {
      const apiId = apiRow?.api_id || (apiRow as any)?.id;
      if (!apiId) throw new Error("Missing api_id");
      await axiosBaseApi.put(`userApi/updateApi/${apiId}`, {
        base_currency: upper,
      });
      setCurrencySaved(true);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: t("currency.updated", { defaultValue: `Settlement currency updated to ${upper}` }), severity: "success" },
      });
      // Refresh the list so any downstream data (fees preview, etc.) reflects the change
      dispatch(ApiAction(API_FETCH));
      // Clear the "saved" tick after a moment
      setTimeout(() => setCurrencySaved(false), 2000);
    } catch (err: any) {
      setBaseCurrency(previous);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: err?.response?.data?.message || t("currency.updateFailed", { defaultValue: "Failed to update currency" }), severity: "error" },
      });
    } finally {
      setSavingCurrency(false);
    }
  };

  const createdAt =
    apiRow?.created_at || apiRow?.createdAt || apiRow?.createdOn || "";

  const displayApiKey = showApiKey
    ? apiKey
    : apiKey
      ? stringShorten(apiKey, 12, 4)
      : "";
  const displayAdminToken = showAdminToken
    ? adminToken
    : adminToken
      ? stringShorten(adminToken, 10, 5)
      : "";

  return (
    <PanelCard
      title={title}
      showHeaderBorder={false}
      bodyPadding={
        isMobile ? theme.spacing(0, 2, 2, 2) : theme.spacing(0, 2.5, 2.5, 2.5)
      }
      headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
      headerActionLayout="inline"
      headerAction={
        <Tags>
          <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> {t("status.active")}
        </Tags>
      }
      sx={{ height: "100%", borderRadius: "14px" }}
    >
      <ApiKeyCardSubTitle>
        {t("currency.baseCurrency")}
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, ml: 0.5 }}>
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <Select
              value={baseCurrency}
              onChange={(e) => handleCurrencyChange(String(e.target.value))}
              disabled={savingCurrency}
              displayEmpty
              variant="outlined"
              inputProps={{ "aria-label": "Settlement currency" }}
              sx={{
                fontFamily: "UrbanistSemiBold, sans-serif",
                fontSize: 13,
                height: 30,
                borderRadius: "8px",
                background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#F7F8FA",
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.primary.main },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.primary.main },
                "& .MuiSelect-select": { py: 0.5, pl: 1.5, pr: 3.5 },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 320,
                    mt: 0.5,
                    borderRadius: "10px",
                  },
                },
              }}
            >
              {currencyOptions.map((c) => (
                <MenuItem key={c} value={c} sx={{ fontFamily: "UrbanistMedium, sans-serif", fontSize: 13 }}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {savingCurrency && (
            <CircularProgress size={14} sx={{ color: theme.palette.primary.main }} />
          )}
          {currencySaved && !savingCurrency && (
            <CheckRoundedIcon sx={{ fontSize: 16, color: theme.palette.success?.main || "#22C55E" }} />
          )}
        </Box>
      </ApiKeyCardSubTitle>

      <ApiKeyCardBody sx={{ pt: isMobile ? "16px" : "18px" }}>
        <ApiKeyCardTopRow sx={{ gap: 1.25 }}>
          <InputField
            label={t("generate.yourKey")}
            value={displayApiKey}
            readOnly
            sx={{
              width: "100%",
              "& .label": {
                fontSize: "13px",
                lineHeight: "16px",
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                color: theme.palette.text.secondary,
              },
            }}
          />

          <ApiKeyCopyButton onClick={() => onCopy(apiKey)}>
            <Image
              src={CopyIcon.src}
              alt={t("icons.copyAlt")}
              width={14}
              height={14}
              draggable={false}
            />
          </ApiKeyCopyButton>
          <ApiKeyViewButton
            size="small"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            <Image
              src={EyeIcon.src}
              alt={t("icons.eyeAlt")}
              width={20}
              height={14}
              draggable={false}
            />
          </ApiKeyViewButton>
        </ApiKeyCardTopRow>
        <ApiKeyCardTopRow sx={{ gap: 1.25 }}>
          <InputField
            label={t("generate.adminToken")}
            value={displayAdminToken}
            readOnly
            sx={{
              width: "100%",
              "& .label": {
                fontSize: "13px",
                lineHeight: "16px",
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                color: theme.palette.text.secondary,
              },
            }}
          />

          <ApiKeyCopyButton onClick={() => onCopy(adminToken)}>
            <Image
              src={CopyIcon.src}
              alt={t("icons.copyAlt")}
              width={14}
              height={14}
              draggable={false}
            />
          </ApiKeyCopyButton>
          <ApiKeyViewButton
            size="small"
            onClick={() => setShowAdminToken(!showAdminToken)}
          >
            <Image
              src={EyeIcon.src}
              alt={t("icons.eyeAlt")}
              width={20}
              height={14}
              draggable={false}
            />
          </ApiKeyViewButton>
        </ApiKeyCardTopRow>
        <ApiKeyCardTopRow sx={{ alignItems: "center" }}>
          <ApiKeyDeleteButton
            size="small"
            onClick={() => onDelete(apiRow?.api_id || apiRow?.id || 0)}
          >
            <Image
              src={TrashIcon.src}
              alt={t("icons.trashAlt")}
              width={isMobile ? 12 : 16}
              height={isMobile ? 12 : 16}
              draggable={false}
            />
          </ApiKeyDeleteButton>

          {onRegenerate && (
            <CustomButton
              data-testid="api-regenerate-btn"
              label={t("actions.regenerate", { defaultValue: "Regenerate" })}
              variant="secondary"
              size="small"
              onClick={() => onRegenerate(apiRow?.api_id || apiRow?.id || 0)}
              sx={{ ml: 1, height: 28, fontSize: 12 }}
            />
          )}

          {onToggleStatus && (
            <CustomButton
              data-testid="api-toggle-status-btn"
              label={
                apiRow?.status === "active"
                  ? t("actions.disable", { defaultValue: "Disable" })
                  : t("actions.enable", { defaultValue: "Enable" })
              }
              variant="secondary"
              size="small"
              onClick={() =>
                onToggleStatus(
                  apiRow?.api_id || apiRow?.id || 0,
                  apiRow?.status === "active" ? "inactive" : "active"
                )
              }
              sx={{ ml: 1, height: 28, fontSize: 12 }}
            />
          )}

          <ApiKeyCreatedText>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <AccessTimeFilledIcon sx={{ fontSize: 15 }} />
            </Box>
            <Typography component="span" className="created-on-text">
              {t("createdOn", {
                date: formatDate(createdAt),
                time: getTime(createdAt),
              })}
            </Typography>
          </ApiKeyCreatedText>
        </ApiKeyCardTopRow>
      </ApiKeyCardBody>
    </PanelCard>
  );
};

const ApiKeysPage = ({
  openCreate: openCreateProp,
  setOpenCreate: setOpenCreateProp,
}: ApiKeysPageProps) => {
  const dispatch = useDispatch();
  const { t } = useTranslation("apiScreen");
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const apiState = useSelector((state: rootReducer) => state.apiReducer);

  const selectedCompanyId = useSelector(
    (state: rootReducer) => (state as any).companyReducer?.selectedCompanyId
  );

  const [openCreateLocal, setOpenCreateLocal] = useState(false);
  const openCreate = openCreateProp ?? openCreateLocal;
  const setOpenCreate = setOpenCreateProp ?? setOpenCreateLocal;
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number>(0);

  const apiSchema = yup.object().shape({
    company_id: yup
      .string()
      .test(
        "company_id",
        t("validation.selectCompany"),
        (value: any) => value != 0,
      ),
  });

  useEffect(() => {
    dispatch(CompanyAction(COMPANY_FETCH));
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(ApiAction(API_FETCH, payload));
  }, [selectedCompanyId]);

  const handleCopy = (value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    dispatch({
      type: TOAST_SHOW,
      payload: { message: t("toast.copied"), severity: "info" },
    });
  };

  const handleCreateClose = () => {
    setOpenCreate(false);
  };

  const requestDelete = (apiId: number) => {
    if (!apiId) return;
    setDeleteId(apiId);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    dispatch(ApiAction(API_DELETE, { id: deleteId }));
    setConfirmDeleteOpen(false);
    setDeleteId(0);
  };

  const handleRegenerate = (apiId: string | number) => {
    if (!apiId) return;
    dispatch(ApiAction(API_REGENERATE, { id: apiId }));
  };

  const handleToggleStatus = (apiId: string | number, status: string) => {
    if (!apiId) return;
    dispatch(ApiAction(API_TOGGLE_STATUS, { id: apiId, status }));
  };

  const docsUrl =
    (process.env.NEXT_PUBLIC_API_DOCS_URL as string) ||
    "/documentation";

  const itemAnimation = {
    "@keyframes fadeSlideIn": {
      from: {
        opacity: 0,
        transform: "translateY(16px)",
      },
      to: {
        opacity: 1,
        transform: "translateY(0)",
      },
    },
  };

  if (apiState.loading) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress
          sx={{
            color: theme.palette.primary.main,
          }}
        />
      </Box>
    );
  }

  if (apiState?.apiList?.length === 0 && !apiState?.loading) {
    return (
      <>
        <EmptyDataModel pageName="apiKey" />
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mt: 2,
          }}
        >
          <CustomButton
            label={t("documentation.viewDocumentation")}
            endIcon={<ArrowOutwardIcon sx={{ fontSize: 16 }} />}
            variant="outlined"
            sx={{
              borderColor: theme.palette.primary.main,
              color: theme.palette.primary.main,
              "&:hover": { background: theme.palette.mode === "dark" ? "rgba(204,255,0,0.08)" : "#f0f5ff", borderColor: theme.palette.primary.main },
            }}
            onClick={() => {
              window.open(docsUrl, "_blank", "noopener,noreferrer");
            }}
          />
        </Box>
        <CreateApiModel open={openCreate} onClose={handleCreateClose} />
      </>
    );
  }

  return (
    <>
      <DeleteModel
        open={confirmDeleteOpen}
        onClose={() => {
          setConfirmDeleteOpen(false);
          setDeleteId(0);
        }}
        onConfirm={confirmDelete}
        title={t("delete.title")}
        message={t("delete.confirmMessage")}
      />
      {/* <CustomAlert
        open={confirmDeleteOpen}
        handleClose={() => {
          setConfirmDeleteOpen(false);
          setDeleteId(0);
        }}
        message={t("delete.confirmMessage")}
        confirmText={t("delete.confirmButton")}
        onConfirm={confirmDelete}
      /> */}

      {/* <Grid container spacing={2.5} sx={{ mb: 2.5 }} alignItems="flex-start">
        <Grid item xs={12} md={6} lg={6} xl={4}>
          <ApiKeyCard
            title={t("keys.production")}
            apiRow={prodKey}
            onCopy={handleCopy}
            onDelete={requestDelete}
          />
        </Grid>
        <Grid item xs={12} md={6} lg={6} xl={4}>
          <ApiKeyCard
            title={t("keys.development")}
            apiRow={devKey}
            onCopy={handleCopy}
            onDelete={requestDelete}
          />
        </Grid>
        <Grid item xs={12} md={6} lg={6} xl={4}>
          <ApiDocumentationCard docsUrl={docsUrl} />
        </Grid>
      </Grid> */}
      <Grid
        container
        spacing={2.5}
        sx={{ mb: isMobile ? 2 : 2.5, ...itemAnimation }}
        alignItems="flex-start"
      >
        {Array.isArray(apiState?.apiList) &&
          apiState.apiList.map((api: IApi, index: number) => (
            <Grid
              key={api.api_id}
              item
              xs={12}
              md={6}
              lg={6}
              xl={4}
              sx={{
                opacity: 0,
                animation: "fadeSlideIn 0.5s ease forwards",
                animationDelay: `${index * 0.1}s`,
              }}
            >
              <ApiKeyCard
                title={t("apiKeyTitle", { currency: (api.base_currency || "USD").toUpperCase() })}
                apiRow={api}
                onCopy={handleCopy}
                onDelete={requestDelete}
                onRegenerate={handleRegenerate}
                onToggleStatus={handleToggleStatus}
              />
            </Grid>
          ))}

        {/* Last card */}
        <Grid
          item
          xs={12}
          md={6}
          lg={6}
          xl={4}
          sx={{
            opacity: 0,
            animation: "fadeSlideIn 0.5s ease forwards",
            animationDelay: `${(apiState?.apiList?.length || 0) * 0.1}s`,
          }}
        >
          <ApiDocumentationCard docsUrl={docsUrl} />
        </Grid>
      </Grid>

      <Box
        sx={{
          bgcolor: theme.palette.primary.light,
          p: isMobile ? "16px" : "7px 18px",
          borderRadius: "6px",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "start",
          gap: 1,
          border: `1px solid ${theme.palette.border.main}`,
          flexWrap: { xs: "wrap", sm: "nowrap" },
          opacity: 0,
          animation: "fadeSlideIn 0.5s ease forwards",
          animationDelay: `${(apiState?.apiList?.length || 0) * 0.2}s`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "start",
            gap: 1,
            flexShrink: 0,
          }}
        >
          <Box
            component="span"
            sx={{
              width: isMobile ? 14 : 16,
              height: isMobile ? 14 : 24,
              display: "inline-block",
              bgcolor: "#E8484A",
              WebkitMask: `url(${InfoIcon.src}) no-repeat center / contain`,
              mask: `url(${InfoIcon.src}) no-repeat center / contain`,
              flex: "0 0 auto",
            }}
          />
          <InfoText
            sx={{
              color: theme.palette.error.main,
              whiteSpace: "nowrap",
            }}
          >
            {t("security.title")}
          </InfoText>
        </Box>
        <InfoText
          sx={{
            flex: 1,
            minWidth: 0,
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {t("security.description")}
        </InfoText>
      </Box>

      <CreateApiModel open={openCreate} onClose={handleCreateClose} />
    </>
  );
};

export default ApiKeysPage;
