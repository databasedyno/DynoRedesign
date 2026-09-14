import Head from "next/head";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import KycPage from "@/Components/Page/Kyc";
import { pageProps } from "@/utils/types";

/** In-shell identity verification status page (plan 3.10). /kyc/complete stays the bare Veriff return page. */
const Kyc = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const { t } = useTranslation("dashboardLayout");

  useEffect(() => {
    setPageName(t("kycPage.pageTitle", { defaultValue: "Identity verification" }));
    setPageDescription?.(t("kycPage.pageDescription", { defaultValue: "Where you stand, what you'll need and how long it takes." }));
    setPageAction?.(null);
  }, [setPageName, setPageDescription, setPageAction, t]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Box style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, "--font-sans": "var(--font-inter)", fontFamily: "var(--font-inter)" } as any}>
        <KycPage />
      </Box>
    </>
  );
};

export default Kyc;
