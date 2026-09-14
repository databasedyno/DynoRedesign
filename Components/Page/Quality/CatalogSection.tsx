import React from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TEST_SECTIONS } from "@/data/qaCatalog";
import { resolveWhere } from "@/data/qaWhere";
import { QaWhereLine, STATUS_META } from "./QaItemCard";
import type { QaItemMeta } from "./QaItemCard";

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#EF4444",
  High: "#F59E0B",
  Medium: "#3B82F6",
  Low: "#6B7280",
};

export type RenderItemCard = (
  itemKey: string,
  meta: Omit<QaItemMeta, "item_key">,
  header: React.ReactNode,
  body?: React.ReactNode,
  onDeleteItem?: () => void,
) => React.ReactNode;

interface Props {
  section: (typeof TEST_SECTIONS)[number];
  expanded: boolean;
  onToggle: () => void;
  isDark: boolean;
  cardBg: string;
  border: string;
  renderItemCard: RenderItemCard;
}

/** One catalog section (Accordion) with its test cases, steps and status cards. */
export const CatalogSection: React.FC<Props> = ({ section, expanded, onToggle, isDark, cardBg, border, renderItemCard }) => {
  const theme = useTheme();
  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      sx={{ mb: 1.5, borderRadius: "12px !important", bgcolor: cardBg, border, "&:before": { display: "none" } }}
      disableGutters
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontSize: 17, fontWeight: 700 }}>
          {section.icon} {section.title}
        </Typography>
        <Chip label={`${section.cases.length} tests`} size="small" sx={{ ml: 1.5, fontSize: 11 }} />
      </AccordionSummary>
      <AccordionDetails>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>{section.description}</Typography>
        {section.cases.map((c) => {
          const itemKey = `${section.id}::${c.id}`;
          const where = resolveWhere(section.id, c.id);
          return renderItemCard(
            itemKey,
            { section_id: section.id, section_title: section.title, case_title: c.title },
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                <Typography sx={{ fontSize: 11, fontFamily: "monospace", color: "text.secondary" }}>{c.id}</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{c.title}</Typography>
                <Chip label={c.priority} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, color: "#fff", bgcolor: PRIORITY_COLORS[c.priority] }} />
              </Box>
              {where ? <QaWhereLine where={where} isDark={isDark} /> : null}
              {c.preconditions && (
                <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.75, mb: 0.5 }}>
                  <b>Preconditions:</b> {c.preconditions}
                </Typography>
              )}
            </Box>,
            <Box sx={{ mt: 1, mb: 1 }} data-testid={`qa-steps-${section.id}::${c.id}`}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "text.secondary", mb: 0.5 }}>STEPS</Typography>
              {c.steps.map((st, i) => (
                <Box key={st.id} sx={{ display: "flex", gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 12.5, color: "text.secondary", minWidth: 20 }}>{i + 1}.</Typography>
                  <Typography sx={{ fontSize: 12.5 }}>
                    <b>{st.action}</b> → <span style={{ color: theme.palette.text.secondary }}>{st.expected}</span>
                  </Typography>
                </Box>
              ))}
              {c.notes && (
                <Typography sx={{ fontSize: 12, color: STATUS_META.blocked.color, mt: 0.5 }}>
                  ⚠️ {c.notes}
                </Typography>
              )}
            </Box>,
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
};

export default CatalogSection;
