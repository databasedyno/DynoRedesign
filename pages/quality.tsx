import React, { useCallback } from "react";
import { Box, Divider, IconButton, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import LogoutIcon from "@mui/icons-material/Logout";
import QaItemCard from "@/Components/Page/Quality/QaItemCard";
import type { QaComment, QaItemMeta } from "@/Components/Page/Quality/QaItemCard";
import { useQualityCenter } from "@/Components/Page/Quality/useQualityCenter";
import QualityGate, { QualityHead } from "@/Components/Page/Quality/QualityGate";
import QualityToolbar from "@/Components/Page/Quality/QualityToolbar";
import CatalogSection from "@/Components/Page/Quality/CatalogSection";
import CustomTestsSection from "@/Components/Page/Quality/CustomTestsSection";
import QaGuidePanel from "@/Components/Page/Quality/QaGuidePanel";
import JourneySection from "@/Components/Page/Quality/JourneySection";

const EMPTY: QaComment[] = [];

/** Passcode-gated internal QA test plan — every note is stored via /api/quality. */
const QualityPage = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const cardBg = isDark ? "#151921" : "#FFFFFF";
  const border = `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`;

  const qc = useQualityCenter();
  const { commentsByItem, savingKey, saveComment, quickAction, deleteComment } = qc;

  const renderItemCard = useCallback(
    function renderItemCard(itemKey: string, meta: Omit<QaItemMeta, "item_key">, header: React.ReactNode, body?: React.ReactNode, onDeleteItem?: () => void) {
      return (
        <QaItemCard
          key={itemKey}
          itemKey={itemKey}
          meta={meta}
          header={header}
          body={body}
          comments={commentsByItem[itemKey] || EMPTY}
          saving={savingKey === itemKey}
          isDark={isDark}
          cardBg={cardBg}
          border={border}
          onSave={saveComment}
          onQuick={quickAction}
          onDeleteComment={deleteComment}
          onDeleteItem={onDeleteItem}
        />
      );
    },
    [commentsByItem, savingKey, isDark, cardBg, border, saveComment, quickAction, deleteComment],
  );

  if (qc.booting || !qc.authed) {
    return (
      <QualityGate
        booting={qc.booting}
        isDark={isDark}
        cardBg={cardBg}
        border={border}
        passInput={qc.passInput}
        setPassInput={qc.setPassInput}
        authError={qc.authError}
        authLoading={qc.authLoading}
        onUnlock={qc.handleUnlock}
      />
    );
  }

  return (
    <>
      <QualityHead />
      <Box sx={{ minHeight: "100vh", bgcolor: isDark ? "#0B0E11" : "#F8FAFC", py: { xs: 3, md: 6 } }}>
        <Box sx={{ maxWidth: 1100, mx: "auto", px: { xs: 2, md: 3 } }}>
          <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Box>
              <Typography sx={{ fontSize: { xs: 26, md: 36 }, fontWeight: 800 }}>Dynopay Quality Center</Typography>
              <Typography sx={{ fontSize: 14, color: "text.secondary", maxWidth: 640 }}>
                End-to-end functional test plan. Record a status and notes for each test — every note is
                saved to the database so the team can review and fix.
              </Typography>
            </Box>
            <Tooltip title="Lock / sign out">
              <IconButton onClick={qc.handleLock}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <QualityToolbar qc={qc} cardBg={cardBg} border={border} />

          <QaGuidePanel isDark={isDark} cardBg={cardBg} border={border} />

          {qc.filteredSections.map((section) =>
            section.id === "journeys" ? (
              <JourneySection
                key={section.id}
                section={section}
                expanded={qc.expanded.includes(section.id) || qc.filterActive}
                onToggle={() => qc.toggleExpanded(section.id)}
                qc={qc}
                isDark={isDark}
                cardBg={cardBg}
                border={border}
              />
            ) : (
              <CatalogSection
                key={section.id}
                section={section}
                expanded={qc.expanded.includes(section.id) || qc.filterActive}
                onToggle={() => qc.toggleExpanded(section.id)}
                isDark={isDark}
                cardBg={cardBg}
                border={border}
                renderItemCard={renderItemCard}
              />
            ),
          )}

          <CustomTestsSection qc={qc} isDark={isDark} cardBg={cardBg} border={border} renderItemCard={renderItemCard} />

          <Divider sx={{ my: 3 }} />
          <Typography sx={{ fontSize: 12, color: "text.secondary", textAlign: "center", pb: 4 }}>
            All notes are stored in the database. Use the CSV / JSON export above to hand the full list to
            the dev team.
          </Typography>
        </Box>
      </Box>
    </>
  );
};

export default QualityPage;

// Render standalone (no marketing/app shell) — this is a passcode-gated internal tool.
(QualityPage as unknown as { layout: string }).layout = "none";
