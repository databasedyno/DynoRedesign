export interface ProductRow {
  product_id: number;
  title: string;
  subtitle?: string | null;
  slug: string;
  status: "draft" | "live" | "archived";
  base_price_cents: number;
  currency: string;
  cover_image_url?: string;
  base_stock?: number | null;
  product_type?: "digital" | "physical" | "service" | string;
  has_variants?: boolean;
  category?: string | null;
  sold_count?: number;
  createdAt?: string;
}

export type ProductsView = "grid" | "list";

export const PRODUCTS_VIEW_KEY = "dynopay.products.view";

export const readProductsView = (): ProductsView => {
  if (typeof window === "undefined") return "list";
  return window.localStorage.getItem(PRODUCTS_VIEW_KEY) === "grid" ? "grid" : "list";
};
