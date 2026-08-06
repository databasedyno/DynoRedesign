import { useCompanyStore } from "@/contexts/CompanyDataContext";
import EditIcon from "@/assets/Icons/edit-icon.svg";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import { Box, Divider, Snackbar, Typography, useTheme } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axiosBaseApi from "@/axiosConfig";
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
import { Add } from "@mui/icons-material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import CustomButton from "../Buttons";
import { HeaderDivider } from "../LanguageSwitcher/styled";
import { DashboardAction, TransactionAction, PaymentLinkAction, ApiAction } from "@/Redux/Actions";
import { useWalletStore } from "@/contexts/WalletDataContext";
import {
  DASHBOARD_FETCH_ALL,
  DASHBOARD_CHART_FETCH,
} from "@/Redux/Actions/DashboardAction";
import { TRANSACTION_FETCH } from "@/Redux/Actions/TransactionAction";
import { PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { API_FETCH } from "@/Redux/Actions/ApiAction";
import CreateCompanyModal from "@/Components/UI/OnboardingFlow/CreateCompanyModal";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import StepIndicator from "@/Components/UI/OnboardingFlow/StepIndicator";
import CelebrationOverlay from "@/Components/UI/OnboardingFlow/CelebrationOverlay";
import { API_ENDPOINTS } from "@/api/endpoints";

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

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [count, setCount] = useState(BASE_COUNT);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

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
  
  // Use Redux selectedCompanyId
  const active = companyState.selectedCompanyId;
  
  // Auto-select first company if none selected
  useEffect(() => {
    if (active == null && companies.length > 0) {
      companyState.selectCompany(companies[0].company_id);
    }
  }, [active, companies, dispatch]);

  // After company list updates during "wallet" phase, select the newest company
  useEffect(() => {
    if (addCompanyPhase === "wallet" && companies.length > 0) {
      const newestCompany = companies[companies.length - 1];
      if (newestCompany && newestCompany.company_id !== active) {
        companyState.selectCompany(newestCompany.company_id);
        // Persist to backend
        axiosBaseApi.put(API_ENDPOINTS.user.lastCompany, { company_id: newestCompany.company_id }).catch(() => {});
      }
    }
  }, [addCompanyPhase, companies, active, dispatch]);

  const selected = companies.find((c) => c.company_id === active);

  const handleOpen = (e: any) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleCompanySwitch = (companyId: number) => {
    const companyName = companies.find((c) => c.company_id === companyId)?.company_name || "";
    companyState.selectCompany(companyId);
    handleClose();
    // Show switch toast indicator
    setSwitchToast(companyName);
    setTimeout(() => setSwitchToast(null), 2500);
    // Persist last company to backend (fire-and-forget)
    axiosBaseApi.put(API_ENDPOINTS.user.lastCompany, { company_id: companyId }).catch(() => {});
    // Re-fetch all company-scoped data for the new company
    const companyPayload = { company_id: companyId };
    dispatch(DashboardAction(DASHBOARD_FETCH_ALL, companyPayload));
    dispatch(DashboardAction(DASHBOARD_CHART_FETCH, { ...companyPayload, period: "7d" }));
    dispatch(TransactionAction(TRANSACTION_FETCH, companyPayload));
    refetchWallets();
    dispatch(PaymentLinkAction(PAYLINK_FETCH, companyPayload));
    dispatch(ApiAction(API_FETCH, companyPayload));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (anchorEl) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [anchorEl]);

  function truncateByWords(text: string, maxLength: number) {
    if (text.length <= maxLength) return text;

    const trimmed = text.slice(0, maxLength);
    const words = `${trimmed}...`;
    return words;
  }

  return (
    <Box
      ref={wrapperRef}
      sx={{
        position: "relative",
        width: isMobile ? "fit-content" : "clamp(265px, 18vw, 300px)",
        mt: Boolean(anchorEl) && isMobile ? "-16px !important" : "0px",
        ml: Boolean(anchorEl) && isMobile ? "-6px !important" : "0px",
      }}
    >
      {/* Trigger */}
      <SelectorTrigger onClick={handleOpen} data-testid="company-selector-trigger">
        <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <BusinessCenterIcon
            sx={{
              color: theme.palette.primary.main,
              fontSize: isMobile ? "16.5px" : "19px",
              mt: "-3px",
            }}
          />
          <TriggerText sx={{ color: theme.palette.primary.main }}>
            {selected?.company_name
              ? (windowWidth < 600
                ? truncateByWords(selected.company_name, count)
                : selected.company_name)
              : companies.length > 0
                ? (windowWidth < 600
                  ? truncateByWords(companies[0].company_name, count)
                  : companies[0].company_name)
                : ""}
          </TriggerText>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <HeaderDivider />
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

      {/* Dropdown */}
      {Boolean(anchorEl) && (
        <Box
          data-testid="company-selector-dropdown"
          sx={{
            position: "absolute",
            top: "0",
            width: isMobile ? "224px" : "300px",
            border: `1px solid ${theme.palette.mode === "dark" ? "#2A2D42" : "rgba(233, 236, 242, 1)"}`,
            borderRadius: "6px",
            backgroundColor: theme.palette.background.paper,
            padding: anchorEl ? "9px 8px" : "11px 8px",
            zIndex: 100,
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
              <BusinessCenterIcon
                sx={{
                  color: theme.palette.primary.main,
                  fontSize: isMobile ? "16.5px" : "20px",
                }}
              />
              <TriggerText sx={{ color: theme.palette.primary.main }}>
                {selected?.company_name || (companies.length > 0 ? companies[0].company_name : "Company")}
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
                onClick={() => {
                  handleCompanySwitch(c.company_id);
                }}
              >
                <ItemLeft>
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <BusinessCenterIcon
                      sx={{ fontSize: isMobile ? "16.5px" : "20px", color: theme.palette.text.primary }}
                    />
                    <TriggerText sx={{ color: theme.palette.text.primary }}>
                      {isMobile
                        ? truncateByWords(c?.company_name ?? "-", 18)
                        : (c?.company_name ?? "-")}
                    </TriggerText>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: isMobile ? "10px" : "13px",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      color: theme.palette.text.secondary,
                    }}
                  >
                    {c.email}
                  </Typography>
                </ItemLeft>

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
      )}

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
        open={!!switchToast}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        message={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BusinessCenterIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
            <span>{t("switchedToCompany")} <strong>{switchToast}</strong></span>
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
