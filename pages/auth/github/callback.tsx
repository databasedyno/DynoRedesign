import axiosBaseApi from "@/axiosConfig";
import Loading from "@/Components/UI/Loading";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_LOGIN, USER_LOGIN_2FA_REQUIRED } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import { useRouter } from "next/router";
import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

/**
 * GitHub OAuth callback — /auth/github/callback
 *
 * GitHub redirects here with ?code=...&state=... after the user authorizes.
 * We validate the state (CSRF), then hand the one-time code to the backend
 * (POST /api/user/github-signin) which exchanges it server-side (the client
 * secret never reaches the browser) and returns a normal Dynopay session.
 */
const GithubCallback = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const userState = useSelector((state: rootReducer) => state.userReducer);
  const exchangingRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || exchangingRef.current) return;

    const { code, state, error, error_description } = router.query as Record<string, string>;

    // User denied access or GitHub returned an error
    if (error) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: error_description || "GitHub sign-in was cancelled",
          severity: "error",
        },
      });
      router.replace("/auth/login");
      return;
    }

    if (!code) {
      router.replace("/auth/login");
      return;
    }

    // CSRF check — compare state with the value stashed before redirecting
    let expectedState: string | null = null;
    try {
      expectedState = sessionStorage.getItem("gh_oauth_state");
      sessionStorage.removeItem("gh_oauth_state");
    } catch {
      /* sessionStorage unavailable */
    }
    if (expectedState && state && expectedState !== state) {
      dispatch({
        type: TOAST_SHOW,
        payload: { message: "GitHub sign-in failed (state mismatch). Please try again.", severity: "error" },
      });
      router.replace("/auth/login");
      return;
    }

    exchangingRef.current = true;

    const exchange = async () => {
      try {
        const redirectUri = `${window.location.origin}/auth/github/callback`;
        const {
          data: { data, message },
        } = await axiosBaseApi.post("user/github-signin", { code, redirectUri });

        if (data?.requires_2fa) {
          // Account has TOTP enabled — the login page hosts the 2FA prompt.
          dispatch({ type: USER_LOGIN_2FA_REQUIRED, payload: { challenge_token: data.challenge_token, method: data.method, masked_email: data.masked_email } });
          router.replace("/auth/login");
          return;
        }

        if (data?.userData && data?.accessToken) {
          dispatch({ type: TOAST_SHOW, payload: { message: message || "Login successful" } });
          dispatch({
            type: USER_LOGIN,
            payload: {
              ...data.userData,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            },
          });
        } else {
          throw new Error("Invalid response");
        }
      } catch (e: any) {
        const message =
          e.response?.data?.message ?? e.message ?? "GitHub sign-in failed";
        dispatch({ type: TOAST_SHOW, payload: { message, severity: "error" } });
        exchangingRef.current = false;
        router.replace("/auth/login");
      }
    };

    exchange();
  }, [router.isReady]); // eslint-disable-line

  // Once the session lands in the store, go to the dashboard. Gate on the
  // session (email) not the name — a GitHub account with only a username is
  // stored name-less on purpose, and must still reach the dashboard where the
  // NameGate collects a real first + last name.
  useEffect(() => {
    if (userState.email || userState.name) {
      router.replace("/dashboard");
    }
  }, [userState]); // eslint-disable-line

  return <Loading />;
};

export default GithubCallback;
