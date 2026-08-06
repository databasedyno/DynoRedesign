import { useWalletStore } from "@/contexts/WalletDataContext";
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
  currencyData,
  transferDetails,
  USSDApiRes,
} from "@/utils/types/paymentTypes";
import FormManager from "../Common/FormManager";
import * as yup from "yup";
import Dropdown from "@/Components/UI/Dropdown";
import { paymentTypes } from "@/utils/enums";
import { usePaymentRates } from "@/hooks/usePaymentRates";
import { useTranslation } from "react-i18next";
import { API_ENDPOINTS } from "@/api/endpoints";

const BankList = [
  { label: "Select Bank", value: "0" },
  { label: "Access bank ", value: "044" },
  { label: "Ecobank ", value: "050" },
  { label: "Fidelity bank ", value: "070" },
  { label: "First bank of Nigeria ", value: "011" },
  { label: "First city monument bank (FCMB) ", value: "214" },
  { label: "Guaranty trust bank ", value: "058" },
  { label: "Heritage bank ", value: "030" },
  { label: "Keystone bank ", value: "082" },
  { label: "Lotus bank ", value: "303" },
  { label: "Premium Trust bank ", value: "105" },
  { label: "Stanbic IBTC bank ", value: "221" },
  { label: "Sterling bank ", value: "232" },
  { label: "Union bank ", value: "032" },
  { label: "United bank for Africa (UBA) ", value: "033" },
  { label: "Unity Bank ", value: "215" },
  { label: "VFD microfinance bank (09", value: "110" },
  { label: "Wema bank ", value: "035" },
  { label: "Zenith bank ", value: "057" },
];

const USSDComponent = () => {
  const { t } = useTranslation("common");
  const dispatch = useDispatch();
  const walletState = useWalletStore();
  const [ussdDetails, setUssdDetails] = useState({
    note: "",
    payment_code: "",
    hash: "",
  });
  const [currentBank, setCurrentBank] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState<currencyData>();
  const [transferDetails, setTransferDetails] = useState<transferDetails>();

  const cardPaymentSchema = yup.object().shape({
    account_number: yup
      .string()
      .required("please select a bank account")
      .test("expiry", "please select a bank account", (value) => {
        if (value === "0") {
          return false;
        }
        return true;
      }),
  });

  // Use shared hook for currency rates
  const isNGN = walletState.currency === "NGN";
  const { rates: currencyRates, loading } = usePaymentRates({
    source: walletState.currency,
    amount: walletState.amount,
    currencyList: ["NGN"],
    enabled: !!(walletState.amount && walletState.currency && !isNGN),
  });

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

  const handleSubmit = async () => {
    try {
      const {
        data: { data },
      } = await axiosBaseApi.post(API_ENDPOINTS.wallet.verifyPayment, {
        uniqueRef: ussdDetails?.hash,
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

  const handleInitiate = async (values: any) => {
    const index = BankList.findIndex((x) => x.value === values.account_number);
    setCurrentBank(BankList[index].label);
    const finalPayload = {
      ...values,
      paymentType: paymentTypes.USSD,
      currency: selectedCurrency?.currency,
      amount: selectedCurrency?.amount,
    };
    const res = await createEncryption(JSON.stringify(finalPayload));

    const {
      data: { data },
    }: { data: USSDApiRes } = await axiosBaseApi.post(API_ENDPOINTS.wallet.addFunds, {
      data: res,
    });
    setUssdDetails(data);
  };

  return (
    <Box
      sx={{
        maxWidth: "500px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        mt: 5,
      }}
    >
      {!ussdDetails.note ? (
        loading ? (
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
            <Typography>{t("chooseBankToBegin")}</Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                mt: 3,
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
            <Box sx={{ mt: 5, width: "100%" }}>
              <FormManager
                initialValues={{ account_number: "0" }}
                yupSchema={cardPaymentSchema}
                onSubmit={handleInitiate}
              >
                {({
                  errors,
                  handleBlur,
                  handleChange,
                  submitDisable,
                  touched,
                  values,
                }) => (
                  <Box sx={{ width: "100%" }}>
                    <Dropdown
                      label="Select Bank"
                      name="account_number"
                      value={values.account_number}
                      menuItems={BankList}
                      fullWidth
                      getValue={(value: any) => {
                        const e: any = {
                          target: {
                            value,
                            name: "account_number",
                          },
                        };
                        handleChange(e);
                      }}
                      onBlur={handleBlur}
                      error={touched.account_number && errors.account_number}
                      helperText={
                        touched.account_number &&
                        errors.account_number &&
                        errors.account_number
                      }
                    />
                    <Box sx={{ mt: 3, textAlign: "right" }}>
                      <Button
                        variant="rounded"
                        type="submit"
                        disabled={submitDisable}
                        // disabled={isValid === false ? true : submitDisable}
                      >
                        Pay ${walletState.amount}
                      </Button>
                    </Box>
                  </Box>
                )}
              </FormManager>
            </Box>
          </>
        )
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              maxWidth: "400px",
            }}
          >
            <Typography textAlign={"center"}>
              {t("ussdDialInstruction", { bank: currentBank })}
            </Typography>

            <Typography variant="h4" fontWeight={800} mt={5}>
              {ussdDetails.note}
            </Typography>

            <Typography
              fontSize={16}
              fontWeight={600}
              mt={5}
              textAlign={"center"}
            >
              Payment Code : {ussdDetails.payment_code}
            </Typography>
            <Typography
              fontSize={12}
              color={"text.disabled"}
              textAlign={"center"}
            >
              {t("enterPaymentCodeIfNecessary")}
            </Typography>

            <Button variant="rounded" sx={{ mt: 3 }} onClick={handleSubmit}>
              {t("completedPayment")}
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default USSDComponent;
