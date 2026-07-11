import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import Loading from "@/Components/UI/Loading";

// iOS Safari/Chrome can lag on making a fresh localStorage write visible right
// after a client-side SPA navigation. If we redirect the instant the token
// looks missing, a user who JUST logged in gets bounced back to /auth/login.
// So on first mount we retry the token check a few times over a short window
// (and also react to cross-tab `storage` writes) before giving up.
const RETRY_INTERVAL_MS = 120;
const MAX_ATTEMPTS = 8; // ~960ms grace window

const withAuth = (WrappedComponent: any) => {
  const AuthChecker = (props: any) => {
    const Router = useRouter();
    const [isReady, setIsReady] = useState(false);
    const checkedRef = useRef(false);

    useEffect(() => {
      if (checkedRef.current) return;
      checkedRef.current = true;

      let cancelled = false;
      let attempts = 0;
      let timer: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        cancelled = true;
        clearTimeout(timer);
        window.removeEventListener("storage", onStorage);
      };

      const onStorage = (e: StorageEvent) => {
        if (e.key === "token" && e.newValue) {
          cleanup();
          setIsReady(true);
        }
      };

      const tryAuth = () => {
        if (cancelled) return;
        const token = localStorage.getItem("token");
        if (token) {
          cleanup();
          setIsReady(true);
        } else if (attempts >= MAX_ATTEMPTS) {
          cleanup();
          Router.replace("/auth/login");
        } else {
          attempts += 1;
          timer = setTimeout(tryAuth, RETRY_INTERVAL_MS);
        }
      };

      window.addEventListener("storage", onStorage);
      tryAuth();

      return cleanup;
    }, []);

    // On subsequent navigations, just verify token still exists
    useEffect(() => {
      if (!isReady) return;
      const token = localStorage.getItem("token");
      if (!token) {
        Router.replace("/auth/login");
      }
    }, [Router.pathname, isReady]);

    return isReady ? <WrappedComponent {...props} /> : <Loading />;
  };
  return AuthChecker;
};

export default withAuth;
