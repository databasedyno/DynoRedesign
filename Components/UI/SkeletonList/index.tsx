import React from "react";
import { Box, Skeleton } from "@mui/material";

interface SkeletonListProps {
  /** Number of placeholder rows to render. */
  rows?: number;
  /** Height of each row in px. */
  rowHeight?: number;
  /** Gap between rows in px. */
  gap?: number;
  testId?: string;
}

/**
 * Shared list/table loading placeholder. Renders a stack of rounded skeleton
 * rows so screens fade in with a shaped placeholder instead of a bare spinner.
 * Use anywhere a list is loading (replaces ad-hoc <CircularProgress>/<LinearProgress>).
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  rows = 5,
  rowHeight = 64,
  gap = 10,
  testId,
}) => (
  <Box
    data-testid={testId}
    sx={{ display: "flex", flexDirection: "column", gap: `${gap}px`, width: "100%" }}
  >
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} variant="rounded" animation="wave" height={rowHeight} sx={{ borderRadius: "12px" }} />
    ))}
  </Box>
);

export default SkeletonList;
