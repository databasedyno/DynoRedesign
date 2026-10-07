import React, { memo, useCallback, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { EyebrowV8, FONT_BODY, FONT_DISPLAY, FONT_MONO, PANEL, PANEL_GLOW, PrimaryBtn, Reveal, goStart } from "./kit";

/* ============================================================================
 * DeviceShowcaseV8 — "Works on every device" (replaces the old app-store
 * section: there is no native app, and we say so). A desktop browser mock of
 * the real dashboard, with the mobile-web view overlapping its corner. Mocks
 * are drawn at a fixed design width and scaled to the container, so they stay
 * crisp and never overflow.
 * ========================================================================== */

const DESIGN_W = 640;
const DESIGN_H = 420;

const useScaleToFit = (designWidth: number) => {
  const [scale, setScale] = useState(1);
  const ro = useRef<ResizeObserver | null>(null);
  // Callback ref: Reveal swaps its wrapper element after mount, so re-attach on every node change.
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      ro.current?.disconnect();
      ro.current = null;
      if (!el) return;
      const update = () => {
        const w = el.clientWidth;
        if (w > 0) setScale(Math.min(1, w / designWidth));
      };
      update();
      ro.current = new ResizeObserver(update);
      ro.current.observe(el);
    },
    [designWidth],
  );
  return { ref, scale };
};

const NAV = [
  { icon: "mdi:view-dashboard-outline", label: "Dashboard", active: true },
  { icon: "mdi:swap-vertical", label: "Transactions" },
  { icon: "mdi:link-variant", label: "Pay links" },
  { icon: "mdi:wallet-outline", label: "Balances & Settlement" },
  { icon: "mdi:receipt-text-outline", label: "Receipts & Tax" },
  { icon: "mdi:account-group-outline", label: "Customers" },
  { icon: "mdi:code-tags", label: "Developers" },
];

const BARS = [38, 52, 44, 61, 58, 72, 66, 80, 74, 88, 82, 95, 90, 100];

const ROWS = [
  { who: "Order #4821", asset: "usdt", amt: "+$129.00", when: "2 min ago" },
  { who: "Pay link · Pro plan", asset: "btc", amt: "+$49.00", when: "18 min ago" },
  { who: "Invoice #118", asset: "usdc", amt: "+$790.00", when: "1 h ago" },
  { who: "Donation · Keza", asset: "eth", amt: "+$25.00", when: "3 h ago" },
];

const DesktopMock: React.FC = () => (
  <Box data-testid="device-desktop-mock" sx={{ width: DESIGN_W, height: DESIGN_H, borderRadius: "16px", border: `1px solid ${PANEL.lineStrong}`, background: "#0E0E0D", boxShadow: "0 50px 120px -40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.75, py: 1.1, borderBottom: `1px solid ${PANEL.line}`, background: "#121210" }}>
      <Box sx={{ display: "flex", gap: 0.7 }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <Box key={c} sx={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
      </Box>
      <Box sx={{ flex: 1, mx: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.7, py: 0.4, borderRadius: 6, background: PANEL.surface }}>
        <Icon icon="mdi:lock" width={10} height={10} color={PANEL.ink3} />
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, color: PANEL.ink3 }}>dynopay.com/dashboard</Typography>
      </Box>
    </Box>
    <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: "168px 1fr", minHeight: 0 }}>
      <Box sx={{ borderRight: `1px solid ${PANEL.line}`, p: 1.5, display: "flex", flexDirection: "column", gap: 0.4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, px: 1, pb: 1.5 }}>
          <Box sx={{ width: 18, height: 18, borderRadius: "6px", background: PANEL.gold, display: "grid", placeItems: "center" }}>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 800, color: "#0B0B0A" }}>D</Typography>
          </Box>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 700, color: PANEL.ink }}>Dynopay</Typography>
        </Box>
        {NAV.map((n) => (
          <Box key={n.label} sx={{ display: "flex", alignItems: "center", gap: 0.9, px: 1, py: 0.65, borderRadius: "8px", background: n.active ? PANEL.surfaceStrong : "transparent" }}>
            <Icon icon={n.icon} width={13} height={13} color={n.active ? PANEL.gold : PANEL.ink3} />
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: n.active ? 700 : 500, color: n.active ? PANEL.ink : PANEL.ink2, whiteSpace: "nowrap" }}>{n.label}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Box>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: PANEL.ink3 }}>Settled · this month</Typography>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: PANEL.ink, lineHeight: 1.1, mt: 0.3 }}>$12,480.40</Typography>
          </Box>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.35, borderRadius: 999, background: PANEL.greenSoft }}>
            <Icon icon="mdi:arrow-up" width={11} height={11} color={PANEL.green} />
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: PANEL.green }}>+8.4%</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.6, height: 70, px: 0.5 }}>
          {BARS.map((h, i) => (
            <Box key={i} sx={{ flex: 1, height: `${h}%`, borderRadius: "3px 3px 0 0", background: i === BARS.length - 1 ? PANEL.gold : "rgba(255,255,255,0.14)" }} />
          ))}
        </Box>
        <Box sx={{ borderTop: `1px solid ${PANEL.line}`, pt: 1.25, display: "grid", gap: 0.6 }}>
          {ROWS.map((r) => (
            <Box key={r.who} sx={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 1.5, px: 1, py: 0.7, borderRadius: "8px", background: PANEL.surface }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, minWidth: 0 }}>
                <Icon icon={`cryptocurrency-color:${r.asset}`} width={16} height={16} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 11, color: PANEL.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.who}</Typography>
              </Box>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PANEL.ink3, whiteSpace: "nowrap" }}>{r.when}</Typography>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: PANEL.green, whiteSpace: "nowrap" }}>{r.amt}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  </Box>
);

const PhoneMock: React.FC = () => (
  <Box data-testid="device-phone-mock" sx={{ width: 190, borderRadius: "28px", p: "8px", background: "linear-gradient(170deg, #26261F 0%, #0B0B0A 60%)", border: `1px solid ${PANEL.lineStrong}`, boxShadow: "0 40px 90px -30px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
    <Box sx={{ borderRadius: "21px", background: "#0E0E0D", overflow: "hidden", position: "relative" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, py: 0.9, borderBottom: `1px solid ${PANEL.line}` }}>
        <Icon icon="mdi:lock" width={9} height={9} color={PANEL.ink3} />
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 8.5, color: PANEL.ink3 }}>dynopay.com</Typography>
      </Box>
      {/* push-style alert — the phone's job is notifications on the go */}
      <Box sx={{ mx: 1, mt: 1, p: 1.1, borderRadius: "12px", background: "rgba(255,255,255,0.08)", border: `1px solid ${PANEL.lineStrong}`, backdropFilter: "blur(6px)", display: "flex", gap: 0.9, alignItems: "flex-start" }}>
        <Box sx={{ width: 22, height: 22, borderRadius: "6px", background: PANEL.gold, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 800, color: "#0B0B0A" }}>D</Typography>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 0.5 }}>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 9.5, fontWeight: 700, color: PANEL.ink }}>Payment settled</Typography>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 8, color: PANEL.ink3 }}>now</Typography>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 9, color: PANEL.ink2, lineHeight: 1.35, mt: 0.2 }}>+$129.00 in USDT from Order #4821 landed in your wallet.</Typography>
        </Box>
      </Box>
      <Box sx={{ p: 1.5, pt: 1.75 }}>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: PANEL.ink3 }}>Today</Typography>
        <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: PANEL.ink, mt: 0.3 }}>$1,034.00</Typography>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 8.5, color: PANEL.green, mt: 0.2 }}>4 payments · 0 pending</Typography>
        <Box sx={{ display: "flex", gap: 0.6, mt: 1.5 }}>
          {[{ i: "mdi:plus", l: "New link" }, { i: "mdi:swap-horizontal", l: "Convert" }, { i: "mdi:receipt-text-outline", l: "Receipt" }].map((b) => (
            <Box key={b.l} sx={{ flex: 1, textAlign: "center", py: 0.8, borderRadius: "9px", background: PANEL.surface, border: `1px solid ${PANEL.line}` }}>
              <Icon icon={b.i} width={13} height={13} color={PANEL.gold} />
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 8, color: PANEL.ink2, mt: 0.2, whiteSpace: "nowrap" }}>{b.l}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  </Box>
);

const DeviceShowcaseV8: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const { ref, scale } = useScaleToFit(DESIGN_W);
  const bullets = [
    { icon: "mdi:bell-ring-outline", text: t("v8.device.b1", { defaultValue: "Real-time payment alerts and receipts" }) },
    { icon: "mdi:swap-horizontal", text: t("v8.device.b2", { defaultValue: "Manage settlement and auto-convert from your phone" }) },
    { icon: "mdi:code-tags", text: t("v8.device.b3", { defaultValue: "Embeddable buy button and widget for any site" }) },
  ];

  return (
    <Box component="section" data-testid="device-showcase" sx={{ position: "relative", background: PANEL.bg, color: PANEL.ink, overflow: "hidden", py: { xs: 9, md: 13 }, borderTop: `1px solid ${PANEL.line}` }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, background: PANEL_GLOW, opacity: 0.5, pointerEvents: "none" }} />
      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1240, mx: "auto", px: { xs: 3, md: 6 }, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.85fr) minmax(0, 1.15fr)" }, gap: { xs: 6, lg: 8 }, alignItems: "center" }}>
        <Reveal>
          <EyebrowV8 dark sx={{ mb: 2.5 }}>{t("v8.device.eyebrow", { defaultValue: "Works on every device" })}</EyebrowV8>
          <Typography component="h2" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 30, md: 44 }, lineHeight: 1.08, letterSpacing: "-0.028em", color: PANEL.ink }}>
            {t("v8.device.title", { defaultValue: "Your dashboard, wherever you are" })}
          </Typography>
          <Typography sx={{ fontFamily: FONT_BODY, color: PANEL.ink2, fontSize: { xs: 16, md: 18 }, lineHeight: 1.65, mt: 2.5, maxWidth: 480 }}>
            {t("v8.device.lead", { defaultValue: "No app to install. The full Dynopay dashboard runs in any browser — desktop, tablet or phone — with the same live data everywhere." })}
          </Typography>
          <Box sx={{ display: "grid", gap: 1.5, mt: 3.5 }}>
            {bullets.map((b) => (
              <Box key={b.text} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: "10px", background: PANEL.goldSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon icon={b.icon} width={16} height={16} color={PANEL.gold} />
                </Box>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, color: PANEL.ink }}>{b.text}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 4.5 }}>
            <PrimaryBtn data-testid="device-cta-dashboard" onClick={() => goStart(router, "device")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
              {t("v8.device.primary", { defaultValue: "Open the dashboard" })}
            </PrimaryBtn>
            <Box component="a" href="/pay/demo" data-testid="device-cta-demo" sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 3, py: 1.25, borderRadius: "999px", border: `1px solid ${PANEL.lineStrong}`, color: PANEL.ink, textDecoration: "none", fontFamily: FONT_BODY, fontWeight: 600, fontSize: 15, transition: "background-color 160ms ease, border-color 160ms ease", "&:hover": { background: "rgba(255,255,255,0.05)", borderColor: PANEL.ink3 } }}>
              {t("v8.device.secondary", { defaultValue: "Try the demo checkout" })}
            </Box>
          </Box>
        </Reveal>

        <Reveal delay={0.1}>
          <Box ref={ref} sx={{ position: "relative", width: "100%", pb: { xs: 0, sm: 6 } }}>
            <Box sx={{ height: DESIGN_H * scale, position: "relative" }}>
              <Box sx={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <DesktopMock />
              </Box>
            </Box>
            <Box sx={{ display: { xs: "none", sm: "block" }, position: "absolute", right: { sm: -8, md: -16 }, bottom: 0, transform: `scale(${Math.max(0.78, scale)})`, transformOrigin: "bottom right" }}>
              <PhoneMock />
            </Box>
          </Box>
        </Reveal>
      </Box>
    </Box>
  );
};

export default memo(DeviceShowcaseV8);
