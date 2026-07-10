import Logo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import LogoDark from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import MobileLogo from "@/assets/Images/auth/dynopay-mobile-logo.png";
import CompanySelector from "@/Components/UI/CompanySelector";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import UserMenu from "@/Components/UI/UserMenu";
import { useWalletData } from "@/hooks/useWalletData";
import { rootReducer } from "@/utils/types";
import { useTheme as useMuiTheme } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { Box } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import {
  HeaderContainer,
  LogoContainer,
  MainContainer,
  RequiredKYC,
  RequiredKYCText,
  RightSection,
} from "./styled";
import { HeaderDivider } from "@/Components/UI/LanguageSwitcher/styled";

const NewHeader = () => {
  const router = useRouter();
  const muiTheme = useMuiTheme();
  const namespaces = ["dashboardLayout", "walletScreen"];
  const { t } = useTranslation(namespaces);
  const tDashboard = useCallback(
    (key: string) => t(key, { ns: "dashboardLayout" }),
    [t],
  );
  const tWallet = useCallback(
    (key: string) => t(key, { ns: "walletScreen" }),
    [t],
  );
  const { walletWarning } = useWalletData();
  const companyState = useSelector((state: rootReducer) => state.companyReducer);
  const hasCompany = (companyState.companyList ?? []).length > 0;
  const companyFetched = companyState.fetched;
  // Show company warning only after company data has been fetched
  const showCompanyWarning = companyFetched && !hasCompany;
  // Show wallet warning only if company exists (wallet depends on company)
  const showWalletWarning = walletWarning && hasCompany;
  const [kycRequired, setKycRequired] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    axiosBaseApi
      .get("/user/onboarding-status")
      .then((res: any) => {
        const data = res?.data?.data;
        if (data?.kyc_required || data?.kycRequired) {
          setKycRequired(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleKycClick = async () => {
    if (kycLoading) return;
    setKycLoading(true);
    try {
      const res = await axiosBaseApi.post("/kyc/submit");
      const url = res?.data?.data?.verification_url || res?.data?.data?.url;
      if (url) {
        window.open(url, "_blank");
      }
    } catch {
      // silently fail
    } finally {
      setKycLoading(false);
    }
  };
  return (
    <HeaderContainer>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <LogoContainer>
          <Image
            onClick={() => router.push("/dashboard")}
            src={muiTheme.palette.mode === "dark" ? LogoDark : Logo}
            alt="logo"
            width={114}
            height={39}
            draggable={false}
            className="logo"
          />
        </LogoContainer>

        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            justifyContent: "center",
          }}
        >
          <Image
            onClick={() => router.push("/dashboard")}
            src={MobileLogo}
            alt="logo"
            width={22}
            height={24}
            draggable={false}
          />
        </Box>
      </Box>

      <MainContainer>
        <CompanySelector />

        <RightSection>
          {/* Mobile theme toggle - visible only on mobile */}
          <Box sx={{ display: { xs: "flex", lg: "none" } }}>
            <ThemeToggle size="small" />
          </Box>
          <Box sx={{ display: { xs: "none", lg: "flex" }, gap: "20px" }}>
            <Box sx={{ order: { lg: 2, xl: 1 } }}>
              <LanguageSwitcher />
            </Box>

            <ThemeToggle size="small" />

            {kycRequired && (
              <Box sx={{ order: { lg: 1, xl: 2 } }}>
                <RequiredKYC
                  onClick={handleKycClick}
                  sx={{ cursor: kycLoading ? "wait" : "pointer" }}
                  data-testid="kyc-required-banner"
                >
                  <InfoIcon
                    sx={{ fontSize: 20, color: muiTheme.palette.error.main }}
                  />
                  <RequiredKYCText sx={{ display: { lg: "none", xl: "block" } }}>{tDashboard("requiredKYC2")}</RequiredKYCText>
                  <RequiredKYCText sx={{ display: { lg: "block", xl: "none" } }}>{tDashboard("requiredKYC1")}</RequiredKYCText>
                  <HeaderDivider style={{ margin: "0 14px" }} />
                  <ArrowOutwardIcon
                    sx={{ color: muiTheme.palette.text.secondary, fontSize: 16 }}
                  />
                </RequiredKYC>
              </Box>
            )}

            {showCompanyWarning && (
              <Box sx={{ order: { lg: 1, xl: 2 } }}>
                <Link href="/create-pay-link">
                  <RequiredKYC>
                    <InfoIcon
                      sx={{ fontSize: 20, color: muiTheme.palette.primary.main }}
                    />
                    <RequiredKYCText
                      sx={{
                        display: { lg: "none", xl: "block" },
                        color: muiTheme.palette.primary.main,
                      }}
                    >
                      {tDashboard("companySetupWarning")}
                    </RequiredKYCText>
                    <RequiredKYCText
                      sx={{
                        display: { lg: "block", xl: "none" },
                        color: muiTheme.palette.primary.main,
                      }}
                    >
                      {tDashboard("companySetupWarningShort")}
                    </RequiredKYCText>
                  </RequiredKYC>
                </Link>
              </Box>
            )}

            {showWalletWarning && (
              <Box sx={{ order: { lg: 1, xl: 2 } }}>
                <Link href="/wallet">
                  <RequiredKYC>
                    <InfoIcon
                      sx={{ fontSize: 20, color: muiTheme.palette.primary.main }}
                    />
                    <RequiredKYCText
                      sx={{
                        display: { lg: "none", xl: "block" },
                        color: muiTheme.palette.primary.main,
                      }}
                    >
                      {tWallet("walletSetUpWarnnigTitle")}
                    </RequiredKYCText>
                    <RequiredKYCText
                      sx={{
                        display: { lg: "block", xl: "none" },
                        color: muiTheme.palette.primary.main,
                      }}
                    >
                      {tWallet("walletWarnnigTitle")}
                    </RequiredKYCText>
                  </RequiredKYC>
                </Link>
              </Box>
            )}
          </Box>
          <UserMenu />
        </RightSection>
      </MainContainer>
    </HeaderContainer>
  );
};

export default NewHeader;
