import React, { useRef } from "react";
import { Box, Stack, Typography, useMediaQuery } from "@mui/material";
import { Icon } from "@iconify/react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import SafeDealMark from "./SafeDealMark";
import { SD_GOLD, SD_GOLD_SOFT, SD_INK, SD_INK_SOFT, SD_INK_RAISED, goldAlpha } from "./sdTheme";

/**
 * SafeDeal hero showpiece — an interactive, 3D-tilting "live deal" card with
 * floating coin chips and an animated buyer → escrow → seller flow. Depth comes
 * from CSS perspective + translateZ layers; the whole scene tilts toward the
 * pointer (spring-damped). On reduced-motion or small/low-power screens it
 * renders a clean STATIC version — same layout, no tilt, no looping motion.
 */
export default function Hero3D() {
  const reduce = useReducedMotion();
  const isSmall = useMediaQuery("(max-width:900px)");
  const lite = Boolean(reduce || isSmall);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 120, damping: 14 });
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 120, damping: 14 });

  const onMove = (e: React.MouseEvent) => {
    if (lite || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const float = (delay: number) =>
    lite
      ? {}
      : { animate: { y: [0, -10, 0] }, transition: { duration: 5, repeat: Infinity, ease: "easeInOut", delay } };

  return (
    <Box
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      data-testid="sd-hero-3d"
      sx={{ position: "relative", width: "100%", minHeight: { xs: 360, md: 460 }, perspective: "1200px", display: "grid", placeItems: "center" }}
    >
      {/* Ambient gold glow */}
      <Box aria-hidden sx={{ position: "absolute", inset: 0, background: `radial-gradient(420px 320px at 60% 40%, ${goldAlpha(0.22)}, transparent 70%)`, filter: "blur(6px)" }} />

      <motion.div
        style={{ rotateX: lite ? 0 : rotX, rotateY: lite ? 0 : rotY, transformStyle: "preserve-3d", width: "100%", maxWidth: 420 }}
      >
        {/* Main deal card */}
        <Box
          sx={{
            position: "relative",
            transform: "translateZ(0px)",
            borderRadius: 4,
            p: 2.6,
            background: `linear-gradient(160deg, ${SD_INK_SOFT} 0%, ${SD_INK} 100%)`,
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px ${goldAlpha(0.18)}`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <SafeDealMark size={30} ring />
              <Box>
                <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 0.4 }}>DEAL #A17F</Typography>
                <Typography sx={{ fontSize: 14, color: "#fff", fontWeight: 800 }}>Website redesign</Typography>
              </Box>
            </Stack>
            <Box sx={{ px: 1.1, py: 0.4, borderRadius: 99, backgroundColor: goldAlpha(0.16), border: `1px solid ${goldAlpha(0.5)}` }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: SD_GOLD }}>IN ESCROW</Typography>
            </Box>
          </Stack>

          <Typography sx={{ fontSize: 40, fontWeight: 900, color: "#fff", letterSpacing: -1.5, lineHeight: 1 }}>$1,200.00</Typography>
          <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.66)", mt: 0.5, mb: 2.2 }}>Held safely in USDT · released when the work is approved</Typography>

          {/* buyer -> escrow -> seller flow */}
          <Box sx={{ position: "relative", mb: 1.5 }}>
            <Box sx={{ position: "absolute", top: 18, left: "14%", right: "14%", height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)" }} />
            <motion.div
              style={{ position: "absolute", top: 18, left: "14%", height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${SD_GOLD}, ${SD_GOLD_SOFT})` }}
              initial={{ width: 0 }}
              animate={{ width: lite ? "36%" : ["0%", "36%", "36%"] }}
              transition={lite ? { duration: 0 } : { duration: 2.4, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ position: "relative" }}>
              {[
                { ic: "mdi:account-outline", t: "Buyer" },
                { ic: "mdi:shield-lock-outline", t: "SafeDeal" },
                { ic: "mdi:store-outline", t: "Seller" },
              ].map((n, i) => (
                <Stack key={n.t} spacing={0.6} alignItems="center" sx={{ width: 60 }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: i === 1 ? SD_GOLD : SD_INK_RAISED, border: i === 1 ? "none" : "1px solid rgba(255,255,255,0.14)" }}>
                    <Icon icon={n.ic} width={19} color={i === 1 ? SD_INK : "#fff"} />
                  </Box>
                  <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{n.t}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 1.4, pt: 1.4, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Icon icon="mdi:check-decagram" width={16} color={SD_GOLD} />
            <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.78)" }}>Funds secured · awaiting delivery</Typography>
          </Stack>
        </Box>

        {/* Floating coin chips */}
        <Box aria-hidden sx={{ position: "absolute", top: -22, right: -14, transform: "translateZ(80px)" }}>
          <motion.div {...float(0.2)}>
            <CoinChip icon="cryptocurrency:usdt" label="USDT" />
          </motion.div>
        </Box>
        <Box aria-hidden sx={{ position: "absolute", bottom: 46, left: -26, transform: "translateZ(60px)" }}>
          <motion.div {...float(1.1)}>
            <CoinChip icon="cryptocurrency:btc" label="BTC" />
          </motion.div>
        </Box>
        <Box aria-hidden sx={{ position: "absolute", bottom: -18, right: 30, transform: "translateZ(100px)" }}>
          <motion.div {...float(0.6)}>
            <CoinChip icon="cryptocurrency:eth" label="ETH" />
          </motion.div>
        </Box>
      </motion.div>
    </Box>
  );
}

function CoinChip({ icon, label }: { icon: string; label: string }) {
  return (
    <Stack
      direction="row"
      spacing={0.7}
      alignItems="center"
      sx={{
        px: 1.2,
        py: 0.7,
        borderRadius: 99,
        backgroundColor: "rgba(255,255,255,0.96)",
        border: `1px solid ${goldAlpha(0.6)}`,
        boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
      }}
    >
      <Icon icon={icon} width={18} />
      <Typography sx={{ fontSize: 12, fontWeight: 900, color: SD_INK }}>{label}</Typography>
    </Stack>
  );
}
