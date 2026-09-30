import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box } from "@mui/material";
import Toast from "./index";
import { TOAST_HIDE_ONE } from "@/Redux/Actions/ToastAction";
import { IToastItem, rootReducer } from "@/utils/types";
import useIsMobile from "@/hooks/useIsMobile";

// Renders the global toast STACK from the Redux queue. Mounted once per layout.
// The old per-container `<Toast open=... />` usages are replaced by this so a
// second toast stacks above the first instead of replacing it.
const ToastHost = () => {
  const dispatch = useDispatch();
  const isMobile = useIsMobile("sm");
  const queue = useSelector((state: rootReducer) => state.toastReducer?.queue) || [];

  if (!queue.length) return null;

  const dismiss = (id?: string) => {
    if (id) dispatch({ type: TOAST_HIDE_ONE, payload: { id } });
  };

  const bottom = queue.filter((t) => (t.placement || "bottom-right") !== "top-center");
  const top = queue.filter((t) => t.placement === "top-center");

  const renderStack = (items: IToastItem[], topCenter: boolean) => {
    if (!items.length) return null;
    return (
      <Box
        sx={{
          position: "fixed",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          pointerEvents: "none",
          ...(topCenter
            ? {
                top: isMobile ? "12px" : "20px",
                left: "50%",
                transform: "translateX(-50%)",
                width: isMobile ? "calc(100vw - 24px)" : "380px",
                maxWidth: "calc(100vw - 24px)",
              }
            : isMobile
            ? {
                left: "12px",
                right: "12px",
                bottom: "calc(var(--dp-sticky-cta, 0px) + env(safe-area-inset-bottom, 0px) + 12px)",
              }
            : {
                right: "24px",
                bottom: "calc(var(--dp-sticky-cta, 0px) + 24px)",
                width: "380px",
                maxWidth: "calc(100vw - 32px)",
              }),
        }}
      >
        {items.map((t, idx) => {
          const isNewest = idx === items.length - 1;
          return (
            <Box
              key={t.id}
              sx={{
                pointerEvents: "auto",
                opacity: isNewest ? 1 : 0.85,
                transition: "opacity 0.2s ease",
              }}
            >
              <Toast
                hostMode
                open
                id={t.id}
                message={t.message}
                severity={t.severity}
                loading={t.loading}
                placement={t.placement}
                durationMs={t.durationMs}
                action={t.action}
                onClose={() => dismiss(t.id)}
              />
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <>
      {renderStack(top, true)}
      {renderStack(bottom, false)}
    </>
  );
};

export default ToastHost;
