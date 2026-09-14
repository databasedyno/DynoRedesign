import { Box, Typography } from "@mui/material";
import React from "react";
import { useTheme } from "@mui/material/styles";
import useIsMobile from "@/hooks/useIsMobile";
import { SxProps, Theme } from "@mui/system";

const INPUT_PADDING_X = 14;
const DIVIDER_VERTICAL_MARGIN = 8;

export type AdornedInputFieldProps = {
  label?: string | React.ReactNode;
  value?: string;
  name?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  helperText?: string;
  fullWidth?: boolean;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  type?: "text" | "number";
  inputMode?: "numeric" | "decimal" | "text";
  disabled?: boolean;
  error?: boolean;
  inputHeight?: string;
  sx?: SxProps<Theme>;
  startAdornmentWidth?: string;
  endAdornmentWidth?: string;
  testId?: string;
};

/**
 * Input field with vertical line separators between start adornment, input value,
 * and end adornment. Matches the design with distinct visual dividers.
 */
export default function AdornedInputField({
  label,
  value = "",
  name,
  onChange,
  onBlur,
  helperText,
  fullWidth = true,
  startAdornment,
  endAdornment,
  type = "text",
  inputMode,
  disabled = false,
  error = false,
  inputHeight = "38px",
  sx,
  startAdornmentWidth = "44px",
  endAdornmentWidth = "70px",
  testId,
}: AdornedInputFieldProps) {
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const hasStart = !!startAdornment;
  const hasEnd = !!endAdornment;

  // Theme-aware surfaces so the field renders correctly in dark mode
  // (previously hardcoded #FFFFFF / #E0E0E0 / #F5F5F5).
  const dividerColor = theme.palette.divider;
  const borderColor = error
    ? theme.palette.error.main
    : theme.palette.border.main;
  const focusBorderColor = error
    ? theme.palette.error.main
    : theme.palette.border.focus;
  const bgColor = disabled
    ? theme.palette.action.disabledBackground
    : theme.palette.background.paper;

  return (
    <Box
      sx={{
        width: fullWidth ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? "6px" : "8px",
        ...sx,
      }}
    >
      {label && (
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            fontFamily: "var(--font-sans)",
            fontSize: isMobile ? "13px" : "15px",
            textAlign: "start",
            color: theme.palette.text.primary,
            lineHeight: "100%",
            letterSpacing: 0,
          }}
        >
          {typeof label === "string" ? <span>{label}</span> : label}
        </Typography>
      )}

      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          width: fullWidth ? "100%" : "auto",
          height: inputHeight,
          borderRadius: "6px",
          border: `1px solid ${borderColor}`,
          backgroundColor: bgColor,
          overflow: "hidden",
          boxSizing: "border-box",
          boxShadow: "rgba(16, 24, 40, 0.05) 0px 1px 2px 0px",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            borderColor: disabled ? borderColor : focusBorderColor,
          },
          "&:focus-within": {
            borderColor: focusBorderColor,
            outline: "none",
          },
        }}
      >
        {/* Start adornment with right vertical line */}
        {hasStart && (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: startAdornmentWidth,
                flexShrink: 0,
                color: theme.palette.text.primary,
                fontSize: "14px",
                "& svg": { fontSize: 22 },
              }}
            >
              {startAdornment}
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                alignSelf: "stretch",
                flexShrink: 0,
                py: `${DIVIDER_VERTICAL_MARGIN}px`,
                boxSizing: "border-box",
              }}
            >
              <Box
                sx={{
                  width: "1px",
                  height: "100%",
                  backgroundColor: dividerColor,
                }}
              />
            </Box>
          </>
        )}

        {/* Input */}
        <Box
          component="input"
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          type={type}
          inputMode={inputMode}
          disabled={disabled}
          data-testid={testId}
          data-lpignore="true"
          data-form-type="other"
          data-1p-ignore="true"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          sx={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            padding: `0 ${INPUT_PADDING_X}px`,
            fontFamily: "var(--font-sans)",
            fontSize: isMobile ? "13px" : "15px",
            color: disabled ? "#B0BEC5" : theme.palette.text.primary,
            backgroundColor: "transparent",
            boxSizing: "border-box",
            "&::placeholder": { color: theme.palette.text.disabled },
            "&:disabled": { cursor: "not-allowed" },
            ...(type === "number" && {
              MozAppearance: "textfield",
              "&::-webkit-outer-spin-button": {
                WebkitAppearance: "none",
                margin: 0,
              },
              "&::-webkit-inner-spin-button": {
                WebkitAppearance: "none",
                margin: 0,
              },
            }),
          }}
        />

        {/* End adornment with left vertical line */}
        {hasEnd && (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                alignSelf: "stretch",
                flexShrink: 0,
                py: `${DIVIDER_VERTICAL_MARGIN}px`,
                boxSizing: "border-box",
              }}
            >
              <Box
                sx={{
                  width: "1px",
                  height: "100%",
                  backgroundColor: dividerColor,
                  marginRight: "8px",
                }}
              />
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: endAdornmentWidth,
                flexShrink: 0,
                paddingRight: "14px",
                color: theme.palette.text.secondary,
                fontSize: isMobile ? "10px" : "13px",
                fontFamily: "var(--font-sans)",
              }}
            >
              {endAdornment}
            </Box>
          </>
        )}
      </Box>

      {helperText && (
        <Typography
          sx={{
            margin: "4px 0 0 0",
            fontSize: isMobile ? "10px" : "13px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            color: error
              ? theme.palette.error.main
              : theme.palette.text.secondary,
            lineHeight: "1.2",
            textAlign: "start",
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
