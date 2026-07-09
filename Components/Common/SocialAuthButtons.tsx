import React from "react";
import { Box, ButtonBase, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import GitHubIcon from "@mui/icons-material/GitHub";
import GoogleIcon from "@/assets/Images/googleIcon.svg";

/**
 * Emergent-style social auth buttons.
 * - Big full-width "Continue with Google" pill (dark in light mode, light in dark mode)
 *   with the official G logo inside a white circle.
 * - Optional icon-only circular GitHub button rendered beneath it.
 *
 * Gating is done by the caller (NEXT_PUBLIC_ENABLE_GOOGLE_AUTH / NEXT_PUBLIC_ENABLE_GITHUB_AUTH).
 */

interface GoogleAuthButtonProps {
  label: string;
  onClick: () => void;
  testId?: string;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  label,
  onClick,
  testId = "google-auth-btn",
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return (
    <ButtonBase
      data-testid={testId}
      onClick={onClick}
      focusRipple
      sx={{
        width: "100%",
        height: 48,
        borderRadius: "24px",
        backgroundColor: dark ? "#f2f2f2" : "#131314",
        color: dark ? "#1f1f1f" : "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.25,
        px: 2,
        border: "1px solid",
        borderColor: dark ? "transparent" : "#2d2d2e",
        transition: "all 0.2s ease",
        "&:hover": {
          backgroundColor: dark ? "#e6e6e6" : "#2a2a2b",
          transform: "translateY(-1px)",
          boxShadow: dark
            ? "0 4px 14px rgba(0,0,0,0.25)"
            : "0 4px 14px rgba(0,0,0,0.18)",
        },
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: dark ? "0 0 0 1px rgba(0,0,0,0.06)" : "none",
        }}
      >
        <Image src={GoogleIcon} alt="Google" width={18} height={18} draggable={false} />
      </Box>
      <Typography
        component="span"
        sx={{
          fontFamily: "UrbanistSemiBold, Urbanist, sans-serif",
          fontWeight: 600,
          fontSize: "15px",
          letterSpacing: 0,
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
};

interface GithubAuthButtonProps {
  onClick: () => void;
  /** Visible label, e.g. t("continueWithGithub"). Falls back to ariaLabel. */
  label?: string;
  ariaLabel?: string;
  testId?: string;
}

export const GithubAuthButton: React.FC<GithubAuthButtonProps> = ({
  onClick,
  label,
  ariaLabel = "Continue with GitHub",
  testId = "github-auth-btn",
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return (
    <ButtonBase
      data-testid={testId}
      aria-label={label || ariaLabel}
      onClick={onClick}
      focusRipple
      sx={{
        // Full-width labeled pill matching GoogleAuthButton's geometry so the
        // two buttons read as one cohesive group (was an 88px icon-only pill
        // that looked small/disconnected under the big Google button).
        width: "100%",
        height: 48,
        borderRadius: "24px",
        border: "1px solid",
        borderColor: dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.16)",
        backgroundColor: dark ? "rgba(255,255,255,0.06)" : "#f7f7f7",
        color: dark ? "#ffffff" : "#1f1f1f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.25,
        px: 2,
        transition: "all 0.2s ease",
        "&:hover": {
          backgroundColor: dark ? "rgba(255,255,255,0.12)" : "#ededed",
          transform: "translateY(-1px)",
          boxShadow: dark
            ? "0 4px 14px rgba(0,0,0,0.25)"
            : "0 4px 14px rgba(0,0,0,0.10)",
        },
      }}
    >
      <Box
        sx={{
          // Mirrors the white G-logo circle on the Google pill (inverted).
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: dark ? "#ffffff" : "#131314",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <GitHubIcon
          sx={{ fontSize: 18, color: dark ? "#131314" : "#ffffff" }}
        />
      </Box>
      <Typography
        component="span"
        sx={{
          fontFamily: "UrbanistSemiBold, Urbanist, sans-serif",
          fontWeight: 600,
          fontSize: "15px",
          letterSpacing: 0,
          lineHeight: 1,
        }}
      >
        {label || ariaLabel}
      </Typography>
    </ButtonBase>
  );
};

interface SocialAuthButtonsProps {
  googleLabel: string;
  onGoogle: () => void;
  showGoogle?: boolean;
  showGithub?: boolean;
  onGithub?: () => void;
  githubLabel?: string;
  githubAriaLabel?: string;
  googleTestId?: string;
  githubTestId?: string;
}

const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  googleLabel,
  onGoogle,
  showGoogle = true,
  showGithub = false,
  onGithub,
  githubLabel,
  githubAriaLabel,
  googleTestId,
  githubTestId,
}) => {
  if (!showGoogle && !showGithub) return null;
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        width: "100%",
      }}
    >
      {showGoogle && (
        <GoogleAuthButton label={googleLabel} onClick={onGoogle} testId={googleTestId} />
      )}
      {showGithub && onGithub && (
        <GithubAuthButton
          onClick={onGithub}
          testId={githubTestId}
          label={githubLabel}
          ariaLabel={githubAriaLabel}
        />
      )}
    </Box>
  );
};

export default SocialAuthButtons;
