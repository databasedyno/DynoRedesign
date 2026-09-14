import TransactionPage from "@/Components/Page/Transactions";
import { pageProps } from "@/utils/types";
import { Box } from "@mui/material";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

const TransactionsPage = ({ setPageName, setPageDescription }: pageProps) => {
  const { t } = useTranslation("transactions");
  const tTransactions = useCallback(
    (key: string) => t(key, { ns: "transactions" }),
    [t],
  );

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(tTransactions("transactionsTitle"));
      setPageDescription(tTransactions("transactionsDescription"));
    }
  }, [setPageName, setPageDescription, tTransactions]);

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        "--font-sans": "var(--font-inter)",
        fontFamily: "var(--font-inter)",
      } as any}
    >
      <TransactionPage />
    </Box>
  );
};

export default TransactionsPage;
