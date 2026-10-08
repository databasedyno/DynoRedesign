import React from "react";
import { Box, IconButton, SwipeableDrawer, Typography, useTheme } from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import useBackToClose from "@/hooks/useBackToClose";
import { DARK } from "@/constants/theme";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  closeLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  "data-testid"?: string;
  /** Exposes the overlay's history release (call before router.replace from inside). */
  onReleaseRef?: React.MutableRefObject<(() => void) | null>;
  maxHeight?: string;
}

/** Phone overlay pattern (§8.5): drag handle, safe-area padding, 44px rows, back gesture closes. */
const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  closeLabel = "Close",
  children,
  footer,
  "data-testid": testId = "bottom-sheet",
  onReleaseRef,
  maxHeight = "88dvh",
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const release = useBackToClose(open, onClose, testId);
  if (onReleaseRef) onReleaseRef.current = release;

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      disableDiscovery
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        "data-testid": testId,
        role: "dialog",
        "aria-modal": true,
        sx: {
          maxHeight,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: isDark ? DARK.surface : theme.palette.background.paper,
          backgroundImage: "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          pb: "env(safe-area-inset-bottom, 0px)",
        },
      } as any}
    >
      <Box aria-hidden sx={{ display: "flex", justifyContent: "center", pt: 1, pb: 0.5, flexShrink: 0 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(10,10,15,0.18)" }} />
      </Box>
      {title != null && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 2, pb: 0.5, flexShrink: 0 }}>
          <Typography component="h2" sx={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, color: theme.palette.text.primary }}>
            {title}
          </Typography>
          <IconButton onClick={onClose} aria-label={closeLabel} data-testid={`${testId}-close`} sx={{ width: 44, height: 44, color: theme.palette.text.secondary }}>
            <CloseRounded sx={{ fontSize: 22 }} />
          </IconButton>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {children}
      </Box>
      {footer && <Box sx={{ flexShrink: 0 }}>{footer}</Box>}
    </SwipeableDrawer>
  );
};

export default BottomSheet;
