import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Box, Button, ListItemIcon, ListItemText, Menu, MenuItem, useTheme } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";

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
const CreateNewButton: React.FC = () => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation("dashboardLayout");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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

  // `n` shortcut. Ignored when the user is typing or holding a modifier.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      e.preventDefault();
      if (buttonRef.current) setAnchorEl(buttonRef.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isDark = theme.palette.mode === "dark";

  return (
    <>
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
          minWidth: { xs: 44, sm: 0 },
          textTransform: "none",
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: "13.5px",
          borderRadius: "10px",
          px: { xs: 1, sm: 1.25 },
          py: 0.65,
          minHeight: 44,
          gap: 0.25,
          lineHeight: 1.2,
          backgroundColor: isDark ? "#818CF8" : "#0A0A0B",
          color: isDark ? "#0A0A0B" : "#FFFFFF",
          "&:hover": { backgroundColor: isDark ? "#A5B4FC" : "#26262B" },
        }}
      >
        <AddRounded sx={{ fontSize: 18 }} />
        {/* Label hidden on the narrowest screens so the header never wraps. */}
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          {t("navNew", { defaultValue: "New" })}
        </Box>
        <KeyboardArrowDownRounded sx={{ fontSize: 16, display: { xs: "none", sm: "inline-block" }, opacity: 0.8 }} />
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              minWidth: 210,
              borderRadius: "12px",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            },
          },
        }}
      >
        <MenuItem onClick={() => go("/create-pay-link")} data-testid="header-create-paylink" sx={{ py: 1 }}>
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
    </>
  );
};

export default CreateNewButton;
