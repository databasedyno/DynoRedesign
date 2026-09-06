import { brandFg } from "@/constants/theme";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import React, { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, MenuItem, Select, Typography, useTheme } from "@mui/material";
import {
  PersonRounded,
  BusinessRounded,
  CurrencyExchangeRounded,
  NotificationsRounded,
  AddRounded,
  ReceiptLongRounded,
  GroupAddRounded,
  PercentRounded,
  CodeRounded,
  ArrowOutwardRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

import DisplayCurrencySelector from "@/Components/UI/DisplayCurrencySelector";
import UserDisplayCurrencySelector from "@/Components/UI/UserDisplayCurrencySelector";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import useEdgeFade from "@/hooks/useEdgeFade";
import useTokenData from "@/hooks/useTokenData";
import useAccountProfile from "@/hooks/useAccountProfile";
import { UserAction } from "@/Redux/Actions";
import { USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { ICompany, pageProps, rootReducer } from "@/utils/types";

/* ------------------------------------------------------------------ */
/* Code-splitting                                                      */
/*                                                                     */
/* Every section used to be imported eagerly, which is why /settings   */
/* shipped 3.15 MB of first-load JS — the heaviest route in the app by  */
/* a factor of ~7 (the shared baseline is 458 kB). A merchant opening   */
/* "Profile" was downloading the API-keys, notifications, tax and       */
/* company-settings trees as well.                                     */
/*                                                                     */
/* Each panel is now its own chunk, fetched only when that section is   */
/* actually opened. ssr:false because these are authenticated,          */
/* client-only panels — nothing here is ever server-rendered or         */
/* indexed, so there is no SEO or hydration cost.                       */
/* ------------------------------------------------------------------ */
const SectionLoading = () => (
  <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
    <CircularProgress size={28} />
  </Box>
);

const ProfilePage = dynamic(() => import("@/Components/Page/Profile/ProfilePage"), {
  ssr: false,
  loading: () => <SectionLoading />,
});
const NotificationPage = dynamic(() => import("@/Components/Page/Notification/NotificationPage"), {
  ssr: false,
  loading: () => <SectionLoading />,
});
const TaxSettingsSection = dynamic(() => import("@/Components/Page/Settings/TaxSettingsSection"), {
  ssr: false,
  loading: () => <SectionLoading />,
});
const TeamSettingsSection = dynamic(() => import("@/Components/Page/Settings/TeamSettingsSection"), {
  ssr: false,
  loading: () => <SectionLoading />,
});
const PlanFeesSection = dynamic(() => import("@/Components/Page/Settings/PlanFeesSection"), {
  ssr: false,
  loading: () => <SectionLoading />,
});
const CompanySettingsDialog = dynamic(() => import("@/Components/UI/CompanySettingsDialog"), {
  ssr: false,
  loading: () => <SectionLoading />,
});
// Only mounted while the modal is actually open (see usages), so its chunk is
// never downloaded by a merchant who doesn't add a company.
const CreateCompanyModal = dynamic(
  () => import("@/Components/UI/OnboardingFlow/CreateCompanyModal"),
  { ssr: false },
);

type SectionKey =
  | "profile"
  | "company"
  | "payments"
  | "tax"
  | "notifications"
  | "team"
  | "plan";

const SECTION_KEYS: SectionKey[] = [
  "profile",
  "company",
  "payments",
  "plan",
  "tax",
  "notifications",
  "team",
];

/** Legacy ?tab= values (pre-redesign launcher) → new sections.
 *  "technical" used to open the in-Settings API keys panel — that panel moved
 *  to /developer-keys (Batch B / N4), handled by the redirect effect below. */
const LEGACY_TAB_MAP: Record<string, SectionKey> = {
  business: "company",
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
  showDisplayCurrency,
}: {
  visibleSections: Array<"company" | "crypto" | "webhook" | "payment">;
  allowAdd?: boolean;
  showDisplayCurrency?: boolean;
}) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation("common");
  const companyState = useCompanyStore();
  const companies: ICompany[] = companyState?.companyList || [];
  const globalSelectedId = (companyState as any)?.selectedCompanyId;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    companyState.refetchCompanies();
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
        <CircularProgress size={28} sx={{ color: brandFg(theme.palette.mode === "dark") }} />
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
        {addOpen && (
          <CreateCompanyModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onSuccess={() => setAddOpen(false)}
            showStepIndicator={false}
          />
        )}
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

      {showDisplayCurrency && selectedId && (
        <>
          <UserDisplayCurrencySelector />
          <DisplayCurrencySelector companyId={selectedId} />
        </>
      )}

      {selectedCompany && (
        <CompanySettingsDialog
          inline
          visibleSections={visibleSections}
          open
          company={selectedCompany}
          onClose={() => {
            companyState.refetchCompanies();
          }}
        />
      )}

      {addOpen && (
        <CreateCompanyModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSuccess={() => setAddOpen(false)}
          showStepIndicator={false}
        />
      )}
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

  const { isIndividual } = useAccountProfile();

  const sections = useMemo(
    () => [
      {
        key: "profile" as SectionKey,
        label: t("settingsPage.profile"),
        description: t("settingsPage.profileDesc"),
        icon: <PersonRounded sx={{ fontSize: 19 }} />,
        scope: "account" as const,
      },
      {
        // F11: "Company" is the wrong word for an individual creator — the
        // section is now "Account details" and the copy switches on account_type.
        key: "company" as SectionKey,
        label: t("settingsPage.accountDetails", { defaultValue: "Account details" }),
        description: isIndividual
          ? t("settingsPage.accountDetailsDescIndividual", {
              defaultValue: "Your public name, logo, and account information",
            })
          : t("settingsPage.accountDetailsDesc", {
              defaultValue: "Business profile, logo, and company details",
            }),
        icon: <BusinessRounded sx={{ fontSize: 19 }} />,
        scope: "company" as const,
      },
      {
        key: "payments" as SectionKey,
        label: t("settingsPage.payments"),
        description: t("settingsPage.paymentsDesc"),
        icon: <CurrencyExchangeRounded sx={{ fontSize: 19 }} />,
        scope: "company" as const,
      },
      {
        key: "plan" as SectionKey,
        label: t("settingsPage.planFees", { defaultValue: "Plan & fees" }),
        description: t("settingsPage.planFeesDesc", {
          defaultValue: "Your current fee tier, what each payment costs, and how to unlock lower rates.",
        }),
        icon: <PercentRounded sx={{ fontSize: 19 }} />,
        scope: "account" as const,
      },
      {
        key: "tax" as SectionKey,
        label: t("settingsPage.tax", { defaultValue: "Tax" }),
        description: t("settingsPage.taxDesc", {
          defaultValue: "Default VAT/tax behavior for checkouts and payment links.",
        }),
        icon: <ReceiptLongRounded sx={{ fontSize: 19 }} />,
        scope: "company" as const,
      },
      {
        key: "notifications" as SectionKey,
        label: t("settingsPage.notifications"),
        description: t("settingsPage.notificationsDesc"),
        icon: <NotificationsRounded sx={{ fontSize: 19 }} />,
        scope: "account" as const,
      },
      {
        key: "team" as SectionKey,
        label: t("settingsPage.team", { defaultValue: "Team" }),
        description: t("settingsPage.teamDesc", {
          defaultValue: "Invite teammates and control what each can access.",
        }),
        icon: <GroupAddRounded sx={{ fontSize: 19 }} />,
        scope: "company" as const,
      },
    ],
    [t, isIndividual],
  );

  /* F11 — four mental models, four groups: Account (me) · Business (the
     tenant) · Payments (money behaviour). Developer tooling moved OUT to
     /developer-keys (F5); Plan & fees lives in the Payments group as the
     pointer /fees. Group labels are desktop-only — the mobile rail is a
     horizontal chip scroller where labels would break the line. */
  const railGroups = useMemo(
    () => [
      {
        id: "account",
        label: t("settingsPage.groupAccount", { defaultValue: "Account" }),
        keys: ["profile", "notifications"] as SectionKey[],
      },
      {
        id: "business",
        label: t("settingsPage.groupBusiness", { defaultValue: "Business" }),
        keys: ["company", "tax", "team"] as SectionKey[],
      },
      {
        id: "payments",
        label: t("settingsPage.groupPayments", { defaultValue: "Payments" }),
        keys: ["payments", "plan"] as SectionKey[],
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

  // Backward-compat redirects (law 6 — no route left homeless):
  //  • legacy /settings?section=creator now lives at /creator
  //  • /settings?section=api-keys|webhooks and legacy ?tab=technical moved to
  //    the Developers destination (Batch B / N4 — one door for dev tooling)
  useEffect(() => {
    if (!router.isReady) return;
    const raw = String(router.query.section || "").toLowerCase();
    const rawTab = String(router.query.tab || "").toLowerCase();
    if (raw === "creator") {
      router.replace("/creator");
    } else if (raw === "api-keys" || rawTab === "technical") {
      router.replace("/developer-keys");
    } else if (raw === "webhooks") {
      router.replace("/developer-keys?tab=webhooks");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.section, router.query.tab]);

  const [active, setActive] = useState<SectionKey>(resolveInitialSection());

  // Swipe affordance for the settings rail when it scrolls horizontally on
  // mobile (self-disables on the md+ vertical layout where it doesn't overflow).
  const railFade = useEdgeFade<HTMLDivElement>();

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
  // Scope chip (2026-08-23): which tenant does the active section apply to?
  const scopeStore = useCompanyStore();
  const scopeCompany = (scopeStore?.companyList || []).find(
    (c: any) => Number(c.company_id) === Number((scopeStore as any)?.selectedCompanyId),
  ) as any;
  const scopeCompanyName = scopeCompany?.company_name || scopeCompany?.name || "";

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
          ref={railFade.ref}
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
            WebkitMaskImage: { xs: railFade.WebkitMaskImage, md: "none" },
            maskImage: { xs: railFade.maskImage, md: "none" },
          }}
          data-testid="settings-rail"
        >
          {railGroups.map((group) => (
            <React.Fragment key={group.id}>
              <Typography
                data-testid={`settings-group-${group.id}`}
                sx={{
                  display: { xs: "none", md: "block" },
                  fontSize: "10.5px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: theme.palette.text.disabled,
                  fontFamily: "var(--font-sans)",
                  px: "14px",
                  pt: 1.25,
                  pb: 0.5,
                }}
              >
                {group.label}
              </Typography>
              {group.keys.map((key) => {
                const s = sections.find((sec) => sec.key === key);
                if (!s) return null;
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
            </React.Fragment>
          ))}

          {/* ── Pointers OUT of Settings (audit F5 + F9 + law 6) ───────────────
              Developer tooling (keys/webhooks/events) moved to /developer-keys
              (Batch B / N4) and Referrals left the nav (F9) — these one-line
              pointer rows keep both reachable from Settings without duplicating
              their surfaces. They navigate away, so they carry an outward arrow
              and live below a divider. */}
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              height: "1px",
              bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
              my: 0.75,
              mx: "14px",
            }}
          />
          {[
            {
              key: "developers",
              label: t("settingsPage.developers", { defaultValue: "Developers" }),
              href: "/developer-keys",
              icon: <CodeRounded sx={{ fontSize: 19 }} />,
            },
            {
              key: "referrals",
              label: t("settingsPage.referrals", { defaultValue: "Referrals" }),
              href: "/referrals",
              icon: <GroupAddRounded sx={{ fontSize: 19 }} />,
            },
          ].map((p) => (
            <Box
              key={p.key}
              role="button"
              tabIndex={0}
              data-testid={`settings-rail-${p.key}`}
              onClick={() => router.push(p.href)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(p.href);
                }
              }}
              sx={railItemSx(false)}
            >
              {p.icon}
              <Typography
                sx={{
                  fontSize: "14px",
                  fontWeight: 500,
                  fontFamily: "var(--font-sans)",
                  color: "inherit",
                  lineHeight: 1,
                }}
              >
                {p.label}
              </Typography>
              <ArrowOutwardRounded sx={{ fontSize: 14, ml: "auto", opacity: 0.55 }} />
            </Box>
          ))}
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
            {/* Scope chip — account-wide vs per-company section */}
            <Box
              data-testid="settings-scope-chip"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.65,
                mt: 1,
                px: 1.25,
                py: 0.45,
                borderRadius: 999,
                border: `1px solid ${
                  activeMeta.scope === "company"
                    ? isDark
                      ? "rgba(129,140,248,0.35)"
                      : "rgba(79,70,229,0.28)"
                    : theme.palette.divider
                }`,
                backgroundColor:
                  activeMeta.scope === "company"
                    ? isDark
                      ? "rgba(129,140,248,0.10)"
                      : "rgba(79,70,229,0.06)"
                    : "transparent",
              }}
            >
              {activeMeta.scope === "company" ? (
                <BusinessRounded sx={{ fontSize: 13, color: theme.palette.text.secondary }} />
              ) : (
                <PersonRounded sx={{ fontSize: 13, color: theme.palette.text.secondary }} />
              )}
              <Typography
                sx={{
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: theme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                  whiteSpace: "nowrap",
                }}
              >
                {activeMeta.scope === "company"
                  ? t("settingsPage.scopeCompany", {
                      defaultValue: `Applies to ${scopeCompanyName || "the selected company"}`,
                      company:
                        scopeCompanyName ||
                        t("settingsPage.selectedCompanyFallback", {
                          defaultValue: "the selected company",
                        }),
                    })
                  : t("settingsPage.scopeAccount", {
                      defaultValue: "Applies to your whole account",
                    })}
              </Typography>
            </Box>
          </Box>

          {active === "profile" && <ProfileSection />}
          {active === "company" && (
            <CompanyConfigSection visibleSections={["company"]} allowAdd />
          )}
          {active === "payments" && (
            <CompanyConfigSection visibleSections={["crypto", "payment"]} showDisplayCurrency />
          )}
          {active === "plan" && <PlanFeesSection />}
          {active === "tax" && <TaxSettingsSection />}
          {active === "team" && <TeamSettingsSection />}
          {active === "notifications" && <NotificationPage />}

          {/* Session 74 P0-1: mobile-only bottom spacer so Save/Update buttons
              in each Settings section clear the ~80px bottom-nav + the 68px
              chat-FAB gutter. Desktop is 0-height (no impact) because desktop
              has no bottom-nav. Same pattern as the Session 71 TransactionsTable fix. */}
          <Box
            data-testid="settings-mobile-spacer"
            sx={{ height: { xs: 180, md: 0 }, flexShrink: 0 }}
          />
        </Box>
      </Box>
    </>
  );
};

export default SettingsPage;
