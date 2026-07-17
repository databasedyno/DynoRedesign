import TrueIcon from "@/assets/Icons/True.svg";
import InfoIcon from "@/assets/Icons/info-icon.svg";
import { TaxSectionProps } from "@/utils/types/create-pay-link";
import { Box, useTheme } from "@mui/material";
import Image from "next/image";
import React from "react";
import { Text } from "../../Page/CreatePaymentLink/styled";
import CustomSwitch from "../CustomSwitch";

const TaxSection: React.FC<TaxSectionProps> = ({
  isMobile,
  tPaymentLink,
  includeTax,
  setIncludeTax,
  currentLng,
  taxInclusive = false,
  setTaxInclusive,
}) => {
  const theme = useTheme();
  return (
  <>
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? "12px" : "16px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? "4px" : "8px",
        }}
      >
        <Text
          sx={{
            fontSize: isMobile ? "15px" : "20px",
            color: theme.palette.text.primary,
          }}
        >
          {tPaymentLink("tax")}
        </Text>
        <Text
          sx={{
            fontSize: isMobile ? "12px" : "15px",
            color: theme.palette.text.secondary,
          }}
        >
          {tPaymentLink("taxDescription")}
        </Text>
      </Box>

      <Box
        sx={{
          // On mobile allow the row to fluidly fill the container instead of
          // pinning to 324px which overflowed iPhone SE (320px viewport minus
          // the outer 16px padding = 288px effective).
          width: { xs: "100%", sm: "324px", md: "300px" },
          maxWidth: "100%",
          height: "49px",
          border: `1px solid ${theme.palette.border.main}`,
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px 0 14px",
        }}
      >
        <Text sx={{ fontSize: "13px", color: theme.palette.text.primary }}>
          {tPaymentLink("includeTax")}
        </Text>
        <Box sx={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <CustomSwitch
            checked={includeTax}
            onChange={(e, checked) => setIncludeTax(checked)}
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                backgroundColor: theme.palette.primary.main,
              },
            }}
          />
          <Text
            sx={{
              width: currentLng === "en" ? "23px" : "59px",
              fontSize: "13px",
              color: theme.palette.text.primary,
            }}
          >
            {includeTax ? tPaymentLink("on") : tPaymentLink("off")}
          </Text>
        </Box>
      </Box>

      {includeTax && setTaxInclusive ? (
        <Box
          sx={{
            width: { xs: "100%", sm: "324px", md: "300px" },
            maxWidth: "100%",
            minHeight: "49px",
            border: `1px solid ${theme.palette.border.main}`,
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            padding: "8px 8px 8px 14px",
          }}
          data-testid="paylink-tax-inclusive-row"
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <Text sx={{ fontSize: "13px", color: theme.palette.text.primary }}>
              Prices include tax
            </Text>
            <Text sx={{ fontSize: "11px", color: theme.palette.text.secondary }}>
              Back out VAT from the price instead of adding on top
            </Text>
          </Box>
          <Box sx={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <CustomSwitch
              checked={taxInclusive}
              onChange={(e, checked) => setTaxInclusive(checked)}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                  backgroundColor: theme.palette.primary.main,
                },
              }}
            />
            <Text
              sx={{
                width: currentLng === "en" ? "23px" : "59px",
                fontSize: "13px",
                color: theme.palette.text.primary,
              }}
            >
              {taxInclusive ? tPaymentLink("on") : tPaymentLink("off")}
            </Text>
          </Box>
        </Box>
      ) : null}

      {includeTax ? (
        <Box
          display={{
            width: "fit-content",
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "8px" : "12px",
            padding: "20px 24px",
            border: `1px solid ${theme.palette.border.success}`,
            borderRadius: "14px",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Image
              src={TrueIcon}
              alt="true icon"
              width={14}
              height={14}
              draggable={false}
            />
            <Text
              sx={{
                fontSize: isMobile ? "13px" : "15px",
                fontWeight: 700,
                fontFamily: "var(--font-sans)",
                color: theme.palette.border.success,
              }}
            >
              {tPaymentLink("taxEnabled")}
            </Text>
          </Box>

          <Text
            sx={{
              fontSize: isMobile ? "12px" : "15px",
              color: theme.palette.border.success,
              whiteSpace: "pre-line",
            }}
          >
            {tPaymentLink("taxWillBeCalculatedAtCheckout")}
          </Text>

          <Box marginTop={"4px"}>
            <Text
              sx={{
                fontSize: isMobile ? "12px" : "15px",
                color: theme.palette.text.primary,
                mb: isMobile ? "2px" : "0px",
              }}
            >
              {tPaymentLink("taxExamples")}
            </Text>
            <Text
              sx={{
                fontSize: isMobile ? "12px" : "15px",
                color: theme.palette.text.primary,
                paddingLeft: "25px",
              }}
            >
              <li>{tPaymentLink("taxExamplePortugal")}</li>
              <li>{tPaymentLink("taxExampleGermany")}</li>
              <li>{tPaymentLink("taxExampleUK")}</li>
              <li>{tPaymentLink("taxExampleUSA")}</li>
            </Text>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            width: "fit-content",
            border: `1px solid ${theme.palette.border.main}`,
            borderRadius: "7px",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? "8px" : "12px",
            padding: isMobile ? "8px 14px" : "12px 14px 12px 18px",
            backgroundColor: theme.palette.primary.light,
          }}
        >
          <Image
            src={InfoIcon}
            alt="info icon"
            width={16}
            height={16}
            draggable={false}
            className="themed-icon"
          />
          <Text
            sx={{
              fontSize: isMobile ? "10px" : "13px",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
              whiteSpace: "wrap",
            }}
          >
            {tPaymentLink("taxInfo")}
          </Text>
        </Box>
      )}
    </Box>
  </>
  );
};

export default TaxSection;
