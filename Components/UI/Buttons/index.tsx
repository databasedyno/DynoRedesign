import useIsMobile from "@/hooks/useIsMobile";
import { Box, Button as MuiButton, CircularProgress, Typography, useTheme } from "@mui/material";
import { SxProps, Theme } from "@mui/system";
import Image, { StaticImageData } from "next/image";
import React from "react";

export interface CustomButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "outlined" | "danger";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  /**
   * When true, the button behaves as disabled (no clicks) BUT keeps its
   * variant color (e.g. primary stays blue) and shows a CircularProgress
   * spinner in place of the label. Use this for "verifying / submitting"
   * states so the user gets clear "we heard you, working on it" feedback
   * instead of the button graying out.
   */
  loading?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode | StaticImageData;
  endIcon?: React.ReactNode | StaticImageData;
  iconSize?: number;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  sx?: SxProps<Theme>;
  labelSx?: SxProps<Theme>;
  hideLabelWhenLoading?: boolean;
  showSuccessAnimation?: boolean;
  showErrorAnimation?: boolean;
  hideLabel?: boolean;
  "data-testid"?: string;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  label,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  fullWidth = false,
  startIcon,
  endIcon,
  iconSize,
  onClick,
  type = "button",
  sx,
  labelSx,
  hideLabelWhenLoading = false,
  showSuccessAnimation = false,
  showErrorAnimation = false,
  hideLabel = false,
  "data-testid": dataTestId,
}) => {
  const isMobile = useIsMobile("sm");
  const theme = useTheme();
  const sizeConfig = {
    small: {
      padding: "8px 16px",
      fontSize: "13px",
      height: "32px",
      gap: "6px",
    },
    medium: {
      padding: "15px 24px",
      fontSize: "15px",
      height: "40px",
      gap: "8px",
    },
    large: {
      padding: "16px 32px",
      fontSize: "16px",
      height: "48px",
      gap: "10px",
    },
  };

  const config = sizeConfig[size];

  const variantConfig = {
    primary: {
      backgroundColor: theme.palette.primary.main,
      color: (theme.palette.primary as any).contrastText || theme.palette.common.white,
      fontFamily: "UrbanistBold",
      borderRadius: "6px",
    },
    secondary: {
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.primary.main,
      border: `1px solid ${theme.palette.primary.main}`,
      fontWeight: 500,
    },
    outlined: {
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
      border: `1px solid ${theme.palette.border.main}`,
      fontWeight: 400,
      fontFamily: "UrbanistRegular",
      fontSize: "15px",
      "&:hover": {
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
      },
      "&:disabled": {
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
      },
    },
    danger: {
      backgroundColor: theme.palette.error.main,
      color: theme.palette.common.white,
      border: `1px solid ${theme.palette.error.main}`,
      fontFamily: "UrbanistBold",
      "&:hover": {
        backgroundColor: theme.palette.error.main,
        color: theme.palette.common.white,
      },
      "&:disabled": {
        backgroundColor: theme.palette.error.main,
        color: theme.palette.common.white,
      },
    },
  };

  const variantStyle = variantConfig[variant];

  const renderIcon = (
    icon: React.ReactNode | StaticImageData | undefined,
    iconSize: number,
  ): React.ReactNode => {
    if (!icon) return null;

    if (typeof icon === "object" && "src" in icon) {
      return (
        <Image
          src={icon}
          alt="icon"
          width={iconSize}
          height={iconSize}
          style={{ display: "flex", objectFit: "contain" }}
          draggable={false}
        />
      );
    }

    return icon as React.ReactNode;
  };

  const finalIconSize = iconSize ?? 10;

  const shouldHideLabel = hideLabelWhenLoading && disabled && !!endIcon;
  const animationClass = showSuccessAnimation
    ? "success-pulse"
    : showErrorAnimation
      ? "error-shake"
      : "";

  // "loading" behaves like disabled (no clicks) but keeps the variant color
  // (e.g. primary stays blue) and swaps the label for a spinner. This gives
  // users clear "processing" feedback without the button turning gray.
  const isBlockedForClicks = disabled || loading;

  return (
    <MuiButton
      type={type}
      data-testid={dataTestId}
      disabled={isBlockedForClicks}
      fullWidth={fullWidth}
      onClick={onClick}
      className={animationClass}
      sx={{
        padding: config.padding,
        fontSize: config.fontSize,
        height: config.height,
        borderRadius: "6px",
        lineHeight: "1",
        textTransform: "none",
        cursor: loading ? "wait" : disabled ? "not-allowed" : "pointer",
        transition: "all 0.3s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: config.gap,
        ...variantStyle,
        ...(variant === "primary" &&
          !isBlockedForClicks && {
            "&:hover": {
              backgroundColor: (theme.palette.primary as any).hover || "#0004FF99",
              color: (theme.palette.primary as any).contrastText || theme.palette.common.white,
            },
          }),
        // When loading (but not user-disabled), KEEP the variant color so
        // the button reads as "active / processing" instead of "disabled".
        ...(loading && !disabled && {
          "&.Mui-disabled": {
            backgroundColor: variantStyle.backgroundColor,
            color: variantStyle.color,
            opacity: 0.9,
          },
        }),
        // Only apply the gray disabled style when the button is DISABLED
        // and NOT loading.
        ...(disabled && !loading && {
          backgroundColor: variant === "primary" ? "#B0BEC5" : theme.palette.background.paper,
          color:
            variant === "primary" ? `${theme.palette.common.white} !important` : `${theme.palette.text.secondary} !important`,
          border: `1px solid ${variant === "primary" ? "#B0BEC5" : theme.palette.text.secondary}`,
          cursor: "not-allowed",
          lineHeight: "1",
        }),
        ...(showSuccessAnimation && {
          animation: "successPulse 0.6s ease-in-out",
          "@keyframes successPulse": {
            "0%, 100%": {
              backgroundColor: variant === "primary" ? theme.palette.primary.main : theme.palette.background.paper,
            },
            "50%": {
              transform: "scale(0.98)",
            },
          },
        }),
        ...(showErrorAnimation && {
          animation: "errorShake 0.5s ease-in-out",
          "@keyframes errorShake": {
            "0%, 100%": {
              transform: "translateX(0)",
            },
            "10%, 30%, 50%, 70%, 90%": {
              transform: "translateX(-5px)",
            },
            "20%, 40%, 60%, 80%": {
              transform: "translateX(5px)",
            },
          },
        }),
        ...sx,
      }}
    >
      {loading ? (
        <>
          <CircularProgress
            size={size === "large" ? 20 : 16}
            thickness={5}
            sx={{
              color: variantStyle.color || theme.palette.common.white,
              mr: 1,
            }}
          />
          {!hideLabel && (
            <Typography
              className="custom-button-label"
              sx={{
                fontSize: isMobile ? "13px" : "15px",
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                lineHeight: "1.2",
                letterSpacing: 0,
                whiteSpace: "nowrap",
                ...labelSx,
              }}
            >
              {label}
            </Typography>
          )}
        </>
      ) : (
        <>
          {startIcon && (
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize:
                  size === "small" ? "16px" : size === "medium" ? "18px" : "20px",
              }}
            >
              {renderIcon(startIcon, finalIconSize)}
            </Box>
          )}

          {!shouldHideLabel && !hideLabel && (
            <Typography
              className="custom-button-label"
              sx={{
                fontSize: isMobile ? "13px" : "15px",
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                lineHeight: "1.2",
                letterSpacing: 0,
                whiteSpace: "nowrap",
                ...labelSx,
              }}
            >
              {label}
            </Typography>
          )}

          {endIcon && (
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize:
                  size === "small" ? "10px" : size === "medium" ? "10px" : "20px",
              }}
            >
              {renderIcon(endIcon, finalIconSize)}
            </Box>
          )}
        </>
      )}
    </MuiButton>
  );
};

export default CustomButton;
