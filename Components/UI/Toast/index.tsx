import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Typography, IconButton, useTheme, ButtonBase } from "@mui/material";
import LoadingIcon from "@/assets/Icons/LoadingIcon";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CloseIcon from "@mui/icons-material/Close";
import { IToastProps } from "@/utils/types";
import useIsMobile from "@/hooks/useIsMobile";
import SuccessIcon from "@/assets/Icons/success-icon.svg";
import Image from "next/image";

// Auto-hide durations by severity (ms). Errors stay readable; loading never auto-hides.
const DURATION_BY_SEVERITY: Record<string, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 8000,
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Presentational toast card.
 *  - Rendered standalone (position: fixed) by legacy local-state callers, OR
 *  - Rendered inside ToastHost (hostMode) which owns the fixed stack container.
 *
 * Adds vs the old toast: a countdown bar synced to the auto-hide timer,
 * pause-on-hover/focus, an explicit X, an optional action button, swipe-to-dismiss
 * on phone, and role/aria-live for screen readers.
 */
const Toast = (props: IToastProps) => {
  const theme = useTheme();
  const {
    open,
    severity,
    message,
    loading,
    placement = "bottom-right",
    durationMs,
    action,
    onClose,
    hostMode = false,
    id,
  } = props;
  const isMobile = useIsMobile("sm");
  const topCenter = placement === "top-center";

  const duration = loading ? 0 : durationMs ?? DURATION_BY_SEVERITY[severity || "success"] ?? 4000;
  // Only self-drive the countdown when we actually own dismissal (onClose given).
  // Legacy controlled callers manage `open` themselves, so no bar/auto-hide for them.
  const hasTimer = open && !loading && duration > 0 && !!onClose;

  const [progress, setProgress] = useState(1); // 1 -> 0
  const [paused, setPaused] = useState(false);
  const reduced = useRef<boolean>(false);

  const rafRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const lastTsRef = useRef(0);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  // Reset the countdown whenever a fresh toast takes this slot.
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(1);
    setPaused(false);
  }, [id, message, severity, loading, open]);

  // rAF-driven countdown: the SAME clock drives the bar AND the auto-hide,
  // so they can never drift. Pausing simply stops the loop and freezes elapsed.
  useEffect(() => {
    if (!hasTimer || paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTsRef.current = performance.now();
    const tick = (ts: number) => {
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      elapsedRef.current += dt;
      const p = Math.max(0, 1 - elapsedRef.current / duration);
      setProgress(p);
      if (elapsedRef.current >= duration) {
        rafRef.current = null;
        handleClose();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [hasTimer, paused, duration, handleClose]);

  // Swipe-down to dismiss on phone.
  const dragStartY = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isMobile) return;
    dragStartY.current = e.clientY;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!isMobile || dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;
    if (delta > 40) handleClose();
  };

  if (!open) return null;

  const getStyles = () => {
    if (loading) {
      return { accent: theme.palette.border.focus, icon: <LoadingIcon size={16} fill={theme.palette.border.focus} /> };
    }
    if (severity === "error") {
      return {
        accent: theme.palette.border.error,
        icon: <ErrorOutlineIcon sx={{ color: theme.palette.border.error, fontSize: "16px" }} />,
      };
    }
    if (severity === "warning") {
      const amber = theme.palette.mode === "dark" ? "#FBBF24" : "#B45309";
      return { accent: amber, icon: <ErrorOutlineIcon sx={{ color: amber, fontSize: "16px" }} /> };
    }
    if (severity === "info") {
      return {
        accent: theme.palette.border.focus,
        icon: <ErrorOutlineIcon sx={{ color: theme.palette.border.focus, fontSize: "16px" }} />,
      };
    }
    return {
      accent: theme.palette.border.success,
      icon: <Image src={SuccessIcon} alt="" width={16} height={16} />,
    };
  };
  const { accent, icon } = getStyles();

  const isError = severity === "error";
  const ariaRole = isError ? "alert" : "status";
  const ariaLive = isError ? "assertive" : "polite";

  // Placement: host owns the fixed stack, so in hostMode the card is relative.
  const positionSx = hostMode
    ? { position: "relative" as const, width: "100%" }
    : topCenter
    ? {
        position: "fixed" as const,
        top: isMobile ? "12px" : "20px",
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "calc(100vw - 32px)",
        zIndex: 99999,
      }
    : isMobile
    ? {
        position: "fixed" as const,
        left: "12px",
        right: "12px",
        bottom: "calc(var(--dp-sticky-cta, 0px) + env(safe-area-inset-bottom, 0px) + 12px)",
        zIndex: 99999,
      }
    : {
        position: "fixed" as const,
        right: "24px",
        bottom: "calc(var(--dp-sticky-cta, 0px) + 24px)",
        maxWidth: "380px",
        zIndex: 99999,
      };

  return (
    <Box
      data-testid="app-toast"
      data-severity={loading ? "loading" : severity || "success"}
      data-placement={placement}
      data-paused={paused ? "1" : "0"}
      role={ariaRole}
      aria-live={ariaLive}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      sx={{
        ...positionSx,
        backgroundColor: theme.palette.secondary.light,
        border: `1px solid ${accent}`,
        borderRadius: isMobile && !hostMode && !topCenter ? "16px 16px 12px 12px" : "14px",
        boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        width: hostMode ? "100%" : undefined,
        animation: reduced.current
          ? "none"
          : topCenter
          ? "toastSlideDown 0.28s ease-out"
          : "toastSlideUp 0.28s ease-out",
        "@keyframes toastSlideUp": {
          "0%": { transform: "translateY(12px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        "@keyframes toastSlideDown": {
          "0%": { transform: "translate(-50%, -12px)", opacity: 0 },
          "100%": { transform: "translate(-50%, 0)", opacity: 1 },
        },
      }}
    >
      {/* Countdown bar (top edge). Hidden for loading toasts and reduced-motion. */}
      {hasTimer && !reduced.current && (
        <Box
          data-testid="app-toast-countdown"
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            transformOrigin: "left",
            transform: `scaleX(${progress})`,
            backgroundColor: accent,
            willChange: "transform",
          }}
        />
      )}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? "10px" : "12px",
          padding: isMobile ? "14px 14px" : "16px 18px",
          width: "100%",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </Box>

        <Typography
          sx={{
            flex: 1,
            fontSize: isMobile ? "13px" : "14px",
            fontFamily: "var(--font-sans)",
            color: theme.palette.text.primary,
            lineHeight: 1.5,
          }}
        >
          {message}
        </Typography>

        {action?.label && (
          <ButtonBase
            data-testid="app-toast-action"
            onClick={() => {
              action.onClick?.();
              handleClose();
            }}
            sx={{
              flexShrink: 0,
              px: "10px",
              height: "32px",
              borderRadius: "8px",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 600,
              color: accent,
              "&:hover": { backgroundColor: "rgba(127,127,127,0.12)" },
            }}
          >
            {action.label}
          </ButtonBase>
        )}

        {onClose && (
          <IconButton
            data-testid="app-toast-close"
            aria-label="Dismiss notification"
            onClick={handleClose}
            sx={{
              flexShrink: 0,
              width: "36px",
              height: "36px",
              color: theme.palette.text.secondary,
              "&:hover": { backgroundColor: "rgba(127,127,127,0.12)" },
            }}
          >
            <CloseIcon sx={{ fontSize: "18px" }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
};

export default Toast;
