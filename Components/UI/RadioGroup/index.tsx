import { Radio, RadioProps, styled, SxProps, Theme } from "@mui/material";

export interface CustomRadioProps extends Omit<RadioProps, "sx"> {
  sx?: SxProps<Theme>;
}

/**
 * Custom Radio Button Component with consistent styling
 * - Selected: Blue inner circle (#4F46E5) with light grey border (#E9ECF2)
 * - Unselected: White inner circle with light grey border (#E9ECF2)
 * - Hover effects with light blue background
 * - Fully customizable via sx prop
 */
const CustomRadio = styled(Radio)<CustomRadioProps>(({ theme }) => ({
  height: "24px !important",
  width: "24px !important",
  color: "#F4F6FA",
  border: "1px solid ",
  borderColor: theme.palette.border.main,
  backgroundColor: theme.palette.secondary.main,
  "&:hover": {
    borderRadius: "50%",
  },
  "&.Mui-checked": {
    color: theme.palette.primary.main,
  },
  "& .MuiSvgIcon-root": {
    width: "28px !important",
    height: "28px !important",
  },
  "& svg[data-testid='RadioButtonUncheckedIcon']": {
    fill: "transparent",
  },
  "& svg[data-testid='RadioButtonCheckedIcon']": {
    fill: theme.palette.primary.main,
  },

  "&.Mui-disabled": {
    color: "#E9ECF2",
    opacity: 0.5,
  },
  "& .MuiRadio-root": {
    outline: "none",
    fill: "transparent",
  },
  ".Mui-focusVisible &": {
    outline: "none !important",
    outlineOffset: 0,
  },
  '& input[type="radio"]': {
    outline: "none !important",
    boxShadow: "none !important",
  },
}));

export default CustomRadio;
