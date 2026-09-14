import React, { memo, useState } from "react";
import { Box, Button, Chip, LinearProgress, TextField, Tooltip, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import VerifiedIcon from "@mui/icons-material/Verified";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import type { TestCase } from "@/data/qaCatalog";
import type { QaWhere } from "@/data/qaWhere";
import type { QaStatus } from "./QaItemCard";
import { QaWhereLine } from "./QaItemCard";
import type { QualityCenter } from "./useQualityCenter";

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#EF4444",
  High: "#F59E0B",
  Medium: "#3B82F6",
  Low: "#6B7280",
};

interface Props {
  caseData: TestCase;
  sectionId: string;
  sectionTitle: string;
  where?: QaWhere;
  qc: QualityCenter;
  isDark: boolean;
  cardBg: string;
  border: string;
}

/** One end-to-end journey: step-by-step pass/fail with a live progress bar,
 * a deep-link to start testing, and per-journey assignment + release sign-off. */
const JourneyCard = memo(function JourneyCard({ caseData, sectionId, sectionTitle, where, qc, isDark, cardBg, border }: Props) {
  const caseKey = `${sectionId}::${caseData.id}`;
  const caseMeta = { item_key: caseKey, section_id: sectionId, section_title: sectionTitle, case_title: caseData.title };
  const stepKey = (stepId: string) => `${caseKey}#s:${stepId}`;
  const stepStatus = (stepId: string): QaStatus => qc.latestStatus(stepKey(stepId));

  const total = caseData.steps.length;
  const passed = caseData.steps.filter((s) => stepStatus(s.id) === "pass").length;
  const failed = caseData.steps.filter((s) => stepStatus(s.id) === "fail").length;
  const pct = total ? Math.round((passed / total) * 100) : 0;

  const meta = qc.metaByItem[caseKey];
  const assignee = meta?.assignee || "";
  const signedOff = !!meta?.signed_off;

  const [assignInput, setAssignInput] = useState(assignee || qc.tester || "");
  const [editingAssign, setEditingAssign] = useState(false);

  const rollupLabel = failed > 0 ? "Has failures" : total && passed === total ? "All steps passed" : passed > 0 ? "In progress" : "Not started";
  const rollupColor = failed > 0 ? "#EF4444" : total && passed === total ? "#22C55E" : passed > 0 ? "#F59E0B" : "#9CA3AF";
  const barColor = failed > 0 ? "#EF4444" : passed === total && total ? "#22C55E" : "#6366F1";

  const setStep = (stepId: string, status: QaStatus) =>
    qc.quickAction({ item_key: stepKey(stepId), section_id: sectionId, section_title: sectionTitle, case_title: caseData.title }, status);

  const StepBtn = ({ active, color, onClick, testid, children }: { active: boolean; color: string; onClick: () => void; testid: string; children: React.ReactNode }) => (
    <Button
      size="small"
      onClick={onClick}
      data-testid={testid}
      variant={active ? "contained" : "outlined"}
      sx={{
        minWidth: 0, px: 1, py: 0.15, fontSize: 10.5, textTransform: "none", lineHeight: 1.4,
        color: active ? "#fff" : color, bgcolor: active ? color : "transparent", borderColor: color,
        "&:hover": { bgcolor: active ? color : `${color}22`, borderColor: color },
      }}
    >
      {children}
    </Button>
  );

  return (
    <Box data-testid={`qa-journey-${caseData.id}`} sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: cardBg, border }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontFamily: "monospace", color: "text.secondary" }}>{caseData.id}</Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{caseData.title}</Typography>
        <Chip label={caseData.priority} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, color: "#fff", bgcolor: PRIORITY_COLORS[caseData.priority] }} />
        <Chip label={rollupLabel} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, color: "#fff", bgcolor: rollupColor }} data-testid={`qa-journey-rollup-${caseData.id}`} />
        {signedOff && (
          <Chip icon={<VerifiedIcon sx={{ fontSize: 14, color: "#fff !important" }} />} label="Signed off" size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, color: "#fff", bgcolor: "#0EA5E9" }} data-testid={`qa-journey-signed-${caseData.id}`} />
        )}
      </Box>

      {/* Progress bar */}
      <Box sx={{ mb: 1.25 }} data-testid={`qa-journey-progress-${caseData.id}`}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "text.secondary" }}>
            {passed} / {total} steps passed{failed ? ` · ${failed} failed` : ""}
          </Typography>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: barColor }}>{pct}%</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{ height: 8, borderRadius: 5, bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", "& .MuiLinearProgress-bar": { backgroundColor: barColor } }}
        />
      </Box>

      {caseData.preconditions && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.75 }}>
          <b>Preconditions:</b> {caseData.preconditions}
        </Typography>
      )}

      {where ? <QaWhereLine where={where} isDark={isDark} /> : null}

      {/* Assign + sign-off */}
      <Box sx={{ mt: 1.25, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <PersonOutlineIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        {assignee && !editingAssign ? (
          <>
            <Chip label={`Assigned: ${assignee}`} size="small" sx={{ fontSize: 11, fontWeight: 600 }} data-testid={`qa-journey-assignee-${caseData.id}`} />
            <Button size="small" onClick={() => { setAssignInput(assignee); setEditingAssign(true); }} sx={{ textTransform: "none", fontSize: 11, minWidth: 0 }}>Reassign</Button>
            <Button size="small" color="inherit" onClick={() => qc.assignItem(caseMeta, "")} sx={{ textTransform: "none", fontSize: 11, minWidth: 0 }} data-testid={`qa-journey-unassign-${caseData.id}`}>Clear</Button>
          </>
        ) : (
          <>
            <TextField
              size="small" placeholder="Name / initials" value={assignInput}
              onChange={(e) => setAssignInput(e.target.value)}
              inputProps={{ "data-testid": `qa-journey-assign-input-${caseData.id}` }}
              sx={{ maxWidth: 180, "& .MuiInputBase-input": { fontSize: 12, py: 0.75 } }}
            />
            <Button size="small" variant="outlined" onClick={() => { qc.assignItem(caseMeta, assignInput.trim()); setEditingAssign(false); }} sx={{ textTransform: "none", fontSize: 11 }} data-testid={`qa-journey-assign-${caseData.id}`}>Assign</Button>
            <Button size="small" onClick={() => { const who = qc.tester?.trim() || "QA"; setAssignInput(who); qc.assignItem(caseMeta, who); setEditingAssign(false); }} sx={{ textTransform: "none", fontSize: 11 }} data-testid={`qa-journey-claim-${caseData.id}`}>Claim for me</Button>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        {signedOff ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 11.5, color: "#0EA5E9", fontWeight: 600 }}>
              ✔ Signed off for release{meta?.signed_off_by ? ` — ${meta.signed_off_by}` : ""}{meta?.signed_off_at ? ` · ${new Date(meta.signed_off_at).toLocaleDateString()}` : ""}
            </Typography>
            <Button size="small" color="inherit" variant="outlined" onClick={() => qc.toggleSignoff(caseMeta, false)} sx={{ textTransform: "none", fontSize: 11 }} data-testid={`qa-journey-revoke-${caseData.id}`}>Revoke</Button>
          </Box>
        ) : (
          <Tooltip title={passed === total && total ? "" : `${total - passed} step(s) still to pass`}>
            <span>
              <Button size="small" color="success" variant="contained" startIcon={<VerifiedIcon sx={{ fontSize: 15 }} />} onClick={() => qc.toggleSignoff(caseMeta, true, qc.tester)} sx={{ textTransform: "none", fontSize: 11.5 }} data-testid={`qa-journey-signoff-${caseData.id}`}>Sign off for release</Button>
            </span>
          </Tooltip>
        )}
      </Box>

      {/* Steps with per-step pass/fail */}
      <Box sx={{ mt: 1.5 }} data-testid={`qa-journey-steps-${caseData.id}`}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "text.secondary", mb: 0.5 }}>STEPS</Typography>
        {caseData.steps.map((st, i) => {
          const s = stepStatus(st.id);
          const busy = qc.savingKey === stepKey(st.id);
          const icon = s === "pass" ? <CheckCircleIcon sx={{ fontSize: 16, color: "#22C55E" }} /> : s === "fail" ? <CancelIcon sx={{ fontSize: 16, color: "#EF4444" }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: isDark ? "#4B5563" : "#D1D5DB" }} />;
          return (
            <Box key={st.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start", py: 0.6, borderTop: i ? `1px dashed ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` : "none" }}>
              <Box sx={{ mt: 0.2 }}>{icon}</Box>
              <Typography sx={{ fontSize: 12.5, flex: 1, opacity: busy ? 0.5 : 1 }}>
                <b>{i + 1}. {st.action}</b> → <span style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>{st.expected}</span>
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                <StepBtn active={s === "pass"} color="#22C55E" onClick={() => setStep(st.id, "pass")} testid={`qa-step-pass-${caseData.id}-${st.id}`}>Pass</StepBtn>
                <StepBtn active={s === "fail"} color="#EF4444" onClick={() => setStep(st.id, "fail")} testid={`qa-step-fail-${caseData.id}-${st.id}`}>Fail</StepBtn>
                {s !== "not_tested" && (
                  <StepBtn active={false} color="#9CA3AF" onClick={() => setStep(st.id, "not_tested")} testid={`qa-step-reset-${caseData.id}-${st.id}`}>Reset</StepBtn>
                )}
              </Box>
            </Box>
          );
        })}
        {caseData.notes && (
          <Typography sx={{ fontSize: 12, color: "#F59E0B", mt: 0.75 }}>⚠️ {caseData.notes}</Typography>
        )}
      </Box>
    </Box>
  );
});

export default JourneyCard;
