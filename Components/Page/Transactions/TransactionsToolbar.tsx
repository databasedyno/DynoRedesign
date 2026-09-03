import ExportIcon from "@/assets/Icons/export-icon.svg";
import CustomButton from "@/Components/UI/Buttons";
import { StatusDot } from "@/Components/UI/StatusDot";
import { txStatusTone } from "@/Components/UI/TransactionStatusBadge";
import useEdgeFade from "@/hooks/useEdgeFade";
import useIsMobile from "@/hooks/useIsMobile";
import { rootReducer } from "@/utils/types";
import { TxStatusFilter } from "@/utils/types/transaction";
import { Box, Checkbox, FormControlLabel, Tooltip, useTheme } from "@mui/material";
import Image from "next/image";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { StatusChip, StatusChipsRow, TableToolbar } from "./styled";

export const STATUS_FILTERS: Exclude<TxStatusFilter, "all">[] = [
  "settled",
  "confirmed",
  "processing",
  "pending",
  "awaiting_payment",
  "unpaid",
  "failed",
];

interface Props {
  counts: Record<TxStatusFilter, number>;
  selected: TxStatusFilter;
  onChange: (status: TxStatusFilter) => void;
  onExport: () => void;
  settledOnly: boolean;
  onSettledOnlyChange: (value: boolean) => void;
  /** Rendered on its own (no table below) — e.g. the filtered-empty state. */
  standalone?: boolean;
}

const TransactionsToolbar: React.FC<Props> = ({
  counts,
  selected,
  onChange,
  onExport,
  settledOnly,
  onSettledOnlyChange,
  standalone,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("transactions");
  const isMobile = useIsMobile("md");
  const exportLoading = useSelector(
    (state: rootReducer) => !!state.transactionReducer?.exportLoading,
  );
  const fade = useEdgeFade<HTMLDivElement>();

  // Zero-count chips are hidden so the strip only shows states that exist in
  // the current slice — except the active chip, which must stay clickable.
  const chips = useMemo(
    () => [
      { value: "all" as TxStatusFilter, label: t("statusAll", { defaultValue: "All" }) },
      ...STATUS_FILTERS.filter((s) => counts[s] > 0 || selected === s).map((s) => ({
        value: s as TxStatusFilter,
        label:
          s === "awaiting_payment"
            ? t("awaitingShort", { defaultValue: "Awaiting" })
            : String(t(s)),
      })),
    ],
    [counts, selected, t],
  );

  const scoped = selected !== "all";
  const exportLabel = scoped
    ? t("exportScoped", {
        defaultValue: "Export {{count}}",
        count: counts[selected].toLocaleString(),
      })
    : t("export");
  const exportHint = scoped
    ? t("exportScopedHint", {
        defaultValue: "Exports the {{count}} rows matching your filters and the active status chip.",
        count: counts[selected].toLocaleString(),
      })
    : settledOnly
      ? t("exportSettledHint", { defaultValue: "Exports only settled payments matching your filters." })
      : t("exportAllHint", { defaultValue: "Exports every row matching your filters as CSV." });

  return (
    <TableToolbar data-testid="transactions-toolbar" standalone={standalone}>
      <StatusChipsRow
        ref={fade.ref}
        role="tablist"
        aria-label={t("statusFilterLabel", { defaultValue: "Filter by status" }) as string}
        data-testid="transactions-status-chips"
        sx={{ WebkitMaskImage: fade.WebkitMaskImage, maskImage: fade.maskImage }}
      >
        {chips.map((chip) => {
          const isSelected = selected === chip.value;
          return (
            <StatusChip
              key={chip.value}
              role="tab"
              aria-selected={isSelected}
              selected={isSelected}
              onClick={() => onChange(chip.value)}
              data-testid={`transactions-status-chip-${chip.value}`}
            >
              {chip.value !== "all" && (
                <StatusDot tone={txStatusTone(chip.value)} sx={{ gap: 0 }} />
              )}
              <span className="chip-label">{chip.label}</span>
              <span
                className="chip-count"
                data-testid={`transactions-status-count-${chip.value}`}
              >
                {counts[chip.value].toLocaleString()}
              </span>
            </StatusChip>
          );
        })}
      </StatusChipsRow>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        {!isMobile && !scoped && (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={settledOnly}
                onChange={(e) => onSettledOnlyChange(e.target.checked)}
                data-testid="transactions-export-settled-only"
              />
            }
            label={t("settledOnly", { defaultValue: "Settled only" })}
            sx={{
              m: 0,
              whiteSpace: "nowrap",
              "& .MuiFormControlLabel-label": {
                fontSize: 13,
                fontFamily: "var(--font-sans)",
                color: theme.palette.text.secondary,
              },
            }}
          />
        )}
        <Tooltip title={exportHint} arrow placement="top" enterDelay={400}>
          <Box component="span" sx={{ display: "inline-flex" }}>
            <CustomButton
              data-testid="transactions-export-btn"
              label={exportLabel}
              loading={exportLoading}
              disabled={counts[selected] === 0}
              hideLabel={isMobile}
              variant="secondary"
              size="small"
              onClick={onExport}
              startIcon={<Image src={ExportIcon} alt="" width={15} height={15} />}
              sx={{
                height: "32px",
                minHeight: "32px",
                minWidth: "auto",
                padding: isMobile ? "0 10px" : "0 14px",
                fontSize: "13px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
              }}
            />
          </Box>
        </Tooltip>
      </Box>
    </TableToolbar>
  );
};

export default TransactionsToolbar;
