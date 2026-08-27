import { showToast } from "@/helpers/toastStore";
import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { ArrowBack } from "@mui/icons-material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CopyIcon from "@/assets/Icons/CopyIcon";
import {
  BankTransferApiRes,
  currencyData,
  transferDetails,
} from "@/utils/types/paymentTypes";
import axiosBaseApi from "@/axiosConfig";

import { paymentTypes } from "@/utils/enums";
import { createEncryption, generateRedirectUrl } from "@/helpers";
import Loading from "@/Components/UI/Loading/Index";
import ClockIcon from "@/assets/Icons/ClockIcon";
import Warning from "@/assets/Icons/Warning";
import { Icon } from "@iconify/react/dist/iconify.js";
import { currencyOptions } from "@/pages/pay";
import { formatWithSeparators } from "@/utils/currencyFormat";
import { useTranslation } from "react-i18next";
import copyToClipboard from "@/helpers/copyToClipboard";

interface BankTransferCompoProps {
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  walletState: any;
  setIsSuccess: any;
  setIsBank: any;
  redirectUrl?: string | null;
}

const BankTransferCompo = ({
  activeStep,
  setActiveStep,
  walletState,
  setIsSuccess,
  setIsBank,
  redirectUrl,
}: BankTransferCompoProps) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const isDark = theme.palette.mode === 'dark';
  const [currencyRates, setCurrencyRates] = useState<currencyData[]>();
  const [selectedCurrency, setSelectedCurrency] = useState<currencyData>();
  const [transferDetails, setTransferDetails] = useState<transferDetails>();
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds

  const [loading, setLoading] = useState(true);

  const currencyList = ["EUR", "GBP", "NGN"];

  const handleCopy = () => {
    const account = transferDetails?.transfer_account;

    if (account) {
      copyToClipboard(account);
    } else {
      showToast({
          message: t("checkout.noAccountToCopy"),
          severity: "warning",
        });
    }
  };

  useEffect(() => {
    if (walletState?.amount && walletState?.currency) {
      getCurrencyRate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState?.amount, walletState?.currency]);

  const getCurrencyRate = async () => {
    try {
      const {
        data: { data },
      } = await axiosBaseApi.post("pay/getCurrencyRates", {
        source: walletState?.currency,
        amount: walletState?.amount,
        currencyList: ["NGN"],
      });

      // const {
      //   data: { data }
      // } = await axiosBaseApi.post('pay/getCurrencyRates', {
      //   source: walletState.currency,
      //   amount: walletState.amount,
      //   currencyList: ['NGN']
      // })

      setCurrencyRates(data);
      setSelectedCurrency(data?.[0]);
      initiateBankTransfer(data?.[0]);
      setLoading(false);
    } catch (e: any) {
      const message = e?.response?.data?.message ?? e?.message;
      showToast({
          message: message,
          severity: "error",
        });
    }
  };

  const initiateBankTransfer = async (dataCount: {
    currency: string;
    amount: number;
  }) => {
    try {
      const finalPayload = {
        paymentType: paymentTypes.BANK_TRANSFER,
        currency: dataCount?.currency,
        amount: dataCount?.amount,
      };

      const res = await createEncryption(JSON.stringify(finalPayload));

      const {
        data: { data },
      }: { data: BankTransferApiRes } = await axiosBaseApi.post(
        "pay/addPayment",
        {
          data: res,
        }
      );

      setTransferDetails(data);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        error.message ??
        "Something went wrong";
      showToast({
          message,
          severity: "error",
        });
      console.error("initiateBankTransfer error:", error);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleSubmit = async () => {
    try {
      const {
        data: { data },
      } = await axiosBaseApi.post("pay/verifyPayment", {
        uniqueRef: transferDetails?.hash,
      });

      if (data?.success) {
        setIsSuccess(true);
        
        // Use redirectUrl prop if available, otherwise use generated URL
        if (redirectUrl) {
          try {
            const url = new URL(redirectUrl);
            url.searchParams.set('transaction_id', transferDetails?.hash || '');
            url.searchParams.set('status', 'success');
            setIsBank(url.toString());
          } catch (e) {
            // If URL parsing fails, use redirectUrl as-is
            setIsBank(redirectUrl);
          }
        } else {
          const redirectUri = generateRedirectUrl(data);
          setIsBank(redirectUri);
        }

        // window.location.replace(redirectUri)
      } else {
        setIsSuccess(false);
        // In case API call is 200 but payment failed
        showToast({
            message: t("checkout.paymentNotVerified"),
            severity: "error",
          });
      }
    } catch (e: any) {
      setIsSuccess(false);
      const message = e.response?.data?.message ?? e.message;
      showToast({
          message: message,
          severity: "error",
        });
    }
  };

  return (
    <>
      {loading ? (
        <Loading />
      ) : (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          px={2}
          // marginTop="50px"
        >
          <Paper
            elevation={3}
            sx={{
              borderRadius: 4,
              p: "34px",
              width: "100%",
              maxWidth: 450,
              marginTop: 10,
              margin: 0,
              border: "1px solid #E9ECF2",
              boxShadow: "0px 45px 64px 0px #0D03230F",
            }}
          >
            {/* Back Button */}
            <IconButton
              onClick={() => setActiveStep(activeStep - 1)}
              sx={{
                backgroundColor: "#F5F8FF",
                color: "#5865F2",
                borderRadius: "50%",
                padding: "10px",
                "&:hover": {
                  backgroundColor: "#ebefff",
                },
              }}
            >
              <ArrowBack sx={{ color: "#5865F2" }} />
            </IconButton>

            {/* Title */}
            <Typography
              variant="h6"
              fontWeight="medium"
              mt={2}
              display="flex"
              alignItems="center"
              gap={1}
              fontFamily="var(--font-sans)"
              fontSize={"27px"}
            >
              <Icon
                icon="mingcute:bank-line"
                width="26"
                height="29"
                style={{ color: "#5865F2" }}
              />
              {t("checkout.ngnBankTransfer")}
            </Typography>

            {/* Bank Details */}
            <Box mt={3}>
              <Typography
                variant="subtitle2"
                fontWeight="300"
                fontFamily="var(--font-sans)"
                color={theme.palette.text.secondary}
              >
                {t("checkout.bankName")}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {transferDetails?.transfer_bank ? (
                  <Typography
                    color={isDark ? '#5865F2' : "#2D3282"}
                    fontWeight="bold"
                    display="flex"
                    alignItems="center"
                    gap={1}
                    fontFamily="var(--font-sans)"
                    fontSize={"18px"}
                  >
                    {transferDetails.transfer_bank}
                    <Icon icon="mingcute:bank-line" width="26" />
                  </Typography>
                ) : (
                  <Skeleton
                    variant="rectangular"
                    width={154}
                    height={24}
                    animation="wave"
                    sx={{ borderRadius: "6px", background: isDark ? 'rgba(108, 123, 255, 0.1)' : "#F5F8FF" }}
                  />
                )}
              </Box>

              <Typography
                variant="subtitle2"
                mt={2}
                fontWeight="300"
                fontFamily="var(--font-sans)"
                color={theme.palette.text.secondary}
              >
                {t("checkout.accountNumber")}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mb={"4px"}>
                {transferDetails?.transfer_account ? (
                  <Typography
                    color={isDark ? '#5865F2' : "#2D3282"}
                    fontWeight="600"
                    fontFamily="var(--font-sans)"
                  >
                    {transferDetails?.transfer_account}
                  </Typography>
                ) : (
                  <Skeleton
                    variant="rectangular"
                    width={107}
                    height={24}
                    animation="wave"
                    sx={{ borderRadius: "6px", background: isDark ? 'rgba(108, 123, 255, 0.1)' : "#F5F8FF" }}
                  />
                )}
                <Tooltip title={t("checkout.copy")}>
                  <IconButton
                    onClick={handleCopy}
                    size="small"
                    sx={{
                      fontSize: "12px",
                      color: isDark ? '#5865F2' : "#5865F2",
                      bgcolor: isDark ? 'rgba(108, 123, 255, 0.2)' : "#E9ECF2",
                      borderRadius: "6px",
                      gap: "4px",
                    }}
                  >
                    <CopyIcon />
                    {t("checkout.copy")}
                  </IconButton>
                </Tooltip>
              </Box>
              <Box display="flex" alignItems="center" gap={0.5} mt={"8px"}>
                <Warning />
                <Typography
                  variant="caption"
                  color={theme.palette.text.secondary}
                  fontFamily="var(--font-sans)"
                >
                  {t("checkout.accountUnique")}
                </Typography>
              </Box>

              <Typography
                variant="subtitle2"
                mt={"16px"}
                fontWeight="300"
                fontFamily="var(--font-sans)"
                color={theme.palette.text.secondary}
              >
                {t("checkout.recipient")}
              </Typography>
              <Typography
                fontWeight="600"
                color={isDark ? '#5865F2' : "#2D3282"}
                fontSize={"18px"}
                fontFamily="var(--font-sans)"
              >
                Dynopay Payments Ltd.
              </Typography>
            </Box>

            {/* Alert Box */}
            <Box
              mt="16px"
              borderRadius="8px"
              display="flex"
              alignItems="center"
              bgcolor={"#F5F8FF"}
              gap={1}
              px="9px"
              py="8px"
            >
              <div className="w-[16px] h-[16px]">
                <Icon
                  icon="si:alert-line"
                  width="16"
                  height="16"
                  style={{ color: " #FF3B30" }}
                />
              </div>
              <Typography
                fontSize={14}
                color={"#515151"}
                fontWeight={500}
                fontFamily="var(--font-sans)"
                lineHeight="100%"
              >
                {t("checkout.secureTransfer")}
              </Typography>
            </Box>

            {/* Payment Card */}
            <Card
              sx={{
                mt: "20px",
                borderRadius: "10px",
                border: "1px solid #DFDFDF",
                boxShadow: "none",
              }}
            >
              <CardContent style={{ padding: "18px 21px" }}>
                <Box display={"flex"} justifyContent={"space-between"}>
                  <Typography
                    variant="body2"
                    fontSize={"20px"}
                    fontWeight="500"
                    fontFamily="var(--font-sans)"
                  >
                    {t("checkout.toPay")}
                  </Typography>
                  <Box textAlign={"end"}>
                    {transferDetails?.transfer_amount ? (
                      <>
                        <Typography
                          variant="h6"
                          fontWeight="500"
                          color="primary"
                          fontFamily="var(--font-sans)"
                          fontSize={25}
                          lineHeight={"130%"}
                        >
                          {
                            currencyOptions?.find(
                              (item) =>
                                item?.currency === selectedCurrency?.currency
                            )?.icon
                          }{" "}
                          {transferDetails?.transfer_amount}{" "}
                          {selectedCurrency?.currency}
                        </Typography>
                      </>
                    ) : (
                      <Skeleton
                        variant="rectangular"
                        width={150}
                        height={32}
                        animation="wave"
                        sx={{ borderRadius: "6px", background: isDark ? 'rgba(108, 123, 255, 0.1)' : "#F5F8FF" }}
                      />
                    )}

                    <Typography
                      variant="caption"
                      color={theme.palette.text.secondary}
                      fontFamily="var(--font-sans)"
                      fontSize={14}
                    >
                      =
                      {formatWithSeparators(Number(
                        walletState?.amount ?? walletState?.amount
                      ), walletState?.currency)}{" "}
                      {walletState?.currency}
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: "10px", borderColor: isDark ? theme.palette.divider : undefined }} />
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={1}
                >
                  <ClockIcon />
                  <Typography
                    variant="body2"
                    fontWeight="normal"
                    fontSize="13px"
                    fontFamily="var(--font-sans)"
                    color={theme.palette.text.primary}
                  >
                    {t("checkout.invoiceExpiresIn")} {formatTime(timeLeft)}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  onClick={() => {
                    handleSubmit();
                    setActiveStep(activeStep + 1);
                  }}
                  fullWidth
                  sx={{
                    mt: 1,
                    borderRadius: "99999px",
                    bgcolor: "#5865F2",
                    fontWeight: 500,
                    py: "17px",
                    textTransform: "none",
                    boxShadow: "none",
                    "&:hover": {
                      bgcolor: "#5865F2",
                      boxShadow: "none",
                    },
                  }}
                >
                  {t("checkout.madePayment")}
                </Button>
              </CardContent>
            </Card>
          </Paper>
        </Box>
      )}
    </>
  );
};

export default BankTransferCompo;

