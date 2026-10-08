import React from "react";
import { Box } from "@mui/material";

/**
 * Right-aligned money that never loses its leading digits (UX audit S1): the
 * auto margin collapses instead of overflowing to the left, and the coin unit
 * wraps onto its own line before the number is ever cut.
 */
const AmountText: React.FC<{ value: React.ReactNode; testId?: string; align?: "start" | "end" }> = ({ value, testId, align = "end" }) => {
  const end = align === "end";
  if (typeof value !== "string") {
    return <Box component="span" data-testid={testId} sx={{ ml: end ? "auto" : 0, minWidth: 0, textAlign: end ? "right" : "left" }}>{value}</Box>;
  }
  const i = value.indexOf(" ");
  const num = i < 0 ? value : value.slice(0, i);
  const unit = i < 0 ? "" : value.slice(i + 1);
  return (
    <Box
      component="span"
      data-testid={testId}
      sx={{ ml: end ? "auto" : 0, minWidth: 0, display: "inline-flex", flexWrap: "wrap", justifyContent: end ? "flex-end" : "flex-start", columnGap: "0.35em", rowGap: "2px", textAlign: end ? "right" : "left", lineHeight: 1.25, whiteSpace: "normal" }}
    >
      <span style={{ whiteSpace: "nowrap" }}>{num}</span>
      {unit && <span style={{ whiteSpace: "nowrap", opacity: 0.72, fontSize: "0.92em" }}>{unit}</span>}
    </Box>
  );
};

export default AmountText;
