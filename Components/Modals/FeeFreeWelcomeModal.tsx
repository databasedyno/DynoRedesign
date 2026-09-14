import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import { useFeeFreeStatus } from "@/hooks/useFeeFreeStatus";
import PopupModal from "@/Components/UI/PopupModal";
import CustomButton from "@/Components/UI/Buttons";

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

const CONFETTI_COLORS = ["#3FD98A", "#050505", "#A3E635", "#22C55E", "#FDE047"];

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
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(500);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  // Shared, deduped fee-free status (collapses this + FeeFreeBanner +
  // FeeFreeWidget into a single /company/fee-free-status request per page).
  const { data: ffData } = useFeeFreeStatus();
  // Merchants who already made a link (e.g. straight out of the wizard) get "share" instead of "create".
  const hasLink = useSelector((s: any) => Array.isArray(s?.paymentLinkReducer?.paymentLinks) && s.paymentLinkReducer.paymentLinks.length > 0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ffData) return;
    // Never interrupt the guided first-run wizard — the celebration waits for the dashboard.
    if (router.pathname.startsWith("/get-started")) return;

    // Derive a RELOAD-STABLE identity from the JWT in localStorage.
    // (Redux userState.email is empty right after a reload — using it caused
    // the dismiss flag to be written under a different key than it was read.)
    let identity: string | null = null;
    try {
      const token = localStorage.getItem("token");
      if (!token) return; // not logged in — never show
      const payloadB64 = token.split(".")[1] || "";
      const json = JSON.parse(
        atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
      );
      identity = json?.email || (json?.user_id != null ? `uid:${json.user_id}` : null);
    } catch {
      return;
    }
    if (!identity) return;

    const key = `ff_welcome_shown:${identity}`;
    try {
      if (localStorage.getItem(key)) return; // already shown once
    } catch {
      return;
    }

    if (ffData.is_fee_free && Number(ffData.fee_free_remaining_usd) > 0) {
      // Mark as shown IMMEDIATELY — "once" semantics survive reloads
      // even if the user never clicks a button.
      try {
        localStorage.setItem(key, String(Date.now()));
      } catch {
        /* ignore */
      }
      setStorageKey(key);
      setRemaining(Number(ffData.fee_free_remaining_usd));
      setOpen(true);
    }
  }, [ffData, router.pathname]);

  const markShown = () => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const dismiss = () => {
    markShown();
    setOpen(false);
  };

  const goToCreateLink = () => {
    markShown();
    setOpen(false);
    router.push(hasLink ? "/pay-links" : "/create-pay-link");
  };

  // F5: Prevent stacking with the onboarding wizard (Create Company / Add
  // Wallet) or ANY other blocking Dialog. The previous implementation checked
  // only ONCE — the moment `open` flipped true — so if this celebration
  // modal's fee-free fetch resolved BEFORE the onboarding Dialog mounted, both
  // ended up stacked on screen. We now CONTINUOUSLY track whether another
  // Dialog is present and gate rendering on it, re-evaluating on every relevant
  // DOM mutation. The celebration is therefore always sequenced AFTER onboarding.
  const [otherDialogOpen, setOtherDialogOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasOther = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '.MuiDialog-root:not([aria-hidden="true"])'
        )
      ).some((n) => !n.querySelector('[data-testid="fee-free-welcome-modal"]'));
    const check = () => setOtherDialogOpen(hasOther());
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden"],
    });
    return () => obs.disconnect();
  }, []);

  // Belt-and-suspenders: even if `open` somehow got set true, refuse to render
  // when there's nothing left in the trial. Guards against any future code path
  // that flips `open` without re-checking the balance. Also hidden while any
  // other blocking Dialog is open (F5 — no stacked modals).
  if (!open || otherDialogOpen) return null;
  if (remaining <= 0) return null;

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
              border: "4px solid #3FD98A",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(63,217,138,0.35)",
            }}
          >
            <Typography
              component="span"
              sx={{
                color: "#3FD98A",
                fontWeight: 800,
                fontSize: 24,
                lineHeight: 1,
                letterSpacing: "1px",
                fontFamily: "var(--font-sans), Urbanist, sans-serif",
              }}
            >
              FREE
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
                fontFamily: "var(--font-sans), Urbanist, sans-serif",
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
            fontFamily: "var(--font-sans), Urbanist, sans-serif",
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
            fontFamily: "var(--font-sans), Urbanist, sans-serif",
            lineHeight: 1.6,
            mb: 3,
          }}
        >
          {t("ffWelcomeBody", { amount: `$${Math.round(remaining)}` })}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
          <CustomButton
            data-testid="fee-free-welcome-cta"
            label={hasLink ? t("ffWelcomeCtaShare", { defaultValue: "Share your payment link" }) : t("ffWelcomeCta")}
            variant="primary"
            fullWidth
            onClick={goToCreateLink}
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
            fontFamily: "var(--font-sans), Urbanist, sans-serif",
          }}
        >
          {t("ffWelcomeFootnote")}
        </Typography>
      </Box>
    </PopupModal>
  );
};

export default FeeFreeWelcomeModal;
