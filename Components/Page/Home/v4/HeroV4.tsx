import React, { memo, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import useLocalPrice from "@/hooks/useLocalPrice";
import { COIN_COLOR } from "@/helpers/assetColor";
import {
  BG0, BG1, BG2, BLUE, BLUE_BRIGHT, FONT_BODY, FONT_DISPLAY, FONT_MONO,
  GREEN, HEADLINE_GRADIENT, INK0, INK2, INK3, LINE, LINE2,
} from "./theme.v4";
import { DisplayXL, EyebrowV4, GhostBtnV4, LeadV4, PrimaryBtnV4, ShellV4, riseIn } from "./styled.v4";

const AMOUNTS = [29, 49, 84, 120, 250, 480];
const STORES = ["Nova Goods", "Atlas Supply", "Studio Ky", "Lumen Labs", "Peak Gear", "Bean & Co."];
const PAY_COINS = ["BTC", "ETH", "USDT", "USDC"] as const;

const HeroV4: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const { fmt } = useLocalPrice();
  const [idx, setIdx] = useState(0);
  const [coin, setCoin] = useState<string>("BTC");

  useEffect(() => {
    const mq = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq && mq.matches) return;
    const iv = setInterval(() => setIdx((i) => (i + 1) % AMOUNTS.length), 2600);
    return () => clearInterval(iv);
  }, []);

  const amount = AMOUNTS[idx];
  const settle = idx % 2 === 0 ? "USDC" : "USDT";

  return (
    <Box component="section" sx={{ position: "relative", background: BG0, overflow: "hidden" }}>
      {/* Top blue haze + fine engineering grid */}
      <Box aria-hidden sx={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 62% 44% at 50% -8%, rgba(0,82,255,0.20), transparent 68%)",
      }} />
      <Box aria-hidden sx={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5,
        backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
        backgroundSize: "72px 72px",
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 10%, transparent 78%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 10%, transparent 78%)",
      }} />

      <ShellV4 sx={{
        pt: { xs: 8, md: 13 }, pb: { xs: 9, md: 14 },
        display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.12fr 1fr" },
        alignItems: "center", gap: { xs: 7, md: 10 },
      }}>
        {/* LEFT */}
        <Box sx={{ animation: `${riseIn} .7s ease both` }}>
          <EyebrowV4 sx={{ mb: 3.5 }}>{t("v4.hero.eyebrow")}</EyebrowV4>

          <DisplayXL component="h1" sx={{ mb: 3.5 }}>
            {t("v4.hero.h1a")}{" "}
            <Box component="span" sx={{
              background: HEADLINE_GRADIENT, WebkitBackgroundClip: "text",
              backgroundClip: "text", color: "transparent",
            }}>
              {t("v4.hero.h1b")}
            </Box>{" "}
            {t("v4.hero.h1c")}
          </DisplayXL>

          <LeadV4 sx={{ maxWidth: 540, mb: 5, fontSize: { xs: 16, md: 18 } }}>
            {t("v4.hero.body")}
          </LeadV4>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 4.5 }}>
            <PrimaryBtnV4
              data-testid="hero-primary-cta"
              onClick={() => router.push("/auth/register?ref=hero_v4")}
              endIcon={<ArrowForwardRounded sx={{ fontSize: 18 }} />}
            >
              {t("v4.hero.ctaPrimary")}
            </PrimaryBtnV4>
            <GhostBtnV4 data-testid="hero-secondary-cta" onClick={() => router.push("/documentation")}>
              {t("v4.hero.ctaSecondary")}
            </GhostBtnV4>
          </Box>

          <Box sx={{ display: "flex", gap: { xs: 2, md: 3.5 }, flexWrap: "wrap" }}>
            {[t("v4.hero.tick1"), t("v4.hero.tick2"), t("v4.hero.tick3")].map((tick) => (
              <Box key={tick} sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <CheckRounded sx={{ fontSize: 15, color: GREEN }} />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: INK2, letterSpacing: "0.04em" }}>
                  {tick}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* RIGHT — checkout demo card */}
        <Box sx={{ position: "relative", animation: `${riseIn} .7s ease .15s both`, justifySelf: { md: "end" }, width: "100%", maxWidth: 440 }}>
          <Box aria-hidden sx={{
            position: "absolute", inset: "-8% -12%", borderRadius: "32px", pointerEvents: "none",
            background: "radial-gradient(ellipse at 50% 60%, rgba(0,82,255,0.22), transparent 66%)",
            filter: "blur(30px)",
          }} />
          <Box data-testid="hero-demo-card" sx={{
            position: "relative", borderRadius: "20px", border: `1px solid ${LINE2}`,
            background: `linear-gradient(180deg, ${BG2} 0%, ${BG1} 100%)`,
            boxShadow: "0 30px 80px -30px rgba(0,0,0,0.9)", overflow: "hidden",
          }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2.25, borderBottom: `1px solid ${LINE}` }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: "10px", background: BLUE, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16,
                }}>
                  {STORES[idx][0]}
                </Box>
                <Box>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14.5, color: INK0, lineHeight: 1.2 }}>
                    {STORES[idx]}
                  </Typography>
                  <Typography sx={{ display: "flex", alignItems: "center", gap: 0.5, fontFamily: FONT_MONO, fontSize: 10.5, color: INK3 }}>
                    <LockRoundedIcon sx={{ fontSize: 10 }} /> {t("v4.hero.demo.secure")}
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{
                fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.14em", color: GREEN,
                border: `1px solid rgba(0,211,149,0.35)`, borderRadius: 999, px: 1.25, py: 0.4,
                background: "rgba(0,211,149,0.08)",
              }}>
                {t("v4.hero.demo.badge")}
              </Typography>
            </Box>

            <Box sx={{ px: 3, pt: 3, pb: 3 }}>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: INK3, mb: 0.75 }}>
                {t("v4.hero.demo.amountDue")}
              </Typography>
              <Box key={amount} sx={{ display: "flex", alignItems: "baseline", gap: 1.25, mb: 2.5, animation: `${riseIn} .45s ease both` }}>
                <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 40, color: INK0, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {fmt(amount)}
                </Typography>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: INK3 }}>
                  → {settle}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2.75 }}>
                {PAY_COINS.map((c) => {
                  const active = c === coin;
                  return (
                    <Box
                      key={c}
                      data-testid={`demo-coin-${c.toLowerCase()}`}
                      onClick={() => setCoin(c)}
                      sx={{
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.9,
                        px: 1.5, py: 0.75, borderRadius: 999,
                        border: `1px solid ${active ? BLUE_BRIGHT : LINE}`,
                        background: active ? "rgba(0,82,255,0.12)" : "rgba(255,255,255,0.03)",
                        transition: "border-color .2s ease, background-color .2s ease, transform .2s ease",
                        "&:hover": { transform: "translateY(-1px)", borderColor: LINE2 },
                      }}
                    >
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: COIN_COLOR[c] || BLUE }} />
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, color: active ? INK0 : INK2 }}>
                        {c}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              <Box
                data-testid="demo-pay-button"
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
                  borderRadius: "12px", py: 1.6, background: BLUE, color: "#fff", cursor: "default",
                  fontFamily: FONT_BODY, fontWeight: 600, fontSize: 15,
                  transition: "background-color .2s ease, box-shadow .25s ease",
                  "&:hover": { background: BLUE_BRIGHT, boxShadow: "0 8px 28px -8px rgba(0,82,255,0.6)" },
                }}
              >
                <LockRoundedIcon sx={{ fontSize: 15 }} />
                {t("v4.hero.demo.pay")} {fmt(amount)} · {coin}
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
                <BoltRoundedIcon sx={{ fontSize: 14, color: GREEN }} />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: INK3, lineHeight: 1.5 }}>
                  {t("v4.hero.demo.settleLine")}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </ShellV4>
    </Box>
  );
};

export default memo(HeroV4);
