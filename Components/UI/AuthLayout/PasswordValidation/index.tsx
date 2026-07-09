import React, { useEffect, useRef, useState } from "react";
import { Box, Popover, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import CorrectIcon from "@/assets/Icons/correct-icon.png";
import WrongIcon from "@/assets/Icons/wrong-icon.png";
import { useTranslation } from "react-i18next";
import useIsMobile from "@/hooks/useIsMobile";

export interface PasswordValidationProps {
  password: string;
  anchorEl?: HTMLElement | null;
  open?: boolean;
  onClose?: () => void;
  showOnMobile?: boolean;
}

interface ValidationState {
  capital: boolean;
  lowercase: boolean;
  special: boolean;
  digit: boolean;
  length: boolean;
}

const PasswordValidation: React.FC<PasswordValidationProps> = ({
  password,
  anchorEl,
  open = false,
  onClose,
  showOnMobile = false,
}) => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const isMobile = useIsMobile("lg");
  const [validation, setValidation] = useState<ValidationState>({
    capital: false,
    lowercase: false,
    special: false,
    digit: false,
    length: false,
  });

  useEffect(() => {
    const capital = /[A-Z]/.test(password);
    const lowercase = /[a-z]/.test(password);
    const digit = /\d/.test(password);
    const special = /[!@#$%^&*()\-=_+{}\[\]:;<>,.?/~]/.test(password);
    const length = password.length >= 8 && password.length <= 20;

    setValidation({
      capital,
      lowercase,
      special,
      digit,
      length,
    });
  }, [password]);

  const ValidationItem: React.FC<{
    isValid: boolean;
    text: string;
  }> = ({ isValid, text }) => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        color: isValid ? theme.palette.success.dark : theme.palette.error.main,
      }}
    >
      {isValid ? (
        <Image
          src={CorrectIcon}
          alt="Valid"
          width={isMobile ? 12 : 14}
          height={isMobile ? 12 : 14}
          style={{
            flexShrink: 0,
          }}
          draggable={false}
        />
      ) : (
        <Image
          src={WrongIcon}
          alt="Invalid"
          width={isMobile ? 12 : 14}
          height={isMobile ? 12 : 14}
          style={{
            flexShrink: 0,
          }}
          draggable={false}
        />
      )}
      <Typography
        sx={{
          fontSize: isMobile ? "12px" : "13px",
          fontFamily: "var(--font-sans)",
          lineHeight: 1.2,
        }}
      >
        {text}
      </Typography>
    </Box>
  );

  const ValidationContent = () => (
    <Box
      sx={{
        p: isMobile ? "12px" : "18px",
        position: "relative",
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.border.main}`,
        borderRadius: "16px",
        boxShadow: "rgba(52, 93, 157, 0.09) 0px 4px 6.3px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: -1,
        minWidth: isMobile ? "max-content" : "250px",
        maxWidth: isMobile ? "100%" : "fit-content",

        /* ---------------- DESKTOP ARROW (RIGHT) ---------------- */
        ...(!isMobile && {
          "&::before": {
            content: '""',
            position: "absolute",
            top: "50%",
            right: -10,
            transform: "translateY(-50%)",
            width: 0,
            height: 0,
            borderTop: "10px solid transparent",
            borderBottom: "10px solid transparent",
            borderLeft: `10px solid ${theme.palette.border.main}`,
          },
          "&::after": {
            content: '""',
            position: "absolute",
            top: "50%",
            right: -9,
            transform: "translateY(-50%)",
            width: 0,
            height: 0,
            borderTop: "9px solid transparent",
            borderBottom: "9px solid transparent",
            borderLeft: `9px solid ${theme.palette.background.paper}`,
          },
        }),

        /* ---------------- MOBILE ARROW (TOP) ---------------- */
        ...(isMobile && {
          mt: "8px",
          zIndex: 5,
          "&::before": {
            content: '""',
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderBottom: `10px solid ${theme.palette.border.main}`,
          },
          "&::after": {
            content: '""',
            position: "absolute",
            top: -9,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderBottom: `9px solid ${theme.palette.background.paper}`,
          },
        }),
      }}
    >
      <ValidationItem
        isValid={validation.capital}
        text={t("passwordValidationCapital")}
      />
      <ValidationItem
        isValid={validation.lowercase}
        text={t("passwordValidationLowercase")}
      />
      <ValidationItem
        isValid={validation.special}
        text={t("passwordValidationSpecial")}
      />
      <ValidationItem
        isValid={validation.digit}
        text={t("passwordValidationDigit")}
      />
      <ValidationItem
        isValid={validation.length}
        text={t("passwordValidationLength")}
      />
    </Box>
  );

  // On mobile, show inline below the field
  if (isMobile) {
    return password.length > 0 && showOnMobile ? <ValidationContent /> : null;
  }

  // On desktop, show in Popover on the left side
  return (
    <Popover
      open={open && password.length > 0}
      anchorEl={anchorEl}
      onClose={onClose}
      disableEnforceFocus
      disableAutoFocus
      anchorOrigin={{
        vertical: "center",
        horizontal: "left",
      }}
      transformOrigin={{
        vertical: "center",
        horizontal: "right",
      }}
      sx={{
        "& .MuiPaper-root": {
          background: "transparent",
          p: isMobile ? "0px" : "18px",
          boxShadow: "none",
        },
      }}
    >
      <ValidationContent />
    </Popover>
  );
};

export default PasswordValidation;
