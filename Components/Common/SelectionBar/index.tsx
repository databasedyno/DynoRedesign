/**
 * SelectionBar — the console-styled action strip that appears above a table
 * when one or more rows are selected (bulk actions). Quiet hairline surface,
 * a count, an optional "select page" shortcut, caller-supplied actions and a
 * clear button. Renders nothing when the selection is empty.
 */
import React from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { Icon } from "@/styles/uiKit";

export interface SelectionAction {
  label: string;
  onClick: () => void;
  testid?: string;
  icon?: string;
  disabled?: boolean;
}

interface SelectionBarProps {
  count: number;
  actions: SelectionAction[];
  onClear: () => void;
  onSelectPage?: () => void;
  pageAllSelected?: boolean;
  labels?: { selected?: string; selectPage?: string; clear?: string };
  testid?: string;
}

const SelectionBar: React.FC<SelectionBarProps> = ({
  count,
  actions,
  onClear,
  onSelectPage,
  pageAllSelected,
  labels,
  testid = "selection-bar",
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  if (count <= 0) return null;

  const selectedLabel = (labels?.selected || "{{n}} selected").replace("{{n}}", String(count));

  return (
    <Box
      data-testid={testid}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        flexWrap: "wrap",
        px: 2,
        py: 1,
        mb: 1,
        mx: { xs: 2, md: 0 },
        borderRadius: "10px",
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: isDark ? "rgba(255,209,0,0.06)" : "rgba(139,94,0,0.045)",
      }}
    >
      <Typography
        data-testid={`${testid}-count`}
        sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 700, color: theme.palette.text.primary }}
      >
        {selectedLabel}
      </Typography>
      {onSelectPage && !pageAllSelected && (
        <Button
          size="small"
          variant="text"
          data-testid={`${testid}-select-page`}
          onClick={onSelectPage}
          sx={{ textTransform: "none", fontSize: 12.5, minHeight: 32, color: theme.palette.text.secondary }}
        >
          {labels?.selectPage || "Select page"}
        </Button>
      )}
      <Box sx={{ flex: 1 }} />
      {actions.map((a) => (
        <Button
          key={a.label}
          size="small"
          variant="outlined"
          data-testid={a.testid}
          onClick={a.onClick}
          disabled={a.disabled}
          startIcon={a.icon ? <Icon name={a.icon} size={15} /> : undefined}
          sx={{
            textTransform: "none",
            fontSize: 12.5,
            fontWeight: 600,
            minHeight: 32,
            borderRadius: "8px",
            borderColor: theme.palette.divider,
            color: theme.palette.text.primary,
            "&:hover": { borderColor: theme.palette.text.secondary, backgroundColor: theme.palette.action.hover },
          }}
        >
          {a.label}
        </Button>
      ))}
      <Button
        size="small"
        variant="text"
        data-testid={`${testid}-clear`}
        onClick={onClear}
        sx={{ textTransform: "none", fontSize: 12.5, minHeight: 32, color: theme.palette.text.secondary }}
      >
        {labels?.clear || "Clear"}
      </Button>
    </Box>
  );
};

export default SelectionBar;
