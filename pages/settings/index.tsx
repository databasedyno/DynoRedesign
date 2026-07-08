import React, { useEffect, useMemo, useState } from "react";
import { Box, Tab, Tabs, Typography, useTheme } from "@mui/material";
import {
  AccountBalanceWalletRounded,
  VpnKeyRounded,
  PersonRounded,
  NotificationsRounded,
  BusinessRounded,
  SecurityRounded,
  WebhookRounded,
  CurrencyExchangeRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import Head from "next/head";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps } from "@/utils/types";

interface SettingsCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  group: "business" | "technical" | "personal";
}

/**
 * SettingsPage — reorganized 2026-07-08 UX audit response.
 *
 * Previously: 8 cards in a flat 3-column grid — users scanned for what belonged
 * to what and hit fatigue by ~card 5.
 *
 * Now: 3 logical tabs that map to mental models:
 *   • Business    — company + payment + wallet (who takes the money)
 *   • Technical   — API keys + webhooks (how systems integrate)
 *   • Personal    — profile + notifications + account (about you)
 *
 * The tab param is persisted in the URL (`?tab=technical`) so links / refreshes
 * land back where the user was. Falls back to `business` on first visit.
 */
const SettingsPage = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("md");

  useEffect(() => {
    setPageName?.("Settings");
    setPageDescription?.("Manage your account, wallets, and payment configuration");
    setPageAction?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settingsCards: SettingsCard[] = useMemo(
    () => [
      {
        id: "company",
        title: "Company Profile",
        description: "Manage your business profiles, logos, and company details",
        icon: <BusinessRounded sx={{ fontSize: 28 }} />,
        path: "/company",
        color: "#8B5CF6",
        group: "business",
      },
      {
        id: "wallet",
        title: "Wallet Addresses",
        description: "Manage your crypto wallet addresses for receiving payments",
        icon: <AccountBalanceWalletRounded sx={{ fontSize: 28 }} />,
        path: "/wallet",
        color: "#6366F1",
        group: "business",
      },
      {
        id: "payment",
        title: "Payment Settings",
        description: "Configure payment tolerance, accepted currencies, and checkout options",
        icon: <CurrencyExchangeRounded sx={{ fontSize: 28 }} />,
        path: "/company?section=payment",
        color: "#EC4899",
        group: "business",
      },
      {
        id: "webhook",
        title: "Webhook Configuration",
        description: "Set up webhook endpoints for real-time payment event notifications",
        icon: <WebhookRounded sx={{ fontSize: 28 }} />,
        path: "/company?section=webhook",
        color: "#EF4444",
        group: "technical",
      },
      {
        id: "api",
        title: "API Keys",
        description: "Manage your API keys for programmatic integration",
        icon: <VpnKeyRounded sx={{ fontSize: 28 }} />,
        path: "/developer-keys",
        color: "#F59E0B",
        group: "technical",
      },
      {
        id: "security",
        title: "Profile & Security",
        description: "Update your personal info, password, and security preferences",
        icon: <SecurityRounded sx={{ fontSize: 28 }} />,
        path: "/profile",
        color: "#10B981",
        group: "personal",
      },
      {
        id: "notifications",
        title: "Notifications",
        description: "View and configure email, push, and notification preferences",
        icon: <NotificationsRounded sx={{ fontSize: 28 }} />,
        path: "/notifications",
        color: "#3B82F6",
        group: "personal",
      },
      {
        id: "account",
        title: "My Account",
        description: "View account details, referral code, and fee tier information",
        icon: <PersonRounded sx={{ fontSize: 28 }} />,
        path: "/referrals",
        color: "#14B8A6",
        group: "personal",
      },
    ],
    [],
  );

  const tabs = useMemo(
    () => [
      { key: "business", label: "Business" },
      { key: "technical", label: "Technical" },
      { key: "personal", label: "Personal" },
    ] as const,
    [],
  );

  const initialTab = (() => {
    const raw = String(router.query.tab || "").toLowerCase();
    return tabs.some((t) => t.key === raw) ? (raw as (typeof tabs)[number]["key"]) : "business";
  })();
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    // Keep the tab query param in sync (so refresh + link-sharing works)
    if (router.query.tab !== activeTab) {
      router.replace(
        { pathname: router.pathname, query: { ...router.query, tab: activeTab } },
        undefined,
        { shallow: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const visibleCards = settingsCards.filter((c) => c.group === activeTab);

  return (
    <>
      <Head />
      <Box sx={{ px: { xs: 2, md: 0 }, py: { xs: 1, md: 0 }, maxWidth: "1200px" }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant={isMobile ? "fullWidth" : "standard"}
          aria-label="Settings section tabs"
          sx={{
            mb: { xs: 2, md: 3 },
            minHeight: 40,
            "& .MuiTab-root": {
              fontFamily: "UrbanistSemibold",
              fontSize: { xs: 13, md: 14 },
              textTransform: "none",
              minHeight: 40,
              px: { xs: 2, md: 3 },
            },
            "& .MuiTabs-indicator": {
              backgroundColor: theme.palette.primary.main,
              height: 3,
              borderRadius: 2,
            },
          }}
        >
          {tabs.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={t.label}
              data-testid={`settings-tab-${t.key}`}
            />
          ))}
        </Tabs>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            },
            gap: { xs: "12px", md: "16px" },
          }}
        >
          {visibleCards.map((card) => (
            <Box
              key={card.id}
              data-testid={`settings-card-${card.title.toLowerCase().replace(/\s+/g, "-")}`}
              role="button"
              tabIndex={0}
              onClick={() => router.push(card.path)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(card.path);
                }
              }}
              sx={{
                p: { xs: "16px", md: "20px 24px" },
                borderRadius: "14px",
                bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#fff",
                border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#E9ECF2"}`,
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                "&:hover": {
                  borderColor: card.color + "60",
                  boxShadow: `0 4px 16px ${card.color}15`,
                  transform: "translateY(-2px)",
                },
                "&:focus-visible": {
                  outline: `2px solid ${card.color}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "12px",
                  bgcolor: card.color + "15",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: card.color,
                }}
              >
                {card.icon}
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontSize: { xs: "14px", md: "16px" },
                    fontFamily: "UrbanistSemibold",
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    mb: 0.5,
                  }}
                >
                  {card.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: "12px", md: "13px" },
                    fontFamily: "UrbanistMedium",
                    color: theme.palette.text.secondary,
                    lineHeight: 1.5,
                  }}
                >
                  {card.description}
                </Typography>
              </Box>
            </Box>
          ))}
          {visibleCards.length === 0 && (
            <Typography
              sx={{
                color: theme.palette.text.secondary,
                gridColumn: "1 / -1",
                textAlign: "center",
                py: 4,
                fontFamily: "UrbanistMedium",
              }}
            >
              No settings in this section yet.
            </Typography>
          )}
        </Box>
      </Box>
    </>
  );
};

export default SettingsPage;
