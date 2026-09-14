import styled from "@emotion/styled";
import CheckIcon from "@mui/icons-material/Check";
import { Box } from "@mui/material";
import { styled as muiStyled } from "@mui/material/styles";

export const PeriodTrigger = muiStyled(Box)(({ theme }: any) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  padding: "10px 14px",
  borderRadius: "6px",
  border: "1px solid",
  borderColor: theme?.palette?.border?.main,
  cursor: "pointer",
  background: theme.palette.background.paper,
  color: theme?.palette?.text?.primary ?? "#000",
  minWidth: "fit-content",
  transition: "all 0.2s ease",

  "&:hover": {
    borderColor: theme?.palette?.border?.focus,
  },
  [theme.breakpoints.down("md")]: {
    padding: "8px 10px",
  },
}));

export const PeriodText = styled.span`
  font-weight: 500;
  font-family: var(--font-sans);
  white-space: nowrap;
`;

export const CheckIconStyled = styled(CheckIcon)`
  font-size: 18px;
  color: #000;
`;
