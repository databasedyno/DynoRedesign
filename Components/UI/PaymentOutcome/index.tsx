import React, { ReactNode } from "react";
import {
  Box,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import CopyIcon from "@/assets/Icons/CopyIcon";
import { brandFg } from "@/constants/theme";
import { formatCryptoAmount, formatWithSeparators } from "@/utils/currencyFormat";
import copyToClipboard from "@/helpers/copyToClipboard";
import useToast from "@/hooks/useToast";

/** Shared building blocks for the post-payment outcome screens (over/under-payment). */

export const useOutcomeTheme = () => {
  const theme = useTheme();
  return { theme, isDark: theme.palette.mode === "dark" };
};

export const SecureBadge = () => {
  const { isDark } = useOutcomeTheme();
  const { t } = useTranslation("common");
  const color = brandFg(isDark);
  return (
    <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mt={2}>
      <Icon icon="mdi:lock" width={14} color={color} />
      <Typography fontSize={12} color={color} fontWeight={500}>
        {t("checkout.securePayment")}
      </Typography>
    </Box>
  );
};

interface OutcomeCardProps {
  testId: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}

export const OutcomeCard = ({ testId, icon, title, subtitle, children }: OutcomeCardProps) => {
  const { theme, isDark } = useOutcomeTheme();
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgcolor={isDark ? theme.palette.background.default : "#F8FAFC"}
      px={2}
      minHeight="calc(100vh - 340px)"
    >
      <Paper
        elevation={3}
        data-testid={testId}
        sx={{
          borderRadius: 4,
          p: { xs: 3, sm: 4 },
          width: "100%",
          maxWidth: 500,
          textAlign: "center",
          margin: 0,
          border: `1px solid ${isDark ? theme.palette.divider : "#E9ECF2"}`,
          boxShadow: isDark
            ? "0px 45px 64px 0px rgba(0,0,0,0.3)"
            : "0px 45px 64px 0px #0D03230F",
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box display="flex" justifyContent="center" mb={2}>
          {icon}
        </Box>
        <Typography
          variant="h6"
          fontWeight={500}
          fontSize={{ xs: 20, sm: 25 }}
          gutterBottom
          fontFamily="var(--font-sans)"
          color={theme.palette.text.primary}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          color={isDark ? theme.palette.text.secondary : "#515151"}
          mb={3}
          fontFamily="var(--font-sans)"
        >
          {subtitle}
        </Typography>
        {children}
        <SecureBadge />
      </Paper>
    </Box>
  );
};

export const TxIdBox = ({ transactionId }: { transactionId?: string }) => {
  const { theme, isDark } = useOutcomeTheme();
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  if (!transactionId) return null;

  const copy = async () => {
    await copyToClipboard(transactionId);
    showToast({ message: t("checkout.copied"), severity: "success" });
  };

  return (
    <Box
      sx={{
        border: `1px solid ${isDark ? theme.palette.divider : "#E9ECF2"}`,
        borderRadius: "10px",
        p: 2,
        mb: 2,
        backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#FAFBFF",
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box textAlign="left">
          <Typography
            fontSize={10}
            fontWeight={600}
            color={isDark ? theme.palette.text.secondary : "#666"}
            letterSpacing={0.5}
          >
            {t("success.transactionId")}
          </Typography>
          <Typography fontWeight={500} fontSize={13} color={theme.palette.text.primary}>
            #{transactionId}
          </Typography>
        </Box>
        <Tooltip title={t("common.copy")}>
          <IconButton
            size="small"
            onClick={copy}
            data-testid="copy-transaction-btn"
            sx={{
              bgcolor: isDark ? "#2a2a4a" : "#E9ECF2",
              p: 0.75,
              borderRadius: "6px",
              "&:hover": { bgcolor: isDark ? "#222227" : "#CDEDE9" },
            }}
          >
            <CopyIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

interface AmountRowProps {
  label: string;
  amount: number;
  currency: string;
  fiatUsd?: number;
  rate?: number;
  fiatCurrency: string;
  emphasis?: boolean;
  py?: number;
}

export const AmountRow = ({
  label,
  amount,
  currency,
  fiatUsd,
  rate = 1,
  fiatCurrency,
  emphasis = false,
  py = 2,
}: AmountRowProps) => {
  const { theme, isDark } = useOutcomeTheme();
  const color = emphasis
    ? theme.palette.text.primary
    : isDark
      ? theme.palette.text.secondary
      : "#515151";
  const weight = emphasis ? 500 : 400;
  const sizes = emphasis
    ? { xs: "14px", sm: "16px", md: "20px" }
    : { xs: "12px", sm: "14px", md: "16px" };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" py={py}>
      <Typography
        variant="subtitle2"
        fontWeight={weight}
        color={color}
        fontFamily="var(--font-sans)"
        sx={{ fontSize: sizes }}
      >
        {label}
      </Typography>
      <Box textAlign="right">
        <Typography
          variant="subtitle2"
          fontWeight={weight}
          color={color}
          fontFamily="var(--font-sans)"
          sx={{ fontSize: sizes }}
        >
          {formatCryptoAmount(amount, currency)} {currency}
        </Typography>
        {fiatUsd !== undefined && (
          <Typography
            variant="caption"
            color={isDark ? theme.palette.text.secondary : "#737373"}
            fontFamily="var(--font-sans)"
            fontSize={12}
          >
            ≈ {formatWithSeparators((fiatUsd || 0) * rate, fiatCurrency)} {fiatCurrency}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export const AmountPanel = ({ rows, children }: { rows: ReactNode; children: ReactNode }) => {
  const { theme, isDark } = useOutcomeTheme();
  return (
    <Box
      border={`1px solid ${isDark ? theme.palette.divider : "#E2E8F0"}`}
      borderRadius={2}
      px={2}
      mb={2}
      bgcolor={isDark ? "rgba(255,255,255,0.02)" : "transparent"}
    >
      {rows}
      <Divider sx={{ mb: 2, borderColor: isDark ? theme.palette.divider : undefined }} />
      {children}
    </Box>
  );
};
