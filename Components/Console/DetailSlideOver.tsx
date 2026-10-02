import React from "react";
import { Drawer, Box, Typography, IconButton } from "@mui/material";
import { Icon } from "@/styles/uiKit";
import { useConsole } from "./tokens";

interface DetailSlideOverProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAccessory?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  testid?: string;
  closeTestid?: string;
}

/** Right-side slide-over detail panel — keeps the list context behind it. */
const DetailSlideOver: React.FC<DetailSlideOverProps> = ({
  open,
  onClose,
  title,
  subtitle,
  headerAccessory,
  children,
  footer,
  width = 440,
  testid = "detail-slide-over",
  closeTestid = "slide-over-close",
}) => {
  const t = useConsole();
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      transitionDuration={{ enter: 300, exit: 200 }}
      PaperProps={{
        "data-testid": testid,
        sx: {
          width: { xs: "100%", sm: width },
          maxWidth: "100%",
          bgcolor: t.surface,
          backgroundImage: "none",
          borderLeft: `1px solid ${t.border}`,
          boxShadow: t.slideOverShadow,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          px: 3,
          py: 2.25,
          borderBottom: `1px solid ${t.hairline}`,
          position: "sticky",
          top: 0,
          bgcolor: t.surface,
          zIndex: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="div" sx={{ fontSize: 16, fontWeight: 600, color: t.ink, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis" }}>{title}</Typography>
          {subtitle != null && <Typography component="div" sx={{ fontSize: 12.5, color: t.inkSecondary, mt: 0.25, display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>{subtitle}</Typography>}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
          {headerAccessory}
          <IconButton onClick={onClose} size="small" data-testid={closeTestid} sx={{ color: t.inkSecondary, mt: -0.25 }}>
            <Icon name="x" size={18} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>{children}</Box>

      {footer != null && (
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${t.hairline}`, bgcolor: t.surface }}>{footer}</Box>
      )}
    </Drawer>
  );
};

export default DetailSlideOver;
