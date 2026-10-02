import React, { useEffect, useState } from "react";
import { Box, Chip, Typography, TextField, Switch, MenuItem, Button, Tooltip } from "@mui/material";
import { RestartAltRounded } from "@mui/icons-material";
import { PlatformSetting } from "@/api/platformSettings";

export const SourceChip: React.FC<{ source: string; testid?: string }> = ({ source, testid }) => {
  const map: Record<string, { label: string; color: "primary" | "default" | "info" }> = {
    override: { label: "Override", color: "primary" },
    env: { label: "Environment", color: "info" },
    default: { label: "Default", color: "default" },
  };
  const m = map[source] || map.default;
  return (
    <Chip
      size="small"
      label={m.label}
      color={m.color}
      variant={m.color === "default" ? "outlined" : "filled"}
      sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }}
      data-testid={testid}
      data-source={source}
    />
  );
};

const normalize = (s: PlatformSetting, v: unknown): string | boolean => {
  if (s.type === "boolean") return v === true || v === "true";
  return v == null ? "" : String(v);
};

interface Props {
  setting: PlatformSetting;
  onSave: (s: PlatformSetting, newValue: unknown) => void;
  onRevert: (s: PlatformSetting) => void;
}

const SettingRow: React.FC<Props> = ({ setting: s, onSave, onRevert }) => {
  const [draft, setDraft] = useState<string | boolean>(normalize(s, s.value));

  useEffect(() => {
    setDraft(normalize(s, s.value));
  }, [s.value, s.type]);

  const current = normalize(s, s.value);
  const changed = draft !== current;

  const commit = () => {
    const out = s.type === "boolean" ? !!draft : s.type === "number" ? Number(draft) : String(draft);
    onSave(s, out);
  };

  const editor = () => {
    if (!s.editable) {
      return (
        <Typography data-testid={`ps-row-${s.key}-readonly`} sx={{ fontSize: 14, fontWeight: 600, fontFamily: "monospace", wordBreak: "break-all" }}>
          {s.type === "boolean" ? (s.value ? "On" : "Off") : String(s.value || "—")}
          {s.unit ? ` ${s.unit}` : ""}
        </Typography>
      );
    }
    if (s.type === "boolean") {
      return (
        <Switch
          checked={!!draft}
          onChange={(e) => setDraft(e.target.checked)}
          data-testid={`ps-row-${s.key}-input`}
        />
      );
    }
    if (s.type === "enum") {
      return (
        <TextField select size="small" value={String(draft)} onChange={(e) => setDraft(e.target.value)}
          sx={{ minWidth: 160 }} inputProps={{ "data-testid": `ps-row-${s.key}-input` }}>
          {(s.enumValues || []).map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
        </TextField>
      );
    }
    return (
      <TextField
        size="small"
        type={s.type === "number" ? "number" : "text"}
        value={String(draft)}
        onChange={(e) => setDraft(e.target.value)}
        InputProps={{ endAdornment: s.unit ? <Typography sx={{ fontSize: 12, color: "text.secondary", pl: 0.5 }}>{s.unit}</Typography> : undefined }}
        inputProps={{ "data-testid": `ps-row-${s.key}-input`, min: s.min, max: s.max }}
        sx={{ minWidth: 180 }}
      />
    );
  };

  return (
    <Box
      data-testid={`ps-row-${s.key}`}
      sx={{
        display: "flex", alignItems: "center", gap: 2, py: 1.75, px: 0.5,
        borderBottom: "1px solid", borderColor: "divider", flexWrap: "wrap",
      }}
    >
      <Box sx={{ flex: "1 1 280px", minWidth: 220 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{s.label}</Typography>
          <SourceChip source={s.source} testid={`ps-row-${s.key}-source`} />
          {!s.editable && (
            <Tooltip title={`Managed in .env${s.env_key ? ` (${s.env_key})` : ""}`}>
              <Chip size="small" label="Read-only" variant="outlined" sx={{ height: 20, fontSize: 10.5 }} />
            </Tooltip>
          )}
        </Box>
        {s.description && <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>{s.description}</Typography>}
        <Typography sx={{ fontSize: 10.5, color: "text.disabled", fontFamily: "monospace", mt: 0.25 }}>
          {s.key}{s.updated_by ? ` · changed by ${s.updated_by}` : ""}
        </Typography>
      </Box>

      <Box sx={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 1 }}>
        {editor()}
      </Box>

      {s.editable && (
        <Box sx={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
          {s.source === "override" && (
            <Tooltip title="Revert to environment default">
              <Button size="small" color="inherit" onClick={() => onRevert(s)} data-testid={`ps-row-${s.key}-revert`}
                sx={{ minWidth: 0, textTransform: "none" }}>
                <RestartAltRounded fontSize="small" />
              </Button>
            </Tooltip>
          )}
          <Button
            size="small"
            variant="contained"
            disableElevation
            disabled={!changed}
            onClick={commit}
            data-testid={`ps-row-${s.key}-save`}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Save
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default SettingRow;
