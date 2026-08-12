import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import PaymentLinksPage from "@/Components/Page/Payment-link";
import { AddRounded } from "@mui/icons-material";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";

const PayLinks = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) => {
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const { t, i18n } = useTranslation("paymentLinks");
  const ownsHeader = router.pathname === "/pay-links";

  useEffect(() => {
    if (!ownsHeader || !setPageName || !setPageDescription) return;

    setPageName(t("paymentLinksTitle"));
    setPageDescription(t("paymentLinksDescription"));

    return () => {
      setPageName("");
      setPageDescription("");
    };
  }, [ownsHeader, setPageName, setPageDescription, i18n.language, t]);

  useEffect(() => {
    if (!ownsHeader || !setPageAction) return;

    setPageAction(
      <CustomButton
        label={isMobile ? t("create") : t("createPaymentLink")}
        variant="primary"
        size="medium"
        endIcon={<AddRounded sx={{ fontSize: isMobile ? 18 : 20 }} />}
        onClick={() => router.push("/create-pay-link")}
        sx={{
          height: isMobile ? 34 : 40,
          px: isMobile ? 1.5 : 2.5,
          fontSize: isMobile ? 13 : 15,
        }}
      />,
    );
    return () => setPageAction(null);
  }, [ownsHeader, setPageAction, i18n.language, isMobile, t, router]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        ["--font-sans" as any]: "var(--font-inter)",
        fontFamily: "var(--font-inter)",
      }}
    >
      <PaymentLinksPage />
    </div>
  );
};

export default PayLinks;
