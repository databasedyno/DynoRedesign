import React, { useCallback, useEffect, useState } from "react";
import { Box, IconButton, useTheme } from "@mui/material";
import {
  ArrowForwardRounded,
  Close,
  RedeemRounded,
  StorefrontRounded,
  AccountBalanceWalletRounded,
  BusinessRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import { CB_TOKENS } from "./styled";

/**
 * AttentionCardsRow — a 2-column row of dismissible action cards
 * that mimics Coinbase's "Earn up to €100 in BTC" invite tiles.
 *
 * Which cards render depends on merchant setup state:
 *   1. Always: Refer & earn — 100% match, unlimited                       → /referrals
 *   2. If no company:      "Add your company"                             → /profile
 *   3. Else if no wallet:  "Add your first wallet"                        → /wallet
 *   4. Else if !hasHandle: "Claim your @handle"                           → /profile#handle
 *   5. Else:               "Explore Creator Page" (still shown as tile)   → /creator
 *
 * Cards remember dismissal per browser via localStorage; referral tile is
 * always shown (dismiss = hide until next new session).
 */

type Card = {
  id: string;
  title: string;
  body: string;
  cta: string;
  icon: React.ReactElement;
  href: string;
  gradient: [string, string]; // dark, light
};

const AttentionCardsRow: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);

  const companyState = useSelector((s: rootReducer) => s.companyReducer);
  const walletState = useSelector((s: rootReducer) => s.walletReducer);
  const userState = useSelector((s: any) => s.userReducer);
  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;
  const hasHandle = Boolean(userState?.profile?.handle);

  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("cb_dismissed_cards");
      if (raw) setDismissed(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = { ...prev, [id]: true };
      try {
        window.localStorage.setItem("cb_dismissed_cards", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const referralCard: Card = {
    id: "referral",
    title: t("attnReferralTitle", {
      defaultValue: "Refer merchants, earn commission",
    }),
    body: t("attnReferralBody", {
      defaultValue: "Invite a business, and you both get lifetime revenue share.",
    }),
    cta: t("attnReferralCta", { defaultValue: "Learn more" }),
    icon: <RedeemRounded sx={{ fontSize: 22 }} />,
    href: "/referrals",
    gradient: ["#3773F5", "#4F46E5"],
  };

  const setupCard: Card | null = !hasCompany
    ? {
        id: "add-company",
        title: t("attnAddCompanyTitle", { defaultValue: "Add your company" }),
        body: t("attnAddCompanyBody", {
          defaultValue: "Register your business to unlock invoices and payouts.",
        }),
        cta: t("attnAddCompanyCta", { defaultValue: "Add company" }),
        icon: <BusinessRounded sx={{ fontSize: 22 }} />,
        href: "/profile",
        gradient: ["#0EA5E9", "#0284C7"],
      }
    : !hasWallet
      ? {
          id: "add-wallet",
          title: t("attnAddWalletTitle", { defaultValue: "Add your first wallet" }),
          body: t("attnAddWalletBody", {
            defaultValue: "Connect a wallet to start accepting crypto payments.",
          }),
          cta: t("attnAddWalletCta", { defaultValue: "Add wallet" }),
          icon: <AccountBalanceWalletRounded sx={{ fontSize: 22 }} />,
          href: "/wallet",
          gradient: ["#8B5CF6", "#7C3AED"],
        }
      : !hasHandle
        ? {
            id: "claim-handle",
            title: t("attnClaimHandleTitle", {
              defaultValue: "Claim your @handle",
            }),
            body: t("attnClaimHandleBody", {
              defaultValue: "Give supporters a memorable link like dynopay.com/@you.",
            }),
            cta: t("attnClaimHandleCta", { defaultValue: "Claim now" }),
            icon: <StorefrontRounded sx={{ fontSize: 22 }} />,
            href: "/profile",
            gradient: ["#F472B6", "#EC4899"],
          }
        : {
            id: "creator-page",
            title: t("attnCreatorPageTitle", {
              defaultValue: "Publish your creator page",
            }),
            body: t("attnCreatorPageBody", {
              defaultValue: "A share-ready storefront for tips, tiers, and products.",
            }),
            cta: t("attnCreatorPageCta", { defaultValue: "Open editor" }),
            icon: <StorefrontRounded sx={{ fontSize: 22 }} />,
            href: "/creator",
            gradient: ["#F472B6", "#EC4899"],
          };

  const cards = [referralCard, setupCard].filter(
    (c): c is Card => Boolean(c) && !dismissed[c!.id],
  );

  if (cards.length === 0) return null;

  return (
    <Box
      data-testid="cb-attention-row"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: `repeat(${cards.length}, 1fr)`,
        },
        gap: 2,
      }}
    >
      {cards.map((c) => (
        <Box
          key={c.id}
          role="button"
          tabIndex={0}
          onClick={() => router.push(c.href)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") router.push(c.href);
          }}
          data-testid={`cb-attn-${c.id}`}
          sx={{
            position: "relative",
            borderRadius: 20,
            padding: 2.5,
            cursor: "pointer",
            border: `1px solid ${
              theme.palette.mode === "dark"
                ? CB_TOKENS.border.dark
                : CB_TOKENS.border.light
            }`,
            backgroundColor:
              theme.palette.mode === "dark"
                ? CB_TOKENS.surface.dark
                : CB_TOKENS.surface.light,
            overflow: "hidden",
            transition: "transform 150ms ease, border-color 150ms ease",
            "&:hover": {
              transform: "translateY(-2px)",
              borderColor:
                theme.palette.mode === "dark"
                  ? CB_TOKENS.indigo.dark
                  : CB_TOKENS.indigo.light,
            },
            "&::after": {
              content: '""',
              position: "absolute",
              top: -60,
              right: -60,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${c.gradient[0]}22 0%, transparent 70%)`,
              pointerEvents: "none",
            },
          }}
        >
          {/* Dismiss button */}
          <IconButton
            size="small"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              dismiss(c.id);
            }}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              color:
                theme.palette.mode === "dark"
                  ? CB_TOKENS.ink.mutedDark
                  : CB_TOKENS.ink.mutedLight,
              "&:hover": {
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(10,10,15,0.05)",
              },
            }}
          >
            <Close sx={{ fontSize: 16 }} />
          </IconButton>

          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 2,
              position: "relative",
              zIndex: 1,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${c.gradient[0]}22`,
                color: c.gradient[0],
                flexShrink: 0,
              }}
            >
              {c.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, pr: 2 }}>
              <Box
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  fontWeight: 700,
                  color:
                    theme.palette.mode === "dark"
                      ? CB_TOKENS.ink.primaryDark
                      : CB_TOKENS.ink.primaryLight,
                  mb: 0.5,
                }}
              >
                {c.title}
              </Box>
              <Box
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color:
                    theme.palette.mode === "dark"
                      ? CB_TOKENS.ink.secondaryDark
                      : CB_TOKENS.ink.secondaryLight,
                  lineHeight: 1.45,
                  mb: 1.25,
                }}
              >
                {c.body}
              </Box>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 600,
                  color:
                    theme.palette.mode === "dark"
                      ? CB_TOKENS.indigo.dark
                      : CB_TOKENS.indigo.light,
                }}
              >
                {c.cta}
                <ArrowForwardRounded sx={{ fontSize: 14 }} />
              </Box>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default AttentionCardsRow;
