import React, { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, MenuItem, Select, Typography, useTheme } from "@mui/material";
import {
  PersonRounded,
  BusinessRounded,
  CurrencyExchangeRounded,
  WebhookRounded,
  VpnKeyRounded,
  NotificationsRounded,
  AddRounded,
  StarRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import Head from "next/head";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

import ProfilePage from "@/Components/Page/Profile/ProfilePage";
import ApiKeysPage from "@/Components/Page/API/ApiKeysPage";
import NotificationPage from "@/Components/Page/Notification/NotificationPage";
import CreatorPageSettings from "@/Components/Page/Creator/CreatorPageSettings";
import CompanySettingsDialog from "@/Components/UI/CompanySettingsDialog";
import CreateCompanyModal from "@/Components/UI/OnboardingFlow/CreateCompanyModal";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import useTokenData from "@/hooks/useTokenData";
import { UserAction, CompanyAction } from "@/Redux/Actions";
import { USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { ICompany, pageProps, rootReducer } from "@/utils/types";

type SectionKey =
  | "profile"
  | "creator"
  | "company"
  | "payments"
  | "webhooks"
  | "api-keys"
  | "notifications";

const SECTION_KEYS: SectionKey[] = [
  "profile",
  "creator",
  "company",
  "payments",
  "webhooks",
  "api-keys",
  "notifications",
];

/** Legacy ?tab= values (pre-redesign launcher) → new sections */
const LEGACY_TAB_MAP: Record<string, SectionKey> = {
  business: "company",
  technical: "api-keys",
  personal: "profile",
};

/* ------------------------------------------------------------------ */
/* Profile & Security — mirrors pages/profile.tsx wiring               */
/* ------------------------------------------------------------------ */
const ProfileSection = () => {
  const dispatch = useDispatch();
  const tokenData = useTokenData();
  const userState = useSelector((state: rootReducer) => state.userReducer);
  const profile = userState.profile;

  useEffect(() => {
    dispatch(UserAction(USER_PROFILE_FETCH));
  }, [dispatch]);

  const mergedTokenData = tokenData
    ? {
        ...tokenData,
        ...(profile?.name && { name: profile.name }),
        ...(profile?.email && { email: profile.email }),
        ...(profile?.mobile && { mobile: profile.mobile }),
        ...(profile?.photo && { photo: profile.photo }),
      }
    : undefined;

  return <>{mergedTokenData && <ProfilePage tokenData={mergedTokenData} />}</>;
};

/* ------------------------------------------------------------------ */
/* Company / Payments / Webhooks — inline CompanySettingsDialog        */
/* ------------------------------------------------------------------ */
const CompanyConfigSection = ({
  visibleSections,
  allowAdd,
}: {
  visibleSections: Array<"company" | "crypto" | "webhook" | "payment">;
  allowAdd?: boolean;
}) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation("common");
  const companyState = useSelector((state: rootReducer) => state.companyReducer);
  const companies: ICompany[] = companyState?.companyList || [];
  const globalSelectedId = (companyState as any)?.selectedCompanyId;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    dispatch(CompanyAction(COMPANY_FETCH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick default company: globally selected one, else the first
  useEffect(() => {
    if (companies.length > 0 && (selectedId === null || !companies.some((c) => c.company_id === selectedId))) {
      const preferred = companies.find((c) => c.company_id === globalSelectedId);
      setSelectedId((preferred || companies[0]).company_id);
    }
  }, [companies, globalSelectedId, selectedId]);

  const selectedCompany = companies.find((c) => c.company_id === selectedId) || null;
  const isLoading = companyState?.loading && !companyState?.fetched && companies.length === 0;

  if (isLoading) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} sx={{ color: theme.palette.primary.main }} />
      </Box>
    );
  }

  if (companies.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          py: 8,
          gap: 2,
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "16px",
            bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "#F6F7F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BusinessRounded sx={{ fontSize: 28, color: theme.palette.text.disabled }} />
        </Box>
        <Typography sx={{ fontSize: 14, color: theme.palette.text.secondary, maxWidth: 380, fontFamily: "var(--font-sans)" }}>
          {t("settingsPage.noCompanies")}
        </Typography>
        <CustomButton
          label={t("settingsPage.addCompany")}
          variant="primary"
          size="small"
          endIcon={<AddRounded sx={{ fontSize: 18 }} />}
          onClick={() => setAddOpen(true)}
        />
        <CreateCompanyModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSuccess={() => setAddOpen(false)}
          showStepIndicator={false}
        />
      </Box>
    );
  }

  return (
    <Box>
      {/* Company picker + add button */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        {companies.length > 1 ? (
          <Select
            value={selectedId ?? ""}
            size="small"
            data-testid="settings-company-picker"
            onChange={(e) => setSelectedId(Number(e.target.value))}
            sx={{
              minWidth: 220,
              borderRadius: "10px",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "#E9ECF2",
              },
            }}
          >
            {companies.map((c) => (
              <MenuItem key={c.company_id} value={c.company_id} sx={{ fontFamily: "var(--font-sans)", fontSize: 14 }}>
                {c.company_name}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
            {selectedCompany?.company_name}
          </Typography>
        )}
        {allowAdd && (
          <CustomButton
            label={t("settingsPage.addCompany")}
            variant="outlined"
            size="small"
            endIcon={<AddRounded sx={{ fontSize: 17 }} />}
            onClick={() => setAddOpen(true)}
            data-testid="settings-add-company-btn"
          />
        )}
      </Box>

      {selectedCompany && (
        <CompanySettingsDialog
          inline
          visibleSections={visibleSections}
          open
          company={selectedCompany}
          onClose={() => {
            dispatch(CompanyAction(COMPANY_FETCH));
          }}
        />
      )}

      <CreateCompanyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => setAddOpen(false)}
        showStepIndicator={false}
      />
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* API Keys — mirrors pages/developer-keys.tsx wiring                  */
/* ------------------------------------------------------------------ */
const ApiKeysSection = () => {
  const { t } = useTranslation(["apiScreen", "common"]);
  const [openCreate, setOpenCreate] = useState(false);
  const apiState = useSelector((state: any) => state?.apiReducer);
  const hasExistingKey = Array.isArray(apiState?.apiList) && apiState.apiList.length > 0;

  return (
    <Box>
      {!hasExistingKey && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <CustomButton
            label={t("createNewKey", { ns: "apiScreen", defaultValue: "Create new key" })}
            variant="primary"
            size="small"
            endIcon={<AddRounded sx={{ fontSize: 18 }} />}
            onClick={() => setOpenCreate(true)}
            data-testid="settings-create-api-key-btn"
          />
        </Box>
      )}
      <ApiKeysPage openCreate={openCreate} setOpenCreate={setOpenCreate} />
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Settings page                                                       */
/* ------------------------------------------------------------------ */
const SettingsPage = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("common");
  const isDark = theme.palette.mode === "dark";

  useEffect(() => {
    setPageName?.(t("settingsPage.title"));
    setPageDescription?.(t("settingsPage.description"));
    setPageAction?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const sections = useMemo(
    () => [
      {
        key: "profile" as SectionKey,
        label: t("settingsPage.profile"),
        description: t("settingsPage.profileDesc"),
        icon: <PersonRounded sx={{ fontSize: 19 }} />,
      },
      {
        key: "creator" as SectionKey,
        label: t("settingsPage.creator", { defaultValue: "Creator page" }),
        description: t("settingsPage.creatorDesc", { defaultValue: "Your public dynopay.com/handle page — bio, links & donations." }),
        icon: <StarRounded sx={{ fontSize: 19 }} />,
      },
      {
        key: "company" as SectionKey,
        label: t("settingsPage.company"),
        description: t("settingsPage.companyDesc"),
        icon: <BusinessRounded sx={{ fontSize: 19 }} />,
      },
      {
        key: "payments" as SectionKey,
        label: t("settingsPage.payments"),
        description: t("settingsPage.paymentsDesc"),
        icon: <CurrencyExchangeRounded sx={{ fontSize: 19 }} />,
      },
      {
        key: "webhooks" as SectionKey,
        label: t("settingsPage.webhooks"),
        description: t("settingsPage.webhooksDesc"),
        icon: <WebhookRounded sx={{ fontSize: 19 }} />,
      },
      {
        key: "api-keys" as SectionKey,
        label: t("settingsPage.apiKeys"),
        description: t("settingsPage.apiKeysDesc"),
        icon: <VpnKeyRounded sx={{ fontSize: 19 }} />,
      },
      {
        key: "notifications" as SectionKey,
        label: t("settingsPage.notifications"),
        description: t("settingsPage.notificationsDesc"),
        icon: <NotificationsRounded sx={{ fontSize: 19 }} />,
      },
    ],
    [t],
  );

  const resolveInitialSection = (): SectionKey => {
    const rawSection = String(router.query.section || "").toLowerCase();
    if (SECTION_KEYS.includes(rawSection as SectionKey)) return rawSection as SectionKey;
    const rawTab = String(router.query.tab || "").toLowerCase();
    if (LEGACY_TAB_MAP[rawTab]) return LEGACY_TAB_MAP[rawTab];
    return "profile";
  };

  const [active, setActive] = useState<SectionKey>(resolveInitialSection());

  // Sync from URL (back/forward navigation, external links)
  useEffect(() => {
    if (!router.isReady) return;
    const resolved = resolveInitialSection();
    if (resolved !== active) setActive(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.section, router.query.tab, router.isReady]);

  const selectSection = (key: SectionKey) => {
    setActive(key);
    router.replace(
      { pathname: router.pathname, query: { section: key } },
      undefined,
      { shallow: true },
    );
  };

  const activeMeta = sections.find((s) => s.key === active) || sections[0];

  const railItemSx = (isActive: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 1.25,
    px: "14px",
    py: "10px",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "background-color 0.15s ease, color 0.15s ease",
    bgcolor: isActive ? (isDark ? "rgba(255,255,255,0.1)" : "#111214") : "transparent",
    color: isActive
      ? (isDark ? theme.palette.text.primary : "#FFFFFF")
      : theme.palette.text.secondary,
    "&:hover": {
      bgcolor: isActive
        ? (isDark ? "rgba(255,255,255,0.1)" : "#111214")
        : (isDark ? "rgba(255,255,255,0.05)" : "#F1F2F5"),
    },
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  });

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Box
        sx={{
          px: { xs: 2, md: 0 },
          py: { xs: 1, md: 0 },
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: { xs: 2, md: 4 },
          alignItems: "flex-start",
        }}
      >
        {/* Settings navigation rail */}
        <Box
          sx={{
            width: { xs: "100%", md: 248 },
            flexShrink: 0,
            position: { md: "sticky" },
            top: { md: 16 },
            display: "flex",
            flexDirection: { xs: "row", md: "column" },
            gap: "4px",
            overflowX: { xs: "auto", md: "visible" },
            pb: { xs: 0.5, md: 0 },
            "&::-webkit-scrollbar": { display: "none" },
          }}
          data-testid="settings-rail"
        >
          {sections.map((s) => {
            const isActive = s.key === active;
            return (
              <Box
                key={s.key}
                role="button"
                tabIndex={0}
                data-testid={`settings-rail-${s.key}`}
                onClick={() => selectSection(s.key)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectSection(s.key);
                  }
                }}
                sx={railItemSx(isActive)}
              >
                {s.icon}
                <Typography
                  sx={{
                    fontSize: "14px",
                    fontWeight: isActive ? 600 : 500,
                    fontFamily: "var(--font-sans)",
                    color: "inherit",
                    lineHeight: 1,
                  }}
                >
                  {s.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Section content */}
        <Box sx={{ flex: 1, minWidth: 0, width: "100%", maxWidth: "860px" }}>
          <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
            <Typography
              sx={{
                fontSize: { xs: "17px", md: "19px" },
                fontWeight: 700,
                color: theme.palette.text.primary,
                fontFamily: "var(--font-sans)",
                mb: 0.25,
              }}
              data-testid="settings-section-title"
            >
              {activeMeta.label}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "12.5px", md: "13.5px" },
                color: theme.palette.text.secondary,
                fontFamily: "var(--font-sans)",
              }}
            >
              {activeMeta.description}
            </Typography>
          </Box>

          {active === "profile" && <ProfileSection />}
          {active === "creator" && <CreatorPageSettings />}
          {active === "company" && (
            <CompanyConfigSection visibleSections={["company"]} allowAdd />
          )}
          {active === "payments" && (
            <CompanyConfigSection visibleSections={["crypto", "payment"]} />
          )}
          {active === "webhooks" && (
            <CompanyConfigSection visibleSections={["webhook"]} />
          )}
          {active === "api-keys" && <ApiKeysSection />}
          {active === "notifications" && <NotificationPage />}
        </Box>
      </Box>
    </>
  );
};

export default SettingsPage;
