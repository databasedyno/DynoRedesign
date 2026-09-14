import React from "react";
import { Box, Tooltip, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useSetupProgress } from "@/Components/Page/GetStarted/useSetupProgress";
import ProgressRing from "@/Components/Page/GetStarted/ProgressRing";
import { STEP_TRACK_KEY } from "@/Components/Page/GetStarted/stepMeta";
import { trackOnboarding } from "@/utils/trackOnboarding";
import { MONO } from "@/styles/uiKit";
import { MenuItem } from "./styled";

/**
 * SetupProgressItem — plan 1.12: the sidebar's setup-progress ring during
 * onboarding. A pinned "Getting started · n/4" row (ring only in the icon
 * rail) that resumes the /get-started wizard; disappears for good once the
 * first payment lands. Team members never see it.
 */
const SetupProgressItem: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation("dashboardLayout");
  const { isMember } = useCompanyStore();
  const { ready, hasPayment, doneCount, total, firstIncomplete } = useSetupProgress();

  if (isMember || !ready || hasPayment) return null;

  const isActive = router.pathname === "/get-started";
  const title = t("gs.sidebarTitle", { defaultValue: "Getting started" });
  const progress = t("gs.progressLabel", { done: doneCount, total, defaultValue: "{{done}} of {{total}} done" });
  const go = () => {
    trackOnboarding({ event_type: "step_clicked", step_key: STEP_TRACK_KEY[firstIncomplete], metadata: { surface: "sidebar_ring" } });
    router.push({ pathname: "/get-started", query: { step: firstIncomplete } });
  };

  return (
    <Tooltip title={collapsed ? `${title} · ${progress}` : ""} placement="right" arrow enterDelay={200}>
      <MenuItem
        active={isActive}
        role="link"
        tabIndex={0}
        aria-current={isActive ? "page" : undefined}
        aria-label={`${title} · ${progress}`}
        data-testid="sidebar-setup-progress"
        data-done={doneCount}
        data-total={total}
        onClick={go}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
          }
        }}
        sx={collapsed ? { justifyContent: "center", padding: "10px 0", gap: 0 } : undefined}
      >
        <ProgressRing value={doneCount} total={total} size={22} stroke={3} hideLabel label={progress} />
        {!collapsed && (
          <>
            <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: isActive ? 600 : 500, fontFamily: "var(--font-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </Box>
            <Box component="span" data-testid="sidebar-setup-progress-count" sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: theme.palette.text.secondary, flexShrink: 0 }}>
              {doneCount}/{total}
            </Box>
          </>
        )}
      </MenuItem>
    </Tooltip>
  );
};

export default SetupProgressItem;
