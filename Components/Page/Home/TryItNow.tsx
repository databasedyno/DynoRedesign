import React, { memo, useState, useCallback, useMemo } from "react";
import { Box, Button, IconButton, Snackbar, Tooltip, Typography, useTheme } from "@mui/material";
import { ContentCopy, OpenInNew } from "@mui/icons-material";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";

/**
 * TryItNow — homepage playground section.
 *
 * Left column: a clickable, live iframe of /pay/demo?embed=1 so visitors can
 * see the real checkout UI without leaving the landing page. It's the actual
 * demo, not a screenshot, so it can't drift out of sync with production.
 *
 * Right column: a copy-paste curl snippet against the public sandbox endpoint
 * (POST /api/public/sandbox/payment-links). That endpoint returns an ephemeral
 * in-memory response — nothing hits the DB, safe to hand out publicly, rate-
 * limited to 10 req/IP/min on the backend.
 *
 * Why not a static image? Emergent's "click the thing immediately" ethos: the
 * value prop lands harder when you can actually try it.
 */

// Brand base URL for the curl snippet. Always render as dynopay.com regardless
// of the environment so the copy-paste example matches what devs will actually
// use in production (and stays SSR-stable — no window.location.origin, which
// would differ between server and client and cause a hydration mismatch).
const BRAND_BASE_URL = "https://dynopay.com";

const SANDBOX_KEY = "dyno_sk_sandbox_demo_9f621db8";

const buildCurl = (baseUrl: string): string => {
  const base = baseUrl.replace(/\/+$/, "");
  return [
    `curl -X POST "${base}/api/public/sandbox/payment-links" \\`,
    `  -H "Authorization: Bearer ${SANDBOX_KEY}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{`,
    `    "amount": 49.99,`,
    `    "currency": "USD",`,
    `    "description": "Pro Plan – Monthly",`,
    `    "customer_email": "customer@example.com"`,
    `  }'`,
  ].join("\n");
};

const SAMPLE_RESPONSE = `{
  "object": "payment_link",
  "id": "plink_sandbox_2727324c61ebfb8b",
  "livemode": false,
  "sandbox": true,
  "status": "awaiting_payment",
  "amount": 49.99,
  "currency": "USD",
  "checkout_url": "https://dynopay.com/pay/…",
  "expires_at": "2026-07-05T16:14:12.536Z",
  "supported_chains": ["USDT-TRC20", "USDT-ERC20", …]
}`;

const CodeBlock: React.FC<{
  title: string;
  language: "bash" | "json";
  code: string;
  onCopy?: () => void;
  copyable?: boolean;
}> = ({ title, language, code, onCopy, copyable = true }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("landing");
  return (
    <Box
      sx={{
        borderRadius: "12px",
        overflow: "hidden",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        background: isDark ? "#0B0D17" : "#0E1020",
      }}
    >
      {/* Fake terminal header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <Box key={c} sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: c }} />
          ))}
          <Typography
            sx={{
              ml: 1,
              fontFamily: "UrbanistMedium",
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.3px",
            }}
          >
            {title}
          </Typography>
        </Box>
        {copyable && onCopy && (
          <Tooltip title={t("tryItCopyTooltip")} placement="top">
            <IconButton
              size="small"
              onClick={onCopy}
              sx={{
                color: "rgba(255,255,255,0.6)",
                "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
              }}
            >
              <ContentCopy sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {/* Code body */}
      <Box
        component="pre"
        sx={{
          m: 0,
          p: { xs: 1.8, sm: 2.2 },
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          fontSize: { xs: 11.5, sm: 12.5 },
          lineHeight: 1.55,
          color: language === "bash" ? "#E6E9F2" : "#B7E4C7",
          overflowX: "auto",
          whiteSpace: "pre",
          // Subtle inline "highlighting" via color mixing on cURL lines
          "& b": { color: "#8BC5FF", fontWeight: 500 },
        }}
      >
        {code}
      </Box>
    </Box>
  );
};

const TryItNow: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("landing");
  const [copiedSnack, setCopiedSnack] = useState<string | null>(null);

  const baseUrl = BRAND_BASE_URL;
  const curl = useMemo(() => buildCurl(baseUrl), [baseUrl]);

  const copy = useCallback(async (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedSnack(t("tryItCopied", { label }));
    } catch {
      setCopiedSnack(t("tryItCopied", { label }));
    }
  }, [t]);

  return (
    <Box
      sx={{
        py: { xs: 6, md: 10 },
        px: { xs: 2, md: 4 },
        maxWidth: 1200,
        mx: "auto",
      }}
      aria-labelledby="try-it-now-heading"
    >
      {/* Section header */}
      <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
        <Typography
          sx={{
            fontFamily: "UrbanistBold",
            fontSize: 12,
            letterSpacing: "1.5px",
            color: theme.palette.primary.main,
            textTransform: "uppercase",
            mb: 1.5,
          }}
        >
          {t("tryItEyebrow")}
        </Typography>
        <Typography
          id="try-it-now-heading"
          component="h2"
          sx={{
            fontFamily: "OutfitBold",
            fontSize: { xs: 28, sm: 34, md: 42 },
            lineHeight: 1.12,
            color: theme.palette.text.primary,
            mb: 1.5,
            letterSpacing: "-0.5px",
          }}
        >
          {t("tryItTitle")}{" "}
          <Box
            component="span"
            sx={{
              background: "linear-gradient(135deg, #0004FF 0%, #6C7BFF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {t("tryItTitleHighlight")}
          </Box>
          .
        </Typography>
        <Typography
          sx={{
            fontFamily: "UrbanistMedium",
            fontSize: { xs: 14, md: 16 },
            color: theme.palette.text.secondary,
            maxWidth: 620,
            mx: "auto",
          }}
        >
          {t("tryItSubtitle")}
        </Typography>
      </Box>

      {/* Two-column layout */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(320px, 460px) minmax(0, 1fr)" },
          gap: { xs: 3, md: 4 },
          alignItems: "start",
        }}
      >
        {/* ── Left: embedded live checkout ─────────────────────────────── */}
        {/* NB: each grid item wrapper needs minWidth:0 too, otherwise its   *
         *     intrinsic content (long <pre>, wide iframe) forces the whole  *
         *     column to grow past viewport width on mobile.                 */}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography
              sx={{
                fontFamily: "UrbanistBold",
                fontSize: 13,
                color: theme.palette.text.primary,
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
              }}
              component="span"
            >
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "#22C55E",
                  display: "inline-block",
                  animation: "dyno-playground-pulse 1.6s infinite",
                  "@keyframes dyno-playground-pulse": {
                    "0%":   { opacity: 1 },
                    "50%":  { opacity: 0.4 },
                    "100%": { opacity: 1 },
                  },
                }}
              />
              Live checkout
            </Typography>
            <Button
              size="small"
              endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
              component="a"
              href="/pay/demo"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontFamily: "UrbanistSemiBold",
                fontSize: 12,
                textTransform: "none",
                color: theme.palette.primary.main,
                "&:hover": { bgcolor: "rgba(0,4,255,0.06)" },
              }}
            >
              {t("tryItOpenFullPage")}
            </Button>
          </Box>
          <Box
            sx={{
              position: "relative",
              borderRadius: "16px",
              overflow: "hidden",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
              background: isDark ? "rgba(15,16,30,0.5)" : "rgba(255,255,255,0.6)",
              boxShadow: isDark
                ? "0 12px 40px rgba(0,0,0,0.4)"
                : "0 12px 40px rgba(0,4,255,0.08)",
            }}
          >
            <Box
              component="iframe"
              src="/pay/demo?embed=1"
              title="DynoPay checkout demo"
              loading="lazy"
              sx={{
                display: "block",
                width: "100%",
                height: { xs: 560, sm: 620, md: 680 },
                border: "none",
                background: "transparent",
              }}
            />
            {/* Tiny "click me" nudge, top-right of iframe */}
            <Box
              sx={{
                position: "absolute",
                top: 12,
                right: 12,
                px: 1.2,
                py: 0.4,
                borderRadius: "999px",
                bgcolor: "rgba(0,0,0,0.55)",
                color: "#fff",
                fontFamily: "UrbanistSemiBold",
                fontSize: 10.5,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                pointerEvents: "none",
                zIndex: 3,
              }}
            >
              {t("tryItInteractive")}
            </Box>
          </Box>
          <Typography
            sx={{
              mt: 1.3,
              fontFamily: "UrbanistMedium",
              fontSize: 11.5,
              color: theme.palette.text.disabled,
              textAlign: "center",
            }}
          >
            {t("tryItSandboxMode")}
          </Typography>
        </Box>

        {/* ── Right: curl snippet + response ───────────────────────────── */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: "UrbanistBold",
              fontSize: 13,
              color: theme.palette.text.primary,
              mb: 1.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
            }}
            component="span"
          >
            <Box
              component="span"
              sx={{
                px: 0.9,
                py: 0.15,
                borderRadius: 0.8,
                bgcolor: isDark ? "rgba(108,123,255,0.15)" : "rgba(0,4,255,0.08)",
                color: theme.palette.primary.main,
                fontFamily: "UrbanistBold",
                fontSize: 11,
                letterSpacing: "0.4px",
              }}
            >
              POST
            </Box>
            /api/public/sandbox/payment-links
          </Typography>

          <CodeBlock
            title={t("tryItRequestTitle")}
            language="bash"
            code={curl}
            onCopy={() => copy(curl, "cURL")}
          />

          <Box sx={{ height: 12 }} />

          <CodeBlock
            title={t("tryItResponseTitle")}
            language="json"
            code={SAMPLE_RESPONSE}
            copyable={false}
          />

          <Box sx={{ mt: 2.2, display: "flex", flexWrap: "wrap", gap: 1.2 }}>
            <Button
              variant="contained"
              onClick={() => copy(curl, "cURL")}
              sx={{
                fontFamily: "UrbanistSemiBold",
                textTransform: "none",
                fontSize: 13.5,
                px: 2.2,
                py: 0.9,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #0004FF 0%, #3D40FF 100%)",
                boxShadow: "0 8px 22px rgba(0,4,255,0.25)",
                "&:hover": {
                  background: "linear-gradient(135deg, #0004FF 0%, #4D50FF 100%)",
                  boxShadow: "0 10px 26px rgba(0,4,255,0.3)",
                },
              }}
              startIcon={<ContentCopy sx={{ fontSize: 15 }} />}
            >
              {t("tryItCopyCurl")}
            </Button>
            <Button
              variant="outlined"
              component="a"
              href="/documentation"
              sx={{
                fontFamily: "UrbanistSemiBold",
                textTransform: "none",
                fontSize: 13.5,
                px: 2.2,
                py: 0.9,
                borderRadius: "10px",
                borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
                color: theme.palette.text.primary,
                "&:hover": {
                  borderColor: theme.palette.primary.main,
                  bgcolor: isDark ? "rgba(108,123,255,0.06)" : "rgba(0,4,255,0.04)",
                },
              }}
            >
              {t("tryItFullApiDocs")}
            </Button>
          </Box>

          <Typography
            sx={{
              mt: 2,
              fontFamily: "UrbanistMedium",
              fontSize: 11.5,
              color: theme.palette.text.disabled,
              lineHeight: 1.5,
            }}
          >
            {t("tryItSandboxKeyNote1")} <Box component="code" sx={{ fontFamily: "monospace", px: 0.5, py: 0.15, borderRadius: 0.5, bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", fontSize: 11 }}>{SANDBOX_KEY}</Box> {t("tryItSandboxKeyNote2")}
          </Typography>
        </Box>
      </Box>

      <Snackbar
        open={Boolean(copiedSnack)}
        autoHideDuration={1800}
        onClose={() => setCopiedSnack(null)}
        message={copiedSnack || ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
};

export default memo(TryItNow);

