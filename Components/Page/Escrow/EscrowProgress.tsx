import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import type { EscrowDeal } from "@/api/escrow";

type StepState = "done" | "active" | "upcoming" | "disputed";
interface Step {
  key: string;
  label: string;
  state: StepState;
}

const AMBER = "#B45309";
const RED = "#DC2626";
const NEUTRAL = "#98A2B3";

/** Build the ordered milestone ladder for a deal (or a terminal banner). */
function derive(deal: EscrowDeal): { mode: "ladder"; steps: Step[] } | { mode: "terminal"; label: string; tone: string; icon: string } {
  const status = deal.status;

  if (status === "declined") return { mode: "terminal", label: "Invitation declined", tone: NEUTRAL, icon: "mdi:close-circle-outline" };
  if (status === "cancelled") return { mode: "terminal", label: "Deal cancelled", tone: NEUTRAL, icon: "mdi:cancel" };
  if (status === "expired") return { mode: "terminal", label: "Invitation expired", tone: NEUTRAL, icon: "mdi:timer-off-outline" };

  const settleLabel = deal.outcome === "refund" ? "Refunded" : deal.outcome === "split" ? "Split" : "Released";
  const labels = ["Invited", "Accepted", "Funded", "Delivered", settleLabel, "Paid out"];

  // doneUpTo = index of the last COMPLETED step; active = the current step.
  let doneUpTo = -1;
  let active = 0;
  let disputed = false;

  switch (status) {
    case "draft":
      doneUpTo = -1; active = 0; break;
    case "invited":
      doneUpTo = 0; active = 1; break;
    case "awaiting_payment":
      doneUpTo = 1; active = 2; break;
    case "funded":
      doneUpTo = 2; active = 3; break;
    case "delivered":
      doneUpTo = 3; active = 4; break;
    case "disputed":
      doneUpTo = deal.delivered_at ? 3 : 2; active = 4; disputed = true; break;
    case "completed":
    case "refunded":
    case "split": {
      const paid = deal.settlement_phase === "paid";
      doneUpTo = paid ? 5 : 4;
      active = paid ? 5 : 5; // step 5 (Paid out): done when paid, else active(pending)
      break;
    }
    default:
      doneUpTo = -1; active = 0;
  }

  const steps: Step[] = labels.map((label, i) => {
    let state: StepState;
    if (disputed && i === active) state = "disputed";
    else if (i <= doneUpTo) state = "done";
    else if (i === active) state = "active";
    else state = "upcoming";
    return { key: label, label, state };
  });

  return { mode: "ladder", steps };
}

export default function EscrowProgress({ deal, testId = "escrow-progress", accent = BRAND_ACCENT }: { deal: EscrowDeal; testId?: string; accent?: string }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const result = derive(deal);
  const border = isDark ? "rgba(255,255,255,0.10)" : theme.palette.divider;

  if (result.mode === "terminal") {
    return (
      <Box
        data-testid={testId}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.6,
          py: 1.2,
          borderRadius: 2,
          border: `1px solid ${border}`,
          backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#F9FAFB",
        }}
      >
        <Icon icon={result.icon} width={20} color={result.tone} />
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: theme.palette.text.secondary }}>{result.label}</Typography>
      </Box>
    );
  }

  return (
    <Box data-testid={testId} sx={{ overflowX: "auto", pb: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", minWidth: { xs: 0, sm: 320 } }}>
        {result.steps.map((s, i) => {
          const color =
            s.state === "disputed" ? AMBER : s.state === "done" || s.state === "active" ? accent : NEUTRAL;
          const reached = s.state !== "upcoming";
          const connectorDone = i < result.steps.length - 1 && (result.steps[i + 1].state === "done" || result.steps[i].state === "done");
          return (
            <React.Fragment key={s.key}>
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.6, minWidth: { xs: 38, sm: 46 } }} data-testid={`${testId}-step-${s.key.toLowerCase().replace(/\s+/g, "-")}`} data-state={s.state}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `2px solid ${color}`,
                    backgroundColor: s.state === "done" ? accent : "transparent",
                    ...(s.state === "active"
                      ? {
                          animation: "escrowPulse 1.6s ease-in-out infinite",
                          "@keyframes escrowPulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.5 } },
                          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                        }
                      : {}),
                  }}
                >
                  {s.state === "done" ? (
                    <Icon icon="mdi:check" width={13} color="#FFFFFF" />
                  ) : s.state === "disputed" ? (
                    <Icon icon="mdi:alert" width={12} color={AMBER} />
                  ) : (
                    <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: color }} />
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: { xs: 12, sm: 12 },
                    letterSpacing: { xs: "-0.2px", sm: 0 },
                    fontWeight: reached ? 700 : 500,
                    color: reached ? (s.state === "disputed" ? AMBER : theme.palette.text.primary) : NEUTRAL,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </Typography>
              </Box>
              {i < result.steps.length - 1 && (
                <Box sx={{ flex: 1, minWidth: { xs: 6, sm: 16 }, height: 2, mt: "10px", mx: { xs: 0.2, sm: 0.4 }, borderRadius: 1, backgroundColor: connectorDone ? accent : border }} />
              )}
            </React.Fragment>
          );
        })}
      </Box>
    </Box>
  );
}
