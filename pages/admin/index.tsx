import { showToast } from "@/helpers/toastStore";
import adminBaseApi from "@/axiosAdmin";
import PopupModal from "@/Components/UI/PopupModal";
import TextBox from "@/Components/UI/TextBox";
import { pageProps } from "@/utils/types";
import { Box, Button, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";


const AdminHome = ({ setPageName }: pageProps) => {

  const [transactionFee, setTransactionFee] = useState(0);
  const [blockchainFee, setblockchainFee] = useState(0);
  const [fee, setFee] = useState(0);
  const [blockchainFeeInput, setBlockchainFeeInput] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPageName("Dashboard");
    getTransactionFee();
  }, []);

  const getTransactionFee = async () => {
    try {
      const {
        data: { data },
      } = await adminBaseApi.get("/admin/getTransactionFee");
      setTransactionFee(data?.transaction_fee);
      setblockchainFee(data?.blockchain_fee);
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      showToast({
          message: message,
          severity: "error",
        });
    }
  };

  const newTransactionFee = async () => {
    try {
      const {
        data: { data },
      } = await adminBaseApi.post("/admin/newTransactionFee", { 
        fee, blockchainFeeInput,
      });
      setTransactionFee(data.transaction_fee);
      setblockchainFee(blockchainFeeInput);
      setOpen(false);
      setFee(0);
      setBlockchainFeeInput(0);
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      showToast({
          message: message,
          severity: "error",
        });
    }
  };
  return (
    <Box>
      <PopupModal
        open={open}
        handleClose={() => {
          setOpen(false);
          setFee(0);
          setBlockchainFeeInput(0);
        }}
        headerText={"Transaction Fee & Blockchain Fee"}
        showClose
        confirmText="Change"
        hasFooter
        onConfirm={newTransactionFee}
      >
        <Box sx={{ minWidth: "350px" }}>
          <TextBox
            value={fee}
            onChange={(e: any) => setFee(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            label={"change fee"}
            autoFocus
          />
          <TextBox
            value={blockchainFeeInput}
            onChange={(e: any) => setBlockchainFeeInput(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            label={"blockchain fee"}
            autoFocus
          />
        </Box>
      </PopupModal>
      <Box sx={{ mt: 3 }}>
        <Box sx={{display: 'flex', gap: 6}}>
          <Typography sx={{ fontSize: 24, fontWeight: 700 }}>
            Transaction Fee : {transactionFee}%
          </Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 700 }}>
          Blockchain Fee  : {blockchainFee}%
          </Typography>
        </Box>
        <Button
          variant="rounded"
          sx={{ mt: 1 }}
          onClick={() => {
            setFee(transactionFee);
            setBlockchainFeeInput(blockchainFee);
            setOpen(true);
          }}
        >
          Change
        </Button>
      </Box>
    </Box>
  );
};

export default AdminHome;
