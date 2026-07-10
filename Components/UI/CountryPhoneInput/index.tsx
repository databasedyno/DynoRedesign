import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { MuiTelInput, MuiTelInputCountry } from "mui-tel-input";
import useIsMobile from "@/hooks/useIsMobile";

export interface CountryPhoneInputProps {
  value?: string;
  onChange?: (value: string, info?: any) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  name?: string;
  label?: React.ReactNode;
  helperText?: string;
  defaultCountry?: MuiTelInputCountry;
  fullWidth?: boolean;
  error?: boolean;
  disabled?: boolean;
  inputHeight?: string;
}

const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
  value = "",
  onChange,
  onBlur,
  placeholder,
  name = "mobile",
  label,
  helperText,
  defaultCountry = "US",
  fullWidth = true,
  error = false,
  disabled = false,
  inputHeight,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const isDark = theme.palette.mode === "dark";

  // Theme-aware tokens so the input is readable in BOTH light and dark mode.
  const fieldBg = theme.palette.background.paper;
  const fieldText = theme.palette.text.primary;
  const fieldBorder = isDark ? "#2A2D42" : "#E9ECF2";
  const inputFontSize = isMobile ? "14px" : "13px";

  // Match the email InputField height so the phone field doesn't look small.
  const height = inputHeight || (isMobile ? "44px" : "40px");

  return (
    <Box
      sx={{
        width: fullWidth ? "100%" : "auto",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {label && (
        <Typography
          component="label"
          htmlFor={name}
          sx={{
            fontWeight: 500,
            fontFamily: "var(--font-sans)",
            fontSize: isMobile ? "14px" : "15px",
            color: theme.palette.text.primary,
            lineHeight: 1.2,
          }}
        >
          {label}
        </Typography>
      )}
      <MuiTelInput
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        name={name}
        defaultCountry={defaultCountry}
        forceCallingCode
        disableFormatting
        disabled={disabled}
        MenuProps={{
          PaperProps: {
            sx: {
              maxHeight: "200px",
              overflowY: "auto",
              boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
              // HARDENING: force an OPAQUE background. On auth pages the theme's
              // `background.paper` is translucent glass (no backdrop-filter on
              // menus), which made this country dropdown see-through.
              backgroundColor: isDark ? "#15161B" : "#FFFFFF",
              backgroundImage: "none",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.08)"}`,
              "& .MuiMenuItem-root": {
                color: isDark ? "#E8E8EC" : "#18181B",
              },
            },
          },
        }}
        sx={{
          width: "100%",
          borderRadius: "6px !important",
          boxShadow: "none",
          fontFamily: "var(--font-sans)",
          "& .MuiInputBase-root .MuiTypography-root": {
            border: "none !important",
            fontSize: inputFontSize,
            color: fieldText,
            fontFamily: "var(--font-sans)",
            paddingLeft: "8px !important",
            [theme.breakpoints.down("md")]: {
              fontSize: "14px",
              paddingLeft: "6px !important",
            },
          },
          "& .MuiTouchRipple-root": {
            display: "none",
          },
          "& .MuiInputBase-root": {
            height: height,
            borderRadius: "6px",
            boxSizing: "border-box",
            backgroundColor: fieldBg,
            color: fieldText,
            "& input": {
              padding: "12px 0 !important",
              fontFamily: "var(--font-sans)",
              boxSizing: "border-box",
              color: fieldText,
              fontSize: inputFontSize,
              lineHeight: 1.2,
              "&::placeholder": {
                color: theme.palette.text.secondary,
                opacity: 1,
                fontFamily: "var(--font-sans)",
                fontSize: inputFontSize,
                lineHeight: 1.2,
              },
            },
          },
          "& .MuiInputBase-root .MuiInputAdornment-root": {
            border: "none !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          },
          "& .MuiIconButton-root": {
            padding: "0 !important",
          },
          "& .MuiOutlinedInput-root": {
            borderRadius: "6px",
            backgroundColor: fieldBg,
            transition: "all 0.3s ease",
            boxShadow: "rgba(16, 24, 40, 0.05) 0px 1px 2px 0px",
            "& fieldset": {
              borderColor: error ? theme.palette.error.main : fieldBorder,
              borderWidth: "1px",
            },
            "&:hover fieldset": {
              borderColor: error
                ? theme.palette.error.main
                : theme.palette.primary.light,
            },
            "&.Mui-focused fieldset": {
              borderColor: error
                ? theme.palette.error.main
                : theme.palette.primary.light,
              borderWidth: "1px",
            },
            "& input": {
              "&:-webkit-autofill": {
                WebkitBoxShadow: `0 0 0 1000px ${fieldBg} inset`,
                WebkitTextFillColor: fieldText,
              },
            },
          },
          "& button": {
            marginRight: "0px",
            color: fieldText,
            minWidth: "auto",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            border: "none",
            borderRight: "none !important",
            padding: "4px 4px 4px 8px !important",
            position: "relative",
            "&:hover": {
              backgroundColor: "transparent",
            },
            "&:focus": {
              border: "none",
              borderRight: "none !important",
            },
            "& img": {
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              objectFit: "cover",
              marginRight: "0px",
              flexShrink: 0,
              order: 1,

              [theme.breakpoints.down("md")]: {
                width: "16px",
                height: "16px",
              },
            },
            "& svg": {
              display: "none !important",
            },
            "&::after": {
              content: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4 L6 8 L10 4' stroke='%23676768' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
              display: "inline-block",
              width: "12px",
              height: "12px",
              marginLeft: "4px",
              marginBottom: "18px",
              flexShrink: 0,
              order: 3,
              [theme.breakpoints.down("md")]: {
                width: "10px",
                height: "10px",
                marginBottom: "21px",
                marginLeft: "2px",
              },
            },
            "& > span, & > p": {
              order: 3,
            },
          },
          "& .MuiInputAdornment-root": {
            paddingLeft: "8px !important",
            paddingRight: "0px !important",
            marginRight: "0px !important",
            borderLeft: "none !important",
            borderRight: "none !important",
            display: "flex",
            alignItems: "center",
            "& p": {
              fontSize: "15px",
              color: fieldText,
              fontFamily: "var(--font-sans)",
              margin: 0,
            },
          },
          "& .MuiDivider-root": {
            display: "none !important",
            width: "0 !important",
            height: "0 !important",
          },
          "& .MuiInputAdornment-positionStart": {
            borderRight: "none !important",
            borderLeft: "none !important",
            "&::before": {
              display: "none !important",
              content: '""',
            },
            "&::after": {
              display: "none !important",
              content: '""',
            },
          },
          "& hr": {
            display: "none !important",
            width: "0 !important",
            height: "0 !important",
            margin: "0 !important",
            padding: "0 !important",
          },
        }}
      />
      {helperText && (
        <Typography
          sx={{
            fontSize: isMobile ? "12px" : "13px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            color: error ? theme.palette.error.main : theme.palette.text.secondary,
            lineHeight: 1.2,
            textAlign: "start",
            ml: 0.5,
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default CountryPhoneInput;
