import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { Icon } from "@/styles/uiKit";
import { useConsole } from "./tokens";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; onClick: () => void; testid?: string };
  testid?: string;
  compact?: boolean;
}

/** Graceful empty state: a quiet icon, a subtle message, and an optional action. */
const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, testid = "empty-state", compact }) => {
  const t = useConsole();
  return (
    <Box
      data-testid={testid}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        py: compact ? 5 : 9,
        px: 3,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.inkMuted,
          border: `1px solid ${t.hairline}`,
          mb: 2,
        }}
      >
        {icon || <Icon name="list" size={22} />}
      </Box>
      <Typography sx={{ fontSize: 15, fontWeight: 600, color: t.ink, mb: 0.5 }}>{title}</Typography>
      {description != null && (
        <Typography sx={{ fontSize: 13.5, color: t.inkSecondary, maxWidth: 420 }}>{description}</Typography>
      )}
      {action && (
        <Button
          variant="contained"
          onClick={action.onClick}
          data-testid={action.testid || "empty-state-action"}
          sx={{ mt: 2.5, textTransform: "none", fontWeight: 600 }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
