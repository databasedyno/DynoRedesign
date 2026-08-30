import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useDispatch } from "react-redux";
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircleRounded,
  ErrorOutlineRounded,
  GroupAddRounded,
} from "@mui/icons-material";

import axiosBaseApi from "@/axiosConfig";
import { USER_REGISTER } from "@/Redux/Actions/UserAction";

interface InviteInfo {
  email: string;
  email_has_account: boolean;
  invited_by: string | null;
  companies: { company_id: number; company_name: string | null; role: string }[];
  expires_at?: string;
}

/**
 * PUBLIC page — a teammate accepts a company invite here.
 *  - New email  -> set name + password -> account created + logged in -> /dashboard.
 *  - Existing email -> just link + prompt to log in.
 * Lives under /auth so _app renders it on the auth surface (and the login
 * reload-loop guards apply).
 */
const AcceptInvitePage = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const token = typeof router.query.token === "string" ? router.query.token : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (!token) {
      setError("This invite link is missing its token.");
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await axiosBaseApi.get(`team/invite/${encodeURIComponent(token)}`);
        if (mounted) setInfo(res?.data?.data || null);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } };
        if (mounted) setError(err?.response?.data?.message || "This invite is invalid or has expired.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router.isReady, token]);

  const accept = useCallback(async () => {
    if (!token) return;
    if (info && !info.email_has_account && (!password || password.length < 8)) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await axiosBaseApi.post("team/accept", {
        token,
        name: name.trim() || undefined,
        password,
      });
      const d = res?.data?.data || {};
      if (d.accessToken) {
        // Log the new teammate in (mirror the login/register reducer + token store).
        try {
          localStorage.setItem("token", d.accessToken);
        } catch {
          /* ignore */
        }
        dispatch({
          type: USER_REGISTER,
          payload: {
            accessToken: d.accessToken,
            email: d.userData?.email,
            name: d.userData?.name,
            email_verified: true,
          },
        });
        router.replace("/dashboard");
      } else if (d.needs_login) {
        router.replace("/auth/login");
      } else {
        setError("Unexpected response. Please try logging in.");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || "Couldn't accept the invite.");
    } finally {
      setSubmitting(false);
    }
  }, [token, info, name, password, dispatch, router]);

  return (
    <>
      <Head>
        <title>Accept invite · Dynopay</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
          bgcolor: "background.default",
        }}
      >
        <Paper elevation={0} sx={{ width: "100%", maxWidth: 460, p: { xs: 3, sm: 4 }, borderRadius: 3, border: (th) => `1px solid ${th.palette.divider}` }}>
          {loading ? (
            <Box sx={{ py: 6, display: "flex", justifyContent: "center" }} data-testid="accept-invite-loading">
              <CircularProgress size={28} />
            </Box>
          ) : error && !info ? (
            <Stack alignItems="center" gap={1.5} sx={{ textAlign: "center", py: 2 }} data-testid="accept-invite-error">
              <ErrorOutlineRounded color="error" sx={{ fontSize: 40 }} />
              <Typography variant="h6" fontWeight={700}>
                Invite unavailable
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {error}
              </Typography>
              <Button variant="contained" onClick={() => router.replace("/auth/login")} sx={{ mt: 1, textTransform: "none" }}>
                Go to login
              </Button>
            </Stack>
          ) : info ? (
            <Stack gap={2} data-testid="accept-invite-form">
              <Stack alignItems="center" gap={1} sx={{ textAlign: "center" }}>
                <GroupAddRounded color="primary" sx={{ fontSize: 40 }} />
                <Typography variant="h6" fontWeight={700}>
                  {`You've been invited${info.invited_by ? ` by ${info.invited_by}` : ""}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Join{" "}
                  <strong>
                    {info.companies?.map((c) => c.company_name || `Business #${c.company_id}`).join(", ")}
                  </strong>{" "}
                  as{" "}
                  <strong style={{ textTransform: "capitalize" }}>{info.companies?.[0]?.role || "member"}</strong>.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {info.email}
                </Typography>
              </Stack>

              {info.email_has_account ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                    You already have a Dynopay account for this email. Accept the invite, then log in to access the shared business.
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={accept}
                    disabled={submitting}
                    data-testid="accept-invite-submit"
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    {submitting ? "Accepting..." : "Accept & continue to login"}
                  </Button>
                </>
              ) : (
                <>
                  <TextField
                    label="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                    size="small"
                    data-testid="accept-invite-name"
                  />
                  <TextField
                    label="Create a password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    size="small"
                    helperText="At least 8 characters."
                    data-testid="accept-invite-password"
                  />
                  {error && (
                    <Typography variant="body2" color="error">
                      {error}
                    </Typography>
                  )}
                  <Button
                    variant="contained"
                    onClick={accept}
                    disabled={submitting}
                    data-testid="accept-invite-submit"
                    sx={{ textTransform: "none", fontWeight: 600 }}
                    startIcon={submitting ? undefined : <CheckCircleRounded />}
                  >
                    {submitting ? "Setting up..." : "Accept invite & join"}
                  </Button>
                </>
              )}
            </Stack>
          ) : null}
        </Paper>
      </Box>
    </>
  );
};

export default AcceptInvitePage;
