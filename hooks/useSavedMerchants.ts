import { useCallback, useEffect, useState } from "react";
import {
  SAVED_MERCHANTS_EVENT,
  SAVED_MERCHANTS_KEY,
  readSavedMerchants,
  removeSavedMerchant,
  saveMerchant,
  type SavedMerchant,
} from "@/helpers/savedMerchants";

// Client-only: returns [] until mounted so SSR and the first paint agree.
export default function useSavedMerchants() {
  const [items, setItems] = useState<SavedMerchant[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setItems(readSavedMerchants());
    sync();
    setHydrated(true);
    const onStorage = (e: StorageEvent) => { if (e.key === SAVED_MERCHANTS_KEY) sync(); };
    window.addEventListener(SAVED_MERCHANTS_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAVED_MERCHANTS_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isSaved = useCallback(
    (handle: string) => items.some((m) => m.handle === String(handle || "").trim().toLowerCase()),
    [items],
  );
  const save = useCallback((m: Omit<SavedMerchant, "savedAt">) => saveMerchant(m), []);
  const remove = useCallback((handle: string) => removeSavedMerchant(handle), []);

  return { items, hydrated, isSaved, save, remove };
}
