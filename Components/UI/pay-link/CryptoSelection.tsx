import CheckIcon from "@/assets/Icons/Check-icon.svg";
import SearchIcon from "@/assets/Icons/search-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import { theme } from "@/styles/theme";
import { CryptoSelectionProps } from "@/utils/types/create-pay-link";
import { Box, Grid } from "@mui/material";
import Image from "next/image";
import React from "react";
import { useTranslation } from "react-i18next";
import { Text } from "../../Page/CreatePaymentLink/styled";
import { SearchIconButton } from "../../Page/HelpAndSupport/styled";
import CryptoItemCard from "./CryptoItemCard";

const CryptoSelection: React.FC<CryptoSelectionProps> = ({
  isMobile,
  searchTerm,
  setSearchTerm,
  handleSearch,
  cryptoItems,
  allCryptoItems,
  filteredCryptoItems,
  showFilteredCryptoItems,
  showAllCoins,
  setShowAllCoins,
  hasPaymentLinkData,
  isLarge,
  isSmall,
  walletNotSetUp,
  paymentSettings,
  setPaymentSettings,
}) => {
  const { t } = useTranslation("createPaymentLinkScreen");
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
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            gap: "4px",
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
              {t("acceptedCryptocurrencies")}
            </Text>
            <Text
              sx={{
                fontSize: isMobile ? "12px" : "15px",
                color: theme.palette.text.secondary,
              }}
            >
              {t("whichCryptoCanCustomersUseToPay")}
            </Text>
          </Box>
          <Text
            sx={{
              alignSelf: isMobile ? "flex-start" : "flex-end",
              fontSize: isMobile ? "12px" : "15px",
              color: theme.palette.text.primary,
            }}
          >
            {t("atLeastOneCurrencyMustBeSelected")}
          </Text>
        </Box>

        {hasPaymentLinkData && (
          <Box sx={{ display: "flex", gap: "8px" }}>
            <InputField
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              type="text"
              inputMode="text"
              placeholder={t("searchCryptocurrencies")}
              sx={{ width: "100%" }}
            />
            <SearchIconButton onClick={handleSearch}>
              <Image src={SearchIcon} alt="search" width={20} height={20} className="themed-icon-primary" />
            </SearchIconButton>
          </Box>
        )}

        <Grid container columnSpacing={"10px"} rowSpacing={"10px"}>
          {(showFilteredCryptoItems
            ? filteredCryptoItems
            : cryptoItems
          ).map((item) => (
            <CryptoItemCard
              key={item.label}
              item={item}
              isMobile={isMobile}
              walletNotSetUp={walletNotSetUp}
              paymentSettings={paymentSettings}
              setPaymentSettings={setPaymentSettings}
              tPaymentLink={t}
              isLarge={isLarge}
              isSmall={isSmall}
            />
          ))}
        </Grid>

        {!showAllCoins && cryptoItems.length < 15 && (
          <Box
            onClick={() => setShowAllCoins(true)}
            sx={{
              height: isMobile ? "32px" : "40px",
              border: `1px solid ${theme.palette.text.primary}`,
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Text
              sx={{
                fontSize: isMobile ? "13px" : "15px",
                color: theme.palette.text.primary,
              }}
            >
              {t("showAll", { count: 15 - cryptoItems.length })}
            </Text>
          </Box>
        )}
        {showAllCoins && (
          <Box
            onClick={() => setShowAllCoins(false)}
            sx={{
              height: isMobile ? "32px" : "40px",
              border: `1px solid ${theme.palette.text.primary}`,
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Text
              sx={{
                fontSize: isMobile ? "13px" : "15px",
                color: theme.palette.text.primary,
              }}
            >
              {t("showLess")}
            </Text>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: isMobile ? "10px" : "",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: isMobile ? "8px" : "12px",
              alignItems: "center",
            }}
          >
            <Box
              sx={{
                height: isMobile ? "18px" : "24px",
                width: isMobile ? "18px" : "24px",
                backgroundColor:
                  paymentSettings.acceptedCryptoCurrency.length > 0
                    ? theme.palette.success.main
                    : "",
                border: `1px solid ${
                  paymentSettings.acceptedCryptoCurrency.length > 0
                    ? theme.palette.border.success
                    : theme.palette.text.secondary
                }`,
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {paymentSettings.acceptedCryptoCurrency.length > 0 && (
                <Image
                  height={isMobile ? 6.75 : 9}
                  width={isMobile ? 9.75 : 13}
                  src={CheckIcon}
                  alt="checkIcon"
                  draggable={false}
                  style={{ objectFit: "contain" }}
                />
              )}
            </Box>

            <Text
              sx={{
                fontSize: isMobile ? "12px" : "15px",
                color: theme.palette.text.primary,
              }}
            >
              {`${paymentSettings.acceptedCryptoCurrency.length} ${t("of")} ${allCryptoItems.length} ${t("currenciesSelected")}`}
            </Text>
          </Box>
          <Box sx={{ display: "flex", gap: "16px" }}>
            {[t("selectAll"), t("clearAll")].map((item) => {
              const first = item === t("selectAll");
              return (
                <Box
                  onClick={() => {
                    if (item === t("selectAll")) {
                      // BUGFIX 2026-07-09: select from the FULL currency list, not the
                      // visible slice (collapsed view shows only 5) — otherwise
                      // "Select all" captured just the 5 on-screen coins.
                      setPaymentSettings((prev: any) => ({
                        ...prev,
                        acceptedCryptoCurrency: allCryptoItems
                          .map((item) => {
                            if (!walletNotSetUp.includes(item.label))
                              return item.label;
                            return null;
                          })
                          .filter((item) => item !== null) as string[],
                      }));
                      // Expand the grid so every selected currency is visible
                      setShowAllCoins(true);
                    } else {
                      setPaymentSettings((prev: any) => ({
                        ...prev,
                        acceptedCryptoCurrency: [],
                      }));
                    }
                  }}
                  key={item}
                  sx={{
                    width: isMobile ? "155px" : "190px",
                    height: isMobile ? "32px" : "40px",
                    cursor:
                      paymentSettings.acceptedCryptoCurrency.length === 0 &&
                      !first
                        ? "not-allowed"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: first
                      ? `1px solid ${theme.palette.primary.main}`
                      : paymentSettings.acceptedCryptoCurrency.length > 0
                        ? `1px solid ${theme.palette.text.secondary}`
                        : `1px solid ${theme.palette.border.main}`,
                    color: first
                      ? theme.palette.primary.main
                      : paymentSettings.acceptedCryptoCurrency.length > 0
                        ? theme.palette.text.primary
                        : theme.palette.text.secondary,
                  }}
                >
                  <Text
                    sx={{
                      fontSize: isMobile ? "13px" : "15px",
                      fontWeight: 500,
                    }}
                  >
                    {item}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default CryptoSelection;
