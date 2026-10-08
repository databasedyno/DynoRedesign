import React, { useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Box, Dialog, IconButton, Typography, useTheme } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { Icon } from "@iconify/react";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { brandFg, linkFg } from "@/constants/theme";
import useShellMode from "@/hooks/useShellMode";
import useBackToClose from "@/hooks/useBackToClose";
import BottomSheet from "@/Components/UI/BottomSheet";

/**
 * CreateHub — the single Create entry point (replaces the old two-item "+ New"
 * menu). Lists ALL FOUR creatable types, each with an icon and a one-line
 * "what it's for", so nothing a merchant was promised (a fundraiser, a creator
 * page) is hidden behind a footnote.
 *
 * Order = this account's own creation history (localStorage usage counter keyed
 * by company). New accounts / ties fall back to a sensible default order, and
 * the Creator page is always visible to everyone.
 *
 * Payment link exposes BOTH paths explicitly: the primary click opens the quick
 * panel; a labelled "Full options" link goes to the complete creator (taxes,
 * expiry, redirects, accepted coins) — no longer buried behind "All options".
 */

type CreateKey = "paylink" | "fundraiser" | "product" | "creator";

const USAGE_KEY = "dyno.createUsage.v1";

const readUsage = (companyId: number | null): Record<string, number> => {
  if (typeof window === "undefined" || !companyId) return {};
  try {
    const all = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    return (all && all[String(companyId)]) || {};
  } catch {
    return {};
  }
};

const bumpUsage = (companyId: number | null, key: CreateKey) => {
  if (typeof window === "undefined" || !companyId) return;
  try {
    const all = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    const cid = String(companyId);
    all[cid] = all[cid] || {};
    all[cid][key] = (all[cid][key] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / disabled storage */
  }
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Opens the quick payment-link panel (kept in the parent alongside its own panel). */
  onQuickCreatePaylink: () => void;
}

const CreateHub: React.FC<Props> = ({ open, onClose, onQuickCreatePaylink }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const { selectedCompanyId } = useCompanyStore();
  // Phones: a bottom sheet (thumb reach, swipe to dismiss); larger screens: a dialog.
  const { isPhone } = useShellMode();
  const sheetReleaseRef = useRef<(() => void) | null>(null);
  const dialogRelease = useBackToClose(open && !isPhone, onClose, "create-hub");
  const leaveTo = useCallback(
    (path: string) => {
      if (isPhone) sheetReleaseRef.current?.();
      else dialogRelease();
      onClose();
      router.replace(path);
    },
    [isPhone, dialogRelease, onClose, router],
  );

  const go = useCallback(
    (key: CreateKey, path: string) => {
      bumpUsage(selectedCompanyId ?? null, key);
      leaveTo(path);
    },
    [leaveTo, selectedCompanyId],
  );

  const quickPaylink = useCallback(() => {
    bumpUsage(selectedCompanyId ?? null, "paylink");
    onClose();
    onQuickCreatePaylink();
  }, [onClose, onQuickCreatePaylink, selectedCompanyId]);

  // Default order; re-sorted by this account's usage (stable for ties).
  const items = useMemo(() => {
    const base: Array<{
      key: CreateKey;
      icon: string;
      title: string;
      desc: string;
      accent: string;
      onClick: () => void;
      testId: string;
      full?: { label: string; onClick: () => void; testId: string };
      mostUsed?: boolean;
    }> = [
      {
        key: "paylink",
        icon: "mdi:link-variant",
        title: t("navNewPaymentLink", { defaultValue: "Payment link" }),
        desc: t("hubPaylinkDesc", { defaultValue: "Request a fixed amount for a product, invoice or service." }),
        accent: brandFg(isDark),
        onClick: quickPaylink,
        testId: "create-hub-paylink",
        full: {
          label: t("hubPaylinkFull", { defaultValue: "Full options: taxes, expiry, accepted coins" }),
          onClick: () => go("paylink", "/create-pay-link"),
          testId: "create-hub-paylink-full",
        },
      },
      {
        key: "fundraiser",
        icon: "mdi:hand-heart-outline",
        title: t("navNewFundraiser", { defaultValue: "Fundraiser" }),
        desc: t("hubFundraiserDesc", { defaultValue: "Collect donations toward a goal, with a progress bar and donor wall." }),
        accent: "#10B981",
        onClick: () => go("fundraiser", "/create-pay-link?type=donation"),
        testId: "create-hub-fundraiser",
      },
      {
        key: "product",
        icon: "mdi:package-variant-closed",
        title: t("navNewProduct", { defaultValue: "Product" }),
        desc: t("hubProductDesc", { defaultValue: "Sell a product with variants, images and inventory." }),
        accent: "#6366F1",
        onClick: () => go("product", "/pay-links/products/new"),
        testId: "create-hub-product",
      },
      {
        key: "creator",
        icon: "mdi:account-star-outline",
        title: t("navNewCreatorPage", { defaultValue: "Creator page" }),
        desc: t("hubCreatorDesc", { defaultValue: "A shareable page for tips and support at your dynopay.com/handle." }),
        accent: "#F59E0B",
        onClick: () => go("creator", "/storefront?tab=page"),
        testId: "create-hub-creator",
      },
    ];
    const usage = readUsage(selectedCompanyId ?? null);
    const ranked = base
      .map((it, i) => ({ it, i, used: usage[it.key] || 0 }))
      .sort((a, b) => b.used - a.used || a.i - b.i);
    const topUsedKey = ranked.length && ranked[0].used > 0 ? ranked[0].it.key : null;
    return ranked.map((x) => ({ ...x.it, mostUsed: x.it.key === topUsedKey }));
  }, [t, isDark, quickPaylink, go, selectedCompanyId]);

  const border = isDark ? "rgba(255,255,255,0.10)" : "#E9ECF2";
  const rowHover = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";

  const content = (
    <>
      {/* Options */}
      <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 1.5, display: "grid", gap: 1 }}>
        {items.map((it) => (
          <Box
            key={it.key}
            sx={{
              border: `1px solid ${border}`,
              borderRadius: "12px",
              overflow: "hidden",
              transition: "border-color 140ms ease",
              "&:hover": { borderColor: it.accent },
            }}
          >
            <Box
              role="button"
              tabIndex={0}
              data-testid={it.testId}
              onClick={it.onClick}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  it.onClick();
                }
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.75,
                px: { xs: 1.75, sm: 2 },
                py: 1.75,
                cursor: "pointer",
                userSelect: "none",
                "&:hover": { backgroundColor: rowHover },
                "&:focus-visible": { outline: `2px solid ${it.accent}`, outlineOffset: -2 },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  minWidth: 40,
                  borderRadius: "10px",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  backgroundColor: isDark ? `${it.accent}22` : `${it.accent}14`,
                  color: it.accent,
                }}
              >
                <Icon icon={it.icon} width={22} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                  <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 14.5, color: theme.palette.text.primary, lineHeight: 1.3 }}>
                    {it.title}
                  </Typography>
                  {it.mostUsed && (
                    <Box
                      component="span"
                      data-testid={`${it.testId}-mostused`}
                      sx={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                        px: 0.75,
                        py: 0.15,
                        borderRadius: 999,
                        color: it.accent,
                        backgroundColor: isDark ? `${it.accent}22` : `${it.accent}14`,
                      }}
                    >
                      {t("hubMostUsed", { defaultValue: "Most used" })}
                    </Box>
                  )}
                </Box>
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: 1.45, mt: 0.25 }}>
                  {it.desc}
                </Typography>
              </Box>
              <ChevronRightRoundedIcon sx={{ fontSize: 22, color: theme.palette.text.secondary, flexShrink: 0 }} />
            </Box>

            {it.full && (
              <Box
                component="button"
                type="button"
                data-testid={it.full.testId}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  it.full!.onClick();
                }}
                sx={{
                  all: "unset",
                  boxSizing: "border-box",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  cursor: "pointer",
                  px: { xs: 1.75, sm: 2 },
                  py: 1,
                  borderTop: `1px dashed ${border}`,
                  fontFamily: "var(--font-sans)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: it.accent,
                  "&:hover": { backgroundColor: rowHover },
                  "&:focus-visible": { outline: `2px solid ${it.accent}`, outlineOffset: -2 },
                }}
              >
                <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
                {it.full.label}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Honest settlement note */}
      <Box
        data-testid="create-hub-settlement-note"
        sx={{
          mx: { xs: 2, sm: 2.5 },
          mb: 2.5,
          mt: 0.5,
          px: 1.75,
          py: 1.5,
          borderRadius: "10px",
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          border: `1px solid ${border}`,
        }}
      >
        <BoltRoundedIcon sx={{ fontSize: 18, color: theme.palette.text.secondary, mt: 0.1, flexShrink: 0 }} />
        <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: 1.5 }}>
          {t("hubSettlementNote", {
            defaultValue: "You'll receive the coin each customer pays. Turn on auto-convert to settle in a stablecoin instead.",
          })}{" "}
          <Box
            component="button"
            type="button"
            data-testid="create-hub-settlement-cta"
            onClick={() => leaveTo("/payouts")}
            sx={{
              background: "none",
              border: "none",
              p: 0,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 12.5,
              fontWeight: 700,
              color: linkFg(isDark),
              textDecoration: "underline",
            }}
          >
            {t("hubSettlementCta", { defaultValue: "Auto-convert settings" })}
          </Box>
        </Typography>
      </Box>
    </>
  );

  if (isPhone) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t("hubTitle", { defaultValue: "Create" })}
        closeLabel={t("navClose", { defaultValue: "Close" })}
        data-testid="create-hub"
        onReleaseRef={sheetReleaseRef}
      >
        <Box sx={{ pt: 0.5 }}>{content}</Box>
      </BottomSheet>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      data-testid="create-hub"
      PaperProps={{
        sx: {
          borderRadius: "16px",
          backgroundColor: theme.palette.background.paper,
          backgroundImage: "none",
          border: `1px solid ${border}`,
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", px: { xs: 2.5, sm: 3 }, pt: 2.5, pb: 1 }}>
        <Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 19, color: theme.palette.text.primary }}>
            {t("hubTitle", { defaultValue: "Create" })}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: theme.palette.text.secondary, mt: 0.25 }}>
            {t("hubSubtitle", { defaultValue: "What would you like to set up?" })}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label={t("navClose", { defaultValue: "Close" })}
          data-testid="create-hub-close"
          sx={{ minWidth: 40, minHeight: 40, color: theme.palette.text.secondary }}
        >
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {content}
    </Dialog>
  );
};

export default CreateHub;
