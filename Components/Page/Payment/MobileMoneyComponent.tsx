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

import FormManager from "../Common/FormManager";
import * as yup from "yup";
import TextBox from "@/Components/UI/TextBox";
import Dropdown from "@/Components/UI/Dropdown";
import { paymentTypes } from "@/utils/enums";
import { NorthEastRounded } from "@mui/icons-material";
import { usePaymentRates } from "@/hooks/usePaymentRates";
import { useTranslation } from "react-i18next";
import { API_ENDPOINTS } from "@/api/endpoints";

const initialValue = {
  network: "MTN",
  mobile: "",
};

const currencyListItems = ["KES", "GHS", "RWF", "UGX"];

const MobileMoneyComponent = () => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const dispatch = useDispatch();
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const [networkCollapse, setNetworkCollapse] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<currencyData>();
  const [checkVerify, setCheckVerify] = useState(false);
  const [hash, setHash] = useState("");
  const [loading2, setLoading2] = useState(false);

  const paymentSchema = yup.object().shape({
    mobile: yup
      .string()
      .required("Mobile number is required!")
      .length(10, "Please enter a valid mobile number!"),
  });

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

  const handleSubmit = async (values: any) => {
    try {
      const finalPayload = {
        ...values,
        currency: selectedCurrency?.currency,
        amount: selectedCurrency?.amount,
        paymentType: paymentTypes.MOBILE_MONEY,
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
        setHash(data.hash);
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
      } = await axiosBaseApi.post(API_ENDPOINTS.wallet.verifyPayment, {
        uniqueRef: hash,
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

  return (
    <Box
      sx={{
        maxWidth: "450px",
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
                <FormManager
                  initialValues={initialValue}
                  yupSchema={paymentSchema}
                  onSubmit={handleSubmit}
                >
                  {({
                    errors,
                    handleBlur,
                    handleChange,
                    submitDisable,
                    touched,
                    values,
                  }) => (
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
                            if (value === "GHS" || value === "UGX") {
                              setNetworkCollapse(true);
                            } else {
                              setNetworkCollapse(false);
                            }
                            setSelectedCurrency(currencyRates[currentIndex] as any);
                            const e: any = {
                              target: {
                                value: "MTN",
                                name: "network",
                              },
                            };
                            handleChange(e);
                          }
                        }}
                        defaultValue={selectedCurrency?.currency}
                      />
                      <Collapse in={networkCollapse}>
                        <Box sx={{ mt: 3 }}>
                          <Dropdown
                            menuItems={
                              selectedCurrency?.currency === "GHS"
                                ? [
                                    { label: "MTN", value: "MTN" },
                                    { label: "VODAFONE", value: "VODAFONE" },
                                    { label: "TIGO", value: "TIGO" },
                                  ]
                                : [
                                    { label: "MTN", value: "MTN" },
                                    { label: "AIRTEL", value: "AIRTEL" },
                                  ]
                            }
                            fullWidth
                            label="Network"
                            getValue={(value: any) => {
                              const e: any = {
                                target: {
                                  value,
                                  name: "network",
                                },
                              };
                              handleChange(e);
                            }}
                            defaultValue={values.network}
                          />
                        </Box>
                      </Collapse>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                          rowGap: "20px",
                          width: "100%",
                          mt: 3,
                        }}
                      >
                        <TextBox
                          name="mobile"
                          placeholder="Enter mobile number"
                          label="Mobile number"
                          value={values.mobile}
                          fullWidth
                          onChange={(e) => {
                            handleChange(e);
                          }}
                          onBlur={handleBlur}
                          error={touched.mobile && errors.mobile}
                          helperText={
                            touched.mobile && errors.mobile && errors.mobile
                          }
                        />
                      </Box>
                      <Box sx={{ mt: 3, textAlign: "right" }}>
                        <Button
                          variant="rounded"
                          type="submit"
                          disabled={checkVerify ? checkVerify : submitDisable}
                        >
                          Pay
                        </Button>
                      </Box>
                    </>
                  )}
                </FormManager>
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
                      {t("completeFromMpesa")}
                    </Typography>
                  </Box>
                  <Button
                    variant="rounded"
                    sx={{ mt: 3 }}
                    onClick={handleVerify}
                  >
                    {t("completedPayment")}
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

export default MobileMoneyComponent;
