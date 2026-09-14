import CustomButton from "@/Components/UI/Buttons";
import type { ReusableCompany } from "@/hooks/useReusableWallets";
import { Icon } from "@/styles/uiKit";
import { Box, Typography, useTheme } from "@mui/material";
import React from "react";
import { Tw, tone } from "./types";

interface Props {
  companies: ReusableCompany[];
  sel: Record<string, boolean>;
  copyingFrom: number | null;
  onToggle: (cid: number, cur: string) => void;
  onToggleAll: (c: ReusableCompany, on: boolean) => void;
  onCopy: (c: ReusableCompany) => void;
  tw: Tw;
}

export const ReuseSection: React.FC<Props> = ({ companies, sel, copyingFrom, onToggle, onToggleAll, onCopy, tw }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const c = tone(dark);
  const border = theme.palette.border?.main || theme.palette.divider;

  return (
    <Box data-testid="wallet-manager-reuse" sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      {companies.map((co) => {
        const selCount = co.wallets.filter((w) => sel[`${co.company_id}:${w.currency}`]).length;
        const allOn = selCount === co.wallets.length;
        return (
          <Box
            key={co.company_id}
            data-testid={`wallet-manager-reuse-${co.company_id}`}
            sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "8px", border: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 1.25 }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: "6px", display: "grid", placeItems: "center", backgroundColor: c.surfaceHover, flexShrink: 0 }}>
                  <Icon name="building-2" size={14} color={theme.palette.text.secondary} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{co.company_name}</Typography>
                  <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                    {tw("reuseMissingHere", "{{n}} wallets this brand doesn't have yet", { n: co.wallet_count })}
                  </Typography>
                </Box>
              </Box>
              <Box
                component="button"
                type="button"
                onClick={() => onToggleAll(co, !allOn)}
                data-testid={`wallet-manager-reuse-all-${co.company_id}`}
                sx={{ all: "unset", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-sans)", color: c.indigo, whiteSpace: "nowrap" }}
              >
                {allOn ? tw("selectNone", "Clear") : tw("selectAll", "Select all")}
              </Box>
            </Box>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {co.wallets.map((w) => {
                const on = !!sel[`${co.company_id}:${w.currency}`];
                return (
                  <Box
                    key={w.currency}
                    component="button"
                    type="button"
                    onClick={() => onToggle(co.company_id, w.currency)}
                    aria-pressed={on}
                    data-testid={`wallet-manager-reuse-chip-${co.company_id}-${w.currency}`}
                    sx={{
                      all: "unset",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      height: 28,
                      px: 1.1,
                      borderRadius: "6px",
                      border: `1px solid ${on ? c.indigo : border}`,
                      backgroundColor: on ? c.indigoSoft : "transparent",
                      color: on ? c.indigo : theme.palette.text.secondary,
                      fontSize: 11.5,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {on && <Icon name="check" size={12} color={c.indigo} />}
                    {w.currency}
                  </Box>
                );
              })}
            </Box>

            <CustomButton
              label={tw("copyN", "Copy {{n}} wallets", { n: selCount })}
              variant="outlined"
              size="small"
              onClick={() => onCopy(co)}
              disabled={copyingFrom !== null || selCount === 0}
              loading={copyingFrom === co.company_id}
              startIcon={<Icon name="copy" size={14} />}
              sx={{ alignSelf: "flex-start", height: 34 }}
              data-testid={`wallet-manager-reuse-copy-${co.company_id}`}
            />
          </Box>
        );
      })}
      {/* icon-bundle literals: <Icon name="building-2" /> <Icon name="check" /> <Icon name="copy" /> */}
    </Box>
  );
};
