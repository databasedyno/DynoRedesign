import { useCompanyStore } from "@/contexts/CompanyDataContext";
import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Switch,
  useTheme,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import Image from "next/image";

import axiosBaseApi from "@/axiosConfig";
import { useCompanySettingsDialog } from "@/Components/UI/CompanySettingsDialog/context";
import useIsMobile from "@/hooks/useIsMobile";
import { rootReducer, ICompany } from "@/utils/types";

import SwapIcon from "@/assets/Icons/swap-round-icon.svg";
import { API_ENDPOINTS } from "@/api/endpoints";
import { brandFg } from "@/constants/theme";

const STABLECOIN_LABELS: Record<string, string> = {
  usdt_trc20: "USDT (TRC-20)",
  usdt_erc20: "USDT (ERC-20)",
  usdc_erc20: "USDC (ERC-20)",
  "USDT-TRC20": "USDT (TRC-20)",
  "USDT-ERC20": "USDT (ERC-20)",
  "USDC-ERC20": "USDC (ERC-20)",
  "USDT-POLYGON": "USDT (Polygon)",
};

interface SettlementOption {
  currency: string;
  chain: string;
  wallet_type: string;
  wallet_address: string;
}

const ConversionBanner = () => {
  const muiTheme = useTheme();
  const isMobile = useIsMobile("md");
  const { openCompanySettings } = useCompanySettingsDialog();
  const { t } = useTranslation("dashboardLayout");

  const companyState = useCompanyStore();
  const selectedCompanyId = companyState.selectedCompanyId;
  const company: ICompany | null =
    companyState.companyList?.find(
      (c: ICompany) => c.company_id === selectedCompanyId
    ) ??
    companyState.companyList?.[0] ??
    null;

  const [enabled, setEnabled] = useState(false);
  const [stablecoin, setStablecoin] = useState("");
  const [stablecoinChain, setStablecoinChain] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [availableOptions, setAvailableOptions] = useState<SettlementOption[]>([]);
  const [hasStablecoinWallet, setHasStablecoinWallet] = useState(false);
  const [showStablecoinPicker, setShowStablecoinPicker] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!company?.company_id) {
      setLoading(false);
      return;
    }
    try {
      const res = await axiosBaseApi.get(
        API_ENDPOINTS.company.autoConvert(company.company_id)
      );
      const data = res?.data?.data;
      if (data) {
        setEnabled(data.auto_convert_enabled === true);
        const options = data.available_settlement_options || [];
        setAvailableOptions(options);
        setHasStablecoinWallet(options.length > 0);

        // Set current stablecoin from settings
        const currency = data.settlement_currency;
        const chain = data.settlement_chain;
        if (currency && chain) {
          setStablecoin(`${currency}-${chain}`);
          setStablecoinChain(chain);
        } else if (options.length > 0) {
          // Default to first available option
          setStablecoin(options[0].wallet_type);
          setStablecoinChain(options[0].chain);
        }
      }
    } catch {
      // Silently fail — will show default OFF state
    } finally {
      setLoading(false);
    }
  }, [company?.company_id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleToggle = async () => {
    if (!company?.company_id || toggling) return;

    // Case 1: Disabling — always allowed
    if (enabled) {
      setToggling(true);
      setEnabled(false);
      try {
        await axiosBaseApi.put(
          API_ENDPOINTS.company.autoConvert(company.company_id),
          { auto_convert_enabled: false }
        );
      } catch {
        setEnabled(true); // Revert
      } finally {
        setToggling(false);
      }
      return;
    }

    // Case 2: No stablecoin wallet → don't toggle, user needs to add wallet
    if (!hasStablecoinWallet) {
      return; // Tooltip will show the message
    }

    // Case 3: Has wallet but no stablecoin configured → show picker
    if (!stablecoin && availableOptions.length > 0) {
      setShowStablecoinPicker(true);
      return;
    }

    // Case 4: If picker is showing and no selection yet, show picker
    if (availableOptions.length > 1 && !stablecoin) {
      setShowStablecoinPicker(true);
      return;
    }

    // Case 5: Everything configured → enable
    await enableAutoConvert(stablecoin);
  };

  const enableAutoConvert = async (walletType: string) => {
    if (!company?.company_id) return;
    setToggling(true);
    setEnabled(true); // Optimistic

    // Parse wallet_type like "USDT-TRC20" into currency + chain
    const option = availableOptions.find((o) => o.wallet_type === walletType);
    const currency = option?.currency || walletType.split("-")[0];
    const chain = option?.chain || walletType.split("-")[1];

    try {
      await axiosBaseApi.put(
        API_ENDPOINTS.company.autoConvert(company.company_id),
        {
          auto_convert_enabled: true,
          settlement_currency: currency,
          settlement_chain: chain,
        }
      );
      setStablecoin(walletType);
      setShowStablecoinPicker(false);
    } catch {
      setEnabled(false); // Revert
    } finally {
      setToggling(false);
    }
  };

  const handleStablecoinSelect = (walletType: string) => {
    setStablecoin(walletType);
    enableAutoConvert(walletType);
  };

  if (loading || !company) return null;

  const stablecoinLabel =
    STABLECOIN_LABELS[stablecoin] || stablecoin || "Stablecoin";

  const toggleDisabled = toggling || (!hasStablecoinWallet && !enabled);

  return (
    <Box
      sx={{
        mb: 2.5,
        px: { xs: "16px", md: "0px" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: isMobile ? 1 : 2,
          px: isMobile ? 2 : 2.5,
          py: isMobile ? 1.25 : 1.5,
          borderRadius: "14px",
          border: "1px solid",
          borderColor: enabled ? "#22C55E33" : muiTheme.palette.divider,
          backgroundColor: enabled
            ? "#22C55E08"
            : muiTheme.palette.background.paper,
          transition: "all 0.25s ease",
        }}
      >
        {/* Left: Icon + text */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 1 : 1.5,
            minWidth: 0,
            flex: 1,
          }}
        >
          <Box
            sx={{
              width: isMobile ? 32 : 36,
              height: isMobile ? 32 : 36,
              borderRadius: "10px",
              backgroundColor: enabled
                ? "#22C55E1A"
                : muiTheme.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background-color 0.25s ease",
            }}
          >
            <Image
              src={SwapIcon}
              alt="Auto-convert"
              width={16}
              height={16}
              style={{
                filter: enabled
                  ? "brightness(0) saturate(100%) invert(56%) sepia(74%) saturate(513%) hue-rotate(93deg) brightness(98%) contrast(88%)"
                  : "brightness(0) saturate(100%) invert(45%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(93%) contrast(90%)",
                transition: "filter 0.25s ease",
              }}
              draggable={false}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: isMobile ? 13 : 14,
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
                color: muiTheme.palette.text.primary,
                lineHeight: 1.3,
                letterSpacing: 0,
              }}
            >
              {t("autoConvertToStablecoins")}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? 11 : 12,
                fontFamily: "var(--font-sans)",
                color: !hasStablecoinWallet && !enabled
                  ? "#F59E0B"
                  : muiTheme.palette.text.secondary,
                lineHeight: 1.3,
                letterSpacing: 0,
                mt: 0.25,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {!hasStablecoinWallet && !enabled
                ? t("setupStablecoinWallet")
                : enabled
                ? t("settlingIn", { stablecoin: stablecoinLabel })
                : t("protectRevenueFromVolatility")}
            </Typography>
          </Box>
        </Box>

        {/* Right: Toggle + Configure/Picker */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 0.5 : 1.5,
            flexShrink: 0,
          }}
        >
          {/* Stablecoin picker — inline dropdown */}
          {showStablecoinPicker && !enabled && availableOptions.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value=""
                displayEmpty
                onChange={(e) => handleStablecoinSelect(e.target.value as string)}
                sx={{
                  fontSize: 12,
                  fontFamily: "var(--font-sans)",
                  height: 32,
                  "& .MuiSelect-select": {
                    py: 0.5,
                  },
                }}
              >
                <MenuItem value="" disabled>
                  {t("selectStablecoin")}
                </MenuItem>
                {availableOptions.map((opt) => (
                  <MenuItem key={opt.wallet_type} value={opt.wallet_type}>
                    {STABLECOIN_LABELS[opt.wallet_type] || opt.wallet_type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Tooltip
            title={
              !hasStablecoinWallet && !enabled
                ? t("setupStablecoinWallet")
                : ""
            }
            arrow
            placement="top"
          >
            <span>
              <Switch
                checked={enabled}
                onChange={handleToggle}
                disabled={toggleDisabled}
                size="small"
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": {
                    color: "#22C55E",
                  },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: "#22C55E",
                  },
                }}
              />
            </span>
          </Tooltip>
          <Typography
            onClick={() => {
              if (company) openCompanySettings(company);
            }}
            sx={{
              fontSize: isMobile ? 12 : 13,
              fontFamily: "var(--font-sans)",
              color: brandFg(muiTheme.palette.mode === "dark"),
              cursor: "pointer",
              whiteSpace: "nowrap",
              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            {t("configure")}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ConversionBanner;
