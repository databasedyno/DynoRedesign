import CustomButton from "@/Components/UI/Buttons";
import { Icon } from "@/styles/uiKit";
import { Box, Typography, useTheme } from "@mui/material";
import React from "react";
import { Tw, tone } from "./types";

interface Props {
  requesting: boolean;
  onRequest: () => void;
  onCancel: () => void;
  walletCount: number;
  tw: Tw;
}

export const UnlockGate: React.FC<Props> = ({ requesting, onRequest, onCancel, walletCount, tw }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const c = tone(dark);
  const border = theme.palette.border?.main || theme.palette.divider;

  const perks = [
    { icon: "rows-3", text: tw("sudoPerkBulk", "Add, edit or remove many wallets at once") },
    { icon: "sparkles", text: tw("sudoPerkSmart", "Paste one address, fill every compatible network") },
    { icon: "copy", text: tw("sudoPerkCopy", "Copy a full wallet set from another brand") },
  ];

  return (
    <Box data-testid="wallet-manager-unlock" sx={{ display: "flex", flexDirection: "column", gap: 2.5, px: { xs: 2, sm: 3 }, py: 3 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 1.5,
          p: 2.5,
          borderRadius: "8px",
          border: `1px solid ${border}`,
          backgroundColor: c.surface,
        }}
      >
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "grid", placeItems: "center", backgroundColor: c.indigoSoft, color: c.indigo }}>
          <Icon name="shield-check" size={20} color={c.indigo} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16, fontFamily: "var(--font-display)", letterSpacing: -0.2, mb: 0.5 }}>
            {tw("sudoGateTitle", "Verify it's you")}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", lineHeight: 1.55 }}>
            {tw(
              "sudoGateBodyShort",
              "One emailed code unlocks a 10-minute session. Make every wallet change you need — no code per wallet.",
            )}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {perks.map((p) => (
          <Box key={p.icon} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: "6px", display: "grid", placeItems: "center", border: `1px solid ${border}`, color: theme.palette.text.secondary, flexShrink: 0 }}>
              <Icon name={p.icon} size={13} color={theme.palette.text.secondary} />
            </Box>
            <Typography sx={{ fontSize: 13.5, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>{p.text}</Typography>
          </Box>
        ))}
        {/* icon-bundle literals: <Icon name="rows-3" /> <Icon name="sparkles" /> <Icon name="copy" /> */}
      </Box>

      <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
        {tw("sudoGateFootnote", "{{n}} wallets on this brand. Nothing changes until you press Save.", { n: walletCount })}
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5 }}>
        <CustomButton label={tw("cancel", "Cancel")} variant="outlined" onClick={onCancel} sx={{ flex: 1 }} data-testid="wallet-manager-cancel-btn" />
        <CustomButton
          label={tw("sudoSendCode", "Email me a code")}
          variant="primary"
          onClick={onRequest}
          loading={requesting}
          startIcon={<Icon name="mail" size={16} />}
          sx={{ flex: 1.4 }}
          data-testid="wallet-manager-send-code-btn"
        />
      </Box>
    </Box>
  );
};
