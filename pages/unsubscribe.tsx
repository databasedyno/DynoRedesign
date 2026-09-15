import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";

type Status = "loading" | "success" | "invalid";

// Public unsubscribe page for referral invite/reminder emails
// (links look like /unsubscribe?token=...). Calls the tokenized backend
// endpoint — no login required.
export default function UnsubscribePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const requested = useRef(false);

  useEffect(() => {
    if (!router.isReady || requested.current) return;
    const token = typeof router.query.token === "string" ? router.query.token : "";
    if (!token) {
      setStatus("invalid");
      setMessage("This unsubscribe link is missing its token. Please use the link from your email.");
      return;
    }
    requested.current = true;
    fetch(`/api/user/unsubscribe-reminders/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.ok) {
          setStatus("success");
          setMessage(
            body?.data?.message ||
              "You will no longer receive these emails. Your discount code stays valid if you decide to sign up later.",
          );
        } else {
          setStatus("invalid");
          setMessage(body?.message || "This unsubscribe link is invalid or has expired.");
        }
      })
      .catch(() => {
        setStatus("invalid");
        setMessage("Something went wrong. Please try the link again in a moment.");
      });
  }, [router.isReady, router.query.token]);

  return (
    <>
      <Head>
        <title>Unsubscribe — Dynopay</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          px: 2,
        }}
      >
        <Box
          data-testid="unsubscribe-card"
          sx={{
            width: "100%",
            maxWidth: 440,
            textAlign: "center",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            p: { xs: 3, sm: 5 },
            bgcolor: "background.paper",
          }}
        >
          {status === "loading" && (
            <Box data-testid="unsubscribe-loading">
              <CircularProgress size={32} />
              <Typography sx={{ mt: 2, color: "text.secondary" }}>
                Processing your request…
              </Typography>
            </Box>
          )}
          {status === "success" && (
            <Box data-testid="unsubscribe-success">
              <CheckCircleRoundedIcon sx={{ fontSize: 44, color: "#12B76A" }} />
              <Typography variant="h6" sx={{ mt: 1.5, fontWeight: 700 }}>
                You&apos;re unsubscribed
              </Typography>
              <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 14 }}>
                {message}
              </Typography>
            </Box>
          )}
          {status === "invalid" && (
            <Box data-testid="unsubscribe-error">
              <ErrorOutlineRoundedIcon sx={{ fontSize: 44, color: "#f59e0b" }} />
              <Typography variant="h6" sx={{ mt: 1.5, fontWeight: 700 }}>
                Link not valid
              </Typography>
              <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 14 }}>
                {message}
              </Typography>
              <Typography sx={{ mt: 1.5, color: "text.secondary", fontSize: 13.5 }} data-testid="unsubscribe-invalid-help">
                Unsubscribe links are single-use and expire after a while. You can still turn any email off:{" "}
                <Box component="a" href="/settings?section=notifications" sx={{ color: "primary.main", fontWeight: 600 }} data-testid="unsubscribe-settings-link">
                  sign in → Settings → Notifications
                </Box>
                , or{" "}
                <Box component="a" href="/help-support" sx={{ color: "primary.main", fontWeight: 600 }} data-testid="unsubscribe-support-link">
                  ask support
                </Box>{" "}
                to do it for you.
              </Typography>
            </Box>
          )}
          <Button
            href="/"
            data-testid="unsubscribe-home-btn"
            sx={{ mt: 3, textTransform: "none" }}
          >
            Back to Dynopay
          </Button>
        </Box>
      </Box>
    </>
  );
}

// Public tokenized page — must render OUTSIDE the authenticated app shell
// (the default "client" layout redirects logged-out visitors to /auth/login).
UnsubscribePage.layout = "none";
