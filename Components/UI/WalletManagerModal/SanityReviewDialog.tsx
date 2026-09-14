import React from "react";
import { Box, Dialog, Typography, useTheme } from "@mui/material";
import CustomButton from "@/Components/UI/Buttons";
import { Icon } from "@/styles/uiKit";
import { Tw, tone } from "./types";

export type SanityWarning = { network: string; message: string; severity: string };

interface Props {
  warnings: SanityWarning[] | null;
  onBack: () => void;
  onProceed: () => void;
  tw: Tw;
}

/** Address sanity review — soft, dismissible (network-mismatch / never-received). */
export const SanityReviewDialog: React.FC<Props> = ({ warnings, onBack, onProceed, tw }) => {
  const theme = useTheme();
  const c = tone(theme.palette.mode === "dark");
  return (
    <Dialog
      open={!!warnings}
      onClose={onBack}
      maxWidth="xs"
      fullWidth
      sx={{ "& .MuiDialog-paper": { borderRadius: "12px", backgroundColor: theme.palette.background.paper } }}
    >
      <Box data-testid="wallet-manager-sanity-review" sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Icon name="circle-alert" size={20} color={c.amber} />
          <Typography sx={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-display)" }}>
            {tw("sanityTitle", "Before you save")}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", mb: 2 }}>
          {tw("sanitySubtitle", "A couple of addresses are worth a second look. You can still save if they're correct.")}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 2.5 }}>
          {(warnings || []).map((w, i) => (
            <Box
              key={`${w.network}-${i}`}
              data-testid="wallet-manager-sanity-item"
              sx={{
                p: 1.5,
                borderRadius: "8px",
                border: `1px solid ${w.severity === "high" ? `${c.rose}55` : `${c.amber}55`}`,
                backgroundColor: w.severity === "high" ? c.roseSoft : c.amberSoft,
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: w.severity === "high" ? c.rose : c.amber, mb: 0.25 }}>
                {w.network}
              </Typography>
              <Typography sx={{ fontSize: 12.5, fontFamily: "var(--font-sans)", color: theme.palette.text.primary, lineHeight: 1.4 }}>
                {w.message}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <CustomButton label={tw("sanityBack", "Go back & check")} variant="outlined" onClick={onBack} data-testid="wallet-manager-sanity-back-btn" sx={{ flex: 1 }} />
          <CustomButton label={tw("sanityProceed", "Save anyway")} variant="primary" onClick={onProceed} data-testid="wallet-manager-sanity-proceed-btn" sx={{ flex: 1 }} />
        </Box>
      </Box>
    </Dialog>
  );
};

export default SanityReviewDialog;
