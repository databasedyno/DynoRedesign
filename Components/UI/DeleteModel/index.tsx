import React from "react";
import PopupModal from "../PopupModal";
import { Box, IconButton, Typography } from "@mui/material";
import Image from "next/image";
import TrashIcon from "@/assets/Icons/trash-icon.svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mui/material/styles";
import PanelCard from "../PanelCard";
import CustomButton from "../Buttons";
import { DeleteModelContainer, DeleteModelTitle } from "./styled";
import useIsMobile from "@/hooks/useIsMobile";

const DeleteModel = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}) => {
  const { t } = useTranslation("apiScreen");
  const isMobile = useIsMobile("sm");
  const theme = useTheme();
  const headerPadding = isMobile
    ? theme.spacing(1.875, 1.875, 0, 1.875)
    : theme.spacing(3.75, 3.75, 0, 3.75);
  const bodyPadding = isMobile
    ? theme.spacing(1.5, 1.875, 1.875, 1.875)
    : theme.spacing(3, 3.75, 3.75, 3.75);
  return (
    <PopupModal
      open={open}
      handleClose={onClose}
      onConfirm={onConfirm}
      showHeader={false}
      transparent={true}
      sx={{
        "& .MuiDialog-paper": {
          width: "100%",
          maxWidth: "531px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          p: 2,
        },
      }}
    >
      <PanelCard
        title={title}
        showHeaderBorder={false}
        headerPadding={headerPadding}
        bodyPadding={bodyPadding}
        sx={{
          width: "100%",
          borderRadius: "14px",
          mx: "auto",
          maxWidth: isMobile ? "313px" : "531px",
        }}
        headerIcon={
          <IconButton>
            <Image
              src={TrashIcon.src}
              alt="trash icon"
              width={16}
              height={16}
              style={{
                filter: `brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(100%)`,
              }}
              draggable={false}
            />
          </IconButton>
        }
      >
        <DeleteModelContainer>
          <DeleteModelTitle>{message}</DeleteModelTitle>

          <Box sx={{ display: "flex", gap: 1 }}>
            <CustomButton
              variant="outlined"
              size="medium"
              label={t("actions.cancel")}
              onClick={onClose}
              sx={{
                flex: 1,
                [theme.breakpoints.down("sm")]: {
                  fontSize: "13px",
                  height: "32px",
                },
              }}
            />
            <CustomButton
              variant="danger"
              size="medium"
              label={t("delete.confirmButton")}
              onClick={onConfirm}
              sx={{
                flex: 1,
                [theme.breakpoints.down("sm")]: {
                  fontSize: "13px",
                  height: "32px",
                },

              }}
            />
          </Box>
        </DeleteModelContainer>
      </PanelCard>
    </PopupModal>
  );
};

export default DeleteModel;
