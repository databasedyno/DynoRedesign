import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import CustomButton from "@/Components/UI/Buttons";
import { brandFg } from "@/constants/theme";

interface Props {
  periodActive: boolean;
  onShowAll: () => void;
  compact?: boolean;
}

/** Teaching empty state for the Receipts tab — explains where receipts come from and what to do next. */
const ReceiptsEmptyState: React.FC<Props> = ({ periodActive, onShowAll, compact }) => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("common");
  const steps = [
    t("invoices.emptyStep1", { defaultValue: "A customer pays a link, product or API invoice" }),
    t("invoices.emptyStep2", { defaultValue: "The payment settles on-chain" }),
    t("invoices.emptyStep3", { defaultValue: "A numbered receipt with fee & VAT lines appears here" }),
  ];
  return (
    <Box data-testid="receipts-empty-state" data-period={periodActive ? "1" : "0"} sx={{ py: compact ? 4 : 6, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, px: 2 }}>
      <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: `${theme.palette.primary.main}10`, color: brandFg(theme.palette.mode === "dark"), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="receipt-text" size={26} />
      </Box>
      <Typography sx={{ fontWeight: 600, fontFamily: "var(--font-sans)", color: theme.palette.text.primary, fontSize: compact ? 15 : 16 }}>
        {periodActive
          ? t("invoices.noInvoicesPeriodTitle", { defaultValue: "No receipts in this period" })
          : t("invoices.noInvoicesTitle")}
      </Typography>
      <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", maxWidth: 380, lineHeight: 1.5 }}>
        {periodActive
          ? t("invoices.noInvoicesPeriodDesc", { defaultValue: "Receipts are created automatically when a payment settles. Widen the period, or check Transactions for payments that are still confirming." })
          : t("invoices.noInvoicesDesc")}
      </Typography>
      {!periodActive && (
        <Box component="ol" data-testid="receipts-empty-steps" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: { xs: 0.75, sm: 2 }, mt: 0.5 }}>
          {steps.map((s, i) => (
            <Box component="li" key={i} sx={{ display: "flex", alignItems: "center", gap: 0.75, fontFamily: "var(--font-sans)", fontSize: 12.5, color: theme.palette.text.secondary }}>
              <Box component="span" sx={{ width: 20, height: 20, borderRadius: "50%", border: `1px solid ${theme.palette.divider}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: theme.palette.text.primary, flexShrink: 0 }}>{i + 1}</Box>
              {s}
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap", justifyContent: "center" }}>
        {periodActive ? (
          <>
            <CustomButton data-testid="receipts-empty-show-all" label={t("invoices.showAllTime", { defaultValue: "Show all time" })} variant="primary" size="small" onClick={onShowAll} />
            <CustomButton data-testid="receipts-empty-transactions" label={t("invoices.viewTransactions", { defaultValue: "View transactions" })} variant="outlined" size="small" onClick={() => router.push("/transactions")} />
          </>
        ) : (
          <CustomButton data-testid="receipts-empty-create-link" label={t("invoices.noInvoicesCta")} variant="primary" size="small" onClick={() => router.push("/create-pay-link")} />
        )}
      </Box>
    </Box>
  );
};

export default ReceiptsEmptyState;
