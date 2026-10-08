import React, { memo, useRef, useState } from "react";
import { Box, InputBase, Typography } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { motion, useScroll, useTransform } from "framer-motion";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import GoogleIcon from "@/assets/Images/googleIcon.svg";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, GradientText, GRID_BG, PANEL, PANEL_GLOW, PrimaryBtn, goStart, useConsole } from "./kit";
import { useMotionOK } from "../motion/tokens";
import CheckoutCard from "./CheckoutCard";
import { FEE_FROM } from "./platformFacts";

/* ============================================================================
 * HeroV8 — Bybit-style hero. Left: flow ribbon → two-line headline → one-line
 * lead → sign-up block (email + Start free, Continue with Google) → trust ticks.
 * Right: the live hosted-checkout mock on a contained plinth (no floaters
 * crossing the border) with a live activity row underneath.
 * ========================================================================== */

const FLOW = [
  { icon: "mdi:qrcode-scan", label: "Accept" },
  { icon: "mdi:swap-horizontal", label: "Convert (optional)" },
  { icon: "mdi:wallet-outline", label: "Settle" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const FlowRibbon: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  return (
    <Box data-testid="hero-flow-ribbon" sx={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 1, md: 1.5 }, mb: 3 }}>
      {FLOW.map((f, i) => (
        <React.Fragment key={f.label}>
          {i > 0 ? <Box aria-hidden sx={{ width: 4, height: 4, borderRadius: "50%", background: s.ink3, opacity: 0.6 }} /> : null}
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.7 }}>
            <Icon icon={f.icon} width={15} height={15} color={s.accent} />
            {/* xs is tighter so "Accept · Convert (optional) · Settle" stays on one line on phones. */}
            <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: { xs: 11, sm: 12.5 }, fontWeight: 600, letterSpacing: { xs: "0.04em", sm: "0.08em" }, textTransform: "uppercase", color: s.ink2, whiteSpace: "nowrap" }}>
              {t(`v8.hero.flow.${i}`, { defaultValue: f.label })}
            </Typography>
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
};

const SignupBlock: React.FC = () => {
  const s = useConsole();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  const googleEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!v) return goStart(router, "hero");
    if (!EMAIL_RE.test(v)) return setError(true);
    void router.push(`/auth/register?ref=hero&autoSend=1&email=${encodeURIComponent(v.toLowerCase())}`);
  };

  return (
    <Box data-testid="hero-signup-container" sx={{ mt: 4.5, maxWidth: 560 }}>
      <Box
        component="form"
        onSubmit={submit}
        noValidate
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: "stretch",
          gap: 1,
          p: 0.75,
          borderRadius: { xs: "20px", sm: "999px" },
          border: `1px solid ${error ? "#DC2626" : s.lineStrong}`,
          background: s.surface,
          boxShadow: s.dark ? "none" : "0 18px 40px -24px rgba(0,0,0,0.25)",
          transition: "border-color 160ms ease, box-shadow 160ms ease",
          "&:focus-within": { borderColor: error ? "#DC2626" : s.accent, boxShadow: `0 0 0 4px ${s.accentSoft}` },
        }}
      >
        <InputBase
          inputProps={{ "data-testid": "hero-email-input", "aria-label": "Email", autoComplete: "email", inputMode: "email" }}
          type="email"
          value={email}
          // Warm the register chunk while they type → "Start free" lands on the code screen instantly.
          onFocus={() => { router.prefetch("/auth/register").catch(() => undefined); }}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(false);
          }}
          placeholder={t("v8.hero.emailPlaceholder", { defaultValue: "Enter your work email" })}
          startAdornment={<Icon icon="mdi:email-outline" width={18} height={18} color={s.ink3} style={{ marginRight: 10, flexShrink: 0 }} />}
          sx={{ flex: 1, px: 2, py: 0.5, fontFamily: FONT_BODY, fontSize: 15.5, color: s.ink, "& input::placeholder": { color: s.ink3, opacity: 1 } }}
        />
        <PrimaryBtn type="submit" data-testid="hero-primary-cta" endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ px: 3, py: 1.4, fontSize: 15.5, flexShrink: 0 }}>
          {t("v8.hero.primary", { defaultValue: "Start free" })}
        </PrimaryBtn>
      </Box>
      {error ? (
        <Typography data-testid="hero-email-error" role="alert" sx={{ fontFamily: FONT_BODY, fontSize: 13, color: "#DC2626", mt: 1, ml: 2 }}>
          {t("v8.hero.emailError", { defaultValue: "Please enter a valid email address." })}
        </Typography>
      ) : null}

      {googleEnabled ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2 }}>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: s.ink3, flexShrink: 0 }}>
            {t("v8.hero.or", { defaultValue: "or" })}
          </Typography>
          <Box
            component="a"
            href="/auth/register?ref=hero&provider=google"
            data-testid="hero-google-auth-btn"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1.2,
              px: 2,
              py: 1.1,
              borderRadius: "999px",
              border: `1px solid ${s.lineStrong}`,
              background: s.surface,
              color: s.ink,
              textDecoration: "none",
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 14.5,
              transition: "border-color 160ms ease, background-color 160ms ease, transform 160ms ease",
              "&:hover": { borderColor: s.ink3, background: s.dark ? "rgba(255,255,255,0.04)" : "#FFFFFF", transform: "translateY(-1px)" },
            }}
          >
            <Image src={GoogleIcon} alt="" width={18} height={18} draggable={false} />
            {t("v8.hero.google", { defaultValue: "Continue with Google" })}
          </Box>
        </Box>
      ) : null}

      <Box data-testid="hero-trust-ticks" sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1.5, md: 2.5 }, mt: 3 }}>
        {[
          t("v8.hero.trust.0", { defaultValue: "No credit card" }),
          t("v8.hero.trust.1", { fee: FEE_FROM, defaultValue: "Fees from {{fee}}" }),
          t("v8.hero.trust.2", { defaultValue: "Live in minutes" }),
        ].map((label) => (
          <Box key={label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.7 }}>
            <Icon icon="mdi:check-circle" width={15} height={15} color={s.accent} />
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.ink2 }}>{label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ActivityRow: React.FC = () => (
  <Box
    data-testid="hero-activity-row"
    sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1.25, px: 1.75, py: 1.1, borderRadius: "999px", background: "rgba(255,255,255,0.04)", border: `1px solid ${PANEL.line}` }}
  >
    <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: PANEL.greenSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon icon="mdi:check-bold" width={13} height={13} color={PANEL.green} />
    </Box>
    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, color: PANEL.ink, whiteSpace: "nowrap" }}>Payment settled</Typography>
    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PANEL.ink2, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      79.00 USDT · Tron · to TQn9Y…x7Ab
    </Typography>
    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PANEL.ink3, whiteSpace: "nowrap" }}>just now</Typography>
  </Box>
);

const HeroV8: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  const ok = useMotionOK();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yMock = useTransform(scrollYProgress, [0, 1], [0, -50]);

  return (
    <Box ref={ref} component="section" id="hero" data-testid="hero" sx={{ position: "relative", background: s.canvas, overflow: "hidden", pt: { xs: 6, md: 10 }, pb: { xs: 8, md: 12 }, borderBottom: `1px solid ${s.line}` }}>
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1240,
          mx: "auto",
          px: { xs: 3, md: 6 },
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.12fr) minmax(0,0.88fr)" },
          gap: { xs: 7, lg: 8 },
          alignItems: "center",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <FlowRibbon />
          <Typography
            component="h1"
            data-testid="hero-headline"
            sx={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: "clamp(36px, 3.8vw, 50px)", lineHeight: 1.05, letterSpacing: "-0.034em", color: s.ink }}
          >
            {t("v8.hero.h1", { defaultValue: "Accept crypto payments." })}
            <br />
            {t("v8.hero.h2a", { defaultValue: "Settle to " })}
            <GradientText>{t("v8.hero.h2b", { defaultValue: "your wallet." })}</GradientText>
          </Typography>
          <Typography data-testid="hero-subheadline" sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16.5, md: 18.5 }, lineHeight: 1.6, mt: 2.5, maxWidth: 560 }}>
            {/* Conversion is OPT-IN (tbl_company.auto_convert_enabled defaults to false) — copy must say so. */}
            {t("v8.hero.body", {
              defaultValue: "Non-custodial crypto payments for businesses and creators. Keep the coin you receive, or opt in to auto-convert.",
            })}
          </Typography>
          <SignupBlock />
        </Box>

        <Box data-testid="hero-mock-wrap" sx={{ position: "relative", minWidth: 0, display: "flex", justifyContent: "center" }}>
          <Box aria-hidden sx={{ position: "absolute", inset: "-6% -2%", borderRadius: "32px", background: PANEL_GLOW, filter: "blur(10px)", pointerEvents: "none" }} />
          <Box
            component={ok ? motion.div : "div"}
            style={ok ? { y: yMock } : undefined}
            data-testid="hero-checkout-mockup"
            sx={{
              position: "relative",
              width: "100%",
              maxWidth: 470,
              borderRadius: "28px",
              p: { xs: 2, md: 3 },
              background: "linear-gradient(170deg, #171715 0%, #0B0B0A 100%)",
              border: `1px solid ${PANEL.lineStrong}`,
              boxShadow: "0 50px 120px -30px rgba(0,0,0,0.55)",
              overflow: "hidden",
            }}
          >
            <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRID_BG, backgroundSize: "26px 26px", maskImage: "radial-gradient(70% 70% at 50% 35%, #000 20%, transparent 75%)", WebkitMaskImage: "radial-gradient(70% 70% at 50% 35%, #000 20%, transparent 75%)", opacity: 0.7 }} />
            <Box sx={{ position: "relative" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, px: 0.5 }}>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: PANEL.ink3 }}>Hosted checkout</Typography>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.7 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: PANEL.green }} />
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: PANEL.ink2 }}>Live preview</Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <CheckoutCard />
              </Box>
              <ActivityRow />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(HeroV8);
