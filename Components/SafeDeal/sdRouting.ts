/**
 * SafeDeal routing helpers. Pages live under /safedeal/* in this Next.js app.
 * On the production host (safedeal.sh) the middleware rewrites "/x" → "/safedeal/x",
 * so links must be host-aware: no prefix on safedeal.sh, "/safedeal" elsewhere.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { sdSession, SdUser } from "@/api/safedeal";

export const SAFEDEAL_HOSTS = ["safedeal.sh", "www.safedeal.sh"];

export function isSafeDealHost(host?: string | null): boolean {
  const h = String(host || "").toLowerCase().split(":")[0];
  return SAFEDEAL_HOSTS.includes(h);
}

export function useSdBase(): string {
  const [base, setBase] = useState("/safedeal");
  useEffect(() => {
    if (typeof window !== "undefined" && isSafeDealHost(window.location.host)) setBase("");
  }, []);
  return base;
}

/** Build an in-app SafeDeal href ("/deals" → "/safedeal/deals" in preview, "/deals" on safedeal.sh). */
export function useSdHref(): (path: string) => string {
  const base = useSdBase();
  return (path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`.replace(/\/$/, "") || "/";
}

/** Reactive SafeDeal session (token + user) shared across pages. */
export function useSdSession(): { user: SdUser | null; token: string | null; ready: boolean; signOut: () => void } {
  const [state, setState] = useState<{ user: SdUser | null; token: string | null; ready: boolean }>({ user: null, token: null, ready: false });
  useEffect(() => {
    const read = () => setState({ user: sdSession.user(), token: sdSession.token(), ready: true });
    read();
    window.addEventListener("sd-session", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("sd-session", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return { ...state, signOut: () => sdSession.clear() };
}

/** Redirect to sign-in (preserving the return path) when there is no session. */
export function useRequireSdSession(): { user: SdUser | null; ready: boolean } {
  const { user, token, ready } = useSdSession();
  const router = useRouter();
  const href = useSdHref();
  useEffect(() => {
    if (!ready || token) return;
    const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
    void router.replace(href(`/signin?next=${encodeURIComponent(next)}`));
  }, [ready, token, router, href]);
  return { user, ready: ready && !!token };
}
