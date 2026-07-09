import { theme } from "@/styles/theme";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Typography,
} from "@mui/material";
import React from "react";

export type SettingsAccordionProps = {
  /** Icon shown next to the heading (e.g. NotificationsIcon) */
  icon: React.ReactNode;
  /** Section heading text */
  title: string;
  /** Subtitle text */
  subtitle?: string;
  /** Content shown when expanded */
  children: React.ReactNode;
  /** Controlled: whether this panel is expanded */
  expanded?: boolean;
  /** Controlled: called when expand/collapse is toggled */
  onChange?: (event: React.SyntheticEvent, isExpanded: boolean) => void;
  /** Optional id for the accordion panel (for controlled group) */
  id?: string;
  /** Optional sx for Accordion root */
  sx?: object;
  /** Optional sx for AccordionDetails */
  detailsSx?: object;
  /** Optional responsive font size (e.g. from useIsMobile) */
  isMobile?: boolean;
};

/**
 * Accordion section with icon + heading on the left and down arrow on the right.
 * Click to expand/collapse and show details below. Matches the "Webhook notifications"
 * style header with bell icon and chevron.
 */
export default function SettingsAccordion({
  icon,
  title,
  subtitle,
  children,
  expanded,
  onChange,
  id,
  sx,
  detailsSx,
  isMobile = false,
}: SettingsAccordionProps) {
  const accordionSx = {
    "&:before": { display: "none" },
    boxShadow: "none",
    borderBottom: "1px solid",
    borderColor: theme.palette.secondary.contrastText,
    "&.Mui-expanded": { margin: 0 },
    "&:last-of-type": { borderBottom: "none" },
    ...sx,
  };

  const summarySx = {
    minHeight: 24,
    pb: isMobile ? "12px" : "24px",
    pt: isMobile ? "12px" : "24px",
    "&.Mui-expanded": {
      minHeight: 0,
      pb: "0",
    },
    px: 0,

    flexDirection: "row",
    "& .MuiAccordionSummary-expandIconWrapper": {
      color: "text.secondary",
    },
    "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": {
      transform: "rotate(180deg)",
    },
    "& .MuiAccordionSummary-content": {
      my: 0,
      flex: 1,
      marginRight: 1,
    },
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={onChange}
      disableGutters
      elevation={0}
      sx={accordionSx}
      id={id}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flex: 1,
            marginRight: 1,
          }}
        >
          {icon}
          <Typography
            sx={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: isMobile ? "15px" : "20px",
              lineHeight: 1.2,
              color: "text.primary",
            }}
          >
            {title}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: "divider" }}
          />
        </Box>
      </AccordionSummary>
      {subtitle && (
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: isMobile ? "12px" : 3,
            mt: isMobile ? "6px" : 1,
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: isMobile ? "13px" : "15px",
            lineHeight: "18px",
          }}
        >
          {subtitle}
        </Typography>
      )}
      <AccordionDetails
        sx={{ pt: 0, pb: isMobile ? "12px" : 3, px: 0, ...detailsSx }}
      >
        {children}
      </AccordionDetails>
    </Accordion>
  );
}
