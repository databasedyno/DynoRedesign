import React from "react";
import { Box, SxProps, Theme, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";

/** FX provenance as returned by the API (`fx` block) or by useDisplayFx. */
export interface FxInfo {
  as_of?: string | null;
  is_stale?: boolean;
  fallback?: boolean;
  requested_currency?: string;
  asOf?: string | null;
  isStale?: boolean;
  requestedCurrency?: string;
}

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

/**
 * Small caption shown next to fiat totals only when the live rate is unavailable:
 *  - stale → "Rate as of 14:05" (last known rate in use)
 *  - fallback → "Shown in USD · EUR rate unavailable"
 * Renders nothing while the rate is live.
 */
export const FxAsOfLabel: React.FC<{ fx?: FxInfo | null; testId?: string; sx?: SxProps<Theme> }> = ({ fx, testId = "fx-rate-as-of", sx }) => {
  const { t } = useTranslation("common");
  if (!fx) return null;
  const asOf = fx.as_of ?? fx.asOf ?? null;
  const stale = fx.is_stale ?? fx.isStale ?? false;
  const requested = fx.requested_currency ?? fx.requestedCurrency ?? "";
  if (!fx.fallback && !(stale && asOf)) return null;

  const label = fx.fallback
    ? t("fxLabel.fallback", { currency: requested, defaultValue: "Shown in USD · {{currency}} rate unavailable" })
    : t("fxLabel.asOf", { time: fmtTime(asOf as string), defaultValue: "Rate as of {{time}}" });
  const hint = fx.fallback
    ? t("fxLabel.fallbackHint", { currency: requested, defaultValue: "We couldn't get a {{currency}} exchange rate, so these amounts are in US dollars. They switch back automatically." })
    : t("fxLabel.asOfHint", { defaultValue: "The live exchange rate is briefly unavailable, so we're using the last known rate. Payments are not affected." });

  return (
    <Tooltip title={hint} arrow>
      <Box
        component="span"
        data-testid={testId}
        data-fx-state={fx.fallback ? "fallback" : "stale"}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 0.9,
          py: "2px",
          borderRadius: 999,
          fontFamily: "var(--font-sans)",
          fontSize: 11.5,
          fontWeight: 600,
          lineHeight: 1.4,
          color: "warning.main",
          border: "1px solid",
          borderColor: "warning.main",
          opacity: 0.9,
          width: "fit-content",
          cursor: "help",
          ...(sx as object),
        }}
      >
        <Icon icon="mdi:clock-outline" width={12} />
        {label}
      </Box>
    </Tooltip>
  );
};

export default FxAsOfLabel;
