import React, { useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import CopyInline from "@/Components/UX/CopyInline";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

interface Props {
  url: string;
  label?: string;
}

export const buildEmbedSnippet = (url: string, label: string) =>
  `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:999px;background:${CB_TOKENS.indigo.light};color:#fff;font:600 15px/1 system-ui,-apple-system,Segoe UI,sans-serif;text-decoration:none">${label}</a>`;

/** "Embed on your site" disclosure: ready-to-paste HTML button + live preview + copy. */
const EmbedSnippet: React.FC<Props> = ({ url, label }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("paymentLinks");
  const [open, setOpen] = useState(false);
  const buttonLabel = label || t("detail.embedButtonLabel", { defaultValue: "Pay with crypto" });
  const snippet = buildEmbedSnippet(url, buttonLabel);
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;

  return (
    <Box data-testid="paylink-embed" sx={{ border: `1px solid ${border}`, borderRadius: "14px", overflow: "hidden" }}>
      <Box
        component="button"
        type="button"
        data-testid="paylink-embed-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          minHeight: 46,
          px: 1.75,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          color: theme.palette.text.primary,
          "&:hover": { backgroundColor: theme.palette.action.hover },
        }}
      >
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
          <Icon name="code-2" size={16} />
          {t("detail.embedTitle", { defaultValue: "Embed on your site" })}
        </Box>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} />
      </Box>
      {open && (
        <Box sx={{ px: 1.75, pb: 1.75, display: "grid", gap: 1.5 }}>
          <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, lineHeight: 1.5 }}>
            {t("detail.embedHelp", { defaultValue: "Paste this anywhere HTML is allowed — your site, a newsletter, a Notion page." })}
          </Box>
          <Box sx={{ display: "flex", justifyContent: "center", py: 1.5, borderRadius: "12px", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(10,10,15,0.03)" }}>
            <Box
              component="span"
              data-testid="paylink-embed-preview"
              sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: "22px", py: "12px", borderRadius: 999, backgroundColor: CB_TOKENS.indigo.light, color: "#fff", font: "600 15px/1 system-ui, -apple-system, 'Segoe UI', sans-serif" }}
            >
              {buttonLabel}
            </Box>
          </Box>
          <Box sx={{ position: "relative", borderRadius: "12px", border: `1px solid ${border}`, backgroundColor: isDark ? "#0E0F15" : "#F7F7FA" }}>
            <Box
              component="pre"
              data-testid="paylink-embed-code"
              sx={{ m: 0, p: 1.5, pr: 6, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.55, color: theme.palette.text.primary, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 140, overflow: "auto" }}
            >
              {snippet}
            </Box>
            <Box sx={{ position: "absolute", top: 8, right: 8 }}>
              <CopyInline value={snippet} variant="boxed" size={16} testId="paylink-embed-copy" copyLabel={t("detail.copySnippet", { defaultValue: "Copy snippet" })} />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default EmbedSnippet;
