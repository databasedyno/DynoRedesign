import type { Breakpoint } from "@mui/material";
import { useMediaQuery, useTheme } from "@mui/material";
import { useMemo } from "react";

export default function useIsMobile(breakpoint: Breakpoint = "sm"): boolean {
  const theme = useTheme();

  const query = useMemo(
    () => theme.breakpoints.down(breakpoint),
    [theme, breakpoint],
  );

  const matches = useMediaQuery(query, {
    defaultMatches: false,
  });

  return matches;
}
