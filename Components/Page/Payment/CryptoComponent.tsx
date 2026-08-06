import { useWalletStore } from "@/contexts/WalletDataContext";
import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";

import { useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import {
  createEncryption,
  generateRedirectUrl,
  generateStatusUrl,
  getCurrencySymbol,
  getTime,
} from "@/helpers";
import LoadingIcon from "@/assets/Icons/LoadingIcon";
import axiosBaseApi from "@/axiosConfig";
import { useRouter } from "next/router";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import {
  CommonApiRes,
  CommonDetails,
  currencyData,
} from "@/utils/types/paymentTypes";

import FormManager from "../Common/FormManager";
import * as yup from "yup";
import TextBox from "@/Components/UI/TextBox";
import Dropdown from "@/Components/UI/Dropdown";
import { paymentTypes } from "@/utils/enums";
import { CopyAllRounded, NorthEastRounded } from "@mui/icons-material";
import { usePaymentRates } from "@/hooks/usePaymentRates";
import { useTranslation } from "react-i18next";
import copyToClipboard from "@/helpers/copyToClipboard";
import { API_ENDPOINTS } from "@/api/endpoints";

const currencyList2 = [
  "BTC",
  "ETH",
  "BCH",
  "BNB",
  "TRX",
  "DOGE",
  "USDT",
  "LTC",
];
const currencyList = [
  { label: "Bitcoin (BTC)", wallet: "BTC", currency: "BTC" },
  { label: "Ethereum (ETH)", wallet: "ETH", currency: "ETH" },
  { label: "Bitcoin Cash (BCH)", wallet: "BCH", currency: "BCH" },
  { label: "Binance Coin (BNB)", wallet: "BSC", currency: "BNB" },
  { label: "TRX (TRON)", wallet: "TRON", currency: "TRX" },
  { label: "Dogecoin (DOGE)", wallet: "DOGE", currency: "DOGE" },
  { label: "USDT (TRON)", wallet: "TRON", currency: "USDT" },
  // { label: "USDT (ERC-20)", wallet: "ETH", currency: "USDT" },
  { label: "Litecoin (LTC)", wallet: "LTC", currency: "LTC" },
];

interface CryptoDetails {
  qr_code: string;
  address: string;
  hash: string;
}

const CyrptoComponent = () => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const dispatch = useDispatch();
  const walletState = useWalletStore();

  const [selectedCurrency, setSelectedCurrency] = useState<currencyData>();
  const [checkVerify, setCheckVerify] = useState(false);
  const [cryptoDetails, setCryptoDetails] = useState<CryptoDetails>({
    qr_code: "",
    hash: "",
    address: "",
  });
  const [loading2, setLoading2] = useState(false);

  // Use shared hook for currency rates (prevents redundant API calls)
  const { rates: currencyRates, loading } = usePaymentRates({
    source: walletState.currency,
    amount: walletState.amount,
    currencyList: currencyList.map((x) => x.currency),
    fixedDecimal: false,
    enabled: !!(walletState.amount && walletState.currency),
  });

  useEffect(() => {
    if (currencyRates && currencyRates.length > 0 && !selectedCurrency) {
      setSelectedCurrency(currencyRates[0] as any);
    }
  }, [currencyRates]);

  const handleSubmit = async (values: any) => {
    try {
      const walletIndex = currencyList.findIndex(
        (x) => x.currency === selectedCurrency?.currency
      );

      const wallet = currencyList[walletIndex].wallet;

      const finalPayload = {
        currency: wallet,
        amount: selectedCurrency?.amount,
        paymentType: paymentTypes.CRYPTO,
      };
      const res = await createEncryption(JSON.stringify(finalPayload));
      setCheckVerify(true);
      setLoading2(true);
      const {
        data: { data },
      }: { data: CommonApiRes } = await axiosBaseApi.post(API_ENDPOINTS.wallet.addFunds, {
        data: res,
      });
      if (data.redirect) {
        window.location.replace(data.redirect);
      } else {
        setCryptoDetails(data);
        setLoading2(false);
      }
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  const handleVerify = async () => {
    try {
      const {
        data: { data },
      } = await axiosBaseApi.post(API_ENDPOINTS.wallet.verifyCryptoPayment, {
        address: cryptoDetails.address,
      });
      const redirectUri = generateStatusUrl(data);
      window.location.replace(redirectUri);
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  return (
    <Box
      sx={{
        maxWidth: "450px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {loading ? (
        <>
          <Typography>{t("pleaseWait")}</Typography>
          <Box
            sx={{
              height: "375px",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LoadingIcon size={75} />
          </Box>
        </>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              p: 3,
              mt: 2,
              minWidth: 500,
              width: "100%",
              // background: theme.palette.secondary.main + "11",
              // border: "1px solid #a2a2a2",
              borderRadius: "5px",
              gap: 2,
              "& .topText": {
                color: "text.disabled",
                fontSize: 12,
                textTransform: "uppercase",
              },
              "& .mainText": {
                fontWeight: 600,
                fontSize: 22,
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography className="topText">Amount</Typography>
                <Typography className="mainText">
                  {selectedCurrency &&
                  selectedCurrency.currency !== walletState.currency ? (
                    <>
                      {selectedCurrency.currency +
                        " " +
                        getCurrencySymbol(
                          selectedCurrency.currency,
                          selectedCurrency.amount
                        )}
                      <Typography
                        component={"span"}
                        ml={1}
                        fontSize={14}
                        color="text.disabled"
                      >
                        (
                        {walletState.currency +
                          " " +
                          getCurrencySymbol(
                            walletState.currency,
                            walletState.amount
                          )}
                        )
                      </Typography>
                    </>
                  ) : (
                    <>
                      {walletState.currency +
                        " " +
                        getCurrencySymbol(
                          walletState.currency,
                          walletState.amount
                        )}
                    </>
                  )}
                </Typography>
              </Box>
              <Box>
                <Typography className="topText" textAlign={"right"}>
                  {t("transferRate")}
                </Typography>
                <Typography fontSize={14} fontWeight={600}>
                  ({" "}
                  {walletState.currency +
                    " " +
                    getCurrencySymbol(walletState.currency, 1)}
                  {" = "}
                  {selectedCurrency &&
                    selectedCurrency.currency +
                      " " +
                      getCurrencySymbol(
                        selectedCurrency.currency,
                        selectedCurrency.transferRate
                      )}
                  )
                </Typography>
              </Box>
            </Box>

            <Collapse in={!checkVerify}>
              <Box
                sx={{
                  mt: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  width: "100%",
                  "& form": {
                    width: "100%",
                  },
                }}
              >
                <>
                  <Dropdown
                    menuItems={currencyList.map((x) => {
                      return { label: x.label, value: x.currency };
                    })}
                    fullWidth
                    label="currency"
                    getValue={(value: any) => {
                      if (currencyRates) {
                        const currentIndex = currencyRates?.findIndex(
                          (x) => x.currency === value
                        );
                        setSelectedCurrency(currencyRates[currentIndex] as any);
                      }
                    }}
                    defaultValue={selectedCurrency?.currency}
                  />

                  <Box sx={{ mt: 3, textAlign: "right" }}>
                    <Button
                      variant="rounded"
                      type="submit"
                      disabled={checkVerify}
                      onClick={handleSubmit}
                    >
                      Pay
                    </Button>
                  </Box>
                </>
              </Box>
            </Collapse>

            <Collapse in={checkVerify}>
              {loading2 ? (
                <>
                  <Typography textAlign={"center"}>{t("pleaseWait")}</Typography>
                  <Box
                    sx={{
                      height: "275px",
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <LoadingIcon size={75} />
                  </Box>
                </>
              ) : (
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Box
                      sx={{
                        "& img": {
                          maxHeight: "350px",
                          minHeight: "250px",
                          width: "auto",
                        },
                      }}
                    >
                      <img src={cryptoDetails?.qr_code} width={300} height={300} alt="Payment QR code" loading="eager" decoding="async" />
                    </Box>
                    <Box sx={{ width: "100%" }}>
                      <TextBox
                        value={cryptoDetails.address}
                        fullWidth
                        label={"address"}
                        InputProps={{
                          endAdornment: (
                            <IconButton
                              onClick={() => {
                                copyToClipboard(
                                  cryptoDetails.address
                                );
                                dispatch({
                                  type: TOAST_SHOW,
                                  payload: { message: "Address copied!", severity: "success" },
                                });
                              }}
                            >
                              <CopyAllRounded />
                            </IconButton>
                          ),
                        }}
                      />
                    </Box>
                    <Typography textAlign={"center"}>
                      Scan the QR Code above on your Crypto app or Copy the
                      above address to complete the payment
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <Button
                      variant="rounded"
                      sx={{ mt: 3 }}
                      onClick={handleVerify}
                    >
                      {t("completedPayment")}
                    </Button>
                  </Box>
                </Box>
              )}
            </Collapse>
          </Box>
        </>
      )}
    </Box>
  );
};

export default CyrptoComponent;
