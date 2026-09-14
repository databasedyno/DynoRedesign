import React, { useState } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { ContentCopyRounded, DownloadRounded, CheckRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface BackupCodesListProps {
  codes: string[];
}

/** Read-only grid of one-time backup codes with copy + download actions. */
const BackupCodesList: React.FC<BackupCodesListProps> = ({ codes }) => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const isDark = theme.palette.mode === "dark";

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — download still works */
    }
  };

  const download = () => {
    const body = `Dynopay two-factor backup codes\n${new Date().toISOString().slice(0, 10)}\n\n${codes.join("\n")}\n\nEach code can be used once.`;
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dynopay-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box data-testid="twofa-backup-codes">
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px 14px",
          p: "12px 14px",
          borderRadius: "10px",
          border: `1px solid ${theme.palette.border.main}`,
          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FAFAFC",
        }}
      >
        {codes.map((c) => (
          <Typography
            key={c}
            data-testid="twofa-backup-code"
            sx={{ fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace", fontSize: "13.5px", letterSpacing: "0.06em", color: theme.palette.text.primary, fontVariantNumeric: "tabular-nums" }}
          >
            {c}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: "8px", mt: "10px", flexWrap: "wrap" }}>
        <Button
          size="small"
          variant="outlined"
          onClick={copyAll}
          data-testid="twofa-copy-codes"
          startIcon={copied ? <CheckRounded sx={{ fontSize: 16 }} /> : <ContentCopyRounded sx={{ fontSize: 16 }} />}
          sx={{ textTransform: "none", fontSize: "12.5px", borderRadius: "8px", fontFamily: "var(--font-sans)" }}
        >
          {copied ? t("twoFactor.copied", { defaultValue: "Copied" }) : t("twoFactor.copyCodes", { defaultValue: "Copy codes" })}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={download}
          data-testid="twofa-download-codes"
          startIcon={<DownloadRounded sx={{ fontSize: 16 }} />}
          sx={{ textTransform: "none", fontSize: "12.5px", borderRadius: "8px", fontFamily: "var(--font-sans)" }}
        >
          {t("twoFactor.downloadCodes", { defaultValue: "Download .txt" })}
        </Button>
      </Box>
    </Box>
  );
};

export default BackupCodesList;
