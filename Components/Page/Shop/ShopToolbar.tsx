/**
 * ShopToolbar — filter + sort strip for the storefront grid.
 *
 * Renders:
 *   • Product-type chips (All / Digital / Physical / Service) — only shows chips
 *     for types that actually have products.
 *   • Category chips (dynamic from products.category) — hidden when merchant
 *     hasn't categorized anything.
 *   • Sort dropdown (Featured / Best selling / Newest / Price ↑ / Price ↓)
 *   • Result count "N products"
 *
 * All controls are purely client-side — they update local component state
 * consumed by ShopClient's memoized `visible` list.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Stack,
  Typography,
  Select,
  MenuItem,
  FormControl,
  useTheme,
} from "@mui/material";
import type { SortKey, ShopProduct } from "./types";
import { SORT_LABELS, PRODUCT_TYPE_LABELS } from "./types";

const SORT_I18N: Record<SortKey, string> = {
  featured: "shop.sortFeatured",
  bestselling: "shop.sortBestselling",
  newest: "shop.sortNewest",
  price_asc: "shop.sortPriceAsc",
  price_desc: "shop.sortPriceDesc",
};

interface Props {
  products: ShopProduct[];
  activeType: string;
  onTypeChange: (type: string) => void;
  activeCategory: string | null;
  onCategoryChange: (cat: string | null) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  visibleCount: number;
}

export default function ShopToolbar({
  products,
  activeType,
  onTypeChange,
  activeCategory,
  onCategoryChange,
  sort,
  onSortChange,
  visibleCount,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("landing");

  // Derive available types (only show chip if merchant has any of that type)
  const availableTypes: string[] = React.useMemo(() => {
    const types = new Set<string>();
    products.forEach((p) => p.product_type && types.add(String(p.product_type).toLowerCase()));
    const order = ["digital", "physical", "service"];
    return ["all", ...order.filter((t) => types.has(t))];
  }, [products]);

  // Derive categories
  const categories: string[] = React.useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category && String(p.category).trim()) {
        cats.add(String(p.category).trim());
      }
    });
    return Array.from(cats).sort();
  }, [products]);

  const chipSx = (active: boolean) => ({
    fontWeight: active ? 700 : 500,
    bgcolor: active
      ? isDark
        ? "rgba(129,140,248,0.18)"
        : "rgba(79,70,229,0.10)"
      : isDark
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.04)",
    color: active
      ? isDark
        ? "#818CF8"
        : "#4F46E5"
      : isDark
        ? "rgba(255,255,255,0.85)"
        : "rgba(0,0,0,0.75)",
    border: `1px solid ${
      active
        ? isDark
          ? "rgba(129,140,248,0.35)"
          : "rgba(79,70,229,0.28)"
        : isDark
          ? "rgba(255,255,255,0.10)"
          : "rgba(0,0,0,0.08)"
    }`,
    borderRadius: 999,
    px: 0.5,
    "&:hover": {
      bgcolor: active
        ? isDark
          ? "rgba(129,140,248,0.26)"
          : "rgba(79,70,229,0.16)"
        : isDark
          ? "rgba(255,255,255,0.1)"
          : "rgba(0,0,0,0.07)",
    },
    transition: "all 0.15s ease",
  });

  return (
    <Box
      data-testid="shop-toolbar"
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        alignItems: { xs: "stretch", md: "center" },
        justifyContent: "space-between",
        gap: 2,
        mb: 3,
        pb: 2,
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
      }}
    >
      {/* LEFT: type chips + category chips */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexWrap: "wrap", gap: 1 }}
          data-testid="shop-toolbar-types"
        >
          {availableTypes.map((typeKey) => (
            <Chip
              key={typeKey}
              label={t(`shop.type${typeKey.charAt(0).toUpperCase()}${typeKey.slice(1)}`, { defaultValue: PRODUCT_TYPE_LABELS[typeKey] || typeKey })}
              size="small"
              onClick={() => onTypeChange(typeKey)}
              sx={chipSx(activeType === typeKey)}
              data-testid={`shop-type-chip-${typeKey}`}
            />
          ))}
        </Stack>

        {/* D8: category chips only add signal when there is more than one category */}
        {categories.length > 1 && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}
            data-testid="shop-toolbar-categories"
          >
            <Chip
              label={t("shop.allCategories", { defaultValue: "All categories" })}
              size="small"
              onClick={() => onCategoryChange(null)}
              sx={chipSx(activeCategory === null)}
              data-testid="shop-cat-chip-all"
            />
            {categories.map((c) => (
              <Chip
                key={c}
                label={c}
                size="small"
                onClick={() => onCategoryChange(c)}
                sx={chipSx(activeCategory === c)}
                data-testid={`shop-cat-chip-${c.toLowerCase().replace(/\s+/g, "-")}`}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* RIGHT: result count + sort */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", flexShrink: 0 }}
      >
        <Typography
          variant="body2"
          sx={{
            color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
          data-testid="shop-result-count"
        >
          {t(visibleCount === 1 ? "shop.resultOne" : "shop.resultOther", { count: visibleCount, defaultValue: `${visibleCount} ${visibleCount === 1 ? "result" : "results"}` })}
        </Typography>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            data-testid="shop-sort-select"
            inputProps={{ "aria-label": t("shop.sortLabel", { defaultValue: "Sort" }) }}
            renderValue={(v) => `${t("shop.sortLabel", { defaultValue: "Sort" })}: ${t(SORT_I18N[v as SortKey], { defaultValue: SORT_LABELS[v as SortKey] })}`}
            sx={{
              borderRadius: 2,
              fontWeight: 500,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.15)",
              },
            }}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <MenuItem key={k} value={k} data-testid={`shop-sort-option-${k}`}>
                {t(SORT_I18N[k], { defaultValue: SORT_LABELS[k] })}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Box>
  );
}
