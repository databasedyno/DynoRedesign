import { useCallback, useMemo, useState } from "react";
import type { Cryptocurrency, WalletDataType } from "@/utils/types/wallet";
import { compatibleCurrencies, detectAddressKind, isPlausibleAddress } from "@/utils/walletAddressType";
import { AddRow, EditState, OpMeta, Tw, isTagChain, uid } from "./types";

type Toast = (message: string, severity?: "success" | "error" | "warning") => void;

/** Staged (unsaved) wallet edits / removals / additions + derived counts and the batch op builder. */
export const useWalletStaging = (walletData: WalletDataType[], cryptocurrencies: Cryptocurrency[], toast: Toast, tw: Tw) => {
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addRows, setAddRows] = useState<AddRow[]>([]);

  const seedEdits = useCallback((list: WalletDataType[]) => {
    const next: Record<string, EditState> = {};
    for (const w of list) {
      next[String(w.id)] = { name: w.walletName || "", address: w.walletAddress || "", tag: w.destinationTag || "", remove: false };
    }
    setEdits(next);
  }, []);

  const usedCurrencies = useMemo(() => {
    const set = new Set<string>();
    walletData.forEach((w) => {
      if (!edits[String(w.id)]?.remove) set.add(w.walletTitle);
    });
    addRows.forEach((r) => r.currency && set.add(r.currency));
    return set;
  }, [walletData, edits, addRows]);

  const missing = useMemo(() => cryptocurrencies.filter((cc) => !usedCurrencies.has(cc.code)), [cryptocurrencies, usedCurrencies]);

  const buildOps = useCallback((): { ops: any[]; meta: OpMeta[] } => {
    const ops: any[] = [];
    const meta: OpMeta[] = [];
    for (const w of walletData) {
      const e = edits[String(w.id)];
      if (!e) continue;
      if (e.remove) {
        ops.push({ action: "delete", wallet_id: w.id });
        meta.push({ origin: "existing", walletId: w.id });
        continue;
      }
      const addrChanged = e.address.trim() !== (w.walletAddress || "");
      const nameChanged = e.name.trim() !== (w.walletName || "");
      const tagChanged = isTagChain(w.walletTitle) && e.tag.trim() !== (w.destinationTag || "");
      if (addrChanged || nameChanged || tagChanged) {
        const op: any = { action: "edit", wallet_id: w.id };
        if (addrChanged) op.wallet_address = e.address.trim();
        if (nameChanged) op.wallet_name = e.name.trim();
        if (tagChanged) op.destination_tag = e.tag.trim() || null;
        ops.push(op);
        meta.push({ origin: "existing", walletId: w.id });
      }
    }
    for (const r of addRows) {
      if (r.currency && r.address.trim()) {
        const op: any = { action: "add", currency: r.currency, wallet_address: r.address.trim(), wallet_name: r.name.trim() };
        if (isTagChain(r.currency) && r.tag.trim()) op.destination_tag = r.tag.trim();
        ops.push(op);
        meta.push({ origin: "add", addKey: r.key });
      }
    }
    return { ops, meta };
  }, [walletData, edits, addRows]);

  const counts = useMemo(() => {
    let edited = 0, removals = 0, invalid = 0;
    for (const w of walletData) {
      const e = edits[String(w.id)];
      if (!e) continue;
      if (e.remove) { removals += 1; continue; }
      const addrChanged = e.address.trim() !== (w.walletAddress || "");
      const changed = addrChanged || e.name.trim() !== (w.walletName || "") || (isTagChain(w.walletTitle) && e.tag.trim() !== (w.destinationTag || ""));
      if (changed) edited += 1;
      if (addrChanged && e.address.trim() && !isPlausibleAddress(e.address, w.walletTitle)) invalid += 1;
    }
    let adds = 0, drafts = 0;
    for (const r of addRows) {
      if (r.currency && r.address.trim()) {
        adds += 1;
        if (!isPlausibleAddress(r.address, r.currency)) invalid += 1;
      } else drafts += 1;
    }
    return { edits: edited, removals, adds, invalid, drafts };
  }, [walletData, edits, addRows]);
  const pending = counts.edits + counts.removals + counts.adds;

  const patchEdit = (id: string | number, patch: Partial<EditState>) =>
    setEdits((prev) => ({ ...prev, [String(id)]: { ...prev[String(id)], ...patch } }));

  const toggleExpand = (id: string | number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      const k = String(id);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const resetRow = (w: WalletDataType) =>
    patchEdit(w.id, { name: w.walletName || "", address: w.walletAddress || "", tag: w.destinationTag || "", remove: false });

  const addNewRow = (currency = "", address = "") =>
    setAddRows((rows) => [...rows, { key: uid(), currency, address, name: "", tag: "" }]);

  const updateRow = (key: string, patch: Partial<AddRow>) => setAddRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setAddRows((rows) => rows.filter((r) => r.key !== key));

  const pickMissing = (code: string) => {
    const blank = addRows.find((r) => !r.currency && !r.address.trim());
    if (blank) updateRow(blank.key, { currency: code });
    else addNewRow(code);
  };

  const applySmartPaste = (address: string) => {
    const compatible = compatibleCurrencies(detectAddressKind(address)).filter((cur) => !usedCurrencies.has(cur));
    if (compatible.length === 0) {
      toast(tw("smartPasteNone", "All compatible networks already have this address"), "warning");
      return;
    }
    setAddRows((rows) => [...rows, ...compatible.map((cur) => ({ key: uid(), currency: cur, address: address.trim(), name: "", tag: "" }))]);
    toast(tw("smartPasteApplied", "Added {{n}} networks with this address", { n: compatible.length }));
  };

  const editFor = (w: WalletDataType): EditState =>
    edits[String(w.id)] || { name: w.walletName || "", address: w.walletAddress || "", tag: w.destinationTag || "", remove: false };

  return {
    edits, setEdits, expanded, setExpanded, addRows, setAddRows, seedEdits,
    usedCurrencies, missing, buildOps, counts, pending,
    patchEdit, toggleExpand, resetRow, addNewRow, updateRow, removeRow, pickMissing, applySmartPaste, editFor,
  };
};
