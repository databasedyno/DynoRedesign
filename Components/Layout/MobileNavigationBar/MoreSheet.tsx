import React, { useRef, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import Link from "next/link";
import i18n from "i18next";
import { useTranslation } from "react-i18next";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import BottomSheet from "@/Components/UI/BottomSheet";
import UserAvatar from "@/Components/UI/UserAvatar";
import ThemePreferenceControl from "@/Components/UI/ThemePreferenceControl";
import LanguageSwitcherModal from "@/Components/UI/MobileLanguageSwitcher";
import NavIcon from "@/Components/Layout/NewSidebar/NavIcon";
import { isNavPathActive, type SidebarSection } from "@/Components/Layout/NewSidebar/navSections";
import { LANGUAGES, languageFor } from "@/helpers/languages";
import { signOut } from "@/helpers/signOut";
import useDisplayIdentity from "@/hooks/useDisplayIdentity";
import useTokenData from "@/hooks/useTokenData";
import useAccountProfile from "@/hooks/useAccountProfile";
import useOnboardingStatus from "@/hooks/useOnboardingStatus";
import { useWalletData } from "@/hooks/useWalletData";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { SheetGroupLabel, SheetRow } from "./styled";

interface Props {
  open: boolean;
  onClose: () => void;
  sections: SidebarSection[];
  unread: number;
}

/** "More" (§8.1): the whole IA as a grouped vertical list + preferences, sign out and utility links. */
const MoreSheet: React.FC<Props> = ({ open, onClose, sections, unread }) => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const releaseRef = useRef<(() => void) | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const { name, photo } = useDisplayIdentity();
  const tokenData = useTokenData() as any;
  const { hasAccount, profileComplete, isIndividual, fetched } = useAccountProfile();
  const { kycRequired } = useOnboardingStatus();
  const { walletWarning } = useWalletData();
  const { isMember, can } = useCompanyStore();
  const secondary = theme.palette.text.secondary;

  const go = (path: string) => {
    releaseRef.current?.();
    onClose();
    router.replace(path);
  };

  const alerts = [
    kycRequired && { id: "kyc", label: t("requiredKYC"), path: "/kyc" },
    fetched && (!hasAccount || !profileComplete) && {
      id: "setup",
      label: !hasAccount
        ? t("companySetupWarning")
        : isIndividual
          ? t("accountSetupWarningIndividual", { defaultValue: "Add your country to finish setup" })
          : t("accountSetupWarningBusiness", { defaultValue: "Finish your business profile" }),
      path: hasAccount ? "/settings?section=company" : "/create-pay-link",
    },
    walletWarning && hasAccount && { id: "wallet", label: t("walletSetUpWarnnigTitle"), path: "/wallet" },
  ].filter(Boolean) as { id: string; label: string; path: string }[];

  const lang = languageFor(i18n.language || "en");
  const footer = [
    { href: "/system-status", label: t("footerStatus", { defaultValue: "Status" }) },
    { href: "/documentation", label: t("footerDocs", { defaultValue: "Docs" }) },
    { href: "/terms-conditions", label: t("footerTerms", { defaultValue: "Terms" }) },
    { href: "/privacy-policy", label: t("footerPrivacy", { defaultValue: "Privacy" }) },
  ];

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={t("navMore", { defaultValue: "More" })} closeLabel={t("navClose", { defaultValue: "Close" })} data-testid="mobile-more-sheet" onReleaseRef={releaseRef} keepMountedAfterOpen>
        <SheetRow type="button" data-testid="mobile-more-account" onClick={() => go("/settings?section=profile")} sx={{ py: 1.25 }}>
          <UserAvatar name={name} photo={photo} size={40} fontSize={15} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, color: theme.palette.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</Typography>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tokenData?.email || t("viewAccount")}</Typography>
          </Box>
          <ChevronRightRounded sx={{ color: secondary }} />
        </SheetRow>

        {alerts.length > 0 && (
          <Box data-testid="mobile-more-alerts" sx={{ mx: 2, mt: 1, borderRadius: "12px", overflow: "hidden", border: `1px solid ${theme.palette.error.main}33` }}>
            {alerts.map((a) => (
              <SheetRow key={a.id} type="button" data-testid={`mobile-more-alert-${a.id}`} onClick={() => go(a.path)} sx={{ color: theme.palette.error.main, fontSize: 14 }}>
                <ErrorOutlineRounded sx={{ fontSize: 20 }} />
                <span className="row-label">{a.label}</span>
                <ChevronRightRounded sx={{ fontSize: 20 }} />
              </SheetRow>
            ))}
          </Box>
        )}

        {sections.map((s) => (
          <Box key={s.key} component="section" data-testid={`mobile-more-group-${s.key}`}>
            <SheetGroupLabel>{s.label || t("navHome", { defaultValue: "Home" })}</SheetGroupLabel>
            {s.items.map((item) => {
              const on = isNavPathActive(router.pathname, item.path);
              const denied = !!(isMember && item.permission && !can(item.permission));
              return (
                <SheetRow
                  key={item.path}
                  type="button"
                  active={on}
                  disabled={denied}
                  aria-current={on ? "page" : undefined}
                  data-testid={`mobile-nav-${item.icon}`}
                  onClick={() => go(item.path)}
                  sx={denied ? { opacity: 0.45 } : undefined}
                >
                  <NavIcon name={item.icon} color={on ? theme.palette.text.primary : secondary} />
                  <span className="row-label">{item.label}</span>
                </SheetRow>
              );
            })}
          </Box>
        ))}

        <SheetGroupLabel>{t("preferences", { defaultValue: "Preferences" })}</SheetGroupLabel>
        <SheetRow type="button" data-testid="mobile-nav-notifications" active={router.pathname === "/notifications"} onClick={() => go("/notifications")}>
          <NavIcon name="bell" color={secondary} />
          <span className="row-label">{t("notifications")}</span>
          {unread > 0 && (
            <Box data-testid="mobile-nav-notifications-badge" sx={{ minWidth: 22, height: 22, px: 0.75, borderRadius: 999, display: "grid", placeItems: "center", backgroundColor: "#E11D48", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {unread > 99 ? "99+" : unread}
            </Box>
          )}
        </SheetRow>
        <SheetRow type="button" data-testid="mobile-nav-language" onClick={() => { onClose(); setLangOpen(true); }}>
          <NavIcon name="language" color={secondary} />
          <span className="row-label">{t("language")}</span>
          <Typography component="span" sx={{ fontFamily: "var(--font-sans)", fontSize: 14, color: secondary }}>{lang.name}</Typography>
        </SheetRow>
        <SheetRow type="button" data-testid="mobile-nav-support-chat" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("dynopay:open-support-chat")); }}>
          <NavIcon name="chat" color={secondary} />
          <span className="row-label">{t("chatWithSupport", { defaultValue: "Chat with support" })}</span>
        </SheetRow>
        <Box sx={{ px: 2, pt: 1, pb: 1 }}>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: secondary, mb: 0.75 }}>{t("appearance", { defaultValue: "Appearance" })}</Typography>
          <ThemePreferenceControl testId="mobile-more-theme" />
        </Box>
        <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, mt: 1 }}>
          <SheetRow type="button" tone="danger" data-testid="mobile-more-signout" onClick={signOut}>
            <LogoutRounded sx={{ fontSize: 20 }} />
            <span className="row-label">{t("logout")}</span>
          </SheetRow>
        </Box>
        <Box component="nav" aria-label={t("footerLinks", { defaultValue: "Utility links" })} data-testid="mobile-more-footer" sx={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", px: 2, pt: 1, pb: 2 }}>
          {footer.map((f) => (
            <Box key={f.href} component={Link} href={f.href} target="_blank" rel="noopener" sx={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: "32px", color: secondary, textDecoration: "none" }}>
              {f.label}
            </Box>
          ))}
        </Box>
      </BottomSheet>
      <LanguageSwitcherModal
        open={langOpen}
        languages={LANGUAGES.map((l) => ({ code: l.code, label: l.name, flag: l.flag }))}
        currentLanguage={i18n.language || "en"}
        onSelect={async (code: string) => {
          const { setAppLanguage } = await import("@/helpers/setAppLanguage");
          await setAppLanguage(code);
        }}
        onClose={() => setLangOpen(false)}
      />
    </>
  );
};

export default MoreSheet;
