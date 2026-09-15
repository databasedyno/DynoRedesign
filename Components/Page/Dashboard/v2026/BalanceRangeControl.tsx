import React, { useState } from "react";
import { Box, Menu, MenuItem } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { PillButton } from "../coinbase/styled";
import { RangeId, RANGES } from "./ranges";

interface Props {
  isDark: boolean;
  range: RangeId;
  customActive: boolean;
  customLabel: string;
  onRangeChange: (r: RangeId) => void;
  /** Opens the custom-range popover anchored to the given element. */
  onOpenCustom: (anchor: HTMLElement) => void;
}

/** Range picker: ONE dropdown on phones (Move 5), segmented pill tablist from `sm` up. */
export const BalanceRangeControl: React.FC<Props> = ({ isDark, range, customActive, customLabel, onRangeChange, onOpenCustom }) => {
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <>
      <Box sx={{ display: { xs: "block", sm: "none" } }}>
        <PillButton
          active
          onClick={(e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)}
          data-testid="dash2026-range-dropdown"
          aria-haspopup="menu"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minHeight: 44 }}
        >
          {customActive ? customLabel : RANGES.find((r) => r.id === range)?.label || "30D"}
          <Icon name="chevron-down" size={14} />
        </PillButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          {RANGES.map((r) => (
            <MenuItem
              key={r.id}
              selected={range === r.id && !customActive}
              data-testid={`dash2026-range-menu-${r.id}`}
              onClick={() => {
                onRangeChange(r.id);
                setMenuAnchor(null);
              }}
              sx={{ minHeight: 44 }}
            >
              {r.label}
            </MenuItem>
          ))}
          <MenuItem
            selected={customActive}
            data-testid="dash2026-range-menu-custom"
            onClick={() => {
              // Anchor the custom-range popover to the dropdown BUTTON
              // (the menu item unmounts when the menu closes).
              const anchorBtn = menuAnchor;
              setMenuAnchor(null);
              if (anchorBtn) onOpenCustom(anchorBtn);
            }}
            sx={{ minHeight: 44 }}
          >
            {t("customRange", { defaultValue: "Custom range" })}
          </MenuItem>
        </Menu>
      </Box>

      <Box
        data-testid="dash2026-range"
        role="tablist"
        sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 0.5, p: 0.5, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)" }}
      >
        {RANGES.map((r) => (
          <PillButton
            key={r.id}
            active={range === r.id && !customActive}
            onClick={() => onRangeChange(r.id)}
            role="tab"
            aria-selected={range === r.id && !customActive}
            data-testid={`dash2026-range-${r.id}`}
          >
            {r.label}
          </PillButton>
        ))}
        <PillButton
          active={customActive}
          onClick={(e: React.MouseEvent<HTMLElement>) => onOpenCustom(e.currentTarget)}
          role="tab"
          aria-selected={customActive}
          data-testid="dash2026-range-custom"
          aria-label={t("customRange", { defaultValue: "Custom range" })}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
        >
          <Icon name="calendar" size={14} />
          {customLabel}
        </PillButton>
      </Box>
    </>
  );
};

export default BalanceRangeControl;
