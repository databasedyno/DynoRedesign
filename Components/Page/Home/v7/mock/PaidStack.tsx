import React from "react";
import { Box } from "@mui/material";
import { keyframes } from "@emotion/react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { AMOUNT_USD, GREEN, M, MERCHANT } from "./shared";
import { NotifyCard } from "./PaidToast";

const drift = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
`;

/** Final CTA accent — the merchant's "paid → settled" notifications, floating beside the headline. */
export const PaidStack: React.FC = () => (
  <Box
    aria-hidden
    data-testid="final-cta-paid-stack"
    sx={{
      display: "flex",
      flexDirection: "column",
      gap: 1.5,
      transform: "rotate(-3deg)",
      "& > *": { animation: `${drift} 8s ease-in-out infinite` },
      "& > *:nth-of-type(2)": { animationDelay: "-3s", ml: 3 },
      "@media (prefers-reduced-motion: reduce)": { "& > *": { animation: "none" } },
    }}
  >
    <NotifyCard icon={<CheckRoundedIcon sx={{ fontSize: 22 }} />} accent={GREEN} title="Payment received" amount="+0.0021 BTC" meta={`${MERCHANT} · just now`} />
    <NotifyCard icon={<BoltRoundedIcon sx={{ fontSize: 22 }} />} accent={M.yellow} title="Settled to your wallet" amount={AMOUNT_USD} meta="Non-custodial · no chargebacks" />
  </Box>
);
