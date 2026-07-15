import CreatePaymentLinkPage from "@/Components/Page/CreatePaymentLink";
import { Text } from "@/Components/Page/CreatePaymentLink/styled";
import useIsMobile from "@/hooks/useIsMobile";
import { PaymentLink } from "@/utils/types/paymentLink";
import { ExpandLess } from "@mui/icons-material";
import { Box, CircularProgress, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";

export default function EditPaymentLink() {
  const router = useRouter();
  const { slug } = router.query;
  const isMobile = useIsMobile();
  const { t } = useTranslation("createPaymentLinkScreen");
  const muiTheme = useTheme();
  const [paymentLinkData, setPaymentLinkData] = useState<PaymentLink | {}>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    if (typeof slug !== "string" || slug === undefined) {
      router.push("/pay-links");
      return;
    }

    const fetchPaymentLink = async () => {
      try {
        setLoading(true);
        const response = await axiosBaseApi.get(`/pay/links/${slug}`);
        const d = response?.data?.data;
        if (d) {
          // Handle accepted_currencies - could be array or comma-separated string.
          // Keep the canonical wallet_type format (uppercase, dashes — e.g., "USDT-TRC20")
          // so the values match ALL_CRYPTO_ITEMS.label in CreatePaymentLink AND the
          // backend cryptoTypes validation. Session 47 bug: `.toLowerCase().replace(/-/g,"_")`
          // silently broke edit → save because "USDT_TRC20" is NOT in the backend's
          // valid list ("USDT-TRC20"), returning HTTP 400 "Invalid cryptocurrency types".
          let cryptoCurrencies: string[] = [];
          if (Array.isArray(d.accepted_currencies)) {
            cryptoCurrencies = d.accepted_currencies
              .map((c: string) => (typeof c === "string" ? c.trim().toUpperCase() : ""))
              .filter(Boolean);
          } else if (typeof d.accepted_currencies === "string" && d.accepted_currencies) {
            cryptoCurrencies = d.accepted_currencies
              .split(",")
              .map((c: string) => c.trim().toUpperCase())
              .filter(Boolean);
          }

          setPaymentLinkData({
            link_id: String(d.link_id),
            amount: d.base_amount ?? 0,
            currency: d.base_currency ?? "USD",
            description: d.description ?? "",
            status: (d.status ?? "pending").toLowerCase() as any,
            clientName: d.email ?? "",
            expire: d.expires_at ? "yes" : "no",
            blockchainFees: d.fee_payer === "company" ? "company" : "customer",
            acceptedCryptoCurrency: cryptoCurrencies.length
              ? cryptoCurrencies
              : ["BTC", "ETH", "LTC", "DOGE", "USDT-TRC20"],
            payment_url: d.payment_link ?? "",
            redirect_url: d.redirect_url ?? "",
            webhook_url: d.webhook_url ?? "",
            link_type: d.link_type === "donation" ? "donation" : "standard",
            donation: d.donation ?? null,
            metadata: {
              order_id: d.transaction_id ?? "",
              customer_email: d.email ?? "",
            },
            created_at: d.created ?? "",
            paid_at: "",
            transaction: {
              transaction_id: d.transaction_reference ?? "",
              crypto_currency: d.paid_currency ?? "",
              crypto_amount: d.paid_amount ?? 0,
              confirmations: 0,
              tx_hash: "",
            },
          });
        }
      } catch (err) {
        console.error("Failed to fetch payment link:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentLink();
  }, [router, router.isReady, slug]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        flex: 1,
        minHeight: 0,
      }}
    >
      <Box
        onClick={() => router.push("/pay-links")}
        sx={{
          display: "flex",
          gap: "10px",
          border: `1px solid ${(muiTheme.palette as any).border?.main ?? "#E9ECF2"}`,
          backgroundColor: muiTheme.palette.background.paper,
          borderRadius: "8px",
          padding: "10px 14px",
          height: "36px",
          width: "fit-content",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <ExpandLess
          sx={{ fontSize: "large", rotate: "270deg", color: muiTheme.palette.text.primary }}
        />
        <Text sx={{ fontSize: "13px", color: muiTheme.palette.text.secondary }}>
          {t("backToPaymentLinks")}
        </Text>
      </Box>
      <Text
        sx={{
          fontSize: isMobile ? "22px" : "30px",
          color: muiTheme.palette.text.primary,
        }}
      >
        {"status" in paymentLinkData &&
        (paymentLinkData.status === "paid" || paymentLinkData.status === "expired")
          ? t("paymentLinkDetail")
          : t("editPaymentLink")}
      </Text>
      <CreatePaymentLinkPage
        paymentLinkData={paymentLinkData}
        disabled={
          "status" in paymentLinkData &&
          (paymentLinkData.status === "paid" ||
            paymentLinkData.status === "expired")
        }
      />
    </Box>
  );
}
