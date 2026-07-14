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
  totalCount: (handle: string) => number;
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
        const idx = cur.findIndex(
          (i) =>
            i.product_id === item.product_id &&
            (i.variant_id || null) === (item.variant_id || null)
        );
        let next: CartItem[];
        if (idx >= 0) {
          next = [...cur];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
        } else {
          next = [...cur, { ...item, added_at: Date.now() }];
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
            i.product_id === productId &&
            (i.variant_id || null) === (variantId || null)
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
        const next = cur.filter(
          (i) =>
            !(
              i.product_id === productId &&
              (i.variant_id || null) === (variantId || null)
            )
        );
        return { ...prev, [handle]: { items: next, last_synced_at: Date.now() } };
      });
    },
    []
  );

  const clearCart = useCallback((handle: string) => {
    setStore((prev) => ({ ...prev, [handle]: { items: [], last_synced_at: Date.now() } }));
  }, []);

  const totalCount = useCallback(
    (handle: string) =>
      (store[handle]?.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0),
    [store]
  );

  const value = useMemo(
    () => ({ getItems, addItem, updateQuantity, removeItem, clearCart, totalCount }),
    [getItems, addItem, updateQuantity, removeItem, clearCart, totalCount]
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
      const idx = cur.findIndex(
        (i) =>
          i.product_id === item.product_id &&
          (i.variant_id || null) === (item.variant_id || null)
      );
      const next: CartItem[] =
        idx >= 0
          ? cur.map((i, k) =>
              k === idx ? { ...i, quantity: i.quantity + item.quantity } : i
            )
          : [...cur, { ...item, added_at: Date.now() }];
      writeStore({ ...s, [handle]: { items: next, last_synced_at: Date.now() } });
    },
    updateQuantity: (handle, pid, vid, qty) => {
      const s = readStore();
      const cur = s[handle]?.items || [];
      const next = cur
        .map((i) =>
          i.product_id === pid && (i.variant_id || null) === (vid || null)
            ? { ...i, quantity: Math.max(0, Math.floor(qty)) }
            : i
        )
        .filter((i) => i.quantity > 0);
      writeStore({ ...s, [handle]: { items: next, last_synced_at: Date.now() } });
    },
    removeItem: (handle, pid, vid) => {
      const s = readStore();
      const cur = s[handle]?.items || [];
      const next = cur.filter(
        (i) => !(i.product_id === pid && (i.variant_id || null) === (vid || null))
      );
      writeStore({ ...s, [handle]: { items: next, last_synced_at: Date.now() } });
    },
    clearCart: (handle) => {
      const s = readStore();
      writeStore({ ...s, [handle]: { items: [], last_synced_at: Date.now() } });
    },
    totalCount: (handle) =>
      (readStore()[handle]?.items || []).reduce(
        (s, i) => s + Number(i.quantity || 0),
        0
      ),
  };
}

export default CartContext;
