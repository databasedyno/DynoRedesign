import ExportIcon from "@/assets/Icons/export-icon.svg";
import CustomButton from "@/Components/UI/Buttons";
import { StatusDot } from "@/Components/UI/StatusDot";
import { txStatusTone } from "@/helpers/txStatus";
import useEdgeFade from "@/hooks/useEdgeFade";
import useIsMobile from "@/hooks/useIsMobile";
import useTableCardView from "@/hooks/useTableCardView";
import { Icon } from "@/styles/uiKit";
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
  "underpaid",
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
  /** Phone (<768px): status lives in the filter sheet, so the strip shows the
   *  active filters as removable pills (or the result count) instead. */
  activeFilters?: Array<{ key: string; label: string; onRemove: () => void }>;
  resultCount?: number;
}

const TransactionsToolbar: React.FC<Props> = ({
  counts,
  selected,
  onChange,
  onExport,
  settledOnly,
  onSettledOnlyChange,
  standalone,
  activeFilters,
  resultCount,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("transactions");
  const isMobile = useIsMobile("md");
  const cardView = useTableCardView();
  const exportLoading = useSelector(
    (state: rootReducer) => !!state.transactionReducer?.exportLoading,
  );
  const fade = useEdgeFade<HTMLDivElement>();
  const pillsMode = cardView && Array.isArray(activeFilters);

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
      {pillsMode ? (
        <StatusChipsRow
          ref={fade.ref}
          data-testid="transactions-active-filters"
          sx={{ WebkitMaskImage: fade.WebkitMaskImage, maskImage: fade.maskImage, alignItems: "center" }}
        >
          <Box component="span" data-testid="transactions-result-count" sx={{ flexShrink: 0, fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: theme.palette.text.secondary, whiteSpace: "nowrap", pr: activeFilters!.length ? 0.5 : 0 }}>
            {t("resultsCount", { count: resultCount ?? counts[selected], defaultValue: "{{count}} results" })}
          </Box>
          {activeFilters!.map((f) => (
            <Box
              key={f.key}
              component="button"
              type="button"
              data-testid={`transactions-active-filter-${f.key}`}
              aria-label={t("removeFilter", { label: f.label, defaultValue: "Remove filter {{label}}" })}
              onClick={f.onRemove}
              sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 0.5, height: 30, pl: 1.25, pr: 0.75, borderRadius: 999, border: `1px solid ${theme.palette.primary.main}`, backgroundColor: theme.palette.primary.light, color: theme.palette.text.primary, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", textTransform: "capitalize" }}
            >
              {f.label}
              <Icon name="x" size={14} />
            </Box>
          ))}
        </StatusChipsRow>
      ) : (
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
      )}

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
