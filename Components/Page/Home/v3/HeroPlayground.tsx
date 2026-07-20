import React, { memo, useEffect, useState } from "react";
import { Box, Typography, InputBase, Button } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/router";
import ArrowForward from "@mui/icons-material/ArrowForward";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { AuroraInk, HeadlineXL, Eyebrow, Body } from "./styled.v3";

const SUGGESTED_HANDLES = ["alex", "maya", "lin", "jordan", "rae", "kai"];
const TIP_AMOUNTS = ["$3", "$5", "$10", "$25", "$50", "$100"];

const HeroPlayground: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [handle, setHandle] = useState("you");
  const [tipIdx, setTipIdx] = useState(0);
  const [rotIdx, setRotIdx] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => {
      setTipIdx((i) => (i + 1) % TIP_AMOUNTS.length);
      setRotIdx((i) => (i + 1) % SUGGESTED_HANDLES.length);
    }, 2200);
    return () => clearInterval(t);
  }, [reduced]);

  const displayHandle = handle && handle !== "you" ? handle : SUGGESTED_HANDLES[rotIdx];

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        overflow: "hidden",
        background: s.bg,
        pt: { xs: 8, md: 12 },
        pb: { xs: 9, md: 14 },
      }}
    >
      {/* Soft coral orb behind hero (minimal single-accent) */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: { xs: "-20%", md: "-30%" },
          right: { xs: "-30%", md: "-10%" },
          width: { xs: 620, md: 900 },
          height: { xs: 620, md: 900 },
          borderRadius: "50%",
          background: "#FF5B49",
          filter: "blur(140px)",
          opacity: s.dark ? 0.14 : 0.10,
          pointerEvents: "none",
        }}
      />
      {/* subtle grid */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `linear-gradient(${s.line} 1px, transparent 1px), linear-gradient(90deg, ${s.line} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 90%)",
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1280,
          mx: "auto",
          px: { xs: 3, md: 5 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
          alignItems: "center",
          gap: { xs: 6, md: 10 },
        }}
      >
        {/* LEFT — copy */}
        <Box>
          <Eyebrow tone="coral" sx={{ mb: 3, display: "inline-flex", alignItems: "center", gap: 1 }}>
            <Box
              component="span"
              sx={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#FF5B49",
                boxShadow: "0 0 0 4px rgba(255,91,73,0.18)",
              }}
            />
            Dynopay · Public beta
          </Eyebrow>

          <HeadlineXL sx={{ color: s.ink, mb: 3 }}>
            Get paid in crypto.
            <br />
            <AuroraInk>Every way</AuroraInk> you sell.
          </HeadlineXL>

          <Body sx={{ color: s.ink2, maxWidth: 540, mb: 4.5, fontSize: { xs: 16, md: 18 } }}>
            One wallet for merchants, fundraisers, creators and developers.
            Tips, storefronts, campaigns, and API — settled in the coin you
            want, from <b style={{ color: s.ink }}>0.5% </b>fee.
          </Body>

          {/* Handle claim input */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              maxWidth: 480,
              background: s.surface,
              border: `1px solid ${s.lineStrong}`,
              borderRadius: "999px",
              pl: 2.5,
              pr: 0.75,
              py: 0.75,
              gap: 1,
              transition: "border-color .2s ease, box-shadow .2s ease",
              "&:focus-within": {
                borderColor: "#FF5B49",
                boxShadow: "0 0 0 4px rgba(255,91,73,0.14)",
              },
            }}
          >
            <Typography
              sx={{
                fontFamily: FONT_TECH,
                fontSize: 15,
                color: s.ink3,
                whiteSpace: "nowrap",
              }}
            >
              dynopay.me/@
            </Typography>
            <InputBase
              value={handle === "you" ? "" : handle}
              placeholder={displayHandle}
              onChange={(e) => {
                const v = e.target.value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 24);
                setHandle(v || "you");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push("/auth/register");
              }}
              sx={{
                flex: 1,
                fontFamily: FONT_TECH,
                fontSize: 15,
                color: s.ink,
                "& input::placeholder": { color: s.ink3, opacity: 1 },
              }}
              inputProps={{ "aria-label": "Choose your creator handle" }}
            />
            <Button
              onClick={() => router.push("/auth/register")}
              endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: "999px",
                px: 2.5,
                py: 1,
                minWidth: 0,
                textTransform: "none",
                fontFamily: FONT_BODY,
                fontSize: 14.5,
                fontWeight: 600,
                color: "#fff",
                background: "#0A0A0A",
                "&:hover": { background: "#1F1F1F" },
              }}
            >
              Claim
            </Button>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 3, mt: 3.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, color: s.ink3, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Free · No credit card · 15+ chains
            </Typography>
          </Box>
        </Box>

        {/* RIGHT — @handle floating card */}
        <Box sx={{ position: "relative", display: "flex", justifyContent: "center", perspective: "1200px" }}>
          <motion.div
            initial={{ opacity: 0, y: 30, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            style={{ width: "100%", maxWidth: 420 }}
          >
            <Box
              sx={{
                position: "relative",
                borderRadius: "28px",
                background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
                border: `1px solid ${s.lineStrong}`,
                boxShadow: "0 40px 80px -30px rgba(10,10,10,0.35), 0 12px 24px -14px rgba(255,91,73,0.25)",
                p: 3.5,
                overflow: "hidden",
              }}
            >
              {/* Coral corner glow (was rainbow) */}
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  top: -80,
                  right: -80,
                  width: 240,
                  height: 240,
                  borderRadius: "50%",
                  background: "#FF5B49",
                  filter: "blur(60px)",
                  opacity: 0.22,
                }}
              />
              <Box sx={{ position: "relative", zIndex: 1 }}>
                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "#0A0A0A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontFamily: FONT_HERO,
                      fontWeight: 700,
                      fontSize: 18,
                      border: "3px solid #fff",
                      boxShadow: "0 6px 14px rgba(10,10,10,0.25)",
                    }}
                  >
                    {(displayHandle[0] || "y").toUpperCase()}
                  </Box>
                  <Box>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17, color: "#0A0A0A", lineHeight: 1.1 }}>
                      @{displayHandle}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: "#71717A", mt: 0.25 }}>
                      dynopay.me/@{displayHandle}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      px: 1,
                      py: 0.4,
                      borderRadius: "999px",
                      background: "rgba(34,197,94,0.10)",
                      border: "1px solid rgba(34,197,94,0.35)",
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#22C55E",
                      }}
                    />
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10, color: "#166534", fontWeight: 600 }}>
                      LIVE
                    </Typography>
                  </Box>
                </Box>

                {/* Amount ticker */}
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#71717A", mb: 1 }}>
                  Send a tip
                </Typography>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 2.5 }}>
                  <motion.div
                    key={tipIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 44, color: "#0A0A0A", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {TIP_AMOUNTS[tipIdx]}
                    </Typography>
                  </motion.div>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, color: "#71717A", fontWeight: 500 }}>USD → USDC</Typography>
                </Box>

                {/* Chip row */}
                <Box sx={{ display: "flex", gap: 0.75, mb: 2.5, flexWrap: "wrap" }}>
                  {TIP_AMOUNTS.map((amt, i) => (
                    <Box
                      key={amt}
                      sx={{
                        px: 1.25,
                        py: 0.5,
                        borderRadius: "999px",
                        border: `1px solid ${i === tipIdx ? "#FF5B49" : "rgba(10,10,10,0.10)"}`,
                        background: i === tipIdx ? "rgba(255,91,73,0.10)" : "transparent",
                        color: i === tipIdx ? "#E33F2E" : "#3F3F46",
                        fontFamily: FONT_TECH,
                        fontSize: 12.5,
                        fontWeight: 600,
                        transition: "all .3s ease",
                      }}
                    >
                      {amt}
                    </Box>
                  ))}
                </Box>

                {/* CTA */}
                <Button
                  fullWidth
                  onClick={() => router.push("/auth/register")}
                  startIcon={<FavoriteRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    borderRadius: "14px",
                    py: 1.4,
                    textTransform: "none",
                    fontFamily: FONT_BODY,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#fff",
                    background: "linear-gradient(135deg, #FF5B49 0%, #E33F2E 100%)",
                    boxShadow: "0 10px 22px -8px rgba(255,91,73,0.55)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #FF6E5E 0%, #E33F2E 100%)",
                      boxShadow: "0 12px 26px -8px rgba(255,91,73,0.7)",
                    },
                  }}
                >
                  Send tip · {TIP_AMOUNTS[tipIdx]}
                </Button>

                {/* Meta row */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2.5, pt: 2, borderTop: `1px dashed ${s.line}` }}>
                  <BoltRoundedIcon sx={{ fontSize: 15, color: "#5A6B00" }} />
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: "#3F3F46" }}>
                    Settles to <b>your wallet</b> in ~4s · fee <b>1.5%</b>
                  </Typography>
                </Box>
              </Box>
            </Box>
          </motion.div>

          {/* Floating chips */}
          <motion.div
            initial={{ opacity: 0, x: -20, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              bottom: -14,
              left: -6,
              zIndex: 2,
            }}
          >
            <Box
              sx={{
                display: "none",
                background: "#0A0A0A",
                color: "#F5F5F5",
                fontFamily: FONT_TECH,
                fontSize: 12,
                fontWeight: 600,
                px: 1.5,
                py: 0.75,
                borderRadius: "999px",
                boxShadow: "0 10px 20px -6px rgba(10,10,10,0.35)",
                alignItems: "center",
                gap: 0.75,
                ["@media (min-width: 900px)"]: { display: "inline-flex" },
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22C55E",
                }}
              />
              +$25.00 · @rae · just now
            </Box>
          </motion.div>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(HeroPlayground);
