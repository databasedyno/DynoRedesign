import Loading from "@/Components/UI/Loading";
import { signOut } from "next-auth/react";
import { useRouter } from "next/router";
import React, { useEffect } from "react";

/**
 * /auth/validateSocialLogin — RETIRED (2026 security hardening).
 *
 * This page previously read the NextAuth Google session and POSTed it to
 * /api/user/connectSocial, which issued a Dynopay session WITHOUT any
 * server-side verification of the social identity (account-takeover vector).
 * Google sign-in now happens inline via the verified Google Identity Services
 * flow on /auth/login and /auth/register (POST /api/user/google-signin, which
 * validates the token against Google). If anything still lands here, clear the
 * stale NextAuth session and bounce back to the login page.
 */
const ValidateSocialLogin = () => {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        await signOut({ redirect: false });
      } catch {
        /* NextAuth session may not exist — ignore */
      }
      router.replace("/auth/login");
    })();
  }, [router]);

  return <Loading />;
};

export default ValidateSocialLogin;
