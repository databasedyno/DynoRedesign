import InfoIcon from "@/assets/Icons/info-icon.svg";
import WalletIcon from "@/assets/Icons/wallet-icon.svg";
import FormManager from "@/Components/Page/Common/FormManager";
import useIsMobile from "@/hooks/useIsMobile";
import { theme } from "@/styles/theme";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import * as yup from "yup";
import InputField from "../../AuthLayout/InputFields";
import CustomButton from "../../Buttons";
import CurrencySelector from "../../CurrencySelector";
import PanelCard from "../../PanelCard";
import PopupModal from "../../PopupModal";
import SuccessAPIModel from "../SuccessAPIModel";
import {
  ContentContainer,
  IconContainer,
  PermissionsContainer,
  PermissionsList,
  PermissionsTitle,
} from "./styled";

export interface CreateApiModelProps {
  open: boolean;
  onClose: () => void;
}

const CreateApiModel: React.FC<CreateApiModelProps> = ({ open, onClose }) => {
  const { t } = useTranslation("apiScreen");
  const isMobile = useIsMobile("md");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const onSubmit = (values: any) => {
    console.log("Form submitted with data:", values);
    onClose();
    setShowSuccessModal(true);
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
  };

  return (
    <>
      <PopupModal
        open={open}
        showHeader={false}
        transparent
        handleClose={onClose}
        sx={{
          "& .MuiDialog-paper": {
            width: "100%",
            maxWidth: "475px",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            p: 2,
          },
        }}
      >
        <PanelCard
          title={t("generate.modalTitle")}
          showHeaderBorder={false}
          headerIcon={
            <Image
              src={WalletIcon.src}
              alt="wallet-icon"
              width={16}
              height={18}
              draggable={false}
              className="themed-icon"
            />
          }
          bodyPadding={
            isMobile
              ? theme.spacing(2, 2, 2, 2)
              : theme.spacing(1.5, 3.75, 3.75, 3.75)
          }
          headerPadding={theme.spacing(3.75, 3.75, 0, 3.75)}
          headerActionLayout="inline"
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              fontWeight: 500,
              letterSpacing: 0,
              fontFamily: "var(--font-sans)",
              lineHeight: isMobile ? "16px" : "18px",
            }}
          >
            {t("generate.modalSubtitle")}
          </Typography>
          <FormManager
            initialValues={{ base_currency: "USD" }}
            yupSchema={yup.object().shape({
              key_name: yup.string().required(t("validation.required")),
              base_currency: yup.string().required(t("validation.required")),
            })}
            onSubmit={onSubmit}
          >
            {({
              errors,
              handleBlur,
              handleChange,
              submitDisable,
              touched,
              values,
            }) => (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  mt: 2,
                }}
              >
                <InputField
                  fullWidth
                  label={t("generate.keyName") + " *"}
                  placeholder={t("generate.keyNamePlaceholder")}
                  name="key_name"
                  value={values.key_name}
                  onChange={handleChange}
                  // sx={{ minHeight: "40px" }}
                />

                <CurrencySelector
                  fullWidth
                  label={t("generate.baseCurrency")}
                  name="base_currency"
                  value={values.base_currency || "USD"}
                  onChange={(value) => {
                    const event = {
                      target: {
                        name: "base_currency",
                        value: value,
                      },
                    } as React.ChangeEvent<HTMLInputElement>;
                    handleChange(event);
                  }}
                  required
                  error={touched.base_currency && !!errors.base_currency}
                  helperText={
                    touched.base_currency && errors.base_currency
                      ? errors.base_currency
                      : undefined
                  }
                />

                <PermissionsContainer>
                  <IconContainer sx={{ width: "24px", height: "24px" }}>
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
                    <PermissionsTitle variant="body2">
                      {t("generate.keyNameDescription")}
                    </PermissionsTitle>
                    <PermissionsList>
                      <li>{t("generate.keyNameDescription1")}</li>
                      <li>{t("generate.keyNameDescription2")}</li>
                      <li>{t("generate.keyNameDescription3")}</li>
                      <li>{t("generate.keyNameDescription4")}</li>
                    </PermissionsList>
                  </ContentContainer>
                </PermissionsContainer>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: isMobile ? "column-reverse" : "row",
                    gap: 1,
                    mt: isMobile ? "0px" : "10px",
                  }}
                >
                  <CustomButton
                    variant="outlined"
                    size={isMobile ? "small" : "medium"}
                    label={t("actions.cancel")}
                    onClick={onClose}
                    sx={{
                      flex: 1,
                    }}
                  />
                  <CustomButton
                    type="submit"
                    variant="primary"
                    size={isMobile ? "small" : "medium"}
                    label={t("actions.generate")}
                    disabled={submitDisable}
                    sx={{
                      flex: 1,
                    }}
                  />
                </Box>
              </Box>
            )}
          </FormManager>
        </PanelCard>
      </PopupModal>
      <SuccessAPIModel
        open={showSuccessModal}
        handleClose={handleSuccessModalClose}
      />
    </>
  );
};

export default CreateApiModel;
