import { Icon } from "@/styles/uiKit";
import { Box, Tooltip, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface Props {
  /** Other networks that share this wallet's address. Renders nothing when empty. */
  networks: string[];
  testId?: string;
  size?: "sm" | "md";
  /** When set the chip is a toggle button (highlight siblings). */
  onClick?: () => void;
  active?: boolean;
}

/** "Used on N networks" — one address saved under several wallet types (EVM / Tron / XRPL families). */
export const SharedAddressTag: React.FC<Props> = ({ networks, testId, size = "md", onClick, active = false }) => {
  const theme = useTheme();
  const { t } = useTranslation("walletScreen");
  if (networks.length === 0) return null;
  const dark = theme.palette.mode === "dark";
  const indigo = dark ? "#818CF8" : "#4338CA";
  const onIndigo = dark ? "#0A0A0B" : "#FFFFFF";
  const n = networks.length + 1;
  const sm = size === "sm";
  const clickable = !!onClick;

  const base = t("sharedAddressTooltip", {
    defaultValue: "Same address also saved for: {{list}}",
    list: networks.join(" · "),
  });
  const hint = active
    ? t("sharedAddressClearHint", { defaultValue: "Tap to clear the highlight" })
    : t("sharedAddressTapHint", { defaultValue: "Tap to highlight every wallet using this address" });

  return (
    <Tooltip arrow placement="top" title={clickable ? `${base} — ${hint}` : base}>
      <Box
        component={clickable ? "button" : "div"}
        type={clickable ? "button" : undefined}
        onClick={
          clickable
            ? (e: React.MouseEvent) => {
                e.stopPropagation();
                onClick?.();
              }
            : undefined
        }
        aria-pressed={clickable ? active : undefined}
        data-testid={testId}
        data-count={n}
        data-active={active ? "true" : "false"}
        aria-label={t("sharedAddressTag", { defaultValue: "Used on {{n}} networks", n })}
        sx={{
          appearance: "none",
          margin: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          height: sm ? 18 : 20,
          px: sm ? 0.6 : 0.85,
          borderRadius: 999,
          flexShrink: 0,
          cursor: clickable ? "pointer" : "default",
          fontFamily: "var(--font-sans)",
          fontSize: sm ? 10.5 : 11,
          fontWeight: 600,
          lineHeight: 1,
          whiteSpace: "nowrap",
          color: active ? onIndigo : indigo,
          backgroundColor: active ? indigo : dark ? "rgba(129,140,248,0.14)" : "rgba(67,56,202,0.08)",
          border: `1px solid ${active ? indigo : dark ? "rgba(129,140,248,0.35)" : "rgba(67,56,202,0.22)"}`,
          transition: "background-color 150ms ease, color 150ms ease, transform 100ms ease",
          ...(clickable && {
            "&:hover": { backgroundColor: active ? indigo : dark ? "rgba(129,140,248,0.24)" : "rgba(67,56,202,0.14)" },
            "&:active": { transform: "scale(0.96)" },
            "&:focus-visible": { outline: `2px solid ${indigo}`, outlineOffset: 1 },
          }),
        }}
      >
        <Icon name="link" size={sm ? 11 : 12} color={active ? onIndigo : indigo} />
        {t("sharedAddressTag", { defaultValue: "Used on {{n}} networks", n })}
      </Box>
    </Tooltip>
  );
};

export default SharedAddressTag;
