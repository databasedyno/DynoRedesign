import React from "react";
import { Box } from "@mui/material";
import { useAurora } from "../../v3/theme.v3";

/** In light mode the always-dark mockups sit on a soft graphite plinth; in dark mode children render as-is. */
export const MockPlinth: React.FC<React.PropsWithChildren<{ compact?: boolean }>> = ({ compact, children }) => {
  const s = useAurora();
  if (s.dark) return <>{children}</>;
  return (
    <Box
      data-testid="mock-plinth"
      sx={{
        p: compact ? { xs: 1.25, md: 1.75 } : { xs: 1.25, md: 2.5 },
        borderRadius: compact ? "26px" : { xs: "26px", md: "32px" },
        background: "linear-gradient(180deg, #3A3B42 0%, #22232A 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 50px 90px -50px rgba(10,10,10,0.6)",
      }}
    >
      {children}
    </Box>
  );
};
