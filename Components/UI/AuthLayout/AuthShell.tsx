import React, { useEffect, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { Box, useTheme } from "@mui/material";
import Logo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import WhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import TrustStrip from "@/Components/UI/AuthLayout/TrustStrip";
import AuthLangMenu from "@/Components/UI/AuthLayout/AuthLangMenu";
import AuthBrandPanel from "@/Components/UI/AuthLayout/AuthBrandPanel";
import {
  AuthPageBackground,
  SplitLayoutWrapper,
  SplitScreenWrapper,
  SplitFormColumn,
  FormPanel,
} from "@/Containers/Login/styled";
import useIsMobile from "@/hooks/useIsMobile";

/** Language + theme controls for the auth card header (shared by every auth screen). */
export const AuthHeaderControls: React.FC = () => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }} data-testid="auth-header-controls">
    <AuthLangMenu />
    <ThemeToggle size="small" />
  </Box>
);

interface AuthShellProps {
  /** Document title, e.g. "Set a new password · Dynopay". */
  title?: string;
  /** Show the social-proof strip under the card (default true, same as login/register). */
  trustStrip?: boolean;
  /**
   * Expressive split-screen: renders the aurora AuthBrandPanel on the right at
   * lg+ (same as login/register). Default false keeps the plain centered card.
   */
  brand?: boolean;
  testId?: string;
  children: React.ReactNode;
}

/** The one auth frame: logo + language/theme row, content, optional brand panel. */
const AuthShell: React.FC<AuthShellProps> = ({ title, trustStrip = true, brand = false, testId, children }) => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("sm");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const head = title && (
    <Head>
      <title>{title}</title>
      <meta name="robots" content="noindex" />
    </Head>
  );

  const formCard = (
    <FormPanel>
      <Box sx={{ width: "100%", maxWidth: 420 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Image
            src={mounted && theme.palette.mode === "dark" ? WhiteLogo : Logo}
            alt="Dynopay"
            width={isMobile ? 118 : 130}
            height={isMobile ? 40 : 44}
            draggable={false}
            priority
            unoptimized
            onClick={() => router.push("/")}
            style={{ cursor: "pointer" }}
            data-testid="auth-shell-logo"
          />
          <AuthHeaderControls />
        </Box>
        {children}
      </Box>
    </FormPanel>
  );

  if (brand) {
    return (
      <AuthPageBackground data-testid={testId}>
        {head}
        <SplitScreenWrapper>
          <SplitFormColumn>
            {formCard}
            {/* Trust strip below the card on mobile/tablet; the brand panel to
                the right carries the social proof on desktop. */}
            {trustStrip && (
              <Box sx={{ display: { xs: "block", lg: "none" }, width: "100%" }}>
                <TrustStrip />
              </Box>
            )}
          </SplitFormColumn>
          <AuthBrandPanel />
        </SplitScreenWrapper>
      </AuthPageBackground>
    );
  }

  return (
    <AuthPageBackground data-testid={testId}>
      {head}
      <SplitLayoutWrapper>
        {formCard}
        {trustStrip && <TrustStrip />}
      </SplitLayoutWrapper>
    </AuthPageBackground>
  );
};

export default AuthShell;
