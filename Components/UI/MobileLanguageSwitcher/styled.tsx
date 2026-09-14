import { Box, IconButton, styled } from "@mui/material";

export const ModalBackdrop = styled(Box)<{ open: boolean }>(({ open }) => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    backdropFilter: open ? "blur(4px)" : "none",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    transition: "opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 200ms cubic-bezier(0.16, 1, 0.3, 1)",
    zIndex: 1199,
    borderRadius: "30px",
  }));
  
  export const ModalContainer = styled(Box)({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1200,
    pointerEvents: "none",
  });
  
  export const ModalWrapper = styled(Box)<{ open: boolean }>(({ theme, open }) => ({
    position: "relative",
    width: "fit-content",
    minWidth: "fit-content",
    background: theme.palette.background.paper,
    borderRadius: "12px",
    boxShadow: theme.palette.mode === "dark" ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.1)",
    overflow: "hidden",
    padding: "6px",
    opacity: open ? 1 : 0,
    // visibility keeps the hidden list out of the tab order (no focus trap into an invisible menu)
    visibility: open ? "visible" : "hidden",
    pointerEvents: open ? "auto" : "none",
    transform: open ? "scale(1)" : "scale(0.95)",
    transition: "opacity 0.25s ease, transform 0.25s ease, visibility 0.25s",
  }));
  
  export const CloseButton = styled(IconButton)(({ theme }) => ({
    position: "absolute",
    top: "8px",
    right: "8px",
    width: "32px",
    height: "32px",
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
    zIndex: 1,
    "&:hover": {
      backgroundColor: theme.palette.action.selected,
    },
  }));
  export const CustomLangFlag = styled("img")({
    width: "16px",
    height: "16px",
    borderRadius: "50%",
  });