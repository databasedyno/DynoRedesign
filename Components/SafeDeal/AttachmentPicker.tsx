import React, { useRef, useState } from "react";
import { Box, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_ACCENT } from "./sdTheme";
import type { SdAttachment } from "@/api/safedeal";
import { sdError } from "@/api/safedeal";

export const fileIcon = (type: string) => (type === "application/pdf" ? "mdi:file-pdf-box" : "mdi:file-image-outline");
export const fileSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Read-only list of evidence files; click opens (private, streamed with the session). */
export function AttachmentList({ files, onOpen, testid = "sd-files" }: { files: SdAttachment[]; onOpen: (id: number) => void; testid?: string }) {
  if (!files.length) return null;
  return (
    <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap data-testid={testid}>
      {files.map((f) => (
        <Chip
          key={f.attachment_id}
          size="small"
          icon={<Icon icon={fileIcon(f.type)} width={16} />}
          label={`${f.name} · ${fileSize(f.size)}`}
          onClick={() => onOpen(f.attachment_id)}
          data-testid={`${testid}-${f.attachment_id}`}
          sx={{ fontWeight: 700, maxWidth: 260, backgroundColor: "#F3F4F6", "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }}
        />
      ))}
    </Stack>
  );
}

interface PickerProps {
  upload: (file: File, onProgress?: (pct: number) => void) => Promise<SdAttachment>;
  value: SdAttachment[];
  onChange: (files: SdAttachment[]) => void;
  onError?: (msg: string) => void;
  max?: number;
  disabled?: boolean;
  compact?: boolean;
  testid?: string;
}

/** Pick images/PDFs (≤10 MB each, up to `max`); uploads immediately and reports pending attachment ids via onChange. */
export default function AttachmentPicker({ upload, value, onChange, onError, max = 5, disabled, compact, testid = "sd-attach" }: PickerProps) {
  const input = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const busy = Object.keys(progress).length > 0;

  const pick = async (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).slice(0, Math.max(0, max - value.length));
    if (!files.length) return onError?.(`You can attach up to ${max} files.`);
    const done: SdAttachment[] = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) { onError?.(`${f.name} is over 10 MB.`); continue; }
      setProgress((p) => ({ ...p, [f.name]: 0 }));
      try {
        done.push(await upload(f, (pct) => setProgress((p) => ({ ...p, [f.name]: pct }))));
      } catch (e) {
        onError?.(sdError(e));
      } finally {
        setProgress((p) => { const n = { ...p }; delete n[f.name]; return n; });
      }
    }
    if (done.length) onChange([...value, ...done]);
    if (input.current) input.current.value = "";
  };

  return (
    <Box data-testid={testid}>
      <input ref={input} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={(e) => void pick(e.target.files)} data-testid={`${testid}-input`} />
      <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
        {value.map((f) => (
          <Chip
            key={f.attachment_id}
            size="small"
            icon={<Icon icon={fileIcon(f.type)} width={16} />}
            label={`${f.name} · ${fileSize(f.size)}`}
            onDelete={disabled ? undefined : () => onChange(value.filter((x) => x.attachment_id !== f.attachment_id))}
            data-testid={`${testid}-file-${f.attachment_id}`}
            sx={{ fontWeight: 700, maxWidth: 240, "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }}
          />
        ))}
        {Object.entries(progress).map(([name, pct]) => (
          <Chip key={name} size="small" icon={<CircularProgress size={12} sx={{ color: SD_ACCENT }} />} label={`${name} · ${pct}%`} sx={{ fontWeight: 700 }} data-testid={`${testid}-uploading`} />
        ))}
        {value.length < max && (
          compact ? (
            <Tooltip title="Attach image or PDF (max 10 MB)">
              <IconButton size="small" disabled={disabled || busy} onClick={() => input.current?.click()} data-testid={`${testid}-add`} aria-label="Attach a file"><Icon icon="mdi:paperclip" width={20} /></IconButton>
            </Tooltip>
          ) : (
            <Chip
              size="small"
              variant="outlined"
              icon={<Icon icon="mdi:paperclip" width={16} />}
              label={value.length ? "Add another" : "Attach files"}
              onClick={() => input.current?.click()}
              disabled={disabled || busy}
              data-testid={`${testid}-add`}
              sx={{ fontWeight: 700, borderColor: SD_ACCENT, color: SD_ACCENT, borderStyle: "dashed" }}
            />
          )
        )}
      </Stack>
      {!compact && <Typography sx={{ fontSize: 11.5, color: "#9CA3AF", mt: 0.6 }}>PNG, JPG, WEBP, GIF or PDF · up to {max} files · 10 MB each</Typography>}
    </Box>
  );
}
