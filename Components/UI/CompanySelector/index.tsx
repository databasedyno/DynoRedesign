import { BRAND_ACCENT, brandFg } from "@/constants/theme";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import EditIcon from "@/assets/Icons/edit-icon.svg";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import BrandAvatar from "@/Components/UI/BrandAvatar";
import { Box, Divider, Popover, Snackbar, Typography, useTheme } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CompanyItem,
  ItemLeft,
  ItemRight,
  SelectorTrigger,
  TriggerText,
} from "./styled";

import { useCompanySettingsDialog } from "@/Components/UI/CompanySettingsDialog/context";
import useIsMobile from "@/hooks/useIsMobile";
import { rootReducer } from "@/utils/types";
import { sanitizeBrandName } from "@/utils/brandName";
import { Add } from "@mui/icons-material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import CustomButton from "../Buttons";
import KycVerifiedBadge from "@/Components/UI/KycVerifiedBadge";
import { HeaderDivider } from "../LanguageSwitcher/styled";
import { DashboardAction, TransactionAction, PaymentLinkAction, ApiAction } from "@/Redux/Actions";
import { useWalletStore } from "@/contexts/WalletDataContext";
import { WALLET_KEY, walletPrefetchFetcher } from "@/contexts/WalletDataContext";
import { preload } from "swr";
import {
  DASHBOARD_FETCH_ALL,
  DashboardChartAction,
} from "@/Redux/Actions/DashboardAction";
import { TRANSACTION_FETCH } from "@/Redux/Actions/TransactionAction";
import { PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { API_FETCH } from "@/Redux/Actions/ApiAction";
import CreateCompanyModal from "@/Components/UI/OnboardingFlow/CreateCompanyModal";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import StepIndicator from "@/Components/UI/OnboardingFlow/StepIndicator";
import CelebrationOverlay from "@/Components/UI/OnboardingFlow/CelebrationOverlay";

export default function CompanySelector() {
  const { t } = useTranslation("dashboardLayout");
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const router = useRouter();
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { openCompanySettings } = useCompanySettingsDialog();
  const companyState = useCompanyStore();
  const { refetchWallets } = useWalletStore();

  // Add Company Flow states
  const [addCompanyPhase, setAddCompanyPhase] = useState<"idle" | "company" | "wallet" | "celebration">("idle");
  const [switchToast, setSwitchToast] = useState<string | null>(null);
  const [switchToastOpen, setSwitchToastOpen] = useState(false);

  const handleAddCompanyClick = useCallback(() => {
    setAddCompanyPhase("company");
  }, []);

  const handleCompanyCreated = useCallback(() => {
    companyState.refetchCompanies();
    refetchWallets();
    // Auto-select the newest company (last in the list after fetch completes)
    // This is handled via a separate effect below
    setAddCompanyPhase("wallet");
  }, [companyState, refetchWallets]);

  const handleWalletAdded = useCallback(() => {
    refetchWallets();
    setAddCompanyPhase("celebration");
  }, [refetchWallets]);

  const handleCelebrationDismiss = useCallback(() => {
    setAddCompanyPhase("idle");
    // Refresh all data
    companyState.refetchCompanies();
    refetchWallets();
  }, [companyState, refetchWallets]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const MIN_WIDTH = 390;
  const MAX_WIDTH = 500;
  const BASE_COUNT = 15;
  const STEP = 10;

  const [windowWidth, setWindowWidth] = useState(0);
  const [count, setCount] = useState(BASE_COUNT);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const clampedWidth = Math.min(Math.max(windowWidth, MIN_WIDTH), MAX_WIDTH);

    const extra = Math.floor((clampedWidth - MIN_WIDTH) / STEP);
    setCount(BASE_COUNT + extra);
  }, [windowWidth]);

  const companies = useMemo(
    () => companyState.companyList ?? [],
    [companyState.companyList],
  );
  
  // Use the selected company from CompanyDataContext.
  const active = companyState.selectedCompanyId;

  // NOTE: default-company selection is owned solely by CompanyDataContext
  // (keeps a valid current selection -> last_company_id from localStorage ->
  // first company). We must NOT auto-select here: because companyList is
  // newest-first, an auto-select-first effect races the context's restore and
  // clobbers the persisted company (writing the newest id to LS + the backend)
  // on every page load, landing multi-company merchants on the wrong company.

  // After company list updates during "wallet" phase, select the newest company
  useEffect(() => {
    if (addCompanyPhase === "wallet" && companies.length > 0) {
      const newestCompany = companies[companies.length - 1];
      if (newestCompany && newestCompany.company_id !== active) {
        // selectCompany persists last_company (backend + localStorage) itself.
        companyState.selectCompany(newestCompany.company_id);
      }
    }
  }, [addCompanyPhase, companies, active, dispatch]);

  const selected = companies.find((c) => c.company_id === active);

  // Per-brand mark (the brand's own logo, or its initials) — the account-level
  // photo is never used here, so switching brands always switches the mark too.
  const shown = selected || companies[0];

  // Instant Company Switch: warm the hovered company's wallet SWR cache so the
  // list is already in-flight/cached the moment the user clicks. Uses a
  // non-aborting prefetch fetcher so it never cancels the active company's fetch.
  const prefetchedRef = useRef<Set<number>>(new Set());
  const prefetchCompany = useCallback((companyId: number) => {
    if (companyId === active) return;
    if (prefetchedRef.current.has(companyId)) return;
    prefetchedRef.current.add(companyId);
    try {
      preload([WALLET_KEY, companyId], walletPrefetchFetcher as any);
    } catch {
      /* best-effort */
    }
  }, [active]);

  const handleOpen = (e: any) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleCompanySwitch = (companyId: number) => {
    const companyName = sanitizeBrandName(
      companies.find((c) => String(c.company_id) === String(companyId))?.company_name || ""
    );
    companyState.selectCompany(companyId);
    handleClose();
    // Show switch toast indicator. Keep the brand name set through the fade-out
    // (we toggle a separate `open` flag) so the toast never flashes an empty name.
    setSwitchToast(companyName);
    setSwitchToastOpen(true);
    setTimeout(() => setSwitchToastOpen(false), 2500);
    // (selectCompany already persists last_company to the backend + localStorage;
    // no duplicate PUT here.)
    // Re-fetch all company-scoped data for the new company
    const companyPayload = { company_id: companyId };
    dispatch(DashboardAction(DASHBOARD_FETCH_ALL, companyPayload));
    // Chart MUST go through its own takeLatest channel (DASHBOARD_CHART_INIT),
    // NOT DashboardAction(DASHBOARD_CHART_FETCH) which routes through the
    // debounced DASHBOARD_INIT channel. On a brand switch both the stats
    // (DASHBOARD_FETCH_ALL) and this chart action landed in the same 400ms
    // debounce window; because the chart was dispatched last it won the
    // debounce and the stats fetch was silently swallowed — leaving the
    // previous brand's stats on screen (e.g. switching back to a populated
    // brand still showed the zero-transaction getting-started hero). Using the
    // dedicated chart channel keeps FETCH_ALL as the sole DASHBOARD_INIT so
    // stats always refresh for the newly selected brand.
    dispatch(DashboardChartAction({ ...companyPayload, period: "7d" }));
    dispatch(TransactionAction(TRANSACTION_FETCH, companyPayload));
    refetchWallets();
    dispatch(PaymentLinkAction(PAYLINK_FETCH, companyPayload));
    dispatch(ApiAction(API_FETCH, companyPayload));
    // Switching brands always returns the merchant to the dashboard so they
    // never remain on a brand-scoped page (e.g. Wallet Payout) under the new
    // brand. Applies to desktop, laptop, tablet and mobile (single switcher).
    if (router.pathname !== "/dashboard") {
      router.push("/dashboard");
    }
  };

  function truncateByWords(text: string, maxLength: number) {
    const clean = sanitizeBrandName(text);
    if (clean.length <= maxLength) return clean;

    const trimmed = clean.slice(0, maxLength);
    const words = `${trimmed}...`;
    return words;
  }

  return (
    <Box
      ref={wrapperRef}
      sx={{
        position: "relative",
        width: isMobile ? "auto" : "clamp(265px, 18vw, 300px)",
        minWidth: 0,
        flex: isMobile ? "1 1 auto" : "0 0 auto",
        overflow: "hidden",
      }}
    >
      {/* Trigger */}
      <SelectorTrigger
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={Boolean(anchorEl)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            handleOpen(e);
          }
        }}
        data-testid="company-selector-trigger"
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: "1 1 auto" }}>
          <BrandAvatar
            data-testid="company-selector-avatar"
            name={shown?.company_name}
            photo={shown?.photo}
            size={isMobile ? 22 : 26}
          />
          <TriggerText
            data-testid="company-selector-name"
            title={sanitizeBrandName(selected?.company_name || companies[0]?.company_name || "")}
            sx={{
              color: brandFg(theme.palette.mode === "dark"),
              minWidth: 0,
              flex: "0 1 auto",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selected?.company_name
              ? (windowWidth < 600
                ? truncateByWords(selected.company_name, count)
                : sanitizeBrandName(selected.company_name))
              : companies.length > 0
                ? (windowWidth < 600
                  ? truncateByWords(companies[0].company_name, count)
                  : sanitizeBrandName(companies[0].company_name))
                : ""}
          </TriggerText>
          <KycVerifiedBadge companyId={selected?.company_id ?? active} size={16} />
        </Box>

        <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: { xs: "0px", sm: "8px" } }}>
          <HeaderDivider sx={{ display: { xs: "none", sm: "block" } }} />
          {!anchorEl ? (
            <ExpandMoreIcon
              fontSize="small"
              sx={{ color: theme.palette.text.secondary }}
            />
          ) : (
            <ExpandLess
              fontSize="small"
              sx={{ color: theme.palette.text.secondary }}
            />
          )}
        </Box>
      </SelectorTrigger>

      {/* Dropdown — portaled Popover so it is never clipped by the header /
          app-shell overflow:hidden ancestors (fixes mobile + all devices). */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              overflow: "visible",
              background: "transparent",
              boxShadow: "none",
            },
          },
        }}
      >
        <Box
          data-testid="company-selector-dropdown"
          sx={{
            width: isMobile ? "min(86vw, 300px)" : "300px",
            border: `1px solid ${theme.palette.mode === "dark" ? "#2A2D42" : "rgba(233, 236, 242, 1)"}`,
            borderRadius: "6px",
            backgroundColor: theme.palette.background.paper,
            padding: "9px 8px",
            boxShadow: "0px 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          {/* Header */}
          <Box
            onClick={handleClose}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0px 6px",
              cursor: "pointer",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <BrandAvatar name={shown?.company_name} photo={shown?.photo} size={isMobile ? 22 : 26} />
              <TriggerText sx={{ color: brandFg(theme.palette.mode === "dark") }}>
                {sanitizeBrandName(selected?.company_name || (companies.length > 0 ? companies[0].company_name : "Company")) || "Company"}
              </TriggerText>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <HeaderDivider />
              <ExpandLess
                fontSize="small"
                sx={{ color: theme.palette.text.secondary }}
              />
            </Box>
          </Box>

          {/* Content */}
          <Box
            sx={{
              mt: "13px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "0px" : "6px",
              maxHeight: "50vh",
              overflowY: "auto",
            }}
          >
            <Typography
              sx={{
                display: "block",
                padding: "0px 6px",
                fontSize: "15px",
                color: theme.palette.text.secondary,
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
              }}
            >
              {t("companySelectorTitle")}:
            </Typography>

            {companies.map((c) => (
              <CompanyItem
                key={c.company_id}
                data-testid={`company-option-${c.company_id}`}
                active={active === c.company_id}
                onMouseEnter={() => prefetchCompany(c.company_id)}
                onClick={() => {
                  handleCompanySwitch(c.company_id);
                }}
              >
                <ItemLeft>
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}
                  >
                    <BrandAvatar
                      data-testid={`company-avatar-${c.company_id}`}
                      name={c?.company_name}
                      photo={c?.photo}
                      size={isMobile ? 22 : 26}
                    />
                    <TriggerText
                      sx={{
                        color: theme.palette.text.primary,
                        minWidth: 0,
                        flex: "0 1 auto",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={sanitizeBrandName(c?.company_name ?? "")}
                    >
                      {isMobile
                        ? truncateByWords(c?.company_name ?? "-", 18)
                        : (sanitizeBrandName(c?.company_name ?? "") || "-")}
                    </TriggerText>
                    {/* Individual vs Business — the Account is the tenant; a
                        "Business" is simply an Account with a business profile. */}
                    {(() => {
                      const individual =
                        String(c?.account_type ?? "business").toLowerCase() ===
                        "individual";
                      return (
                        <Box
                          data-testid={`company-type-${c.company_id}`}
                          sx={{
                            px: "6px",
                            py: "1px",
                            borderRadius: "999px",
                            fontFamily: "var(--font-sans)",
                            fontSize: isMobile ? "9px" : "10px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            color: individual
                              ? theme.palette.text.secondary
                              : brandFg(theme.palette.mode === "dark"),
                            border: `1px solid ${
                              individual
                                ? theme.palette.divider
                                : brandFg(theme.palette.mode === "dark")
                            }`,
                          }}
                        >
                          {individual
                            ? t("accountTypeIndividual", { defaultValue: "Individual" })
                            : t("accountTypeBusiness", { defaultValue: "Business" })}
                        </Box>
                      );
                    })()}
                    {c.is_member && (
                      <Box
                        data-testid={`company-role-${c.company_id}`}
                        sx={{
                          px: "6px",
                          py: "1px",
                          borderRadius: "999px",
                          fontFamily: "var(--font-sans)",
                          fontSize: isMobile ? "9px" : "10px",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          color: BRAND_ACCENT,
                          backgroundColor:
                            theme.palette.mode === "dark"
                              ? "rgba(120,200,160,0.12)"
                              : "rgba(20,140,90,0.10)",
                          border: `1px solid ${BRAND_ACCENT}`,
                        }}
                      >
                        {String(c.member_role || "member") === "admin"
                          ? t("teamRoleAdmin", { defaultValue: "Admin" })
                          : t("teamRoleMember", { defaultValue: "Member" })}
                      </Box>
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: isMobile ? "10px" : "13px",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      color: theme.palette.text.secondary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {c.email}
                  </Typography>
                </ItemLeft>

                {/* Owned companies get the quick-edit pencil; a company you only
                    have MEMBER access to is edited from Settings (permission-gated),
                    so the pencil is hidden here. */}
                {!c.is_member && (
                  <ItemRight
                    active={active === c.company_id}
                    data-testid={`company-edit-${c.company_id}`}
                    onClick={(e: any) => {
                      e.stopPropagation();
                      handleClose();
                      openCompanySettings(c);
                    }}
                  >
                    <Image
                      src={EditIcon}
                      width={isMobile ? 12 : 16}
                      height={isMobile ? 13 : 17}
                      alt="edit"
                      draggable={false}
                    />
                  </ItemRight>
                )}
              </CompanyItem>
            ))}

            <Divider sx={{ my: "6px", borderColor: theme.palette.mode === "dark" ? "#2A2D42" : "#D9D9D9" }} />

            <CustomButton
              label={t("addCompany")}
              data-testid="add-company-btn"
              variant="secondary"
              size="medium"
              endIcon={<Add sx={{ fontSize: isMobile ? "16px" : "18px" }} />}
              fullWidth
              sx={{ mt: 1, py: "8px !important" }}
              onClick={() => {
                handleClose();
                handleAddCompanyClick();
              }}
            />
          </Box>
        </Box>
      </Popover>

      {/* Add Company Onboarding Flow */}
      <CreateCompanyModal
        open={addCompanyPhase === "company"}
        onSuccess={handleCompanyCreated}
        onClose={() => setAddCompanyPhase("idle")}
      />
      <AddWalletModal
        open={addCompanyPhase === "wallet"}
        onClose={() => {
          setAddCompanyPhase("idle");
          companyState.refetchCompanies();
        }}
        onWalletAdded={handleWalletAdded}
        headerExtra={<StepIndicator currentStep={2} totalSteps={2} />}
      />
      <CelebrationOverlay
        open={addCompanyPhase === "celebration"}
        onDismiss={handleCelebrationDismiss}
      />
      {/* Company switch toast indicator */}
      <Snackbar
        open={switchToastOpen}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        message={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }} data-testid="brand-switch-toast">
            <BusinessCenterIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
            <span>{t("nowViewing", { defaultValue: "Now viewing" })} <strong>{switchToast}</strong> — {t("dashboard", { defaultValue: "Dashboard" })}</span>
          </Box>
        }
        ContentProps={{
          sx: {
            borderRadius: "10px",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            minWidth: "auto",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          },
        }}
      />
    </Box>
  );
}
