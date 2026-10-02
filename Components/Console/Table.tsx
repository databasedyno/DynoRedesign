import React from "react";
import { Box, Typography } from "@mui/material";
import { useConsole, NUM_SX } from "./tokens";
import TableSkeleton from "./TableSkeleton";

/** Flat surface card with a hairline border — the console's content container. */
export const ConsoleCard: React.FC<{ children: React.ReactNode; sx?: object; testid?: string }> = ({ children, sx, testid }) => {
  const t = useConsole();
  return (
    <Box
      data-testid={testid}
      sx={{ bgcolor: t.surface, border: `1px solid ${t.hairline}`, borderRadius: "12px", overflow: "hidden", ...sx }}
    >
      {children}
    </Box>
  );
};

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  /** CSS grid track: a px number, a fr string ("2fr"), or omitted for "minmax(0,1fr)". */
  width?: number | string;
  render: (row: T) => React.ReactNode;
}

export interface TableGroup<T> {
  label?: string;
  rows: T[];
}

interface StatementTableProps<T> {
  columns: Column<T>[];
  groups: TableGroup<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  activeRowKey?: string | null;
  loading?: boolean;
  empty?: React.ReactNode;
  testid?: string;
  rowTestId?: (row: T) => string;
}

const track = (c: { width?: number | string }): string =>
  c.width == null ? "minmax(0,1fr)" : typeof c.width === "number" ? `${c.width}px` : c.width;

/** Financial-statement table: pinned header, date-grouped airy rows, calm hover, right-aligned tabular numbers. */
function StatementTable<T>({
  columns,
  groups,
  rowKey,
  onRowClick,
  activeRowKey,
  loading,
  empty,
  testid = "data-table",
  rowTestId,
}: StatementTableProps<T>) {
  const t = useConsole();
  const grid = columns.map(track).join(" ");
  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <ConsoleCard testid={testid}>
      {/* Pinned header */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: grid,
          gap: 2,
          px: 2,
          py: 1.25,
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: t.surface,
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        {columns.map((c) => (
          <Typography
            key={c.key}
            sx={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: t.inkMuted,
              textAlign: c.align || "left",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {c.label}
          </Typography>
        ))}
      </Box>

      {loading ? (
        <TableSkeleton rows={7} columns={columns.map((c) => (c.width && typeof c.width === "number" ? 1 : 2))} />
      ) : totalRows === 0 ? (
        <Box data-testid={`${testid}-empty`}>{empty}</Box>
      ) : (
        groups.map((g, gi) => (
          <Box key={g.label || gi}>
            {g.label && (
              <Box
                data-testid={`date-group-${g.label}`}
                sx={{ px: 2, py: 0.85, bgcolor: t.isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.015)", borderBottom: `1px solid ${t.hairline}` }}
              >
                <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: t.inkSecondary, letterSpacing: "0.02em" }}>
                  {g.label}
                </Typography>
              </Box>
            )}
            {g.rows.map((row) => {
              const k = rowKey(row);
              const active = activeRowKey === k;
              return (
                <Box
                  key={k}
                  data-testid={rowTestId ? rowTestId(row) : `${testid}-row-${k}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: grid,
                    gap: 2,
                    alignItems: "center",
                    px: 2,
                    minHeight: 56,
                    cursor: onRowClick ? "pointer" : "default",
                    borderBottom: `1px solid ${t.hairline}`,
                    bgcolor: active ? (t.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)") : "transparent",
                    transition: "background-color .12s ease",
                    "&:hover": onRowClick ? { bgcolor: t.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" } : {},
                    "&:last-of-type": { borderBottom: "none" },
                  }}
                >
                  {columns.map((c) => (
                    <Box
                      key={c.key}
                      sx={{
                        minWidth: 0,
                        textAlign: c.align || "left",
                        display: "flex",
                        justifyContent: c.align === "right" ? "flex-end" : "flex-start",
                        alignItems: "center",
                      }}
                    >
                      {c.render(row)}
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Box>
        ))
      )}
    </ConsoleCard>
  );
}

/** Tabular, right-alignable figure. `balance` renders muted to distinguish from amounts. */
export const NumberText: React.FC<{ children: React.ReactNode; balance?: boolean; strong?: boolean; sx?: object }> = ({
  children,
  balance,
  strong,
  sx,
}) => {
  const t = useConsole();
  return (
    <Typography
      component="span"
      sx={{
        fontSize: 13.5,
        fontWeight: strong ? 600 : 400,
        color: balance ? t.inkMuted : t.ink,
        ...NUM_SX,
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
};

export default StatementTable;
