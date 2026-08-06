import { useWalletStore } from "@/contexts/WalletDataContext";
import { Box, Button, Collapse, Divider, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";

import { useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import {
  createEncryption,
  generateRedirectUrl,
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
import {
  CallMissedOutgoingRounded,
  NorthEastRounded,
} from "@mui/icons-material";
import { paymentTypes } from "@/utils/enums";
import FormManager from "../Common/FormManager";
import Dropdown from "@/Components/UI/Dropdown";
import { usePaymentRates } from "@/hooks/usePaymentRates";
import { useTranslation } from "react-i18next";
import { API_ENDPOINTS } from "@/api/endpoints";

const timer = (ms: any) => new Promise((res) => setTimeout(res, ms));

const currencyListItems = ["EUR", "GBP", "NGN"];

const BankAccountComponent = () => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const dispatch = useDispatch();
  const walletState = useWalletStore();
  const [checkVerify, setCheckVerify] = useState(false);
  const [accountDetails, setAccountDetails] = useState<CommonDetails>();
  const [selectedCurrency, setSelectedCurrency] = useState<currencyData>();
  const [loading2, setLoading2] = useState(false);
  const [collapse, setCollapse] = useState(false);

  // Use shared hook for currency rates
  const { rates: currencyRates, loading } = usePaymentRates({
    source: walletState.currency,
    amount: walletState.amount,
    currencyList: currencyListItems,
    enabled: !!(walletState.amount && walletState.currency),
  });

  useEffect(() => {
    if (currencyRates && currencyRates.length > 0 && !selectedCurrency) {
      setSelectedCurrency(currencyRates[0] as any);
    }
  }, [currencyRates]);

  useEffect(() => {
    if (accountDetails) {
      setLoading2(false);
    }
  }, [accountDetails]);

  const handleSubmit = async () => {
    window.open(accountDetails?.redirect);
    setCheckVerify(true);
  };

  useEffect(() => {
    if (checkVerify) {
      verifyStatus();
    }
  }, [checkVerify]);

  const initiateBankAccountTransfer = async () => {
    const finalPayload = {
      paymentType: paymentTypes.BANK_ACCOUNT,
      currency: selectedCurrency?.currency,
      amount: selectedCurrency?.amount,
    };
    console.log(finalPayload);
    const res = await createEncryption(JSON.stringify(finalPayload));
    setLoading2(true);
    setCollapse(true);
    const {
      data: { data },
    }: { data: CommonApiRes } = await axiosBaseApi.post(API_ENDPOINTS.wallet.addFunds, {
      data: res,
    });
    setAccountDetails(data);
  };

  const verifyStatus = async () => {
    let counter = 0;

    while (checkVerify) {
      await timer(5000);
      counter++;
      try {
        const {
          data: { data },
        } = await axiosBaseApi.post(API_ENDPOINTS.wallet.verifyPayment, {
          uniqueRef: accountDetails?.hash,
        });
        const redirectUri = generateRedirectUrl(data);

        window.location.replace(redirectUri);
      } catch (e: any) {
        const message = e.response.data.message ?? e.message;
        // dispatch({
        //   type: TOAST_SHOW,
        //   payload: {
        //     message: message,
        //     severity: "error",
        //   },
        // });
      }
    }
    if (counter > 20) {
      setCheckVerify(false);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: "550px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        mt: 5,
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
              background: theme.palette.secondary.main + "11",
              border: "1px solid #a2a2a2",
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
            <Collapse in={!collapse}>
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
                    menuItems={currencyListItems.map((x) => {
                      return { label: x, value: x };
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
                      disabled={loading2}
                      onClick={() => initiateBankAccountTransfer()}
                    >
                      Pay
                    </Button>
                  </Box>
                </>
              </Box>
            </Collapse>

            <Collapse in={collapse}>
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
                <Box sx={{ textAlign: "center", mt: 3 }}>
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
                        fontSize: 64,
                        background: theme.palette.secondary.main,
                        width: "fit-content",
                        lineHeight: 0,
                        p: 1.5,
                        borderRadius: "50%",
                        color: "#fff",
                      }}
                    >
                      <NorthEastRounded fontSize="inherit" />
                    </Box>
                    <Typography>
                      {t("redirectToCompletePayment")}
                    </Typography>
                  </Box>
                  <Button
                    variant="rounded"
                    sx={{ mt: 3 }}
                    disabled={checkVerify}
                    onClick={handleSubmit}
                  >
                    Proceed
                  </Button>
                </Box>
              )}
            </Collapse>
          </Box>
        </>
      )}
    </Box>
  );
};

export default BankAccountComponent;
