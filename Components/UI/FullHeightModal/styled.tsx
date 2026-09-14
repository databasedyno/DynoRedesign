import { styled, Box, Dialog } from "@mui/material";

export const ModalContainer = styled(Dialog)(({ theme }) => ({
  "& .MuiDialogContent-root": {
    paddingBottom: 0,
  },

  "& .MuiDialog-paper": {
    position: "fixed",
    borderRadius: "30px",
    margin: 0,
    maxWidth: "100vw",
    background: theme.palette.background.paper,
    top: "50%",
    transform: "translateY(-50%)",
    maxHeight: "100%",
    width: "fit-content",
    transition: "0.1s",
  },
  [theme.breakpoints.down("md")]: {
    "& .MuiDialog-paper": {
      paddingBottom: theme.spacing(2),
      top: "100%",
      transform: "translateY(-100%)",
      maxWidth: "100vw",
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
  },
}));
