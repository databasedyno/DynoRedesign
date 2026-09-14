import { toFixedStr } from "@/utils/money";
/**
 * Shared types for the storefront components.
 */

export type ProductType = "digital" | "physical" | "service";
export type SortKey =
  | "featured"
  | "bestselling"
  | "newest"
  | "price_asc"
  | "price_desc";

export interface ShopMerchant {
  handle: string;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  /** Creator theme accent — keeps the shop avatar the same colour as /[handle]. */
  accent?: string | null;
}

export interface ShopProduct {
  product_id: number;
  product_type: ProductType | string;
  title: string;
  slug: string;
  subtitle?: string | null;
  description_md?: string | null;
  base_price_cents: number;
  currency: string;
  cover_image_url?: string | null;
  gallery_images?: Array<{ url: string; alt?: string }> | null;
  category?: string | null;
  has_variants?: boolean;
  base_stock?: number | null;
  sold_count?: number;
  service_duration_minutes?: number | null;
}

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  all: "All",
  digital: "Digital",
  physical: "Physical",
  service: "Service",
};

export const SORT_LABELS: Record<SortKey, string> = {
  featured: "Featured",
  bestselling: "Best selling",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

/** Platform floor: minimum store order total (matches tips / donations). */
export const MIN_ORDER_CENTS = 1000;

/** Format a price in minor units to a locale currency string (D11: locale-aware). */
export function formatPrice(cents: number, ccy: string, locale?: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat(locale || "en-US", {
      style: "currency",
      currency: (ccy || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${toFixedStr(n, 2)} ${ccy}`;
  }
}
