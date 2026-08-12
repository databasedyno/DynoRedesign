import { brandFg } from "@/constants/theme";
import React, { useEffect, useState } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/router";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import axiosBaseApi from "@/axiosConfig";

const SecureAccountPage = () => {
  const theme = useTheme();
  const router = useRouter();
  const { token } = router.query;

  const [status, setStatus] = useState<"loading" | "success" | "error" | "invalid">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || typeof token !== "string") return;

    const flagLogin = async () => {
      try {
        const res = await axiosBaseApi.post("user/security/flag-login", { token });
        setStatus("success");
        setMessage(res.data?.message || "Account secured successfully.");
      } catch (e: any) {
        const msg = e.response?.data?.message || "Failed to process request.";
        if (e.response?.status === 404) {
          setStatus("invalid");
          setMessage("This security link has already been used or is invalid.");
        } else {
          setStatus("error");
          setMessage(msg);
        }
      }
    };

    flagLogin();
  }, [token]);

  const statusConfig = {
    loading: {
      icon: <CircularProgress size={48} />,
      title: "Securing your account...",
      subtitle: "Please wait while we process your request.",
      color: brandFg(theme.palette.mode === "dark"),
    },
    success: {
      icon: <CheckCircleOutlineIcon sx={{ fontSize: 56, color: "#22c55e" }} />,
      title: "Account Secured",
      subtitle: message,
      color: "#22c55e",
    },
    error: {
      icon: <ErrorOutlineIcon sx={{ fontSize: 56, color: "#ef4444" }} />,
      title: "Something went wrong",
      subtitle: message,
      color: "#ef4444",
    },
    invalid: {
      icon: <ShieldOutlinedIcon sx={{ fontSize: 56, color: theme.palette.text.secondary }} />,
      title: "Link expired or already used",
      subtitle: message,
      color: theme.palette.text.secondary,
    },
  };

  const cfg = statusConfig[status];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Box
        data-testid="secure-account-card"
        sx={{
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          p: { xs: 3, sm: 4 },
          borderRadius: "16px",
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box sx={{ mb: 2.5 }}>{cfg.icon}</Box>
        <Typography
          data-testid="secure-account-title"
          sx={{
            fontSize: { xs: "20px", sm: "24px" },
            fontWeight: 700,
            fontFamily: "var(--font-sans)",
            color: theme.palette.text.primary,
            mb: 1,
          }}
        >
          {cfg.title}
        </Typography>
        <Typography
          data-testid="secure-account-message"
          sx={{
            fontSize: { xs: "13px", sm: "14px" },
            color: theme.palette.text.secondary,
            fontFamily: "var(--font-sans)",
            lineHeight: 1.6,
            mb: 3,
          }}
        >
          {cfg.subtitle}
        </Typography>

        {status === "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Typography
              sx={{
                fontSize: "13px",
                color: theme.palette.text.secondary,
                fontFamily: "var(--font-sans)",
                p: "12px 16px",
                borderRadius: "8px",
                backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                textAlign: "left",
                lineHeight: 1.5,
              }}
            >
              <strong>What happens next:</strong><br />
              • Your account has been temporarily locked for 24 hours<br />
              • All active sessions have been flagged<br />
              • Reset your password to regain access
            </Typography>
            <Typography
              component="a"
              href="/auth/login"
              sx={{
                mt: 1,
                display: "inline-block",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                color: brandFg(theme.palette.mode === "dark"),
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Go to Login →
            </Typography>
          </Box>
        )}

        {(status === "error" || status === "invalid") && (
          <Typography
            component="a"
            href="/auth/login"
            sx={{
              display: "inline-block",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              color: brandFg(theme.palette.mode === "dark"),
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Go to Login →
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default SecureAccountPage;
