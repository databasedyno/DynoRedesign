/**
 * CartContext — anonymous shopping cart, persisted per-merchant-handle in
 * localStorage. See PRODUCT_CATALOG_SPEC §6.3.
 *
 * Storage key: `dynopay_cart_v1` → shape `{ [handle]: { items: CartItem[], last_synced_at } }`
 *
 * Cart prices/stock are NEVER trusted from localStorage — the checkout
 * page always re-posts to `/api/cart` for authoritative pricing before
 * committing to `/api/checkout`.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  ReactNode,
} from "react";

const STORAGE_KEY = "dynopay_cart_v1";

export interface CartItem {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  added_at: number;
}

/**
 * IDs travel through the app as both numbers (backend normalized lines) and
 * strings (SSR JSON projections, e.g. product_id:"9"). Coerce to a number (or
 * null) so line-matching never fails on a string-vs-number `===` mismatch,
 * which silently broke qty +/- and remove in the cart.
 */
const nId = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const sameLine = (
  i: CartItem,
  productId: number | string | null,
  variantId: number | string | null
): boolean => nId(i.product_id) === nId(productId) && nId(i.variant_id) === nId(variantId);

type PerHandleState = { items: CartItem[]; last_synced_at?: number };
type StoreShape = { [handle: string]: PerHandleState };

function readStore(): StoreShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: StoreShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode — ignore */
  }
}

interface CartContextValue {
  getItems: (handle: string) => CartItem[];
  addItem: (handle: string, item: Omit<CartItem, "added_at">) => void;
  updateQuantity: (
    handle: string,
    productId: number,
    variantId: number | null,
    quantity: number
  ) => void;
  removeItem: (handle: string, productId: number, variantId: number | null) => void;
  clearCart: (handle: string) => void;
  /**
   * Replace this handle's items with the server-validated set. Used by the
   * cart surfaces to prune stale entries (deleted/unpublished products,
   * out-of-stock, invalid price) that the backend `/api/cart` drops from
   * `normalized`, and to clamp quantities (e.g. one-off services → 1). This
   * keeps the badge/count in sync with what actually renders + checks out.
   * No-op when the incoming set is identical to avoid render loops.
   */
  reconcile: (
    handle: string,
    validated: Array<{ product_id: number | string; variant_id?: number | string | null; quantity: number | string }>
  ) => void;
  totalCount: (handle: string) => number;
}

/** Order-independent signature of a cart line set, for cheap equality checks. */
function cartSig(items: Array<{ product_id: unknown; variant_id?: unknown; quantity: unknown }>): string {
  return JSON.stringify(
    items
      .map((i) => [nId(i.product_id), nId((i as any).variant_id ?? null), Math.floor(Number(i.quantity) || 0)])
      .sort((a, b) => (a[0]! - b[0]!) || ((a[1] ?? -1) - (b[1] ?? -1)))
  );
}

/** Build the reconciled item list from a server-validated set, preserving
 *  `added_at` from the matching existing line where possible. */
function buildReconciled(cur: CartItem[], validated: Array<{ product_id: number | string; variant_id?: number | string | null; quantity: number | string }>): CartItem[] {
  return validated
    .map((v) => {
      const pid = nId(v.product_id);
      const vid = nId(v.variant_id ?? null);
      const qty = Math.max(0, Math.floor(Number(v.quantity) || 0));
      if (pid == null || qty <= 0) return null;
      const existing = cur.find((i) => sameLine(i, pid, vid));
      return { product_id: pid, variant_id: vid, quantity: qty, added_at: existing?.added_at ?? Date.now() } as CartItem;
    })
    .filter((x): x is CartItem => x != null);
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<StoreShape>({});

  // Hydrate on mount
  useEffect(() => {
    setStore(readStore());
  }, []);

  // Persist on change
  useEffect(() => {
    writeStore(store);
  }, [store]);

  const getItems = useCallback(
    (handle: string): CartItem[] => store[handle]?.items || [],
    [store]
  );

  const addItem = useCallback(
    (handle: string, item: Omit<CartItem, "added_at">) => {
      setStore((prev) => {
        const cur = prev[handle]?.items || [];
        const idx = cur.findIndex((i) => sameLine(i, item.product_id, item.variant_id ?? null));
        let next: CartItem[];
        if (idx >= 0) {
          next = [...cur];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
        } else {
          next = [...cur, { ...item, product_id: nId(item.product_id) as number, variant_id: nId(item.variant_id ?? null), added_at: Date.now() }];
        }
        return { ...prev, [handle]: { items: next, last_synced_at: Date.now() } };
      });
    },
    []
  );

  const updateQuantity = useCallback(
    (
      handle: string,
      productId: number,
      variantId: number | null,
      quantity: number
    ) => {
      setStore((prev) => {
        const cur = prev[handle]?.items || [];
        const next = cur
          .map((i) =>
            sameLine(i, productId, variantId)
              ? { ...i, quantity: Math.max(0, Math.floor(quantity)) }
              : i
          )
          .filter((i) => i.quantity > 0);
        return { ...prev, [handle]: { items: next, last_synced_at: Date.now() } };
      });
    },
    []
  );

  const removeItem = useCallback(
    (handle: string, productId: number, variantId: number | null) => {
      setStore((prev) => {
        const cur = prev[handle]?.items || [];
        const next = cur.filter((i) => !sameLine(i, productId, variantId));
        return { ...prev, [handle]: { items: next, last_synced_at: Date.now() } };
      });
    },
    []
  );

  const clearCart = useCallback((handle: string) => {
    setStore((prev) => ({ ...prev, [handle]: { items: [], last_synced_at: Date.now() } }));
  }, []);

  const reconcile = useCallback(
    (
      handle: string,
      validated: Array<{ product_id: number | string; variant_id?: number | string | null; quantity: number | string }>
    ) => {
      setStore((prev) => {
        const cur = prev[handle]?.items || [];
        const next = buildReconciled(cur, validated);
        if (cartSig(cur) === cartSig(next)) return prev; // identical → avoid render loop
        return { ...prev, [handle]: { items: next, last_synced_at: Date.now() } };
      });
    },
    []
  );

  const totalCount = useCallback(
    (handle: string) =>
      (store[handle]?.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0),
    [store]
  );

  const value = useMemo(
    () => ({ getItems, addItem, updateQuantity, removeItem, clearCart, reconcile, totalCount }),
    [getItems, addItem, updateQuantity, removeItem, clearCart, reconcile, totalCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  // In pages that don't wrap with CartProvider, fall back to a local reader that
  // still hits localStorage — so the buyer surfaces work even when mounted
  // outside a provider (SSR/isolated pages).
  const ctx = useContext(CartContext);
  if (ctx) return ctx;

  return {
    getItems: (handle) => readStore()[handle]?.items || [],
    addItem: (handle, item) => {
      const s = readStore();
      const cur = s[handle]?.items || [];
      const idx = cur.findIndex((i) => sameLine(i, item.product_id, item.variant_id ?? null));
      const next: CartItem[] =
        idx >= 0
          ? cur.map((i, k) =>
              k === idx ? { ...i, quantity: i.quantity + item.quantity } : i
            )
          : [...cur, { ...item, product_id: nId(item.product_id) as number, variant_id: nId(item.variant_id ?? null), added_at: Date.now() }];
      writeStore({ ...s, [handle]: { items: next, last_synced_at: Date.now() } });
    },
    updateQuantity: (handle, pid, vid, qty) => {
      const s = readStore();
      const cur = s[handle]?.items || [];
      const next = cur
        .map((i) =>
          sameLine(i, pid, vid)
            ? { ...i, quantity: Math.max(0, Math.floor(qty)) }
            : i
        )
        .filter((i) => i.quantity > 0);
      writeStore({ ...s, [handle]: { items: next, last_synced_at: Date.now() } });
    },
    removeItem: (handle, pid, vid) => {
      const s = readStore();
      const cur = s[handle]?.items || [];
      const next = cur.filter((i) => !sameLine(i, pid, vid));
      writeStore({ ...s, [handle]: { items: next, last_synced_at: Date.now() } });
    },
    clearCart: (handle) => {
      const s = readStore();
      writeStore({ ...s, [handle]: { items: [], last_synced_at: Date.now() } });
    },
    reconcile: (handle, validated) => {
      const s = readStore();
      const cur = s[handle]?.items || [];
      const next = buildReconciled(cur, validated);
      if (cartSig(cur) === cartSig(next)) return; // identical → skip write
      writeStore({ ...s, [handle]: { items: next, last_synced_at: Date.now() } });
    },
    totalCount: (handle) =>
      (readStore()[handle]?.items || []).reduce(
        (s, i) => s + Number(i.quantity || 0),
        0
      ),
  };
}

export default CartContext;
