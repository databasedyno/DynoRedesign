import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import axiosBaseApi from "@/axiosConfig";
import PopupModal from "@/Components/UI/PopupModal";
import CustomButton from "@/Components/UI/Buttons";
import { rootReducer } from "@/utils/types";

/**
 * FeeFreeWelcomeModal — one-time celebratory popup shown on the dashboard the
 * moment a merchant is onboarded, making sure they KNOW their first $500 in
 * volume is fee-free.
 *
 * Show conditions (all must hold):
 *  - GET /api/company/fee-free-status → is_fee_free && fee_free_remaining_usd > 0
 *  - Not dismissed before on this browser (localStorage, keyed per user)
 *
 * Existing users whose allowance is used up (e.g. hostbay) never see it.
 */

const CONFETTI_COLORS = ["#CCFF00", "#050505", "#A3E635", "#84CC16", "#FDE047"];

const ConfettiBurst: React.FC = () => {
  // 18 deterministic-ish pieces, animated with CSS keyframes via framer-motion
  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        left: 6 + ((i * 53) % 88),
        delay: (i % 6) * 0.12,
        duration: 1.8 + ((i * 37) % 10) / 10,
        size: 6 + ((i * 29) % 7),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: ((i * 97) % 360),
        round: i % 3 === 0,
      })),
    [],
  );
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        borderRadius: "inherit",
      }}
    >
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: 340, opacity: [0, 1, 1, 0], rotate: p.rotate + 360 }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: 1.2,
            ease: "easeIn",
          }}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.8,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : 2,
            display: "inline-block",
          }}
        />
      ))}
    </Box>
  );
};

const FeeFreeWelcomeModal: React.FC = () => {
  const { t } = useTranslation("fees");
  const theme = useTheme();
  const router = useRouter();
  const userState = useSelector((state: rootReducer) => state.userReducer);
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(500);

  const storageKey = useMemo(() => {
    const who = userState?.email || "anon";
    return `ff_welcome_shown:${who}`;
  }, [userState?.email]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {
      return;
    }
    (async () => {
      try {
        const res = await axiosBaseApi.get("company/fee-free-status");
        const d = res?.data?.data;
        if (
          !cancelled &&
          d &&
          d.is_fee_free &&
          Number(d.fee_free_remaining_usd) > 0
        ) {
          setRemaining(Number(d.fee_free_remaining_usd));
          setOpen(true);
        }
      } catch {
        /* non-critical — never block the dashboard */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  const dark = theme.palette.mode === "dark";

  return (
    <PopupModal
      open={open}
      handleClose={dismiss}
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
        data-testid="fee-free-welcome-modal"
        sx={{
          position: "relative",
          textAlign: "center",
          px: { xs: 3, sm: 4.5 },
          pt: 5,
          pb: 4,
        }}
      >
        <ConfettiBurst />

        {/* Big amount badge */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
        >
          <Box
            sx={{
              width: 112,
              height: 112,
              mx: "auto",
              mb: 2.5,
              borderRadius: "50%",
              backgroundColor: "#050505",
              border: "4px solid #CCFF00",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(204,255,0,0.35)",
            }}
          >
            <Typography
              component="span"
              sx={{
                color: "#CCFF00",
                fontWeight: 800,
                fontSize: 28,
                lineHeight: 1,
                fontFamily: "UrbanistSemiBold, Urbanist, sans-serif",
              }}
            >
              ${Math.round(remaining)}
            </Typography>
            <Typography
              component="span"
              sx={{
                color: "#ffffff",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "1px",
                textTransform: "uppercase",
                mt: 0.5,
                fontFamily: "UrbanistMedium, Urbanist, sans-serif",
              }}
            >
              {t("ffWelcomeBadge")}
            </Typography>
          </Box>
        </motion.div>

        <Typography
          component="h2"
          sx={{
            fontSize: { xs: 20, sm: 23 },
            fontWeight: 800,
            fontFamily: "UrbanistSemiBold, Urbanist, sans-serif",
            color: theme.palette.text.primary,
            mb: 1.25,
            lineHeight: 1.25,
          }}
        >
          {t("ffWelcomeTitle")}
        </Typography>

        <Typography
          sx={{
            fontSize: 14.5,
            color: theme.palette.text.secondary,
            fontFamily: "UrbanistMedium, Urbanist, sans-serif",
            lineHeight: 1.6,
            mb: 3,
          }}
        >
          {t("ffWelcomeBody", { amount: `$${Math.round(remaining)}` })}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
          <CustomButton
            data-testid="fee-free-welcome-cta"
            label={t("ffWelcomeCta")}
            variant="primary"
            fullWidth
            onClick={() => {
              dismiss();
              router.push("/create-pay-link");
            }}
          />
          <CustomButton
            data-testid="fee-free-welcome-dismiss"
            label={t("ffWelcomeDismiss")}
            variant="outlined"
            fullWidth
            onClick={dismiss}
          />
        </Box>

        <Typography
          sx={{
            mt: 2,
            fontSize: 12,
            color: dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
            fontFamily: "UrbanistMedium, Urbanist, sans-serif",
          }}
        >
          {t("ffWelcomeFootnote")}
        </Typography>
      </Box>
    </PopupModal>
  );
};

export default FeeFreeWelcomeModal;
