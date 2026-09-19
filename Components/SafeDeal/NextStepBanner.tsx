import React from "react";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import type { SdDeal } from "@/api/safedeal";
import { absTime, nextStep, relTime, useNow } from "./sdFormat";
import { SD_AMBER } from "./SafeDealShell";

const TONES = {
  action: { bg: "#EEF2FF", border: "#C7D2FE", fg: "#3730A3", icon: "mdi:account-arrow-right-outline", accent: BRAND_ACCENT },
  waiting: { bg: "#F8FAFC", border: "#E2E8F0", fg: "#334155", icon: "mdi:clock-outline", accent: "#64748B" },
  attention: { bg: "#FFFBEB", border: "#FDE68A", fg: "#92400E", icon: "mdi:gavel", accent: SD_AMBER },
  done: { bg: "#ECFDF5", border: "#A7F3D0", fg: "#065F46", icon: "mdi:check-decagram", accent: "#059669" },
  neutral: { bg: "#F3F4F6", border: "#E5E7EB", fg: "#374151", icon: "mdi:information-outline", accent: "#6B7280" },
} as const;

/** "Who acts next" strip with a live countdown — the first thing a party reads on the deal page. */
export default function NextStepBanner({ deal }: { deal: SdDeal }) {
  const now = useNow();
  const s = nextStep(deal);
  const t = TONES[s.tone];
  const isCountdown = s.deadlineLabel === "Auto-releases" || s.deadlineLabel === "Escalates automatically";
  const rel = s.deadline ? relTime(s.deadline, now) : "";
  const overdue = !!s.deadline && isCountdown && new Date(s.deadline).getTime() <= now;
  return (
    <Box
      role="status"
      data-testid="sd-next-step"
      data-who={s.who}
      sx={{ display: "flex", alignItems: "center", gap: 1.5, p: { xs: 1.4, md: 1.6 }, borderRadius: 3, backgroundColor: t.bg, border: `1px solid ${t.border}`, mb: 2.5 }}
    >
      <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", backgroundColor: "#fff", border: `1px solid ${t.border}`, flexShrink: 0 }} aria-hidden>
        <Icon icon={t.icon} width={20} color={t.accent} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {s.who !== "nobody" && (
            <Typography component="span" sx={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", color: t.accent }} data-testid="sd-next-step-who">
              {s.who === "you" ? "Your move" : "Their move"}
            </Typography>
          )}
          <Typography sx={{ fontSize: { xs: 14, md: 15 }, fontWeight: 800, color: t.fg }} data-testid="sd-next-step-text">{s.text}</Typography>
        </Stack>
        {s.deadline && (
          <Tooltip title={absTime(s.deadline)} arrow>
            <Typography component="time" dateTime={s.deadline} sx={{ fontSize: 12.5, color: t.fg, opacity: 0.85, cursor: "help", display: "inline-block", mt: 0.2 }} data-testid="sd-next-step-deadline">
              {isCountdown ? (overdue ? `${s.deadlineLabel} now` : `${s.deadlineLabel} ${rel} · ${absTime(s.deadline)}`) : `${s.deadlineLabel} ${rel}`}
            </Typography>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
