import React from "react";
import { Box, useTheme } from "@mui/material";
import {
  AddRounded,
  ReceiptLongRounded,
  AccountBalanceWalletRounded,
  LinkRounded,
  PeopleAltRounded,
  StorefrontRounded,
  ArrowOutwardRounded,
  ChevronRightRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import {
  SurfaceCard,
  Eyebrow,
  PrimaryCTA,
  QuickActionRow,
  ActionIconBadge,
  CB_TOKENS,
} from "../coinbase/styled";

/**
 * QuickActionsDock — a merchant-focused action panel for the right rail.
 *
 * Deliberately NOT the consumer-style "amount input + coin chips + Receive/
 * Convert tabs" panel that was rolled back before — a payment gateway
 * merchant needs fast routes to the tools they use, not a wallet buy screen.
 */
const QuickActionsDock: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);

  const shortcuts: Array<{
    id: string;
    icon: React.ReactNode;
    label: string;
    href: string;
  }> = [
    {
      id: "invoice",
      icon: <ReceiptLongRounded sx={{ fontSize: 18 }} />,
      label: t("qaShortcutInvoice", { defaultValue: "Create invoice" }),
      href: "/invoices",
    },
    {
      id: "paylinks",
      icon: <LinkRounded sx={{ fontSize: 18 }} />,
      label: t("qaShortcutPayLinks", { defaultValue: "Payment links" }),
      href: "/pay-links",
    },
    {
      id: "wallet",
      icon: <AccountBalanceWalletRounded sx={{ fontSize: 18 }} />,
      label: t("qaShortcutWallet", { defaultValue: "Open wallet" }),
      href: "/wallet",
    },
    {
      id: "customers",
      icon: <PeopleAltRounded sx={{ fontSize: 18 }} />,
      label: t("qaShortcutCustomers", { defaultValue: "View customers" }),
      href: "/customers",
    },
    {
      id: "creator",
      icon: <StorefrontRounded sx={{ fontSize: 18 }} />,
      label: t("qaShortcutCreator", { defaultValue: "Storefront page" }),
      href: "/creator",
    },
  ];

  return (
    <SurfaceCard
      data-testid="dash2026-quick-actions"
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Eyebrow>{t("quickActions", { defaultValue: "Quick actions" })}</Eyebrow>

      <PrimaryCTA
        onClick={() => router.push("/create-pay-link")}
        data-testid="dash2026-qa-primary"
        startIcon={<AddRounded sx={{ fontSize: 20 }} />}
        endIcon={<ArrowOutwardRounded sx={{ fontSize: 18 }} />}
      >
        {t("createPaymentLink", { defaultValue: "Create payment link" })}
      </PrimaryCTA>

      <Box
        sx={{
          height: 1,
          backgroundColor: isDark
            ? CB_TOKENS.border.dark
            : CB_TOKENS.border.light,
        }}
      />

      <Box>
        {shortcuts.map((s) => (
          <QuickActionRow
            key={s.id}
            onClick={() => router.push(s.href)}
            data-testid={`dash2026-qa-${s.id}`}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <ActionIconBadge>{s.icon}</ActionIconBadge>
              <Box
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: isDark
                    ? CB_TOKENS.ink.primaryDark
                    : CB_TOKENS.ink.primaryLight,
                }}
              >
                {s.label}
              </Box>
            </Box>
            <ChevronRightRounded
              sx={{
                fontSize: 20,
                color: isDark
                  ? CB_TOKENS.ink.mutedDark
                  : CB_TOKENS.ink.mutedLight,
              }}
            />
          </QuickActionRow>
        ))}
      </Box>
    </SurfaceCard>
  );
};

export default QuickActionsDock;
