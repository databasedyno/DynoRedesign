import React from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, CircularProgress, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import type { RenderItemCard } from "./CatalogSection";
import type { QualityCenter } from "./useQualityCenter";

interface Props {
  qc: QualityCenter;
  isDark: boolean;
  cardBg: string;
  border: string;
  renderItemCard: RenderItemCard;
}

/** "Custom Tests" accordion: add form + tester-created items. */
export const CustomTestsSection: React.FC<Props> = ({ qc, isDark, cardBg, border, renderItemCard }) => {
  const { expanded, toggleExpanded, filterActive, customItems, visibleCustomItems, customForm, setCustomForm, addingCustom, addCustom, deleteCustom } = qc;
  return (
    <Accordion
      expanded={expanded.includes("__custom") || filterActive}
      onChange={() => toggleExpanded("__custom")}
      sx={{ mt: 3, mb: 1.5, borderRadius: "12px !important", bgcolor: cardBg, border, "&:before": { display: "none" } }}
      disableGutters
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontSize: 17, fontWeight: 700 }}>➕ Custom Tests</Typography>
        <Chip label={`${customItems.length}`} size="small" sx={{ ml: 1.5, fontSize: 11 }} />
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC", border }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Add a custom test</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              <TextField
                size="small"
                label="Area (optional)"
                value={customForm.area}
                onChange={(e) => setCustomForm((f) => ({ ...f, area: e.target.value }))}
                sx={{ minWidth: 200 }}
              />
              <TextField
                size="small"
                label="Test title"
                value={customForm.title}
                onChange={(e) => setCustomForm((f) => ({ ...f, title: e.target.value }))}
                sx={{ minWidth: 260, flex: 1 }}
              />
            </Box>
            <TextField
              size="small"
              label="What to test / expected result (optional)"
              multiline
              minRows={2}
              value={customForm.description}
              onChange={(e) => setCustomForm((f) => ({ ...f, description: e.target.value }))}
            />
            <Box>
              <Button variant="contained" startIcon={<AddIcon />} onClick={addCustom} disabled={addingCustom || !customForm.title.trim()}>
                {addingCustom ? <CircularProgress size={18} color="inherit" /> : "Add test"}
              </Button>
            </Box>
          </Box>
        </Box>

        {visibleCustomItems.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            {filterActive
              ? "No custom tests match the current filter."
              : "No custom tests yet. Add one above to track anything not covered by the catalog."}
          </Typography>
        ) : (
          visibleCustomItems.map((item) =>
            renderItemCard(
              item.item_key,
              { section_id: "custom", section_title: item.area || "Custom Tests", case_title: item.title },
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{item.title}</Typography>
                  {item.area && <Chip label={item.area} size="small" sx={{ height: 20, fontSize: 10 }} />}
                </Box>
                {item.description && (
                  <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{item.description}</Typography>
                )}
              </Box>,
              undefined,
              () => deleteCustom(item.id),
            ),
          )
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default CustomTestsSection;
