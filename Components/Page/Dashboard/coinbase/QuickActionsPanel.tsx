import { useWalletStore } from "@/contexts/WalletDataContext";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  IconButton,
  useTheme,
} from "@mui/material";
import {
  RequestQuoteRounded,
  SwapHorizRounded,
  ReceiptLongRounded,
  ExpandMoreRounded,
  ArrowOutwardRounded,
  AccountBalanceWalletRounded,
  StorefrontRounded,
  PeopleAltRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  ActionIconBadge,
  CB_TOKENS,
  Eyebrow,
  PrimaryCTA,
  QuickActionRow,
  SurfaceCard,
  TabPill,
} from "./styled";

/**
 * QuickActionsPanel — the right-rail merchant action panel.
 *
 * Structure:
 *   [ Receive · Convert · Invoice ]  <- segmented pill tabs
 *   Quick pay ▼                        <- context selector (placeholder)
 *   [    0 USD    ] Max                <- amount input, right-aligned Max chip
 *   Coin selector row: USDT · USDC · BTC · ETH  <- coin chips (mock chips for now)
 *   [       Create payment link →    ]  <- PrimaryCTA (indigo)
 *   ── divider ──
 *   ⇢ Create invoice                    <- quick-link row
 *   ⇢ Open wallet
 *   ⇢ Convert balance
 *   ⇢ View customers
 *
 * The Receive tab prefills /create-pay-link with the amount + coin, using
 * the same query-param contract that page already supports (amount, coin).
 * Convert tab points at ConversionBanner logic (routes to /wallet).
 * Invoice tab routes to /invoices.
 */

type TabId = "receive" | "convert" | "invoice";

const COINS: Array<{ code: string; label: string; color: string }> = [
  { code: "USDT", label: "USDT", color: "#26A17B" },
  { code: "USDC", label: "USDC", color: "#2775CA" },
  { code: "BTC", label: "BTC", color: "#F7931A" },
  { code: "ETH", label: "ETH", color: "#627EEA" },
];

const QuickActionsPanel: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { stats } = useDashboardData();
  const walletState = useWalletStore();
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;

  const [tab, setTab] = useState<TabId>("receive");
  const [amount, setAmount] = useState<string>("");
  const [coin, setCoin] = useState<string>("USDT");

  const currencySymbol = stats?.currencySymbol || "$";
  const currencyCode = stats?.currency || "USD";

  const handleSubmit = useCallback(() => {
    const amt = amount || "0";
    if (tab === "receive") {
      router.push(
        `/create-pay-link?amount=${encodeURIComponent(amt)}&coin=${encodeURIComponent(coin)}`,
      );
    } else if (tab === "convert") {
      router.push("/wallet");
    } else {
      router.push("/invoices");
    }
  }, [tab, amount, coin, router]);

  const primaryLabel = useMemo(() => {
    if (tab === "receive")
      return t("qaCreatePayLink", { defaultValue: "Create payment link" });
    if (tab === "convert")
      return t("qaConvertBalance", { defaultValue: "Convert balance" });
    return t("qaCreateInvoice", { defaultValue: "Create invoice" });
  }, [tab, t]);

  // Format the entered amount with the currency symbol/code inline
  const displayAmount = amount || "0";

  const numericAmount = Number(amount || 0);
  const disableSubmit = !hasWallet || !Number.isFinite(numericAmount);

  return (
    <SurfaceCard
      data-testid="cb-quick-actions"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2.5,
      }}
    >
      {/* Segmented tabs — mimic Coinbase's Buy / Sell / Convert */}
      <Box
        data-testid="cb-qa-tabs"
        role="tablist"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          padding: 0.5,
          borderRadius: 999,
          backgroundColor:
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.05)"
              : "rgba(10,10,15,0.05)",
        }}
      >
        <TabPill
          active={tab === "receive"}
          onClick={() => setTab("receive")}
          data-testid="cb-qa-tab-receive"
          role="tab"
          aria-selected={tab === "receive"}
        >
          {t("qaTabReceive", { defaultValue: "Receive" })}
        </TabPill>
        <TabPill
          active={tab === "convert"}
          onClick={() => setTab("convert")}
          data-testid="cb-qa-tab-convert"
          role="tab"
          aria-selected={tab === "convert"}
        >
          {t("qaTabConvert", { defaultValue: "Convert" })}
        </TabPill>
        <TabPill
          active={tab === "invoice"}
          onClick={() => setTab("invoice")}
          data-testid="cb-qa-tab-invoice"
          role="tab"
          aria-selected={tab === "invoice"}
        >
          {t("qaTabInvoice", { defaultValue: "Invoice" })}
        </TabPill>
      </Box>

      {/* "Quick pay ▼" context — decorative, keeps Coinbase's visual */}
      <Box
        sx={{
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: 0.5,
          px: 1.25,
          py: 0.5,
          borderRadius: 999,
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 600,
          color:
            theme.palette.mode === "dark"
              ? CB_TOKENS.ink.secondaryDark
              : CB_TOKENS.ink.secondaryLight,
          backgroundColor:
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.05)"
              : "rgba(10,10,15,0.04)",
        }}
      >
        {tab === "receive"
          ? t("qaQuickReceive", { defaultValue: "Quick receive" })
          : tab === "convert"
            ? t("qaQuickConvert", { defaultValue: "Quick convert" })
            : t("qaQuickInvoice", { defaultValue: "Quick invoice" })}
        <ExpandMoreRounded sx={{ fontSize: 16 }} />
      </Box>

      {/* Big amount input — the "0 EUR" from the Coinbase screenshot */}
      <Box sx={{ position: "relative", pt: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "baseline", flex: 1, minWidth: 0 }}>
            <Box
              component="input"
              inputMode="decimal"
              value={amount}
              placeholder="0"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const v = e.target.value.replace(/[^\d.]/g, "");
                setAmount(v);
              }}
              data-testid="cb-qa-amount"
              sx={{
                width: `${Math.max(1, displayAmount.length)}ch`,
                maxWidth: "100%",
                fontFamily: "var(--font-unbounded, 'Unbounded', 'Inter', system-ui)",
                fontSize: 56,
                fontWeight: 500,
                letterSpacing: -1.5,
                lineHeight: 1,
                color:
                  theme.palette.mode === "dark"
                    ? CB_TOKENS.ink.primaryDark
                    : CB_TOKENS.ink.primaryLight,
                background: "transparent",
                border: "none",
                outline: "none",
                padding: 0,
                "&::placeholder": {
                  color:
                    theme.palette.mode === "dark"
                      ? CB_TOKENS.ink.mutedDark
                      : CB_TOKENS.ink.mutedLight,
                },
                [theme.breakpoints.down("sm")]: {
                  fontSize: 44,
                },
              }}
            />
            <Box
              sx={{
                ml: 1,
                fontFamily: "var(--font-unbounded, 'Unbounded', 'Inter', system-ui)",
                fontSize: 30,
                fontWeight: 500,
                color:
                  theme.palette.mode === "dark"
                    ? CB_TOKENS.ink.mutedDark
                    : CB_TOKENS.ink.mutedLight,
                [theme.breakpoints.down("sm")]: { fontSize: 24 },
              }}
            >
              {currencyCode}
            </Box>
          </Box>
          <Box
            role="button"
            tabIndex={0}
            onClick={() => setAmount("100")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setAmount("100");
            }}
            data-testid="cb-qa-max"
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 999,
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              color:
                theme.palette.mode === "dark"
                  ? CB_TOKENS.ink.secondaryDark
                  : CB_TOKENS.ink.secondaryLight,
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(10,10,15,0.05)",
              "&:hover": {
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(10,10,15,0.08)",
              },
            }}
          >
            $100
          </Box>
        </Box>
      </Box>

      {/* Coin selector row — small chips like Coinbase's "Pay with USDC" */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 600,
            color:
              theme.palette.mode === "dark"
                ? CB_TOKENS.ink.mutedDark
                : CB_TOKENS.ink.mutedLight,
            mr: 0.5,
          }}
        >
          {tab === "receive"
            ? t("qaReceiveIn", { defaultValue: "Receive in" })
            : t("qaFromCoin", { defaultValue: "Coin" })}
        </Box>
        {COINS.map((c) => (
          <Box
            key={c.code}
            role="button"
            tabIndex={0}
            onClick={() => setCoin(c.code)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setCoin(c.code);
            }}
            data-testid={`cb-qa-coin-${c.code}`}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 999,
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              color:
                coin === c.code
                  ? "#FFFFFF"
                  : theme.palette.mode === "dark"
                    ? CB_TOKENS.ink.primaryDark
                    : CB_TOKENS.ink.primaryLight,
              backgroundColor:
                coin === c.code
                  ? c.color
                  : theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(10,10,15,0.05)",
              border: `1px solid ${
                coin === c.code
                  ? c.color
                  : theme.palette.mode === "dark"
                    ? CB_TOKENS.border.dark
                    : CB_TOKENS.border.light
              }`,
              transition: "background-color 120ms ease, color 120ms ease",
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: coin === c.code ? "#FFFFFF" : c.color,
              }}
            />
            {c.label}
          </Box>
        ))}
      </Box>

      {/* Primary CTA */}
      <PrimaryCTA
        onClick={handleSubmit}
        disabled={disableSubmit}
        data-testid="cb-qa-primary-cta"
        endIcon={<ArrowOutwardRounded sx={{ fontSize: 18 }} />}
      >
        {primaryLabel}
      </PrimaryCTA>

      {/* Divider */}
      <Box
        sx={{
          height: 1,
          backgroundColor:
            theme.palette.mode === "dark"
              ? CB_TOKENS.border.dark
              : CB_TOKENS.border.light,
        }}
      />

      {/* Quick-link stack */}
      <Box>
        <Eyebrow sx={{ mb: 1.5 }}>
          {t("qaShortcuts", { defaultValue: "Shortcuts" })}
        </Eyebrow>
        <QuickActionRow
          onClick={() => router.push("/invoices")}
          data-testid="cb-qa-shortcut-invoice"
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <ActionIconBadge>
              <ReceiptLongRounded sx={{ fontSize: 18 }} />
            </ActionIconBadge>
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 600,
                color:
                  theme.palette.mode === "dark"
                    ? CB_TOKENS.ink.primaryDark
                    : CB_TOKENS.ink.primaryLight,
              }}
            >
              {t("qaShortcutInvoice", { defaultValue: "Create invoice" })}
            </Box>
          </Box>
        </QuickActionRow>

        <QuickActionRow
          onClick={() => router.push("/wallet")}
          data-testid="cb-qa-shortcut-wallet"
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <ActionIconBadge>
              <AccountBalanceWalletRounded sx={{ fontSize: 18 }} />
            </ActionIconBadge>
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 600,
                color:
                  theme.palette.mode === "dark"
                    ? CB_TOKENS.ink.primaryDark
                    : CB_TOKENS.ink.primaryLight,
              }}
            >
              {t("qaShortcutWallet", { defaultValue: "Open payout addresses" })}
            </Box>
          </Box>
        </QuickActionRow>

        <QuickActionRow
          onClick={() => router.push("/creator")}
          data-testid="cb-qa-shortcut-creator"
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <ActionIconBadge>
              <StorefrontRounded sx={{ fontSize: 18 }} />
            </ActionIconBadge>
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 600,
                color:
                  theme.palette.mode === "dark"
                    ? CB_TOKENS.ink.primaryDark
                    : CB_TOKENS.ink.primaryLight,
              }}
            >
              {t("qaShortcutCreator", { defaultValue: "Creator page" })}
            </Box>
          </Box>
        </QuickActionRow>

        <QuickActionRow
          onClick={() => router.push("/customers")}
          data-testid="cb-qa-shortcut-customers"
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <ActionIconBadge>
              <PeopleAltRounded sx={{ fontSize: 18 }} />
            </ActionIconBadge>
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 600,
                color:
                  theme.palette.mode === "dark"
                    ? CB_TOKENS.ink.primaryDark
                    : CB_TOKENS.ink.primaryLight,
              }}
            >
              {t("qaShortcutCustomers", { defaultValue: "View customers" })}
            </Box>
          </Box>
        </QuickActionRow>
      </Box>
    </SurfaceCard>
  );
};

export default QuickActionsPanel;
