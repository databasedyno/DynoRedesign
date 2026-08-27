import { showToast } from "@/helpers/toastStore";
import LoadingIcon from "@/assets/Icons/LoadingIcon";
import adminBaseApi from "@/axiosAdmin";
import CustomAlert from "@/Components/UI/CustomAlert";
import Panel from "@/Components/UI/Panel";
import { pageProps } from "@/utils/types";
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";


interface transferSpeed {
  transfer_speed_id: number;
  wallet_type: string;
  speed: string;
}

const TransferSpeed = ({ setPageName }: pageProps) => {
  const [feesData, setFeesData] = useState<transferSpeed[]>([]);
  const [defaultData, setDefaultData] = useState<transferSpeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [changed, setChanged] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPageName("Crypto Transfer Speed");
    getTransferFees();
  }, []);

  const getTransferFees = async () => {
    try {
      const {
        data: { data },
      } = await adminBaseApi.get("/admin/getTransferFees");

      setFeesData(structuredClone([...data]));
      setDefaultData(structuredClone([...data]));
      setLoading(false);
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      showToast({
          message: message,
          severity: "error",
        });
    }
  };

  const handleSubmit = async () => {
    try {
      const {
        data: { data, message },
      } = await adminBaseApi.put("/admin/updateTransferFees", { feesData });
      showToast({
          message: message,
        });

      setOpen(false);
      setChanged(false);
      setDefaultData(structuredClone([...feesData]));
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      showToast({
          message: message,
          severity: "error",
        });
    }
  };

  return (
    <>
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
          <CustomAlert
            open={open}
            handleClose={() => {
              setOpen(false);
              setChanged(false);
              setFeesData(structuredClone([...defaultData]));
            }}
            message={"you want to change transfer speed?"}
            onConfirm={handleSubmit}
          />
          <Panel radius={30} sx={{ maxWidth: "450px" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography fontWeight={700}>
                Temporary to master wallet
              </Typography>
              {changed && (
                <Button variant="rounded" onClick={() => setOpen(true)}>
                  Update
                </Button>
              )}
            </Box>

            <Box sx={{ maxWidth: "450px", mt: 5 }}>
              {feesData.map((x, i) => {
                return (
                  <>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography>{x.wallet_type}</Typography>
                      <RadioGroup
                        value={x.speed}
                        onChange={(e) => {
                          const tempData = [...feesData];
                          const index = feesData.findIndex(
                            (z) => z.transfer_speed_id === x.transfer_speed_id
                          );
                          tempData[index].speed = e.target.value;
                          setFeesData(tempData);
                          setChanged(true);
                        }}
                        row
                      >
                        <FormControlLabel
                          value="FAST"
                          control={<Radio color="secondary" />}
                          label={`Fast`}
                        />

                        <FormControlLabel
                          value="MEDIUM"
                          control={<Radio color="secondary" />}
                          label={`Medium`}
                        />

                        <FormControlLabel
                          value="SLOW"
                          control={<Radio color="secondary" />}
                          label={`Slow`}
                        />
                      </RadioGroup>
                    </Box>
                    {i !== feesData.length - 1 && <Divider sx={{ my: 2 }} />}
                  </>
                );
              })}
            </Box>
          </Panel>
        </>
      )}
    </>
  );
};

export default TransferSpeed;
