import BrandsPage from "@/Components/Page/Brands";
import { pageProps } from "@/utils/types";
import { Box } from "@mui/material";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const Brands = ({ setPageName, setPageDescription }: pageProps) => {
  const { t } = useTranslation("common");
  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("brandsOverview.pageName", { defaultValue: "Brands" }));
      setPageDescription(
        t("brandsOverview.pageDescription", {
          defaultValue:
            "All your brands at a glance \u2014 settled volume, pending funds and anything that needs attention.",
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
      <BrandsPage />
    </Box>
  );
};

export default Brands;
