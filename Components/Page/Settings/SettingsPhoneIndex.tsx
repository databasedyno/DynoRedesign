import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { useTranslation } from "react-i18next";

export interface SettingsIndexRow {
  key: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  dirty?: boolean;
  external?: boolean;
  onClick: () => void;
}

export interface SettingsIndexGroup {
  id: string;
  label: string;
  rows: SettingsIndexRow[];
}

/** Phone Settings index (UX audit §8.9): grouped list → tap pushes the section page. */
const SettingsPhoneIndex: React.FC<{ groups: SettingsIndexGroup[] }> = ({ groups }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const isDark = theme.palette.mode === "dark";
  const hairline = isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.08)";

  return (
    <Box component="nav" aria-label={t("settingsPage.sectionsAria", { defaultValue: "Settings sections" })} data-testid="settings-phone-index" sx={{ width: "100%", minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {groups.map((g) => (
        <Box key={g.id} component="section" data-testid={`settings-index-group-${g.id}`} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary, px: 0.5, mb: 1 }}>
            {g.label}
          </Typography>
          <Box sx={{ borderRadius: "14px", border: `1px solid ${hairline}`, backgroundColor: theme.palette.background.paper, overflow: "hidden" }}>
            {g.rows.map((r, i) => (
              <Box
                key={r.key}
                component="button"
                type="button"
                data-testid={`settings-index-row-${r.key}`}
                onClick={r.onClick}
                sx={{
                  all: "unset",
                  boxSizing: "border-box",
                  width: "100%",
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  minHeight: 60,
                  px: 1.75,
                  py: 1.25,
                  cursor: "pointer",
                  borderTop: i === 0 ? "none" : `1px solid ${hairline}`,
                  transition: "background-color 120ms ease",
                  "&:active": { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F5F6F8" },
                  "&:focus-visible": { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: -2 },
                }}
              >
                <Box aria-hidden sx={{ flexShrink: 0, width: 36, height: 36, borderRadius: "10px", display: "grid", placeItems: "center", color: theme.palette.text.primary, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F2F5" }}>
                  {r.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.3 }}>{r.label}</Typography>
                  {r.description && (
                    <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.text.secondary, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.description}
                    </Typography>
                  )}
                </Box>
                {r.dirty && (
                  <Box
                    component="span"
                    role="img"
                    data-testid={`settings-index-row-${r.key}-unsaved`}
                    aria-label={t("settingsPage.unsavedChanges", { defaultValue: "Unsaved changes" })}
                    sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: isDark ? "#FFB74D" : "#E65100" }}
                  />
                )}
                {r.external ? (
                  <ArrowOutwardRounded sx={{ fontSize: 18, color: theme.palette.text.secondary, flexShrink: 0 }} />
                ) : (
                  <ChevronRightRounded sx={{ fontSize: 22, color: theme.palette.text.secondary, flexShrink: 0 }} />
                )}
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default SettingsPhoneIndex;
