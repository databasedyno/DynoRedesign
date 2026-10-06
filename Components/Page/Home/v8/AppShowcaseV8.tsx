import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import { EyebrowV8, FONT_BODY, FONT_DISPLAY, FONT_MONO, PANEL, Reveal } from "./kit";

/* ============================================================================
 * AppShowcaseV8 — device + widget mockups with a QR code and store badges.
 * Dark data panel: "take DynoPay anywhere". The phone renders a compact live
 * dashboard; a floating widget card shows the embeddable pay button.
 * ========================================================================== */

const StoreBadge: React.FC<{ icon: string; top: string; bottom: string }> = ({ icon, top, bottom }) => (
  <Box
    sx={{
      display: "inline-flex",
      alignItems: "center",
      gap: 1.2,
      px: 1.75,
      py: 1,
      borderRadius: "12px",
      border: `1px solid ${PANEL.lineStrong}`,
      background: "rgba(255,255,255,0.04)",
      cursor: "pointer",
      transition: "background-color 160ms ease, border-color 160ms ease",
      "&:hover": { background: "rgba(255,255,255,0.08)", borderColor: PANEL.ink3 },
    }}
  >
    <Icon icon={icon} width={24} height={24} color={PANEL.ink} />
    <Box sx={{ textAlign: "left" }}>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 9, color: PANEL.ink3, lineHeight: 1.1, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {top}
      </Typography>
      <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700, color: PANEL.ink, lineHeight: 1.2 }}>
        {bottom}
      </Typography>
    </Box>
  </Box>
);

const PhoneMock: React.FC = () => {
  const rows = [
    { name: "Order #4821", amt: "+$129.00", icon: "cryptocurrency-color:usdc" },
    { name: "Pay link · Juno", amt: "+0.014 ETH", icon: "cryptocurrency-color:eth" },
    { name: "Invoice #118", amt: "+$79.00", icon: "cryptocurrency-color:usdt" },
  ];
  return (
    <Box
      sx={{
        position: "relative",
        width: 262,
        height: 540,
        borderRadius: "40px",
        p: "12px",
        background: "linear-gradient(170deg, #26261F 0%, #0B0B0A 60%)",
        border: `1px solid ${PANEL.lineStrong}`,
        boxShadow: "0 50px 120px -30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* notch */}
      <Box sx={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", width: 92, height: 22, borderRadius: 999, background: "#000", zIndex: 2 }} />
      <Box sx={{ width: "100%", height: "100%", borderRadius: "30px", background: "#0E0E0D", overflow: "hidden", position: "relative" }}>
        <Box sx={{ p: 2.5, pt: 5 }}>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.1em", color: PANEL.ink3, textTransform: "uppercase" }}>
            Available balance
          </Typography>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, color: PANEL.ink, letterSpacing: "-0.02em", mt: 0.5 }}>
            $12,480
          </Typography>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
            <Icon icon="mdi:arrow-up" width={13} height={13} color={PANEL.green} />
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: PANEL.green }}>+8.4% this week</Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1, mt: 2.5 }}>
            {[
              { i: "mdi:plus", l: "Request" },
              { i: "mdi:send", l: "Payout" },
              { i: "mdi:swap-horizontal", l: "Convert" },
            ].map((b) => (
              <Box key={b.l} sx={{ flex: 1, textAlign: "center", py: 1.2, borderRadius: "12px", background: PANEL.surface, border: `1px solid ${PANEL.line}` }}>
                <Icon icon={b.i} width={18} height={18} color={PANEL.gold} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 9.5, color: PANEL.ink2, mt: 0.5 }}>{b.l}</Typography>
              </Box>
            ))}
          </Box>

          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.1em", color: PANEL.ink3, textTransform: "uppercase", mt: 3, mb: 1.2 }}>
            Recent
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {rows.map((r) => (
              <Box key={r.name} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1, px: 1.2, borderRadius: "10px", background: PANEL.surface }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Icon icon={r.icon} width={22} height={22} />
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 11.5, color: PANEL.ink2 }}>{r.name}</Typography>
                </Box>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: PANEL.green }}>{r.amt}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const AppShowcaseV8: React.FC = () => {
  const { t } = useTranslation("landing");
  const bullets = [
    t("v8.app.b1", { defaultValue: "Real-time payment alerts" }),
    t("v8.app.b2", { defaultValue: "Approve payouts on the go" }),
    t("v8.app.b3", { defaultValue: "Embeddable buy button & widget" }),
  ];

  return (
    <Box component="section" data-testid="app-showcase" sx={{ position: "relative", background: PANEL.bg, color: PANEL.ink, overflow: "hidden", py: { xs: 9, md: 13 } }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, background: "radial-gradient(50% 55% at 80% 30%, rgba(255,209,0,0.16), transparent 60%)", pointerEvents: "none" }} />
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 3, md: 6 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: { xs: 6, md: 8 },
          alignItems: "center",
        }}
      >
        {/* copy */}
        <Box>
          <EyebrowV8 dark sx={{ mb: 2.5 }}>{t("v8.app.eyebrow", { defaultValue: "DynoPay everywhere" })}</EyebrowV8>
          <Typography
            component="h2"
            sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: { xs: 30, md: 44 }, lineHeight: 1.08, letterSpacing: "-0.028em", color: PANEL.ink }}
          >
            {t("v8.app.title", { defaultValue: "Your crypto payments, in your pocket" })}
          </Typography>
          <Typography sx={{ fontFamily: FONT_BODY, color: PANEL.ink2, fontSize: { xs: 16, md: 18 }, lineHeight: 1.65, mt: 2.5, maxWidth: 440 }}>
            {t("v8.app.lead", { defaultValue: "Track settlements, approve payouts and drop a pay widget into any site — from desktop, mobile, or a few lines of code." })}
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 3.5 }}>
            {bullets.map((b) => (
              <Box key={b} sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                <Box sx={{ width: 22, height: 22, borderRadius: "50%", background: PANEL.goldSoft, display: "grid", placeItems: "center" }}>
                  <Icon icon="mdi:check" width={13} height={13} color={PANEL.gold} />
                </Box>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, color: PANEL.ink }}>{b}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mt: 4 }}>
            <StoreBadge icon="mdi:apple" top={t("v8.app.appleTop", { defaultValue: "Download on the" })} bottom="App Store" />
            <StoreBadge icon="mdi:google-play" top={t("v8.app.googleTop", { defaultValue: "Get it on" })} bottom="Google Play" />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, pl: { md: 1 } }}>
              <Box sx={{ p: 0.8, background: "#fff", borderRadius: "10px", lineHeight: 0 }}>
                <QRCodeSVG value="https://dynopay.com/get-started" size={56} bgColor="#FFFFFF" fgColor="#0B0B0A" level="M" />
              </Box>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3, maxWidth: 90, lineHeight: 1.4 }}>
                {t("v8.app.scan", { defaultValue: "Scan to get started" })}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* device */}
        <Reveal sx={{ position: "relative", display: "flex", justifyContent: "center" }}>
          <PhoneMock />
          {/* floating widget card */}
          <Box
            sx={{
              position: "absolute",
              bottom: { xs: 0, md: 40 },
              left: { xs: 0, md: -8 },
              width: 200,
              p: 2,
              borderRadius: "16px",
              background: "rgba(16,16,15,0.92)",
              border: `1px solid ${PANEL.lineStrong}`,
              backdropFilter: "blur(8px)",
              boxShadow: "0 24px 60px -18px rgba(0,0,0,0.7)",
            }}
          >
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.1em", color: PANEL.ink3, textTransform: "uppercase" }}>
              Embeddable widget
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, py: 1.1, mt: 1.2, borderRadius: "10px", background: PANEL.gold }}>
              <Icon icon="mdi:bitcoin" width={16} height={16} color="#0B0B0A" />
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 800, color: "#0B0B0A" }}>Pay with crypto</Typography>
            </Box>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PANEL.ink3, mt: 1.2, textAlign: "center" }}>{"<script src=\"dyno.js\">"}</Typography>
          </Box>
        </Reveal>
      </Box>
    </Box>
  );
};

export default memo(AppShowcaseV8);
