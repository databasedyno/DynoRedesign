import { Text } from "@/Components/Page/CreatePaymentLink/styled";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import i18n from "@/i18n";
import { PostPaymentSettingsProps } from "@/utils/types/create-pay-link";
import { Box, useTheme } from "@mui/material";
import React from "react";

const PostPaymentSettings: React.FC<PostPaymentSettingsProps> = ({
  hasPaymentLinkData,
  isMobile,
  tPaymentLink,
  postPaymentSettings,
  handleChange,
  showHelpers = false,
  showCreateButton = false,
  onCreate,
  createDisabled = false,
}) => {
  const currentLang = i18n.language;
  const theme = useTheme();
  return (
    <>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? "15px" : "16px",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            gap: isMobile ? "6px" : "8px",
          }}
        >
          {hasPaymentLinkData && (
            <Box width={currentLang === "pt" ? "210px" : "110px"}>
              <Text
                sx={{
                  fontSize: isMobile ? "12px" : "15px",
                  color: theme.palette.text.primary,
                }}
              >
                {tPaymentLink("callbackUrl")}
              </Text>
            </Box>
          )}
          <InputField
            label={hasPaymentLinkData ? "" : tPaymentLink("callbackUrl")}
            placeholder={tPaymentLink("callbackUrlPlaceholder")}
            value={postPaymentSettings.callbackUrl}
            onChange={(e) => handleChange("callbackUrl", e.target.value)}
            helperText={
              showHelpers ? tPaymentLink("callbackUrlHelper") : undefined
            }
            type="url"
            sx={{ width: "100%" }}
          />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            gap: "6px",
          }}
        >
          {hasPaymentLinkData && (
            <Box width={currentLang === "pt" ? "210px" : "110px"}>
              <Text
                sx={{
                  fontSize: isMobile ? "12px" : "15px",
                  color: theme.palette.text.primary,
                }}
              >
                {tPaymentLink("redirectUrl")}
              </Text>
            </Box>
          )}
          <InputField
            label={hasPaymentLinkData ? "" : tPaymentLink("redirectUrl")}
            placeholder={tPaymentLink("redirectUrlPlaceholder")}
            value={postPaymentSettings.redirectUrl}
            onChange={(e) => handleChange("redirectUrl", e.target.value)}
            helperText={
              showHelpers ? tPaymentLink("redirectUrlHelper") : undefined
            }
            type="url"
            sx={{ width: "100%" }}
          />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            gap: isMobile ? "6px" : "8px",
          }}
        >
          {hasPaymentLinkData && (
            <Box width={currentLang === "pt" ? "210px" : "110px"}>
              <Text
                sx={{
                  fontSize: isMobile ? "12px" : "15px",
                  color: theme.palette.text.primary,
                }}
              >
                {tPaymentLink("webhookUrl")}
              </Text>
            </Box>
          )}
          <InputField
            label={hasPaymentLinkData ? "" : tPaymentLink("webhookUrl")}
            placeholder={tPaymentLink("webhookUrlPlaceholder")}
            value={postPaymentSettings.webhookUrl}
            onChange={(e) => handleChange("webhookUrl", e.target.value)}
            helperText={
              showHelpers ? tPaymentLink("webhookUrlHelper") : undefined
            }
            type="url"
            sx={{ width: "100%" }}
          />
        </Box>
      </Box>
      {showCreateButton && onCreate && (
        <Box>
          <CustomButton
            label={tPaymentLink("createPaymentLink")}
            variant="primary"
            size="medium"
            fullWidth={true}
            onClick={onCreate}
            disabled={createDisabled}
            sx={{
              [theme.breakpoints.down("md")]: {
                height: "32px",
                fontSize: "13px",
              },
            }}
          />
        </Box>
      )}
    </>
  );
};

export default PostPaymentSettings;
