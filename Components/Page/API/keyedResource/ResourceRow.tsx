import { ReactNode, useState } from "react";
import { Box, Chip, Typography, useTheme } from "@mui/material";
import { Icon } from "@/styles/uiKit";
import CustomButton from "@/Components/UI/Buttons";
import { MetaChip, MONO_FONT } from "./primitives";

interface ResourceRowProps {
  badge: { label: string; bgcolor: string; color: string };
  title: string;
  status: { label: string; color: string; active: boolean };
  actions: ReactNode;
  value: { text: string; testId: string; action: ReactNode };
  meta: string[];
  expand: { testId: string; show: string; hide: string };
  dimmed?: boolean;
  children: ReactNode;
}

/** Card frame for one keyed resource (a publishable key or a buy button). */
const ResourceRow = ({ badge, title, status, actions, value, meta, expand, dimmed, children }: ResourceRowProps) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.border.main}`,
        borderRadius: "12px",
        background: theme.palette.background.paper,
        p: { xs: 1.5, sm: 2 },
        opacity: dimmed ? 0.75 : 1,
        transition: "border-color 0.2s ease",
        "&:hover": { borderColor: theme.palette.primary.main },
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, flexWrap: "wrap" }}>
          <Chip
            label={badge.label}
            size="small"
            sx={{
              height: 22,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              bgcolor: badge.bgcolor,
              color: badge.color,
              "& .MuiChip-label": { px: 1 },
            }}
          />
          <Typography
            sx={{
              fontSize: { xs: 14, md: 15 },
              fontWeight: 600,
              color: theme.palette.text.primary,
              fontFamily: "var(--font-sans)",
            }}
          >
            {title}
          </Typography>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: status.color }}>
            <Icon name={status.active ? "circle-check" : "ban"} size={16} />
            <Typography sx={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize", color: status.color }}>
              {status.label}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>{actions}</Box>
      </Box>

      <Box
        sx={{
          mt: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 1,
          background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#F7F8FA",
          border: `1px solid ${theme.palette.border.main}`,
          borderRadius: "8px",
          px: 1.25,
          py: 0.75,
          minWidth: 0,
        }}
      >
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            fontFamily: MONO_FONT,
            fontSize: { xs: 12, md: 13 },
            color: theme.palette.text.primary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          data-testid={value.testId}
        >
          {value.text}
        </Typography>
        {value.action}
      </Box>

      <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
        {meta.map((label, i) => (
          <MetaChip key={`${i}-${label}`} label={label} />
        ))}
      </Box>

      <Box sx={{ mt: 1 }}>
        <CustomButton
          data-testid={expand.testId}
          label={expanded ? expand.hide : expand.show}
          variant="secondary"
          size="small"
          endIcon={<Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} />}
          onClick={() => setExpanded((v) => !v)}
          sx={{ height: 28, fontSize: 12 }}
        />
      </Box>

      {expanded && <Box sx={{ mt: 1.25 }}>{children}</Box>}
    </Box>
  );
};

export default ResourceRow;
