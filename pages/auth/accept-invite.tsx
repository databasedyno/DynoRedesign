import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  CircularProgress,
  Link as MuiLink,
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
  const { t } = useTranslation("common");
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
      setError(t("acceptInvite.missingToken", { defaultValue: "This invite link is missing its token." }));
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
        if (mounted)
          setError(
            err?.response?.data?.message ||
              t("acceptInvite.invalidOrExpired", { defaultValue: "This invite is invalid or has expired." })
          );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router.isReady, token, t]);

  const accept = useCallback(async () => {
    if (!token) return;
    if (info && !info.email_has_account && (!password || password.length < 8)) {
      setError(t("acceptInvite.passwordTooShort", { defaultValue: "Choose a password with at least 8 characters." }));
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
          // Team members are joining an EXISTING business, not creating one —
          // suppress the merchant onboarding wizard on their first dashboard load
          // so it can't race an empty company list and auto-create a personal company.
          sessionStorage.setItem("dyno_suppress_onboarding", "1");
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
        setError(t("acceptInvite.unexpected", { defaultValue: "Unexpected response. Please try logging in." }));
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || t("acceptInvite.acceptFailed", { defaultValue: "Couldn't accept the invite." }));
    } finally {
      setSubmitting(false);
    }
  }, [token, info, name, password, dispatch, router, t]);

  return (
    <>
      <Head>
        <title>{t("acceptInvite.headTitle", { defaultValue: "Accept invite · Dynopay" })}</title>
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
                {t("acceptInvite.unavailableTitle", { defaultValue: "Invite unavailable" })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {error}
              </Typography>
              <Button variant="contained" onClick={() => router.replace("/auth/login")} sx={{ mt: 1, textTransform: "none" }}>
                {t("acceptInvite.goToLogin", { defaultValue: "Go to login" })}
              </Button>
            </Stack>
          ) : info ? (
            <Stack gap={2} data-testid="accept-invite-form">
              <Stack alignItems="center" gap={1} sx={{ textAlign: "center" }}>
                <GroupAddRounded color="primary" sx={{ fontSize: 40 }} />
                <Typography variant="h6" fontWeight={700}>
                  {info.invited_by
                    ? t("acceptInvite.invitedByTitle", {
                        defaultValue: `You've been invited by ${info.invited_by}`,
                        name: info.invited_by,
                      })
                    : t("acceptInvite.invitedTitle", { defaultValue: "You've been invited" })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(() => {
                    const companiesStr =
                      info.companies?.map((c) => c.company_name || `Business #${c.company_id}`).join(", ") || "";
                    const roleRaw = info.companies?.[0]?.role || "member";
                    const roleStr =
                      roleRaw === "admin"
                        ? t("acceptInvite.roleAdmin", { defaultValue: "admin" })
                        : t("acceptInvite.roleMember", { defaultValue: "member" });
                    return t("acceptInvite.joinLine", {
                      defaultValue: `Join ${companiesStr} as ${roleStr}.`,
                      companies: companiesStr,
                      role: roleStr,
                    });
                  })()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {info.email}
                </Typography>
              </Stack>

              {info.email_has_account ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                    {t("acceptInvite.existingAccountNote", {
                      defaultValue:
                        "You already have a Dynopay account for this email. Accept the invite, then log in to access the shared business.",
                    })}
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={accept}
                    disabled={submitting}
                    data-testid="accept-invite-submit"
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    {submitting
                      ? t("acceptInvite.accepting", { defaultValue: "Accepting..." })
                      : t("acceptInvite.acceptContinueLogin", { defaultValue: "Accept & continue to login" })}
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                    {t("acceptInvite.forgotPrefix", { defaultValue: "Forgot your password?" })}{" "}
                    <MuiLink
                      component="button"
                      type="button"
                      onClick={() => router.push("/auth/login")}
                      data-testid="accept-invite-forgot-password"
                      sx={{ fontWeight: 600, cursor: "pointer", verticalAlign: "baseline" }}
                    >
                      {t("acceptInvite.forgotLink", { defaultValue: "Reset it on the login page" })}
                    </MuiLink>
                    .
                  </Typography>
                </>
              ) : (
                <>
                  <TextField
                    label={t("acceptInvite.nameLabel", { defaultValue: "Your name" })}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                    size="small"
                    data-testid="accept-invite-name"
                  />
                  <TextField
                    label={t("acceptInvite.passwordLabel", { defaultValue: "Create a password" })}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    size="small"
                    helperText={t("acceptInvite.passwordHelper", { defaultValue: "At least 8 characters." })}
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
                    {submitting
                      ? t("acceptInvite.settingUp", { defaultValue: "Setting up..." })
                      : t("acceptInvite.acceptJoin", { defaultValue: "Accept invite & join" })}
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
