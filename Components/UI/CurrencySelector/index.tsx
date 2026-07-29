import React, { useState, useRef, useEffect } from "react";
import type { StaticImageData } from "next/image";
import {
  Box,
  Typography,
  Popover,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import useIsMobile from "@/hooks/useIsMobile";
import {
  CurrencyTrigger,
  CurrencyFlag,
  CurrencyText,
  CurrencyDropdown,
} from "./styled";

// Import available flags
import unitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";
import euroFlag from "@/assets/Images/Icons/flags/euro-flag.png";
import nigerianFlag from "@/assets/Images/Icons/flags/nigerian-flag.png";
import gbFlag from "@/assets/Images/Icons/flags/gb-flag.png";
import auFlag from "@/assets/Images/Icons/flags/au-flag.png";
import caFlag from "@/assets/Images/Icons/flags/ca-flag.png";
import inFlag from "@/assets/Images/Icons/flags/in-flag.png";
import vnFlag from "@/assets/Images/Icons/flags/vn-flag.png";
import pkFlag from "@/assets/Images/Icons/flags/pk-flag.png";
import brFlag from "@/assets/Images/Icons/flags/br-flag.png";
import arFlag from "@/assets/Images/Icons/flags/ar-flag.png";
import phFlag from "@/assets/Images/Icons/flags/ph-flag.png";
import sgFlag from "@/assets/Images/Icons/flags/sg-flag.png";
import aeFlag from "@/assets/Images/Icons/flags/ae-flag.png";

// Currency data - all supported base currencies (matching backend SUPPORTED_BASE_CURRENCIES)
type CurrencyOption = { code: string; label: string; flag?: StaticImageData };

// Kept in sync with backend SUPPORTED_BASE_CURRENCIES & utils/pricingCurrencies.
// Currencies without a bundled flag asset render a lettered fallback glyph.
const currencies: CurrencyOption[] = [
  { code: "USD", label: "USD", flag: unitedStatesFlag },
  { code: "EUR", label: "EUR", flag: euroFlag },
  { code: "GBP", label: "GBP", flag: gbFlag },
  { code: "AUD", label: "AUD", flag: auFlag },
  { code: "CAD", label: "CAD", flag: caFlag },
  { code: "SGD", label: "SGD", flag: sgFlag },
  { code: "INR", label: "INR", flag: inFlag },
  { code: "PKR", label: "PKR", flag: pkFlag },
  { code: "AED", label: "AED", flag: aeFlag },
  { code: "PHP", label: "PHP", flag: phFlag },
  { code: "VND", label: "VND", flag: vnFlag },
  { code: "BRL", label: "BRL", flag: brFlag },
  { code: "ARS", label: "ARS", flag: arFlag },
  { code: "NGN", label: "NGN", flag: nigerianFlag },
  { code: "KES", label: "KES" },
  { code: "GHS", label: "GHS" },
  { code: "ZAR", label: "ZAR" },
  { code: "XOF", label: "XOF" },
  { code: "XAF", label: "XAF" },
  { code: "EGP", label: "EGP" },
  { code: "MAD", label: "MAD" },
];

// Renders a currency's flag when available, otherwise a compact lettered glyph.
const CurrencyGlyph: React.FC<{ currency: CurrencyOption; size: number }> = ({
  currency,
  size,
}) => {
  if (currency.flag) {
    return (
      <CurrencyFlag
        src={currency.flag.src}
        alt={currency.code}
        width={size}
        height={size}
      />
    );
  }
  return (
    <Box
      aria-label={currency.code}
      sx={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #6C5CE7 0%, #00B894 100%)",
        color: "#fff",
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: Math.max(6, Math.round(size * 0.42)),
        lineHeight: 1,
        letterSpacing: "-0.3px",
        textTransform: "uppercase",
        userSelect: "none",
      }}
    >
      {currency.code.slice(0, 2)}
    </Box>
  );
};

export interface CurrencySelectorProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
  name?: string;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  label,
  value = "USD",
  onChange,
  error = false,
  helperText,
  fullWidth = true,
  required = false,
  name,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (currencyCode: string) => {
    onChange?.(currencyCode);
    handleClose();
  };

  const selectedCurrency =
    currencies.find((c) => c.code === value) || currencies[0];
  const isOpen = Boolean(anchorEl);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        anchorEl &&
        !(anchorEl as HTMLElement).contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, anchorEl]);

  const borderColor = error
    ? theme.palette.error.main
    : theme.palette.border.main;
  const focusBorderColor = error
    ? theme.palette.error.main
    : theme.palette.border.focus;

  return (
    <Box
      sx={{
        width: fullWidth ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
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
            lineHeight: "1.2",
          }}
        >
          {label + " *"}
        </Typography>
      )}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: fullWidth ? "100%" : "auto",
        }}
      >
        <CurrencyTrigger
          ref={triggerRef}
          onClick={handleOpen}
          error={error}
          fullWidth={fullWidth}
          isOpen={isOpen}
          isMobile={isMobile}
          sx={{
            borderColor: borderColor,
            borderRadius: "6px",
            "&:hover": {
              borderColor: focusBorderColor,
            },
            "&:focus": {
              borderColor: focusBorderColor,
            },
            "&:focus-visible": {
              borderColor: focusBorderColor,
            },
            "&:active": {
              borderColor: focusBorderColor,
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "3px" : "4px",
              flex: 1,
            }}
          >
            <CurrencyGlyph
              currency={selectedCurrency}
              size={isMobile ? 14 : 16}
            />
            <CurrencyText isMobile={isMobile}>
              {selectedCurrency.code}
            </CurrencyText>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {isOpen ? (
              <ExpandLessIcon
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: isMobile ? "18px" : "20px",
                }}
              />
            ) : (
              <ExpandMoreIcon
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: isMobile ? "18px" : "20px",
                }}
              />
            )}
          </Box>
        </CurrencyTrigger>

        <Popover
          anchorEl={anchorEl}
          open={isOpen}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          PaperProps={{
            sx: {
              mt: "2px",
              borderRadius: "6px",
              overflow: "hidden",
              fontFamily: "var(--font-sans)",
              width: triggerRef.current?.offsetWidth || "auto",
              border: `1px solid ${borderColor}`,
              borderTop: "none",
              maxHeight: "280px",
              backgroundColor: theme.palette.background.paper,
              boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
            },
          }}
        >
          <CurrencyDropdown>
            {currencies.map((currency) => (
              <ListItemButton
                key={currency.code}
                onClick={() => handleSelect(currency.code)}
                selected={currency.code === value}
                sx={{
                  maxHeight: "32px",
                  borderRadius: "50px",
                  lineHeight: 1.2,
                  p: "8px",
                  gap: isMobile ? "3px" : "4px",
                  background:
                    currency.code === value
                      ? theme.palette.primary.light
                      : "transparent",
                  "&:hover": {
                    background: theme.palette.primary.light,
                  },
                  "&.Mui-selected": {
                    background: theme.palette.primary.light,
                    "&:hover": {
                      background: theme.palette.primary.light,
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: "fit-content" }}>
                  <CurrencyGlyph currency={currency} size={16} />
                </ListItemIcon>
                <ListItemText
                  primary={currency.code}
                  primaryTypographyProps={{
                    sx: {
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      fontSize: isMobile ? "10px" : "13px",
                      color: theme.palette.text.primary,
                      lineHeight: 1.2,
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </CurrencyDropdown>
        </Popover>

        {helperText && (
          <Typography
            sx={{
              margin: "4px 0 0 0",
              fontSize: isMobile ? "10px" : "13px",
              fontWeight: 500,
              color: error
                ? theme.palette.error.main
                : theme.palette.text.secondary,
              lineHeight: 1.2,
              textAlign: "start",
            }}
          >
            {helperText}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default CurrencySelector;
