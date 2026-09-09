import { Box, Typography, useTheme } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { MenuItemRow, UserName, UserTrigger } from "./styled";

import LogoutIcon from "@/assets/Icons/logout-icon.svg";
import UserAvatar from "@/Components/UI/UserAvatar";
import { buildCreatorUrl } from "@/helpers/creatorUrl";
import useIsMobile from "@/hooks/useIsMobile";
import useTokenData from "@/hooks/useTokenData";
import useWindow from "@/hooks/useWindow";
import useAccountProfile from "@/hooks/useAccountProfile";
import { useThemeMode } from "@/contexts/ThemeContext";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import { useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import TranslateRounded from "@mui/icons-material/TranslateRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import SettingsIcon from "@mui/icons-material/Settings";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import CustomButton from "../Buttons";
import { HeaderDivider } from "../LanguageSwitcher/styled";

export default function UserMenu() {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const triggerWidth = anchorEl?.clientWidth || 180;
  const tokenData = useTokenData();
  const router = useRouter();
  const customWindow = useWindow();
  const { t } = useTranslation("dashboardLayout");

  // Theme + language + profile-completeness now live INSIDE this avatar menu
  // (Blueprint §3 header slim-down) instead of as separate always-on header controls.
  const { isDark, toggleTheme } = useThemeMode();
  const {
    hasAccount,
    profileComplete,
    isIndividual,
    fetched: accountFetched,
  } = useAccountProfile();
  const showSetupWarning = accountFetched && (!hasAccount || !profileComplete);
  const setupHref = hasAccount ? "/settings?section=company" : "/create-pay-link";
  const setupLabel = !hasAccount
    ? t("companySetupWarning")
    : isIndividual
      ? t("accountSetupWarningIndividual", { defaultValue: "Add your country to finish setup" })
      : t("accountSetupWarningBusiness", { defaultValue: "Finish your business profile" });

  // Show "View my creator page" only once the user has claimed a handle AND published.
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;
  const creatorHandle = profile?.handle && profile?.creator_page_enabled ? String(profile.handle) : "";
  const creatorPublicUrl = buildCreatorUrl(creatorHandle);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setAnchorEl(null);

  const handleLogout = () => {
    if (customWindow) {
      customWindow.localStorage.removeItem("token");
      customWindow.localStorage.removeItem("refreshToken");
      customWindow.location.replace("/auth/login");
    }
  };

  const userName = tokenData?.name || "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    if (anchorEl) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [anchorEl]);

  return (
    <Box
      ref={wrapperRef}
      sx={{
        position: "relative",
        width: "fit-content",
        mt: Boolean(anchorEl) && isMobile ? "-8px" : "0px",
        padding: isMobile && anchorEl ? "4px 0px" : "0",
      }}
    >
      {/* Trigger */}
      <UserTrigger onClick={(e) => setAnchorEl(e.currentTarget)} data-testid="user-menu-trigger">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <UserAvatar
            name={userName}
            photo={tokenData?.photo}
            size={isMobile ? 24 : 32}
            fontSize={isMobile ? 10 : 12}
            data-testid="user-menu-avatar"
          />

          {/* Profile trigger shows the avatar ONLY (no name text) on every
              breakpoint. The merchant's name + email live inside the dropdown.
              Previously the desktop trigger also rendered the full name, which
              duplicated the company name in the adjacent CompanySelector (e.g.
              "hostbay … hostbay") and looked cluttered. Avatar-only is the
              modern SaaS pattern (Stripe/Vercel/Linear) and keeps the header
              clean + consistent across devices. */}
        </Box>

        {/* Chevron hidden on phones — the avatar alone is the trigger there. */}
        <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center" }}>
          {anchorEl ? (
            <ExpandLessIcon
              fontSize="small"
              sx={{ color: theme.palette.text.secondary }}
            />
          ) : (
            <ExpandMoreIcon
              fontSize="small"
              sx={{ color: theme.palette.text.secondary }}
            />
          )}
        </Box>
      </UserTrigger>

      {/* Dropdown */}
      {Boolean(anchorEl) && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            minWidth: isMobile ? "180px" : "220px",
            border: `1px solid ${theme.palette.border?.main || "#E9ECF2"}`,
            borderRadius: "8px",
            backgroundColor: theme.palette.background.paper,
            padding: "5px 14px 14px 12px",
            zIndex: 200,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          {/* Header (duplicate trigger) */}
          <Box
            onClick={() => setAnchorEl(null)}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <UserAvatar
                name={userName}
                photo={tokenData?.photo}
                size={isMobile ? 24 : 32}
                fontSize={isMobile ? 10 : 12}
                data-testid="user-menu-dropdown-avatar"
              />

              <UserName sx={{ fontSize: isMobile ? 13 : 15 }}>
                {userName || "User"}
              </UserName>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <HeaderDivider />
              <ExpandLessIcon
                fontSize="small"
                sx={{ color: theme.palette.text.secondary }}
              />
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ mt: "7px" }}>
            {showSetupWarning && (
              <Link href={setupHref} style={{ textDecoration: "none" }}>
                <MenuItemRow
                  data-testid="user-menu-setup-warning"
                  onClick={() => setAnchorEl(null)}
                  sx={{
                    gap: "8px",
                    justifyContent: "flex-start",
                    borderRadius: "8px",
                    px: "8px",
                    mb: "6px",
                    backgroundColor: theme.palette.primary.light,
                    "&:hover": { backgroundColor: theme.palette.primary.light },
                  }}
                >
                  <InfoOutlinedIcon
                    sx={{ fontSize: "16px", color: theme.palette.primary.main }}
                  />
                  <Typography
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: isMobile ? "12.5px" : "13.5px",
                      fontWeight: 600,
                      color: theme.palette.primary.main,
                    }}
                  >
                    {setupLabel}
                  </Typography>
                </MenuItemRow>
              </Link>
            )}
            <MenuItemRow
              data-testid="user-menu-creator"
              onClick={() => {
                if (creatorPublicUrl) {
                  window.open(creatorPublicUrl, "_blank", "noopener");
                } else {
                  router.push("/creator");
                }
                setAnchorEl(null);
              }}
              sx={{
                gap: "8px",
                justifyContent: "center",
                "&:hover": { background: "transparent" },
              }}
            >
              <AutoAwesomeRounded sx={{ fontSize: "16px" }} />
              <Typography
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: isMobile ? "13px" : "15px",
                }}
              >
                {creatorHandle
                  ? t("userMenuViewCreator", { defaultValue: "View my creator page" })
                  : t("userMenuClaimCreator", { defaultValue: "Claim my creator page" })}
              </Typography>
              {creatorHandle && (
                <OpenInNewRounded sx={{ fontSize: "13px", color: theme.palette.text.secondary, ml: -0.5 }} />
              )}
            </MenuItemRow>

            <MenuItemRow
              data-testid="user-menu-settings"
              onClick={() => {
                router.push("/settings");
                setAnchorEl(null);
              }}
              sx={{
                gap: "8px",
                justifyContent: "center",
                "&:hover": { background: "transparent" },
              }}
            >
              <SettingsIcon sx={{ fontSize: "16px" }} />
              <Typography
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: isMobile ? "13px" : "15px",
                }}
              >
                {t("settings")}
              </Typography>
            </MenuItemRow>

            {/* Preferences moved out of the header (Blueprint §3). */}
            <HeaderDivider style={{ margin: "8px 0" }} />

            <MenuItemRow
              data-testid="user-menu-theme-toggle"
              onClick={toggleTheme}
              sx={{
                gap: "8px",
                justifyContent: "flex-start",
                "&:hover": { background: "transparent" },
              }}
            >
              {isDark ? (
                <LightModeOutlinedIcon sx={{ fontSize: "16px" }} />
              ) : (
                <DarkModeOutlinedIcon sx={{ fontSize: "16px" }} />
              )}
              <Typography
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: isMobile ? "13px" : "15px",
                }}
              >
                {isDark
                  ? t("userMenuLightMode", { defaultValue: "Light mode" })
                  : t("userMenuDarkMode", { defaultValue: "Dark mode" })}
              </Typography>
            </MenuItemRow>

            <Box
              data-testid="user-menu-language"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                px: "6px",
                py: "6px",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TranslateRounded sx={{ fontSize: "16px", color: theme.palette.text.primary }} />
                <Typography
                  sx={{
                    fontFamily: "var(--font-sans)",
                    fontSize: isMobile ? "13px" : "15px",
                    color: theme.palette.text.primary,
                  }}
                >
                  {t("userMenuLanguage", { defaultValue: "Language" })}
                </Typography>
              </Box>
              <LanguageSwitcher />
            </Box>

            <Box mt={isMobile ? "10px" : "15px"}>
              <CustomButton
                label={t("logout")}
                onClick={handleLogout}
                variant="secondary"
                endIcon={
                  <Image
                    src={LogoutIcon}
                    alt="logout"
                    width={10}
                    height={10}
                    draggable={false}
                  />
                }
                fullWidth
                sx={{ height: isMobile ? "32px" : "40px" }}
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
