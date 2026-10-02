import React from "react";
import { Box, Skeleton } from "@mui/material";
import { useConsole } from "./tokens";

interface TableSkeletonProps {
  rows?: number;
  /** Relative column widths, e.g. [3, 2, 2, 1]. Last column right-aligns. */
  columns?: number[];
  testid?: string;
}

/** Row-height-matched skeleton for statement tables while data loads. */
const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 8, columns = [3, 2, 2, 1], testid = "table-skeleton" }) => {
  const t = useConsole();
  return (
    <Box data-testid={testid}>
      {Array.from({ length: rows }).map((_, r) => (
        <Box
          key={r}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            px: 2,
            height: 56,
            borderBottom: `1px solid ${t.hairline}`,
          }}
        >
          {columns.map((w, c) => (
            <Box key={c} sx={{ flex: w, display: "flex", justifyContent: c === columns.length - 1 ? "flex-end" : "flex-start" }}>
              <Skeleton variant="rounded" width={`${Math.min(90, 40 + w * 15)}%`} height={14} sx={{ borderRadius: "6px" }} />
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default TableSkeleton;
