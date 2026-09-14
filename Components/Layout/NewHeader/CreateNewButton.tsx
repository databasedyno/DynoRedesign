import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Box, Button, ListItemIcon, ListItemText, Menu, MenuItem, useTheme } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import QuickCreateLinkPanel from "@/Components/Page/Payment-link/QuickCreateLinkPanel";
import { QUICK_CREATE_LINK_EVENT } from "@/Components/Common/CommandPalette";

/**
 * CreateNewButton — the ONE create control in the app chrome (audit F3 / N3).
 *
 * Law 3 of the IA audit: "One create control. `+ New` in the header; empty states
 * route into it." Before this, creating a thing was taught in several places at
 * once (a `+` glued to the Payment-links nav row, quick-action tiles, per-page
 * CTAs), so nothing was learned by repetition. This is the single affordance.
 *
 * Two entries only — Payment link and Product. *Bill* is deliberately absent:
 * DynoPay has no accounts-receivable invoicing (every row in tbl_invoice is a
 * RECEIPT for money already received), so offering "Bill" would promise a
 * capability that does not exist. It joins this menu the day real invoicing does.
 *
 * Keyboard: `n` opens it (ignored while typing, and with any modifier held, so it
 * can never fight a browser or OS shortcut).
 */
interface Props {
  /** `tab` = the centred "+" of the phone bottom bar (plan 1.14); `header` = the desktop/tablet pill. */
  variant?: "header" | "tab";
}

const CreateNewButton: React.FC<Props> = ({ variant = "header" }) => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation("dashboardLayout");
  const isTab = variant === "tab";
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // Move 2 (usability restructuring): pay-link creation is panel-first — the
  // side panel keeps the merchant in context; the full page stays reachable
  // via the panel's "All options" link.
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const close = useCallback(() => setAnchorEl(null), []);

  const go = useCallback(
    (path: string) => {
      close();
      router.push(path);
    },
    [close, router],
  );

  // `n` shortcut. Ignored when the user is typing, holding a modifier, or while
  // any drawer / dialog / menu is open — otherwise typing an "n" inside an open
  // panel (e.g. the quick-create drawer) re-opens this menu on top of it and its
  // focus trap swallows every following keystroke.
  // Header instance only: it is always mounted (CSS-hidden on phones), so the
  // tab instance must not register a second listener that double-opens the panel.
  useEffect(() => {
    if (isTab) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.isComposing) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      // Any VISIBLE MUI modal layer (Drawer, Dialog, Menu, Popover) or native
      // <dialog>. MUI keeps closed Dialogs mounted under a `.MuiModal-hidden`
      // wrapper whose inner Paper still carries role="dialog", so the role
      // selectors must be scoped to non-hidden modals or the shortcut dies for
      // the whole session after the first dialog ever opens.
      const modalOpen = Array.from(
        document.querySelectorAll(".MuiModal-root:not(.MuiModal-hidden), [role='dialog'], [role='alertdialog'], dialog[open]"),
      ).some((node) => !node.closest(".MuiModal-hidden") && getComputedStyle(node).visibility !== "hidden");
      if (modalOpen) return;
      e.preventDefault();
      if (buttonRef.current) setAnchorEl(buttonRef.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTab]);

  // Move 4: the ⌘K palette's "Create payment link" action opens the same
  // quick-create panel via a window event (decoupled from the palette).
  useEffect(() => {
    if (isTab) return;
    const onQuickCreate = () => setQuickCreateOpen(true);
    window.addEventListener(QUICK_CREATE_LINK_EVENT, onQuickCreate);
    return () => window.removeEventListener(QUICK_CREATE_LINK_EVENT, onQuickCreate);
  }, [isTab]);

  const isDark = theme.palette.mode === "dark";

  return (
    <>
      {isTab ? (
        <Box
          component="button"
          type="button"
          ref={buttonRef as any}
          onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
          data-testid="mobile-nav-create"
          aria-haspopup="menu"
          aria-expanded={open ? "true" : undefined}
          aria-label={t("navNew", { defaultValue: "New" })}
          sx={{
            all: "unset",
            boxSizing: "border-box",
            cursor: "pointer",
            width: 48,
            height: 48,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            backgroundColor: isDark ? "#818CF8" : "#4F46E5",
            color: isDark ? "#0A0A0B" : "#FFFFFF",
            boxShadow: isDark ? "0 6px 16px rgba(129,140,248,0.35)" : "0 6px 16px rgba(79,70,229,0.35)",
            WebkitTapHighlightColor: "transparent",
            transition: "background-color 150ms ease, transform 100ms ease",
            "&:hover": { backgroundColor: isDark ? "#A5B4FC" : "#4338CA" },
            "&:active": { transform: "scale(0.94)" },
            "&:focus-visible": {
              outline: `2px solid ${isDark ? "#A5B4FC" : "#4F46E5"}`,
              outlineOffset: 2,
            },
          }}
        >
          <AddRounded sx={{ fontSize: 26 }} />
        </Box>
      ) : (
      <Button
        ref={buttonRef}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        data-testid="header-create-new"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : undefined}
        aria-label={t("navNew", { defaultValue: "New" })}
        disableElevation
        variant="contained"
        sx={{
          minWidth: { xs: 40, sm: 0 },
          textTransform: "none",
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: "13.5px",
          borderRadius: "10px",
          px: { xs: 0.75, sm: 1.25 },
          py: 0.65,
          minHeight: 44,
          gap: 0.25,
          lineHeight: 1.2,
          backgroundColor: isDark ? "#818CF8" : "#4F46E5",
          color: isDark ? "#0A0A0B" : "#FFFFFF",
          transition: "background-color 150ms ease, transform 100ms ease",
          "&:hover": { backgroundColor: isDark ? "#A5B4FC" : "#4338CA" },
          "&:active": { transform: "scale(0.97)" },
          "&:focus-visible": {
            outline: `2px solid ${isDark ? "#A5B4FC" : "#4F46E5"}`,
            outlineOffset: 2,
          },
        }}
      >
        <AddRounded sx={{ fontSize: 18 }} />
        {/* Label hidden on the narrowest screens so the header never wraps. */}
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          {t("navNew", { defaultValue: "New" })}
        </Box>
        <KeyboardArrowDownRounded sx={{ fontSize: 16, display: { xs: "none", sm: "inline-block" }, opacity: 0.8 }} />
      </Button>
      )}

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        anchorOrigin={isTab ? { vertical: "top", horizontal: "center" } : { vertical: "bottom", horizontal: "left" }}
        transformOrigin={isTab ? { vertical: "bottom", horizontal: "center" } : { vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: isTab ? -1.25 : 0.75,
              minWidth: 210,
              borderRadius: "12px",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            close();
            setQuickCreateOpen(true);
          }}
          data-testid="header-create-paylink"
          sx={{ py: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <LinkRounded sx={{ fontSize: 19 }} />
          </ListItemIcon>
          <ListItemText
            primary={t("navNewPaymentLink", { defaultValue: "Payment link" })}
            primaryTypographyProps={{ fontSize: 14, fontFamily: "var(--font-sans)", fontWeight: 600 }}
          />
        </MenuItem>
        <MenuItem onClick={() => go("/pay-links/products/new")} data-testid="header-create-product" sx={{ py: 1 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Inventory2Rounded sx={{ fontSize: 19 }} />
          </ListItemIcon>
          <ListItemText
            primary={t("navNewProduct", { defaultValue: "Product" })}
            primaryTypographyProps={{ fontSize: 14, fontFamily: "var(--font-sans)", fontWeight: 600 }}
          />
        </MenuItem>
      </Menu>

      <QuickCreateLinkPanel open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
    </>
  );
};

export default CreateNewButton;
