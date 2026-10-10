import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import { Icon } from "@/styles/uiKit";
import { KycInsights, stageColor, useKycTones, useUsd } from "./kycInsights";

type NodeState = "done" | "current" | "upcoming" | "paused";

/**
 * The 3-stage path (Under threshold → Grace → Verified) with a "You are here"
 * marker, plus two lanes underneath that show at a glance what keeps running in
 * each stage: settlement (always on) and new checkouts/links (only pause if the
 * grace period ends unverified).
 */
const KycJourney: React.FC<{ k: KycInsights }> = ({ k }) => {
  const { t } = useTranslation("dashboardLayout");
  const tones = useKycTones();
  const usd = useUsd();
  const threshold = usd(k.threshold);
  const days = k.graceDays;
  const paused = k.stage === "paused";
  const currentIdx = k.stage === "below" ? 0 : k.stage === "grace" || paused ? 1 : 2;
  const here = stageColor(k.stage, k.urgency, tones);

  const stages = [
    { id: "below", title: t("kycInsights.journey.s1Title", { threshold, defaultValue: "Under {{threshold}}" }), caption: t("kycInsights.journey.s1Caption", { defaultValue: "No verification needed. Accept payments and get settled as usual." }) },
    { id: "grace", title: t("kycInsights.journey.s2Title", { days, defaultValue: "{{days}}-day grace period" }), caption: t("kycInsights.journey.s2Caption", { threshold, defaultValue: "Starts the day you cross {{threshold}}. Everything keeps working while you verify." }) },
    { id: "verified", title: t("kycInsights.journey.s3Title", { defaultValue: "Verified" }), caption: t("kycInsights.journey.s3Caption", { defaultValue: "No volume limits, and the verified badge on your checkout." }) },
  ];

  const nodeState = (i: number): NodeState => {
    if (i === currentIdx && paused) return "paused";
    if (i < currentIdx || (i === 2 && currentIdx === 2)) return "done";
    if (i === currentIdx) return "current";
    return "upcoming";
  };

  const renderNode = (i: number) => {
    const st = nodeState(i);
    const c = st === "done" ? tones.positive : st === "paused" ? tones.negative : st === "current" ? here : tones.muted;
    const filled = st === "done" || st === "paused";
    return (
      <Box
        data-testid={`kyc-journey-node-${stages[i].id}`}
        data-state={st}
        sx={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 800, color: filled ? "#fff" : c, backgroundColor: filled ? c : "transparent", border: `2px solid ${c}`, boxShadow: st === "current" || st === "paused" ? `0 0 0 5px ${c}26` : "none" }}
      >
        {st === "done" ? <Icon name="check" size={17} /> : st === "paused" ? <Icon name="pause" size={16} /> : i + 1}
      </Box>
    );
  };

  const hereLabel = paused ? t("kycInsights.journey.hereEnded", { defaultValue: "You are here · grace ended" }) : t("kycInsights.youAreHere", { defaultValue: "You are here" });
  const renderHere = (inline?: boolean) => (
    <Box
      data-testid="kyc-you-are-here"
      sx={{
        position: inline ? "static" : "absolute",
        top: 0,
        left: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.1,
        py: 0.35,
        borderRadius: 999,
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
        color: tones.isDark ? "#0B0B0F" : "#fff",
        backgroundColor: here,
        ...(inline
          ? {}
          : { "&::after": { content: '""', position: "absolute", left: 12, bottom: -5, width: 10, height: 10, backgroundColor: here, transform: "rotate(45deg)", borderRadius: "2px" } }),
      }}
    >
      <Icon name="map-pin" size={12} />
      {hereLabel}
    </Box>
  );

  const on = t("kycInsights.journey.on", { defaultValue: "On" });
  const hatched = `repeating-linear-gradient(135deg, ${tones.negative} 0 4px, ${tones.negative}33 4px 8px)`;

  /** One lane segment under a stage column. */
  const renderSegment = ({ label, color, tail, tailSolid, testId, labelColor }: { label: string; color: string; tail?: boolean; tailSolid?: boolean; testId?: string; labelColor?: string }) => (
    <Box key={testId} data-testid={testId} sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", backgroundColor: tones.track }}>
        <Box sx={{ flex: 1, backgroundColor: color }} />
        {tail && <Box data-testid={testId ? `${testId}-tail` : undefined} sx={{ width: "22%", background: tailSolid ? tones.negative : hatched }} />}
      </Box>
      <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: labelColor || color, minWidth: 0 }}>
        <Icon name={labelColor === tones.negative ? "circle-pause" : "circle-check"} size={13} />
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</Box>
      </Box>
    </Box>
  );

  const laneHeader = (icon: string, label: string, end?: React.ReactNode) => (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: tones.ink, minWidth: 0 }}>
        <Icon name={icon} size={15} />
        <span>{label}</span>
      </Box>
      {end}
    </Box>
  );

  const alwaysPill = (
    <Box data-testid="kyc-lane-settlement-always" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.3, borderRadius: 999, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: tones.positive, backgroundColor: tones.positiveGlow, border: `1px solid ${tones.positive}40`, whiteSpace: "nowrap" }}>
      <Icon name="shield-check" size={13} />
      {t("kycInsights.journey.alwaysOn", { defaultValue: "Always on" })}
    </Box>
  );

  const pausedLabel = t("kycInsights.journey.pausedNow", { defaultValue: "Paused now" });
  const resumesLabel = t("kycInsights.journey.resumes", { defaultValue: "Back on once approved" });
  const pausesIf = t("kycInsights.journey.pausesIf", { days, defaultValue: "Pauses only if day {{days}} passes unverified" });

  return (
    <PanelCard
      title={t("kycInsights.journey.title", { defaultValue: "How the rules work" })}
      subTitle={t("kycInsights.journey.subtitle", { defaultValue: "Three stages — and settlement to your wallet stays on through every one of them." })}
      showHeaderBorder={false}
      bodySx={{ px: { xs: 2, md: 2.5 }, pt: { xs: 1.5, md: 2 }, pb: { xs: 2, md: 2.5 } }}
    >
      <Box data-testid="kyc-journey" data-stage={k.stage} data-current={stages[currentIdx].id}>
        {/* ── Desktop / tablet: horizontal path + aligned lanes ── */}
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", columnGap: 1.5 }}>
            {stages.map((s, i) => (
              <Box key={s.id} data-testid={`kyc-journey-stage-${s.id}`} sx={{ position: "relative", pt: 5, minWidth: 0 }}>
                {i === currentIdx && renderHere()}
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  {renderNode(i)}
                  {i < 2 && <Box aria-hidden sx={{ flex: 1, height: 3, ml: 1, mr: -1.5, borderRadius: 2, backgroundColor: i < currentIdx ? tones.positive : tones.track }} />}
                </Box>
                <Typography sx={{ mt: 1.25, fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", color: nodeState(i) === "upcoming" ? tones.muted : tones.ink }}>{s.title}</Typography>
                <Typography sx={{ mt: 0.4, pr: 1.5, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: tones.muted }}>{s.caption}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px dashed ${tones.border}`, display: "flex", flexDirection: "column", gap: 2.25 }}>
            <Box data-testid="kyc-lane-settlement">
              {laneHeader("wallet", t("kycInsights.journey.laneSettlement", { defaultValue: "Settlement to your payout wallet" }), alwaysPill)}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", columnGap: 1.5 }}>
                {[0, 1, 2].map((i) => renderSegment({ label: on, color: tones.positive, testId: `kyc-lane-settlement-${stages[i].id}` }))}
              </Box>
            </Box>
            <Box data-testid="kyc-lane-new">
              {laneHeader("store", t("kycInsights.journey.laneNew", { defaultValue: "New checkouts & payment links" }))}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", columnGap: 1.5 }}>
                {renderSegment({ label: on, color: tones.positive, testId: "kyc-lane-new-below" })}
                {renderSegment({ label: paused ? pausedLabel : on, color: tones.positive, tail: true, tailSolid: paused, labelColor: paused ? tones.negative : undefined, testId: "kyc-lane-new-grace" })}
                {renderSegment({ label: paused ? resumesLabel : on, color: paused ? `${tones.positive}80` : tones.positive, testId: "kyc-lane-new-verified" })}
              </Box>
            </Box>
            <Box data-testid="kyc-journey-legend" sx={{ display: "flex", alignItems: "flex-start", gap: 1, fontFamily: "var(--font-sans)", fontSize: 12.5, lineHeight: 1.5, color: tones.muted }}>
              <Box aria-hidden sx={{ width: 22, height: 10, mt: "4px", borderRadius: 999, flexShrink: 0, background: hatched }} />
              <span>
                {t("kycInsights.journey.legend", { days, defaultValue: "The only restriction that can ever apply: if day {{days}} of the grace period passes before you're verified, new checkouts and new payment links pause until you're approved. Settlement never pauses." })}
              </span>
            </Box>
          </Box>
        </Box>

        {/* ── Phone: vertical path, each stage carries its own lane chips ── */}
        <Box component="ol" sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", listStyle: "none", m: 0, p: 0 }}>
          {stages.map((s, i) => {
            const last = i === stages.length - 1;
            const newState = i === 1 && paused ? "paused" : i === 2 && paused ? "resumes" : "on";
            return (
              <Box component="li" key={s.id} data-testid={`kyc-journey-m-${s.id}`} sx={{ display: "grid", gridTemplateColumns: "34px 1fr", columnGap: 1.5, pb: last ? 0 : 2.25 }}>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {renderNode(i)}
                  {!last && <Box aria-hidden sx={{ flex: 1, width: 3, mt: 0.5, borderRadius: 2, backgroundColor: i < currentIdx ? tones.positive : tones.track }} />}
                </Box>
                <Box sx={{ minWidth: 0, pt: 0.4 }}>
                  {i === currentIdx && (
                    <Box sx={{ mb: 0.75 }}>
                      {renderHere(true)}
                    </Box>
                  )}
                  <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 800, color: nodeState(i) === "upcoming" ? tones.muted : tones.ink }}>{s.title}</Typography>
                  <Typography sx={{ mt: 0.35, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: tones.muted }}>{s.caption}</Typography>
                  <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.35, borderRadius: 999, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: tones.positive, backgroundColor: tones.positiveGlow }}>
                      <Icon name="wallet" size={12} />
                      {t("kycInsights.journey.chipSettlement", { defaultValue: "Settlement on" })}
                    </Box>
                    <Box
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1,
                        py: 0.35,
                        borderRadius: 999,
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: newState === "paused" ? tones.negative : tones.positive,
                        backgroundColor: newState === "paused" ? tones.negativeGlow : tones.positiveGlow,
                      }}
                    >
                      <Icon name={newState === "paused" ? "circle-pause" : "store"} size={12} />
                      {newState === "paused"
                        ? t("kycInsights.journey.chipNewPaused", { defaultValue: "New payments paused" })
                        : newState === "resumes"
                          ? resumesLabel
                          : t("kycInsights.journey.chipNewOn", { defaultValue: "New payments on" })}
                    </Box>
                  </Box>
                  {i === 1 && !paused && (
                    <Typography sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 0.75, fontFamily: "var(--font-sans)", fontSize: 12, color: tones.muted }}>
                      <Box aria-hidden component="span" sx={{ width: 18, height: 8, borderRadius: 999, flexShrink: 0, background: hatched }} />
                      {pausesIf}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </PanelCard>
  );
};

export default KycJourney;
