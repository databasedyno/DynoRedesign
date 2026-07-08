import { Box, Button, Divider, Typography } from "@mui/material";
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
  BankTransferApiRes,
  currencyData,
  transferDetails,
} from "@/utils/types/paymentTypes";
import { paymentTypes } from "@/utils/enums";
import { usePaymentRates } from "@/hooks/usePaymentRates";
import { useTranslation } from "react-i18next";

const BankTransferComponent = () => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const dispatch = useDispatch();
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const [selectedCurrency, setSelectedCurrency] = useState<currencyData>();
  const [transferDetails, setTransferDetails] = useState<transferDetails>();
  const [loading, setLoading] = useState(true);

  // Use shared hook for currency rates
  const isNGN = walletState.currency === "NGN";
  const { rates: currencyRates } = usePaymentRates({
    source: walletState.currency,
    amount: walletState.amount,
    currencyList: ["NGN"],
    enabled: !!(walletState.amount && walletState.currency && !isNGN),
  });

  useEffect(() => {
    if (transferDetails) {
      setLoading(false);
    }
  }, [transferDetails]);

  useEffect(() => {
    if (walletState.amount && walletState.currency && isNGN) {
      setSelectedCurrency({
        currency: "NGN",
        amount: walletState.amount.toString(),
        transferRate: "1",
      });
    }
  }, [walletState.amount]);

  useEffect(() => {
    if (currencyRates && currencyRates.length > 0 && !isNGN) {
      setSelectedCurrency(currencyRates[0] as any);
    }
  }, [currencyRates]);

  useEffect(() => {
    if (selectedCurrency?.currency) {
      initiateBankTransfer();
    }
  }, [selectedCurrency]);

  const handleSubmit = async () => {
    try {
      const {
        data: { data },
      } = await axiosBaseApi.post("/wallet/verifyPayment", {
        uniqueRef: transferDetails?.hash,
      });
      const redirectUri = generateRedirectUrl(data);
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

  const initiateBankTransfer = async () => {
    const finalPayload = {
      paymentType: paymentTypes.BANK_TRANSFER,
      currency: selectedCurrency?.currency,
      amount: selectedCurrency?.amount,
    };
    const res = await createEncryption(JSON.stringify(finalPayload));

    const {
      data: { data },
    }: { data: BankTransferApiRes } = await axiosBaseApi.post(
      "/wallet/addFunds",
      {
        data: res,
      }
    );
    setTransferDetails(data);
  };

  return (
    <Box
      sx={{
        maxWidth: "500px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        mt: 5,
      }}
    >
      <Typography>
        {t("proceedToBankApp")}
      </Typography>
      {loading ? (
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
                  {selectedCurrency?.currency +
                    " " +
                    (transferDetails?.transfer_amount ??
                      selectedCurrency?.amount)}
                  {selectedCurrency?.currency !== walletState.currency && (
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
                  )}
                </Typography>
              </Box>
              {selectedCurrency?.currency !== walletState.currency && (
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
                      " " +
                        getCurrencySymbol(
                          selectedCurrency.currency,
                          selectedCurrency.transferRate
                        )}
                    )
                  </Typography>
                </Box>
              )}
            </Box>
            <Box>
              <Typography className="topText">{t("accountNumberLabel")}</Typography>
              <Typography className="mainText">
                {transferDetails?.transfer_account ?? "00000"}
              </Typography>
            </Box>
            <Box>
              <Typography className="topText">{t("bankNameLabel")}</Typography>
              <Typography className="mainText">
                {transferDetails?.transfer_bank ?? "Bank"}
              </Typography>
            </Box>
            <Box>
              <Typography className="topText">Note</Typography>
              <Typography className="mainText">
                {transferDetails?.transfer_note ?? "Bank"}
              </Typography>
            </Box>
            <Divider />
            <Typography fontSize={14}>
              The account details only valid for specific transaction and
              it&apos;ll expire by{" "}
              <Typography component={"span"} fontSize={14} fontWeight={700}>
                {getTime(transferDetails?.account_expiration)}(Today)
              </Typography>
            </Typography>
          </Box>
          <Button variant="rounded" sx={{ mt: 3 }} onClick={handleSubmit}>
            {t("madeBankTransfer")}
          </Button>
        </>
      )}
    </Box>
  );
};

export default BankTransferComponent;
