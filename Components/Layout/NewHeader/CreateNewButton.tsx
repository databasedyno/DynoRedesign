import { GOLD, GOLD_DEEP, BRAND_ACCENT, BRAND_ACCENT_HOVER, BRAND_ON_ACCENT } from "@/constants/theme";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, useTheme } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import QuickCreateLinkPanel from "@/Components/Page/Payment-link/QuickCreateLinkPanel";
import CreateHub from "./CreateHub";
import { OPEN_CREATE_HUB_EVENT, QUICK_CREATE_LINK_EVENT } from "@/Components/Common/CommandPalette";

/**
 * CreateNewButton — the ONE create control in the app chrome (audit F3 / N3).
 *
 * Law 3 of the IA audit: "One create control. `+ New` in the header; empty states
 * route into it." It now opens the Create hub (CreateHub) — a single surface that
 * lists ALL FOUR creatable types (Payment link, Fundraiser, Product, Creator page)
 * with a plain one-line description each, ordered by this account's own usage.
 * Nothing is hidden behind a footnote anymore (the old two-item menu buried the
 * fundraiser + full payment-link options, so merchants couldn't find them).
 *
 * Keyboard: `n` opens it (ignored while typing, and with any modifier held, so it
 * can never fight a browser or OS shortcut).
 */
interface Props {
  /** `tab` = the centred "+" of the phone bottom bar (plan 1.14); `header` = the desktop/tablet pill. */
  variant?: "header" | "tab";
}

const CreateNewButton: React.FC<Props> = ({ variant = "header" }) => {
  const theme = useTheme();
  const { t } = useTranslation("dashboardLayout");
  const isTab = variant === "tab";
  const [hubOpen, setHubOpen] = useState(false);
  // Move 2 (usability restructuring): pay-link creation is panel-first — the
  // side panel keeps the merchant in context; the full page stays reachable
  // from the hub's "Full options" link.
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const open = hubOpen;

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
      setHubOpen(true);
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

  // Empty states / CTAs across the app dispatch OPEN_CREATE_HUB_EVENT to open
  // the Create hub (so "create" always lands in the one place that lists all
  // four types, incl. Fundraiser). Header instance only — see `n` note above.
  useEffect(() => {
    if (isTab) return;
    const onOpenHub = () => setHubOpen(true);
    window.addEventListener(OPEN_CREATE_HUB_EVENT, onOpenHub);
    return () => window.removeEventListener(OPEN_CREATE_HUB_EVENT, onOpenHub);
  }, [isTab]);

  const isDark = theme.palette.mode === "dark";

  return (
    <>
      {isTab ? (
        <Box
          component="button"
          type="button"
          ref={buttonRef as any}
          onClick={() => setHubOpen(true)}
          data-testid="mobile-nav-create"
          aria-haspopup="dialog"
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
            backgroundColor: BRAND_ACCENT,
            color: BRAND_ON_ACCENT,
            boxShadow: "0 6px 16px rgba(255,209,0,0.35)",
            WebkitTapHighlightColor: "transparent",
            transition: "background-color 150ms ease, transform 100ms ease",
            "&:hover": { backgroundColor: BRAND_ACCENT_HOVER },
            "&:active": { transform: "scale(0.94)" },
            "&:focus-visible": {
              outline: `2px solid ${isDark ? GOLD : GOLD_DEEP}`,
              outlineOffset: 2,
            },
          }}
        >
          <AddRounded sx={{ fontSize: 26 }} />
        </Box>
      ) : (
      <Button
        ref={buttonRef}
        onClick={() => setHubOpen(true)}
        data-testid="header-create-new"
        aria-haspopup="dialog"
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
          backgroundColor: BRAND_ACCENT,
          color: BRAND_ON_ACCENT,
          transition: "background-color 150ms ease, transform 100ms ease",
          "&:hover": { backgroundColor: BRAND_ACCENT_HOVER },
          "&:active": { transform: "scale(0.97)" },
          "&:focus-visible": {
            outline: `2px solid ${isDark ? GOLD : GOLD_DEEP}`,
            outlineOffset: 2,
          },
        }}
      >
        <AddRounded sx={{ fontSize: 18 }} />
        {/* Label hidden on the narrowest screens so the header never wraps. */}
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          {t("navNew", { defaultValue: "New" })}
        </Box>
      </Button>
      )}

      <CreateHub
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        onQuickCreatePaylink={() => setQuickCreateOpen(true)}
      />

      <QuickCreateLinkPanel open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
    </>
  );
};

export default CreateNewButton;
