import React from "react";
import Link from "next/link";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import useSavedMerchants from "@/hooks/useSavedMerchants";

type Props = {
  handle?: string | null;
  name: string;
  avatar?: string | null;
  accent: string;
};

// "Save {merchant} for next time" toggle for the buyer success screens.
// Device-local (helpers/savedMerchants) — no account required.
export const SaveMerchantButton: React.FC<Props> = ({ handle, name, avatar, accent }) => {
  const theme = useTheme();
  const { t } = useTranslation("landing");
  const { hydrated, isSaved, save, remove } = useSavedMerchants();
  const h = String(handle || "").trim().toLowerCase();
  if (!h || !hydrated) return null;
  const saved = isSaved(h);
  const muted = theme.palette.text.secondary;
  const border = theme.palette.mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.12)";

  return (
    <Box data-testid="save-merchant" sx={{ mt: 1.25, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
      <Button
        variant="outlined"
        disableElevation
        data-testid="save-merchant-btn"
        data-saved={saved ? "true" : "false"}
        aria-pressed={saved}
        onClick={() => (saved ? remove(h) : save({ handle: h, name, avatar }))}
        startIcon={<Icon icon={saved ? "mdi:heart" : "mdi:heart-outline"} width={17} color={saved ? accent : undefined} />}
        sx={{
          textTransform: "none", borderRadius: "999px", fontWeight: 700, fontSize: 13, px: 2, minHeight: 38,
          color: theme.palette.text.primary, borderColor: saved ? accent : border,
          "&:hover": { borderColor: accent, backgroundColor: "transparent" },
        }}
      >
        {saved
          ? t("checkout.saveMerchant.saved", { defaultValue: "Saved on this device" })
          : t("checkout.saveMerchant.save", { defaultValue: "Save {{name}} for next time", name })}
      </Button>
      {saved && (
        <Typography
          component={Link}
          href="/saved"
          data-testid="saved-merchants-link"
          sx={{ fontSize: 12.5, fontWeight: 600, color: muted, textDecoration: "none", "&:hover": { color: theme.palette.text.primary, textDecoration: "underline" } }}
        >
          {t("checkout.saveMerchant.view", { defaultValue: "View saved merchants →" })}
        </Typography>
      )}
    </Box>
  );
};

export default SaveMerchantButton;
