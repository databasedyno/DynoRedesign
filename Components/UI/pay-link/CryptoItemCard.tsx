import CheckIcon from "@/assets/Icons/Check-icon.svg";
import { theme } from "@/styles/theme";
import { CryptoItemCardProps } from "@/utils/types/create-pay-link";
import {Box, Grid, useMediaQuery, useTheme} from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import React from "react";
import { Text } from "../../Page/CreatePaymentLink/styled";

const STABLECOIN_LABELS = [
  "USDT-TRC20", "USDT-ERC20", "USDC-ERC20",
  "USDT-POLYGON", "RLUSD", "RLUSD-ERC20",
];

const CryptoItemCard: React.FC<CryptoItemCardProps> = React.memo(
  ({
    item,
    isMobile,
    walletNotSetUp,
    paymentSettings,
    setPaymentSettings,
    tPaymentLink,
    isLarge,
    isSmall,
  }) => {
    const router = useRouter();

    const handleSetUpWalletClick = (cryptocurrency: string) => {
      sessionStorage.setItem(
        "walletAction",
        JSON.stringify({
          openCreate: true,
          cryptocurrency,
        }),
      );

      router.push("/wallet");
    };

    return (
      <Grid
        item
        xs={
          useMediaQuery("(min-width:1200px) and (max-width:1299px)")
            ? 6
            : isLarge
              ? 4
              : isSmall
                ? 6
                : 12
        }
        key={item.label}
      >
        <Box
          onClick={() => {
            if (walletNotSetUp.includes(item.label)) return;
            setPaymentSettings((prev: any) => {
              const exists = (prev.acceptedCryptoCurrency as string[]).includes(
                item.label,
              );
              return {
                ...prev,
                acceptedCryptoCurrency: exists
                  ? prev.acceptedCryptoCurrency.filter(
                      (currency: any) => currency !== item.label,
                    )
                  : [...prev.acceptedCryptoCurrency, item.label],
              };
            });
          }}
          sx={{
            cursor: "pointer",
            height: isMobile ? "50px" : "66px",
            maxWidth: "326px",
            border: `1px solid ${
              paymentSettings.acceptedCryptoCurrency.includes(item.label)
                ? theme.palette.border.success
                : walletNotSetUp.includes(item.label)
                  ? theme.palette.border.main
                  : theme.palette.text.secondary
            }`,
            borderRadius: "14px",
            padding: isMobile ? "10px" : "18px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            userSelect: "none",
            WebkitUserSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Box
              sx={{
                height: "30px",
                width: "30px",
                border: `0.48px solid ${theme.palette.border.main}`,
                borderRadius: "50%",
                backgroundColor: theme.palette.secondary.light,
                padding: "6.5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                }}
              >
                <Image
                  src={item.icon}
                  alt={item.label}
                  fill
                  draggable={false}
                  style={{ objectFit: "contain" }}
                />
              </Box>
            </Box>

            <Text
              sx={{
                width: item.name === "POLYGON USDT" ? "80px" : "auto",
                whiteSpace: "wrap",
                fontSize: "15px",
                color: theme.palette.text.primary,
              }}
            >
              {item.name}
            </Text>

            <Box
              sx={{
                height: "30px",
                width: "fit-content",
                border: `0.48px solid ${theme.palette.border.main}`,
                borderRadius: "100px",
                backgroundColor: theme.palette.secondary.light,
                padding: "6px 13px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Text
                sx={{
                  fontSize: "13px",
                  color: theme.palette.text.primary,
                }}
              >
                {item.label}
              </Text>
            </Box>
          </Box>

          {STABLECOIN_LABELS.includes(item.label) && (
            <Text sx={{ fontSize: "12px", color: theme.palette.text.secondary }}>
              {tPaymentLink("stable")}
            </Text>
          )}

          <Box
            sx={{
              height: isMobile ? "18px" : "24px",
              width: isMobile ? "18px" : "24px",
              backgroundColor: paymentSettings.acceptedCryptoCurrency.includes(
                item.label,
              )
                ? theme.palette.success.main
                : "",
              border: `1px solid ${
                paymentSettings.acceptedCryptoCurrency.includes(item.label)
                  ? theme.palette.border.success
                  : theme.palette.text.secondary
              }`,
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: isMobile ? "6px" : "3px",
              marginBottom: isMobile ? "6px" : "3px",
              marginRight: isMobile ? "4px" : "6px",
            }}
          >
            {paymentSettings.acceptedCryptoCurrency.includes(item.label) && (
              <Image
                height={isMobile ? 6.75 : 9}
                width={isMobile ? 9.75 : 13}
                src={CheckIcon}
                alt={item.label}
                draggable={false}
                style={{ objectFit: "contain" }}
              />
            )}
          </Box>
          {walletNotSetUp.includes(item.label) && (
            <Text
              onClick={() => handleSetUpWalletClick(item.label)}
              sx={{
                position: "absolute",
                bottom: isMobile ? "2px" : "3px",
                right: isMobile ? "5px" : "7px",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: isMobile ? "10px" : "12px",
                color: "#98989D",
                ":hover": {
                  color: theme.palette.primary.main,
                },
              }}
            >
              {tPaymentLink("setUpWalletFirst")}
            </Text>
          )}
        </Box>
      </Grid>
    );
  },
);
CryptoItemCard.displayName = "CryptoItemCard";

export default CryptoItemCard;
