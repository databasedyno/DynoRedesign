import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography } from "@mui/material";
import { SxProps, Theme } from "@mui/system";
import React from "react";

export interface TitleDescriptionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center" | "right";
  titleVariant?:
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "subtitle1"
    | "subtitle2"
    | "body1"
    | "body2";
  descriptionVariant?: "body1" | "body2" | "subtitle1" | "subtitle2" | "p";
  gutterBottom?: boolean;
  divider?: boolean;
  sx?: SxProps<Theme>;
  // Legacy props used by register.tsx and a few auth flows — the
  // component ignores them silently, kept for backward-compatibility
  // rather than sweeping all call sites in one PR.
  descriptionFontSize?: string;
  descriptionColor?: string;
}

const TitleDescription: React.FC<TitleDescriptionProps> = ({
  title,
  description,
  align = "left",
  titleVariant,
  sx,
}) => {
  const isMobile = useIsMobile("sm");
  if (!title && !description) return null;

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        textAlign: align,
        gap: isMobile ? "10px" : "12px",
        ...sx,
      }}
    >
      {title ? (
        <Typography
          /* F16: promote the auth screen title to a semantic h1 by default
             (was: div). Login / register / secure-account etc. previously
             had no h1 which failed WCAG page-heading semantics. Callers can
             still override via `titleVariant` if they use it as a subtitle. */
          component={(titleVariant as any) || "h1"}
          sx={{
            fontSize: "19px",
            fontFamily: "var(--font-hero), var(--font-sans)",
            fontWeight: 500,
            color: "text.primary",
            lineHeight: "1.25",
            letterSpacing: "-0.01em",
            m: 0,
            ...(isMobile && { fontSize: "18px" }),
          }}
        >
          {title}
        </Typography>
      ) : null}

      {description ? (
        <Typography
          sx={{
            fontSize: "14.5px",
            fontFamily: "var(--font-body), var(--font-sans)",
            color: "text.secondary",
            lineHeight: "1.5",
            letterSpacing: 0,
            ...(isMobile && { fontSize: "14px" }),
          }}
        >
          {description}
        </Typography>
      ) : null}
    </Box>
  );
};

export default TitleDescription;
