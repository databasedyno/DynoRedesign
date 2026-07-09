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
            fontSize: "20px",
            fontFamily: "var(--font-sans)",
            color: "text.primary",
            lineHeight: "1.2",
            letterSpacing: 0,
            ...(isMobile && { fontSize: "20px" }),
          }}
        >
          {title}
        </Typography>
      ) : null}

      {description ? (
        <Typography
          sx={{
            fontSize: "15px",
            fontFamily: "var(--font-sans)",
            color: "text.secondary",
            lineHeight: "1.4",
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
