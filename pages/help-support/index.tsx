import { pageProps } from "@/utils/types";
import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import HelpAndSupport from "@/Components/Page/HelpAndSupport";

export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
}

const HelpAndSupportPage = ({ setPageName, setPageDescription, setPageAction, }: pageProps) => {

  const { t } = useTranslation("helpAndSupport");

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("helpAndSupportTitle"));
      setPageDescription(t("helpAndSupportDescription"));
    }
  }, [setPageName, setPageDescription, t]);

  return (
    <Box sx={{ flex: 1, display: "flex", minHeight: 0, width: "100%", maxWidth: 1280, mx: "auto", px: { xs: "16px", md: "20px" } }}>
      <HelpAndSupport />
    </Box>
  );
}

export default HelpAndSupportPage;