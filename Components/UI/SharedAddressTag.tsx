import { Icon } from "@/styles/uiKit";
import { Box, Tooltip, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import { tapY } from "@/styles/tapTarget";

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
  const indigo = dark ? "#FFD100" : "#8B5E00";
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
    : t("sharedAddressTapHint", { defaultValue: "Tap to highlight every coin paid out to this address" });

  const pill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 0.5,
    height: sm ? 20 : 22,
    px: sm ? 0.75 : 1,
    borderRadius: 999,
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
    color: active ? onIndigo : indigo,
    backgroundColor: active ? indigo : dark ? "rgba(255,209,0,0.14)" : "rgba(139,94,0,0.08)",
    border: `1px solid ${active ? indigo : dark ? "rgba(255,209,0,0.35)" : "rgba(139,94,0,0.22)"}`,
    transition: "background-color 150ms ease, color 150ms ease, transform 100ms ease",
  } as const;

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
          // Transparent target box (≥ 24px mouse / ≥ 44px touch, UX audit S18) around the
          // visible pill; negative margins keep the row height unchanged.
          appearance: "none",
          background: "none",
          border: 0,
          p: 0,
          m: 0,
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          cursor: clickable ? "pointer" : "default",
          ...(clickable ? tapY(sm ? 20 : 22) : {}),
          "& > .sat-pill": pill,
          ...(clickable && {
            "&:hover > .sat-pill": { backgroundColor: active ? indigo : dark ? "rgba(255,209,0,0.24)" : "rgba(139,94,0,0.14)" },
            "&:active > .sat-pill": { transform: "scale(0.96)" },
            "&:focus-visible": { outline: "none" },
            "&:focus-visible > .sat-pill": { outline: `2px solid ${indigo}`, outlineOffset: 1 },
          }),
        }}
      >
        <span className="sat-pill">
          <Icon name="link" size={sm ? 11 : 12} color={active ? onIndigo : indigo} />
          {t("sharedAddressTag", { defaultValue: "Used on {{n}} networks", n })}
        </span>
      </Box>
    </Tooltip>
  );
};

export default SharedAddressTag;
