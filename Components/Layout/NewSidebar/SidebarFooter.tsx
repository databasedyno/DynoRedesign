import React from "react";
import Link from "next/link";
import { Box, IconButton, Tooltip, useTheme } from "@mui/material";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { useTranslation } from "react-i18next";

interface Props {
  collapsed: boolean;
  canToggle: boolean;
  onToggle: () => void;
}

const buildId = (): string => {
  if (typeof window === "undefined") return "";
  return String((window as any).__NEXT_DATA__?.buildId || "").slice(0, 7);
};

/** Utility footer pinned under the nav (§8.1): status, docs, legal, build + collapse. */
const SidebarFooter: React.FC<Props> = ({ collapsed, canToggle, onToggle }) => {
  const theme = useTheme();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const hairline = theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const links = [
    { href: "/system-status", label: t("footerStatus", { defaultValue: "Status" }), id: "status" },
    { href: "/documentation", label: t("footerDocs", { defaultValue: "Docs" }), id: "docs" },
    { href: "/terms-conditions", label: t("footerTerms", { defaultValue: "Terms" }), id: "terms" },
    { href: "/privacy-policy", label: t("footerPrivacy", { defaultValue: "Privacy" }), id: "privacy" },
  ];
  const toggleLabel = collapsed
    ? t("sidebarExpand", { defaultValue: "Expand sidebar" })
    : t("sidebarCollapse", { defaultValue: "Collapse sidebar" });
  const build = buildId();

  return (
    <Box
      component="footer"
      data-testid="sidebar-utility-footer"
      sx={{ flexShrink: 0, mt: 1, pt: 1, borderTop: `1px solid ${hairline}`, display: "flex", alignItems: "flex-end", justifyContent: collapsed ? "center" : "space-between", gap: 1 }}
    >
      {!collapsed && (
        <Box sx={{ minWidth: 0, pl: 1.5 }}>
          <Box component="nav" aria-label={t("footerLinks", { defaultValue: "Utility links" })} sx={{ display: "flex", flexWrap: "wrap", columnGap: "10px", rowGap: "2px" }}>
            {links.map((l) => (
              <Box
                key={l.id}
                component={Link}
                href={l.href}
                target="_blank"
                rel="noopener"
                data-testid={`sidebar-footer-${l.id}`}
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  lineHeight: "24px",
                  color: theme.palette.text.secondary,
                  textDecoration: "none",
                  "&:hover": { color: theme.palette.text.primary, textDecoration: "underline" },
                  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1, borderRadius: "4px" },
                }}
              >
                {l.label}
              </Box>
            ))}
            {build && (
              <Box component="span" data-testid="sidebar-footer-build" title={`${t("footerBuild", { defaultValue: "Build" })} ${build}`} sx={{ fontFamily: "var(--font-sans)", fontSize: 12, lineHeight: "24px", color: theme.palette.text.disabled }}>
                v·{build}
              </Box>
            )}
          </Box>
        </Box>
      )}
      {canToggle && (
        <Tooltip title={toggleLabel} placement="right" arrow>
          <IconButton
            onClick={onToggle}
            size="small"
            data-testid="sidebar-collapse-toggle"
            data-collapsed={collapsed ? "true" : "false"}
            aria-label={toggleLabel}
            sx={{
              width: 32,
              height: 32,
              flexShrink: 0,
              color: theme.palette.text.secondary,
              borderRadius: "8px",
              "&:hover": { backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,15,20,0.05)", color: theme.palette.text.primary },
            }}
          >
            {collapsed ? <ChevronRightRounded sx={{ fontSize: 20 }} /> : <ChevronLeftRounded sx={{ fontSize: 20 }} />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default SidebarFooter;
