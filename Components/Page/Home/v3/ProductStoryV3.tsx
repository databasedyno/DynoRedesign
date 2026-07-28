import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import BoltIcon from "@mui/icons-material/Bolt";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";

// ─── Mock 1: Checkout ───
const CheckoutMock: React.FC<{ accent: string }> = ({ accent }) => (
  <Box sx={{ p: { xs: 2.5, md: 3.5 }, background: "#0F0F13", height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Box>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.24em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
          Order #A81F7C · HostBay
        </Typography>
        <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 22, md: 26 }, letterSpacing: "-0.02em", color: "#F5F5F5", mt: 0.5 }}>
          Pay $250.00
        </Typography>
      </Box>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: "999px", px: 1.25, py: 0.35 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: "#4ADE80", fontWeight: 600, letterSpacing: "0.06em" }}>
          {t("v3.story.mock.awaitingPayment")}
        </Typography>
      </Box>
    </Box>

    {/* Coin picker */}
    <Box sx={{ display: "flex", gap: 0.75, mt: 0.5, flexWrap: "wrap" }}>
      {["BTC", "ETH", "USDT", "USDC", "XRP", "TRX", "SOL"].map((c, i) => (
        <Box
          key={c}
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: "8px",
            border: i === 2 ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.10)",
            background: i === 2 ? `${accent}22` : "rgba(255,255,255,0.03)",
            color: i === 2 ? "#fff" : "rgba(255,255,255,0.65)",
            fontFamily: FONT_TECH,
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          {c}
        </Box>
      ))}
    </Box>

    {/* Address panel */}
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 2, alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", p: 2, mt: 0.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
          {t("v3.story.mock.sendUSDT")}
        </Typography>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, color: "#F5F5F5", mt: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          TTve8v6Y48…zgjLj6t
        </Typography>
        <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 20, color: accent, letterSpacing: "-0.01em", mt: 1.25 }}>
          250.00 USDT
        </Typography>
      </Box>
      <Box
        sx={{
          width: 68,
          height: 68,
          borderRadius: "10px",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0A0A0A",
        }}
      >
        <QrCode2RoundedIcon sx={{ fontSize: 56 }} />
      </Box>
    </Box>

    <Box sx={{ display: "flex", gap: 1, mt: "auto", pt: 1 }}>
      <Box sx={{ flex: 1, background: accent, borderRadius: "12px", py: 1.25, textAlign: "center" }}>
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: "#fff", fontWeight: 600 }}>
          {t("v3.story.mock.openWallet")}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "12px", py: 1.15, textAlign: "center" }}>
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: "#F5F5F5", fontWeight: 500 }}>
          {t("v3.story.mock.copyAddress")}
        </Typography>
      </Box>
    </Box>
  </Box>
);

// ─── Mock 2: Settlement / transactions list ───
const TX_ROWS = [
  { coin: "USDT", chain: "TRC-20", amount: "+250.00", usd: "$250.00", conv: "→ USDC", state: t("v3.story.mock.settled"), stateTone: "ok" },
  { coin: "ETH", chain: "Mainnet", amount: "+0.1240", usd: "$412.06", conv: "→ USDC", state: "Settled", stateTone: "ok" },
  { coin: "BTC", chain: "Mainnet", amount: "+0.0031", usd: "$198.00", conv: "keep BTC", state: t("v3.story.mock.confirming"), stateTone: "pending" },
  { coin: "XRP", chain: "Mainnet", amount: "+120.00", usd: "$61.20", conv: "→ USDC", state: "Settled", stateTone: "ok" },
];

const SettlementMock: React.FC<{ accent: string }> = ({ accent }) => (
  <Box sx={{ p: { xs: 2, md: 2.5 }, background: "#0F0F13", height: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
    {/* Summary strip */}
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
      {[
        { label: t("v3.story.mock.today"), value: "$921.26", trend: "+18%" },
        { label: t("v3.story.mock.autoConverted"), value: "$723.26", trend: "78%" },
        { label: t("v3.story.mock.chainsLabelSummary", "Chains"), value: `5 ${t("v3.story.mock.chainsActive")}`, trend: t("v3.story.mock.chainsLive") },
      ].map((k, i) => (
        <Box key={k.label} sx={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", p: 1.5 }}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 9.5, color: "rgba(255,255,255,0.5)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
            {k.label}
          </Typography>
          <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17, color: "#F5F5F5", mt: 0.25 }}>
            {k.value}
          </Typography>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, mt: 0.5, background: i === 0 ? "rgba(34,197,94,0.14)" : `${accent}22`, borderRadius: "999px", px: 0.75, py: 0.15 }}>
            <TrendingUpRoundedIcon sx={{ fontSize: 10, color: i === 0 ? "#4ADE80" : accent }} />
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 9.5, color: i === 0 ? "#4ADE80" : accent, fontWeight: 700 }}>
              {k.trend}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>

    {/* Table header */}
    <Box sx={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.9fr", gap: 1, px: 1, mt: 0.5 }}>
      {[t("v3.story.mock.thPayment"), t("v3.story.mock.thAmount"), t("v3.story.mock.thSettle"), t("v3.story.mock.thStatus")].map((h) => (
        <Typography key={h} sx={{ fontFamily: FONT_TECH, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
          {h}
        </Typography>
      ))}
    </Box>

    {/* Rows */}
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {TX_ROWS.map((r, idx) => (
        <Box
          key={idx}
          sx={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 0.9fr",
            gap: 1,
            alignItems: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px",
            px: 1.25,
            py: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${accent}, #4338CA)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: FONT_TECH,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {r.coin.slice(0, 1)}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: "#F5F5F5", fontWeight: 600 }}>
                {r.coin}
              </Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                {r.chain}
              </Typography>
            </Box>
          </Box>
          <Box>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, color: "#F5F5F5", fontWeight: 600 }}>
              {r.amount}
            </Typography>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
              {r.usd}
            </Typography>
          </Box>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
            {r.conv}
          </Typography>
          <Box
            sx={{
              justifySelf: "start",
              display: "inline-flex",
              alignItems: "center",
              gap: 0.4,
              background: r.stateTone === "ok" ? "rgba(34,197,94,0.12)" : "rgba(251,191,36,0.14)",
              border: `1px solid ${r.stateTone === "ok" ? "rgba(34,197,94,0.35)" : "rgba(251,191,36,0.35)"}`,
              borderRadius: "999px",
              px: 0.9,
              py: 0.2,
            }}
          >
            {r.stateTone === "ok" ? (
              <CheckRoundedIcon sx={{ fontSize: 11, color: "#4ADE80" }} />
            ) : (
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#FBBF24" }} />
            )}
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 9.5, color: r.stateTone === "ok" ? "#4ADE80" : "#FBBF24", fontWeight: 700, letterSpacing: "0.05em" }}>
              {r.state}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  </Box>
);

// ─── Mock 3: Wallets grid ───
const WALLET_TILES = [
  { coin: "USDC", chain: "Polygon", bal: "12,481.30", usd: "$12,481.30", pct: 62 },
  { coin: "BTC", chain: "Mainnet", bal: "0.1421", usd: "$9,082.14", pct: 20 },
  { coin: "ETH", chain: "Mainnet", bal: "3.0210", usd: "$10,048.55", pct: 12 },
  { coin: "XRP", chain: "Mainnet", bal: "2,150", usd: "$1,097.65", pct: 6 },
];

const WalletMock: React.FC<{ accent: string }> = ({ accent }) => (
  <Box sx={{ p: { xs: 2, md: 2.5 }, background: "#0F0F13", height: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
    <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between" }}>
      <Box>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
          {t("v3.story.mock.inYourWallet")}
        </Typography>
        <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 24, md: 28 }, letterSpacing: "-0.02em", color: "#F5F5F5", mt: 0.25 }}>
          $32,709.64
        </Typography>
      </Box>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: "999px", px: 1, py: 0.25 }}>
        <TrendingUpRoundedIcon sx={{ fontSize: 12, color: "#4ADE80" }} />
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: "#4ADE80", fontWeight: 700 }}>
          +12.4% {t("v3.story.mock.thisWeek")}
        </Typography>
      </Box>
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
      {WALLET_TILES.map((w, i) => (
        <Box
          key={w.coin}
          sx={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${i === 0 ? `${accent}55` : "rgba(255,255,255,0.07)"}`,
            borderRadius: "12px",
            p: 1.5,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {i === 0 && (
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at 100% 0%, ${accent}22, transparent 70%)`,
                pointerEvents: "none",
              }}
            />
          )}
          <Box sx={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${accent}, #4338CA)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontFamily: FONT_TECH,
                  fontSize: 9.5,
                  fontWeight: 700,
                }}
              >
                {w.coin.slice(0, 1)}
              </Box>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: "#F5F5F5", fontWeight: 600 }}>
                {w.coin}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>
              {w.chain}
            </Typography>
          </Box>
          <Typography sx={{ position: "relative", fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17, color: "#F5F5F5", letterSpacing: "-0.01em" }}>
            {w.bal}
          </Typography>
          <Typography sx={{ position: "relative", fontFamily: FONT_TECH, fontSize: 10.5, color: "rgba(255,255,255,0.55)", mt: 0.25 }}>
            {w.usd} · {w.pct}%
          </Typography>
          <Box sx={{ position: "relative", height: 3, borderRadius: "999px", background: "rgba(255,255,255,0.06)", mt: 1, overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${w.pct}%`, background: accent, borderRadius: "999px" }} />
          </Box>
        </Box>
      ))}
    </Box>
  </Box>
);


// Browser-chrome frame around the synthetic product mock.
const BrowserFrame: React.FC<{ url: string; accent: string; children: React.ReactNode }> = ({ url, accent, children }) => (
  <Box
    sx={{
      position: "relative",
      borderRadius: { xs: "14px", md: "18px" },
      overflow: "hidden",
      background: "#0A0A0A",
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: `0 40px 80px -30px ${accent}55, 0 20px 40px -20px rgba(10,10,10,0.35)`,
    }}
  >
    {/* macOS-style header */}
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 1.25,
        background: "#141419",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Box sx={{ display: "flex", gap: 0.75 }}>
        <Box sx={{ width: 11, height: 11, borderRadius: "50%", background: "#FF5F56" }} />
        <Box sx={{ width: 11, height: 11, borderRadius: "50%", background: "#FFBD2E" }} />
        <Box sx={{ width: 11, height: 11, borderRadius: "50%", background: "#27C93F" }} />
      </Box>
      <Box
        sx={{
          flex: 1,
          mx: 2,
          background: "rgba(255,255,255,0.06)",
          borderRadius: "6px",
          px: 1.5,
          py: 0.35,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          minWidth: 0,
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />
        <Typography
          sx={{
            fontFamily: FONT_TECH,
            fontSize: 11,
            color: "rgba(255,255,255,0.68)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {url}
        </Typography>
      </Box>
      <Box sx={{ display: { xs: "none", sm: "block" } }}>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>
          dynopay
        </Typography>
      </Box>
    </Box>
    {/* Mock body — fixed aspect */}
    <Box sx={{ position: "relative", width: "100%", aspectRatio: "16/10" }}>
      <Box sx={{ position: "absolute", inset: 0, overflow: "hidden" }}>{children}</Box>
    </Box>
  </Box>
);

const ProductStoryV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const reduced = useReducedMotion();

  const STEPS = [
    { n: "01", icon: BoltIcon, title: t("v3.story.step1.title"), body: t("v3.story.step1.body"), accent: "#4F46E5", accentSoft: "rgba(79, 70, 229,0.10)", urlBar: "checkout.dynopay.com/pay_01HZ", Mock: CheckoutMock },
    { n: "02", icon: SwapHorizIcon, title: t("v3.story.step2.title"), body: t("v3.story.step2.body"), accent: "#4F46E5", accentSoft: "rgba(79, 70, 229,0.10)", urlBar: "dynopay.com/dashboard/transactions", Mock: SettlementMock },
    { n: "03", icon: AccountBalanceWalletOutlinedIcon, title: t("v3.story.step3.title"), body: t("v3.story.step3.body"), accent: "#4F46E5", accentSoft: "rgba(79, 70, 229,0.10)", urlBar: "dynopay.com/wallets", Mock: WalletMock },
  ];

  return (
    <Box component="section" sx={{ background: s.bgAlt, py: { xs: 12, md: 20 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ maxWidth: 720, mb: { xs: 6, md: 9 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.story.eyebrow")}</Eyebrow>
          <HeadlineL sx={{ color: s.ink }}>{t("v3.story.headline")}</HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, mt: 2.5, fontSize: 17, lineHeight: 1.6 }}>
            {t("v3.story.body")}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 6, md: 12 } }}>
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const reversed = idx % 2 === 1;
            const Mock = step.Mock;
            return (
              <motion.div
                key={step.n}
                initial={reduced ? undefined : { opacity: 0, y: 40 }}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1.15fr" },
                    gap: { xs: 4, md: 8 },
                    alignItems: "center",
                  }}
                >
                  {/* Text side */}
                  <Box sx={{ order: { xs: 1, md: reversed ? 2 : 1 } }}>
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "12px",
                          background: step.accentSoft,
                          border: `1px solid ${step.accent}33`,
                          color: step.accent,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon sx={{ fontSize: 20 }} />
                      </Box>
                      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: step.accent, fontWeight: 600 }}>
                        {t("v3.story.stepLabel")} {step.n}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 30, md: 44 }, letterSpacing: "-0.03em", lineHeight: 1.05, color: s.ink, mb: 2 }}>
                      {step.title}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 17, lineHeight: 1.6, color: s.ink2, maxWidth: 480 }}>
                      {step.body}
                    </Typography>
                  </Box>

                  {/* Mock side */}
                  <Box sx={{ order: { xs: 2, md: reversed ? 1 : 2 }, position: "relative" }}>
                    <Box
                      aria-hidden
                      sx={{
                        position: "absolute",
                        inset: -20,
                        borderRadius: "32px",
                        background: `radial-gradient(circle at 30% 70%, ${step.accent}33, transparent 60%)`,
                        filter: "blur(30px)",
                        pointerEvents: "none",
                        zIndex: 0,
                      }}
                    />
                    <Box sx={{ position: "relative", zIndex: 1 }}>
                      <BrowserFrame url={step.urlBar} accent={step.accent}>
                        <Mock accent={step.accent} />
                      </BrowserFrame>
                    </Box>
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ProductStoryV3);
