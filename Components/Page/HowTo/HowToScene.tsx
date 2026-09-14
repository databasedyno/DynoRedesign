import React from "react";
import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import { FONT_BODY, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";

// ─── Individual scenes ───────────────────────────────────────────────────────
type Tokens = ReturnType<typeof useAurora>;

const Card = ({ s, children, sx }: { s: Tokens; children: React.ReactNode; sx?: object }) => (
  <Box
    sx={{
      borderRadius: 3,
      border: `1px solid ${s.line}`,
      background: s.surface,
      p: 2.5,
      boxShadow: s.dark ? "none" : "0 10px 30px -20px rgba(10,10,10,0.4)",
      ...sx,
    }}
  >
    {children}
  </Box>
);

const FieldRow = ({ s, label, value }: { s: Tokens; label: string; value: string }) => (
  <Box sx={{ mb: 1.75 }}>
    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.12em", color: s.ink3, mb: 0.5 }}>
      {label}
    </Typography>
    <Box
      sx={{
        height: 40,
        borderRadius: 1.5,
        border: `1px solid ${s.line}`,
        background: s.bgAlt,
        display: "flex",
        alignItems: "center",
        px: 1.5,
        fontFamily: FONT_BODY,
        fontSize: 15,
        fontWeight: 600,
        color: s.ink,
      }}
    >
      {value}
    </Box>
  </Box>
);

export const Scene = ({ id, s, reduce }: { id: string; s: Tokens; reduce: boolean }) => {
  const rise = (delay: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.4 } };

  if (id === "create") {
    return (
      <Box sx={{ maxWidth: 380, mx: "auto" }}>
        <Card s={s}>
          <FieldRow s={s} label="AMOUNT" value="$49.00 USD" />
          <FieldRow s={s} label="DESCRIPTION" value="Logo design — final files" />
          <motion.div {...rise(0.5)}>
            <Box
              sx={{
                mt: 1,
                height: 44,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontFamily: FONT_BODY,
                background: s.aurora,
              }}
            >
              Create payment link
            </Box>
          </motion.div>
        </Card>
        <motion.div {...rise(0.9)}>
          <Box
            sx={{
              mt: 2,
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1.25,
              borderRadius: 999,
              border: `1px dashed ${s.indigo}`,
              fontFamily: FONT_TECH,
              fontSize: 13,
              color: s.ink,
              justifyContent: "center",
            }}
          >
            <LinkRoundedIcon fontSize="small" sx={{ color: s.indigo }} />
            dynopay.com/pay/aX9kQ2
          </Box>
        </motion.div>
      </Box>
    );
  }

  if (id === "share") {
    const shares = [
      { label: "WhatsApp", c: "#25D366" },
      { label: "Telegram", c: "#2AABEE" },
      { label: "X", c: s.ink },
      { label: "Copy link", c: s.indigo },
    ];
    return (
      <Box sx={{ maxWidth: 400, mx: "auto" }}>
        <Card s={s} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
          <LinkRoundedIcon fontSize="small" sx={{ color: s.indigo }} />
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, color: s.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            dynopay.com/pay/aX9kQ2
          </Typography>
        </Card>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          {shares.map((sh, i) => (
            <motion.div key={sh.label} {...rise(0.2 + i * 0.15)}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${s.line}`,
                  background: s.surface,
                }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: sh.c }} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: s.ink }}>
                  {sh.label}
                </Typography>
              </Box>
            </motion.div>
          ))}
        </Box>
      </Box>
    );
  }

  if (id === "pay") {
    const coins = [
      { t: "BTC", c: "#F7931A" },
      { t: "ETH", c: "#627EEA" },
      { t: "USDT", c: "#26A17B" },
    ];
    return (
      <Box sx={{ maxWidth: 380, mx: "auto" }}>
        <Card s={s}>
          <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, color: s.ink, mb: 0.25 }}>
            Pay $49.00
          </Typography>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink3, mb: 2 }}>
            Choose how you&apos;d like to pay
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            {coins.map((c, i) => (
              <motion.div key={c.t} {...rise(0.2 + i * 0.12)} style={{ flex: 1 }}>
                <Box
                  sx={{
                    py: 1,
                    borderRadius: 1.5,
                    textAlign: "center",
                    border: `1px solid ${i === 1 ? s.indigo : s.line}`,
                    background: i === 1 ? (s.dark ? "rgba(129,140,248,0.1)" : "rgba(79,70,229,0.06)") : "transparent",
                  }}
                >
                  <Box sx={{ width: 16, height: 16, borderRadius: "50%", background: c.c, mx: "auto", mb: 0.5 }} />
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink }}>{c.t}</Typography>
                </Box>
              </motion.div>
            ))}
          </Box>
          <motion.div {...rise(0.8)}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 1.25,
                borderRadius: 999,
                background: s.dark ? "rgba(40,200,100,0.12)" : "rgba(34,197,94,0.1)",
                color: "#22c55e",
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              <CheckRoundedIcon fontSize="small" />
              Payment confirmed on-chain
            </Box>
          </motion.div>
        </Card>
      </Box>
    );
  }

  // settle
  return (
    <Box sx={{ maxWidth: 380, mx: "auto" }}>
      <Card s={s}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
          <AccountBalanceWalletRoundedIcon fontSize="small" sx={{ color: s.indigo }} />
          <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, color: s.ink }}>
            Your wallet
          </Typography>
        </Box>
        <motion.div {...rise(0.3)}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 34, fontWeight: 600, color: s.ink, letterSpacing: "-0.02em" }}>
            + $49.00
          </Typography>
        </motion.div>
        <motion.div {...rise(0.7)}>
          <Box
            sx={{
              mt: 1.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.5,
              py: 0.75,
              borderRadius: 999,
              background: s.dark ? "rgba(40,200,100,0.12)" : "rgba(34,197,94,0.1)",
              color: "#22c55e",
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 12.5,
            }}
          >
            <CheckRoundedIcon sx={{ fontSize: 15 }} />
            Settled to a wallet you control
          </Box>
        </motion.div>
        <motion.div {...rise(1)}>
          <Typography sx={{ mt: 2, fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink3, lineHeight: 1.5 }}>
            Keep the original coin, or auto-convert to USDC / USDT — set it once and forget it.
          </Typography>
        </motion.div>
      </Card>
    </Box>
  );
};

export default Scene;
