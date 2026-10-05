import { useCompanyStore } from "@/contexts/CompanyDataContext";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import DeleteWalletModal from "@/Components/UI/DeleteWalletModal";
import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import useIsMobile from "@/hooks/useIsMobile";
import { useWalletData } from "@/hooks/useWalletData";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useWalletStore } from "@/contexts/WalletDataContext";
import { WalletDataType } from "@/utils/types/wallet";
import { buildSharedAddressMap, normalizeAddress } from "@/utils/sharedAddresses";
import SharedHighlightBar from "./SharedHighlightBar";
import { Box, Skeleton } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import WalletTotalHero from "./WalletTotalHero";
import WalletReuseNudge from "./WalletReuseNudge";
import CoverageStrip from "./CoverageStrip";
import WalletSecurityStrip from "./WalletSecurityStrip";
import WalletList from "./WalletList";
import { useDashboardPayouts } from "@/Components/Page/Payouts/useDashboardPayouts";

const Wallet = ({ onAddWallet }: { onAddWallet?: (crypto?: string) => void }) => {
  const isMobile = useIsMobile("md");
  const dispatch = useDispatch();
  const { t } = useTranslation("walletScreen");
  const tWallet = useCallback(
    (key: string, options?: any): string => {
      const result = t(key, { ns: "walletScreen", ...options });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );

  const [openEditModal, setOpenEditModal] = useState(false);
  const [editWalletCrypto, setEditWalletCrypto] = useState("");
  const [editWalletId, setEditWalletId] = useState<string | number | undefined>(undefined);
  const [editWalletName, setEditWalletName] = useState("");
  const [editWalletAddress, setEditWalletAddress] = useState("");
  const [editDestinationTag, setEditDestinationTag] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string | number; type: string; address: string } | null>(null);
  // Addresses are masked by default (first 8 + last 6); reveal is per card, per visit.
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const isRevealed = (id: string | number) => revealed.has(String(id));
  const toggleReveal = (id: string | number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const { refetchWallets } = useWalletStore();

  const { walletLoading, walletData } = useWalletData();
  // Forwarding activity per wallet + accepted-coin coverage (same feed as the Payouts page).
  const payouts = useDashboardPayouts({ range: "30d", custom: null });
  const payoutByWalletId = useMemo(() => {
    const m = new Map<string, NonNullable<typeof payouts.data>["wallets"][number]>();
    for (const w of payouts.data?.wallets ?? []) m.set(String(w.wallet_id), w);
    return m;
  }, [payouts.data]);
  const missingCoins = payouts.data?.coverage?.missing_coins ?? [];
  const payoutsLoading = payouts.isLoading && !payouts.data;
  const paySym = payouts.data?.currency_symbol || "$";
  const payCur = payouts.data?.currency || "USD";
  // Shared-address tags: one address saved under several networks (plan backlog P2).
  const sharedMap = useMemo(() => buildSharedAddressMap(walletData), [walletData]);
  // Tap a tag → highlight every sibling card sharing that address, dim the rest.
  const [highlightAddr, setHighlightAddr] = useState<string | null>(null);
  const toggleHighlight = (w: WalletDataType) =>
    setHighlightAddr((prev) => {
      const key = normalizeAddress(w.walletAddress);
      return prev === key ? null : key;
    });
  const isHighlighted = (w: WalletDataType) => !!highlightAddr && normalizeAddress(w.walletAddress) === highlightAddr;
  const highlighted = useMemo(
    () => (highlightAddr ? walletData.filter((w) => normalizeAddress(w.walletAddress) === highlightAddr) : []),
    [walletData, highlightAddr],
  );
  useEffect(() => {
    if (highlightAddr && highlighted.length < 2) setHighlightAddr(null);
  }, [highlightAddr, highlighted.length]);
  useEffect(() => {
    if (!highlightAddr) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHighlightAddr(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [highlightAddr]);
  const jumpToCard = (id: string | number) =>
    document.getElementById(`wallet-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const handleEdit = (wallet: WalletDataType) => {
    setEditWalletCrypto(wallet.walletTitle);
    setEditWalletId(wallet.id);
    setEditWalletName(wallet.walletName || wallet.name);
    setEditWalletAddress(wallet.walletAddress);
    setEditDestinationTag(wallet.destinationTag || "");
    setOpenEditModal(true);
  };

  const handleDelete = (wallet: WalletDataType) => {
    setDeleteTarget({ id: wallet.id, type: wallet.walletTitle, address: wallet.walletAddress });
    setOpenDeleteModal(true);
  };

  const handleWalletDeleted = () => {
    dispatch({
      type: TOAST_SHOW,
      payload: { message: "Payout address removed", severity: "success" },
    });
    // Re-fetch wallets
    refetchWallets();
  };

  if (walletLoading && walletData.length === 0) {
    // Skeleton grid mirroring the wallet-card layout — shown on first load AND
    // the instant a merchant switches company (SWR key changes → cache miss),
    // so the refresh feels immediate instead of a blank spinner.
    return (
      <Box
        data-testid="wallet-list-skeleton"
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          mt: isMobile ? 1 : 0,
          pb: { xs: "70px", lg: "0" },
        }}
      >
        <Skeleton
          variant="rounded"
          height={isMobile ? 110 : 132}
          sx={{ borderRadius: "16px" }}
        />
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={isMobile ? 112 : 68} sx={{ borderRadius: i === 0 ? "16px 16px 0 0" : i === 4 ? "0 0 16px 16px" : 0 }} />
          ))}
        </Box>
      </Box>
    );
  }

  if (walletData.length === 0 && !walletLoading) {
    return (
      <>
        <CoverageStrip missing={missingCoins} onAdd={(c) => onAddWallet?.(c)} />
        {/* Wallets are per-account: if another account already has addresses,
            offer them here instead of making the merchant retype anything. */}
        <WalletReuseNudge onAddWallet={onAddWallet} />
        <EmptyDataModel pageName="wallet" onAddWallet={onAddWallet} />
      </>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        mt: isMobile ? 1 : 0,
        pb: { xs: "70px", lg: "0" },
      }}
    >
      {/* Aurora total-processed hero — 2026-08-05 design audit Phase 3.
          Only render when the user actually has wallets configured, so first-
          time visitors see the empty-state warning banner (already surfaced
          via setPageWarning) instead of an unhelpful "$0.00" hero. */}
      {/* Coverage FIRST: coins live links accept with nowhere to land. */}
      <CoverageStrip missing={missingCoins} onAdd={(c) => onAddWallet?.(c)} />
      {walletData.length > 0 && <WalletTotalHero />}
      <WalletSecurityStrip />
      <SharedHighlightBar wallets={highlighted} onJump={jumpToCard} onClear={() => setHighlightAddr(null)} />
      <WalletList
        wallets={walletData}
        isMobile={isMobile}
        sharedMap={sharedMap}
        isHighlighted={isHighlighted}
        highlightActive={!!highlightAddr}
        onToggleHighlight={toggleHighlight}
        isRevealed={isRevealed}
        onToggleReveal={toggleReveal}
        payoutFor={(id) => payoutByWalletId.get(String(id))}
        payoutsLoading={payoutsLoading}
        paySym={paySym}
        payCur={payCur}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onVerified={() => void refetchWallets()}
        onCopyFailed={() =>
          dispatch({
            type: TOAST_SHOW,
            payload: { message: tWallet("copyFailed", { defaultValue: "Couldn't copy — try again" }), severity: "error" },
          })
        }
      />

      <AddWalletModal
        open={openEditModal}
        currentCryptocurrency={editWalletCrypto}
        editMode={true}
        editWalletId={editWalletId != null ? Number(editWalletId) : undefined}
        editWalletName={editWalletName}
        editWalletAddress={editWalletAddress}
        editDestinationTag={editDestinationTag}
        onClose={() => {
          setOpenEditModal(false);
          setEditWalletCrypto("");
          setEditWalletId(undefined);
          setEditWalletName("");
          setEditWalletAddress("");
          setEditDestinationTag("");
        }}
      />

      <DeleteWalletModal
        open={openDeleteModal}
        onClose={() => {
          setOpenDeleteModal(false);
          setDeleteTarget(null);
        }}
        walletId={deleteTarget?.id != null ? Number(deleteTarget.id) : null}
        walletType={deleteTarget?.type ?? ""}
        walletAddress={deleteTarget?.address ?? ""}
        companyId={selectedCompanyId ?? undefined}
        onDeleted={handleWalletDeleted}
      />

      {/* Session 74 P1-4: mobile-only bottom spacer so the last wallet's
          action row and the "Add payout address" button clear the ~80px bottom-nav
          + 68px chat-FAB gutter. Desktop is 0-height (no impact). */}
      <Box
        data-testid="wallet-mobile-spacer"
        sx={{ height: { xs: 180, md: 0 }, flexShrink: 0 }}
      />
    </Box>
  );
};

export default Wallet;
