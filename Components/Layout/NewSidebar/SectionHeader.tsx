import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import { useTheme } from "@mui/material";
import React from "react";
import { SectionToggle } from "./styled";

interface Props {
  sectionKey: string;
  label: string;
  open: boolean;
  count: number;
  onToggle: () => void;
}

/** Group caption that folds its rows — chevron rotates, count shows while folded. */
export const SectionHeader = ({ sectionKey, label, open, count, onToggle }: Props) => {
  const theme = useTheme();
  return (
    <SectionToggle
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`sidebar-section-${sectionKey}`}
      data-testid={`sidebar-section-toggle-${sectionKey}`}
      data-open={open ? "true" : "false"}
    >
      <span>{label}</span>
      {!open && (
        <span
          data-testid={`sidebar-section-count-${sectionKey}`}
          style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0, color: theme.palette.text.disabled, marginLeft: "auto" }}
        >
          {count}
        </span>
      )}
      <ExpandMoreRounded
        sx={{
          fontSize: 16,
          marginLeft: open ? "auto" : "6px",
          color: theme.palette.text.secondary,
          transition: "transform 180ms ease",
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        }}
      />
    </SectionToggle>
  );
};
