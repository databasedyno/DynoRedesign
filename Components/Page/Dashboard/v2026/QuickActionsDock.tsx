import React from "react";
import { Box, useTheme } from "@mui/material";
import Link from "next/link";
import { Icon } from "@/styles/uiKit";
import { useTranslation } from "react-i18next";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "../coinbase/styled";

/**
 * QuickActionsDock — a compact 2×2 tile grid of the merchant's most-used
 * destinations, rendered as real Next <Link> anchors (robust navigation,
 * works even before full hydration). Deliberately DROPS the old big
 * "Create payment link" button (the page header already carries that primary
 * CTA) so the same action isn't shouted three times on one screen.
 */
const QuickActionsDock: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);

  const shortcuts: Array<{ id: string; icon: string; label: string; href: string }> = [
    {
      id: "paylinks",
      icon: "link",
      label: t("qaShortcutPayLinks", { defaultValue: "Payment links" }),
      href: "/pay-links",
    },
    {
      id: "invoice",
      icon: "receipt-text",
      label: t("qaShortcutInvoice", { defaultValue: "Create invoice" }),
      href: "/invoices",
    },
    {
      id: "wallet",
      icon: "wallet",
      label: t("qaShortcutWallet", { defaultValue: "Open wallet" }),
      href: "/wallet",
    },
    {
      id: "creator",
      icon: "store",
      label: t("qaShortcutCreator", { defaultValue: "Creator page" }),
      href: "/creator",
    },
  ];

  return (
    <SurfaceCard
      data-testid="dash2026-quick-actions"
      sx={{ display: "flex", flexDirection: "column", gap: 2, p: { xs: 2.25, md: 2.5 } }}
    >
      <Eyebrow>{t("quickActions", { defaultValue: "Quick actions" })}</Eyebrow>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 1.25,
        }}
      >
        {shortcuts.map((s) => (
          <Box
            key={s.id}
            component={Link}
            href={s.href}
            data-testid={`dash2026-qa-${s.id}`}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              p: 1.5,
              borderRadius: "14px",
              textDecoration: "none",
              border: `1px solid ${
                isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light
              }`,
              cursor: "pointer",
              outline: "none",
              transition:
                "transform 150ms ease, border-color 150ms ease, background-color 150ms ease",
              "&:hover, &:focus-visible": {
                transform: "translateY(-2px)",
                borderColor: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.02)"
                  : "rgba(10,10,15,0.015)",
              },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
                backgroundColor: isDark
                  ? CB_TOKENS.indigo.darkGlow
                  : CB_TOKENS.indigo.lightGlow,
              }}
            >
              <Icon name={s.icon} size={18} />
            </Box>
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 13.5,
                fontWeight: 600,
                lineHeight: 1.2,
                color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
              }}
            >
              {s.label}
            </Box>
          </Box>
        ))}
      </Box>
    </SurfaceCard>
  );
};

export default QuickActionsDock;
