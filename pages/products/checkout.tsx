import React, { memo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import {
  EyebrowV8,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GradientText,
  GRID_BG,
  PANEL,
  PANEL_GLOW,
  PrimaryBtn,
  SecondaryBtn,
  Reveal,
  SectionV8,
  SectionHeadV8,
  goStart,
  useConsole,
} from "@/Components/Page/Home/v8/kit";
import CheckoutCard from "@/Components/Page/Home/v8/CheckoutCard";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";

/**
 * /products/checkout — flagship product page for DynoPay's Hosted Checkout,
 * built on the v8 marketing system. The deep-dive template the rest of the
 * product pages will follow in Phase 3.
 */

const FEATURES = [
  { icon: "mdi:bitcoin", title: "40+ coins, 8 chains", body: "Customers pay with Bitcoin, Ethereum, USDT, USDC and more — on whichever chain is cheapest for them." },
  { icon: "mdi:swap-horizontal-bold", title: "Auto-convert on settle", body: "Lock in value instantly: convert incoming crypto to a stablecoin the moment a payment lands." },
  { icon: "mdi:flash", title: "Real-time confirmation", body: "Watch payments move from waiting to confirmed on-chain — no manual reconciliation." },
  { icon: "mdi:cellphone", title: "Mobile-first & fast", body: "A responsive, conversion-optimised page that loads instantly and works in every wallet." },
  { icon: "mdi:translate", title: "Localised & branded", body: "Your logo, your colours, 20+ languages and local number formats out of the box." },
  { icon: "mdi:shield-check-outline", title: "Non-custodial & safe", body: "Funds settle straight to you — you hold the keys. No chargebacks, ever." },
];

const EMBEDS = [
  { icon: "mdi:link-variant", title: "Payment link", body: "Share a link in seconds — no site needed." },
  { icon: "mdi:cursor-default-click-outline", title: "Buy button", body: "Drop a button on any page with one snippet." },
  { icon: "mdi:code-tags", title: "REST API", body: "Create sessions programmatically and listen for webhooks." },
];

const CheckoutProductPage: React.FC = () => {
  const s = useConsole();
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Hosted Checkout — accept crypto that converts | DynoPay</title>
        <meta
          name="description"
          content="A drop-in crypto checkout that takes 40+ coins across 8 chains, auto-converts to stablecoins, confirms in real time and settles non-custodially to you."
        />
        <link rel="canonical" href="https://dynopay.com/products/checkout" />
      </Head>

      <Box sx={{ width: "100%", background: s.canvas }}>
        {/* ===== SPLIT HERO ===== */}
        <Box component="section" data-testid="checkout-hero" sx={{ position: "relative", background: s.canvas, overflow: "hidden", pt: { xs: 6, md: 9 }, pb: { xs: 8, md: 12 } }}>
          <Box aria-hidden sx={{ position: "absolute", top: -140, right: -120, width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,209,0,0.14), transparent 62%)", pointerEvents: "none" }} />
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              maxWidth: 1200,
              mx: "auto",
              px: { xs: 3, md: 6 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1fr) minmax(0,1fr)" },
              gap: { xs: 7, lg: 8 },
              alignItems: "center",
            }}
          >
            <Box sx={{ maxWidth: 560 }}>
              <EyebrowV8 sx={{ mb: 2.5 }}>Hosted Checkout</EyebrowV8>
              <Typography component="h1" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "clamp(36px, 5vw, 60px)", lineHeight: 1.03, letterSpacing: "-0.03em", color: s.ink }}>
                A checkout that turns crypto into <GradientText>revenue.</GradientText>
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16.5, md: 19 }, lineHeight: 1.62, mt: 3, maxWidth: 500 }}>
                Drop in a hosted page that takes 40+ coins, shows live rates, confirms on-chain in real time, and settles straight to your wallet — no code required.
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 4.5 }}>
                <PrimaryBtn data-testid="checkout-hero-start" onClick={() => goStart(router, "checkout_hero")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
                  Start free
                </PrimaryBtn>
                <SecondaryBtn data-testid="checkout-hero-demo" href="/pay/demo" startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 20 }} />} sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
                  See live demo
                </SecondaryBtn>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mt: 4 }}>
                {["No code", "No chargebacks", "Non-custodial"].map((x) => (
                  <Box key={x} sx={{ display: "inline-flex", alignItems: "center", gap: 0.8 }}>
                    <Icon icon="mdi:check-circle" width={16} height={16} color={s.accent} />
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.ink2 }}>{x}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* mockup plinth */}
            <Box sx={{ position: "relative", display: "flex", justifyContent: "center" }}>
              <Box aria-hidden sx={{ position: "absolute", inset: "-8% -4%", borderRadius: "28px", background: PANEL_GLOW, pointerEvents: "none" }} />
              <Box sx={{ position: "relative", width: "100%", maxWidth: 500, borderRadius: "28px", p: { xs: 2.5, md: 4 }, background: "linear-gradient(170deg, #171715 0%, #0B0B0A 100%)", border: `1px solid ${PANEL.lineStrong}`, boxShadow: "0 50px 120px -30px rgba(0,0,0,0.6)" }}>
                <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRID_BG, backgroundSize: "26px 26px", maskImage: "radial-gradient(70% 70% at 50% 40%, #000 20%, transparent 75%)", WebkitMaskImage: "radial-gradient(70% 70% at 50% 40%, #000 20%, transparent 75%)", opacity: 0.7 }} />
                <Box sx={{ position: "relative", display: "flex", justifyContent: "center" }}>
                  <CheckoutCard />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ===== FEATURES ===== */}
        <SectionV8 testId="checkout-features" sx={{ background: s.surface }}>
          <SectionHeadV8
            center
            eyebrow="Everything built in"
            title="Conversion-grade by default"
            lead="Every detail that makes a crypto payment feel effortless — handled for you, out of the box."
            maxWidth={720}
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2.5, md: 3 } }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.08}>
                <Box sx={{ height: "100%", p: { xs: 3, md: 3.5 }, borderRadius: "18px", border: `1px solid ${s.line}`, background: s.canvas }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: "12px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent, mb: 2.5 }}>
                    <Icon icon={f.icon} width={24} height={24} />
                  </Box>
                  <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 18, md: 19.5 }, letterSpacing: "-0.01em", color: s.ink, mb: 1.25 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: s.ink2 }}>{f.body}</Typography>
                </Box>
              </Reveal>
            ))}
          </Box>
        </SectionV8>

        {/* ===== CONVERSION BAND (dark) ===== */}
        <Box component="section" data-testid="checkout-stats" sx={{ position: "relative", background: PANEL.bg, color: PANEL.ink, overflow: "hidden", py: { xs: 7, md: 10 } }}>
          <Box aria-hidden sx={{ position: "absolute", inset: 0, background: PANEL_GLOW, opacity: 0.6, pointerEvents: "none" }} />
          <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1000, mx: "auto", px: { xs: 3, md: 6 }, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: { xs: 4, md: 2 }, textAlign: "center" }}>
            {[
              { v: "40+", l: "coins accepted" },
              { v: "< 2 min", l: "median settle time" },
              { v: "0", l: "chargebacks, ever" },
            ].map((x, i) => (
              <Box key={x.l} sx={{ px: { md: 2 }, borderLeft: { md: i === 0 ? "none" : `1px solid ${PANEL.line}` } }}>
                <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 34, md: 48 }, lineHeight: 1, letterSpacing: "-0.03em", color: PANEL.gold }}>{x.v}</Typography>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: PANEL.ink3, mt: 1.5 }}>{x.l}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ===== WAYS TO EMBED ===== */}
        <SectionV8 testId="checkout-embeds">
          <SectionHeadV8
            center
            eyebrow="Add it anywhere"
            title="Three ways to drop it in"
            lead="From zero-code links to a full REST API — ship the checkout the way that fits your stack."
            maxWidth={720}
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2.5, md: 3 }, mb: 5 }}>
            {EMBEDS.map((e, i) => (
              <Reveal key={e.title} delay={i * 0.08}>
                <Box sx={{ height: "100%", p: { xs: 3, md: 3.5 }, borderRadius: "18px", border: `1px solid ${s.line}`, background: s.surface, display: "flex", flexDirection: "column", gap: 1.25 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent }}>
                      <Icon icon={e.icon} width={20} height={20} />
                    </Box>
                    <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: s.ink }}>{e.title}</Typography>
                  </Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2 }}>{e.body}</Typography>
                </Box>
              </Reveal>
            ))}
          </Box>

          {/* code snippet (dark terminal) */}
          <Reveal>
            <Box sx={{ maxWidth: 760, mx: "auto", borderRadius: "16px", overflow: "hidden", border: `1px solid ${PANEL.lineStrong}`, background: "#0E0E0D", boxShadow: "0 30px 70px -30px rgba(0,0,0,0.5)" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.3, borderBottom: `1px solid ${PANEL.line}` }}>
                <Box sx={{ display: "flex", gap: 0.7 }}>
                  {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                    <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
                  ))}
                </Box>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3, ml: 1 }}>embed.html</Typography>
              </Box>
              <Box component="pre" sx={{ m: 0, p: { xs: 2, md: 3 }, overflowX: "auto", fontFamily: FONT_MONO, fontSize: { xs: 11.5, md: 13 }, lineHeight: 1.7, color: PANEL.ink2 }}>
                <Box component="code" sx={{ whiteSpace: "pre" }}>
{`<script src="https://js.dynopay.com/v1.js"></script>
`}
                  <Box component="span" sx={{ color: PANEL.ink3 }}>{`<!-- one button, any page -->`}</Box>
{`
<button
  data-dyno-amount=`}<Box component="span" sx={{ color: PANEL.gold }}>{`"79.00"`}</Box>{`
  data-dyno-currency=`}<Box component="span" sx={{ color: PANEL.gold }}>{`"USD"`}</Box>{`
  data-dyno-settle=`}<Box component="span" sx={{ color: PANEL.gold }}>{`"USDC"`}</Box>{`>
  Pay with crypto
</button>`}
                </Box>
              </Box>
            </Box>
          </Reveal>
        </SectionV8>

        <CtaBandV8
          testId="checkout-final-cta"
          badge="Live demo · no sign-up needed"
          title="Give your customers a checkout they'll"
          highlight="actually finish."
          body="Spin up your hosted checkout in minutes and take your first crypto payment today — on us."
          primaryLabel="Start free"
          primaryRef="checkout_final"
          secondaryLabel="See pricing"
          secondaryHref="/fees"
        />
      </Box>
    </>
  );
};

export default memo(CheckoutProductPage);
