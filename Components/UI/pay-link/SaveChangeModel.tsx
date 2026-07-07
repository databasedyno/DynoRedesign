import InfoIcon from "@/assets/Icons/info-icon.svg";
import useIsMobile from "@/hooks/useIsMobile";
import { SaveChangeModelProps } from "@/utils/types/create-pay-link";
import {Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Typography, useTheme} from "@mui/material";
import Image from "next/image";

const SaveChangeModel = ({ open, onClose, onSave }: SaveChangeModelProps) => {
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  return (
    <Dialog
      open={open}
      PaperProps={{
        sx: { borderRadius: "12px", maxWidth: "576px" },
      }}
    >
      <DialogContent
        sx={{
          padding: isMobile ? "16px 16px 12px 16px" : "30px 30px 24px 30px",
        }}
      >
        <Box sx={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Image
            src={InfoIcon}
            alt="info icon"
            width={isMobile ? 14 : 16}
            height={isMobile ? 14 : 16}
            draggable={false}
            className="themed-icon"
          />
          <Typography
            sx={{
              fontFamily: "UrbanistMedium",
              fontWeight: 500,
              fontSize: "20px",
              lineHeight: 1.2,
              letterSpacing: 0,
              color: theme.palette.text.primary,
            }}
          >
            Save Changes?
          </Typography>
        </Box>

        <Typography
          sx={{
            fontFamily: "UrbanistMedium",
            fontWeight: 500,
            fontSize: isMobile ? "13px" : "15px",
            lineHeight: "140%",
            mt: isMobile ? "12px" : "24px",
            color: theme.palette.text.secondary,
          }}
        >
          This payment link is active and may have been shared with customers.
          Changes will apply immediately.
        </Typography>
      </DialogContent>

      <DialogActions
        sx={{
          padding: isMobile ? "0 16px 16px 16px" : "0 30px 30px 30px",
          display: "flex",
          gap: "20px",
        }}
      >
        <Button
          onClick={onClose}
          fullWidth
          sx={{
            height: isMobile ? "32px" : "40px",
            fontFamily: "UrbanistMedium",
            fontWeight: 500,
            fontSize: isMobile ? "13px" : "15px",
            color: theme.palette.text.secondary,
            border: `1px solid ${theme.palette.border.main}`,
            py: "11px",
            borderRadius: "6px",
          }}
        >
          Cancel
        </Button>

        <Button
          onClick={() => {
            onSave();
            onClose();
          }}
          fullWidth
          sx={{
            height: isMobile ? "32px" : "40px",
            fontFamily: "UrbanistMedium",
            fontWeight: 500,
            fontSize: isMobile ? "13px" : "15px",
            color: theme.palette.primary.contrastText,
            backgroundColor: theme.palette.primary.main,
            py: "11px",
            borderRadius: "6px",
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          Save Change
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveChangeModel;
