import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_ACCENT } from "./sdTheme";

export interface SdChoiceOption<T extends string> { v: T; label: string; sub?: string; icon?: string }

/** Selectable cards used for role / fee payer / deal type. */
export default function SdChoice<T extends string>({ value, onChange, options, testid, columns }: {
  value: T | null;
  onChange: (v: T) => void;
  options: SdChoiceOption<T>[];
  testid: string;
  columns?: number;
}) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", sm: `repeat(${columns || options.length}, minmax(0, 1fr))` } }} role="radiogroup" data-testid={testid}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Box
            key={o.v}
            role="radio"
            aria-checked={on}
            tabIndex={0}
            onClick={() => onChange(o.v)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(o.v)}
            data-testid={`${testid}-${o.v}`}
            data-selected={on ? "true" : "false"}
            sx={{ p: 1.4, borderRadius: 2.5, cursor: "pointer", border: `1.5px solid ${on ? SD_ACCENT : "#E5E7EB"}`, backgroundColor: on ? `${SD_ACCENT}0F` : "#fff", transition: "border-color .15s, background-color .15s", "&:focus-visible": { outline: `3px solid ${SD_ACCENT}33` } }}
          >
            <Stack direction="row" spacing={0.8} alignItems="center">
              {o.icon && <Icon icon={o.icon} width={18} color={on ? SD_ACCENT : "#6B7280"} />}
              <Typography sx={{ fontWeight: 800, fontSize: 14, color: on ? SD_ACCENT : "#111827" }}>{o.label}</Typography>
            </Stack>
            {o.sub && <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 0.3 }}>{o.sub}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}
