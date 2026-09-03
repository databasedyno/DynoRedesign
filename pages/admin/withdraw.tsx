import LoadingIcon from "@/assets/Icons/LoadingIcon";
import adminBaseApi from "@/axiosAdmin";
import FormManager from "@/Components/Page/Common/FormManager";
import Dropdown from "@/Components/UI/Dropdown";
import TextBox from "@/Components/UI/TextBox";
import { countDecimals, getCurrencySymbol } from "@/helpers";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { IWallet, menuItem, pageProps } from "@/utils/types";
import { Box, Button, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import * as yup from "yup";
import { toFixedStr } from "@/utils/money";

const walletInitial = {
  currency: "ETH",
  amount: 0,
  address: "",
};

const wallets = [
  { label: "ETH", value: "ETH" },
  { label: "BTC", value: "BTC" },
  { label: "TRON", value: "TRON" },
  { label: "USDT", value: "USDT" },
  { label: "USDT_TRON", value: "USDT_TRON" },
  { label: "BSC", value: "BSC" },
  { label: "BCH", value: "BCH" },
  { label: "DOGE", value: "DOGE" },
  { label: "LTC", value: "LTC" },
];

const AdminWithdraw = ({ setPageName }: pageProps) => {
  const dispatch = useDispatch();
  const [cryptoData, setCryptoData] = useState<IWallet[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transaction, setTransaction] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [loading2, setLoading2] = useState(false);
  useEffect(() => {
    setPageName("Withdraw");
    getWallets();
  }, []);

  const schema = yup.object().shape({
    amount: yup.number().required("amount is required!").min(0.0005),
    address: yup.string().required("address is required!"),
  });

  const handleSubmit = async (values: any) => {
    console.log(values);
    setLoading2(true);
    setCurrentIndex(0);
    try {
      const {
        data: { data },
      } = await adminBaseApi.post("/admin/withdrawAssets", values);
      setTransaction(data);
      setLoading2(false);
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

  const getWallets = async () => {
    try {
      const {
        data: { data },
      } = await adminBaseApi.get("/admin/getWallets");

      setCryptoData(data.cryptoWallets);
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

  return (
    <Box>
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
        <Box sx={{ maxWidth: "400px" }}>
          <FormManager
            initialValues={walletInitial}
            yupSchema={schema}
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
                    display: "flex",
                    justifyContent: "center",
                    flexDirection: "column",
                    width: "100%",
                  }}
                >
                  <Dropdown
                    fullWidth={true}
                    label={"Currency"}
                    menuItems={wallets}
                    value={values.currency}
                    error={touched.currency && errors.currency}
                    helperText={
                      touched.currency && errors.currency && errors.currency
                    }
                    getValue={(value: any) => {
                      const e: any = {
                        target: {
                          name: "currency",
                          value,
                        },
                      };
                      const index = cryptoData.findIndex(
                        (x) => x.wallet_type === value
                      );
                      setCurrentIndex(index);
                      handleChange(e);
                    }}
                    onBlur={handleBlur}
                  />
                  <Typography>
                    Balance :{" "}
                    {getCurrencySymbol(
                      values.currency,
                      countDecimals(cryptoData[currentIndex].fee) > 8
                        ? toFixedStr(cryptoData[currentIndex].fee, 8)
                        : toFixedStr(cryptoData[currentIndex].fee, 2)
                    )}
                  </Typography>
                </Box>
                <Box sx={{ mt: 3 }}>
                  <TextBox
                    name="amount"
                    fullWidth
                    label={"Amount"}
                    placeholder="Enter amount"
                    value={values.amount}
                    error={touched.amount && errors.amount}
                    helperText={
                      touched.amount && errors.amount && errors.amount
                    }
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                </Box>
                <Box sx={{ mt: 3 }}>
                  <TextBox
                    name="address"
                    fullWidth
                    label={"Address"}
                    placeholder="Enter address"
                    value={values.address}
                    error={touched.address && errors.address}
                    helperText={
                      touched.address && errors.address && errors.address
                    }
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                </Box>

                <Box
                  sx={{
                    mt: 3,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    variant="rounded"
                    type="submit"
                    disabled={submitDisable ? submitDisable : loading2}
                    sx={{ py: 1.5 }}
                  >
                    Withdraw
                  </Button>
                </Box>
              </>
            )}
          </FormManager>
          {loading2 && <LoadingIcon size={25} />}
          {transaction && (
            <Typography mt={5}>
              {"Transaction ID: " + transaction?.txId}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default AdminWithdraw;
