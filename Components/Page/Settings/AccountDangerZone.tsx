import React, { useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { WarningAmberRounded } from "@mui/icons-material";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import dynamic from "next/dynamic";
import { lazyLoading } from "@/Components/UI/DynamicFallback";
import CustomButton from "@/Components/UI/Buttons";
import useTokenData from "@/hooks/useTokenData";
import { rootReducer } from "@/utils/types";

const DeleteAccountModal = dynamic(() => import("@/Components/UI/DeleteAccountModal"), { ssr: false, loading: lazyLoading(null, { silent: true }) });

/**
 * "Danger zone" card in Settings → Profile. Lets a merchant delete their whole
 * account (email-confirmed + step-up 2FA). Soft delete: sessions revoked and the
 * account locked immediately; records are retained for compliance and only support
 * can restore. Mirrors the brand soft-delete pattern.
 */
const AccountDangerZone: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("profile");
  const tokenData = useTokenData();
  const profile = useSelector((state: rootReducer) => state.userReducer?.profile);
  const email = (profile?.email || (tokenData as { email?: string } | undefined)?.email || "").trim();
  const [open, setOpen] = useState(false);

  return (
    <Box
      data-testid="account-danger-zone"
      sx={{
        mt: 4,
        borderRadius: "14px",
        border: `1px solid ${isDark ? "rgba(239,68,68,0.35)" : "rgba(220,38,38,0.28)"}`,
        backgroundColor: isDark ? "rgba(239,68,68,0.06)" : "rgba(220,38,38,0.03)",
        p: { xs: 2, md: 2.5 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <WarningAmberRounded sx={{ color: theme.palette.error.main, fontSize: 20 }} />
        <Typography sx={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-sans)", color: theme.palette.error.main }}>
          {t("dangerZone.title")}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 13.5, lineHeight: 1.6, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", mb: 2, maxWidth: 560 }}>
        {t("dangerZone.body")}{" "}<strong>{t("dangerZone.bodyStrong")}</strong>.
      </Typography>
      <CustomButton
        label={t("dangerZone.button")}
        data-testid="open-delete-account-btn"
        variant="outlined"
        size="small"
        onClick={() => setOpen(true)}
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
      {open && <DeleteAccountModal open={open} onClose={() => setOpen(false)} email={email} />}
    </Box>
  );
};

export default AccountDangerZone;
