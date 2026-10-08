import React from "react";
import { Box, Collapse, Typography, useTheme } from "@mui/material";
import { Icon } from "@/styles/uiKit";

interface Props {
  id: string;
  title: string;
  summary?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** One collapsible block of the page editor: a quiet header row (title · current value · chevron). */
const EditorSection: React.FC<Props> = ({ id, title, summary, open, onToggle, children }) => {
  const theme = useTheme();
  const border = theme.palette.divider;
  return (
    <Box
      id={`editor-${id}`}
      data-testid={`editor-section-${id}`}
      data-open={open ? "true" : "false"}
      sx={{ borderRadius: "12px", border: `1px solid ${border}`, backgroundColor: theme.palette.background.paper, scrollMarginTop: 96 }}
    >
      <Box
        component="button"
        type="button"
        data-testid={`editor-section-${id}-toggle`}
        aria-expanded={open}
        aria-controls={`editor-${id}-body`}
        onClick={onToggle}
        sx={{
          all: "unset",
          boxSizing: "border-box",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.75,
          cursor: "pointer",
          borderRadius: "12px",
          transition: "background-color 150ms ease",
          "&:hover": { backgroundColor: theme.palette.action.hover },
          "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
        }}
      >
        {/* Phones: the summary sits UNDER the title and may wrap (it was ellipsised to
            "Custom theme · cov…" at 360–393px — UX audit C6). ≥ 600: one row, right-aligned. */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, gap: { xs: 0.25, sm: 1.5 } }}>
          <Typography component="h3" sx={{ m: 0, flexShrink: 0, fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, color: theme.palette.text.primary }}>
            {title}
          </Typography>
          <Typography
            component="span"
            data-testid={`editor-section-${id}-summary`}
            sx={{ flex: 1, minWidth: 0, maxWidth: "100%", textAlign: { xs: "left", sm: "right" }, fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.text.secondary, whiteSpace: { xs: "normal", sm: "nowrap" }, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {summary}
          </Typography>
        </Box>
        <Box sx={{ display: "inline-flex", color: theme.palette.text.secondary, transition: "transform 200ms ease", transform: open ? "rotate(180deg)" : "none" }}>
          <Icon name="chevron-down" size={18} />
        </Box>
      </Box>
      <Collapse in={open} timeout={200}>
        <Box id={`editor-${id}-body`} sx={{ px: 2, pb: 2.25, pt: 0.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
};

export default EditorSection;
