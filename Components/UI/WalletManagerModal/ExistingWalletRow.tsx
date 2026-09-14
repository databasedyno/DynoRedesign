import InputField from "@/Components/UI/AuthLayout/InputFields";
import SharedAddressTag from "@/Components/UI/SharedAddressTag";
import { Icon } from "@/styles/uiKit";
import type { WalletDataType } from "@/utils/types/wallet";
import { isPlausibleAddress, shortAddress } from "@/utils/walletAddressType";
import { Box, Collapse, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React from "react";
import { EditState, Tw, isTagChain, tone } from "./types";

interface Props {
  wallet: WalletDataType;
  edit: EditState;
  expanded: boolean;
  error?: string;
  isMobile: boolean;
  /** Other networks saved with the same address (shared-address tag). */
  sharedWith?: string[];
  onChange: (patch: Partial<EditState>) => void;
  onToggleExpand: () => void;
  onReset: () => void;
  tw: Tw;
}

const mono = { "& input": { fontFamily: "var(--font-mono) !important", letterSpacing: 0.1 } };

export const ExistingWalletRow: React.FC<Props> = ({ wallet: w, edit: e, expanded, error, isMobile, sharedWith = [], onChange, onToggleExpand, onReset, tw }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const c = tone(dark);
  const border = theme.palette.border?.main || theme.palette.divider;

  const addrChanged = e.address.trim() !== (w.walletAddress || "");
  const nameChanged = e.name.trim() !== (w.walletName || "");
  const tagChanged = isTagChain(w.walletTitle) && e.tag.trim() !== (w.destinationTag || "");
  const changed = addrChanged || nameChanged || tagChanged;
  const invalid = addrChanged && !!e.address.trim() && !isPlausibleAddress(e.address, w.walletTitle);
  const tag = w.walletTitle;

  const status = e.remove
    ? { dot: c.rose, text: tw("rowRemoves", "Removes on save"), color: c.rose }
    : error
      ? { dot: c.rose, text: error, color: c.rose }
      : invalid
        ? { dot: c.amber, text: tw("rowLooksInvalid", "Address doesn't look valid"), color: c.amber }
        : changed
          ? { dot: c.indigo, text: tw("rowEdited", "Edited"), color: c.indigo }
          : null;

  return (
    <Box
      data-testid={`wallet-manager-existing-${tag}`}
      data-state={e.remove ? "remove" : changed ? "edited" : "clean"}
      sx={{
        borderBottom: `1px solid ${border}`,
        "&:last-of-type": { borderBottom: "none" },
        backgroundColor: e.remove ? c.roseSoft : expanded ? c.surface : "transparent",
        transition: "background-color 0.2s ease",
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={() => !e.remove && onToggleExpand()}
        onKeyDown={(ev) => {
          if ((ev.key === "Enter" || ev.key === " ") && !e.remove) {
            ev.preventDefault();
            onToggleExpand();
          }
        }}
        data-testid={`wallet-manager-row-${tag}`}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: { xs: 1.5, sm: 2 },
          py: 1.25,
          cursor: e.remove ? "default" : "pointer",
          outline: "none",
          "&:hover": { backgroundColor: e.remove ? c.roseSoft : c.surfaceHover },
          "&:focus-visible": { boxShadow: `inset 0 0 0 2px ${c.indigo}` },
          transition: "background-color 0.15s ease",
        }}
      >
        <Box sx={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: dark ? "rgba(255,255,255,0.06)" : "#F1F5F9", flexShrink: 0, opacity: e.remove ? 0.5 : 1 }}>
          <Image src={w.icon} alt={w.name} width={20} height={20} draggable={false} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <Typography
              sx={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-sans)", textDecoration: e.remove ? "line-through" : "none", color: e.remove ? theme.palette.text.secondary : theme.palette.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {w.name}
            </Typography>
            <Typography sx={{ fontSize: 11, fontFamily: "var(--font-mono)", color: theme.palette.text.secondary, flexShrink: 0 }}>{tag}</Typography>
            {!e.remove && <SharedAddressTag networks={sharedWith} size="sm" testId={`wallet-manager-shared-${tag}`} />}
            {status && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0.5, minWidth: 0 }} data-testid={`wallet-manager-status-${tag}`}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: status.dot, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 11.5, color: status.color, fontFamily: "var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{status.text}</Typography>
              </Box>
            )}
          </Box>
          <Typography
            sx={{ fontSize: 12, fontFamily: "var(--font-mono)", color: theme.palette.text.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", mt: 0.25 }}
            title={e.address}
          >
            {isMobile ? shortAddress(e.address, 10, 6) : shortAddress(e.address, 14, 8)}
            {e.name.trim() && <Box component="span" sx={{ fontFamily: "var(--font-sans)" }}> · {e.name.trim()}</Box>}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }} onClick={(ev) => ev.stopPropagation()}>
          {e.remove ? (
            <Tooltip title={tw("undo", "Undo")}>
              <IconButton size="small" onClick={() => onChange({ remove: false })} aria-label={tw("undo", "Undo")} data-testid={`wallet-manager-undo-remove-${tag}`} sx={{ color: c.rose }}>
                <Icon name="undo-2" size={16} color={c.rose} />
              </IconButton>
            </Tooltip>
          ) : (
            <>
              <Tooltip title={expanded ? tw("done", "Done") : tw("edit", "Edit")}>
                <IconButton size="small" onClick={onToggleExpand} aria-label={tw("edit", "Edit")} data-testid={`wallet-manager-edit-toggle-${tag}`} sx={{ color: expanded ? c.indigo : theme.palette.text.secondary }}>
                  <Icon name={expanded ? "chevron-up" : "pencil"} size={16} color={expanded ? c.indigo : theme.palette.text.secondary} />
                </IconButton>
              </Tooltip>
              <Tooltip title={tw("remove", "Remove")}>
                <IconButton size="small" onClick={() => onChange({ remove: true })} aria-label={tw("remove", "Remove")} data-testid={`wallet-manager-remove-toggle-${tag}`} sx={{ color: theme.palette.text.secondary, "&:hover": { color: c.rose } }}>
                  <Icon name="trash-2" size={16} />
                </IconButton>
              </Tooltip>
            </>
          )}
          {/* icon-bundle literals: <Icon name="undo-2" /> <Icon name="pencil" /> <Icon name="chevron-up" /> <Icon name="trash-2" /> */}
        </Box>
      </Box>

      <Collapse in={expanded && !e.remove} unmountOnExit>
        <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 2, pt: 0.5, display: "flex", flexDirection: "column", gap: 1.25 }} data-testid={`wallet-manager-editor-${tag}`}>
          <InputField
            label={tw("walletAddress", "Wallet address")}
            value={e.address}
            error={invalid || !!error}
            onChange={(ev: any) => onChange({ address: ev.target.value })}
            sx={mono}
            data-testid={`wallet-manager-address-${tag}`}
          />
          {invalid && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: -0.5 }}>
              <Icon name="circle-alert" size={13} color={c.amber} />
              <Typography sx={{ fontSize: 12, color: c.amber, fontFamily: "var(--font-sans)" }} data-testid={`wallet-manager-invalid-${tag}`}>
                {tw("addrFormatWarn", "This doesn't look like a {{cur}} address. Double-check before saving.", { cur: tag })}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: isTagChain(tag) ? "1fr 1fr" : "1fr", gap: 1.25 }}>
            <InputField
              label={tw("walletNameOptional", "Wallet name (optional)")}
              placeholder={tw("walletNamePlaceholder", "e.g. Treasury, Ledger…")}
              value={e.name}
              onChange={(ev: any) => onChange({ name: ev.target.value })}
              data-testid={`wallet-manager-name-${tag}`}
            />
            {isTagChain(tag) && (
              <InputField
                label={tw("XRPTag", "Destination tag")}
                value={e.tag}
                onChange={(ev: any) => onChange({ tag: ev.target.value })}
                sx={mono}
                data-testid={`wallet-manager-tag-${tag}`}
              />
            )}
          </Box>
          {error && (
            <Typography sx={{ fontSize: 12, color: c.rose, fontFamily: "var(--font-sans)" }} data-testid={`wallet-manager-error-${tag}`}>
              {error}
            </Typography>
          )}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box
              component="button"
              type="button"
              onClick={onReset}
              disabled={!changed}
              data-testid={`wallet-manager-reset-${tag}`}
              sx={{ all: "unset", cursor: changed ? "pointer" : "default", display: "flex", alignItems: "center", gap: 0.5, fontSize: 12.5, fontFamily: "var(--font-sans)", color: changed ? theme.palette.text.secondary : theme.palette.text.disabled, "&:hover": changed ? { color: theme.palette.text.primary } : {} }}
            >
              <Icon name="rotate-ccw-clock" size={13} />
              {tw("resetRow", "Reset to saved")}
            </Box>
            <Box
              component="button"
              type="button"
              onClick={onToggleExpand}
              data-testid={`wallet-manager-collapse-${tag}`}
              sx={{ all: "unset", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-sans)", color: c.indigo }}
            >
              {tw("done", "Done")}
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};
