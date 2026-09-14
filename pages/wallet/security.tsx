import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import CustomButton from "@/Components/UI/Buttons";
import WalletSecurityPage from "@/Components/Page/WalletSecurity";
import { Icon } from "@/styles/uiKit";
import { pageProps } from "@/utils/types";

/** In-shell Wallet security page (plan 3.4). The public /wallet-security email-landing page is unchanged. */
const WalletSecurity = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const router = useRouter();
  const { t } = useTranslation("walletScreen");

  useEffect(() => {
    setPageName(t("security.pageTitle", { defaultValue: "Wallet security" }));
    setPageDescription?.(t("security.pageDescription", { defaultValue: "How your payout wallets are protected, and every change made to them." }));
  }, [setPageName, setPageDescription, t]);

  useEffect(() => {
    if (!setPageAction) return;
    setPageAction(
      <CustomButton
        label={t("security.backToWallets", { defaultValue: "Payout wallets" })}
        variant="outlined"
        size="medium"
        startIcon={<Icon name="wallet" size={16} />}
        onClick={() => router.push("/wallet")}
        data-testid="wallet-security-back-btn"
        sx={{ height: 40, whiteSpace: "nowrap", display: { xs: "none", md: "inline-flex" } }}
      />,
    );
    return () => setPageAction(null);
  }, [setPageAction, router, t]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Box style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, "--font-sans": "var(--font-inter)", fontFamily: "var(--font-inter)" } as any}>
        <WalletSecurityPage />
      </Box>
    </>
  );
};

export default WalletSecurity;
