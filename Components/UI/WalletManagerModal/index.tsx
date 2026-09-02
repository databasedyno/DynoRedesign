import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import CustomButton from "@/Components/UI/Buttons";
import OtpDialog from "@/Components/UI/OtpDialog";
import useIsMobile from "@/hooks/useIsMobile";
import type { ReusableCompany } from "@/hooks/useReusableWallets";
import { useWalletData } from "@/hooks/useWalletData";
import { useWalletStore } from "@/contexts/WalletDataContext";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { Icon } from "@/styles/uiKit";
import { compatibleCurrencies, detectAddressKind, isPlausibleAddress } from "@/utils/walletAddressType";
import { Box, CircularProgress, Dialog, IconButton, Slide, Typography, useTheme } from "@mui/material";
import type { TransitionProps } from "@mui/material/transitions";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { AddWalletCard } from "./AddWalletCard";
import { ExistingWalletRow } from "./ExistingWalletRow";
import { ManagerFooter } from "./ManagerFooter";
import { MissingNetworks } from "./MissingNetworks";
import { ReuseSection } from "./ReuseSection";
import { SectionLabel } from "./SectionLabel";
import { SessionStrip } from "./SessionStrip";
import { UnlockGate } from "./UnlockGate";
import { AddRow, EditState, OpMeta, OpResult, isTagChain, tone, uid } from "./types";
import { useSudoSession } from "./useSudoSession";

interface Props {
  open: boolean;
  onClose: () => void;
  companyId?: number | null;
}

const SlideLeft = React.forwardRef(function SlideLeft(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="left" ref={ref} {...props} />;
});

const WalletManagerModal: React.FC<Props> = ({ open, onClose, companyId }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const c = tone(dark);
  const border = theme.palette.border?.main || theme.palette.divider;
  const isMobile = useIsMobile("sm");
  const dispatch = useDispatch();
  const { t } = useTranslation("walletScreen");
  const tw = useCallback(
    (key: string, defaultValue: string, options?: any): string => {
      const r = t(key, { ns: "walletScreen", defaultValue, ...options });
      return typeof r === "string" ? r : String(r);
    },
    [t],
  );
  const toast = useCallback(
    (message: string, severity: "success" | "error" | "warning" = "success") =>
      dispatch({ type: TOAST_SHOW, payload: { message, severity, placement: "top-center" } }),
    [dispatch],
  );

  const { walletData, cryptocurrencies } = useWalletData();
  const walletStore = useWalletStore();
  const sudo = useSudoSession(open, tw, toast);

  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addRows, setAddRows] = useState<AddRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [opResults, setOpResults] = useState<OpResult[] | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const seededRef = useRef(false);

  const [reuseCompanies, setReuseCompanies] = useState<ReusableCompany[]>([]);
  const [reuseSel, setReuseSel] = useState<Record<string, boolean>>({});
  const [copyingFrom, setCopyingFrom] = useState<number | null>(null);

  const seedEdits = useCallback((list: typeof walletData) => {
    const next: Record<string, EditState> = {};
    for (const w of list) {
      next[String(w.id)] = { name: w.walletName || "", address: w.walletAddress || "", tag: w.destinationTag || "", remove: false };
    }
    setEdits(next);
  }, []);

  const fetchReuse = useCallback(async () => {
    if (!companyId) return;
    try {
      const res: any = await axiosBaseApi.get(API_ENDPOINTS.wallet.reusableWallets, { params: { exclude_company_id: companyId } });
      const list: ReusableCompany[] = res?.data?.data || [];
      setReuseCompanies(list);
      const sel: Record<string, boolean> = {};
      list.forEach((co) => co.wallets.forEach((w) => (sel[`${co.company_id}:${w.currency}`] = true)));
      setReuseSel(sel);
    } catch {
      setReuseCompanies([]);
    }
  }, [companyId]);

  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    setOpResults(null);
    setConfirmDiscard(false);
  }, [open]);

  useEffect(() => {
    if (open && sudo.active && !seededRef.current) {
      seedEdits(walletData);
      seededRef.current = true;
    }
  }, [open, sudo.active, walletData, seedEdits]);

  useEffect(() => {
    if (open && sudo.active) fetchReuse();
  }, [open, sudo.active, fetchReuse]);

  // ---- derived ----
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

  // ---- row handlers ----
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

  const resetRow = (w: (typeof walletData)[number]) =>
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

  // ---- save ----
  const handleSave = async () => {
    const { ops, meta } = buildOps();
    if (ops.length === 0) return;
    setSaving(true);
    setOpResults(null);
    try {
      const res: any = await axiosBaseApi.post(API_ENDPOINTS.wallet.batch, { company_id: companyId, operations: ops });
      const results: OpResult[] = res?.data?.data?.results || [];
      const failed = results.filter((r) => r.status === "error");
      await walletStore.refetchWallets();
      fetchReuse();
      seededRef.current = false;
      if (failed.length === 0) {
        toast(res?.data?.message || tw("saved", "Changes saved"));
        setAddRows([]);
        setExpanded(new Set());
        setOpResults(null);
      } else {
        const okAddKeys = new Set(results.filter((r) => r.status === "ok" && meta[r.index]?.origin === "add").map((r) => meta[r.index]?.addKey));
        setAddRows((rows) => rows.filter((r) => !okAddKeys.has(r.key)));
        setOpResults(results);
        setExpanded(new Set(failed.filter((r) => r.wallet_id).map((r) => String(r.wallet_id))));
        toast(res?.data?.message || tw("savedPartial", "Some changes couldn't be saved"), "warning");
      }
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (e?.response?.status === 403 && (code === "SUDO_REQUIRED" || code === "SUDO_EXPIRED")) {
        sudo.markExpired();
        toast(tw("sudoExpired", "Your session expired. Please verify again."), "warning");
      } else {
        toast(e?.response?.data?.message || tw("saveFailed", "Couldn't save changes"), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- reuse ----
  const toggleReuse = (cid: number, cur: string) => setReuseSel((prev) => ({ ...prev, [`${cid}:${cur}`]: !prev[`${cid}:${cur}`] }));
  const toggleReuseAll = (co: ReusableCompany, on: boolean) =>
    setReuseSel((prev) => {
      const next = { ...prev };
      co.wallets.forEach((w) => (next[`${co.company_id}:${w.currency}`] = on));
      return next;
    });

  const handleCopy = async (co: ReusableCompany) => {
    const currencies = co.wallets.map((w) => w.currency).filter((cur) => reuseSel[`${co.company_id}:${cur}`]);
    if (currencies.length === 0) return;
    setCopyingFrom(co.company_id);
    try {
      const res: any = await axiosBaseApi.post(API_ENDPOINTS.wallet.copyWalletAddresses, { source_company_id: co.company_id, target_company_id: companyId, currencies });
      toast(res?.data?.message || tw("copied", "Wallets copied"));
      await walletStore.refetchWallets();
      seededRef.current = false;
      await fetchReuse();
    } catch (e: any) {
      toast(e?.response?.data?.message || tw("copyFailed", "Couldn't copy wallets"), "error");
    } finally {
      setCopyingFrom(null);
    }
  };

  // ---- close / discard ----
  const resetAll = () => {
    setAddRows([]);
    setEdits({});
    setExpanded(new Set());
    setOpResults(null);
    setConfirmDiscard(false);
    seededRef.current = false;
  };
  const requestClose = () => {
    if (saving) return;
    if (pending > 0) {
      setConfirmDiscard(true);
      return;
    }
    resetAll();
    onClose();
  };
  const discardAndClose = () => {
    resetAll();
    onClose();
  };

  const errorFor = (walletId: string | number) => opResults?.find((r) => r.status === "error" && r.wallet_id === Number(walletId))?.message;
  const addErrorFor = (r: AddRow) => opResults?.find((x) => x.status === "error" && x.action === "add" && x.currency === r.currency)?.message;

  return (
    <>
      <Dialog
        open={open && !sudo.otpOpen}
        onClose={(_e, reason) => {
          if (reason === "backdropClick" || reason === "escapeKeyDown") requestClose();
        }}
        TransitionComponent={SlideLeft}
        keepMounted={false}
        disableEscapeKeyDown={saving}
        sx={{
          "& .MuiBackdrop-root": { backdropFilter: "blur(6px)", backgroundColor: "rgba(9,9,11,0.35)" },
          "& .MuiDialog-container": { justifyContent: "flex-end", alignItems: "stretch" },
          "& .MuiDialog-paper": {
            m: 0,
            width: "100%",
            maxWidth: { xs: "100%", md: 600 },
            height: "100%",
            maxHeight: "100%",
            borderRadius: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backgroundColor: theme.palette.background.paper,
            borderLeft: { md: `1px solid ${border}` },
            boxShadow: dark ? "-24px 0 60px rgba(0,0,0,0.55)" : "-24px 0 60px rgba(15,23,42,0.12)",
          },
        }}
      >
        <Box data-testid="wallet-manager-modal" sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 2, borderBottom: sudo.active ? "none" : `1px solid ${border}` }}>
            <Box>
              <Typography component="h2" sx={{ fontSize: { xs: 18, sm: 20 }, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: -0.3, lineHeight: 1.2 }}>
                {tw("managerTitle", "Manage wallets")}
              </Typography>
              <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", mt: 0.5 }}>
                {tw("managerSubtitle", "Add, edit or remove multiple payout wallets in one go.")}
              </Typography>
            </Box>
            <IconButton onClick={requestClose} aria-label={tw("close", "Close")} data-testid="wallet-manager-x-btn" size="small" sx={{ color: theme.palette.text.secondary, mt: -0.5, mr: -0.5 }}>
              <Icon name="x" size={18} />
            </IconButton>
          </Box>

          {sudo.checkingStatus ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress size={26} />
            </Box>
          ) : !sudo.active ? (
            <UnlockGate requesting={sudo.requesting} onRequest={sudo.requestOtp} onCancel={requestClose} walletCount={walletData.length} tw={tw} />
          ) : (
            <>
              <SessionStrip remaining={sudo.remaining} totalSecs={sudo.totalSecs} lowTime={sudo.lowTime} onLock={sudo.lockNow} tw={tw} />

              {/* Scroll body */}
              <Box data-testid="wallet-manager-body" sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, sm: 3 }, py: 2.5, display: "flex", flexDirection: "column", gap: 3.5 }}>
                {walletData.length > 0 && (
                  <Box>
                    <SectionLabel label={tw("yourWallets", "Your wallets")} count={walletData.length} hint={tw("tapToEdit", "Tap a row to edit")} />
                    <Box sx={{ border: `1px solid ${border}`, borderRadius: "8px", overflow: "hidden" }} data-testid="wallet-manager-existing-list">
                      {walletData.map((w) => (
                        <ExistingWalletRow
                          key={w.id}
                          wallet={w}
                          edit={edits[String(w.id)] || { name: w.walletName || "", address: w.walletAddress || "", tag: w.destinationTag || "", remove: false }}
                          expanded={expanded.has(String(w.id))}
                          error={errorFor(w.id)}
                          isMobile={isMobile}
                          onChange={(patch) => patchEdit(w.id, patch)}
                          onToggleExpand={() => toggleExpand(w.id)}
                          onReset={() => resetRow(w)}
                          tw={tw}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                <Box>
                  <SectionLabel
                    label={tw("addWallets", "Add wallets")}
                    count={addRows.length || undefined}
                    action={
                      <Box
                        component="button"
                        type="button"
                        onClick={() => addNewRow()}
                        disabled={missing.length === 0}
                        data-testid="wallet-manager-add-row-btn"
                        sx={{ all: "unset", cursor: missing.length ? "pointer" : "default", display: "flex", alignItems: "center", gap: 0.5, fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-sans)", color: missing.length ? c.indigo : theme.palette.text.disabled }}
                      >
                        <Icon name="plus" size={14} />
                        {tw("addAnotherNetwork", "Add another network")}
                      </Box>
                    }
                  />
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    <MissingNetworks missing={missing} onPick={pickMissing} tw={tw} />
                    {addRows.length === 0 && missing.length === 0 && (
                      <Box sx={{ p: 2, borderRadius: "8px", border: `1px dashed ${border}`, display: "flex", alignItems: "center", gap: 1.25 }} data-testid="wallet-manager-all-set">
                        <Icon name="circle-check" size={16} color={c.emerald} />
                        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                          {tw("allNetworksSet", "Every supported network already has a wallet on this brand.")}
                        </Typography>
                      </Box>
                    )}
                    {addRows.map((r, i) => (
                      <AddWalletCard
                        key={r.key}
                        row={r}
                        index={i}
                        usedCurrencies={usedCurrencies}
                        error={addErrorFor(r)}
                        onUpdate={(patch) => updateRow(r.key, patch)}
                        onRemove={() => removeRow(r.key)}
                        onSmartApply={applySmartPaste}
                        onDuplicate={() => addNewRow("", r.address)}
                        tw={tw}
                      />
                    ))}
                    {addRows.length > 0 && missing.length > 0 && (
                      <CustomButton
                        label={tw("addAnotherNetwork", "Add another network")}
                        variant="outlined"
                        onClick={() => addNewRow()}
                        startIcon={<Icon name="plus" size={16} />}
                        data-testid="wallet-manager-add-row-btn-bottom"
                        sx={{ alignSelf: "flex-start", height: 38 }}
                      />
                    )}
                  </Box>
                </Box>

                {reuseCompanies.length > 0 && (
                  <Box>
                    <SectionLabel label={tw("copyFromBrand", "Copy from another brand")} hint={tw("reuseNoCode", "Saved instantly · no code needed")} />
                    <ReuseSection companies={reuseCompanies} sel={reuseSel} copyingFrom={copyingFrom} onToggle={toggleReuse} onToggleAll={toggleReuseAll} onCopy={handleCopy} tw={tw} />
                  </Box>
                )}
              </Box>

              <ManagerFooter
                counts={counts}
                saving={saving}
                confirmDiscard={confirmDiscard}
                onClose={requestClose}
                onDiscardConfirm={discardAndClose}
                onKeepEditing={() => setConfirmDiscard(false)}
                onSave={handleSave}
                tw={tw}
              />
            </>
          )}
        </Box>
      </Dialog>

      <OtpDialog
        open={sudo.otpOpen}
        onClose={sudo.closeOtp}
        title={tw("emailVerification", "Email verification")}
        subtitle={tw("sudoOtpSubtitle", "Enter the code we emailed you to unlock wallet management.")}
        otpLength={6}
        onVerify={sudo.verifyOtp}
        onResendCode={sudo.requestOtp}
        loading={sudo.otpLoading}
        error={sudo.otpError}
        onClearError={sudo.clearOtpError}
        countdown={sudo.otpCountdown}
        preventClose={sudo.otpLoading}
      />
      {/* icon-bundle literals: <Icon name="x" /> <Icon name="plus" /> <Icon name="circle-check" /> */}
    </>
  );
};

export default WalletManagerModal;
