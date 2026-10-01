import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { lazyLoading } from "@/Components/UI/DynamicFallback";
import { Box, Stack, Typography, useMediaQuery } from "@mui/material";
import { Icon } from "@iconify/react";
import { useReducedMotion } from "framer-motion";
import { SD_GOLD, SD_INK_SOFT, goldAlpha } from "./sdTheme";

// Decorative 3D scene: if its chunk fails just stay hidden (never reload the page for it).
const EscrowScene3D = dynamic(() => import("./EscrowScene3D"), { ssr: false, loading: lazyLoading(null, { silent: true, autoReload: false }) });

const hasWebGL = (): boolean => {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
};

const LABELS: Array<{ key: string; title: string; sub: string; icon: string; left: string }> = [
  { key: "buyer", title: "Buyer", sub: "pays in", icon: "mdi:cart-outline", left: "12%" },
  { key: "vault", title: "SafeDeal vault", sub: "held in USDT", icon: "mdi:lock-outline", left: "50%" },
  { key: "seller", title: "Seller", sub: "paid on release", icon: "mdi:storefront-outline", left: "88%" },
];

/** CSS diagram for reduced-motion / small / no-WebGL screens — same story, no GPU. */
function StaticEscrowDiagram({ animate }: { animate: boolean }) {
  return (
    <Box data-testid="sd-escrow-static" sx={{ position: "relative", height: "100%", minHeight: 300, display: "grid", placeItems: "center" }}>
      <Box aria-hidden sx={{ position: "absolute", left: "14%", right: "14%", top: "46%", height: 2, background: `linear-gradient(90deg, transparent, ${goldAlpha(0.6)}, transparent)` }} />
      {animate && (
        <Box aria-hidden sx={{ position: "absolute", top: "calc(46% - 7px)", left: "14%", width: 14, height: 14, borderRadius: "50%", backgroundColor: SD_GOLD, boxShadow: `0 0 18px ${SD_GOLD}`, animation: "sdFlow 6s ease-in-out infinite", "@keyframes sdFlow": { "0%": { left: "14%" }, "40%": { left: "48%" }, "60%": { left: "48%" }, "100%": { left: "84%" } } }} />
      )}
      <Stack direction="row" justifyContent="space-between" sx={{ width: "100%", px: { xs: 1, sm: 3 }, position: "relative" }}>
        {LABELS.map((l, i) => (
          <Stack key={l.key} alignItems="center" spacing={1} sx={{ width: 110 }}>
            <Box sx={{ width: i === 1 ? 92 : 68, height: i === 1 ? 92 : 68, borderRadius: i === 1 ? 5 : "50%", display: "grid", placeItems: "center", backgroundColor: SD_INK_SOFT, border: `1px solid ${goldAlpha(i === 1 ? 0.7 : 0.35)}`, boxShadow: i === 1 ? `0 0 46px ${goldAlpha(0.35)}` : "none" }}>
              <Icon icon={l.icon} width={i === 1 ? 38 : 28} color={SD_GOLD} aria-hidden />
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{l.title}</Typography>
            <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", mt: "-6px !important" }}>{l.sub}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

/**
 * Hero visual: WebGL escrow flow on capable desktops, CSS diagram otherwise.
 * Labels are real DOM (accessible, no font downloads for the GPU scene).
 */
export default function EscrowScene() {
  const reduce = useReducedMotion();
  const small = useMediaQuery("(max-width:899px)");
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => setWebgl(hasWebGL()), []);
  const use3d = webgl === true && !small && !reduce;

  return (
    <Box data-testid="sd-escrow-scene" data-mode={use3d ? "webgl" : "static"} sx={{ position: "relative", width: "100%", height: { xs: 320, md: 480, lg: 520 } }}>
      <Box aria-hidden sx={{ position: "absolute", inset: "10% 5%", pointerEvents: "none", background: `radial-gradient(closest-side, ${goldAlpha(0.22)}, transparent 75%)`, filter: "blur(18px)" }} />
      {use3d ? (
        <>
          <Box sx={{ position: "absolute", inset: "0 0 46px 0" }}>
            <EscrowScene3D />
          </Box>
          <Stack direction="row" aria-hidden sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 40, pointerEvents: "none" }}>
            {LABELS.map((l) => (
              <Box key={l.key} sx={{ position: "absolute", left: l.left, transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap" }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#fff", letterSpacing: 0.2 }}>{l.title}</Typography>
                <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{l.sub}</Typography>
              </Box>
            ))}
          </Stack>
        </>
      ) : (
        <StaticEscrowDiagram animate={!reduce} />
      )}
      <Typography component="p" sx={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", pointerEvents: "none" }}>
        How SafeDeal works: the buyer pays into the SafeDeal vault, the money is held in USDT, and it is released to the seller once the work is delivered.
      </Typography>
    </Box>
  );
}
