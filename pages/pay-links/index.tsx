import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import PaymentLinksPage from "@/Components/Page/Payment-link";

/**
 * /pay-links — list only. Creation lives in ONE place: the header "+ New"
 * (Wave 3a, plan §4 "one create control"); the empty state re-uses it via the
 * quick-create window event, so no in-page create button is rendered here.
 */
const PayLinks = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) => {
  const router = useRouter();
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
    setPageAction(null);
    return () => setPageAction(null);
  }, [ownsHeader, setPageAction]);

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
