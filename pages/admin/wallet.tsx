import LoadingIcon from "@/assets/Icons/LoadingIcon";
import adminBaseApi from "@/axiosAdmin";
import FormManager from "@/Components/Page/Common/FormManager";
import PopupModal from "@/Components/UI/PopupModal";
import { countDecimals, getCurrencySymbol } from "@/helpers";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { IWallet, pageProps } from "@/utils/types";
import { Box, Button, Divider, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { toFixedStr } from "@/utils/money";

const AdminWallet = ({ setPageName }: pageProps) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);

  const [loading2, setLoading2] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [fiatData, setFiatData] = useState<IWallet[]>([]);
  const [cryptoData, setCryptoData] = useState<IWallet[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    getWallets();
    setPageName("Wallet");
  }, []);

  const getWallets = async () => {
    try {
      const {
        data: { data },
      } = await adminBaseApi.get("/admin/getWallets");

      setFiatData(data.fiatWallets);
      setCryptoData(data.cryptoWallets);

      let total = 0;
      for (let i = 0; i < data.fiatWallets.length; i++) {
        const currentWallet = data.fiatWallets[i];
        total += Number(currentWallet.amount_in_usd);
      }
      for (let i = 0; i < data.cryptoWallets.length; i++) {
        const currentWallet = data.cryptoWallets[i];
        total += Number(currentWallet.amount_in_usd);
      }
      setTotalBalance(total);
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

  const createWallets = async () => {
    try {
      setLoading2(true);
      const {
        data: { data },
      } = await adminBaseApi.post("/admin/createWallets");
      setLoading2(false);
      setGenerated(true);
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      setLoading2(false);
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
              Total Wallet Balance:{" "}
            </Typography>
            <Typography
              sx={{ fontSize: 18, fontWeight: 900, color: "text.secondary" }}
            >
              $ {toFixedStr(totalBalance, 2)}
            </Typography>
          </Box>
          {fiatData.length === 0 && cryptoData.length === 0 ? (
            <Box
              sx={{
                width: "100%",
                height: "50vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
              }}
            >
              <Typography>No wallets found!</Typography>
              <Button
                sx={{ my: 2 }}
                variant="rounded"
                onClick={() => (generated ? router.reload() : createWallets())}
                disabled={loading2}
              >
                {loading2
                  ? "Generating Wallets"
                  : generated
                  ? "Reload page"
                  : "Generate Wallets"}
              </Button>
              {loading2 && <LoadingIcon size={50} />}
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  mt: 2,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>Fiat Wallets</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Button
                    variant="rounded"
                    color="secondary"
                    onClick={() => router.push("/admin/withdraw")}
                  >
                    Withdraw
                  </Button>
                  {/* <Button
            variant="rounded"
            color="primary"
            onClick={() => {
              setOpen(true);
            }}
          >
            Add Funds
          </Button> */}
                </Box>
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
                {fiatData.map((x) => (
                  <Box
                    key={x.id}
                    sx={{
                      border: "1px solid",
                      width: "250px",
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
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography
                          sx={{
                            fontSize: 12,
                            mt: 2,
                            color: theme.palette.secondary.main,
                            fontWeight: 700,
                          }}
                        >
                          ( Fee )
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 18,
                            fontWeight: 900,
                            textAlign: "right",
                            color: theme.palette.success.main,
                          }}
                        >
                          {getCurrencySymbol(
                            x.wallet_type,
                            countDecimals(x.fee) > 8
                              ? toFixedStr(x.fee, 8)
                              : toFixedStr(x.fee, 2)
                          )}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontWeight: 700,
                            textAlign: "left",
                            color: theme.palette.error.main,
                          }}
                        >
                          ({getCurrencySymbol("USD", x.fee_in_usd)})
                        </Typography>
                      </Box>
                      <Box>
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
                              ? toFixedStr(x.amount, 8)
                              : toFixedStr(x.amount, 2)
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
                  </Box>
                ))}
              </Box>
              <Typography sx={{ fontWeight: 700, mt: 5 }}>
                Crypto Wallets
              </Typography>
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
                      width: { md: "40vw", xs: "90vw" },
                      height: "100%",
                      borderRadius: "10px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      p: 3,
                      overflow: "scroll",
                    }}
                  >
                    <Typography sx={{ fontSize: "24px", fontWeight: 700 }}>
                      {x.wallet_type}
                    </Typography>
                    <Typography>{x.wallet_address}</Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography
                          sx={{
                            fontSize: 12,
                            mt: 2,
                            color: theme.palette.secondary.main,
                            fontWeight: 700,
                          }}
                        >
                          ( Fee )
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 18,
                            fontWeight: 900,
                            textAlign: "right",
                            color: theme.palette.success.main,
                          }}
                        >
                          {getCurrencySymbol(
                            x.wallet_type,
                            countDecimals(x.fee) > 8
                              ? toFixedStr(x.fee, 8)
                              : toFixedStr(x.fee, 2)
                          )}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontWeight: 700,
                            textAlign: "left",
                            color: theme.palette.error.main,
                          }}
                        >
                          ({getCurrencySymbol("USD", x.fee_in_usd)})
                        </Typography>
                      </Box>
                      <Box>
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
                              ? toFixedStr(x.amount, 8)
                              : toFixedStr(x.amount, 2)
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
                  </Box>
                ))}
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default AdminWallet;
