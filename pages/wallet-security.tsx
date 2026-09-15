import Head from "next/head";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NextPageWithLayout } from "./_app";

type Status = "loading" | "success" | "expired" | "error";

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

const brand = {
  bg: "#0B0B12",
  card: "#14141C",
  border: "rgba(255,255,255,0.08)",
  text: "#F4F4F6",
  sub: "#A1A1AA",
  indigo: "#818CF8",
  emerald: "#34D399",
  rose: "#FB7185",
};

const WalletSecurityPage: NextPageWithLayout = () => {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [networks, setNetworks] = useState<string[]>([]);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || firedRef.current) return;
    const token = String(router.query.token || "").trim();
    if (!token) {
      setStatus("expired");
      return;
    }
    firedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/wallet-security/revert-change`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.data?.reverted) {
          setNetworks(json.data.networks || []);
          setStatus("success");
        } else if (res.status === 410 || res.status === 400 || res.status === 401 || res.status === 404) {
          // Expired, already used, or not a real token → same calm explanation.
          setStatus("expired");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    })();
  }, [router.isReady, router.query.token]);

  const accent =
    status === "success" ? brand.emerald : status === "loading" ? brand.indigo : brand.rose;

  const IconMark = () => {
    if (status === "success") {
      return (
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    }
    if (status === "loading") {
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" style={{ animation: "wsspin 0.9s linear infinite" }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      );
    }
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  };

  const title =
    status === "loading"
      ? t("walletSecurityLanding.loadingTitle", { defaultValue: "Securing your account…" })
      : status === "success"
        ? t("walletSecurityLanding.successTitle", { defaultValue: "Your account is secured" })
        : status === "expired"
          ? t("walletSecurityLanding.expiredTitle", { defaultValue: "This link has expired" })
          : t("walletSecurityLanding.errorTitle", { defaultValue: "Something went wrong" });

  const body =
    status === "loading"
      ? t("walletSecurityLanding.loadingBody", { defaultValue: "Undoing the payout address change and locking further edits. This only takes a moment." })
      : status === "success"
        ? t("walletSecurityLanding.successBody", {
            networks: networks.length ? ` (${networks.join(", ")})` : "",
            defaultValue: "We've undone the recent payout address change(s){{networks}} and locked payout address changes on your account. To make new payout address changes, contact support so we can confirm it's really you.",
          })
        : status === "expired"
          ? t("walletSecurityLanding.expiredBody", { defaultValue: "This security link has already been used, has expired, or isn't valid. If you didn't make the payout address change yourself, sign in now, go to Settings → Security, remove the wallet you don't recognise and change your password — then contact support right away." })
          : t("walletSecurityLanding.errorBody", { defaultValue: "We couldn't complete this action. Please try again, or contact support if the problem continues." });

  return (
    <>
      <Head>
        <title>{t("walletSecurityLanding.pageTitle", { defaultValue: "Account security" })} · DynoPay</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <style>{`@keyframes wsspin{to{transform:rotate(360deg)}}`}</style>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.bg,
          padding: 20,
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        }}
      >
        <div
          data-testid="wallet-security-card"
          data-status={status}
          style={{
            width: "100%",
            maxWidth: 460,
            background: brand.card,
            border: `1px solid ${brand.border}`,
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 20px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              background: `${accent}1f`,
              border: `1px solid ${accent}55`,
            }}
          >
            <IconMark />
          </div>
          <h1
            data-testid="wallet-security-title"
            style={{ color: brand.text, fontSize: 22, fontWeight: 700, margin: "0 0 10px", letterSpacing: -0.3 }}
          >
            {title}
          </h1>
          <p style={{ color: brand.sub, fontSize: 14.5, lineHeight: 1.6, margin: "0 0 28px" }}>{body}</p>

          {status !== "loading" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <a
                href="https://dynopay.com/help-support"
                data-testid="wallet-security-support-btn"
                style={{
                  display: "block",
                  padding: "13px 20px",
                  borderRadius: 10,
                  background: brand.indigo,
                  color: "#0B0B12",
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: "none",
                }}
              >
                {t("walletSecurityLanding.contactSupport", { defaultValue: "Contact support" })}
              </a>
              <button
                onClick={() => router.push("/auth/login")}
                style={{
                  padding: "12px 20px",
                  borderRadius: 10,
                  background: "transparent",
                  color: brand.sub,
                  fontWeight: 600,
                  fontSize: 14,
                  border: `1px solid ${brand.border}`,
                  cursor: "pointer",
                }}
              >
                {t("walletSecurityLanding.backToLogin", { defaultValue: "Back to log in" })}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

WalletSecurityPage.layout = "none";

export default WalletSecurityPage;
