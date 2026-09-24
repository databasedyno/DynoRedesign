import React from "react";
import { Box, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { AMOUNT_COIN, GREEN, M, labelSx, monoSx, textSx } from "./shared";

type CardProps = { icon: React.ReactNode; accent: string; title: string; amount: string; meta: string; testId?: string };

/** Merchant-side notification card ("You got paid"). Always Bybit-black. */
export const NotifyCard: React.FC<CardProps> = ({ icon, accent, title, amount, meta, testId }) => (
  <Box
    data-testid={testId}
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      p: 1.5,
      pr: 2,
      borderRadius: "14px",
      background: "linear-gradient(180deg, #1D1E24 0%, #15161A 100%)",
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 60px -20px rgba(0,0,0,0.85)",
      width: 320,
      maxWidth: "100%",
    }}
  >
    <Box sx={{ width: 40, height: 40, borderRadius: "12px", flexShrink: 0, display: "grid", placeItems: "center", background: `${accent}22`, border: `1px solid ${accent}66`, color: accent }}>{icon}</Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ ...textSx, fontSize: 13.5, fontWeight: 600, color: M.ink, lineHeight: 1.3, whiteSpace: "nowrap" }}>{title}</Typography>
        <Typography sx={{ ...monoSx, fontSize: 13, fontWeight: 600, color: accent, whiteSpace: "nowrap" }}>{amount}</Typography>
      </Box>
      <Typography sx={{ ...labelSx, mt: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</Typography>
    </Box>
  </Box>
);

/** Slides in over the hero mock once the payment is confirmed. */
export const PaidToast: React.FC<{ show: boolean }> = ({ show }) => (
  <Box
    aria-hidden={!show}
    sx={{
      position: "absolute",
      zIndex: 2,
      top: { xs: "auto", md: -22 },
      bottom: { xs: -26, md: "auto" },
      right: { xs: 8, md: -28 },
      opacity: show ? 1 : 0,
      transform: show ? "translateY(0) scale(1)" : "translateY(14px) scale(0.96)",
      transition: "opacity 420ms cubic-bezier(0.16,1,0.3,1), transform 420ms cubic-bezier(0.16,1,0.3,1)",
      pointerEvents: "none",
      "@media (prefers-reduced-motion: reduce)": { transition: "none" },
    }}
  >
    <NotifyCard testId="mock-paid-toast" icon={<CheckRoundedIcon sx={{ fontSize: 22 }} />} accent={GREEN} title="Payment received" amount={`+${AMOUNT_COIN}`} meta="Settled to USD balance" />
  </Box>
);
