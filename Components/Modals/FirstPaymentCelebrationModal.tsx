import React, { useEffect } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { CelebrationRounded } from "@mui/icons-material";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import PopupModal from "@/Components/UI/PopupModal";
import CustomButton from "@/Components/UI/Buttons";
import { brandFg } from "@/constants/theme";

/**
 * FirstPaymentCelebrationModal — a one-time, per-brand celebration shown on the
 * dashboard the moment a brand receives its VERY FIRST successful payment.
 *
 * Why this exists: the dashboard already fires a small confetti burst when a
 * NEW payment settles, but it deliberately skips the first-ever load (it needs
 * a previously-stored txn id to compare against) — so the single most important
 * milestone, the first payment, was silent. This modal fills that gap.
 *
 * The show/once/per-brand logic lives in the dashboard (v2026/index.tsx); this
 * component is purely presentational and fires a full-screen confetti burst on
 * open (honours prefers-reduced-motion via the shared fireConfetti helper).
 */
interface Props {
  open: boolean;
  onClose: () => void;
  onViewTransactions: () => void;
  companyName?: string | null;
  amountLabel?: string | null;
}

const FirstPaymentCelebrationModal: React.FC<Props> = ({
  open,
  onClose,
  onViewTransactions,
  companyName,
  amountLabel,
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");

  // Full-screen brand confetti burst on open (lazy — never in the SSR bundle).
  useEffect(() => {
    if (!open) return;
    void import("@/helpers/fireConfetti")
      .then((m) => m.default())
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const body = amountLabel
    ? t("firstPayment.bodyWithAmount", {
        defaultValue: "Your first payment of {{amount}} just landed. That's a real milestone — the hard part is done. Here's to many more.",
        amount: amountLabel,
      })
    : t("firstPayment.body", {
        defaultValue: "Your first payment just landed. That's a real milestone — the hard part is done. Here's to many more.",
      });

  return (
    <PopupModal
      open={open}
      handleClose={onClose}
      showHeader={false}
      hasFooter={false}
      transparent={true}
      sx={{
        "& .MuiDialog-paper": {
          width: "100%",
          maxWidth: "440px",
          borderRadius: "20px",
          overflow: "hidden",
        },
      }}
    >
      <Box
        data-testid="first-payment-celebration-modal"
        sx={{
          position: "relative",
          textAlign: "center",
          px: { xs: 3, sm: 4.5 },
          pt: 5,
          pb: 4,
        }}
      >
        {/* Celebration badge */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
        >
          <Box
            sx={{
              width: 104,
              height: 104,
              mx: "auto",
              mb: 2.5,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #5A6BEF 0%, #7C5CFF 55%, #4FD1FF 100%)",
              boxShadow: "0 0 44px rgba(124,92,255,0.45)",
            }}
          >
            <CelebrationRounded sx={{ color: "#fff", fontSize: 52 }} />
          </Box>
        </motion.div>

        <Typography
          component="p"
          sx={{
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: brandFg(dark),
            mb: 1,
            fontFamily: "var(--font-sans), Urbanist, sans-serif",
          }}
        >
          {companyName
            ? t("firstPayment.eyebrowNamed", { defaultValue: "{{name}} · Milestone", name: companyName })
            : t("firstPayment.eyebrow", { defaultValue: "Milestone unlocked" })}
        </Typography>

        <Typography
          component="h2"
          sx={{
            fontSize: { xs: 21, sm: 24 },
            fontWeight: 800,
            fontFamily: "var(--font-sans), Urbanist, sans-serif",
            color: theme.palette.text.primary,
            mb: 1.25,
            lineHeight: 1.25,
          }}
        >
          {t("firstPayment.title", { defaultValue: "You got your first payment! 🎉" })}
        </Typography>

        <Typography
          sx={{
            fontSize: 14.5,
            color: theme.palette.text.secondary,
            fontFamily: "var(--font-sans), Urbanist, sans-serif",
            lineHeight: 1.6,
            mb: 3,
          }}
        >
          {body}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
          <CustomButton
            data-testid="first-payment-view-transactions"
            label={t("firstPayment.cta", { defaultValue: "View transactions" })}
            variant="primary"
            fullWidth
            onClick={onViewTransactions}
          />
          <CustomButton
            data-testid="first-payment-dismiss"
            label={t("firstPayment.dismiss", { defaultValue: "Keep going" })}
            variant="outlined"
            fullWidth
            onClick={onClose}
          />
        </Box>

        <Typography
          sx={{
            mt: 2,
            fontSize: 12,
            color: dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
            fontFamily: "var(--font-sans), Urbanist, sans-serif",
          }}
        >
          {t("firstPayment.footnote", { defaultValue: "We'll email you a receipt for every payment you receive." })}
        </Typography>
      </Box>
    </PopupModal>
  );
};

export default FirstPaymentCelebrationModal;
