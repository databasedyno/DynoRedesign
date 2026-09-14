import { Box, Typography, useTheme } from "@mui/material";
import { useEffect, useState } from "react";
import { avatarGradient } from "@/helpers/avatarGradient";
import { resolveUserPhoto } from "@/Components/UI/UserAvatar";
import { sanitizeBrandName } from "@/utils/brandName";

type Props = {
  name?: string | null;
  photo?: string | null;
  size?: number;
  radius?: number;
  "data-testid"?: string;
};

export const brandInitials = (name?: string | null) => {
  const words = sanitizeBrandName(name || "").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
};

/** Per-brand mark: the brand's own logo when uploaded, otherwise its initials on a stable gradient. */
export default function BrandAvatar({ name = "", photo, size = 28, radius, ...rest }: Props) {
  const theme = useTheme();
  const [broken, setBroken] = useState(false);
  const src = resolveUserPhoto(photo || "");
  useEffect(() => setBroken(false), [src]);
  const showLogo = Boolean(src) && !broken;

  return (
    <Box
      data-testid={rest["data-testid"]}
      data-brand-avatar={showLogo ? "logo" : "initials"}
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.max(6, Math.round(size * 0.28)),
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: showLogo ? theme.palette.background.paper : avatarGradient(name),
        border: showLogo ? `1px solid ${theme.palette.divider}` : "none",
      }}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          draggable={false}
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Typography
          component="span"
          sx={{
            fontSize: Math.max(9, Math.round(size * 0.4)),
            fontWeight: 700,
            lineHeight: 1,
            color: "#FFFFFF",
            fontFamily: "var(--font-sans)",
            letterSpacing: "0.02em",
          }}
        >
          {brandInitials(name)}
        </Typography>
      )}
    </Box>
  );
}
