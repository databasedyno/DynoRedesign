import { brandFg } from "@/constants/theme";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { Box, CircularProgress, Typography } from "@mui/material";
import { Icon } from "@/styles/uiKit";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";


import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";

import { ApiAction } from "@/Redux/Actions";
import { API_DELETE, API_FETCH, API_REGENERATE, API_TOGGLE_STATUS, API_CLEAR_REVEALED } from "@/Redux/Actions/ApiAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import CopyIcon from "@/assets/Icons/copy-icon.svg";
import EyeIcon from "@/assets/Icons/eye-icon.svg";
import InfoIcon from "@/assets/Icons/info-icon.svg";
import { IApi, rootReducer } from "@/utils/types";

import CreateApiModel from "@/Components/UI/ApiKeysModel/CreateApiModel";
import DeleteModel from "@/Components/UI/DeleteModel";
import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import PublishableKeysSection from "./PublishableKeysSection";
import ApiKeysTable from "./ApiKeysTable";
import BuyButtonsSection from "./BuyButtonsSection";
import SandboxSimulatorCard from "./SandboxSimulatorCard";
import WebhookConsoleSection from "./WebhookConsoleSection";
import useIsMobile from "@/hooks/useIsMobile";
import usePublishableKeys from "@/hooks/usePublishableKeys";
import { useTheme } from "@mui/material";
import { ApiKeysPageProps } from "@/utils/types/apis";
import Image from "next/image";
import * as yup from "yup";
import copyToClipboard from "@/helpers/copyToClipboard";
import {
  ApiDocumentationCardDescription,
  InfoText,
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
          endIcon={<Icon name="arrow-up-right" size={14} />}
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
  const { t } = useTranslation("apiScreen");
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
          <Image src={CopyIcon.src} alt={t("snippet.copy", { defaultValue: "Copy" })} width={14} height={14} />
          {t("snippet.copy", { defaultValue: "Copy" })}
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
  const { t } = useTranslation("apiScreen");
  // Snippet base URL: shown to merchants for copy-paste into their OWN site.
  // Must always be a canonical Dynopay URL — never fall back to
  // window.location.origin (which would leak the preview/dev host).
  const baseUrl =
    (process.env.NEXT_PUBLIC_BASE_URL as string) || "https://checkout.dynopay.com";

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
        {t("embedded.title", { defaultValue: "Embedded Checkout" })}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 14, color: theme.palette.text.secondary }}>
        {t("embedded.description", { defaultValue: "Accept crypto directly on your site — no redirect. Your server creates a session with your secret key, then the browser mounts the checkout in an iframe. Always confirm payments via webhooks, not the browser event." })}
      </Typography>

      <Box
        sx={{
          mt: 1.5,
          p: 1.5,
          borderRadius: "10px",
          border: `1px solid ${theme.palette.border.main}`,
          background: theme.palette.mode === "dark" ? "rgba(255,209,0,0.08)" : "#F0FAF9",
        }}
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.65, color: theme.palette.text.secondary }}>
          <strong style={{ color: theme.palette.text.primary }}>Auth is just your secret API key</strong>{" "}
          {t("embedded.authNote", {
            defaultValue:
              "(x-api-key) — you do not need a customer token or a Create-Customer step to create a session.",
          })}
        </Typography>
        <Typography sx={{ fontSize: 13, lineHeight: 1.65, color: theme.palette.text.secondary, mt: 0.75 }}>
          <strong style={{ color: theme.palette.text.primary }}>Getting notified:</strong>{" "}
          {t("embedded.notifyNote", {
            defaultValue:
              "add a webhook endpoint (Webhook Console below) so your server is pinged to mark the order paid — this is the reliable way to fulfil orders. Without one you'll still get an email and an in-app alert, and the browser onComplete fires for UX only.",
          })}
        </Typography>
      </Box>

      <SnippetBlock label={t("embedded.snippetServer", { defaultValue: "1 · Server — create session" })} code={serverSnippet} onCopy={onCopy} />
      <SnippetBlock label={t("embedded.snippetClient", { defaultValue: "2 · Client — mount checkout" })} code={clientSnippet} onCopy={onCopy} />
      <SnippetBlock label={t("embedded.snippetModal", { defaultValue: "Optional — modal" })} code={modalSnippet} onCopy={onCopy} />

      <Box sx={{ mt: 2 }}>
        <CustomButton
          label={t("embedded.viewGuide", { defaultValue: "View full guide" })}
          endIcon={<Icon name="arrow-up-right" size={16} />}
          variant="outlined"
          sx={{
            borderColor: theme.palette.primary.main,
            color: brandFg(theme.palette.mode === "dark"),
            "&:hover": {
              background: theme.palette.mode === "dark" ? "rgba(255,209,0,0.10)" : "#FFF6CC",
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
  const { t } = useTranslation("apiScreen");
  const dispatch = useDispatch();
  const selectedCompanyId = useCompanyStore().selectedCompanyId;

  // Snippet base URL: rendered inside merchant-facing copy snippets, so it
  // must be a canonical Dynopay URL. Never fall back to
  // window.location.origin — that would leak the preview host into copy-paste
  // code samples on non-prod domains.
  const baseUrl =
    (process.env.NEXT_PUBLIC_BASE_URL as string) || "https://checkout.dynopay.com";

  // Load a real active pk for this company so the snippet + preview use it.
  // SWR-backed (shared with the Publishable Keys + Buy Buttons sections).
  // Falls back to a `pk_live_...` placeholder if none exists (merchant hasn't
  // created a publishable key yet — nudged to the Publishable Keys section).
  const { keys: pkRows } = usePublishableKeys<{
    publishable_key: string;
    status: string;
  }>(selectedCompanyId);
  const activePk = useMemo(() => {
    const active = pkRows.find((r) => r.status === "active") || pkRows[0];
    return active?.publishable_key || null;
  }, [pkRows]);
  const pk = activePk || "pk_live_YOUR_PUBLISHABLE_KEY";
  const hasRealPk = !!activePk;
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string>("");
  const previewRef = useRef<HTMLDivElement | null>(null);
  const elementInstanceRef = useRef<any>(null);

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
    `    appearance: { theme: "auto", preset: "default", accent: "#8B5E00" },\n` +
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
        t("elements.errorNoPk", { defaultValue: "You need at least one active publishable key. Scroll to the Publishable Keys section below and create one — then come back and try the preview." })
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
            accent: theme.palette.primary.main || "#8B5E00",
          },
        })
        .create("crypto", { amount: 5 });

      inst.on("error", (e: { message: string }) => {
        setPreviewError(
          e?.message ||
          t("elements.errorDomainLocked", { defaultValue: "Preview failed. If your publishable key is domain-locked, add this dashboard's origin to its allowed_domains and retry." })
        );
      });
      inst.on("succeeded", () => {
        dispatch({
          type: TOAST_SHOW,
          payload: { message: t("elements.previewSucceeded", { defaultValue: "Preview payment succeeded (confirm via webhook)" }), severity: "success" },
        });
      });
      inst.mount(previewRef.current);
      elementInstanceRef.current = inst;
    } catch (err: any) {
      setPreviewError(err?.message || t("elements.errorMountFailed", { defaultValue: "Failed to mount preview" }));
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
          {t("elements.title", { defaultValue: "Elements — Inline Crypto Widget" })}
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
          {t("elements.badge", { defaultValue: "NEW · publishable key" })}
        </Box>
      </Box>
      <Typography sx={{ mt: 0.5, fontSize: 14, color: theme.palette.text.secondary }}>
        {t("elements.description", { defaultValue: "Render Dynopay’s native crypto payment UI directly in your DOM — no iframe, no redirect. Uses a publishable key (browser-safe) and your customer picks a currency, then pays to the address shown. Always verify fulfillment via webhooks — the browser succeeded event is UX only." })}
      </Typography>

      <SnippetBlock label={t("elements.snippetHtml", { defaultValue: "HTML — mount inline" })} code={snippet} onCopy={onCopy} />
      <SnippetBlock label={t("elements.snippetReact", { defaultValue: "React — hook form" })} code={reactSnippet} onCopy={onCopy} />

      <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center" }}>
        <CustomButton
          label={previewOpen ? t("elements.hidePreview", { defaultValue: "Hide live preview" }) : t("elements.showPreview", { defaultValue: "Show live preview" })}
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
          label={t("elements.viewGuide", { defaultValue: "View full guide" })}
          endIcon={<Icon name="arrow-up-right" size={16} />}
          variant="outlined"
          sx={{
            borderColor: theme.palette.primary.main,
            color: brandFg(theme.palette.mode === "dark"),
            "&:hover": {
              background: theme.palette.mode === "dark" ? "rgba(255,209,0,0.10)" : "#FFF6CC",
              borderColor: theme.palette.primary.main,
            },
          }}
          onClick={() => docsUrl && window.open(docsUrl + "#elements", "_blank", "noopener,noreferrer")}
        />
        {!hasRealPk && (
          <Typography sx={{ fontSize: 12, color: theme.palette.warning?.main || "#F59E0B" }}>
            {t("elements.noPkWarning", { defaultValue: "No publishable key found — the snippet uses a placeholder. Create one in the “Publishable Keys” section below." })}
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
            {t("elements.livePreviewLabel", { defaultValue: "Live preview · $5 · sandbox" })}
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
  keyHint,
  onRegenerate,
}: {
  onCopy: (v: string) => void;
  docsUrl: string;
  /** Plaintext sandbox key — only available in the session that created/rotated it. */
  testKey: string;
  keyHint?: string;
  onRegenerate?: () => void;
}) => {
  const theme = useTheme();
  const { t } = useTranslation("apiScreen");
  const [revealed, setRevealed] = useState(false);
  const hasKey = testKey.length > 0;

  // cURL snippet is copy-pasted into a merchant's terminal — it must always
  // point at the canonical Dynopay API host. Never fall back to
  // window.location.origin (that would leak the preview host).
  const baseUrl =
    (process.env.NEXT_PUBLIC_BASE_URL as string) || "https://checkout.dynopay.com";

  // Masked display (safe for screenshots, sharing, screen-recordings)
  const maskedKey = hasKey
    ? testKey.slice(0, 12) + "•".repeat(Math.max(0, testKey.length - 16)) + testKey.slice(-4)
    : keyHint || "dpk_test_••••••••••";

  const displayedKey = revealed && hasKey ? testKey : maskedKey;

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

        {hasKey ? (
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
        ) : (
          onRegenerate && (
            <Box
              component="button"
              type="button"
              data-testid="try-first-payment-regenerate"
              onClick={onRegenerate}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                border: `1px solid ${theme.palette.primary.main}`,
                background: "transparent",
                color: brandFg(theme.palette.mode === "dark"),
                borderRadius: "6px",
                px: 1,
                py: 0.4,
                minHeight: 28,
                "@media (pointer: coarse)": { minHeight: 44 },
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
              }}
            >
              <Icon name="key-round" size={13} />
              {t("keys.tryFirstPaymentRegenerate", { defaultValue: "Regenerate sandbox key to copy it" })}
            </Box>
          )
        )}
      </Box>

      {!hasKey && (
        <Typography
          data-testid="try-first-payment-key-unavailable"
          sx={{ mt: 1, fontSize: 12.5, lineHeight: 1.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}
        >
          {t("keys.tryFirstPaymentKeyUnavailable", {
            defaultValue:
              "Your sandbox key is stored as a one-way hash, so it can't be shown here. Regenerate it once, copy it, and the command below will work out of the box.",
          })}
        </Typography>
      )}

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
        {hasKey && (
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
        )}
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
          endIcon={<Icon name="arrow-up-right" size={16} />}
          variant="outlined"
          sx={{
            borderColor: theme.palette.primary.main,
            color: brandFg(theme.palette.mode === "dark"),
            "&:hover": {
              background: theme.palette.mode === "dark" ? "rgba(255,209,0,0.10)" : "#FFF6CC",
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
  view = "all",
}: ApiKeysPageProps) => {
  // Batch B (N4) — slice flags. "all" preserves the pre-tabs page 1:1.
  const showKeys = view === "all" || view === "keys";
  const showDocs = view === "all" || view === "docs";
  const showWebhookConsole = view === "all" || view === "webhooks" || view === "events";
  const dispatch = useDispatch();
  const { t } = useTranslation("apiScreen");
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const apiState = useSelector((state: rootReducer) => state.apiReducer);

  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const { refetchCompanies } = useCompanyStore();

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
    refetchCompanies();
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(ApiAction(API_FETCH, payload));
  }, [selectedCompanyId]);

  // Honor the "won't be shown again once you leave this page" promise: freshly
  // generated/regenerated plaintext keys live only in-memory (Redux), so wipe
  // them when the keys view unmounts (tab switch or navigation away).
  useEffect(() => {
    return () => {
      dispatch({ type: API_CLEAR_REVEALED });
    };
  }, [dispatch]);

  const handleCopy = (value: string) => {
    if (!value) return;
    copyToClipboard(value);
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
    dispatch(ApiAction(API_REGENERATE, { id: apiId, company_id: selectedCompanyId }));
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

  if (showKeys && apiState.loading) {
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
            color: brandFg(theme.palette.mode === "dark"),
          }}
        />
      </Box>
    );
  }

  if (showKeys && apiState?.apiList?.length === 0 && !apiState?.loading) {
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
            endIcon={<Icon name="arrow-up-right" size={16} />}
            variant="outlined"
            sx={{
              borderColor: theme.palette.primary.main,
              color: brandFg(theme.palette.mode === "dark"),
              "&:hover": { background: theme.palette.mode === "dark" ? "rgba(255,209,0,0.10)" : "#FFF6CC", borderColor: theme.palette.primary.main },
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
      {showKeys && (
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
      )}
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
        if (!showKeys) return null;
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
              <Icon
                name="lock"
                size={20}
                color={brandFg(theme.palette.mode === "dark")}
                style={{ flexShrink: 0 }}
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
                    "Your live key activates automatically once you add (or reuse) your first payout address on this company.",
                })}
              </Typography>
            </Box>
          );
        }
        return null;
      })()}
      {showKeys && (
        <>
          <ApiKeysTable
            rows={Array.isArray(apiState?.apiList) ? apiState.apiList : []}
            revealedKeys={apiState?.revealedKeys}
            onCopy={handleCopy}
            onDelete={requestDelete}
            onRegenerate={handleRegenerate}
            onToggleStatus={handleToggleStatus}
          />
          {view === "all" && (
            <Box sx={{ mb: isMobile ? 2 : 2.5 }}>
              <ApiDocumentationCard docsUrl={docsUrl} />
            </Box>
          )}
        </>
      )}

      {view === "docs" && (
        <Box
          sx={{
            mb: isMobile ? 2 : 2.5,
            opacity: 0,
            animation: "fadeSlideIn 0.5s ease forwards",
            ...itemAnimation,
          }}
        >
          <ApiDocumentationCard docsUrl={docsUrl} />
        </Box>
      )}

      {showDocs && (
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
      )}

      {showKeys && (
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
      )}

      {showDocs && (
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
      )}

      {showWebhookConsole && (
      <Box
        sx={{
          mb: isMobile ? 2 : 2.5,
          opacity: 0,
          animation: "fadeSlideIn 0.5s ease forwards",
          ...itemAnimation,
        }}
      >
        <WebhookConsoleSection
          view={view === "webhooks" ? "settings" : view === "events" ? "events" : "all"}
        />
      </Box>
      )}

      {showDocs && (
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
      )}

      {(() => {
        // Phase C: "Try your first payment" cURL card.
        // Only mount when a real sandbox (dpk_test_) key exists so the copy
        // button produces a working command out of the box.
        if (!showKeys) return null;
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
        const revealedSandboxKey = apiState?.revealedKeys?.[(sandboxKey as any).api_id] || "";
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
              testKey={revealedSandboxKey}
              keyHint={(sandboxKey as any)?.key_hint || ""}
              onRegenerate={() => handleRegenerate((sandboxKey as any).api_id)}
            />
          </Box>
        );
      })()}

      {(() => {
        // Sandbox testing helper — drive a test-mode payment to settled + fire
        // the signed webhooks. Only shown once an active development (dpk_test_)
        // key exists, so the merchant has something to create a sandbox payment with.
        if (!showKeys) return null;
        const list: IApi[] = Array.isArray(apiState?.apiList) ? apiState.apiList : [];
        const hasDevKey = list.some(
          (k) => (k as { environment?: string })?.environment === "development" && k?.status === "active",
        );
        if (!hasDevKey) return null;
        return (
          <Box
            sx={{
              mb: isMobile ? 2 : 2.5,
              opacity: 0,
              animation: "fadeSlideIn 0.5s ease forwards",
              ...itemAnimation,
            }}
          >
            <SandboxSimulatorCard />
          </Box>
        );
      })()}

      {showKeys && (
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
      )}

      {showKeys && <CreateApiModel open={openCreate} onClose={handleCreateClose} />}
    </>
  );
};

export default ApiKeysPage;
