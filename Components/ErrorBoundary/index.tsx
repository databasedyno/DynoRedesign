import React, { Component, ErrorInfo, ReactNode } from "react";
import i18n from "@/i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Purge checkout/payment client state that can otherwise wedge a returning
  // visitor into a permanent crash loop. A legacy/corrupt value left by an
  // older build (e.g. a plain string where JSON is now expected) can throw
  // during render on EVERY load — and because sessionStorage survives reloads
  // in the same tab, "Refresh Page" alone never fixes it (this is exactly the
  // "works on a fresh browser / mobile, but keeps failing on my desktop"
  // report). Clearing these keys makes a reload actually self-heal, regardless
  // of which JS build the browser happens to be running.
  static clearCheckoutStorage() {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem("payment_active_step");
      sessionStorage.removeItem("payment_transfer_method");
      // per-transaction crypto payment state: payment_state_<transactionId>
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith("payment_state_")) sessionStorage.removeItem(k);
      });
    } catch {
      /* storage unavailable — nothing to clear */
    }
  }

  // ─── Reload-loop guard (storage-independent) ───
  // The old guard stored the last-reload timestamp ONLY in sessionStorage. On
  // Firefox mobile (Enhanced Tracking Protection / private mode) that write can
  // be silently discarded across reloads, so the "one reload per 2 min" throttle
  // never engaged and the auto-recovery reload became an infinite, millisecond-
  // fast refresh loop. The URL marker below ALWAYS survives a reload, so the
  // throttle can never fail open.
  static RELOAD_PARAM = "_ebr";

  static isAuthRoute(): boolean {
    if (typeof window === "undefined") return false;
    const p = window.location.pathname || "";
    return (
      p.startsWith("/auth") || p === "/reset-password" || p === "/admin/login"
    );
  }

  static recentlyAutoReloaded(): boolean {
    if (typeof window === "undefined") return true;
    const WINDOW_MS = 2 * 60 * 1000;
    // 1) URL marker — survives a reload even when storage is blocked.
    try {
      const v = Number(
        new URLSearchParams(window.location.search).get(
          ErrorBoundary.RELOAD_PARAM,
        ) || 0,
      );
      if (v && Date.now() - v < WINDOW_MS) return true;
    } catch {
      /* ignore */
    }
    // 2) sessionStorage — best-effort secondary check.
    try {
      const last = Number(
        sessionStorage.getItem("chunk_error_reloaded_at") || 0,
      );
      if (last && Date.now() - last < WINDOW_MS) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  static autoReloadOnce() {
    if (typeof window === "undefined") return;
    const now = Date.now();
    try {
      sessionStorage.setItem("chunk_error_reloaded_at", String(now));
    } catch {
      /* ignore */
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(ErrorBoundary.RELOAD_PARAM, String(now));
      // Marker lives in the URL, then load it — location.replace keeps history
      // clean and guarantees the guard marker is present on the next load.
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);

    // Always purge potentially-corrupt checkout state first, so the reload
    // below (or a manual retry) can recover instead of crashing again.
    ErrorBoundary.clearCheckoutStorage();

    // ─── Auto-recovery ───
    // During a rolling deploy the HTML may reference JS chunks that no longer
    // exist on the instance that serves the request (old/new build mismatch);
    // and returning visitors can carry corrupt checkout state. A single reload
    // (after clearing that state) fetches fresh HTML + matching chunks and
    // drops the bad state. Guarded via sessionStorage so a genuinely broken
    // build/page can't cause a reload loop.
    const msg = `${error?.name || ""} ${error?.message || ""}`;
    const isChunkError =
      /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|Cannot read propert(y|ies) of undefined \(reading 'call'\)|Unexpected token '<'/i.test(
        msg,
      );
    // Also self-heal on the public checkout routes, where a corrupt-state crash
    // is the most damaging (a merchant's customer cannot pay).
    const isCheckoutRoute =
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/pay");
    // NEVER auto-reload on auth surfaces (login/register/reset). A login page has
    // no dynamic-import chunks that justify an aggressive self-reload, and an
    // auto-reload here is exactly what produced the millisecond-fast refresh loop
    // reported on Firefox mobile. Render the recoverable fallback instead.
    if (
      (isChunkError || isCheckoutRoute) &&
      !ErrorBoundary.isAuthRoute() &&
      typeof window !== "undefined"
    ) {
      // One-shot auto-reload, throttled by a storage-independent URL marker so
      // it can NEVER become an infinite loop (see recentlyAutoReloaded above).
      if (!ErrorBoundary.recentlyAutoReloaded()) {
        ErrorBoundary.autoReloadOnce();
      }
    }
  }

  handleReset = () => {
    // Drop corrupt checkout state before re-rendering, otherwise "Try Again"
    // just re-renders the same crashing state.
    ErrorBoundary.clearCheckoutStorage();
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    ErrorBoundary.clearCheckoutStorage();
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, -apple-system, sans-serif",
            backgroundColor: "#fafafa",
          }}
        >
          <div
            style={{
              maxWidth: "500px",
              textAlign: "center",
              padding: "2rem",
              borderRadius: "12px",
              backgroundColor: "#fff",
              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            }}
          >
            <h2 style={{ color: "#dc2626", marginBottom: "0.5rem" }}>
              {i18n.t("common:somethingWentWrong")}
            </h2>
            <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
              {i18n.t("common:unexpectedErrorRefresh")}
            </p>
            <button
              onClick={this.handleReload}
              style={{
                padding: "0.6rem 1.5rem",
                backgroundColor: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.95rem",
                marginRight: "0.5rem",
              }}
            >
              {i18n.t("common:refreshPage")}
            </button>
            <button
              onClick={this.handleReset}
              style={{
                padding: "0.6rem 1.5rem",
                backgroundColor: "#e5e7eb",
                color: "#374151",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              {i18n.t("common:tryAgain")}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
