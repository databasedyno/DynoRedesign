import { Box, Divider, Popover, Typography, useTheme } from "@mui/material";
import React, { useRef, useState } from "react";
import { UserTrigger } from "./styled";
import UserAvatar from "@/Components/UI/UserAvatar";
import BottomSheet from "@/Components/UI/BottomSheet";
import ThemePreferenceControl from "@/Components/UI/ThemePreferenceControl";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import { buildCreatorUrl } from "@/helpers/creatorUrl";
import { signOut } from "@/helpers/signOut";
import useDisplayIdentity from "@/hooks/useDisplayIdentity";
import useTokenData from "@/hooks/useTokenData";
import useAccountProfile from "@/hooks/useAccountProfile";
import useShellMode from "@/hooks/useShellMode";
import useBackToClose from "@/hooks/useBackToClose";
import { useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import { brandFg } from "@/constants/theme";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import TranslateRounded from "@mui/icons-material/TranslateRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import CardGiftcardRounded from "@mui/icons-material/CardGiftcardRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

type Row = { id: string; label: string; icon: React.ReactNode; onClick: () => void; external?: boolean; tone?: "danger" };

/** Account menu (§8.8): identity header, left-aligned 44px rows, one Appearance control, anchored below the trigger. */
export default function UserMenu({ onboarding = false }: { onboarding?: boolean }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { isPhone } = useShellMode();
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const sheetReleaseRef = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const popRelease = useBackToClose(open && !isPhone, close, "user-menu");
  const { name: userName, photo: userPhoto } = useDisplayIdentity();
  const tokenData = useTokenData() as any;
  const { account, hasAccount, profileComplete, isIndividual, fetched } = useAccountProfile();
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;
  const creatorHandle = profile?.handle && profile?.creator_page_enabled ? String(profile.handle) : "";
  const creatorPublicUrl = buildCreatorUrl(creatorHandle);
  const showSetupWarning = !onboarding && fetched && (!hasAccount || !profileComplete);
  const setupHref = hasAccount ? "/settings?section=company" : "/create-pay-link";
  const setupLabel = !hasAccount
    ? t("companySetupWarning")
    : isIndividual
      ? t("accountSetupWarningIndividual", { defaultValue: "Add your country to finish setup" })
      : t("accountSetupWarningBusiness", { defaultValue: "Finish your business profile" });

  const go = (path: string) => {
    if (isPhone) sheetReleaseRef.current?.();
    else popRelease();
    close();
    router.replace(path);
  };
  const iconSx = { fontSize: 20, color: theme.palette.text.secondary };
  const rows: Row[] = onboarding
    ? []
    : [
        {
          id: "creator",
          label: creatorHandle ? t("userMenuViewCreator", { defaultValue: "View my creator page" }) : t("userMenuClaimCreator", { defaultValue: "Claim my creator page" }),
          icon: <AutoAwesomeRounded sx={iconSx} />,
          external: !!creatorPublicUrl,
          onClick: () => (creatorPublicUrl ? (window.open(creatorPublicUrl, "_blank", "noopener"), close()) : go("/storefront?tab=page")),
        },
        { id: "settings", label: t("settings"), icon: <SettingsRounded sx={iconSx} />, onClick: () => go("/settings") },
        { id: "help", label: t("common:helpSupport", { defaultValue: "Help & Support" }), icon: <HelpOutlineRounded sx={iconSx} />, onClick: () => go("/help-support") },
        { id: "referrals", label: t("common:referAndEarn", { defaultValue: "Refer & earn" }), icon: <CardGiftcardRounded sx={iconSx} />, onClick: () => go("/referrals") },
      ];

  const rowSx = {
    all: "unset",
    boxSizing: "border-box",
    width: "100%",
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    px: 2,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: theme.palette.text.primary,
    transition: "background-color 140ms ease",
    "&:hover, &:focus-visible": { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.04)" },
    "&:focus-visible": { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: "-2px" },
  } as const;

  const body = (
    <Box data-testid="user-menu" role="menu" aria-label={userName} sx={{ py: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, pt: 1, pb: 1.5 }}>
        <UserAvatar name={userName} photo={userPhoto} size={40} fontSize={15} data-testid="user-menu-dropdown-avatar" />
        <Box sx={{ minWidth: 0 }}>
          <Typography data-testid="user-menu-name" sx={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, color: theme.palette.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName || "User"}
          </Typography>
          {tokenData?.email && (
            <Typography data-testid="user-menu-email" sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tokenData.email}
            </Typography>
          )}
          {account?.company_name && (
            <Typography data-testid="user-menu-brand" sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: theme.palette.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t("userMenuBrand", { defaultValue: "Brand" })}: {account.company_name}
            </Typography>
          )}
        </Box>
      </Box>
      {showSetupWarning && (
        <Box component="button" type="button" role="menuitem" data-testid="user-menu-setup-warning" onClick={() => go(setupHref)} sx={{ ...rowSx, color: brandFg(isDark), fontWeight: 600, backgroundColor: theme.palette.primary.light }}>
          <InfoOutlinedIcon sx={{ fontSize: 20, color: brandFg(isDark) }} />
          {setupLabel}
        </Box>
      )}
      {rows.length > 0 && <Divider sx={{ my: 0.5 }} />}
      {rows.map((r) => (
        <Box key={r.id} component="button" type="button" role="menuitem" data-testid={`user-menu-${r.id}`} onClick={r.onClick} sx={rowSx}>
          {r.icon}
          <Box component="span" sx={{ flex: 1, textAlign: "left" }}>{r.label}</Box>
          {r.external && <OpenInNewRounded sx={{ fontSize: 16, color: theme.palette.text.secondary }} />}
        </Box>
      ))}
      <Divider sx={{ my: 0.5 }} />
      <Box sx={{ px: 2, py: 1 }}>
        <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.text.secondary, mb: 0.75 }}>
          {t("appearance", { defaultValue: "Appearance" })}
        </Typography>
        <ThemePreferenceControl testId="user-menu-theme" />
      </Box>
      <Box data-testid="user-menu-language" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 2, minHeight: 44 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <TranslateRounded sx={iconSx} />
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14, color: theme.palette.text.primary }}>
            {t("userMenuLanguage", { defaultValue: "Language" })}
          </Typography>
        </Box>
        <LanguageSwitcher />
      </Box>
      <Divider sx={{ my: 0.5 }} />
      <Box component="button" type="button" role="menuitem" data-testid="user-menu-logout" onClick={signOut} sx={{ ...rowSx, color: theme.palette.error.main }}>
        <LogoutRounded sx={{ fontSize: 20 }} />
        {t("logout")}
      </Box>
    </Box>
  );

  return (
    <>
      <UserTrigger
        ref={triggerRef}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={userName}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        data-testid="user-menu-trigger"
        sx={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
      >
        <UserAvatar name={userName} photo={userPhoto} size={32} fontSize={12} data-testid="user-menu-avatar" />
        <ExpandMoreIcon fontSize="small" sx={{ color: theme.palette.text.secondary, display: { xs: "none", sm: "block" }, transition: "transform 160ms ease", transform: open ? "rotate(180deg)" : "none" }} />
      </UserTrigger>
      {isPhone ? (
        <BottomSheet open={open} onClose={close} closeLabel={t("navClose", { defaultValue: "Close" })} data-testid="user-menu-sheet" onReleaseRef={sheetReleaseRef} title={t("account", { defaultValue: "Account" })}>
          {body}
        </BottomSheet>
      ) : (
        <Popover
          open={open}
          anchorEl={triggerRef.current}
          onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { mt: 1, width: 300, borderRadius: "12px", border: `1px solid ${theme.palette.border?.main || theme.palette.divider}`, backgroundImage: "none", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" } } }}
        >
          {body}
        </Popover>
      )}
    </>
  );
}
