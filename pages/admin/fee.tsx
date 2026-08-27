import LoadingIcon from "@/assets/Icons/LoadingIcon";
import adminBaseApi from "@/axiosAdmin";
import FormManager from "@/Components/Page/Common/FormManager";
import CustomTooltip from "@/Components/UI/CustomTooltip";
import DataTable from "@/Components/UI/DataTable";
import Panel from "@/Components/UI/Panel";
import PopupModal from "@/Components/UI/PopupModal";
import TextBox from "@/Components/UI/TextBox";
import { countDecimals, getCurrencySymbol, stringShorten } from "@/helpers";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { IWallet, pageProps } from "@/utils/types";
import { formatDateTimeI18n } from "@/utils/formatDate";
import { CopyAllRounded, Search } from "@mui/icons-material";
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Typography,
  useTheme,
} from "@mui/material";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import * as yup from "yup";
import copyToClipboard from "@/helpers/copyToClipboard";

const columns = [
  "#",
  "Wallet address",
  "Amount",
  "Currency",
  "Tx-id",
  "Type",
  "Status",
  "Date",
];

const AdminFee = ({ setPageName }: pageProps) => {
  const dispatch = useDispatch();

  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [feeTransaction, setFeeTransactions] = useState<any[]>([]);
  const [initialValues, setInitialValues] = useState({
    feeLimit: 0,
    alert_duration: 0,
  });
  const [feeLimits, setFeeLimits] = useState({
    feeLimit: 0,
    alert_duration: 0,
  });
  const [searchValue, setSearchValue] = useState("");
  const [cryptoData, setCryptoData] = useState<IWallet[]>([]);
  const [open, setOpen] = useState(false);

  const fundSchema = yup.object().shape({
    feeLimit: yup
      .number()
      .required("amount is required!")
      .min(20, "Minimum is 20$")
      .typeError("Please enter number"),
    alert_duration: yup
      .number()
      .required("amount is required!")
      .min(1, "Minimum is 1 Hour")
      .typeError("Please enter number"),
  });

  useEffect(() => {
    getFeeWalletBalance();
    setPageName("Fee");
  }, []);

  const getFeeWalletBalance = async () => {
    try {
      const {
        data: { data },
      } = await adminBaseApi.get("/admin/getFeeWalletBalance");
      setCryptoData(data.cryptoWallets);
      setInitialValues({
        feeLimit: data.cryptoWallets[0].feeLimit,
        alert_duration: data.cryptoWallets[0].alert_duration,
      });
      setFeeLimits({
        feeLimit: data.cryptoWallets[0].feeLimit,
        alert_duration: data.cryptoWallets[0].alert_duration,
      });
      setFeeData(data?.transactions);
      setLoading(false);
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
  const setFeeData = (transactionData: any[]) => {
    const tempData1 = [];
    for (let i = 0; i < transactionData.length; i++) {
      const temp = transactionData[i];
      const tempObject = {
        no: i + 1,
        wallet_address: temp.wallet_address,
        amount: temp.amount + " ($ " + temp.amount_in_usd + ")",
        wallet_type: temp.wallet_type,
        transaction_id: !temp.transaction_id ? (
          <Box>No Transaction Ref</Box>
        ) : (
          <CustomTooltip title={temp.transaction_id}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography fontSize={14} fontWeight={700}>
                <a
                  href={
                    "https://blockchair.com/search?q=" + temp.transaction_id
                  }
                  target="_blank"
                >
                  {stringShorten(temp.transaction_id, 7, 5)}
                </a>
              </Typography>
              <IconButton
                onClick={() => {
                  copyToClipboard(
                    "https://blockchair.com/search?q=" + temp.transaction_id
                  );
                  dispatch({
                    type: TOAST_SHOW,
                    payload: {
                      message: "Copied!",
                      severity: "info",
                    },
                  });
                }}
              >
                <CopyAllRounded fontSize="small" color="secondary" />
              </IconButton>
            </Box>
          </CustomTooltip>
        ),
        hidden: temp.transaction_id,
        transaction_type: temp.transaction_type,
        status: temp.status,
        date: formatDateTimeI18n(temp.createdAt, {
          year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
        }),
      };
      tempData1.push(tempObject);
    }
    setFeeTransactions(tempData1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleSubmit = async (values: any) => {
    try {
      const {
        data: { data, message },
      } = await adminBaseApi.put("admin/updateFeeLimits", { ...values });
      setInitialValues({ ...values });
      setFeeLimits({ ...values });
      setOpen(false);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
        },
      });
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
    <Box sx={{ m: 2, mb: 5 }}>
      {loading ? (
        <>
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
          <PopupModal
            open={open}
            showClose
            handleClose={() => {
              setOpen(false);
              setInitialValues({ ...feeLimits });
            }}
            headerText={"Change Limits"}
          >
            <Box sx={{ minWidth: "450px" }}>
              <FormManager
                initialValues={initialValues}
                yupSchema={fundSchema}
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
                    <Box
                      sx={{
                        mb: 3,
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        justifyContent: "flex-start",
                        alignItems: "flex-end",
                      }}
                    >
                      <TextBox
                        name="feeLimit"
                        placeholder="Enter Limit"
                        label="Alert Limit"
                        value={values.feeLimit}
                        type="number"
                        fullWidth
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.feeLimit && errors.feeLimit}
                        helperText={
                          touched.feeLimit && errors.feeLimit && errors.feeLimit
                        }
                      />
                      <TextBox
                        name="alert_duration"
                        placeholder="Enter alert duration in hours"
                        label="Alert Duration (Hr)"
                        value={values.alert_duration}
                        type="number"
                        fullWidth
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.alert_duration && errors.alert_duration}
                        helperText={
                          touched.alert_duration &&
                          errors.alert_duration &&
                          errors.alert_duration
                        }
                      />

                      <Button
                        variant="rounded"
                        disabled={submitDisable}
                        type="submit"
                      >
                        Update
                      </Button>
                    </Box>
                  </>
                )}
              </FormManager>
            </Box>
          </PopupModal>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <Typography sx={{ fontWeight: 700, mt: 5 }}>
              Crypto Fee Wallets
            </Typography>
            <Button variant="rounded" onClick={() => setOpen(true)}>
              Change Limits
            </Button>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              flexWrap: "wrap",
            }}
          >
            {cryptoData.map((x) => (
              <Box
                key={x.id}
                sx={{
                  border: "1px solid",
                  width: "40vw",
                  height: "150px",
                  borderRadius: "10px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  p: 3,
                }}
              >
                <Typography sx={{ fontSize: "24px", fontWeight: 700 }}>
                  {x.wallet_type}
                </Typography>
                <Typography>{x.wallet_address}</Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 1,
                    mt: 2,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 30,
                      fontWeight: 900,
                      textAlign: "right",
                      color: "text.secondary",
                    }}
                  >
                    {getCurrencySymbol(
                      x.wallet_type,
                      countDecimals(x.amount) > 8
                        ? x.amount.toFixed(8)
                        : x.amount
                    )}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: "right",
                      color: theme.palette.error.main,
                    }}
                  >
                    ({getCurrencySymbol("USD", x.amount_in_usd)})
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
          <Box
            sx={{
              mt: 5,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <Typography sx={{ fontWeight: 700, mt: 5 }}>
              Fee Transactions
            </Typography>
            <TextBox
              customWidth="auto"
              placeholder="Search"
              value={searchValue}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Divider sx={{ my: 2 }} />

          <Panel radius={10}>
            <Box>
              <DataTable
                columns={columns}
                data={feeTransaction}
                searchValue={searchValue}
                loading={loading}
              />
            </Box>
          </Panel>
        </>
      )}
    </Box>
  );
};

export default AdminFee;
