import React from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { resolveWhere } from "@/data/qaWhere";
import type { TestSection } from "@/data/qaCatalog";
import type { QualityCenter } from "./useQualityCenter";
import JourneyCard from "./JourneyCard";

interface Props {
  section: TestSection;
  expanded: boolean;
  onToggle: () => void;
  qc: QualityCenter;
  isDark: boolean;
  cardBg: string;
  border: string;
}

/** The End-to-End User Journeys section: a coverage strip + a JourneyCard per flow. */
export const JourneySection: React.FC<Props> = ({ section, expanded, onToggle, qc, isDark, cardBg, border }) => {
  // Coverage-at-a-glance across every journey in this section.
  let signedOff = 0, allPassed = 0, inProgress = 0, unassigned = 0;
  section.cases.forEach((c) => {
    const caseKey = `${section.id}::${c.id}`;
    const meta = qc.metaByItem[caseKey];
    const rolled = qc.deriveJourneyStatus(caseKey, c.steps);
    const anyStep = c.steps.some((s) => qc.latestStatus(`${caseKey}#s:${s.id}`) !== "not_tested");
    if (meta?.signed_off) signedOff += 1;
    if (rolled === "pass") allPassed += 1;
    else if (anyStep) inProgress += 1;
    if (!meta?.assignee) unassigned += 1;
  });

  const strip: { label: string; color: string; testid: string }[] = [
    { label: `${signedOff}/${section.cases.length} signed off`, color: "#0EA5E9", testid: "qa-journeys-signedoff" },
    { label: `${allPassed} all steps passed`, color: "#22C55E", testid: "qa-journeys-passed" },
    { label: `${inProgress} in progress`, color: "#F59E0B", testid: "qa-journeys-inprogress" },
    { label: `${unassigned} unassigned`, color: "#6B7280", testid: "qa-journeys-unassigned" },
  ];

  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      disableGutters
      sx={{ mb: 1.5, borderRadius: "12px !important", bgcolor: cardBg, border, "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{section.icon} {section.title}</Typography>
        <Chip label={`${section.cases.length} journeys`} size="small" sx={{ ml: 1.5, fontSize: 11 }} />
      </AccordionSummary>
      <AccordionDetails>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>{section.description}</Typography>
        {/* Coverage strip */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }} data-testid="qa-journeys-coverage">
          {strip.map((s) => (
            <Chip key={s.testid} data-testid={s.testid} label={s.label} size="small"
              sx={{ fontSize: 11, fontWeight: 700, color: "#fff", bgcolor: s.color }} />
          ))}
        </Box>
        {section.cases.map((c) => (
          <JourneyCard
            key={c.id}
            caseData={c}
            sectionId={section.id}
            sectionTitle={section.title}
            where={resolveWhere(section.id, c.id)}
            qc={qc}
            isDark={isDark}
            cardBg={isDark ? "rgba(255,255,255,0.02)" : "#FCFCFD"}
            border={border}
          />
        ))}
      </AccordionDetails>
    </Accordion>
  );
};

export default JourneySection;
