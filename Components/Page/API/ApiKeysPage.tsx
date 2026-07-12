import { Box, CircularProgress, Grid, Typography, MenuItem, Select, FormControl } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import axiosBaseApi from "@/axiosConfig";

import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";

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
import PublishableKeysSection from "./PublishableKeysSection";
import BuyButtonsSection from "./BuyButtonsSection";
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

  // Derive sandbox metadata for auto-created development keys.
  // test_mode_restrictions may arrive as a JSON string (raw DB value) or an object (parsed by getApi).
  const isDev =
    (apiRow as { environment?: string })?.environment === "development";
  const rawRestrictions = (apiRow as { test_mode_restrictions?: unknown })
    ?.test_mode_restrictions;
  let sandboxRestrictions: {
    max_amount?: number;
    allowed_currencies?: string[];
    sandbox_mode?: boolean;
  } | null = null;
  if (rawRestrictions) {
    if (typeof rawRestrictions === "string") {
      try {
        sandboxRestrictions = JSON.parse(rawRestrictions);
      } catch {
        sandboxRestrictions = null;
      }
    } else if (typeof rawRestrictions === "object") {
      sandboxRestrictions = rawRestrictions as typeof sandboxRestrictions;
    }
  }
  const isSandboxKey = isDev && !!sandboxRestrictions?.sandbox_mode;
  const sandboxLimitsLine = isSandboxKey
    ? t("keys.sandboxLimits", {
        defaultValue: "Max ${{max}} · {{currencies}} · sandbox mode",
        max: sandboxRestrictions?.max_amount ?? 100,
        currencies: (sandboxRestrictions?.allowed_currencies || []).join(" · "),
      })
    : "";

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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 1,
            // Override the absolute positioning on the child Tags so they sit inline in this flex row
            "& > .MuiTypography-root": {
              position: "static",
              top: "auto",
              right: "auto",
            },
          }}
        >
          {isSandboxKey && (
            <Tags
              data-testid="sandbox-badge"
              sx={{
                background:
                  theme.palette.mode === "dark"
                    ? "rgba(106,123,255,0.16)"
                    : "rgba(106,123,255,0.10)",
                color: theme.palette.primary.main,
                border: `1px solid ${theme.palette.primary.main}33`,
                whiteSpace: "nowrap",
              }}
              aria-label={t("keys.testAutoCreatedBadge", {
                defaultValue: "Auto-created · Sandbox",
              })}
            >
              <ScienceOutlinedIcon sx={{ fontSize: 16 }} />
              {t("keys.testAutoCreatedBadge", {
                defaultValue: "Auto-created · Sandbox",
              })}
            </Tags>
          )}
          <Tags sx={{ whiteSpace: "nowrap" }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> {t("status.active")}
          </Tags>
        </Box>
      }
      sx={{ height: "100%", borderRadius: "14px" }}
    >
      {isSandboxKey && sandboxLimitsLine && (
        <Typography
          data-testid="sandbox-limits"
          sx={{
            fontSize: 12,
            lineHeight: 1.5,
            color: theme.palette.text.secondary,
            fontFamily: "var(--font-sans), sans-serif",
            mt: -0.5,
            mb: 1,
          }}
        >
          {sandboxLimitsLine}
        </Typography>
      )}
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
                fontFamily: "var(--font-sans), sans-serif",
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
                <MenuItem key={c} value={c} sx={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 13 }}>
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
                fontFamily: "var(--font-sans)",
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
                fontFamily: "var(--font-sans)",
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

const SnippetBlock = ({
  label,
  code,
  onCopy,
}: {
  label: string;
  code: string;
  onCopy: (v: string) => void;
}) => {
  const theme = useTheme();
  return (
    <Box sx={{ mt: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 0.5,
        }}
      >
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
          }}
        >
          {label}
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={() => onCopy(code)}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            border: `1px solid ${theme.palette.border.main}`,
            background: "transparent",
            color: theme.palette.text.secondary,
            borderRadius: "6px",
            px: 1,
            py: 0.4,
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
            "&:hover": { color: theme.palette.text.primary },
          }}
        >
          <Image src={CopyIcon.src} alt="Copy" width={14} height={14} />
          Copy
        </Box>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          borderRadius: "8px",
          overflowX: "auto",
          background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#0b0b0b",
          color: theme.palette.mode === "dark" ? "#d6f7c2" : "#e6e6e6",
          fontSize: 12.5,
          lineHeight: 1.6,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          whiteSpace: "pre",
          border: `1px solid ${theme.palette.border.main}`,
        }}
      >
        {code}
      </Box>
    </Box>
  );
};

const EmbeddedCheckoutCard = ({
  onCopy,
  docsUrl,
}: {
  onCopy: (v: string) => void;
  docsUrl: string;
}) => {
  const theme = useTheme();
  const baseUrl =
    (process.env.NEXT_PUBLIC_BASE_URL as string) ||
    (typeof window !== "undefined" ? window.location.origin : "https://checkout.dynopay.com");

  const serverSnippet =
`// 1) YOUR SERVER (Node) — the secret key stays here, never in the browser
const res = await fetch("` + baseUrl + `/api/user/embed/session", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.DYNOPAY_API_KEY,   // your secret API key
  },
  body: JSON.stringify({
    amount: 50,
    redirect_uri: "https://your-site.com/thank-you",
    allowed_origins: ["https://your-site.com"],
  }),
});
const { data } = await res.json();
return data.client_secret;   // send this to your frontend`;

  const clientSnippet =
`<!-- 2) YOUR CHECKOUT PAGE (browser) — no secret key here -->
<div id="dynopay-checkout"></div>
<script src="` + baseUrl + `/v1/embed.js"></script>
<script>
  const checkout = await Dynopay.initEmbeddedCheckout({
    fetchClientSecret: () =>
      fetch("/create-dynopay-session")   // your server route from step 1
        .then(r => r.json())
        .then(d => d.client_secret),
    onComplete: () => { window.location.href = "/thank-you"; },
  });
  checkout.mount("#dynopay-checkout");
</script>`;

  const modalSnippet =
`// Prefer a popup? Open the checkout in a modal instead of inline:
Dynopay.openCheckout({ fetchClientSecret, onComplete });`;

  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.border.main}`,
        borderRadius: "12px",
        background: theme.palette.background.paper,
        p: { xs: 2, sm: 2.5 },
      }}
    >
      <Typography
        sx={{
          fontSize: 18,
          fontWeight: 700,
          color: theme.palette.text.primary,
          fontFamily: "var(--font-sans)",
        }}
      >
        Embedded Checkout
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 14, color: theme.palette.text.secondary }}>
        Accept crypto directly on your site — no redirect. Your server creates a
        session with your secret key, then the browser mounts the checkout in an
        iframe. Always confirm payments via webhooks, not the browser event.
      </Typography>

      <SnippetBlock label="1 · Server — create session" code={serverSnippet} onCopy={onCopy} />
      <SnippetBlock label="2 · Client — mount checkout" code={clientSnippet} onCopy={onCopy} />
      <SnippetBlock label="Optional — modal" code={modalSnippet} onCopy={onCopy} />

      <Box sx={{ mt: 2 }}>
        <CustomButton
          label="View full guide"
          endIcon={<ArrowOutwardIcon sx={{ fontSize: 16 }} />}
          variant="outlined"
          sx={{
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            "&:hover": {
              background: theme.palette.mode === "dark" ? "rgba(204,255,0,0.08)" : "#f0f5ff",
              borderColor: theme.palette.primary.main,
            },
          }}
          onClick={() => docsUrl && window.open(docsUrl, "_blank", "noopener,noreferrer")}
        />
      </Box>
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Elements Inline Widget — Phase 3(b) UI card                        */
/* Mirrors EmbeddedCheckoutCard: snippet + live preview + docs link.  */
/* ------------------------------------------------------------------ */
const ElementsWidgetCard = ({
  onCopy,
  docsUrl,
}: {
  onCopy: (v: string) => void;
  docsUrl: string;
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const selectedCompanyId = useSelector(
    (state: rootReducer) => (state as any).companyReducer?.selectedCompanyId
  );

  const baseUrl =
    (process.env.NEXT_PUBLIC_BASE_URL as string) ||
    (typeof window !== "undefined" ? window.location.origin : "https://checkout.dynopay.com");

  // Load a real active pk for this company so the snippet + preview use it.
  // Falls back to a `pk_live_...` placeholder if none exists (merchant hasn't
  // created a publishable key yet — nudged to the Publishable Keys section).
  const [pk, setPk] = useState<string>("pk_live_YOUR_PUBLISHABLE_KEY");
  const [hasRealPk, setHasRealPk] = useState<boolean>(false);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string>("");
  const previewRef = useRef<HTMLDivElement | null>(null);
  const elementInstanceRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = selectedCompanyId ? `?company_id=${selectedCompanyId}` : "";
        const { data } = await axiosBaseApi.get(`publishable-keys${params}`);
        const rows: Array<{ publishable_key: string; status: string }> = data?.data?.keys || [];
        const active = rows.find((r) => r.status === "active") || rows[0];
        if (!cancelled && active?.publishable_key) {
          setPk(active.publishable_key);
          setHasRealPk(true);
        }
      } catch {
        /* silent — keep placeholder */
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  // Copy-paste HTML snippet. Includes the SDK <script> tag and a
  // `Dynopay(pk).elements()` call with the live appearance API defaults.
  const snippet =
    `<!-- Load Dynopay embed SDK once per page -->\n` +
    `<script src="${baseUrl}/v1/embed.js"></script>\n\n` +
    `<!-- Mount target -->\n` +
    `<div id="dynopay-crypto-el"></div>\n\n` +
    `<script>\n` +
    `  const dp = Dynopay("${pk}");\n` +
    `  const elements = dp.elements({\n` +
    `    appearance: { theme: "auto", preset: "default", accent: "#CCFF00" },\n` +
    `    // locale: "en",   // optional — auto-detected from navigator.language\n` +
    `  });\n` +
    `  const el = elements.create("crypto", { amount: 5 });\n` +
    `  el.on("succeeded", (data) => { location.href = "/thanks?p=" + data.payment_id; });\n` +
    `  // Confirm fulfillment via webhook (payment.succeeded) — not this event.\n` +
    `  el.mount("#dynopay-crypto-el");\n` +
    `</script>`;

  const reactSnippet =
`import { useEffect, useRef } from "react";

export function DynopayCryptoElement({ amount = 5 }: { amount?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const el  = useRef<any>(null);
  useEffect(() => {
    (async () => {
      await new Promise<void>((r) => {
        if ((window as any).Dynopay) return r();
        const s = document.createElement("script");
        s.src = "${baseUrl}/v1/embed.js";
        s.onload = () => r();
        document.head.appendChild(s);
      });
      const dp = (window as any).Dynopay("${pk}");
      el.current = dp.elements({ appearance: { theme: "auto" } })
        .create("crypto", { amount });
      el.current.on("succeeded", () => { /* confirm via webhook */ });
      el.current.mount(box.current!);
    })();
    return () => el.current?.destroy();
  }, [amount]);
  return <div ref={box} />;
}`;

  const loadSdk = () =>
    new Promise<void>((resolve, reject) => {
      const w = window as any;
      if (w.Dynopay && typeof w.Dynopay === "function") return resolve();
      // For live preview we load the SDK from THIS origin so its API calls go
      // to THIS backend (avoiding cross-origin issues when NEXT_PUBLIC_BASE_URL
      // points to a different host than the dashboard is served from).
      const src = window.location.origin + "/v1/embed.js";
      const existing = document.querySelector('script[data-dynopay-sdk="1"]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("SDK failed to load")));
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.setAttribute("data-dynopay-sdk", "1");
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("SDK failed to load from " + src));
      document.head.appendChild(s);
    });

  const mountPreview = async () => {
    setPreviewError("");
    if (!hasRealPk) {
      setPreviewError(
        "You need at least one active publishable key. Scroll to the Publishable Keys section below and create one — then come back and try the preview."
      );
      return;
    }
    try {
      await loadSdk();
      const dp = (window as any).Dynopay(pk);
      // Destroy any prior instance before re-mounting
      if (elementInstanceRef.current?.destroy) {
        try { elementInstanceRef.current.destroy(); } catch { /* ignore */ }
      }
      const inst = dp
        .elements({
          appearance: {
            theme: theme.palette.mode === "dark" ? "dark" : "light",
            preset: "default",
            accent: theme.palette.primary.main || "#CCFF00",
          },
        })
        .create("crypto", { amount: 5 });

      inst.on("error", (e: { message: string }) => {
        setPreviewError(
          e?.message ||
          "Preview failed. If your publishable key is domain-locked, add this dashboard's origin to its allowed_domains and retry."
        );
      });
      inst.on("succeeded", () => {
        dispatch({
          type: TOAST_SHOW,
          payload: { message: "Preview payment succeeded (confirm via webhook)", severity: "success" },
        });
      });
      inst.mount(previewRef.current);
      elementInstanceRef.current = inst;
    } catch (err: any) {
      setPreviewError(err?.message || "Failed to mount preview");
    }
  };

  const togglePreview = async () => {
    if (previewOpen) {
      if (elementInstanceRef.current?.destroy) {
        try { elementInstanceRef.current.destroy(); } catch { /* ignore */ }
        elementInstanceRef.current = null;
      }
      setPreviewOpen(false);
      setPreviewError("");
      return;
    }
    setPreviewOpen(true);
    // Wait one tick for the container to render
    setTimeout(() => { void mountPreview(); }, 0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (elementInstanceRef.current?.destroy) {
        try { elementInstanceRef.current.destroy(); } catch { /* ignore */ }
      }
    };
  }, []);

  // Re-mount when theme flips while preview is open (dark/light auto-sync)
  useEffect(() => {
    if (previewOpen && elementInstanceRef.current) {
      void mountPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.palette.mode]);

  return (
    <Box
      data-testid="elements-widget-section"
      sx={{
        border: `1px solid ${theme.palette.border.main}`,
        borderRadius: "12px",
        background: theme.palette.background.paper,
        p: { xs: 2, sm: 2.5 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 700,
            color: theme.palette.text.primary,
            fontFamily: "var(--font-sans)",
          }}
        >
          Elements — Inline Crypto Widget
        </Typography>
        <Box
          component="span"
          sx={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.5,
            px: 1,
            py: 0.3,
            borderRadius: "6px",
            bgcolor: theme.palette.primary.main,
            color: "#0b0b0b",
          }}
        >
          NEW · publishable key
        </Box>
      </Box>
      <Typography sx={{ mt: 0.5, fontSize: 14, color: theme.palette.text.secondary }}>
        Render Dynopay's native crypto payment UI directly in your DOM — no iframe, no
        redirect. Uses a publishable key (browser-safe) and your customer picks a
        currency, then pays to the address shown. Always verify fulfillment via
        webhooks — the browser <code>succeeded</code> event is UX only.
      </Typography>

      <SnippetBlock label="HTML — mount inline" code={snippet} onCopy={onCopy} />
      <SnippetBlock label="React — hook form" code={reactSnippet} onCopy={onCopy} />

      <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center" }}>
        <CustomButton
          label={previewOpen ? "Hide live preview" : "Show live preview"}
          data-testid="elements-preview-toggle"
          variant="primary"
          onClick={togglePreview}
          sx={{
            background: theme.palette.primary.main,
            color: "#0b0b0b",
            "&:hover": { background: theme.palette.primary.main, opacity: 0.9 },
          }}
        />
        <CustomButton
          label="View full guide"
          endIcon={<ArrowOutwardIcon sx={{ fontSize: 16 }} />}
          variant="outlined"
          sx={{
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            "&:hover": {
              background: theme.palette.mode === "dark" ? "rgba(204,255,0,0.08)" : "#f0f5ff",
              borderColor: theme.palette.primary.main,
            },
          }}
          onClick={() => docsUrl && window.open(docsUrl + "#elements", "_blank", "noopener,noreferrer")}
        />
        {!hasRealPk && (
          <Typography sx={{ fontSize: 12, color: theme.palette.warning?.main || "#F59E0B" }}>
            No publishable key found — the snippet uses a placeholder. Create one in the
            "Publishable Keys" section below.
          </Typography>
        )}
      </Box>

      {previewOpen && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: "10px",
            border: `1px dashed ${theme.palette.border.main}`,
            background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: theme.palette.text.secondary, mb: 1 }}>
            Live preview · $5 · sandbox
          </Typography>
          {previewError ? (
            <Typography
              data-testid="elements-preview-error"
              sx={{
                fontSize: 13,
                color: theme.palette.error.main,
                background: "rgba(220,38,38,0.08)",
                border: "1px solid rgba(220,38,38,0.3)",
                borderRadius: "8px",
                padding: "10px 12px",
              }}
            >
              {previewError}
            </Typography>
          ) : (
            <Box
              ref={previewRef}
              data-testid="elements-preview-mount"
              sx={{ display: "flex", justifyContent: "center" }}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* "Try your first payment" cURL activation card (Phase C)            */
/* Renders only when a sandbox (dpk_test_) key exists. Reveal-to-copy */
/* — the key is masked in the DOM until the merchant clicks "Show".   */
/* ------------------------------------------------------------------ */
const TryFirstPaymentCard = ({
  onCopy,
  docsUrl,
  testKey,
}: {
  onCopy: (v: string) => void;
  docsUrl: string;
  testKey: string;
}) => {
  const theme = useTheme();
  const { t } = useTranslation("apiScreen");
  const [revealed, setRevealed] = useState(false);

  const baseUrl =
    (process.env.NEXT_PUBLIC_BASE_URL as string) ||
    (typeof window !== "undefined" ? window.location.origin : "https://dynopay.com");

  // Masked display (safe for screenshots, sharing, screen-recordings)
  const maskedKey = testKey
    ? testKey.slice(0, 12) + "•".repeat(Math.max(0, testKey.length - 16)) + testKey.slice(-4)
    : "dpk_test_••••••••••";

  const displayedKey = revealed ? testKey : maskedKey;

  // The visible snippet always shows the masked key (unless revealed).
  // Copy button copies the REAL key so the cURL works out of the box.
  const buildCurl = (key: string) =>
    `curl -X POST ${baseUrl}/api/user/createPayment \\
  -H "x-api-key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5,
    "redirect_uri": "${baseUrl}/dashboard"
  }'`;

  const displayedSnippet = buildCurl(displayedKey);
  const copyableSnippet = buildCurl(testKey);

  const sampleResponse =
`HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Link Generated!",
  "data": {
    "redirect_url": "https://checkout.dynopay.com/pay?d=abc123...",
    "fee_payer": "company",
    "available_currencies": ["USDT-TRC20", "BTC", "ETH"],
    "webhook_url": "not configured"
  }
}`;

  return (
    <Box
      data-testid="try-first-payment-card"
      sx={{
        border: `1px solid ${theme.palette.border.main}`,
        borderRadius: "12px",
        background: theme.palette.background.paper,
        p: { xs: 2, sm: 2.5 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle sparkle accent stripe */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, transparent 100%)`,
        }}
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 700,
            color: theme.palette.text.primary,
            fontFamily: "var(--font-sans)",
          }}
        >
          {t("keys.tryFirstPaymentTitle", {
            defaultValue: "Try your first payment",
          })}
        </Typography>
        <Box
          component="span"
          sx={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.5,
            px: 1,
            py: 0.3,
            borderRadius: "6px",
            bgcolor: theme.palette.primary.main,
            color: "#0b0b0b",
          }}
        >
          {t("keys.tryFirstPaymentBadge", { defaultValue: "SANDBOX · cURL" })}
        </Box>
      </Box>

      <Typography sx={{ mt: 0.5, fontSize: 14, color: theme.palette.text.secondary }}>
        {t("keys.tryFirstPaymentSubtitle", {
          defaultValue:
            "Fastest way to feel Dynopay. Copy-paste this into your terminal — it uses your sandbox key and creates a $5 test checkout link.",
        })}
      </Typography>

      {/* Reveal toggle */}
      <Box
        sx={{
          mt: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
          }}
        >
          {t("keys.tryFirstPaymentSnippetLabel", { defaultValue: "cURL — POST /api/user/createPayment" })}
        </Typography>

        <Box
          component="button"
          type="button"
          data-testid="try-first-payment-reveal"
          onClick={() => setRevealed((v) => !v)}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            border: `1px solid ${theme.palette.border.main}`,
            background: "transparent",
            color: theme.palette.text.secondary,
            borderRadius: "6px",
            px: 1,
            py: 0.4,
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
            "&:hover": { color: theme.palette.text.primary },
          }}
        >
          <Image src={EyeIcon.src} alt="Reveal" width={14} height={14} />
          {revealed
            ? t("keys.tryFirstPaymentHide", { defaultValue: "Hide key" })
            : t("keys.tryFirstPaymentReveal", { defaultValue: "Show key" })}
        </Box>
      </Box>

      <Box sx={{ mt: 0.75, position: "relative" }}>
        <Box
          component="pre"
          data-testid="try-first-payment-snippet"
          sx={{
            m: 0,
            p: 1.5,
            borderRadius: "8px",
            overflowX: "auto",
            background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#0b0b0b",
            color: theme.palette.mode === "dark" ? "#d6f7c2" : "#e6e6e6",
            fontSize: 12.5,
            lineHeight: 1.6,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            whiteSpace: "pre",
            border: `1px solid ${theme.palette.border.main}`,
          }}
        >
          {displayedSnippet}
        </Box>
        <Box
          component="button"
          type="button"
          data-testid="try-first-payment-copy"
          onClick={() => onCopy(copyableSnippet)}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            border: `1px solid ${theme.palette.border.main}`,
            background: theme.palette.mode === "dark" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.08)",
            color: theme.palette.mode === "dark" ? "#e6e6e6" : "#f0f0f0",
            borderRadius: "6px",
            px: 1,
            py: 0.4,
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
            "&:hover": {
              background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.14)",
            },
          }}
          aria-label={t("keys.tryFirstPaymentCopyAria", { defaultValue: "Copy cURL command with your real test key" })}
        >
          <Image src={CopyIcon.src} alt="Copy" width={14} height={14} />
          {t("keys.tryFirstPaymentCopyLabel", { defaultValue: "Copy cURL" })}
        </Box>
      </Box>

      {/* Sample response */}
      <Box sx={{ mt: 2 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
            mb: 0.5,
          }}
        >
          {t("keys.tryFirstPaymentResponseLabel", { defaultValue: "You should see" })}
        </Typography>
        <Box
          component="pre"
          data-testid="try-first-payment-response"
          sx={{
            m: 0,
            p: 1.5,
            borderRadius: "8px",
            overflowX: "auto",
            background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#f6f6f6",
            color: theme.palette.text.primary,
            fontSize: 12.5,
            lineHeight: 1.6,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            whiteSpace: "pre",
            border: `1px solid ${theme.palette.border.main}`,
          }}
        >
          {sampleResponse}
        </Box>
      </Box>

      <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center" }}>
        <CustomButton
          label={t("keys.tryFirstPaymentDocsBtn", { defaultValue: "Open full API docs" })}
          endIcon={<ArrowOutwardIcon sx={{ fontSize: 16 }} />}
          variant="outlined"
          sx={{
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            "&:hover": {
              background: theme.palette.mode === "dark" ? "rgba(204,255,0,0.08)" : "#f0f5ff",
              borderColor: theme.palette.primary.main,
            },
          }}
          onClick={() =>
            docsUrl && window.open(docsUrl, "_blank", "noopener,noreferrer")
          }
        />
        <Typography
          sx={{ fontSize: 12, color: theme.palette.text.secondary }}
        >
          {t("keys.tryFirstPaymentFooterHint", {
            defaultValue:
              "The redirect_url is a hosted checkout page — open it in a browser to complete the test payment.",
          })}
        </Typography>
      </Box>
    </Box>
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
      {(() => {
        // Show a subtle info banner when the merchant has a test key but no
        // active production key — the live key auto-unlocks after adding or
        // reusing a wallet on this company.
        const list: IApi[] = Array.isArray(apiState?.apiList) ? apiState.apiList : [];
        const hasProd = list.some(
          (k) => (k as { environment?: string })?.environment === "production" && k?.status === "active",
        );
        const hasDev = list.some(
          (k) => (k as { environment?: string })?.environment === "development" && k?.status === "active",
        );
        if (!hasProd && hasDev) {
          return (
            <Box
              data-testid="live-key-unlock-banner"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                p: isMobile ? "12px 14px" : "12px 18px",
                mb: isMobile ? 2 : 2.5,
                borderRadius: "10px",
                border: `1px solid ${theme.palette.primary.main}33`,
                background:
                  theme.palette.mode === "dark"
                    ? "rgba(106,123,255,0.10)"
                    : "rgba(106,123,255,0.06)",
                opacity: 0,
                animation: "fadeSlideIn 0.5s ease forwards",
                ...itemAnimation,
              }}
            >
              <LockOutlinedIcon
                sx={{
                  fontSize: 20,
                  color: theme.palette.primary.main,
                  flexShrink: 0,
                }}
              />
              <Typography
                sx={{
                  fontSize: isMobile ? 13 : 14,
                  lineHeight: 1.5,
                  color: theme.palette.text.primary,
                  fontFamily: "var(--font-sans), sans-serif",
                }}
              >
                {t("keys.liveUnlockHint", {
                  defaultValue:
                    "Your live key activates automatically once you add (or reuse) your first wallet on this company.",
                })}
              </Typography>
            </Box>
          );
        }
        return null;
      })()}
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
          mb: isMobile ? 2 : 2.5,
          opacity: 0,
          animation: "fadeSlideIn 0.5s ease forwards",
          ...itemAnimation,
        }}
      >
        <EmbeddedCheckoutCard onCopy={handleCopy} docsUrl={docsUrl} />
      </Box>

      <Box
        sx={{
          mb: isMobile ? 2 : 2.5,
          opacity: 0,
          animation: "fadeSlideIn 0.5s ease forwards",
          ...itemAnimation,
        }}
      >
        <PublishableKeysSection />
      </Box>

      <Box
        sx={{
          mb: isMobile ? 2 : 2.5,
          opacity: 0,
          animation: "fadeSlideIn 0.5s ease forwards",
          ...itemAnimation,
        }}
      >
        <BuyButtonsSection />
      </Box>

      <Box
        sx={{
          mb: isMobile ? 2 : 2.5,
          opacity: 0,
          animation: "fadeSlideIn 0.5s ease forwards",
          ...itemAnimation,
        }}
      >
        <ElementsWidgetCard onCopy={handleCopy} docsUrl={docsUrl} />
      </Box>

      {(() => {
        // Phase C: "Try your first payment" cURL card.
        // Only mount when a real sandbox (dpk_test_) key exists so the copy
        // button produces a working command out of the box.
        const list: IApi[] = Array.isArray(apiState?.apiList) ? apiState.apiList : [];
        const sandboxKey = list.find((k: any) => {
          if (k?.environment !== "development" || k?.status !== "active") return false;
          const raw = (k as { test_mode_restrictions?: unknown }).test_mode_restrictions;
          let parsed: any = null;
          if (typeof raw === "string") {
            try { parsed = JSON.parse(raw); } catch { parsed = null; }
          } else if (raw && typeof raw === "object") {
            parsed = raw;
          }
          return !!parsed?.sandbox_mode;
        });
        if (!sandboxKey) return null;
        return (
          <Box
            sx={{
              mb: isMobile ? 2 : 2.5,
              opacity: 0,
              animation: "fadeSlideIn 0.5s ease forwards",
              ...itemAnimation,
            }}
          >
            <TryFirstPaymentCard
              onCopy={handleCopy}
              docsUrl={docsUrl}
              testKey={(sandboxKey as any)?.apiKey || ""}
            />
          </Box>
        );
      })()}

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
