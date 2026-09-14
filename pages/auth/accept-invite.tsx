import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import { brandFg } from "@/constants/theme";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import GroupAddRounded from "@mui/icons-material/GroupAddRounded";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

import axiosBaseApi from "@/axiosConfig";
import { USER_REGISTER } from "@/Redux/Actions/UserAction";
import AuthShell from "@/Components/UI/AuthLayout/AuthShell";
import AuthStatus from "@/Components/UI/AuthLayout/AuthStatus";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PasswordValidation from "@/Components/UI/AuthLayout/PasswordValidation";
import CustomButton from "@/Components/UI/Buttons";

interface InviteInfo {
  email: string;
  email_has_account: boolean;
  invited_by: string | null;
  companies: { company_id: number; company_name: string | null; role: string }[];
  expires_at?: string;
}

const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-=__+{}\[\]:;<>,.?/~]).{8,20}$/;

/**
 * PUBLIC page — a teammate accepts a company invite here.
 *  - New email  -> set name + password -> account created + logged in -> /dashboard.
 *  - Existing email -> just link + prompt to log in.
 * Lives under /auth so _app renders it on the auth surface (and the login
 * reload-loop guards apply). Same frame as login / register (AuthShell).
 */
const AcceptInvitePage = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation("common");
  const token = typeof router.query.token === "string" ? router.query.token : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const passwordFieldRef = useRef<HTMLDivElement | null>(null);

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

  const headTitle = `${t("acceptInvite.headTitle", { defaultValue: "Accept invite · Dynopay" })}`;
  const companiesStr = info?.companies?.map((c) => c.company_name || `Business #${c.company_id}`).join(", ") || "";
  const roleRaw = info?.companies?.[0]?.role || "member";
  const roleStr =
    roleRaw === "admin"
      ? t("acceptInvite.roleAdmin", { defaultValue: "admin" })
      : t("acceptInvite.roleMember", { defaultValue: "member" });

  const eyeIcon = showPassword ? (
    <VisibilityOffIcon sx={{ color: theme.palette.text.secondary, height: "18px", width: "16px" }} />
  ) : (
    <VisibilityIcon sx={{ color: theme.palette.text.secondary, height: "18px", width: "16px" }} />
  );

  return (
    <AuthShell title={headTitle} testId="accept-invite-page">
      {loading ? (
        <AuthStatus
          tone="loading"
          title={t("acceptInvite.checkingTitle", { defaultValue: "Checking your invite…" })}
          description={t("acceptInvite.checkingSubtitle", { defaultValue: "One moment while we look it up." })}
          testId="accept-invite-loading"
        />
      ) : error && !info ? (
        <AuthStatus
          tone="error"
          icon={<ErrorOutlineRounded fontSize="medium" />}
          title={t("acceptInvite.unavailableTitle", { defaultValue: "Invite unavailable" })}
          description={error}
          action={{ label: t("acceptInvite.goToLogin", { defaultValue: "Go to login" }), onClick: () => router.replace("/auth/login"), testId: "accept-invite-login-btn" }}
          testId="accept-invite-error"
        />
      ) : info ? (
        <Box data-testid="accept-invite-form" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box aria-hidden sx={{ width: 48, height: 48, borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", color: brandFg(theme.palette.mode === "dark"), backgroundColor: theme.palette.mode === "dark" ? "rgba(129,140,248,0.16)" : "rgba(79,70,229,0.08)" }}>
            <GroupAddRounded fontSize="medium" />
          </Box>
          <TitleDescription
            title={
              info.invited_by
                ? t("acceptInvite.invitedByTitle", { defaultValue: `You've been invited by ${info.invited_by}`, name: info.invited_by })
                : t("acceptInvite.invitedTitle", { defaultValue: "You've been invited" })
            }
            description={
              <>
                {t("acceptInvite.joinLine", { defaultValue: `Join ${companiesStr} as ${roleStr}.`, companies: companiesStr, role: roleStr })}{" "}
                <Box component="span" sx={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: theme.palette.text.primary }} data-testid="accept-invite-email">
                  {info.email}
                </Box>
              </>
            }
            align="left"
          />

          {info.email_has_account ? (
            <>
              <Typography sx={{ fontSize: 14, lineHeight: 1.5, fontFamily: "var(--font-body), var(--font-sans)", color: theme.palette.text.secondary }}>
                {t("acceptInvite.existingAccountNote", {
                  defaultValue:
                    "You already have a Dynopay account for this email. Accept the invite, then log in to access the shared business.",
                })}
              </Typography>
              {error && <Typography role="alert" sx={{ fontSize: 13.5, color: theme.palette.error.main }} data-testid="accept-invite-error-text">{error}</Typography>}
              <CustomButton
                label={submitting ? t("acceptInvite.accepting", { defaultValue: "Accepting..." }) : t("acceptInvite.acceptContinueLogin", { defaultValue: "Accept & continue to login" })}
                variant="primary"
                size="medium"
                fullWidth
                onClick={accept}
                disabled={submitting}
                data-testid="accept-invite-submit"
              />
              <Typography sx={{ fontSize: 13, textAlign: "center", fontFamily: "var(--font-body), var(--font-sans)", color: theme.palette.text.secondary }}>
                {t("acceptInvite.forgotPrefix", { defaultValue: "Forgot your password?" })}{" "}
                <Box
                  component="button"
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  data-testid="accept-invite-forgot-password"
                  sx={{ border: 0, p: 0, background: "none", cursor: "pointer", font: "inherit", fontWeight: 600, color: brandFg(theme.palette.mode === "dark"), textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  {t("acceptInvite.forgotLink", { defaultValue: "Reset it on the login page" })}
                </Box>
                .
              </Typography>
            </>
          ) : (
            <>
              <InputField
                label={t("acceptInvite.nameLabel", { defaultValue: "Your name" })}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("acceptInvite.namePlaceholder", { defaultValue: "How teammates will see you" })}
                autoComplete="name"
                data-testid="accept-invite-name"
              />
              <Box ref={passwordFieldRef} sx={{ position: "relative", width: "100%" }}>
                <InputField
                  label={t("acceptInvite.passwordLabel", { defaultValue: "Create a password" })}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => { setPassword(e.target.value); setShowRules(!PASSWORD_RULE.test(e.target.value)); }}
                  onFocus={() => { if (!PASSWORD_RULE.test(password)) setShowRules(true); }}
                  onBlur={() => setTimeout(() => setShowRules(false), 200)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !submitting && password) { e.preventDefault(); accept(); } }}
                  helperText={t("acceptInvite.passwordHelper", { defaultValue: "At least 8 characters." })}
                  sideButton
                  sideButtonType="primary"
                  sideButtonIcon={eyeIcon}
                  onSideButtonClick={() => setShowPassword((v) => !v)}
                  showPasswordToggle
                  data-testid="accept-invite-password"
                />
                <PasswordValidation password={password} anchorEl={passwordFieldRef.current} open={showRules} onClose={() => setShowRules(false)} showOnMobile={showRules} />
              </Box>
              {error && <Typography role="alert" sx={{ fontSize: 13.5, color: theme.palette.error.main }} data-testid="accept-invite-error-text">{error}</Typography>}
              <CustomButton
                label={submitting ? t("acceptInvite.settingUp", { defaultValue: "Setting up..." }) : t("acceptInvite.acceptJoin", { defaultValue: "Accept invite & join" })}
                variant="primary"
                size="medium"
                fullWidth
                onClick={accept}
                disabled={submitting}
                data-testid="accept-invite-submit"
              />
            </>
          )}
        </Box>
      ) : null}
    </AuthShell>
  );
};

export default AcceptInvitePage;
