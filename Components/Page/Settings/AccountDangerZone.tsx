import React, { useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { WarningAmberRounded } from "@mui/icons-material";
import { useSelector } from "react-redux";
import dynamic from "next/dynamic";
import CustomButton from "@/Components/UI/Buttons";
import useTokenData from "@/hooks/useTokenData";
import { rootReducer } from "@/utils/types";

const DeleteAccountModal = dynamic(() => import("@/Components/UI/DeleteAccountModal"), { ssr: false });

/**
 * "Danger zone" card in Settings → Profile. Lets a merchant schedule their whole
 * account for deletion (OTP-confirmed, 7-day recoverable — mirrors brand delete).
 */
const AccountDangerZone: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
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
          Delete account
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 13.5, lineHeight: 1.6, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", mb: 2, maxWidth: 560 }}>
        Permanently delete your Dynopay account and everything in it — all brands, wallets, payment links and
        history. You&apos;ll be signed out of every device and have <strong>7 days to restore it via support</strong>
        {" "}before it&apos;s gone for good.
      </Typography>
      <CustomButton
        label="Delete account"
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
