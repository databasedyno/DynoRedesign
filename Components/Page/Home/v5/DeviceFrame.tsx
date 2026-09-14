import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { FONT_TECH, useAurora } from "../v3/theme.v3";

/** Clean browser window frame — traffic lights, locked address pill, layered shadow. */
export const BrowserFrame: React.FC<React.PropsWithChildren<{ url: string; sx?: object; testId?: string }>> = memo(({ url, children, sx, testId }) => {
  const s = useAurora();
  return (
    <Box
      data-testid={testId}
      data-device="browser"
      sx={{
        position: "relative",
        borderRadius: "18px",
        overflow: "hidden",
        background: s.dark ? "#0F0F14" : "#F4F4F5",
        border: `1px solid ${s.lineStrong}`,
        boxShadow: s.dark
          ? "0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px -40px rgba(0,0,0,0.9), 0 18px 40px -30px rgba(0,0,0,0.7)"
          : "0 0 0 1px rgba(255,255,255,0.6), 0 40px 80px -40px rgba(10,10,10,0.4), 0 18px 40px -30px rgba(79,70,229,0.25)",
        ...sx,
      }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 1.5, px: 1.5, py: 1, borderBottom: `1px solid ${s.line}`, background: s.dark ? "#15151B" : "#FAFAF9" }}>
        <Box sx={{ display: "flex", gap: 0.75 }}>
          {["#FF5F56", "#FFBD2E", "#27C93F"].map((c) => (
            <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.9 }} />
          ))}
        </Box>
        <Box sx={{ mx: "auto", display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.35, minWidth: 0, maxWidth: "70%", borderRadius: "999px", background: s.dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.05)", border: `1px solid ${s.line}` }}>
          <LockRoundedIcon sx={{ fontSize: 10, color: s.ink3, flexShrink: 0 }} />
          <Typography noWrap sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: s.ink3, letterSpacing: "0.04em" }}>{url}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5 }} aria-hidden>
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={{ width: 10, height: 2, borderRadius: 1, background: s.line }} />
          ))}
        </Box>
      </Box>
      {children}
    </Box>
  );
});
BrowserFrame.displayName = "BrowserFrame";

/** Phone frame (dynamic-island style) — children fill the screen; keep the child at a ~9:19.5 aspect. */
export const PhoneFrame: React.FC<React.PropsWithChildren<{ width?: number | Record<string, number>; sx?: object; testId?: string }>> = memo(({ width = 180, children, sx, testId }) => {
  const s = useAurora();
  return (
    <Box
      data-testid={testId}
      data-device="phone"
      sx={{
        position: "relative",
        width,
        aspectRatio: "9 / 19.2",
        borderRadius: "14%/6.5%",
        p: "3.2%",
        background: s.dark ? "linear-gradient(160deg,#2A2A32 0%,#0E0E12 60%)" : "linear-gradient(160deg,#3A3A44 0%,#0E0E12 60%)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset, 0 40px 80px -36px rgba(0,0,0,0.75), 0 16px 36px -24px rgba(0,0,0,0.55)",
        ...sx,
      }}
    >
      <Box aria-hidden sx={{ position: "absolute", right: "-1.2%", top: "22%", width: "1.2%", height: "9%", borderRadius: "0 2px 2px 0", background: "#1B1B21" }} />
      <Box aria-hidden sx={{ position: "absolute", left: "-1.2%", top: "18%", width: "1.2%", height: "5%", borderRadius: "2px 0 0 2px", background: "#1B1B21" }} />
      <Box aria-hidden sx={{ position: "absolute", left: "-1.2%", top: "26%", width: "1.2%", height: "9%", borderRadius: "2px 0 0 2px", background: "#1B1B21" }} />
      <Box sx={{ position: "relative", width: "100%", height: "100%", borderRadius: "11%/5%", overflow: "hidden", background: s.dark ? "#0B0F19" : "#FFFFFF" }}>
        {children}
        <Box aria-hidden sx={{ position: "absolute", top: "2.2%", left: "50%", transform: "translateX(-50%)", width: "30%", height: "3.4%", borderRadius: "999px", background: "#0A0A0A" }} />
      </Box>
    </Box>
  );
});
PhoneFrame.displayName = "PhoneFrame";

/** Screenshot that fills its frame; falls back to a label if the asset is missing. */
export const FramedImage: React.FC<{ src: string; alt: string; position?: string; testId?: string }> = memo(({ src, alt, position = "top left", testId }) => {
  const s = useAurora();
  const [failed, setFailed] = React.useState(false);
  return failed ? (
    <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.ink3, letterSpacing: "0.1em", textTransform: "uppercase" }}>{alt}</Typography>
    </Box>
  ) : (
    <Box
      component="img"
      key={src}
      data-testid={testId}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: position, userSelect: "none", WebkitUserDrag: "none" }}
    />
  );
});
FramedImage.displayName = "FramedImage";
