import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { brandFg } from "@/constants/theme";
import type { StepUpMethod, StepUpStatus } from "./stepUpApi";

interface Props {
  methods: StepUpStatus["methods"];
  value: StepUpMethod;
  onChange: (m: StepUpMethod) => void;
  disabled?: boolean;
  "data-testid"?: string;
}

const ORDER: { key: StepUpMethod; icon: string; labelKey: string; fallback: string }[] = [
  { key: "totp", icon: "smartphone", labelKey: "stepUp.methodTotp", fallback: "Authenticator" },
  { key: "email", icon: "mail", labelKey: "stepUp.methodEmail", fallback: "Email code" },
  { key: "sms", icon: "smartphone", labelKey: "stepUp.methodSms", fallback: "Text message" },
  { key: "backup", icon: "key-round", labelKey: "stepUp.methodBackup", fallback: "Backup code" },
];

/** Pill switcher between the verification factors available to this account. */
export const StepUpMethodTabs: React.FC<Props> = ({ methods, value, onChange, disabled, "data-testid": testId }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const dark = theme.palette.mode === "dark";
  const available = ORDER.filter((m) => methods[m.key]);
  if (available.length <= 1) return null;
  const accent = brandFg(dark);

  return (
    <Box role="tablist" data-testid={testId || "stepup-method-tabs"} sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 2 }}>
      {(available ?? []).map((m) => {
        const active = m.key === value;
        return (
          <Box
            key={m.key}
            component="button"
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            data-testid={`stepup-method-${m.key}`}
            onClick={() => onChange(m.key)}
            sx={{
              all: "unset",
              cursor: disabled ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.5,
              height: 32,
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              color: active ? accent : theme.palette.text.secondary,
              border: `1px solid ${active ? accent : theme.palette.border?.main || theme.palette.divider}`,
              backgroundColor: active ? (dark ? "rgba(129,140,248,0.12)" : "rgba(67,56,202,0.08)") : "transparent",
              transition: "background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease",
              "&:hover": { borderColor: accent },
            }}
          >
            <Icon name={m.icon} size={14} />
            {t(m.labelKey, { defaultValue: m.fallback })}
          </Box>
        );
      })}
      {/* icon-bundle literals: <Icon name="smartphone" /> <Icon name="mail" /> <Icon name="key-round" /> */}
    </Box>
  );
};

export default StepUpMethodTabs;
