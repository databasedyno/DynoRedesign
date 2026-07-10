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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);

    // ─── ChunkLoadError auto-recovery ───
    // During a rolling deploy the HTML may reference JS chunks that no longer
    // exist on the instance that serves the request (old/new build mismatch).
    // A single reload fetches the fresh HTML + matching chunks. Guarded via
    // sessionStorage so a genuinely broken build can't cause a reload loop.
    const msg = `${error?.name || ""} ${error?.message || ""}`;
    const isChunkError =
      /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|Cannot read propert(y|ies) of undefined \(reading 'call'\)|Unexpected token '<'/i.test(
        msg,
      );
    if (isChunkError && typeof window !== "undefined") {
      try {
        const KEY = "chunk_error_reloaded_at";
        const last = Number(sessionStorage.getItem(KEY) || 0);
        // Allow one auto-reload per 2 minutes
        if (Date.now() - last > 2 * 60 * 1000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* storage unavailable — show the fallback instead */
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
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
              onClick={() => window.location.reload()}
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
