import { ReactNode } from "react";
import {
  Box,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { Icon } from "@/styles/uiKit";

/** Shared primitives for the API-page "keyed resource" sections (publishable keys, buy buttons). */

export const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Merchant-facing copy-paste snippets must always point at the canonical host,
// never the preview/dev origin.
export const SNIPPET_BASE =
  ((process.env.NEXT_PUBLIC_BASE_URL as string) || "").replace(/\/+$/, "") ||
  "https://checkout.dynopay.com";

export const parseTokens = (raw: string): string[] =>
  raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

export const upperTokens = (raw: string): string[] => parseTokens(raw).map((c) => c.toUpperCase());

export const describeLoadError = (err: unknown, fallback: string): string | null => {
  if (!err) return null;
  const e = err as any;
  return e?.response?.data?.message || e?.message || fallback;
};

export const SectionLabel = ({ children, mt }: { children: ReactNode; mt?: number }) => {
  const theme = useTheme();
  return (
    <Typography
      sx={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: theme.palette.text.secondary,
        mt,
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
};

export const MetaChip = ({ label }: { label: string }) => (
  <Chip size="small" label={label} sx={{ height: 22, fontSize: 11 }} />
);

export const TokenChips = ({ tokens, mt }: { tokens: string[]; mt?: number }) => (
  <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mt }}>
    {tokens.map((x) => (
      <MetaChip key={x} label={x} />
    ))}
  </Stack>
);

interface RowActionButtonProps {
  title: string;
  testId: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}

export const RowActionButton = ({ title, testId, icon, onClick, disabled, color }: RowActionButtonProps) => {
  const theme = useTheme();
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          data-testid={testId}
          aria-label={title}
          disabled={disabled}
          onClick={onClick}
          sx={{ color: color || theme.palette.text.secondary }}
        >
          <Icon name={icon} size={18} />
        </IconButton>
      </span>
    </Tooltip>
  );
};

interface SnippetPreProps {
  code: string;
  onCopy: () => void;
  suffixLabel: string;
  copyLabel: string;
}

export const SnippetPre = ({ code, onCopy, suffixLabel, copyLabel }: SnippetPreProps) => {
  const theme = useTheme();
  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
          }}
        >
          &lt;dynopay-buy-button&gt; {suffixLabel}
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={onCopy}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            border: `1px solid ${theme.palette.border.main}`,
            background: "transparent",
            color: theme.palette.text.secondary,
            borderRadius: "6px",
            px: 1,
            py: 0.4,
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
            "&:hover": { color: theme.palette.text.primary },
          }}
        >
          <Icon name="copy" size={14} />
          {copyLabel}
        </Box>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          borderRadius: "8px",
          overflowX: "auto",
          background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#0b0b0b",
          color: theme.palette.mode === "dark" ? "#d6f7c2" : "#e6e6e6",
          fontSize: 12.5,
          lineHeight: 1.6,
          fontFamily: MONO_FONT,
          whiteSpace: "pre",
          border: `1px solid ${theme.palette.border.main}`,
        }}
      >
        {code}
      </Box>
    </Box>
  );
};

export const FieldHint = ({ children, error }: { children: ReactNode; error?: boolean }) => {
  const theme = useTheme();
  return (
    <Typography
      sx={{
        mt: -1,
        fontSize: 12,
        color: error ? theme.palette.error.main : theme.palette.text.secondary,
      }}
    >
      {children}
    </Typography>
  );
};

interface LabeledSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  testId?: string;
}

export const LabeledSelect = ({ label, value, onChange, options, testId }: LabeledSelectProps) => {
  const theme = useTheme();
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 500, color: theme.palette.text.secondary, mb: 0.5 }}>
        {label}
      </Typography>
      <Select
        fullWidth
        size="small"
        value={value}
        onChange={(e) => onChange(String(e.target.value))}
        data-testid={testId}
        sx={{ fontFamily: "var(--font-sans)", fontSize: 14, borderRadius: "8px" }}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
};
