import useIsMobile from "@/hooks/useIsMobile";
import { useUnreadNotificationsCount } from "@/hooks/useUnreadNotificationsCount";
import SidebarIcon from "@/utils/customIcons/sidebar-icons";
import AddIcon from "@mui/icons-material/Add";
import GroupAddRounded from "@mui/icons-material/GroupAddRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import { Box, Divider, Tooltip, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReferralAndKnowledge from "../ReferralAndKnowledge";
import {
  IconBox,
  Menu,
  MenuItem,
  QuickAddButton,
  SectionLabel,
  SidebarWrapper,
} from "./styled";

interface SidebarItem {
  label: string;
  icon: string;
  path: string;
  plus?: boolean;
}

interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

const NewSidebar = () => {
  const isMobile = useIsMobile("md");
  const router = useRouter();
  const theme = useTheme();
  const unreadNotifications = useUnreadNotificationsCount();

  // Prefetch all menu routes for instant navigation
  useEffect(() => {
    const paths = [
      "/dashboard", "/transactions", "/invoices", "/pay-links",
      "/wallet", "/customers", "/developer-keys", "/referrals",
      "/notifications", "/create-pay-link", "/settings"
    ];
    paths.forEach((p) => router.prefetch(p));
  }, []);
  const { t } = useTranslation("dashboardLayout");

  const sections: SidebarSection[] = [
    {
      label: t("sidebarSectionMain"),
      items: [
        { label: t("dashboard"), icon: "dashboard", path: "/dashboard" },
        { label: t("transactions"), icon: "transactions", path: "/transactions" },
        { label: t("invoicesTax"), icon: "invoices", path: "/invoices" },
      ],
    },
    {
      label: t("sidebarSectionPayments"),
      items: [
        { label: t("payLinks"), icon: "payment-links", path: "/pay-links", plus: true },
        { label: t("wallets"), icon: "wallets", path: "/wallet" },
        { label: t("customers"), icon: "customers", path: "/customers" },
      ],
    },
    {
      label: t("sidebarSectionAccount"),
      items: [
        { label: t("api"), icon: "api", path: "/developer-keys" },
        { label: t("referrals"), icon: "referrals", path: "/referrals" },
        { label: t("notifications"), icon: "notifications", path: "/notifications" },
        { label: t("settings"), icon: "settings", path: "/settings" },
      ],
    },
  ];

  const isActiveRoute = (path: string) => {
    if (path === "/") return router.pathname === "/";
    return router.pathname.startsWith(path);
  };

  const iconColor = (isActive: boolean) =>
    isActive ? theme.palette.primary.contrastText : theme.palette.text.secondary;

  return (
    <SidebarWrapper>
      <Menu>
        {sections.map((section, sectionIdx) => (
          <React.Fragment key={section.label}>
            {/* UX-2026-07-08: thin divider between sections to make groupings scannable */}
            {!isMobile && sectionIdx > 0 && (
              <Divider
                flexItem
                sx={{
                  mx: 1.5,
                  my: 0.75,
                  borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                }}
              />
            )}
            <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {!isMobile && <SectionLabel>{section.label}</SectionLabel>}

              {section.items.map((item) => {
                const isActive = isActiveRoute(item.path);
                const isNotifications = item.icon === "notifications";
                const showBadge = isNotifications && unreadNotifications > 0;

                return (
                  <MenuItem
                    key={item.path}
                    active={isActive}
                    onClick={() => router.push(item.path)}
                  >
                    <IconBox active={isActive} sx={{ position: "relative" }}>
                      {item.icon === "referrals" ? (
                        <GroupAddRounded sx={{ fontSize: 20, color: iconColor(isActive) }} />
                      ) : item.icon === "settings" ? (
                        <SettingsRounded sx={{ fontSize: 20, color: iconColor(isActive) }} />
                      ) : (
                        <SidebarIcon
                          name={item.icon}
                          size={item.icon === "customers" ? 24 : 20}
                          color={iconColor(isActive)}
                        />
                      )}
                      {/* Unread notifications badge — always attached to icon so it shows in
                          both expanded and collapsed sidebar states. */}
                      {showBadge && (
                        <Box
                          data-testid="sidebar-notifications-badge"
                          aria-label={`${unreadNotifications} unread notifications`}
                          sx={{
                            position: "absolute",
                            top: -4,
                            right: -6,
                            minWidth: 18,
                            height: 18,
                            px: unreadNotifications > 9 ? 0.5 : 0,
                            borderRadius: 999,
                            backgroundColor: "#E11D48",
                            color: "#FFFFFF",
                            fontSize: 10,
                            fontFamily: "var(--font-sans), sans-serif",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: `2px solid ${theme.palette.background.default || "#FFFFFF"}`,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          }}
                        >
                          {unreadNotifications > 99 ? "99+" : unreadNotifications}
                        </Box>
                      )}
                    </IconBox>

                    <Box
                      component="span"
                      sx={{
                        fontSize: isMobile ? "11px" : "14px",
                        fontWeight: isActive ? 700 : 500,
                        textAlign: "center",
                        lineHeight: 1.2,
                        fontFamily: isActive ? "var(--font-sans)" : "var(--font-sans)",
                        [theme.breakpoints.down("md")]: {
                          fontSize: "11px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "100%",
                        },
                      }}
                    >
                      {isMobile ? item.label.split(" ")[0] : item.label}
                    </Box>

                    {item.plus && !isMobile && (
                      <Tooltip title={t("newPaymentLink")} placement="right" arrow>
                        <QuickAddButton
                          active={isActive}
                          aria-label={t("newPaymentLink")}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push("/create-pay-link");
                          }}
                        >
                          <AddIcon sx={{ fontSize: "16px", color: "inherit" }} />
                        </QuickAddButton>
                      </Tooltip>
                    )}
                  </MenuItem>
                );
              })}
            </Box>
          </React.Fragment>
        ))}
      </Menu>
      {/* Referral and Knowledge Base Section */}
      <ReferralAndKnowledge isMobile={isMobile} />
    </SidebarWrapper>
  );
};

export default NewSidebar;
