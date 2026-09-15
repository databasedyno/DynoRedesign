import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React from "react";
import { useTranslation } from "react-i18next";

import RightArrowIcon from "@/assets/Icons/right-arrow-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CopyInline from "@/Components/UX/CopyInline";
import { AutoConvertInfo } from "@/utils/types/transaction";
import { ActionButtonGroup, ExplorerButton, HashRow, TitleLabel } from "./TransactionDetailsModal.styled";

/** Explorer URL for the payout leg — keyed on the STABLECOIN chain, not the source coin. */
export const payoutExplorerUrl = (chain: string | null, hash: string): string => {
  const c = (chain || "").toUpperCase();
  if (c.includes("TRC20") || c === "TRX" || c === "TRON") return `https://tronscan.org/#/transaction/${hash}`;
  if (c.includes("POLYGON") || c === "MATIC") return `https://blockchair.com/polygon/transaction/${hash}`;
  if (c.includes("BEP20") || c === "BSC" || c === "BNB") return `https://blockchair.com/bnb/transaction/${hash}`;
  if (c === "SOL" || c === "SOLANA") return `https://blockchair.com/solana/transaction/${hash}`;
  return `https://blockchair.com/ethereum/transaction/${hash}`;
};

interface Props {
  info: AutoConvertInfo;
  isMobile: boolean;
  onCopied: (ok: boolean) => void;
  copySx: object;
}

/** "Outgoing" leg of an auto-converted payment: Binance → merchant payout (on-chain, off-chain, or pending). */
export const AutoConvertPayoutRow: React.FC<Props> = ({ info, isMobile, onCopied, copySx }) => {
  const theme = useTheme();
  const { t } = useTranslation("transactions");
  const chainLabel = [info.targetCurrency, info.settlementChain].filter(Boolean).join(" · ");
  const hint = (key: string, fallback: string, vars?: Record<string, unknown>) => (
    <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, lineHeight: "16px", mt: "6px" }}>
      {t(key, { defaultValue: fallback, ...vars })}
    </Typography>
  );

  if (info.payoutTxHash) {
    return (
      <Box data-testid="tx-payout-hash-row" data-payout="onchain">
        <HashRow>
          <InputField
            value={info.payoutTxHash}
            readOnly
            data-testid="tx-payout-hash-input"
            ariaLabel={`${t("payoutTransactionId", { defaultValue: "Payout Transaction ID ({{chain}})", chain: chainLabel })}: ${info.payoutTxHash}`}
            label={<TitleLabel>{t("payoutTransactionId", { defaultValue: "Payout Transaction ID ({{chain}})", chain: chainLabel })}</TitleLabel>}
            inputHeight={isMobile ? "32px" : "40px"}
            sx={{ gap: isMobile ? "6px" : "12px" }}
          />
          <ActionButtonGroup>
            <CopyInline variant="boxed" value={info.payoutTxHash} size={isMobile ? 14 : 16} onCopied={onCopied} testId="tx-copy-outgoing-hash" sx={copySx} />
            <ExplorerButton
              data-testid="tx-payout-explorer"
              onClick={() => window.open(payoutExplorerUrl(info.settlementChain, info.payoutTxHash!), "_blank")}
              title={t("viewOnExplorer")}
            >
              <Image src={RightArrowIcon} alt="" width={isMobile ? 12 : 16} height={isMobile ? 12 : 16} draggable={false} />
            </ExplorerButton>
          </ActionButtonGroup>
        </HashRow>
        {hint("payoutHashHint", "Sent from our exchange account to your {{chain}} payout address after converting {{from}}.", { chain: chainLabel, from: info.sourceCurrency })}
      </Box>
    );
  }

  if (info.payoutOffchain) {
    const ref = info.payoutRef || "";
    return (
      <Box data-testid="tx-payout-hash-row" data-payout="offchain">
        <HashRow>
          <InputField
            value={ref}
            readOnly
            data-testid="tx-payout-ref-input"
            ariaLabel={`${t("payoutOffchain", { defaultValue: "Payout reference ({{chain}}, exchange-internal transfer)", chain: chainLabel })}: ${ref}`}
            label={<TitleLabel>{t("payoutOffchain", { defaultValue: "Payout reference ({{chain}}, exchange-internal transfer)", chain: chainLabel })}</TitleLabel>}
            inputHeight={isMobile ? "32px" : "40px"}
            sx={{ gap: isMobile ? "6px" : "12px" }}
          />
          <ActionButtonGroup>
            <CopyInline variant="boxed" value={ref} size={isMobile ? 14 : 16} onCopied={onCopied} testId="tx-copy-outgoing-hash" sx={copySx} />
          </ActionButtonGroup>
        </HashRow>
        {hint("payoutOffchainHint", "Your {{chain}} payout address is hosted by the same exchange we convert on, so the {{currency}} was credited instantly as an internal transfer — no blockchain transaction exists for this leg.", { chain: info.settlementChain || "", currency: info.targetCurrency })}
      </Box>
    );
  }

  const failed = info.status === "FAILED";
  return (
    <Box data-testid="tx-payout-hash-row" data-payout={failed ? "failed" : "pending"}>
      <TitleLabel>{t("payoutTransactionId", { defaultValue: "Payout Transaction ID ({{chain}})", chain: chainLabel })}</TitleLabel>
      {failed
        ? hint("payoutFailed", "Conversion to {{to}} could not be completed — our team has been alerted and will settle this payment manually.", { to: info.targetCurrency })
        : hint("payoutPending", "Payout in progress — converting {{from}} to {{to}}. The payout hash appears here once the transfer to your wallet is sent.", { from: info.sourceCurrency, to: info.targetCurrency })}
    </Box>
  );
};

export default AutoConvertPayoutRow;
