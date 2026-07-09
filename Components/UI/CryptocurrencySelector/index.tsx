import useIsMobile from "@/hooks/useIsMobile";
import CheckIcon from "@mui/icons-material/Check";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Box,
  ListItemButton,
  ListItemText,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CryptocurrencyDividerLine,
  CryptocurrencyIcon,
  CryptocurrencyText,
  CryptocurrencyTrigger,
  IconChip,
} from "./styled";

import { useWalletData } from "@/hooks/useWalletData";
import { CryptocurrencySelectorProps } from "@/utils/types/wallet";

// export const cryptocurrencies: Cryptocurrency[] = [
//   { code: "BTC", name: "Bitcoin", icon: BitcoinIcon },
//   { code: "ETH", name: "Ethereum", icon: EthereumIcon },
//   { code: "LTC", name: "Litecoin", icon: LitecoinIcon },
//   { code: "BNB", name: "BNB", icon: BNBIcon },
//   { code: "DOGE", name: "Dogecoin", icon: DogecoinIcon },
//   { code: "BCH", name: "Bitcoin Cash", icon: BitcoinCashIcon },
//   { code: "TRX", name: "Tron", icon: TronIcon },
//   { code: "USDT", name: "USDT", icon: USDTIcon },
// ];

const CryptocurrencySelector: React.FC<CryptocurrencySelectorProps> = ({
  label,
  value = "",
  onChange,
  error = false,
  helperText,
  fullWidth = true,
  required = false,
  sx,
  closeDropdownTrigger,
  locked = false,
  showAllWithDisabled = false,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const { t } = useTranslation("walletScreen");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const { cryptocurrencies, allCryptocurrencies } = useWalletData();

  // Options for the dropdown:
  // - default: only currencies NOT yet added (legacy behavior)
  // - showAllWithDisabled: ALL currencies, with already-added ones marked disabled
  const options = useMemo(() => {
    if (!showAllWithDisabled) {
      return cryptocurrencies.map((c) => ({ ...c, disabled: false }));
    }
    const availableCodes = new Set(cryptocurrencies.map((c) => c.code));
    return (allCryptocurrencies || []).map((c: any) => ({
      ...c,
      disabled: !availableCodes.has(c.code),
    }));
  }, [showAllWithDisabled, cryptocurrencies, allCryptocurrencies]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (locked) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (cryptoCode: string) => {
    onChange?.(cryptoCode);
    handleClose();
  };

  const selectedCrypto = cryptocurrencies.find((c) => c.code === value) || {
    value: "",
    name: value || "",
    icon: null,
    code: value || "",
  };
  const isOpen = Boolean(anchorEl);

  // In edit mode the currency may already be in the wallet (filtered out of `cryptocurrencies`).
  // allCryptocurrencies lets us always resolve the icon/name.
  const resolvedCrypto = selectedCrypto.icon
    ? selectedCrypto
    : allCryptocurrencies?.find((c: any) => c.code === value) || selectedCrypto;

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

  useEffect(() => {
    if (closeDropdownTrigger) {
      setAnchorEl(null);
    }
  }, [closeDropdownTrigger]);

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
          sx={{
            fontWeight: 500,
            fontSize: isMobile ? "13px" : "15px",
            color: theme.palette.text.primary,
            fontFamily: "var(--font-sans)",
            lineHeight: "1.2",
            letterSpacing: "0",
          }}
        >
          {label}
          {required && <span style={{ marginLeft: 4 }}>*</span>}
        </Typography>
      )}

      {/* Wrapper */}
      <Box
        sx={{
          position: "relative",
          width: fullWidth ? "100%" : isMobile ? "154px" : "300px",
        }}
      >
        {/* ===== Trigger ===== */}
        <CryptocurrencyTrigger
          onClick={handleOpen}
          data-testid="crypto-selector-trigger"
          data-locked={locked ? "true" : "false"}
          style={locked ? { cursor: "default", pointerEvents: "auto" } : undefined}
        >
          {value === "" ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CryptocurrencyText
                style={{ color: theme.palette.text.disabled }}
              >
                Bitcoin (BTC)
              </CryptocurrencyText>
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <IconChip
                sx={{
                  minWidth: "fit-content",
                  height: isMobile ? "25px" : "30px",
                }}
              >
                {resolvedCrypto.icon && (
                  <CryptocurrencyIcon
                    src={resolvedCrypto.icon}
                    alt={resolvedCrypto.name}
                    width={isMobile ? 14 : 20}
                    height={isMobile ? 14 : 20}
                  />
                )}
                <span>{resolvedCrypto.code}</span>
              </IconChip>
              <CryptocurrencyText>{resolvedCrypto.name}</CryptocurrencyText>
            </Box>
          )}

          <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CryptocurrencyDividerLine />
            {locked ? (
              <LockOutlinedIcon
                data-testid="crypto-selector-lock"
                sx={{
                  fontSize: isMobile ? "15px" : "19px",
                  color: theme.palette.text.secondary,
                }}
              />
            ) : !isOpen ? (
              <ExpandMoreIcon
                sx={{
                  fontSize: isMobile ? "16px" : "22px",
                  color: theme.palette.text.secondary,
                }}
              />
            ) : (
              <ExpandLessIcon
                sx={{
                  fontSize: isMobile ? "16px" : "22px",
                  color: theme.palette.text.secondary,
                }}
              />
            )}
          </Box>
        </CryptocurrencyTrigger>

        {/* ===== Dropdown (never rendered when locked) ===== */}
        {isOpen && !locked && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              width: "100%",
              border: `1px solid ${borderColor}`,
              borderRadius: "6px",
              backgroundColor: theme.palette.background.paper,
              padding: "10px 14px",
              zIndex: 100,
              boxShadow: "0px 8px 24px rgba(0,0,0,0.08)",
            }}
          >
            {/* ===== Header (duplicate trigger) ===== */}
            <Box
              onClick={handleClose}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CryptocurrencyText>
                  {value === ""
                    ? "Bitcoin (BTC)"
                    : `${resolvedCrypto.name} (${value})`}
                </CryptocurrencyText>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CryptocurrencyDividerLine />
                <ExpandLessIcon
                  sx={{
                    fontSize: isMobile ? "16px" : "22px",
                    color: theme.palette.text.secondary,
                  }}
                />
              </Box>
            </Box>

            {/* ===== Content ===== */}
            <Box
              sx={{
                mt: isMobile ? "10px" : "12px",
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? "4px" : "6px",
                maxHeight: isMobile ? "111px" : "128px",
                overflow: "auto",
              }}
            >
              {options.map((crypto) => (
                <ListItemButton
                  key={crypto.code}
                  disabled={crypto.disabled}
                  data-testid={`crypto-option-${crypto.code}`}
                  onClick={() => {
                    if (crypto.disabled) return;
                    handleSelect(crypto.code);
                    handleClose();
                  }}
                  sx={{
                    borderRadius: "50px",
                    p: isMobile ? "6px 14px 6px 5px" : "3px 12px 3px 3px",
                    gap: isMobile ? 1 : 1.5,
                    minHeight: isMobile ? "35px" : "40px",
                    fontFamily: "var(--font-sans)",
                    lineHeight: "1.2",
                    letterSpacing: "0",
                    background:
                      crypto.code === value
                        ? theme.palette.primary.light
                        : "transparent",
                    "&.Mui-disabled": {
                      opacity: 0.45,
                    },
                    "&:hover": {
                      background: theme.palette.primary.light,
                    },
                  }}
                >
                  <IconChip sx={{ minWidth: "fit-content" }}>
                    <CryptocurrencyIcon
                      src={crypto.icon}
                      alt={crypto.name}
                      width={isMobile ? 14 : 20}
                      height={isMobile ? 14 : 20}
                    />
                    <span>{crypto.code}</span>
                  </IconChip>

                  <ListItemText
                    primary={crypto.name}
                    primaryTypographyProps={{
                      sx: {
                        fontWeight: 500,
                        fontSize: isMobile ? "10px" : "15px",
                        fontFamily: "var(--font-sans)",
                        lineHeight: "1.2",
                        letterSpacing: "0",
                      },
                    }}
                  />

                  {crypto.disabled ? (
                    <Box
                      component="span"
                      sx={{
                        ml: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        fontSize: isMobile ? "9px" : "11px",
                        fontWeight: 600,
                        fontFamily: "var(--font-sans)",
                        color: theme.palette.text.secondary,
                        border: `1px solid ${theme.palette.border.main}`,
                        borderRadius: "10px",
                        padding: "2px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <CheckIcon sx={{ fontSize: isMobile ? 10 : 12 }} />
                      {t("alreadyAdded")}
                    </Box>
                  ) : (
                    crypto.code === value && (
                      <CheckIcon
                        sx={{ fontSize: isMobile ? 15 : 18, ml: "auto" }}
                      />
                    )
                  )}
                </ListItemButton>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {helperText && (
        <Typography
          sx={{
            fontSize: isMobile ? "10px" : "13px",
            color: error
              ? theme.palette.error.main
              : theme.palette.text.secondary,
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default CryptocurrencySelector;
