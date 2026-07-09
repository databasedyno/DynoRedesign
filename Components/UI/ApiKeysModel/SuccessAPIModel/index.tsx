import React, { useCallback, useRef, useState } from "react";
import PopupModal from "../../PopupModal";
import { useTranslation } from "react-i18next";
import { Button, IconButton, Typography } from "@mui/material";
import { Box } from "@mui/material";
import FormManager from "@/Components/Page/Common/FormManager";
import { theme } from "@/styles/theme";
import InputField from "../../AuthLayout/InputFields";
import PanelCard from "../../PanelCard";
import Image from "next/image";
import WalletIcon from "@/assets/Icons/wallet-icon.svg";
import * as yup from "yup";
import InfoIcon from "@/assets/Icons/info-icon.svg";
import CopyIcon from "@/assets/Icons/copy-icon.svg";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  PermissionsContainer,
  IconContainer,
  ContentContainer,
  PermissionsTitle,
  PermissionsList,
} from "../CreateApiModel/styled";
import CustomButton from "../../Buttons";
import {
  SecurityNoticeContainer,
  SecurityNoticeDescription,
  SecurityNoticeSubtitle,
  SecurityNoticeTitle,
} from "./styled";
import useIsMobile from "@/hooks/useIsMobile";
import Toast from "../../Toast";

export interface SuccessAPIModelProps {
  open: boolean;
  handleClose: () => void;
}

const SuccessAPIModel: React.FC<SuccessAPIModelProps> = ({
  open,
  handleClose,
}) => {
  const { t } = useTranslation("apiScreen");
  const isMobile = useIsMobile("sm");
  const bodyPadding = isMobile
    ? theme.spacing(1.5, 1.875, 1.875, 1.875)
    : theme.spacing(1.5, 3.75, 3.75, 3.75);
  const headerPadding = isMobile
    ? theme.spacing(1.875, 1.875, 0, 1.875)
    : theme.spacing(3.75, 3.75, 0, 3.75);

  const tCommon = useCallback((key: string) => t(key, { ns: "common" }), [t]);

  const [openToast, setOpenToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = (str: string) => {
    navigator.clipboard.writeText(str);
    setOpenToast(false);

    setTimeout(() => {
      setOpenToast(true);
    }, 0);

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    toastTimer.current = setTimeout(() => {
      setOpenToast(false);
    }, 2000);
  }

  return (
    <>
      <PopupModal
        open={open}
        showHeader={false}
        transparent
        handleClose={handleClose}
        sx={{
          "& .MuiDialog-paper": {
            width: "100%",
            maxWidth: "443px",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            p: 2,
          },
        }}
      >
        <PanelCard
          title={t("generate.successTitle")}
          showHeaderBorder={false}
          headerIcon={
            <IconButton
              sx={{
                backgroundColor: theme.palette.success.main,
                borderRadius: "50%",
                padding: "6px",
                "&:hover": {
                  backgroundColor: theme.palette.success.main,
                },
                border: `1px solid ${theme.palette.success.light}`,
              }}
            >
              <CheckCircleIcon
                sx={{ color: theme.palette.success.dark, fontSize: 18 }}
              />
            </IconButton>
          }
          bodyPadding={bodyPadding}
          headerPadding={headerPadding}
          headerActionLayout="inline"
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            <SecurityNoticeSubtitle>
              {t("generate.successSubtitle")}
            </SecurityNoticeSubtitle>
          </Box>
          <Box
            sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 1.25 }}
          >
            <InputField
              fullWidth
              label={t("generate.yourKey")}
              placeholder={t("generate.keyNamePlaceholder")}
              name="key_name"
              readOnly
              inputHeight="40px"
              value="dpk_live_x04exyjb946e9lwclqhqvqzrgu3k0v24"
              inputBgColor="#FCFBF8"
              sx={{
                "& .MuiInputBase-root input": {
                  fontSize: "13px !important",
                  fontFamily: "var(--font-sans) !important",
                  fontWeight: 500,
                  padding: "12px 8px !important",
                  color: theme.palette.text.primary,
                  [theme.breakpoints.down("sm")]: {
                    fontSize: "10px !important",
                  },
                },
              }}
              endAdornment={
                <IconButton
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      backgroundColor: theme.palette.primary.light,
                    },
                    "&:active": {
                      transform: "scale(0.95)",
                    },
                    [theme.breakpoints.down("md")]: {
                      width: "32px",
                      height: "32px",
                      padding: "6px",
                    },
                    width: 26,
                    height: 26,
                    borderRadius: "4px",
                    border: `1px solid ${theme.palette.primary.main}`,
                    backgroundColor: theme.palette.background.paper,
                  }}
                  onClick={() => handleCopy("dpk_live_x04exyjb946e9lwclqhqvqzrgu3k0v24")}
                >
                  <Image
                    src={CopyIcon.src}
                    alt="copy-icon"
                    width={10}
                    height={10}
                    draggable={false}
                    className="themed-icon-primary"
                  />
                </IconButton>
              }
            />

            <InputField
              fullWidth
              label={t("generate.adminToken")}
              placeholder={t("generate.keyNamePlaceholder")}
              name="key_name"
              readOnly
              inputHeight="40px"
              value="dpk_live_x04exyjb946e9lwclqhqvqzrgu3k0v24"
              inputBgColor="#FCFBF8"
              sx={{
                "& .MuiInputBase-root input": {
                  fontSize: "13px !important",
                  fontFamily: "var(--font-sans) !important",
                  fontWeight: 500,
                  padding: "12px 8px !important",
                  color: theme.palette.text.primary,
                  [theme.breakpoints.down("sm")]: {
                    fontSize: "10px !important",
                  },
                },
              }}
              endAdornment={
                <IconButton
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      backgroundColor: theme.palette.primary.light,
                    },
                    "&:active": {
                      transform: "scale(0.95)",
                    },
                    [theme.breakpoints.down("md")]: {
                      width: "32px",
                      height: "32px",
                      padding: "6px",
                    },
                    width: 26,
                    height: 26,
                    borderRadius: "4px",
                    border: `1px solid ${theme.palette.primary.main}`,
                    backgroundColor: theme.palette.background.paper,
                  }}
                  onClick={() => handleCopy("dpk_live_x04exyjb946e9lwclqhqvqzrgu3k0v24")}
                >
                  <Image
                    src={CopyIcon.src}
                    alt="copy-icon"
                    width={10}
                    height={10}
                    draggable={false}
                    className="themed-icon-primary"
                  />
                </IconButton>
              }
            />

            <SecurityNoticeContainer>
              <IconContainer>
                <Image
                  src={InfoIcon.src}
                  alt="info-icon"
                  width={16}
                  height={16}
                  className="themed-icon"
                  draggable={false}
                />
              </IconContainer>
              <ContentContainer>
                <SecurityNoticeTitle>
                  {t("generate.securityTitle")}
                </SecurityNoticeTitle>
                <SecurityNoticeDescription>
                  {t("generate.securityMessage")}
                </SecurityNoticeDescription>
              </ContentContainer>
            </SecurityNoticeContainer>
          </Box>
          <Box sx={{ marginTop: isMobile ? "9px" : "20px" }}>
            <CustomButton
              variant="primary"
              size="medium"
              label={t("actions.done")}
              onClick={handleClose}
              fullWidth
            />
          </Box>
        </PanelCard>
      </PopupModal >
      <Toast
        open={openToast}
        message={tCommon("copiedToClipboard")}
        severity="success"
      />
    </>
  );
};

export default SuccessAPIModel;
