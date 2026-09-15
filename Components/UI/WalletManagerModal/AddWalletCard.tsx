import CustomButton from "@/Components/UI/Buttons";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CryptocurrencySelector from "@/Components/UI/CryptocurrencySelector";
import { Icon } from "@/styles/uiKit";
import { addrKindLabel, compatibleCurrencies, detectAddressKind, isPlausibleAddress } from "@/utils/walletAddressType";
import { Box, Chip, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import React from "react";
import { AddRow, Tw, isTagChain, tone } from "./types";

interface Props {
  row: AddRow;
  index: number;
  usedCurrencies: Set<string>;
  error?: string;
  onUpdate: (patch: Partial<AddRow>) => void;
  onRemove: () => void;
  onSmartApply: (address: string) => void;
  onDuplicate: () => void;
  tw: Tw;
}

const mono = { "& input": { fontFamily: "var(--font-mono) !important", letterSpacing: 0.1 } };

export const AddWalletCard: React.FC<Props> = ({ row: r, index, usedCurrencies, error, onUpdate, onRemove, onSmartApply, onDuplicate, tw }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const c = tone(dark);
  const border = theme.palette.border?.main || theme.palette.divider;

  const kind = detectAddressKind(r.address);
  const previewList = compatibleCurrencies(kind).filter((cur) => !usedCurrencies.has(cur) || cur === r.currency);
  const othersToFill = previewList.filter((cur) => cur !== r.currency);
  const showSmart = kind !== "unknown" && othersToFill.length >= 1;
  const invalid = !!r.currency && !!r.address.trim() && !isPlausibleAddress(r.address, r.currency);
  const complete = !!r.currency && !!r.address.trim() && !invalid;

  return (
    <Box
      data-testid="wallet-manager-add-row"
      data-state={complete ? "ready" : "draft"}
      sx={{
        borderRadius: "8px",
        border: `1px solid ${error ? c.rose : complete ? `${c.emerald}66` : border}`,
        backgroundColor: theme.palette.background.paper,
        p: { xs: 1.5, sm: 2 },
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        transition: "border-color 0.2s ease",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 22, height: 22, borderRadius: "6px", display: "grid", placeItems: "center", backgroundColor: complete ? c.emeraldSoft : c.surfaceHover, color: complete ? c.emerald : theme.palette.text.secondary, fontSize: 11.5, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {complete ? <Icon name="check" size={13} color={c.emerald} /> : index + 1}
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-sans)" }}>
            {r.currency ? tw("newWalletFor", "New {{cur}} wallet", { cur: r.currency }) : tw("newWallet", "New payout address")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          {r.address.trim() && (
            <Tooltip title={tw("duplicateRow", "Duplicate this address into another row")}>
              <IconButton size="small" onClick={onDuplicate} aria-label={tw("duplicateRow", "Duplicate row")} data-testid="wallet-manager-duplicate-row-btn" sx={{ color: theme.palette.text.secondary }}>
                <Icon name="copy" size={14} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={tw("removeRow", "Remove row")}>
            <IconButton size="small" onClick={onRemove} aria-label={tw("removeRow", "Remove row")} data-testid="wallet-manager-remove-row-btn" sx={{ color: theme.palette.text.secondary, "&:hover": { color: c.rose } }}>
              <Icon name="x" size={15} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <CryptocurrencySelector
        label={tw("network", "Network")}
        value={r.currency}
        fullWidth
        showAllWithDisabled
        onChange={(value: string) => {
          if (value !== r.currency && usedCurrencies.has(value)) return;
          onUpdate({ currency: value });
        }}
      />

      <InputField
        label={tw("walletAddress", "Address")}
        placeholder={tw("walletAddressPlaceholder", "Paste your wallet address")}
        value={r.address}
        error={invalid || !!error}
        onChange={(ev: any) => onUpdate({ address: ev.target.value })}
        sx={mono}
        data-testid="wallet-manager-add-address"
      />
      {invalid && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: -0.5 }}>
          <Icon name="circle-alert" size={13} color={c.amber} />
          <Typography sx={{ fontSize: 12, color: c.amber, fontFamily: "var(--font-sans)" }} data-testid="wallet-manager-add-invalid">
            {tw("addrFormatWarn", "This doesn't look like a {{cur}} address. Double-check before saving.", { cur: r.currency })}
          </Typography>
        </Box>
      )}

      {showSmart && (
        <Box
          data-testid="wallet-manager-smart-paste"
          sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5, borderRadius: "8px", backgroundColor: c.indigoSoft, border: `1px solid ${c.indigo}33` }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Icon name="sparkles" size={14} color={c.indigo} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-sans)", color: c.indigo }}>
              {tw("smartPasteTitle", "{{kind}} address detected", { kind: addrKindLabel(kind) })}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 12, fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
            {tw("smartPasteHintShort", "The same address works on these networks too:")}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }} data-testid="wallet-manager-smart-preview">
            {othersToFill.map((cur) => (
              <Chip key={cur} size="small" label={cur} variant="outlined" sx={{ height: 22, fontSize: 11, fontFamily: "var(--font-mono)", borderColor: `${c.indigo}55`, color: theme.palette.text.primary }} data-testid={`wallet-manager-smart-preview-${cur}`} />
            ))}
          </Box>
          <CustomButton
            label={
              othersToFill.length === 1
                ? tw("smartPasteApplyOne", "Also add {{cur}}", { cur: othersToFill[0] })
                : tw("smartPasteApplyN", "Add to all {{n}}", { n: othersToFill.length })
            }
            variant="primary"
            size="small"
            onClick={() => onSmartApply(r.address)}
            startIcon={<Icon name="zap" size={13} />}
            data-testid="wallet-manager-smart-apply-btn"
            sx={{ alignSelf: "flex-start", height: 32, px: 1.5, fontSize: 12.5 }}
          />
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: isTagChain(r.currency) ? "1fr 1fr" : "1fr", gap: 1.25 }}>
        <InputField
          label={tw("walletNameOptional", "Label (optional)")}
          placeholder={tw("walletNamePlaceholder", "e.g. Treasury, Ledger…")}
          value={r.name}
          onChange={(ev: any) => onUpdate({ name: ev.target.value })}
          data-testid="wallet-manager-add-name"
        />
        {isTagChain(r.currency) && (
          <InputField label={tw("XRPTag", "Destination tag")} value={r.tag} onChange={(ev: any) => onUpdate({ tag: ev.target.value })} sx={mono} data-testid="wallet-manager-add-tag" />
        )}
      </Box>

      {error && (
        <Typography sx={{ fontSize: 12, color: c.rose, fontFamily: "var(--font-sans)" }} data-testid="wallet-manager-add-error">
          {error}
        </Typography>
      )}
      {/* icon-bundle literals: <Icon name="check" /> <Icon name="copy" /> <Icon name="x" /> <Icon name="circle-alert" /> <Icon name="sparkles" /> <Icon name="zap" /> */}
    </Box>
  );
};
