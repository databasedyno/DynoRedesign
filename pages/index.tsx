import HomePage from "@/Components/Page/Home";
import { Box } from "@mui/material";
import Head from "next/head";
import { useRouter } from "next/router";
import { memo, useEffect } from "react";
import { AUTH_PERSISTENCE, enforceSessionPersistence } from "@/helpers/authPersistence";
import { decodeJwt } from "@/utils/decodeJwt";

/** `dynopay.com/?view=landing` always shows the marketing page, even when signed in. */
const LANDING_OVERRIDE = /[?&]view=landing(?:&|$)/;

const hasLiveSession = (): boolean => {
  if (!enforceSessionPersistence()) return false;
  const token = localStorage.getItem("token");
  if (!token) return false;
  const exp = decodeJwt<{ exp?: number }>(token)?.exp;
  if (!exp || exp * 1000 > Date.now()) return true;
  // Expired access token: still a session if it can be refreshed; otherwise drop it so no
  // page-level authed call 401s and bounces the visitor to /auth/login.
  if (localStorage.getItem("refreshToken")) return true;
  localStorage.removeItem("token");
  return false;
};

/* Runs inline in <head> before first paint so a signed-in merchant who opens
 * dynopay.com in a new tab goes straight to the dashboard with no landing flash.
 * Mirrors hasLiveSession(). Any error (malformed token, no storage) = no-op. */
const { PERSIST_KEY, HEARTBEAT_KEY, GRACE_MS } = AUTH_PERSISTENCE;
const EARLY_REDIRECT = `(function(){try{if(/[?&]view=landing(?:&|$)/.test(location.search))return;var t=localStorage.getItem('token');if(!t)return;var p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(p&&p.exp&&p.exp*1000<Date.now()&&!localStorage.getItem('refreshToken')){localStorage.removeItem('token');return;}if(localStorage.getItem('${PERSIST_KEY}')==='0'){var h=parseInt(localStorage.getItem('${HEARTBEAT_KEY}')||'0',10);if(!h||Date.now()-h>${GRACE_MS})return;}location.replace('/dashboard');}catch(e){}})();`;

const Home = () => {
  const router = useRouter();

  // Client-side navigations to "/" (e.g. the in-app logo) — the head script only runs on a full load.
  useEffect(() => {
    if (LANDING_OVERRIDE.test(window.location.search)) return;
    if (hasLiveSession()) void router.replace("/dashboard");
  }, [router]);

  return (
    <Box height={"100%"} width={"100%"}>
      <Head>
        <script data-testid="home-authed-redirect" dangerouslySetInnerHTML={{ __html: EARLY_REDIRECT }} />
      </Head>
      <HomePage />
    </Box>
  );
};

export default memo(Home);
