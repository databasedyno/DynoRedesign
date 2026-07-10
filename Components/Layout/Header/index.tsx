import { useRef, useState } from "react";
import {
  Box,
  Typography,
  AppBar,
  IconButton,
  Toolbar,
  Divider,
  Drawer,
  useTheme,
  Popover,
  List,
  ListItem,
  ListItemButton,
  Button,
  Tooltip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import User from "@/assets/Images/user_image.png";

import { useSelector, useDispatch } from "react-redux";
import useWindow from "@/hooks/useWindow";
import useTokenData from "@/hooks/useTokenData";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import SideBar from "@/Components/Layout/Sidebar";
import { drawerWidth } from "@/styles/theme";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";

interface HeaderProps {
  pageName: string;
  component?: any;
}

const Header = ({ pageName, component }: HeaderProps) => {
  /**
   *
   * Initializations
   *
   */

  const dispatch = useDispatch();
  const theme = useTheme();
  const router = useRouter();
  const customWindow = useWindow();
  const menuRef = useRef<HTMLElement | null>(null);
  const menuRef2 = useRef<HTMLElement | null>(null);
  const tokenData = useTokenData();
  const { t } = useTranslation("common");

  const rawPhoto = tokenData?.photo || "";
  const userPhotoSrc = rawPhoto && !rawPhoto.startsWith("/") && !rawPhoto.startsWith("http") && !rawPhoto.startsWith("blob:") ? `/${rawPhoto}` : rawPhoto;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const [notificationAnchorEl, setNotificationAnchorEl] =
    useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  /**
   *
   * Handlers
   *
   */

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState);
  };

  const handlePopupMenu = () => {
    setOpen(true);
    setAnchorEl(menuRef.current);
  };

  const handlePopupMenu2 = () => {
    setOpen(true);
    setAnchorEl(menuRef2.current);
  };

  const handleLogout = () => {
    if (customWindow) {
      customWindow.localStorage.removeItem("token");
      customWindow.localStorage.removeItem("refreshToken");
      customWindow.location.replace("/auth/login");
    }
  };

  return (
    <>
      <AppBar
        component="nav"
        position="fixed"
        sx={{
          top: 0,
          zIndex: 999,
          width: { lg: `calc(100vw - ${drawerWidth}px)`, xs: "100vw" },
          boxShadow: "none",
          background: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.border?.main || (theme.palette.mode === "dark" ? "#2A2D42" : "#EAEAEA")}`,
        }}
      >
        <Toolbar sx={{ display: { sm: "flex", xs: "none" } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { lg: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{ fontSize: "20px", fontWeight: 500, whiteSpace: "nowrap", fontFamily: "var(--font-hero), var(--font-sans)", letterSpacing: "-0.01em" }}
          >
            {pageName ?? ""}
          </Typography>
          <Box
            sx={{
              ml: 3,
              display: "flex",
              alignItems: "center",
              gap: 2,
              marginLeft: "auto",
            }}
          >
            <LanguageSwitcher />
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Box
                ref={menuRef}
                sx={{
                  mx: 0.5,
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  p: 1.5,
                  transition: "0.2s",
                  "& img": {
                    width: "45px",
                    height: "45px",
                    borderRadius: "100%",
                    objectFit: "cover",
                  },
                  "&:hover": {
                    background: theme.palette.action?.hover || (theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#f8f8f8"),
                  },
                }}
                onClick={handlePopupMenu}
              >
                {/* eslint-disable-next-line */}
                <img
                  src={userPhotoSrc || User.src}
                  alt="no user"
                  crossOrigin="anonymous"
                />
              </Box>
            </Box>
          </Box>
        </Toolbar>

        <Box
          area-label="For mobile only"
          sx={{
            display: { sm: "none", xs: "block" },
          }}
        >
          <Toolbar
            sx={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { lg: "none" } }}
            >
              <MenuIcon />
            </IconButton>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <LanguageSwitcher />
              <Box
                ref={menuRef2}
                sx={{
                  mx: 0.5,
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  p: 1.5,
                  transition: "0.2s",
                  "& img": {
                    width: "45px",
                    height: "45px",
                    borderRadius: "100%",
                    objectFit: "cover",
                  },
                  "&:hover": {
                    background: theme.palette.action?.hover || (theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#f8f8f8"),
                  },
                }}
                onClick={handlePopupMenu2}
              >
                {/* eslint-disable-next-line */}
                <img
                  src={userPhotoSrc || User.src}
                  alt="no user"
                  crossOrigin="anonymous"
                />
              </Box>
            </Box>
          </Toolbar>
          <Divider />
          <Box
            sx={{
              py: 1,
              px: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              variant="h6"
              component="div"
              sx={{ fontSize: "20px", fontWeight: 500, fontFamily: "var(--font-hero), var(--font-sans)", letterSpacing: "-0.01em" }}
            >
              {pageName ?? ""}
            </Typography>
            <Box>{t("hello")}</Box>
          </Box>
        </Box>
      </AppBar>
      <Box
        component="nav"
        sx={{
          "& *": {
            color: theme.palette.primary.main,
          },
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", lg: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth * 4,
              background: theme.palette.primary.main,
              "&::-webkit-scrollbar": {
                width: 0,
              },
            },
          }}
        >
          <SideBar handleDrawerToggle={handleDrawerToggle} />
        </Drawer>
      </Box>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => {
          setOpen(false);
          setAnchorEl(null);
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        sx={{
          "& .MuiPaper-root": {
            borderRadius: "10px",
          },
        }}
      >
        <List sx={{ minWidth: "164px", textAlign: "center" }}>
          <ListItem
            sx={{
              flexDirection: "column",
              px: 2,
              py: 1.25,
              alignItems: "flex-start",
            }}
          >
            <Typography sx={{ fontSize: "14px" }}>{tokenData?.name}</Typography>
            <Typography sx={{ fontSize: "11px", color: "text.disabled" }}>
              {tokenData?.email}
            </Typography>
          </ListItem>
          <Divider />
          <ListItem sx={{ p: 0 }}>
            <ListItemButton
              onClick={() => {
                setOpen(false);
                setAnchorEl(null);
                router.push("/profile");
              }}
            >
              {t("myProfile")}
            </ListItemButton>
          </ListItem>
          <ListItem sx={{ p: 0 }}>
            <ListItemButton
              sx={{ color: (theme) => theme.palette.error.main }}
              onClick={handleLogout}
            >
              {t("logout")}
            </ListItemButton>
          </ListItem>
        </List>
      </Popover>
    </>
  );
};

export default Header;
