import React from "react";
import { Tooltip } from "@mui/material";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CodeRounded from "@mui/icons-material/CodeRounded";
import DonutSmallRounded from "@mui/icons-material/DonutSmallRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import { useTranslation } from "react-i18next";

import { SourceBadge } from "@/Components/Page/Transactions/styled";
import { TransactionSourceType } from "@/utils/types/transaction";

/**
 * TransactionSourceBadge — the ONE badge used everywhere a transaction's
 * origin is shown (transactions table, dashboard "Recent transactions",
 * transaction details modal, payment-links table). It is the single source
 * of truth for the icon + label of each canonical source type, so every
 * surface stays visually + semantically consistent.
 *
 * Canonical taxonomy (must match backend utils/transactionSource.ts):
 *   payment_link → "Payment Link"   api → "API"      tip → "Tip"
 *   product      → "Store"          contribution → "Donation"   direct → "Direct"
 */

export interface TransactionSourceLike {
  type?: TransactionSourceType | string | null;
  title?: string | null;
}

interface TransactionSourceBadgeProps {
  source?: TransactionSourceLike | null;
  /** Slightly smaller icon for dense/mobile rows. */
  compact?: boolean;
  /** Append the source title (link/product/campaign name) after the label. */
  withTitle?: boolean;
}

const iconFor = (type: string, size: number): React.ReactNode => {
  switch (type) {
    case "payment_link":
      return <LinkRounded sx={{ fontSize: size }} />;
    case "api":
      return <CodeRounded sx={{ fontSize: size }} />;
    case "tip":
      return <AutoAwesomeRounded sx={{ fontSize: size }} />;
    case "product":
      return <Inventory2Rounded sx={{ fontSize: size }} />;
    case "contribution":
      return <FavoriteRounded sx={{ fontSize: size }} />;
    default:
      return <DonutSmallRounded sx={{ fontSize: size }} />;
  }
};

const TransactionSourceBadge: React.FC<TransactionSourceBadgeProps> = ({
  source,
  compact,
  withTitle,
}) => {
  const { t } = useTranslation("transactions");
  const rawType = (source?.type as string) || "direct";
  // Only the 6 canonical types have a palette; anything else renders as direct.
  const known = ["payment_link", "api", "tip", "product", "contribution", "direct"];
  const type = known.includes(rawType) ? rawType : "direct";

  const labels: Record<string, string> = {
    payment_link: t("sourcePaymentLinkShort", { defaultValue: "Payment Link" }),
    api: t("sourceApiShort", { defaultValue: "API" }),
    tip: t("sourceTipShort", { defaultValue: "Tip" }),
    product: t("sourceProductShort", { defaultValue: "Store" }),
    contribution: t("sourceContributionShort", { defaultValue: "Donation" }),
    direct: t("sourceDirectShort", { defaultValue: "Direct" }),
  };
  const label = labels[type] || labels.direct;
  const iconSize = compact ? 11 : 12;
  const showTitle = !!withTitle && !!source?.title;

  const badge = (
    <SourceBadge
      sourceType={type}
      data-testid={`tx-source-badge-${type}`}
      aria-label={`Source: ${label}${source?.title ? " · " + source.title : ""}`}
    >
      {iconFor(type, iconSize)}
      <span>{label}</span>
      {showTitle && source?.title && (
        <>
          <span aria-hidden="true" style={{ opacity: 0.5, margin: "0 2px" }}>
            ·
          </span>
          <span className="badge-title">{source.title}</span>
        </>
      )}
    </SourceBadge>
  );

  if (source?.title) {
    return (
      <Tooltip title={`${label} · ${source.title}`} placement="top" arrow>
        {badge}
      </Tooltip>
    );
  }
  return badge;
};

export default TransactionSourceBadge;
