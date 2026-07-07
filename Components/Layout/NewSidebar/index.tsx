import useIsMobile from "@/hooks/useIsMobile";
import SidebarIcon from "@/utils/customIcons/sidebar-icons";
import AddIcon from "@mui/icons-material/Add";
import GroupAddRounded from "@mui/icons-material/GroupAddRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import { Box, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReferralAndKnowledge from "../ReferralAndKnowledge";
import {
  ActiveIndicator,
  IconBox,
  Menu,
  MenuItem,
  SidebarWrapper,
} from "./styled";

const NewSidebar = () => {
  const isMobile = useIsMobile("md");
  const router = useRouter();
  const theme = useTheme();

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

  const menuItems = [
    { label: t("dashboard"), icon: "dashboard", path: "/dashboard" },
    {
      label: t("transactions"),
      icon: "transactions",
      path: "/transactions",
    },
    {
      label: t("invoicesTax"),
      icon: "invoices",
      path: "/invoices",
    },
    {
      label: t("payLinks"),
      icon: "payment-links",
      path: "/pay-links",
      plus: true,
    },
    { label: t("wallets"), icon: "wallets", path: "/wallet" },
    { label: t("customers"), icon: "customers", path: "/customers" },
    { label: t("api"), icon: "api", path: "/developer-keys" },
    { label: t("referrals"), icon: "referrals", path: "/referrals" },
    {
      label: t("notifications"),
      icon: "notifications",
      path: "/notifications",
    },
    {
      label: t("settings"),
      icon: "settings",
      path: "/settings",
    },
  ];

  const isActiveRoute = (path: string) => {
    if (path === "/") return router.pathname === "/";
    return router.pathname.startsWith(path);
  };

  return (
    <SidebarWrapper>
      <Menu>
        {menuItems.map((item, i) => {
          const isActive = isActiveRoute(item.path);

          return (
            <MenuItem
              key={i}
              active={isActive}
              onClick={() => router.push(item.path)}
            >
              <ActiveIndicator active={isActive} />
              <IconBox active={isActive}>
                {item.icon === "referrals" ? (
                  <GroupAddRounded
                    sx={{
                      fontSize: 20,
                      color: isActive
                        ? theme.palette.primary.main
                        : theme.palette.text.primary,
                    }}
                  />
                ) : item.icon === "settings" ? (
                  <SettingsRounded
                    sx={{
                      fontSize: 20,
                      color: isActive
                        ? theme.palette.primary.main
                        : theme.palette.text.primary,
                    }}
                  />
                ) : (
                  <SidebarIcon
                    name={item.icon}
                    size={item.icon === "customers" ? 24 : 20}
                    color={
                      isActive
                        ? theme.palette.primary.main
                        : theme.palette.text.primary
                    }
                  />
                )}
              </IconBox>

              <Box
                component="span"
                sx={{
                  fontSize: isMobile ? "11px" : "14px",
                  fontWeight: 500,
                  textAlign: "center",
                  lineHeight: 1.2,
                  fontFamily: "UrbanistMedium",
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
                <Box
                  sx={{
                    background: theme.palette.secondary.light,
                    borderRadius: "50%",
                    padding: "4px",
                    width: "28px",
                    height: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "auto",
                    fontFamily: "UrbanistMedium",
                  }}
                >
                  <AddIcon
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push("/create-pay-link");
                    }}
                    sx={{
                      marginLeft: "auto",
                      color: theme.palette.primary.main,
                      fontSize: "20px",
                    }}
                  />
                </Box>
              )}
            </MenuItem>
          );
        })}
      </Menu>
      {/* Referral and Knowledge Base Section */}
      <ReferralAndKnowledge isMobile={isMobile} />
    </SidebarWrapper>
  );
};

export default NewSidebar;
