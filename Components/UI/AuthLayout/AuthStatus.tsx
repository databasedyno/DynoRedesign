import React from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import CustomButton from "@/Components/UI/Buttons";

type Tone = "neutral" | "success" | "error" | "loading";

interface AuthStatusProps {
  tone?: Tone;
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; onClick: () => void; testId?: string };
  secondary?: React.ReactNode;
  testId?: string;
  titleTestId?: string;
  descriptionTestId?: string;
  children?: React.ReactNode;
}

/** Outcome card body shared by the link-based auth screens (secure account, invite). */
const AuthStatus: React.FC<AuthStatusProps> = ({ tone = "neutral", icon, title, description, action, secondary, testId, titleTestId, descriptionTestId, children }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const toneColor =
    tone === "success" ? (dark ? "#34D399" : "#059669") : tone === "error" ? (dark ? "#FB7185" : "#BE123C") : theme.palette.primary.main;
  const toneBg =
    tone === "success" ? (dark ? "rgba(52,211,153,0.14)" : "rgba(5,150,105,0.10)") : tone === "error" ? (dark ? "rgba(251,113,133,0.14)" : "rgba(190,18,60,0.08)") : dark ? "rgba(129,140,248,0.16)" : "rgba(79,70,229,0.08)";

  return (
    <Box data-testid={testId} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1.5 }}>
      <Box aria-hidden sx={{ width: 48, height: 48, borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", color: toneColor, backgroundColor: toneBg }}>
        {tone === "loading" ? <CircularProgress size={22} sx={{ color: toneColor }} /> : icon}
      </Box>
      <Typography component="h1" data-testid={titleTestId} sx={{ fontSize: { xs: 18, sm: 19 }, fontFamily: "var(--font-hero), var(--font-sans)", fontWeight: 500, lineHeight: 1.25, letterSpacing: "-0.01em", color: theme.palette.text.primary, m: 0 }}>
        {title}
      </Typography>
      {description && (
        <Typography data-testid={descriptionTestId} sx={{ fontSize: { xs: 14, sm: 14.5 }, fontFamily: "var(--font-body), var(--font-sans)", lineHeight: 1.5, color: theme.palette.text.secondary }}>
          {description}
        </Typography>
      )}
      {children}
      {action && (
        <Box sx={{ width: "100%", mt: 1 }}>
          <CustomButton label={action.label} variant="primary" size="medium" fullWidth onClick={action.onClick} data-testid={action.testId} />
        </Box>
      )}
      {secondary}
    </Box>
  );
};

export default AuthStatus;
