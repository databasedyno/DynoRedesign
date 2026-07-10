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
}

const TitleDescription: React.FC<TitleDescriptionProps> = ({
  title,
  description,
  align = "left",
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
          component="div"
          sx={{
            fontSize: "19px",
            fontFamily: "var(--font-hero), var(--font-sans)",
            fontWeight: 500,
            color: "text.primary",
            lineHeight: "1.25",
            letterSpacing: "-0.01em",
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
