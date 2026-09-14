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
import { AuthPageBackground, SplitLayoutWrapper, FormPanel } from "@/Containers/Login/styled";
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
  testId?: string;
  children: React.ReactNode;
}

/** The one auth frame: centered card, logo + language/theme row, content, trust strip. */
const AuthShell: React.FC<AuthShellProps> = ({ title, trustStrip = true, testId, children }) => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("sm");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <AuthPageBackground data-testid={testId}>
      {title && (
        <Head>
          <title>{title}</title>
          <meta name="robots" content="noindex" />
        </Head>
      )}
      <SplitLayoutWrapper>
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
        {trustStrip && <TrustStrip />}
      </SplitLayoutWrapper>
    </AuthPageBackground>
  );
};

export default AuthShell;
