import React, { useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Phone card interaction model (UX audit S15): the whole card opens the
 * detail; bulk selection is an explicit mode — a "Select" toolbar button or a
 * long-press on a card — so a tap on the title never ticks a checkbox.
 */
export function useCardSelectMode(selectedCount: number, clear: () => void) {
  const [selectMode, setSelectMode] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const showChecks = selectMode || selectedCount > 0;
  const exit = () => {
    setSelectMode(false);
    clear();
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  /** Spread on a card: long-press enters select mode and selects it. */
  const cardProps = (onToggle: () => void, onOpen: () => void) => ({
    onTouchStart: () => {
      longPressed.current = false;
      cancel();
      timer.current = setTimeout(() => {
        longPressed.current = true;
        setSelectMode(true);
        onToggle();
      }, 500);
    },
    onTouchMove: cancel,
    onTouchEnd: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      if (longPressed.current) e.preventDefault();
    },
    onClick: () => {
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      if (showChecks) onToggle();
      else onOpen();
    },
  });
  return { showChecks, selectMode, enter: () => setSelectMode(true), exit, cardProps };
}

export const SelectModeButton: React.FC<{ active: boolean; onEnter: () => void; onExit: () => void; testId: string }> = ({ active, onEnter, onExit, testId }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  return (
    <Box
      component="button"
      type="button"
      data-testid={testId}
      data-touch-44=""
      aria-pressed={active}
      onClick={active ? onExit : onEnter}
      sx={{
        all: "unset",
        boxSizing: "border-box",
        minHeight: 36,
        px: 1.5,
        borderRadius: 999,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 600,
        color: theme.palette.text.primary,
        border: `1px solid ${theme.palette.divider}`,
        "&:focus-visible": { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: 1 },
      }}
    >
      {active ? t("selectDone", { defaultValue: "Done" }) : t("selectItems", { defaultValue: "Select" })}
    </Box>
  );
};
