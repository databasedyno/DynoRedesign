import React from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Box, Button, Stack, Typography, useTheme } from "@mui/material";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import { brandFg, brandAlpha } from "@/constants/theme";
import { CardSx } from "./payoutsHelpers";

interface Props {
  cardSx: CardSx;
  taxCollectedLabel: string;
}

/** Payout destinations + tax quick links (→ /wallet, → /invoices). */
const QuickLinksRow: React.FC<Props> = ({ cardSx, taxCollectedLabel }) => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation("common");
  const accent = brandFg(theme.palette.mode === "dark");

  const iconSx = { width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: brandAlpha(0.12), color: accent } as const;
  const rowSx = { ...cardSx, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 } as const;

  return (
    <Box sx={{ display: "grid", gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
      <Box sx={rowSx}>
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box sx={iconSx}>
            <AccountBalanceWalletRounded fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{t("payouts.payoutWallets", { defaultValue: "Payout wallets" })}</Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {t("payouts.payoutWalletsDesc", { defaultValue: "Where your settled funds land" })}
            </Typography>
          </Box>
        </Stack>
        <Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => router.push("/wallet")} sx={{ textTransform: "none" }}>
          {t("payouts.manage", { defaultValue: "Manage" })}
        </Button>
      </Box>
      <Box sx={rowSx}>
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box sx={iconSx}>
            <ReceiptLongRounded fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{t("payouts.taxCollected", { defaultValue: "Tax collected" })}</Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {taxCollectedLabel} {t("payouts.toDate", { defaultValue: "to date" })}
            </Typography>
          </Box>
        </Stack>
        <Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => router.push("/invoices")} sx={{ textTransform: "none" }}>
          {t("payouts.receipts", { defaultValue: "Receipts" })}
        </Button>
      </Box>
    </Box>
  );
};

export default QuickLinksRow;
