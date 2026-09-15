import React, { useEffect, useState } from "react";
import { Box, Collapse, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { useDashboardData } from "@/hooks/useDashboardData";
import { CB_TOKENS } from "../../coinbase/styled";
import FeeTierCard from "../FeeTierCard";
import { money } from "./format";

const OPEN_KEY = "dash_plan_row_open";

/** Zone 6 — one collapsed line about pricing; expands to the full fee-tier ladder. */
const PlanRow: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const { feeTiers, stats } = useDashboardData();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(OPEN_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = () => {
    setOpen((v) => {
      try {
        window.localStorage.setItem(OPEN_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  const sym = (stats as any)?.currencySymbol || "$";
  const cur = (stats as any)?.currency || "USD";
  const tier = feeTiers?.currentTier || "Starter";
  const pct = feeTiers?.currentTierPercent ?? 1.5;
  const used = Number(feeTiers?.usedAmount ?? 0);
  const limit = Number(feeTiers?.monthlyLimit ?? 10000);
  const next = feeTiers?.nextTier;
  const nextPct = feeTiers?.nextTierPercent;
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;

  const summary = next
    ? t("command.planLine", {
        tier,
        pct,
        used: money(used, sym, cur, 0),
        limit: money(limit, sym, cur, 0),
        next,
        nextPct: nextPct ?? "",
        defaultValue: "{{tier}} tier · {{pct}}% · {{used}} of {{limit}} to {{next}} ({{nextPct}}%)",
      })
    : t("command.planLineTop", { tier, pct, defaultValue: "{{tier}} tier · {{pct}}% per payment" });

  return (
    <Box data-testid="plan-growth-row" data-open={open ? "1" : "0"}>
      <Box
        component="button"
        type="button"
        onClick={toggle}
        data-testid="plan-growth-toggle-btn"
        aria-expanded={open}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          px: { xs: 1.5, md: 2 },
          py: 1.25,
          border: 0,
          borderRadius: "12px",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: muted,
          transition: "background-color 150ms ease",
          "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(10,10,15,0.03)" },
          "&:focus-visible": { outline: `2px solid ${isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`, outlineOffset: 2 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <Icon name="layers" size={15} />
          <Box component="span" data-testid="plan-growth-summary" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: MONO, fontVariantNumeric: "tabular-nums", color: ink, fontWeight: 500 }}>
            {summary}
          </Box>
        </Box>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0, fontWeight: 600 }}>
          {open ? t("command.hidePlan", { defaultValue: "Hide" }) : t("command.planDetails", { defaultValue: "Plan & fees" })}
          <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
        </Box>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pt: 1 }}>
          <FeeTierCard />
        </Box>
      </Collapse>
    </Box>
  );
};

export default PlanRow;
