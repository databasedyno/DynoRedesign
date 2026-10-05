import React from "react";
import { Box, Tooltip } from "@mui/material";
import { Icon } from "@/styles/uiKit";

/** Small ⓘ next to a figure's label — explains exactly what a total counts (gross / net / settled). */
const InfoHint: React.FC<{ text: string; testId?: string; size?: number }> = ({ text, testId, size = 13 }) => (
  <Tooltip title={text} arrow placement="top" enterTouchDelay={0}>
    <Box
      component="button"
      type="button"
      aria-label={text}
      data-testid={testId}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      sx={{
        all: "unset",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        ml: 0.5,
        cursor: "help",
        color: "text.secondary",
        opacity: 0.75,
        borderRadius: "50%",
        "&:hover": { opacity: 1 },
        "&:focus-visible": { outline: "2px solid currentColor", outlineOffset: 2 },
      }}
    >
      <Icon name="info" size={size} />
    </Box>
  </Tooltip>
);

export default InfoHint;
