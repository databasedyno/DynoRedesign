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
import { AddRow, OpResult, tone } from "./types";
import { useSudoSession } from "./useSudoSession";
import { useWalletStaging } from "./useWalletStaging";
import { SanityReviewDialog, SanityWarning } from "./SanityReviewDialog";
import { buildSharedAddressMap, sharedNetworksFor } from "@/utils/sharedAddresses";

interface Props {
  open: boolean;
  onClose: () => void;
  companyId?: number | null;
  /** Fires after a fully-successful save (used by onboarding to advance). */
  onSaved?: () => void;
  /** Optional node rendered above the title (e.g. onboarding step indicator). */
  headerExtra?: React.ReactNode;
}

const SlideLeft = React.forwardRef(function SlideLeft(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="left" ref={ref} {...props} />;
});

const WalletManagerModal: React.FC<Props> = ({ open, onClose, companyId, onSaved, headerExtra }) => {
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
  const sharedMap = useMemo(() => buildSharedAddressMap(walletData), [walletData]);
  const walletStore = useWalletStore();
  const sudo = useSudoSession(open, tw, toast);
  const st = useWalletStaging(walletData, cryptocurrencies, toast, tw);

  const [saving, setSaving] = useState(false);
  const [opResults, setOpResults] = useState<OpResult[] | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [sanityWarn, setSanityWarn] = useState<SanityWarning[] | null>(null);
  const [sanityChecking, setSanityChecking] = useState(false);
  const ackSanityRef = useRef(false);
  const seededRef = useRef(false);

  const [reuseCompanies, setReuseCompanies] = useState<ReusableCompany[]>([]);
  const [reuseSel, setReuseSel] = useState<Record<string, boolean>>({});
  const [copyingFrom, setCopyingFrom] = useState<number | null>(null);
  // Copy-from-another-brand persists INSTANTLY (no staged "pending" change), so
  // the footer's Save button stays disabled afterwards. Track how many wallets
  // were copied this session so the footer can show a clear "copied ✓ — Done"
  // state instead of a confusing "nothing to save".
  const [justCopied, setJustCopied] = useState(0);

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
    setSanityWarn(null);
    ackSanityRef.current = false;
  }, [open]);

  useEffect(() => {
    if (open && sudo.active && !seededRef.current) {
      st.seedEdits(walletData);
      seededRef.current = true;
    }
  }, [open, sudo.active, walletData, st.seedEdits]);

  useEffect(() => {
    if (open && sudo.active) fetchReuse();
  }, [open, sudo.active, fetchReuse]);

  // ---- save ----
  const runSanity = useCallback(
    async (ops: any[]): Promise<SanityWarning[]> => {
      const targets: { currency: string; address: string }[] = [];
      for (const op of ops) {
        if (op.action === "add" && op.wallet_address) {
          targets.push({ currency: op.currency, address: op.wallet_address });
        } else if (op.action === "edit" && op.wallet_address) {
          const w = walletData.find((x) => String(x.id) === String(op.wallet_id));
          if (w) targets.push({ currency: w.walletTitle, address: op.wallet_address });
        }
      }
      if (targets.length === 0) return [];
      const perTarget = await Promise.all(
        targets.map(async (target) => {
          try {
            const res: any = await axiosBaseApi.post(API_ENDPOINTS.wallet.addressSanity, target);
            const warns: any[] = res?.data?.data?.warnings || [];
            return warns.map((w) => ({ network: target.currency, message: w.message, severity: w.severity }));
          } catch {
            return [];
          }
        }),
      );
      return perTarget.flat();
    },
    [walletData],
  );

  const handleSave = async () => {
    const { ops, meta } = st.buildOps();
    if (ops.length === 0) return;
    // Soft, dismissible address sanity review (network-mismatch + never-received).
    if (!ackSanityRef.current) {
      setSanityChecking(true);
      const warns = await runSanity(ops);
      setSanityChecking(false);
      if (warns.length > 0) {
        setSanityWarn(warns);
        return;
      }
    }
    ackSanityRef.current = false;
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
        st.setAddRows([]);
        st.setExpanded(new Set());
        setOpResults(null);
        onSaved?.();
      } else {
        const okAddKeys = new Set(results.filter((r) => r.status === "ok" && meta[r.index]?.origin === "add").map((r) => meta[r.index]?.addKey));
        st.setAddRows((rows) => rows.filter((r) => !okAddKeys.has(r.key)));
        setOpResults(results);
        st.setExpanded(new Set(failed.filter((r) => r.wallet_id).map((r) => String(r.wallet_id))));
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
      setJustCopied((n) => n + currencies.length);
      await walletStore.refetchWallets();
      seededRef.current = false;
      await fetchReuse();
      // Copy is a real save — let the parent refresh its wallet views too.
      onSaved?.();
    } catch (e: any) {
      toast(e?.response?.data?.message || tw("copyFailed", "Couldn't copy wallets"), "error");
    } finally {
      setCopyingFrom(null);
    }
  };

  // ---- close / discard ----
  const resetAll = () => {
    st.setAddRows([]);
    st.setEdits({});
    st.setExpanded(new Set());
    setOpResults(null);
    setConfirmDiscard(false);
    setJustCopied(0);
    seededRef.current = false;
  };
  // Copy-only "Done": nothing is staged (copies already saved), so just refresh
  // the parent and close cleanly.
  const handleDone = () => {
    onSaved?.();
    resetAll();
    onClose();
  };
  const requestClose = () => {
    if (saving) return;
    if (st.pending > 0) {
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
              {headerExtra && <Box sx={{ mb: 1.25 }}>{headerExtra}</Box>}
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
                          edit={st.editFor(w)}
                          expanded={st.expanded.has(String(w.id))}
                          error={errorFor(w.id)}
                          isMobile={isMobile}
                          sharedWith={sharedNetworksFor(sharedMap, w)}
                          onChange={(patch) => st.patchEdit(w.id, patch)}
                          onToggleExpand={() => st.toggleExpand(w.id)}
                          onReset={() => st.resetRow(w)}
                          tw={tw}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                <Box>
                  <SectionLabel
                    label={tw("addWallets", "Add wallets")}
                    count={st.addRows.length || undefined}
                    action={
                      <Box
                        component="button"
                        type="button"
                        onClick={() => st.addNewRow()}
                        disabled={st.missing.length === 0}
                        data-testid="wallet-manager-add-row-btn"
                        sx={{ all: "unset", cursor: st.missing.length ? "pointer" : "default", display: "flex", alignItems: "center", gap: 0.5, fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-sans)", color: st.missing.length ? c.indigo : theme.palette.text.disabled }}
                      >
                        <Icon name="plus" size={14} />
                        {tw("addAnotherNetwork", "Add another network")}
                      </Box>
                    }
                  />
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    <MissingNetworks missing={st.missing} onPick={st.pickMissing} tw={tw} />
                    {st.addRows.length === 0 && st.missing.length === 0 && (
                      <Box sx={{ p: 2, borderRadius: "8px", border: `1px dashed ${border}`, display: "flex", alignItems: "center", gap: 1.25 }} data-testid="wallet-manager-all-set">
                        <Icon name="circle-check" size={16} color={c.emerald} />
                        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                          {tw("allNetworksSet", "Every supported network already has a wallet on this brand.")}
                        </Typography>
                      </Box>
                    )}
                    {st.addRows.map((r, i) => (
                      <AddWalletCard
                        key={r.key}
                        row={r}
                        index={i}
                        usedCurrencies={st.usedCurrencies}
                        error={addErrorFor(r)}
                        onUpdate={(patch) => st.updateRow(r.key, patch)}
                        onRemove={() => st.removeRow(r.key)}
                        onSmartApply={st.applySmartPaste}
                        onDuplicate={() => st.addNewRow("", r.address)}
                        tw={tw}
                      />
                    ))}
                    {st.addRows.length > 0 && st.missing.length > 0 && (
                      <CustomButton
                        label={tw("addAnotherNetwork", "Add another network")}
                        variant="outlined"
                        onClick={() => st.addNewRow()}
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
                counts={st.counts}
                justCopied={justCopied}
                saving={saving || sanityChecking}
                confirmDiscard={confirmDiscard}
                onClose={requestClose}
                onDiscardConfirm={discardAndClose}
                onKeepEditing={() => setConfirmDiscard(false)}
                onSave={handleSave}
                onDone={handleDone}
                tw={tw}
              />
            </>
          )}
        </Box>
      </Dialog>

      <SanityReviewDialog
        warnings={sanityWarn}
        onBack={() => setSanityWarn(null)}
        onProceed={() => {
          ackSanityRef.current = true;
          setSanityWarn(null);
          handleSave();
        }}
        tw={tw}
      />

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
      {/* icon-bundle literals: <Icon name="x" /> <Icon name="plus" /> <Icon name="circle-check" /> <Icon name="circle-alert" /> */}
    </>
  );
};

export default WalletManagerModal;
