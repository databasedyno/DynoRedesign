import React, { useEffect, useState } from "react";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { brandFg } from "@/constants/theme";
import axiosBaseApi from "@/axiosConfig";

/**
 * PageTip — a calm, one-time "first-visit" hint shown once at the top of a
 * page to explain what the page is for in a single sentence (Blueprint §5 /
 * §6.4). Dismissed once → never shown again: remembered per ACCOUNT on the
 * server (GET/POST /api/track/page-tips) and cached in localStorage.
 *
 * Design language (Quiet Money): illustration-free, hairline border, soft
 * 12px radius, a 3px indigo left-accent echoing the sidebar's active row, a
 * faint indigo tint, one short sentence. Motion is a 200ms ease-out fade that
 * honours `prefers-reduced-motion`. Fully keyboard-operable with a visible
 * focus ring; 40px touch target for the mobile dismiss control.
 *
 * Copy lives in the shared `common` namespace under `pageTips.<tipKey>` so a
 * single component covers every page and stays translated in all 6 languages.
 */

const STORAGE_BASE = "dynopay.pagetip.v2.";

// Cache is scoped to the signed-in account so another account on this browser still sees its tips.
const storageKey = (key: string): string => {
  let uid = "anon";
  try {
    const token = window.localStorage.getItem("token");
    const payload = token ? JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) : null;
    if (payload?.user_id) uid = String(payload.user_id);
  } catch {
    /* ignore */
  }
  return `${STORAGE_BASE}${uid}.${key}`;
};

const isDismissed = (key: string): boolean => {
  // SSR: return true so the tip never flashes before hydration decides.
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey(key)) === "1";
  } catch {
    return false;
  }
};

const markDismissed = (key: string) => {
  try {
    window.localStorage.setItem(storageKey(key), "1");
  } catch {
    /* storage unavailable — the server copy still remembers it */
  }
  accountDismissed = null;
  axiosBaseApi.post("track/page-tips/dismiss", { key }).catch(() => {});
};

// One request per page load, shared by every tip (cleared after a dismissal).
let accountDismissed: Promise<string[]> | null = null;
let accountDismissedFor = "";
const fetchAccountDismissed = (): Promise<string[]> => {
  const scope = storageKey("");
  if (!accountDismissed || accountDismissedFor !== scope) {
    accountDismissedFor = scope;
    accountDismissed = axiosBaseApi
      .get("track/page-tips")
      .then((r) => (Array.isArray(r.data?.dismissed) ? r.data.dismissed : []))
      .catch(() => []);
  }
  return accountDismissed;
};

export interface PageTipProps {
  /** Key into `common:pageTips.<tipKey>` (title + body). */
  tipKey: string;
}

const PageTip: React.FC<PageTipProps> = ({ tipKey }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, i18n } = useTranslation("common");
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const bodyPath = `pageTips.${tipKey}.body`;
  const hasTip = i18n.exists(`common:${bodyPath}`);

  useEffect(() => {
    if (!hasTip) return;
    if (isDismissed(tipKey)) return;
    let cancelled = false;
    fetchAccountDismissed().then((keys) => {
      if (cancelled) return;
      if (keys.includes(tipKey)) {
        try {
          window.localStorage.setItem(storageKey(tipKey), "1");
        } catch {
          /* ignore */
        }
        return;
      }
      setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tipKey, hasTip]);

  if (!hasTip) return null;
  if (!visible && !leaving) return null;

  const title = t(`pageTips.${tipKey}.title`, { defaultValue: "" });
  const body = t(bodyPath);
  const dismissLabel = t("pageTips.dismiss", { defaultValue: "Got it" });
  const accent = brandFg(isDark);

  const handleDismiss = () => {
    markDismissed(tipKey);
    setVisible(false);
    setLeaving(true);
    window.setTimeout(() => setLeaving(false), 220);
  };

  return (
    <Box
      role="note"
      aria-label={title || body}
      data-testid={`page-tip-${tipKey}`}
      sx={{
        mb: { xs: 2, md: 2.5 },
        display: "flex",
        alignItems: "flex-start",
        gap: { xs: "10px", md: "12px" },
        p: { xs: "12px 10px 12px 14px", md: "14px 16px" },
        borderRadius: "12px",
        border: `1px solid ${theme.palette.border.main}`,
        borderLeft: `3px solid ${accent}`,
        backgroundColor: isDark
          ? "rgba(255,209,0,0.08)"
          : "rgba(139,94,0,0.05)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 200ms ease-out, transform 200ms ease-out",
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          transform: "none",
        },
      }}
    >
      {/* Icon chip */}
      <Box
        aria-hidden
        sx={{
          width: 28,
          height: 28,
          mt: "1px",
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          backgroundColor: isDark
            ? "rgba(255,209,0,0.16)"
            : "rgba(139,94,0,0.10)",
        }}
      >
        <Icon name="lightbulb" size={16} />
      </Box>

      {/* Text */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          pt: title ? 0 : "3px",
        }}
      >
        {title && (
          <Typography
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: { xs: "13px", md: "13.5px" },
              fontWeight: 600,
              lineHeight: 1.3,
              color: theme.palette.text.primary,
            }}
          >
            {title}
          </Typography>
        )}
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: 1.45,
            color: theme.palette.text.secondary,
          }}
        >
          {body}
        </Typography>
      </Box>

      {/* Dismiss — text button on ≥sm, compact icon on phones */}
      <Box
        component="button"
        type="button"
        onClick={handleDismiss}
        data-testid={`page-tip-dismiss-${tipKey}`}
        aria-label={dismissLabel}
        sx={{
          display: { xs: "none", sm: "inline-flex" },
          alignItems: "center",
          alignSelf: "center",
          flexShrink: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          fontWeight: 600,
          color: accent,
          padding: "6px 8px",
          borderRadius: "8px",
          transition: "background-color 150ms ease",
          "&:hover": {
            backgroundColor: isDark
              ? "rgba(255,209,0,0.12)"
              : "rgba(139,94,0,0.08)",
          },
          "&:focus-visible": {
            outline: `2px solid ${accent}`,
            outlineOffset: 1,
          },
        }}
      >
        {dismissLabel}
      </Box>
      <IconButton
        onClick={handleDismiss}
        aria-label={dismissLabel}
        data-testid={`page-tip-close-${tipKey}`}
        size="small"
        sx={{
          display: { xs: "inline-flex", sm: "none" },
          width: 40,
          height: 40,
          flexShrink: 0,
          alignSelf: "flex-start",
          color: theme.palette.text.secondary,
          "&:focus-visible": {
            outline: `2px solid ${accent}`,
            outlineOffset: 1,
          },
        }}
      >
        <Icon name="x" size={18} />
      </IconButton>
    </Box>
  );
};

export default PageTip;
