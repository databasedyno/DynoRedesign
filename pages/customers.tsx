import CustomersPage from "@/Components/Page/Customers";
import { pageProps } from "@/utils/types";
import { Box } from "@mui/material";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const Customers = ({ setPageName, setPageDescription }: pageProps) => {
  const { t } = useTranslation("common");
  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("customers.pageName"));
      setPageDescription(t("customers.pageDescription"));
    }
  }, [setPageName, setPageDescription, t]);

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <CustomersPage />
    </Box>
  );
};

export default Customers;
