import { CopyButton } from "@/Components/Layout/NewSidebar/styled";
import useIsMobile from "@/hooks/useIsMobile";
import EditIcon from "@mui/icons-material/Edit";
import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { SxProps, Theme } from "@mui/system";
import Image, { StaticImageData } from "next/image";
import React, { useCallback, useId, useMemo, useState } from "react";

export interface InputFieldProps {
  label?: string | React.ReactNode | React.ReactElement;
  placeholder?: string;
  value?: string;
  name?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  // new events forwarded so consumers (like OTP dialog) can rely on a
  // straight paste hook. Prior versions had reports of the prop not
  // reaching the native <input> which made paste unreliable.
  onInput?: (e: React.FormEvent<HTMLInputElement>) => void;
  onBeforeInput?: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | string;
  variant?: "outlined" | "filled" | "standard";
  size?: "small" | "medium";
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
  success?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  showPasswordToggle?: boolean;
  sideButton?: boolean;
  onSideButtonClick?: () => void;
  sideButtonIcon?: React.ReactNode | StaticImageData;
  sideButtonType?: "primary" | "secondary";
  sideButtonIconWidth?: string;
  sideButtonIconHeight?: string;
  sx?: SxProps<Theme>;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  inputHeight?: string;
  iconBoxSize?: string;
  inputBgColor?: string;
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  inputRef?: React.Ref<HTMLInputElement>;
  autoComplete?: string;
  minRows?: number;
  maxRows?: number;
  ariaLabel?: string;
  ariaInvalid?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  placeholder,
  value = "",
  name,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  onPaste,
  onInput,
  onBeforeInput,
  type = "text",
  variant = "outlined",
  disabled = false,
  readOnly = false,
  error = false,
  success = false,
  helperText = "",
  fullWidth = true,
  startAdornment,
  endAdornment,
  sideButton = false,
  onSideButtonClick,
  sideButtonIcon,
  sideButtonType = "primary",
  sideButtonIconWidth,
  sideButtonIconHeight,
  sx,
  multiline = false,
  rows = 1,
  maxLength,
  inputMode,
  inputHeight,
  inputBgColor,
  iconBoxSize,
  minRows = 1,
  maxRows,
  inputRef,
  autoComplete,
  ariaLabel,
  ariaInvalid,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");

  const borderColor = useMemo(
    () =>
      success
        ? theme.palette.success.main
        : error
          ? theme.palette.error.main
          : theme.palette.border.main,
    [error, success, theme],
  );
  const focusBorderColor = useMemo(
    () =>
      success
        ? theme.palette.success.main
        : error
          ? theme.palette.error.main
          : theme.palette.border.focus,
    [error, success, theme],
  );
  const borderWidth = "1px";

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (type === "number") {
        if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
          e.preventDefault();
          return;
        }
      }

      if (type === "password" && e.key === " ") {
        e.preventDefault();
        return;
      }

      if (onKeyDown) {
        onKeyDown(e as React.KeyboardEvent<HTMLInputElement>);
      }
    },
    [onKeyDown, type],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (type === "number") {
        const pastedText = e.clipboardData.getData("text");
        if (pastedText.includes("e") || pastedText.includes("E")) {
          e.preventDefault();
          return;
        }
      }

      if (onPaste) {
        onPaste(e as React.ClipboardEvent<HTMLInputElement>);
      }
    },
    [onPaste, type],
  );

  const handleInputRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (!inputRef) {
        return;
      }

      if (typeof inputRef === "function") {
        inputRef(el);
      } else {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current =
          el;
      }
    },
    [inputRef],
  );

  const autoCompleteValue = useMemo(() => {
    if (autoComplete) {
      return autoComplete;
    }

    if (type === "password") {
      return "new-password";
    }

    return "off";
  }, [autoComplete, type]);

  const formId = useId();

  const renderSideButtonIcon = () => {
    const iconWidth = sideButtonIconWidth ?? (isMobile ? "16px" : "18px");
    const iconHeight = sideButtonIconHeight ?? (isMobile ? "16px" : "18px");

    if (!sideButtonIcon) {
      return (
        <EditIcon
          sx={{
            fontSize: iconWidth,
            width: iconWidth,
            height: iconHeight,
          }}
        />
      );
    }

    if (typeof sideButtonIcon === "object" && "src" in sideButtonIcon) {
      const widthNum = parseInt(iconWidth.replace("px", "")) || 12;
      const heightNum = parseInt(iconHeight.replace("px", "")) || 12;

      return (
        <Image
          src={sideButtonIcon}
          alt="icon"
          width={widthNum}
          height={heightNum}
          style={{
            display: "flex",
            objectFit: "contain",
            width: iconWidth,
            height: iconHeight,
          }}
          draggable={false}
        />
      );
    }

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: iconWidth,
          height: iconHeight,
          "& svg": {
            fontSize: iconWidth,
            width: iconWidth,
            height: iconHeight,
          },
        }}
      >
        {sideButtonIcon as React.ReactNode}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        width: fullWidth ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        ...sx,
      }}
    >
      {label && (
        <Typography
          component="label"
          variant="body2"
          sx={{
            fontWeight: 500,
            fontFamily: "UrbanistMedium",
            fontSize: isMobile ? "14px" : "15px",
            textAlign: "start",
            color: theme.palette.text.primary,
            lineHeight: 1.2,
            letterSpacing: 0,
          }}
          className="label"
          htmlFor={name}
        >
          {typeof label === "string" ? <span>{label}</span> : label}
        </Typography>
      )}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: fullWidth ? "100%" : "auto",
        }}
      >
        <Box
          component="div"
          sx={{
            display: "flex",
            alignItems: multiline ? "flex-start" : "center",
            gap: "8px",
            width: fullWidth ? "100%" : "auto",
          }}
        >
          <TextField
            id={name}
            placeholder={placeholder}
            value={value}
            name={name}
            onChange={(e) => {
              if (type === "password") {
                // Strip spaces from password input
                const newValue = e.target.value.replace(/\s/g, "");
                if (onChange) {
                  onChange({
                    ...e,
                    target: {
                      ...e.target,
                      value: newValue,
                    },
                  } as React.ChangeEvent<HTMLInputElement>);
                }
              } else {
                onChange?.(e as React.ChangeEvent<HTMLInputElement>);
              }
            }}
            onBlur={onBlur}
            onFocus={onFocus}
            type={type}
            variant={variant}
            disabled={disabled}
            inputRef={handleInputRef}
            inputProps={{
              readOnly: readOnly,
              maxLength: maxLength,
              inputMode: inputMode,
              form: formId,
              autoComplete: autoCompleteValue,
              "aria-invalid":
                ariaInvalid !== undefined ? ariaInvalid : error || undefined,
              "aria-label":
                ariaLabel ?? (typeof label === "string" ? label : undefined),
              onKeyDown: handleKeyDown,
              onPaste: handlePaste,
              onInput: onInput,
              onBeforeInput: onBeforeInput,
              autoCorrect: "off",
              autoCapitalize: "off",
              spellCheck: false,
              style: {
                cursor: readOnly ? "not-allowed" : "auto",
              },
            }}
            fullWidth={sideButton ? false : fullWidth}
            multiline={multiline}
            rows={multiline && !minRows && !maxRows ? rows : undefined}
            minRows={multiline ? minRows : undefined}
            maxRows={multiline ? maxRows : undefined}
            error={error}
            helperText={undefined}
            InputProps={{
              startAdornment: startAdornment ? (
                <InputAdornment position="start">
                  {startAdornment}
                </InputAdornment>
              ) : undefined,
              endAdornment: endAdornment ? (
                <InputAdornment position="end">{endAdornment}</InputAdornment>
              ) : undefined,
            }}
            sx={{
              ...sx,
              ...(sideButton && { flex: 1 }),
              borderRadius: "6px !important",
              boxShadow: "none",
              fontFamily: "UrbanistMedium",
              "& .MuiInputBase-root": {
                ...(multiline
                  ? {
                      minHeight: inputHeight ?? (isMobile ? "44px" : "40px"),
                      alignItems: "flex-start",
                      padding: "0px !important",
                    }
                  : {
                      height: inputHeight ?? (isMobile ? "44px" : "40px"),
                    }),
                borderRadius: "6px",
                boxSizing: "border-box",
                "& input, & textarea": {
                  padding: "11px 14px",
                  boxSizing: "border-box",
                  fontSize: isMobile ? "14px" : "13px",
                  lineHeight: "1.5",
                  color: disabled ? "#B0BEC5" : theme.palette.text.primary,
                  "&::placeholder": {
                    color: theme.palette.text.secondary,
                    opacity: 1,
                    fontFamily: "UrbanistMedium",
                    fontSize: isMobile ? "14px" : "13px",
                    lineHeight: 1.2,
                  },
                  fontFamily: "UrbanistMedium",
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
                },
                "& textarea": {
                  resize: "none",
                  overflow: "auto",
                },
              },
              "& .MuiOutlinedInput-root": {
                borderRadius: "6px",
                backgroundColor:
                  inputBgColor ??
                  (disabled
                    ? theme.palette.action.disabledBackground
                    : success
                      ? theme.palette.success.light
                      : error
                        ? (theme.palette.mode === "dark" ? "rgba(239,68,68,0.05)" : "#FFFBFB")
                        : theme.palette.background.paper),
                transition: "all 0.3s ease",
                boxShadow: "rgba(16, 24, 40, 0.05) 0px 1px 2px 0px",
                "& fieldset": {
                  borderColor: borderColor,
                  borderWidth: borderWidth,
                },
                "&:hover fieldset": {
                  borderColor: disabled ? borderColor : focusBorderColor,
                },
                "&.Mui-focused fieldset": {
                  borderColor: focusBorderColor,
                  borderWidth: "1px",
                },
                "&.Mui-disabled": {
                  backgroundColor: theme.palette.action.disabledBackground,
                  opacity: 1,
                },
                "& input": {
                  "&:-webkit-autofill": {
                    WebkitBoxShadow: `0 0 0 1000px ${theme.palette.background.paper} inset`,
                    WebkitTextFillColor: theme.palette.text.primary,
                  },
                },
              },
              "& .MuiOutlinedInput-input.Mui-disabled": {
                WebkitTextFillColor: theme.palette.text.disabled,
              },
            }}
          />

          {sideButton && (
            <CopyButton type="button" onClick={onSideButtonClick}>{renderSideButtonIcon()}</CopyButton>
          )}
        </Box>

        {helperText && (
          <Typography
            sx={{
              margin: "6px 0 0 0",
              fontSize: isMobile ? "12px" : "13px",
              fontFamily: "UrbanistMedium",
              fontWeight: 500,
              color: error
                ? theme.palette.error.main
                : theme.palette.text.secondary,
              lineHeight: isMobile ? "1.2" : "20px",
              textAlign: "start",
            }}
            className="helper-text"
          >
            {helperText}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default InputField;
