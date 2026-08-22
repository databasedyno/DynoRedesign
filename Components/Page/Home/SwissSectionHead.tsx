import React, { memo, useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { FONT_BODY, FONT_HERO, FONT_TECH, useSwiss } from "./swiss";

interface Props {
  num?: string;
  eyebrow: string;
  title: string;
  highlight?: string;
  sub?: string;
  align?: "left" | "center";
  invert?: boolean;
}

const SwissSectionHead: React.FC<Props> = ({ num, eyebrow, title, highlight, sub, align = "center", invert = false }) => {
  const s = useSwiss();
  const txt = invert ? "#F5F5F5" : s.txt;
  const subColor = invert ? "rgba(255,255,255,0.6)" : s.sub;
  const accent = invert ? "#818CF8" : s.accentText;

  const renderedTitle = useMemo<React.ReactNode>(() => {
    if (!highlight || !title.includes(highlight)) return title;
    const parts = title.split(highlight);
    return (
      <>
        {parts[0]}
        <Box component="span" sx={{ color: accent }}>{highlight}</Box>
        {parts[1]}
      </>
    );
  }, [title, highlight, accent]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align,
        mb: { xs: 5, md: 8 },
      }}
    >
      <Typography
        component="p"
        sx={{
          fontFamily: FONT_TECH,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: accent,
          mb: 2,
        }}
      >
        {num ? `${num} / ${eyebrow}` : eyebrow}
      </Typography>
      <Typography
        component="h2"
        sx={{
          fontFamily: FONT_HERO,
          fontWeight: 600,
          fontSize: { xs: 24, sm: 30, md: 38 },
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          color: txt,
          maxWidth: 760,
        }}
      >
        {renderedTitle}
      </Typography>
      {sub ? (
        <Typography
          sx={{
            fontFamily: FONT_BODY,
            fontSize: { xs: 14.5, md: 16.5 },
            lineHeight: 1.6,
            color: subColor,
            maxWidth: 620,
            mt: 2,
          }}
        >
          {sub}
        </Typography>
      ) : null}
    </Box>
  );
};

export default memo(SwissSectionHead);
