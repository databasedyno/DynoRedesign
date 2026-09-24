import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { GREEN, M, glossFrameSx, labelSx, monoSx, pillSx, screenSx, textSx } from "./shared";
import { COIN_META, NETWORK_META, fmtCoin, fmtUsd, usePrices, type MockPayment } from "./payments";
import { useCycle } from "./useCycle";
import { QrMock } from "./QrMock";
import { PaidToast } from "./PaidToast";

/* Mirrors the real checkout strip copy (landing.json → checkout.strip.*). */
const STEPS = [
  { pill: "WAITING", title: "Waiting for your payment", caption: "Send the exact amount below. Confirmation is automatic.", color: M.yellow },
  { pill: "CONFIRMING", title: "Broadcasting on-chain", caption: "We saw your transaction. Confirmations usually take under a minute.", color: M.yellow },
  { pill: "CONFIRMED", title: "Payment confirmed", caption: "The network confirmed it. Settlement is in progress.", color: GREEN },
  { pill: "SETTLED", title: "You're all set", caption: "Funds have cleared. A receipt is on its way.", color: GREEN },
] as const;
const DWELL = [3000, 2200, 1800, 4400] as const;
const TRACK = ["Waiting", "Detected", "Confirmed"] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const BrowserBar: React.FC<{ merchant: string }> = ({ merchant }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1, borderBottom: `1px solid ${M.line}`, background: M.panel }}>
    <Box sx={{ display: "flex", gap: 0.6 }}>
      {[0, 1, 2].map((i) => <Box key={i} sx={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.16)" }} />)}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.6, mx: "auto", maxWidth: 320, px: 1.5, py: 0.45, borderRadius: "6px", background: M.bg, border: `1px solid ${M.line}` }}>
      <LockRoundedIcon sx={{ fontSize: 11, color: M.ink3, flexShrink: 0 }} />
      <Typography data-testid="mock-url" sx={{ ...monoSx, fontSize: 11, color: M.ink2, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>checkout.dynopay.com/pay/{slug(merchant)}</Typography>
    </Box>
    <Box sx={{ width: 24, flexShrink: 0 }} />
  </Box>
);

const Field: React.FC<{ label: string; value: string; tint: string; testId: string }> = ({ label, value, tint, testId }) => (
  <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography sx={{ ...labelSx, mb: 0.6 }}>{label}</Typography>
    <Box data-testid={testId} sx={{ display: "flex", alignItems: "center", gap: 0.9, px: 1.25, py: 0.85, borderRadius: "8px", border: `1px solid ${M.lineStrong}`, background: M.panel }}>
      <Box sx={{ width: 16, height: 16, borderRadius: "50%", background: tint, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{value[0]}</Box>
      <Typography sx={{ ...textSx, fontSize: 13, fontWeight: 600, color: M.ink, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</Typography>
      <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: M.ink3 }} />
    </Box>
  </Box>
);

const Track: React.FC<{ step: number }> = ({ step }) => (
  <Box data-testid="mock-track" sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2.5 }}>
    {TRACK.map((t, i) => {
      const done = i < step || step >= 2;
      const active = !done && step === i;
      const color = done ? GREEN : active ? M.yellow : M.ink3;
      return (
        <React.Fragment key={t}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: "50%", display: "grid", placeItems: "center", background: done ? GREEN : "transparent", border: `1.5px solid ${color}`, boxShadow: active ? `0 0 10px ${M.yellow}99` : "none", transition: "background-color 300ms ease, border-color 300ms ease" }}>
              {done ? <CheckRoundedIcon sx={{ fontSize: 10, color: "#0F1013" }} /> : null}
            </Box>
            <Typography sx={{ ...monoSx, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: done || active ? M.ink : M.ink3 }}>{t}</Typography>
          </Box>
          {i < TRACK.length - 1 ? <Box sx={{ flex: 1, height: 1, background: done ? GREEN : M.lineStrong, transition: "background-color 300ms ease" }} /> : null}
        </React.Fragment>
      );
    })}
  </Box>
);

const PayPanel: React.FC<{ paid: boolean; coinAmount: string; network: string; compact?: boolean }> = ({ paid, coinAmount, network, compact }) => {
  const net = NETWORK_META[network as keyof typeof NETWORK_META];
  return (
    <Box sx={{ display: "flex", flexDirection: compact ? "row" : "column", alignItems: "center", justifyContent: "center", gap: compact ? 2 : 1.5, p: compact ? 1.75 : 2.5, borderRadius: "12px", background: M.panel, border: `1px solid ${M.line}`, minHeight: compact ? 0 : 200 }}>
      {paid ? (
        <Box data-testid="mock-paid" sx={{ width: compact ? 56 : 72, height: compact ? 56 : 72, borderRadius: "50%", display: "grid", placeItems: "center", background: `${GREEN}22`, border: `1.5px solid ${GREEN}`, boxShadow: `0 0 34px ${GREEN}55`, flexShrink: 0 }}>
          <CheckRoundedIcon sx={{ fontSize: compact ? 30 : 38, color: GREEN }} />
        </Box>
      ) : (
        <QrMock size={compact ? 64 : 104} />
      )}
      <Box sx={{ textAlign: compact ? "left" : "center", minWidth: 0 }}>
        <Typography sx={{ ...labelSx, mb: 0.5 }}>{paid ? "Received" : "Send exactly"}</Typography>
        <Typography data-testid="mock-coin-amount" sx={{ ...monoSx, fontSize: 17, fontWeight: 600, color: paid ? GREEN : M.ink, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{coinAmount}</Typography>
        <Typography sx={{ ...monoSx, fontSize: 10.5, color: M.ink3, mt: 0.5, whiteSpace: "nowrap" }}>{net.addr} · {net.label}</Typography>
      </Box>
    </Box>
  );
};

type Props = { payments: readonly MockPayment[]; compact?: boolean };

/** Hosted-checkout product mockup cycling Waiting → Confirming → Confirmed → Settled; rotates through `payments` each loop. */
const CheckoutMock: React.FC<Props> = ({ payments, compact }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { step, loops } = useCycle(ref, DWELL);
  const prices = usePrices();
  const [start, setStart] = useState(0);
  useEffect(() => setStart(Math.floor(Math.random() * payments.length)), [payments.length]);
  const payment = payments[(start + loops) % payments.length];
  const st = STEPS[step];
  const paid = step >= 2;
  const coinAmount = fmtCoin(payment, prices);
  const toast = useRef({ amount: coinAmount, meta: "" });
  if (paid) toast.current = { amount: `+${coinAmount}`, meta: `${payment.merchant} · settled to USD balance` };
  return (
    <Box ref={ref} data-testid="hero-checkout-mock" data-step={st.pill.toLowerCase()} data-merchant={payment.merchant} sx={{ position: "relative" }}>
      <Box sx={glossFrameSx}>
        <Box sx={screenSx}>
          <BrowserBar merchant={payment.merchant} />
          <Box sx={{ display: "grid", gridTemplateColumns: compact ? "1fr" : { xs: "1fr", sm: "1.3fr 1fr" }, gap: { xs: 2, sm: 2.5 }, p: { xs: 2, sm: compact ? 2.25 : 3 } }}>
            <Box sx={{ minWidth: 0 }}>
              <Box data-testid="mock-status" sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, p: 1.5, borderRadius: "10px", border: `1px solid ${st.color}33`, background: `${st.color}0D`, transition: "border-color 300ms ease, background-color 300ms ease" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={pillSx(st.color)}>{st.pill}</Box>
                  <Typography sx={{ ...textSx, fontSize: 14.5, fontWeight: 600, color: M.ink, mt: 0.9, lineHeight: 1.3 }}>{st.title}</Typography>
                  <Typography sx={{ ...textSx, fontSize: 12, color: M.ink2, mt: 0.4, lineHeight: 1.45 }}>{st.caption}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, mt: 2.5 }}>
                <Box sx={{ width: 18, height: 18, borderRadius: "5px", background: M.yellow, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: M.onYellow, flexShrink: 0 }}>{payment.merchant[0]}</Box>
                <Typography data-testid="mock-merchant" sx={{ ...labelSx, color: M.ink2 }}>{payment.merchant}</Typography>
              </Box>
              <Typography sx={{ ...textSx, fontSize: { xs: 20, sm: compact ? 20 : 23 }, fontWeight: 600, color: M.ink, letterSpacing: "-0.02em", mt: 1.25, lineHeight: 1.15 }}>Pay {payment.merchant}</Typography>
              <Typography sx={{ ...labelSx, mt: 1.75 }}>Total you pay</Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                <Typography data-testid="mock-usd-amount" sx={{ ...monoSx, fontSize: { xs: 28, sm: compact ? 28 : 32 }, fontWeight: 600, color: M.ink, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{fmtUsd(payment.usd)}</Typography>
                <Typography sx={{ ...monoSx, fontSize: 12, color: M.ink2 }}>USD</Typography>
              </Box>
              <Typography sx={{ ...labelSx, mt: 0.75 }}>Reference · {payment.ref}</Typography>
              <Box sx={{ display: "flex", gap: 1.5, mt: 2.25 }}>
                <Field label="Network" value={payment.network} tint={NETWORK_META[payment.network].tint} testId="mock-network" />
                <Field label="Currency" value={payment.coin} tint={COIN_META[payment.coin].tint} testId="mock-currency" />
              </Box>
              <Track step={step} />
            </Box>
            <PayPanel paid={paid} coinAmount={coinAmount} network={payment.network} compact={compact} />
          </Box>
        </Box>
      </Box>
      <PaidToast show={paid} amount={toast.current.amount} meta={toast.current.meta} />
    </Box>
  );
};

export default memo(CheckoutMock);
