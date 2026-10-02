import React from "react";
import { Box, Typography } from "@mui/material";
import { useConsole, STATUS_PALETTE, statusTone, type StatusTone } from "./tokens";

interface StatusDotProps {
  /** Raw status string (mapped to a tone) … */
  status?: string | null;
  /** … or an explicit tone. */
  tone?: StatusTone;
  /** Override the label text (defaults to a title-cased status). */
  label?: React.ReactNode;
  testid?: string;
  size?: number;
}

const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Restrained status: a low-chroma dot + a quiet label. Replaces loud chips. */
const StatusDot: React.FC<StatusDotProps> = ({ status, tone, label, testid = "status-indicator", size = 7 }) => {
  const t = useConsole();
  const resolved: StatusTone = tone || statusTone(status);
  const pal = STATUS_PALETTE[resolved];
  const text = label ?? (status ? titleCase(String(status)) : titleCase(resolved));
  return (
    <Box
      data-testid={testid}
      data-tone={resolved}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, minWidth: 0 }}
    >
      <Box
        component="span"
        sx={{ width: size, height: size, borderRadius: "50%", bgcolor: pal.dot, flexShrink: 0, boxShadow: `0 0 0 3px ${pal.dot}1f` }}
      />
      <Typography
        component="span"
        sx={{ fontSize: 12.5, fontWeight: 500, color: t.isDark ? pal.dark : pal.light, whiteSpace: "nowrap" }}
      >
        {text}
      </Typography>
    </Box>
  );
};

export default StatusDot;
