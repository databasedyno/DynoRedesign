import React from "react";
import { Box, InputBase } from "@mui/material";
import { Icon } from "@/styles/uiKit";
import { useConsole } from "./tokens";

interface FilterBarProps {
  search?: { value: string; onChange: (v: string) => void; placeholder?: string; testid?: string };
  /** Extra filters (status dropdowns, date range) rendered inline. */
  children?: React.ReactNode;
  /** Right-aligned action (e.g. export). */
  action?: React.ReactNode;
  sticky?: boolean;
  testid?: string;
}

/** One quiet toolbar pattern: search + inline filters + optional action. */
const FilterBar: React.FC<FilterBarProps> = ({ search, children, action, sticky, testid = "filter-bar" }) => {
  const t = useConsole();
  return (
    <Box
      data-testid={testid}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        flexWrap: "wrap",
        mb: 2,
        ...(sticky
          ? {
              position: "sticky",
              top: 0,
              zIndex: 2,
              py: 1.5,
              backdropFilter: "blur(12px)",
              backgroundColor: t.isDark ? "rgba(26,26,25,0.72)" : "rgba(255,255,255,0.72)",
            }
          : {}),
      }}
    >
      {search && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            height: 38,
            flex: { xs: "1 1 100%", sm: "0 1 320px" },
            borderRadius: "8px",
            border: `1px solid ${t.border}`,
            bgcolor: t.surface,
            transition: "border-color .15s ease, box-shadow .15s ease",
            "&:focus-within": { borderColor: t.accent, boxShadow: `0 0 0 3px ${t.accent}26` },
          }}
        >
          <Icon name="search" size={16} color={t.inkMuted} />
          <InputBase
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder || "Search…"}
            inputProps={{ "data-testid": search.testid || "filter-search" }}
            sx={{ fontSize: 13.5, color: t.ink, flex: 1, "& input::placeholder": { color: t.inkMuted, opacity: 1 } }}
          />
        </Box>
      )}
      {children}
      {action && <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>{action}</Box>}
    </Box>
  );
};

export default FilterBar;
