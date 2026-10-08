import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/Components/UI/BottomSheet";
import CustomButton from "@/Components/UI/Buttons";
import { FilterGroupLabel, FilterOptionChip, FiltersButton } from "./FilterControls";

/**
 * The phone filter pattern (blueprint §8.4 "one toolbar pattern" / §8.5 overlays):
 * [search] [Filters] in the toolbar → a bottom sheet with single-choice option groups and a
 * Clear / Done footer. Payment links, Transactions, Receipts, Customers and Products share it.
 *
 * Test ids: `${testIdPrefix}-filters-btn` (+ `-count`), `${testIdPrefix}-filter-sheet`,
 * `${testIdPrefix}-filter-clear`, `${testIdPrefix}-filter-done`, options `${group.testIdPrefix}-${value}`.
 */
export interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  testIdPrefix: string;
  title?: React.ReactNode;
  children: React.ReactNode;
}

export const FilterSheet: React.FC<FilterSheetProps> = ({ open, onClose, onClear, testIdPrefix, title, children }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title ?? t("filters", { defaultValue: "Filters" })}
      data-testid={`${testIdPrefix}-filter-sheet`}
      footer={
        <Box sx={{ display: "flex", gap: 1.25, px: 2, pt: 1.5, pb: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ "& button": { minHeight: 46, px: 2 } }}>
            <CustomButton label={t("clearFilters", { defaultValue: "Clear" })} variant="secondary" data-testid={`${testIdPrefix}-filter-clear`} onClick={onClear} />
          </Box>
          <Box sx={{ flex: 1, "& button": { width: "100%", minHeight: 46 } }}>
            <CustomButton label={t("filtersDone", { defaultValue: "Done" })} variant="primary" data-testid={`${testIdPrefix}-filter-done`} onClick={onClose} />
          </Box>
        </Box>
      }
    >
      <Box sx={{ px: 2, py: 2, display: "grid", gap: 3 }}>{children}</Box>
    </BottomSheet>
  );
};

export interface FilterChoiceGroupProps<V extends string> {
  label: React.ReactNode;
  value: V;
  options: { value: V; label: React.ReactNode }[];
  onChange: (v: V) => void;
  /** option test id = `${testIdPrefix}-${value}`; the group itself is `${testIdPrefix}-group` */
  testIdPrefix: string;
}

/** One single-choice option group (chips) inside a FilterSheet. */
export function FilterChoiceGroup<V extends string>({ label, value, options, onChange, testIdPrefix }: FilterChoiceGroupProps<V>) {
  return (
    <Box data-testid={`${testIdPrefix}-group`}>
      <FilterGroupLabel>{label}</FilterGroupLabel>
      <Box role="listbox" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {options.map((o) => (
          <FilterOptionChip key={o.value} selected={value === o.value} onClick={() => onChange(o.value)} testId={`${testIdPrefix}-${o.value}`}>
            {o.label}
          </FilterOptionChip>
        ))}
      </Box>
    </Box>
  );
}

/** Toolbar trigger + sheet in one: the common case. */
export const PhoneFilters: React.FC<Omit<FilterSheetProps, "open" | "onClose"> & { activeCount: number; label?: string }> = ({ activeCount, label, testIdPrefix, onClear, title, children }) => {
  const { t } = useTranslation("common");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <FiltersButton testId={`${testIdPrefix}-filters-btn`} label={label ?? (t("filters", { defaultValue: "Filters" }) as string)} count={activeCount} onClick={() => setOpen(true)} />
      <FilterSheet open={open} onClose={() => setOpen(false)} onClear={onClear} testIdPrefix={testIdPrefix} title={title}>
        {children}
      </FilterSheet>
    </>
  );
};

export default FilterSheet;
