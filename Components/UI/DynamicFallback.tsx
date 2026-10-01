import React, { useEffect, useState } from "react";
import type { DynamicOptionsLoadingProps } from "next/dynamic";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { isChunkLoadError, reloadOnceForStaleChunk } from "@/utils/staleChunkReload";

interface FallbackOptions {
  /** Render nothing (instead of the error card) when the panel can't load — for modals / non-visual hosts. */
  silent?: boolean;
  /** Auto-reload once on a stale-chunk error (default true). Off for purely decorative widgets. */
  autoReload?: boolean;
  /** Min height of the error card so the layout doesn't jump. */
  minHeight?: number | string;
}

type Props = DynamicOptionsLoadingProps & FallbackOptions & { placeholder?: React.ReactNode };

/** Inline "couldn't load" card with Retry + Reload — never an endless spinner. */
export const LazyLoadErrorCard: React.FC<{ onRetry?: () => void; minHeight?: number | string }> = ({ onRetry, minHeight }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const isDark = theme.palette.mode === "dark";
  return (
    <Box
      role="alert"
      data-testid="lazy-load-error"
      sx={{
        minHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 1.25,
        px: 3,
        py: 5,
        my: 2,
        borderRadius: "16px",
        border: `1px dashed ${isDark ? "rgba(255,255,255,0.18)" : "rgba(10,10,15,0.16)"}`,
        backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)",
      }}
    >
      <Box sx={{ color: isDark ? "#FBBF24" : "#B45309", display: "flex" }}>
        <Icon name="circle-alert" size={24} />
      </Box>
      <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, color: theme.palette.text.primary }}>
        {t("lazyLoad.title", { defaultValue: "This section couldn't load" })}
      </Typography>
      <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.55, maxWidth: 420, color: theme.palette.text.secondary }}>
        {t("lazyLoad.body", {
          defaultValue: "Your connection may have dropped, or Dynopay was just updated. Retry, or reload the page to get the latest version.",
        })}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap", justifyContent: "center" }}>
        {onRetry && (
          <Button
            data-testid="lazy-load-retry"
            variant="outlined"
            size="small"
            onClick={onRetry}
            startIcon={<Icon name="refresh-cw" size={14} />}
            sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600 }}
          >
            {t("lazyLoad.retry", { defaultValue: "Retry" })}
          </Button>
        )}
        <Button
          data-testid="lazy-load-reload"
          variant="contained"
          size="small"
          disableElevation
          onClick={() => window.location.reload()}
          sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600 }}
        >
          {t("lazyLoad.reload", { defaultValue: "Reload page" })}
        </Button>
      </Box>
    </Box>
  );
};

/**
 * `next/dynamic` loading fallback that also HANDLES the load error.
 *
 * next/dynamic swallows a failed import and keeps rendering `loading` with
 * `error` set, so a fallback that ignores `error` spins forever. This one:
 *   1. shows `placeholder` while the chunk loads;
 *   2. on a stale-chunk error (post-deploy tab) reloads the page ONCE onto the
 *      current build (shared 30s loop guard with pages/_app.tsx);
 *   3. otherwise shows an inline error card with Retry / Reload page
 *      (or nothing, when `silent`).
 */
export const DynamicFallback: React.FC<Props> = ({ error, retry, placeholder = null, silent = false, autoReload = true, minHeight }) => {
  const [phase, setPhase] = useState<"loading" | "reloading" | "failed">("loading");

  useEffect(() => {
    if (!error) {
      setPhase("loading");
      return;
    }
    // eslint-disable-next-line no-console
    console.error("[DynamicFallback] lazy section failed to load:", error);
    if (autoReload && isChunkLoadError(error) && reloadOnceForStaleChunk()) {
      setPhase("reloading");
      return;
    }
    setPhase("failed");
  }, [error, autoReload]);

  if (!error || phase !== "failed") return <>{placeholder}</>;
  if (silent) return null;
  return <LazyLoadErrorCard onRetry={retry ?? undefined} minHeight={minHeight} />;
};

/**
 * Builds a `loading` option for `next/dynamic`:
 *   dynamic(() => import("./X"), { ssr: false, loading: lazyLoading(<Spinner />) })
 */
export const lazyLoading = (placeholder: React.ReactNode = null, options: FallbackOptions = {}) => {
  const Loading = (props: DynamicOptionsLoadingProps) => <DynamicFallback {...props} {...options} placeholder={placeholder} />;
  Loading.displayName = "LazyLoading";
  return Loading;
};

export default DynamicFallback;
