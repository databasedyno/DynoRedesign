import SwapHorizIcon from "@/assets/Icons/swap-round-icon.svg";
import {
  Box,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Typography,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import InfoBanner from "@/Components/UI/InfoBanner";
import CustomRadio from "@/Components/UI/RadioGroup";
import SettingsAccordion from "@/Components/UI/SettingsAccordion";
import Image from "next/image";

export type CryptoConversionSectionProps = {
  value: string;
  convertTo: string;
  onFieldsChange: (fields: Record<string, unknown>) => void;
  isMobile?: boolean;
  expanded: boolean;
  onAccordionChange: (event: React.SyntheticEvent, isExpanded: boolean) => void;
};

export default function CryptoConversionSection({
  value,
  convertTo,
  onFieldsChange,
  isMobile = false,
  expanded,
  onAccordionChange,
}: CryptoConversionSectionProps) {
  const { t: tSettings } = useTranslation("companySettings");

  return (
    <SettingsAccordion
      icon={
        <Image
          src={SwapHorizIcon}
          alt="swap horiz"
          width={16}
          height={16}
          className="themed-icon"
          draggable={false}
        />
      }
      title={tSettings("cryptoConversion")}
      subtitle={tSettings("cryptoConversionSubtitle")}
      expanded={expanded}
      onChange={onAccordionChange}
      isMobile={isMobile}
      sx={{ borderBottom: "none" }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <InfoBanner message={tSettings("cryptoConversionAlert")} />
        <FormControl component="fieldset" sx={{ display: "block" }}>
          <Typography
            component="label"
            sx={{
              display: "block",
              fontSize: isMobile ? "13px" : "15px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              color: "text.primary",
              lineHeight: "18px",
              mb: 1.5,
            }}
          >
            {tSettings("cryptoConversionAutoConvert")}
          </Typography>
          <RadioGroup
            name="auto_convert_volatile_crypto"
            value={value ?? "no"}
            onChange={(e) =>
              onFieldsChange({
                auto_convert_volatile_crypto: e.target.value,
              })
            }
            sx={{ flexDirection: "column", gap: 0.5, mt: 0.5, ml: "10px" }}
          >
            <FormControlLabel
              value="yes"
              control={<CustomRadio sx={{ mr: 1 }} />}
              label={tSettings("cryptoConversionYes")}
              sx={{
                "& .MuiFormControlLabel-label": {
                  fontSize: isMobile ? "13px" : "14px",
                  fontFamily: "var(--font-sans)",
                  color: "text.secondary",
                },
              }}
            />
            <FormControlLabel
              value="no"
              control={<CustomRadio sx={{ mr: 1 }} />}
              label={tSettings("cryptoConversionNo")}
              sx={{
                "& .MuiFormControlLabel-label": {
                  fontSize: isMobile ? "13px" : "14px",
                  fontFamily: "var(--font-sans)",
                  color: "text.secondary",
                },
              }}
            />
          </RadioGroup>
          <Typography
            variant="body2"
            sx={{
              mt: 1,
              fontSize: isMobile ? "13px" : "14px",
              fontFamily: "var(--font-sans)",
              color: "text.secondary",
            }}
          >
            {tSettings("cryptoConversionFee")}
          </Typography>
        </FormControl>
        <FormControl component="fieldset" sx={{ display: "block" }}>
          <Typography
            component="label"
            sx={{
              display: "block",
              fontSize: isMobile ? "13px" : "15px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              color: "text.primary",
              mb: 1.5,
            }}
          >
            {tSettings("cryptoConversionConvertTo")}
          </Typography>
          <RadioGroup
            name="convert_to_stablecoin"
            value={convertTo ?? "usdt_trc20"}
            onChange={(e) =>
              onFieldsChange({
                convert_to_stablecoin: e.target.value,
              })
            }
            sx={{ flexDirection: "column", gap: 0.5, mt: 0.5, ml: "10px" }}
          >
            <FormControlLabel
              value="usdt_trc20"
              control={<CustomRadio sx={{ mr: 1 }} />}
              label={tSettings("cryptoConversionUsdtTrc20")}
              sx={{
                "& .MuiFormControlLabel-label": {
                  fontSize: isMobile ? "13px" : "14px",
                  fontFamily: "var(--font-sans)",
                  color: "text.secondary",
                },
              }}
            />
            <FormControlLabel
              value="usdt_erc20"
              control={<CustomRadio sx={{ mr: 1 }} />}
              label={tSettings("cryptoConversionUsdtErc20")}
              sx={{
                "& .MuiFormControlLabel-label": {
                  fontSize: isMobile ? "13px" : "14px",
                  fontFamily: "var(--font-sans)",
                  color: "text.secondary",
                },
              }}
            />
            <FormControlLabel
              value="usdc_erc20"
              control={<CustomRadio sx={{ mr: 1 }} />}
              label={tSettings("cryptoConversionUsdcErc20")}
              sx={{
                "& .MuiFormControlLabel-label": {
                  fontSize: isMobile ? "13px" : "14px",
                  fontFamily: "var(--font-sans)",
                  color: "text.secondary",
                },
              }}
            />
          </RadioGroup>
        </FormControl>
      </Box>
    </SettingsAccordion>
  );
}
