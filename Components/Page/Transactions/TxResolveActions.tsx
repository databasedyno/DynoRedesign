import React, { useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import CustomButton from "@/Components/UI/Buttons";
import CryptoRefundModal from "@/Components/Page/Refund/CryptoRefundModal";
import type { RefundSourceType } from "@/Components/Page/Refund/CryptoRefundModal";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { getRuntimeFlags } from "@/helpers/runtimeFlags";
import { Icon } from "@/styles/uiKit";
import { ExtendedTransaction } from "@/utils/types/transaction";

/** Which refund flow (if any) a settled payment can enter, from its source metadata. */
export const refundTarget = (tx: ExtendedTransaction): { sourceType: RefundSourceType; sourceRef: string } | null => {
  const s = tx.source;
  if (!s || (tx.status !== "settled" && tx.status !== "confirmed")) return null;
  if (s.type === "product" && s.order_ref) return { sourceType: "product_order", sourceRef: String(s.order_ref) };
  if ((s.type === "payment_link" || s.type === "tip" || s.type === "contribution") && s.link_id) {
    return { sourceType: "payment_link", sourceRef: String(s.link_id) };
  }
  return null;
};

interface Props {
  transaction: ExtendedTransaction;
}

/** Drawer "Resolve" strip: request a top-up for underpaid rows, refund settled ones. */
const TxResolveActions: React.FC<Props> = ({ transaction }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("transactions");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  const refund = getRuntimeFlags().enableCryptoRefunds ? refundTarget(transaction) : null;
  const underpaid = transaction.status === "underpaid";
  if (!underpaid && !refund) return null;

  const requestTopup = async () => {
    setSending(true);
    try {
      const res = await axiosBaseApi.post(API_ENDPOINTS.transactions.requestTopup(transaction.id));
      const email = res?.data?.data?.email || "";
      setSent(true);
      dispatch({ type: TOAST_SHOW, payload: { severity: "success", message: t("topupSent", { email, defaultValue: "Reminder sent to {{email}}" }) } });
    } catch (e: any) {
      const msg = e?.response?.data?.message || t("topupFailed", { defaultValue: "Couldn't send the reminder." });
      dispatch({ type: TOAST_SHOW, payload: { severity: "error", message: msg } });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box
      data-testid="tx-resolve-actions"
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1.25,
        p: 1.5,
        mt: 2,
        borderRadius: "12px",
        border: `1px solid ${underpaid ? `${theme.palette.warning.main}55` : theme.palette.border.main}`,
        backgroundColor: underpaid ? `${theme.palette.warning.main}12` : "transparent",
      }}
    >
      <Icon name={underpaid ? "circle-alert" : "undo-2"} size={18} color={underpaid ? "#D97706" : theme.palette.text.secondary} />
      <Typography sx={{ flex: 1, minWidth: 160, fontSize: 13, fontWeight: 600, color: theme.palette.text.primary, fontFamily: "var(--font-sans)" }}>
        {underpaid
          ? t("resolveUnderpaid", { defaultValue: "Buyer still owes the remainder — nudge them to finish paying." })
          : t("resolveSettled", { defaultValue: "Need to send money back? Start a refund to the buyer." })}
      </Typography>
      {underpaid && (
        <CustomButton
          data-testid="tx-request-topup-btn"
          label={sent ? t("topupSentShort", { defaultValue: "Reminder sent" }) : t("requestTopup", { defaultValue: "Request top-up" })}
          variant="primary"
          size="small"
          disabled={sending || sent}
          onClick={requestTopup}
          startIcon={<Icon name="mail" size={14} />}
        />
      )}
      {refund && (
        <>
          <CustomButton
            data-testid="tx-refund-btn"
            label={t("refund", { defaultValue: "Refund" })}
            variant="outlined"
            size="small"
            onClick={() => setRefundOpen(true)}
          />
          <CryptoRefundModal open={refundOpen} onClose={() => setRefundOpen(false)} sourceType={refund.sourceType} sourceRef={refund.sourceRef} />
        </>
      )}
    </Box>
  );
};

export default TxResolveActions;
