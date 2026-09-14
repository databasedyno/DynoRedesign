import React from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Link, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  GUIDE_ENVIRONMENTS,
  GUIDE_ACCOUNTS,
  GUIDE_BRANDS,
  GUIDE_PRIORITY,
  GUIDE_STATUS,
  GUIDE_CHECKLIST,
  GUIDE_BUG_TEMPLATE,
  GUIDE_GLOSSARY,
} from "@/data/qaGuide";

interface Props {
  isDark: boolean;
  cardBg: string;
  border: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#EF4444",
  High: "#F59E0B",
  Medium: "#3B82F6",
  Low: "#6B7280",
};
const STATUS_COLORS: Record<string, string> = {
  Pass: "#10B981",
  Fail: "#EF4444",
  Blocked: "#F59E0B",
  Pending: "#6B7280",
};

/** A titled sub-block inside the playbook. */
const Group: React.FC<{ title: string; testid: string; children: React.ReactNode }> = ({ title, testid, children }) => (
  <Box sx={{ mb: 2.5 }} data-testid={testid}>
    <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "text.secondary", mb: 1, textTransform: "uppercase" }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const KVList: React.FC<{ items: { term: string; desc: string }[]; chipColors?: Record<string, string> }> = ({ items, chipColors }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
    {items.map((it) => (
      <Box key={it.term} sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
        {chipColors ? (
          <Chip
            label={it.term}
            size="small"
            sx={{ height: 20, fontSize: 10, fontWeight: 700, color: "#fff", bgcolor: chipColors[it.term] || "#6B7280" }}
          />
        ) : (
          <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, minWidth: 168 }}>
            {it.term}
          </Typography>
        )}
        <Typography component="span" sx={{ fontSize: 12.5, color: "text.secondary", flex: 1 }}>
          {it.desc}
        </Typography>
      </Box>
    ))}
  </Box>
);

/**
 * Collapsible "QA Playbook" shown at the top of the Quality Center and /QA.
 * Gives testers the environment, accounts, legends, an effectiveness checklist,
 * a bug-report template and a glossary so they can test the journeys well.
 */
export const QaGuidePanel: React.FC<Props> = ({ isDark, cardBg, border }) => {
  const subCard = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  return (
    <Accordion
      data-testid="qa-playbook-panel"
      defaultExpanded={false}
      disableGutters
      sx={{ mb: 2, borderRadius: "12px !important", bgcolor: cardBg, border, "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} data-testid="qa-playbook-toggle">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <MenuBookIcon fontSize="small" />
          <Typography sx={{ fontSize: 17, fontWeight: 800 }}>QA Playbook — how to test effectively</Typography>
        </Box>
        <Chip label="read me first" size="small" sx={{ ml: 1.5, fontSize: 10, fontWeight: 700 }} />
      </AccordionSummary>
      <AccordionDetails>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2.5 }}>
          Start with the <b>End-to-End User Journeys</b> section below, using this reference for where to go,
          what accounts to use, and how to record what you find.
        </Typography>

        {/* Environments */}
        <Group title="Where to test — environments & sandboxes" testid="qa-guide-environments">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {GUIDE_ENVIRONMENTS.map((e) => (
              <Box key={e.route} sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
                <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, minWidth: 200 }}>
                  {e.label}
                </Typography>
                <Link href={e.route} target="_blank" rel="noopener" sx={{ fontSize: 12.5, fontFamily: "monospace" }}>
                  {e.route}
                </Link>
                {e.note ? (
                  <Typography component="span" sx={{ fontSize: 12, color: "text.secondary", flexBasis: "100%", pl: "200px" }}>
                    {e.note}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Box>
        </Group>

        {/* Accounts + brands */}
        <Group title="Test accounts & brand fixtures (secrets live in the team vault)" testid="qa-guide-accounts">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {GUIDE_ACCOUNTS.map((a) => (
              <Box key={a.role} sx={{ p: 1.25, borderRadius: 2, bgcolor: subCard }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{a.role}</Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{a.detail}</Typography>
                <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 0.25, fontStyle: "italic" }}>
                  🔑 {a.credentials}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ mt: 1.25 }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "text.secondary", mb: 0.5 }}>
              Brands on the owner account (company switcher)
            </Typography>
            <KVList items={GUIDE_BRANDS} />
          </Box>
        </Group>

        {/* Legends */}
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 260 }}>
            <Group title="Priority legend" testid="qa-guide-priority">
              <KVList items={GUIDE_PRIORITY} chipColors={PRIORITY_COLORS} />
            </Group>
          </Box>
          <Box sx={{ flex: 1, minWidth: 260 }}>
            <Group title="Status legend" testid="qa-guide-status">
              <KVList items={GUIDE_STATUS} chipColors={STATUS_COLORS} />
            </Group>
          </Box>
        </Box>

        {/* Effectiveness checklist */}
        <Group title="How to test effectively — checklist" testid="qa-guide-checklist">
          <Box component="ol" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.6 }}>
            {GUIDE_CHECKLIST.map((c, i) => (
              <Typography key={i} component="li" sx={{ fontSize: 12.5, color: "text.secondary" }}>
                {c}
              </Typography>
            ))}
          </Box>
        </Group>

        {/* Bug template */}
        <Group title="Bug report template — capture all of this" testid="qa-guide-bug-template">
          <KVList items={GUIDE_BUG_TEMPLATE} />
        </Group>

        {/* Glossary */}
        <Group title="Glossary" testid="qa-guide-glossary">
          <KVList items={GUIDE_GLOSSARY} />
        </Group>
      </AccordionDetails>
    </Accordion>
  );
};

export default QaGuidePanel;
