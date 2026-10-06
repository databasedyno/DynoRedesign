import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import { FONT_BODY, FONT_MONO, FONT_DISPLAY, PANEL } from "./kit";

/* ============================================================================
 * CheckoutCard — a faithful render of DynoPay's hosted crypto checkout, drawn
 * in pure CSS (no screenshot) so it stays crisp at any size. Reused by the hero
 * panel and the app/widget showcase. Shows a real QR, the amount, network +
 * asset, and a live "waiting → detected → confirmed" status stepper.
 * ========================================================================== */

interface Props {
  merchant?: string;
  reference?: string;
  totalUsd?: string;
  asset?: string;
  amount?: string;
  network?: string;
  qrValue?: string;
  scale?: number;
}

const STEPS = ["Waiting", "Detected", "Confirmed"] as const;

const CheckoutCard: React.FC<Props> = ({
  merchant = "Metricly",
  reference = "SUB-2026-07",
  totalUsd = "$79.00",
  asset = "USDC",
  amount = "79.00",
  network = "Polygon",
  qrValue = "https://dynopay.com/pay/demo",
  scale = 1,
}) => {
  return (
    <Box
      data-testid="checkout-card"
      sx={{
        width: 380,
        maxWidth: "100%",
        transform: scale !== 1 ? `scale(${scale})` : "none",
        transformOrigin: "top center",
        borderRadius: "20px",
        border: `1px solid ${PANEL.lineStrong}`,
        background: "linear-gradient(180deg, #161614 0%, #0E0E0D 100%)",
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Browser chrome */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.4, borderBottom: `1px solid ${PANEL.line}` }}>
        <Box sx={{ display: "flex", gap: 0.7 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.9 }} />
          ))}
        </Box>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.7 }}>
          <Icon icon="mdi:lock" width={11} height={11} color={PANEL.ink3} />
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3 }}>
            checkout.dynopay.com/pay/{merchant.toLowerCase()}
          </Typography>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ p: 2.5, display: "grid", gridTemplateColumns: "1fr auto", gap: 2 }}>
        {/* Left — status + amount */}
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.8,
              px: 1,
              py: 0.4,
              borderRadius: "999px",
              background: PANEL.goldSoft,
              border: `1px solid rgba(255,209,0,0.35)`,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: PANEL.gold,
                animation: "dyno-pulse 1.6s ease-in-out infinite",
                "@keyframes dyno-pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.25 } },
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
              }}
            />
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: PANEL.gold, textTransform: "uppercase" }}>
              Waiting for payment
            </Typography>
          </Box>

          <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 20, height: 20, borderRadius: "6px", background: PANEL.gold, display: "grid", placeItems: "center" }}>
              <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 800, color: "#0B0B0A" }}>M</Typography>
            </Box>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, color: PANEL.ink }}>
              Pay {merchant}
            </Typography>
          </Box>

          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.12em", color: PANEL.ink3, textTransform: "uppercase", mt: 2 }}>
            Total you pay
          </Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6 }}>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, color: PANEL.ink, lineHeight: 1.1 }}>
              {totalUsd}
            </Typography>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3 }}>USD</Typography>
          </Box>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, color: PANEL.ink3, mt: 0.5 }}>
            REF · {reference}
          </Typography>

          <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
            {[
              { label: "Network", value: network, icon: "cryptocurrency-color:matic" },
              { label: "Asset", value: asset, icon: "cryptocurrency-color:usdc" },
            ].map((f) => (
              <Box key={f.label} sx={{ flex: 1, border: `1px solid ${PANEL.line}`, borderRadius: "10px", p: 1, background: PANEL.surface }}>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: "0.08em", color: PANEL.ink3, textTransform: "uppercase" }}>
                  {f.label}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mt: 0.4 }}>
                  <Icon icon={f.icon} width={14} height={14} />
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: PANEL.ink }}>{f.value}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Right — QR + send exactly */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
          <Box sx={{ p: 1, background: "#FFFFFF", borderRadius: "12px", lineHeight: 0 }}>
            <QRCodeSVG value={qrValue} size={92} bgColor="#FFFFFF" fgColor="#0B0B0A" level="M" />
          </Box>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: "0.1em", color: PANEL.ink3, textTransform: "uppercase", mt: 1.5 }}>
            Send exactly
          </Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: PANEL.gold }}>{amount}</Typography>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink2 }}>{asset}</Typography>
          </Box>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9, color: PANEL.ink3, mt: 0.3 }}>0x8b1d…07af</Typography>
        </Box>
      </Box>

      {/* Status stepper */}
      <Box sx={{ px: 2.5, pb: 2.2, pt: 0.5 }}>
        <Box sx={{ position: "relative", height: 3, borderRadius: 3, background: PANEL.surfaceStrong, overflow: "hidden" }}>
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "38%",
              borderRadius: 3,
              background: PANEL.gold,
              animation: "dyno-progress 2.6s ease-in-out infinite",
              "@keyframes dyno-progress": {
                "0%": { width: "12%" },
                "50%": { width: "48%" },
                "100%": { width: "12%" },
              },
              "@media (prefers-reduced-motion: reduce)": { animation: "none", width: "38%" },
            }}
          />
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.2 }}>
          {STEPS.map((step, i) => (
            <Box key={step} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i === 0 ? PANEL.gold : "transparent",
                  border: `1px solid ${i === 0 ? PANEL.gold : PANEL.lineStrong}`,
                }}
              />
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.06em", color: i === 0 ? PANEL.ink : PANEL.ink3, textTransform: "uppercase" }}>
                {step}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(CheckoutCard);
