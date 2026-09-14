import { styled, Box, Dialog } from "@mui/material";
interface customProps {
  transparent?: boolean;
}
export const ModalContainer = styled(Dialog, {
  shouldForwardProp: (prop) => prop !== "customProps",
})<{ customProps: customProps }>(({ theme, customProps }) => ({
  "& .MuiBackdrop-root": {
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  "& .MuiDialogContent-root": {
    paddingBottom: 0,
    ...(customProps.transparent && { padding: 0 }),
  },

  "& .MuiDialog-paper": {
    position: "fixed",
    borderRadius: "30px",
    padding: `${theme.spacing(2)}`,
    margin: 0,
    maxWidth: "80vw",
    background: customProps?.transparent ? "transparent" : theme.palette.background.paper,
    top: "50%",
    transform: "translateY(-50%)",
    maxHeight: "95%",
    width: "fit-content",
    ...(customProps.transparent && { boxShadow: "none" }),
    transition: "0.1s",
  },
  [theme.breakpoints.down("md")]: {
    "& .MuiDialog-paper": {
      padding: `${theme.spacing(2)} ${theme.spacing(0)}`,
      top: "100%",
      transform: "translateY(-100%)",
      maxWidth: "100vw",

      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
  },
}));
