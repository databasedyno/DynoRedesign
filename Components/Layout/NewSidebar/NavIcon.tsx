import React from "react";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import GridViewRounded from "@mui/icons-material/GridViewRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import HandshakeRounded from "@mui/icons-material/HandshakeRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import TranslateRounded from "@mui/icons-material/TranslateRounded";
import SidebarIcon from "@/utils/customIcons/sidebar-icons";

const MUI_ICONS: Record<string, React.ElementType> = {
  settings: SettingsRounded,
  creator: AutoAwesomeRounded,
  brands: GridViewRounded,
  help: HelpOutlineRounded,
  escrow: HandshakeRounded,
  grow: TrendingUpRounded,
  chat: ChatBubbleOutlineRounded,
  bell: NotificationsNoneRounded,
  language: TranslateRounded,
};

/** One icon renderer for every nav presentation (sidebar, rail, phone tab bar, More sheet). */
const NavIcon: React.FC<{ name: string; color: string; size?: number }> = ({ name, color, size = 20 }) => {
  const Mui = MUI_ICONS[name];
  // Fixed box so every label in a list starts at the same x, whatever the glyph's own size.
  return (
    <span aria-hidden style={{ width: size, height: size, display: "inline-grid", placeItems: "center", flexShrink: 0, overflow: "visible" }}>
      {Mui ? <Mui sx={{ fontSize: size, color }} /> : <SidebarIcon name={name} size={name === "customers" ? size + 4 : size} color={color} />}
    </span>
  );
};

export default NavIcon;
