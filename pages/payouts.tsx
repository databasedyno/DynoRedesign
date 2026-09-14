import PayoutsPage from "@/Components/Page/Payouts";
import { pageProps } from "@/utils/types";
import { Box } from "@mui/material";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const Payouts = ({ setPageName, setPageDescription }: pageProps) => {
  const { t } = useTranslation("common");
  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(
        t("payouts.pageName", { defaultValue: "Payouts & settlements" }),
      );
      setPageDescription(
        t("payouts.pageDescription", {
          defaultValue:
            "Your settled volume, pending funds, auto\u2011conversion and where payouts land.",
        }),
      );
    }
  }, [setPageName, setPageDescription, t]);

  return (
    <Box
      style={
        {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        } as any
      }
    >
      <PayoutsPage />
    </Box>
  );
};

export default Payouts;
