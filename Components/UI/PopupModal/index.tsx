import React from "react";
import {
  DialogTitle,
  DialogContent,
  Slide,
  DialogActions,
  Button,
  Typography,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { ModalContainer } from "./styled";
import { TransitionProps } from "@mui/material/transitions";
import { DialogProps } from "@mui/material/Dialog";
import { CancelRounded } from "@mui/icons-material";

type PopupModalProps = DialogProps & {
  handleClose: Function;
  showHeader?: boolean;
  headerText?: string | JSX.Element;
  hasFooter?: boolean;
  confirmText?: string;
  onConfirm?: Function;
  showClose?: boolean;
  hideCancel?: boolean;
  cancelText?: string;
  transparent?: boolean;
  extraFooterComponent?: JSX.Element;
  disableConfirm?: boolean;
};

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const PopupModal = ({
  handleClose,
  showHeader = true,
  headerText = "Modal",
  children,
  hasFooter,
  confirmText,
  showClose,
  hideCancel,
  cancelText,
  onConfirm,
  transparent,
  disableConfirm = false,
  extraFooterComponent,
  ...rest
}: PopupModalProps) => {
  const customOnClose = rest.onClose;

  return (
    <ModalContainer
      {...rest}
      customProps={{ transparent }}
      TransitionComponent={Transition}
      keepMounted
      onClose={
        customOnClose
          ? customOnClose
          : (event, reason) => {
              if (reason === "backdropClick" || reason === "escapeKeyDown") {
                handleClose();
              }
            }
      }
      aria-describedby="alert-dialog-slide-description"
    >
      {showHeader && (
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
          component="div"
        >
          <>
            <Typography component="div" sx={{ fontSize: "30px", fontWeight: 600 }}>
              {headerText}
            </Typography>
            {showClose && (
              <IconButton onClick={() => handleClose()}>
                <CancelRounded color="secondary" />
              </IconButton>
            )}
          </>
        </DialogTitle>
      )}
      <DialogContent>{children}</DialogContent>
      {hasFooter && (
        <DialogActions>
          {!hideCancel && (
            <Button
              variant="outlined"
              sx={{ px: 3, py: 1.5, borderRadius: "20px" }}
              onClick={() => handleClose()}
            >
              {cancelText ?? "Cancel"}
            </Button>
          )}
          {extraFooterComponent && extraFooterComponent}
          <Button
            variant="contained"
            sx={{ px: 3, py: 1.5, borderRadius: "20px" }}
            color="secondary"
            onClick={() => onConfirm && onConfirm()}
            autoFocus
            disabled={disableConfirm}
          >
            {confirmText ?? "Done"}
          </Button>
        </DialogActions>
      )}
    </ModalContainer>
  );
};

export default PopupModal;
