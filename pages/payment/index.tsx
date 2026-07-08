import axiosBaseApi from "@/axiosConfig";
import BrandLogo from "@/Components/Layout/BrandLogo";
import paymentAuth from "@/Components/Page/Common/HOC/paymentAuth";
import BankAccountComponent from "@/Components/Page/Payment/BankAccountComponent";
import BankTransferComponent from "@/Components/Page/Payment/BankTransferComponent";

import CardComponent from "@/Components/Page/Payment/CardComponent";
import GooglePayComponent from "@/Components/Page/Payment/GooglePayComponent";
import MobileMoneyComponent from "@/Components/Page/Payment/MobileMoneyComponent";
import QRCodeComponent from "@/Components/Page/Payment/QRCodeComponent";
import USSDComponent from "@/Components/Page/Payment/USSDComponent";
import { createEncryption } from "@/helpers";
import useTokenData from "@/hooks/useTokenData";
import { paymentTypes } from "@/utils/enums";
import { rootReducer } from "@/utils/types";
import {
  CommonApiRes,
  CommonDetails,
  BankTransferApiRes,
  transferDetails,
} from "@/utils/types/paymentTypes";

import {
  AccountBalanceRounded,
  CreditCardRounded,
  CurrencyBitcoinRounded,
} from "@mui/icons-material";
import { Box, Divider, Grid, Typography, useTheme } from "@mui/material";
import React, { useEffect, useState } from "react";
import "react-credit-cards-2/dist/es/styles-compiled.css";
import { useSelector } from "react-redux";
import CyrptoComponent from "../../Components/Page/Payment/CryptoComponent";
import { useTranslation } from "react-i18next";

const paymentMethods = [
  { label: "Card", value: paymentTypes.CARD, icon: <CreditCardRounded /> },
  {
    label: "Bank Transfer (NGN)",
    value: paymentTypes.BANK_TRANSFER,
    icon: <AccountBalanceRounded />,
  },
  {
    label: "Bank Account",
    value: paymentTypes.BANK_ACCOUNT,
    icon: <AccountBalanceRounded />,
  },
  {
    label: "Google Pay",
    value: paymentTypes.GOOGLE_PAY,
    icon: <AccountBalanceRounded />,
  },
  {
    label: "Apple Pay",
    value: paymentTypes.APPLE_PAY,
    icon: <AccountBalanceRounded />,
  },
  {
    label: "USSD",
    value: paymentTypes.USSD,
    icon: <AccountBalanceRounded />,
  },
  {
    label: "Mobile Money",
    value: paymentTypes.MOBILE_MONEY,
    icon: <AccountBalanceRounded />,
  },
  {
    label: "NQR",
    value: paymentTypes.QR_CODE,
    icon: <AccountBalanceRounded />,
  },
  {
    label: "Crypto",
    value: paymentTypes.CRYPTO,
    icon: <CurrencyBitcoinRounded />,
  },
];

const Payment = () => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const tokenData = useTokenData();
  const [paymentType, setPaymentType] = useState(paymentTypes.CARD);
  const [transferDetails, setTransferDetails] = useState<transferDetails>();
  const [accountDetails, setAccountDetails] = useState<CommonDetails>();
  const walletState = useSelector((state: rootReducer) => state.walletReducer);

  useEffect(() => {
    if (
      paymentType === paymentTypes.GOOGLE_PAY ||
      paymentType === paymentTypes.APPLE_PAY
    ) {
      initiateGoogleApplyPayTransfer();
    }
  }, [paymentType]);

  const initiateGoogleApplyPayTransfer = async () => {
    const finalPayload = {
      paymentType,
      currency: walletState.currency,
      amount: walletState.amount,
    };
    const res = await createEncryption(JSON.stringify(finalPayload));

    const {
      data: { data },
    }: { data: CommonApiRes } = await axiosBaseApi.post("/wallet/addFunds", {
      data: res,
    });
    setAccountDetails(data);
  };

  return (
    <Box sx={{ height: "100vh" }}>
      <Grid container sx={{ height: "100vh" }} alignItems={"center"}>
        <Grid
          item
          md={3}
          sx={{
            background: theme.palette.primary.main,
            height: "inherit",
          }}
        >
          {/* <Box sx={{ textAlign: "center" }}>
            <BrandLogo />
          </Box> */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              boxShadow: "0 0 5px #121212",
              height: "100%",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexDirection: "column",
                color: "#fff",
                gap: 2,
                "& .paymentBox": {
                  display: "flex",
                  gap: 1,
                  p: 3,
                  px: 5,
                  width: "100%",
                  cursor: "pointer",
                  "&.activeBox": {
                    background: "#fff",
                    color: "text.primary",
                  },
                },
              }}
            >
              {paymentMethods.map((x, i) => (
                <Box
                  className={`paymentBox ${
                    paymentType === x.value && "activeBox"
                  }`}
                  key={x.value}
                  onClick={() => setPaymentType(x.value)}
                >
                  {x.icon}
                  <Typography>{x.label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Grid>
        <Grid
          item
          md={8}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexDirection: "column",
              maxWidth: "750px",
              width: "100%",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <BrandLogo redirect={false} />
                <Typography>{t("standardPayment")}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 500, fontSize: 24 }}>
                  {walletState.currency === "NGN" ? "₦" : "$"}
                  {walletState.amount}
                </Typography>
                <Typography sx={{ fontSize: 16 }}>
                  {tokenData?.email}
                </Typography>
              </Box>
            </Box>
            <Divider flexItem sx={{ my: 2 }} />
            {paymentType === paymentTypes.CARD && <CardComponent />}
            {paymentType === paymentTypes.BANK_TRANSFER && (
              <BankTransferComponent />
            )}
            {paymentType === paymentTypes.BANK_ACCOUNT && (
              <BankAccountComponent />
            )}
            {(paymentType === paymentTypes.GOOGLE_PAY ||
              paymentType === paymentTypes.APPLE_PAY) && (
              <GooglePayComponent accountDetails={accountDetails} />
            )}
            {paymentType === paymentTypes.USSD && <USSDComponent />}
            {paymentType === paymentTypes.MOBILE_MONEY && (
              <MobileMoneyComponent />
            )}
            {paymentType === paymentTypes.QR_CODE && <QRCodeComponent />}
            {paymentType === paymentTypes.CRYPTO && <CyrptoComponent />}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default paymentAuth(Payment);
// export default Payment;
