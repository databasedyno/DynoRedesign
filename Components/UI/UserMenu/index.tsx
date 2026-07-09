import { Box, Typography, useTheme } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { MenuItemRow, UserName, UserTrigger } from "./styled";

import LogoutIcon from "@/assets/Icons/logout-icon.svg";
import { getInitials } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import useTokenData from "@/hooks/useTokenData";
import useWindow from "@/hooks/useWindow";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import CustomButton from "../Buttons";
import { HeaderDivider } from "../LanguageSwitcher/styled";

export default function UserMenu() {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [imageError, setImageError] = useState(false);

  const triggerWidth = anchorEl?.clientWidth || 180;
  const tokenData = useTokenData();
  const router = useRouter();
  const customWindow = useWindow();
  const { t } = useTranslation("dashboardLayout");

  const wrapperRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setAnchorEl(null);

  const handleLogout = () => {
    if (customWindow) {
      customWindow.localStorage.removeItem("token");
      customWindow.localStorage.removeItem("refreshToken");
      customWindow.location.replace("/auth/login");
    }
  };

  // Safely get firstName, handle cases where name might be undefined
  const firstName = tokenData?.name?.split(" ")[0] || "";
  const lastName = tokenData?.name?.split(" ")[1] || "";
  const userName = tokenData?.name || "";
  const rawPhoto = tokenData?.photo || "";
  const userPhoto = rawPhoto && !rawPhoto.startsWith("/") && !rawPhoto.startsWith("http") && !rawPhoto.startsWith("blob:") ? `/${rawPhoto}` : rawPhoto;

  // Reset error state when photo changes
  useEffect(() => {
    setImageError(false);
  }, [userPhoto]);

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
      <UserTrigger onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box
            sx={{
              position: "relative",
              width: isMobile ? 24 : 32,
              height: isMobile ? 24 : 32,
              borderRadius: "50%",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                userPhoto && !imageError
                  ? "transparent"
                  : theme.palette.primary.light,
              flexShrink: 0,
            }}
          >
            {userPhoto && !imageError ? (
              <Image
                src={userPhoto as string}
                alt="user"
                width={isMobile ? 24 : 32}
                height={isMobile ? 24 : 32}
                style={{ borderRadius: "50%", objectFit: "cover" }}
                draggable={false}
                onError={() => setImageError(true)}
              />
            ) : (
              <Typography
                sx={{
                  fontSize: isMobile ? "10px" : "12px",
                  fontWeight: 600,
                  color: theme.palette.primary.main,
                  fontFamily: "var(--font-sans)",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                {getInitials(firstName, lastName)}
              </Typography>
            )}
          </Box>

          <UserName sx={{ fontSize: isMobile ? 13 : 15 }}>
            {isMobile ? firstName || "User" : userName || "User"}
          </UserName>
        </Box>

        <HeaderDivider />
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
              <Box
                sx={{
                  position: "relative",
                  width: isMobile ? 24 : 32,
                  height: isMobile ? 24 : 32,
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    userPhoto && !imageError
                      ? "transparent"
                      : theme.palette.primary.light,
                  flexShrink: 0,
                }}
              >
                {userPhoto && !imageError ? (
                  <Image
                    src={userPhoto as string}
                    alt="user"
                    width={isMobile ? 24 : 32}
                    height={isMobile ? 24 : 32}
                    style={{ borderRadius: "50%", objectFit: "cover" }}
                    draggable={false}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <Typography
                    sx={{
                      fontSize: isMobile ? "10px" : "12px",
                      fontWeight: 600,
                      color: theme.palette.primary.main,
                      fontFamily: "var(--font-sans)",
                      textTransform: "uppercase",
                      lineHeight: 1,
                    }}
                  >
                    {getInitials(firstName, lastName)}
                  </Typography>
                )}
              </Box>

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
            <MenuItemRow
              data-testid="user-menu-profile"
              onClick={() => {
                router.push("/profile");
                setAnchorEl(null);
              }}
              sx={{
                gap: "8px",
                justifyContent: "center",
                "&:hover": { background: "transparent" },
              }}
            >
              <PersonIcon sx={{ fontSize: "16px" }} />
              <Typography
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: isMobile ? "13px" : "15px",
                }}
              >
                {t("profile")}
              </Typography>
            </MenuItemRow>

            <MenuItemRow
              data-testid="user-menu-settings"
              onClick={() => {
                router.push("/profile");
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
