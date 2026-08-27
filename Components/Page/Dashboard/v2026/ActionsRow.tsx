import React, { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import Link from "next/link";
import useProfile from "@/hooks/useProfile";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "../coinbase/styled";

/** Catalog of every shortcut the merchant can pin (mirrors QuickActionsDock). */
const CATALOG: Record<
  string,
  { icon: string; href: string; key: string; def: string }
> = {
  "create-paylink": { icon: "circle-plus", href: "/create-pay-link", key: "qaCatCreatePaylink", def: "Create payment link" },
  paylinks: { icon: "link", href: "/pay-links", key: "qaShortcutPayLinks", def: "Payment links" },
  invoice: { icon: "receipt-text", href: "/invoices", key: "qaShortcutInvoice", def: "Invoices" },
  wallet: { icon: "wallet", href: "/wallet", key: "qaShortcutWallet", def: "Wallet" },
  transactions: { icon: "arrow-left-right", href: "/transactions", key: "qaCatTransactions", def: "Transactions" },
  creator: { icon: "store", href: "/storefront?tab=page", key: "qaShortcutCreator", def: "Your page" },
  products: { icon: "package", href: "/storefront?tab=products", key: "qaCatProducts", def: "Products" },
  fees: { icon: "percent", href: "/fees", key: "qaCatFees", def: "Fees & tiers" },
  api: { icon: "code", href: "/developer-keys", key: "qaCatApi", def: "Developer / API" },
  referrals: { icon: "gift", href: "/referrals", key: "qaCatReferrals", def: "Referrals" },
};

const DEFAULT_SLUGS = ["paylinks", "invoice", "wallet", "transactions"];

/**
 * ActionsRow — P4. The old 2×2 QuickActionsDock (with drag-reorder, spotlight
 * tooltip and inline customize modal) collapses into a calm row of 4 ghost
 * buttons directly under the header. It honours the merchant's saved pinned
 * shortcuts (profile.dashboard_quick_actions) and falls back to a sensible
 * default set. Deep customization moves to the avatar-menu "Personalize".
 */
const ActionsRow: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);

  const saved = useProfile().profile?.dashboard_quick_actions;

  const slugs = useMemo(() => {
    const arr = Array.isArray(saved)
      ? saved.filter((id: string) => CATALOG[id]).slice(0, 4)
      : [];
    return arr.length ? arr : DEFAULT_SLUGS;
  }, [saved]);

  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const ink = isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;

  return (
    <Box
      data-testid="dash2026-actions-row"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
        gap: { xs: 1, md: 1.5 },
      }}
    >
      {slugs.map((id: string) => {
        const s = CATALOG[id];
        if (!s) return null;
        return (
          <Box
            key={id}
            component={Link}
            href={s.href}
            data-testid={`dash2026-action-${id}`}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              minHeight: 46,
              px: 1.5,
              py: 1.25,
              borderRadius: "10px",
              border: `1px solid ${border}`,
              textDecoration: "none",
              color: ink,
              backgroundColor: "transparent",
              transition: "border-color 150ms ease, color 150ms ease, background-color 150ms ease",
              "&:hover, &:focus-visible": {
                borderColor: indigo,
                color: indigo,
                backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)",
                outline: "none",
              },
            }}
          >
            <Icon name={s.icon} size={17} />
            <Box
              component="span"
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 13.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t(s.key, { defaultValue: s.def })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default ActionsRow;
