import CustomButton from "@/Components/UI/Buttons";
import { Icon } from "@/styles/uiKit";
import { Box, Typography, useTheme } from "@mui/material";
import React from "react";
import { Tw, tone } from "./types";

export type ChangeCounts = { edits: number; removals: number; adds: number; invalid: number; drafts: number };

interface Props {
  counts: ChangeCounts;
  justCopied?: number;
  saving: boolean;
  confirmDiscard: boolean;
  onClose: () => void;
  onDiscardConfirm: () => void;
  onKeepEditing: () => void;
  onSave: () => void;
  onDone?: () => void;
  tw: Tw;
}

export const ManagerFooter: React.FC<Props> = ({ counts, justCopied = 0, saving, confirmDiscard, onClose, onDiscardConfirm, onKeepEditing, onSave, onDone, tw }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const c = tone(dark);
  const pending = counts.edits + counts.removals + counts.adds;
  const border = theme.palette.border?.main || theme.palette.divider;
  // Wallets copied from another brand are saved instantly (no pending change).
  // When that's the only thing that happened, show a success line + an enabled
  // "Done" button instead of a disabled "Save changes" / "nothing to save".
  const copiedOnly = pending === 0 && justCopied > 0;

  const items = [
    { n: counts.adds, dot: c.emerald, label: tw("countNew", "{{n}} new", { n: counts.adds }) },
    { n: counts.edits, dot: c.indigo, label: tw("countEdits", "{{n}} edited", { n: counts.edits }) },
    { n: counts.removals, dot: c.rose, label: tw("countRemovals", "{{n}} removed", { n: counts.removals }) },
  ].filter((i) => i.n > 0);

  return (
    <Box
      data-testid="wallet-manager-footer"
      sx={{
        px: { xs: 2, sm: 3 },
        py: 1.75,
        borderTop: `1px solid ${border}`,
        backgroundColor: dark ? "rgba(24,24,27,0.85)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      {confirmDiscard ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }} data-testid="wallet-manager-discard-confirm">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Icon name="circle-alert" size={16} color={c.amber} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-sans)" }}>
              {tw("discardPrompt", "Discard {{n}} unsaved changes?", { n: pending })}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <CustomButton label={tw("keepEditing", "Keep editing")} variant="outlined" size="small" onClick={onKeepEditing} data-testid="wallet-manager-keep-editing-btn" sx={{ height: 36 }} />
            <CustomButton label={tw("discard", "Discard")} variant="danger" size="small" onClick={onDiscardConfirm} data-testid="wallet-manager-discard-btn" sx={{ height: 36 }} />
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 18, flexWrap: "wrap" }} data-testid="wallet-manager-summary">
            {items.length === 0 ? (
              copiedOnly ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }} data-testid="wallet-manager-copied-success">
                  <Icon name="check" size={14} color={c.emerald} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-sans)", color: c.emerald }}>
                    {tw("copiedSaved", "{{n}} wallets copied and saved to this brand", { n: justCopied })}
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                  {counts.drafts > 0
                    ? tw("summaryDrafts", "Finish the new wallet rows to include them")
                    : tw("summaryNone", "No changes yet — edit a wallet or add a network")}
                </Typography>
              )
            ) : (
              items.map((i) => (
                <Box key={i.label} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: i.dot }} />
                  <Typography sx={{ fontSize: 12.5, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>{i.label}</Typography>
                </Box>
              ))
            )}
            {counts.invalid > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, ml: "auto" }} data-testid="wallet-manager-invalid-count">
                <Icon name="circle-alert" size={13} color={c.amber} />
                <Typography sx={{ fontSize: 12.5, fontFamily: "var(--font-sans)", color: c.amber }}>
                  {tw("countInvalid", "{{n}} address looks off", { n: counts.invalid })}
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {copiedOnly ? (
              <CustomButton
                label={tw("done", "Done")}
                variant="primary"
                onClick={onDone || onClose}
                disabled={saving}
                startIcon={<Icon name="check" size={16} />}
                sx={{ flex: 1 }}
                data-testid="wallet-manager-done-btn"
              />
            ) : (
              <>
                <CustomButton
                  label={pending > 0 ? tw("discard", "Discard") : tw("close", "Close")}
                  variant="outlined"
                  onClick={onClose}
                  disabled={saving}
                  sx={{ flex: 1 }}
                  data-testid="wallet-manager-close-btn"
                />
                <CustomButton
                  label={pending > 0 ? tw("saveChangesCount", "Save {{n}} changes", { n: pending }) : tw("saveChanges", "Save changes")}
                  variant="primary"
                  onClick={onSave}
                  disabled={pending === 0 || counts.invalid > 0}
                  loading={saving}
                  startIcon={<Icon name="check" size={16} />}
                  sx={{ flex: 1.5 }}
                  data-testid="wallet-manager-save-btn"
                />
              </>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};
