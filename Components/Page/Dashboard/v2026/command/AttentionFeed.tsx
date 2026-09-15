import React, { useState } from "react";
import { Box, Button, IconButton, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { statusToneColors } from "@/Components/UI/StatusDot";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "../../coinbase/styled";
import type { AttentionItem, AttentionSeverity } from "./useAttentionItems";

const MAX_VISIBLE = 5;

interface Props {
  items: AttentionItem[];
  onDismiss: (key: string) => void;
}

const severityColor = (severity: AttentionSeverity, isDark: boolean) => {
  if (severity === "critical") return statusToneColors("failed", isDark);
  if (severity === "warning") return statusToneColors("pending", isDark);
  return statusToneColors("neutral", isDark);
};

/** Zone 2 — one ordered task feed. Renders nothing when there is nothing to do. */
const AttentionFeed: React.FC<Props> = ({ items, onDismiss }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const hairline = isDark ? "rgba(255,255,255,0.06)" : "#EEF1F6";
  const visible = showAll ? items : items.slice(0, MAX_VISIBLE);
  const hidden = items.length - visible.length;

  return (
    <SurfaceCard data-testid="attention-feed-container" data-count={items.length} sx={{ p: 0, overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: { xs: 2, md: 2.5 }, pt: { xs: 1.75, md: 2 }, pb: 1 }}>
        <Eyebrow data-testid="attention-feed-title">
          {t("command.needsAttention", { defaultValue: "Needs attention" })}
          <Box component="span" sx={{ ml: 1, fontFamily: "var(--font-sans)", fontWeight: 700, color: ink }}>{items.length}</Box>
        </Eyebrow>
      </Box>

      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {visible.map((item, i) => {
          const tone = severityColor(item.severity, isDark);
          return (
            <Box
              component="li"
              key={item.id}
              data-testid="attention-feed-item"
              data-item={item.testId}
              data-severity={item.severity}
              data-group={item.group}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: { xs: 1.25, md: 1.75 },
                px: { xs: 2, md: 2.5 },
                py: { xs: 1.25, md: 1.4 },
                borderTop: i === 0 ? "none" : `1px solid ${hairline}`,
                position: "relative",
                transition: "background-color 150ms ease",
                "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(10,10,15,0.02)" },
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 10,
                  bottom: 10,
                  width: 3,
                  borderRadius: "0 3px 3px 0",
                  backgroundColor: item.severity === "info" ? "transparent" : tone.dot,
                },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "10px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: item.severity === "info" ? muted : tone.fg,
                  backgroundColor: item.severity === "info" ? (isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)") : `${tone.dot}1F`,
                }}
              >
                <Icon name={item.icon} size={17} />
              </Box>
              <Box data-testid="attention-feed-text" sx={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: { xs: 13.5, md: 14 }, lineHeight: 1.4, color: ink }}>
                {item.text}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                <Button
                  size="small"
                  variant="outlined"
                  data-testid="attention-feed-action-btn"
                  data-action={item.testId}
                  onClick={() => router.push(item.href)}
                  sx={{
                    textTransform: "none",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 600,
                    fontSize: 12.5,
                    borderRadius: 999,
                    px: 1.75,
                    minHeight: 32,
                    whiteSpace: "nowrap",
                    color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
                    borderColor: isDark ? "rgba(129,140,248,0.45)" : "rgba(79,70,229,0.35)",
                    "&:hover": { borderColor: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light, backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow },
                  }}
                >
                  {item.actionLabel}
                </Button>
                {item.dismissKey && (
                  <IconButton
                    size="small"
                    aria-label={t("pwNudge.dismiss", { defaultValue: "Dismiss" })}
                    data-testid={`attention-feed-dismiss-${item.id}`}
                    onClick={() => onDismiss(item.dismissKey!)}
                    sx={{ color: muted, width: 32, height: 32 }}
                  >
                    <Icon name="x" size={15} />
                  </IconButton>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {(hidden > 0 || showAll) && items.length > MAX_VISIBLE && (
        <Box sx={{ borderTop: `1px solid ${hairline}`, px: { xs: 2, md: 2.5 }, py: 1 }}>
          <Button
            size="small"
            data-testid="attention-feed-show-all-btn"
            onClick={() => setShowAll((v) => !v)}
            sx={{ textTransform: "none", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 12.5, color: muted, px: 0.5 }}
            endIcon={<Icon name={showAll ? "chevron-up" : "chevron-down"} size={14} />}
          >
            {showAll
              ? t("command.showLess", { defaultValue: "Show less" })
              : t("command.showAll", { count: hidden, defaultValue: "Show all ({{count}} more)" })}
          </Button>
        </Box>
      )}
    </SurfaceCard>
  );
};

export default AttentionFeed;
