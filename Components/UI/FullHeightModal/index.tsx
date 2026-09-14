import React from "react";
import {
  DialogTitle,
  DialogContent,
  Slide,
  DialogActions,
  Button,
  Typography,
  IconButton,
} from "@mui/material";
import { ModalContainer } from "./styled";
import { TransitionProps } from "@mui/material/transitions";
import { DialogProps } from "@mui/material/Dialog";
import { CancelRounded } from "@mui/icons-material";

type FullHeightModalProps = DialogProps & {
  handleClose: Function;
  showHeader?: boolean;
  headerText?: string | JSX.Element;
  hasFooter?: boolean;
  confirmText?: string;
  onConfirm?: Function;
  showClose?: boolean;
  hideCancel?: boolean;
};

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const FullHeightModal = ({
  handleClose,
  children,
  ...rest
}: FullHeightModalProps) => {
  return (
    <ModalContainer
      {...rest}
      TransitionComponent={Transition}
      keepMounted
      onClose={() => handleClose()}
      aria-describedby="alert-dialog-slide-description"
    >
      <DialogContent sx={{ p: 0 }}>{children}</DialogContent>
    </ModalContainer>
  );
};

export default FullHeightModal;
