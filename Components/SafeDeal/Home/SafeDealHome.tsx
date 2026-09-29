import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Alert, Box, Button, Container, Skeleton, Snackbar, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { motion, useReducedMotion } from "framer-motion";
import safedealApi, { SdAddress, SdDeal, SdStatementRow, SdTopup, SdWallet, isPlaceholderSdEmail, sdError } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { useRequireSdSession, useSdHref } from "../sdRouting";
import { useNow } from "../sdFormat";
import { SD_GOLD, SD_GOLD_DARK, SD_GOLD_DEEP, SD_INK, SD_BORDER, SD_TEXT_MUTED, SD_NOTE_BG, SD_NOTE_FG, SD_NOTE_BORDER, SD_PAGE, goldAlpha } from "../sdTheme";
import { StepUpDialog } from "../StepUpDialog";
import TopUpDialog from "../TopUpDialog";
import AddEmailDialog from "../AddEmailDialog";
import BalanceStrip from "./BalanceStrip";
import DealProgressCard, { isClosedDeal } from "./DealProgressCard";
import ActivityFeed from "./ActivityFeed";
import DealsSection, { sortDeals, yourMove } from "./DealsSection";
import DocumentsList from "./DocumentsList";
import CashoutsList from "./CashoutsList";
import PayoutSettings from "./PayoutSettings";
import TelegramAlertsCard from "./TelegramAlertsCard";
import { AddAddressDialog, WithdrawDialog, shortAddr } from "./WalletDialogs";

export type HomeTab = "overview" | "deals" | "activity" | "documents";
const TABS: Array<{ key: HomeTab; label: string; icon: string }> = [
  { key: "overview", label: "Overview", icon: "mdi:view-dashboard-outline" },
  { key: "deals", label: "Deals", icon: "mdi:handshake-outline" },
  { key: "activity", label: "Activity", icon: "mdi:timeline-text-outline" },
  { key: "documents", label: "Documents", icon: "mdi:file-document-multiple-outline" },
];
const isTab = (v: unknown): v is HomeTab => typeof v === "string" && TABS.some((t) => t.key === v);

type Dialog = null | "address" | "withdraw" | "topup" | { remove: SdAddress } | { resume: SdTopup };

function TabBar({ tab, onChange, badge }: { tab: HomeTab; onChange: (t: HomeTab) => void; badge: number }) {
  return (
    <Box role="tablist" aria-label="SafeDeal home" data-testid="sd-home-tabs" sx={{ display: "inline-flex", gap: 0.4, p: 0.5, borderRadius: 99, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, maxWidth: "100%", overflowX: "auto" }}>
      {TABS.map((t) => {
        const on = t.key === tab;
        return (
          <Box key={t.key} component="button" type="button" role="tab" aria-selected={on} aria-controls={`sd-home-panel-${t.key}`} data-testid={`sd-home-tab-${t.key}`} onClick={() => onChange(t.key)}
            sx={{ border: 0, cursor: "pointer", borderRadius: 99, py: 0.85, px: { xs: 1.3, sm: 1.8 }, minHeight: { xs: 40, sm: 34 }, display: "flex", alignItems: "center", gap: 0.7, fontWeight: 800, fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0, "& svg": { display: { xs: "none", sm: "block" } }, color: on ? SD_INK : SD_TEXT_MUTED, backgroundColor: on ? SD_GOLD : "transparent", transition: "background-color .18s, color .18s", "&:hover": { color: SD_INK, backgroundColor: on ? SD_GOLD : SD_PAGE } }}>
            <Icon icon={t.icon} width={16} aria-hidden />
            {t.label}
            {t.key === "deals" && badge > 0 && <Box component="span" data-testid="sd-home-your-move-count" sx={{ ml: 0.3, minWidth: 18, height: 18, px: 0.5, borderRadius: 99, fontSize: 10.5, fontWeight: 900, display: "grid", placeItems: "center", backgroundColor: on ? SD_INK : SD_GOLD, color: on ? SD_GOLD : SD_INK }}>{badge}</Box>}
          </Box>
        );
      })}
    </Box>
  );
}

function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-end" spacing={1} sx={{ mb: 1.5 }}>
      <Box>
        <Typography component="h2" sx={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.3 }}>{title}</Typography>
        {sub && <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED }}>{sub}</Typography>}
      </Box>
      {action}
    </Stack>
  );
}

const seeAllBtn = { textTransform: "none", fontWeight: 800, color: SD_GOLD_DEEP, borderRadius: 99, whiteSpace: "nowrap" } as const;

/** Signed-in SafeDeal home: balances, deals in progress, activity feed and documents — one place, four tabs. */
export default function SafeDealHome({ initialTab = "overview" }: { initialTab?: HomeTab }) {
  const { user, ready } = useRequireSdSession();
  const href = useSdHref();
  const router = useRouter();
  const reduce = useReducedMotion();
  const now = useNow(30000);
  const [tab, setTab] = useState<HomeTab>(initialTab);
  const [w, setW] = useState<SdWallet | null>(null);
  const [rows, setRows] = useState<SdStatementRow[] | null>(null);
  const [deals, setDeals] = useState<SdDeal[] | null>(null);
  const [dealsError, setDealsError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [toast, setToast] = useState<{ msg: string; severity: "success" | "error" } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [addEmailOpen, setAddEmailOpen] = useState(false);
  const notify = useCallback((msg: string, severity: "success" | "error" = "success") => setToast({ msg, severity }), []);

  useEffect(() => {
    if (router.isReady && isTab(router.query.tab)) setTab(router.query.tab);
  }, [router.isReady, router.query.tab]);

  const changeTab = (t: HomeTab) => {
    setTab(t);
    void router.replace({ pathname: router.pathname, query: { ...router.query, tab: t } }, undefined, { shallow: true, scroll: false });
  };

  const load = useCallback(async () => {
    const range = { from: from || undefined, to: to ? `${to}T23:59:59` : undefined };
    const [wallet, st, list] = await Promise.allSettled([safedealApi.wallet(), safedealApi.statement({ ...range, limit: 500 }), safedealApi.listDeals()]);
    if (wallet.status === "fulfilled") setW(wallet.value); else notify(sdError(wallet.reason), "error");
    if (st.status === "fulfilled") setRows(st.value.entries); else notify(sdError(st.reason), "error");
    if (list.status === "fulfilled") { setDeals(list.value); setDealsError(null); } else setDealsError(sdError(list.reason));
  }, [from, to, notify]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const exportCsv = async () => {
    try {
      const blob = await safedealApi.downloadStatementCsv({ from: from || undefined, to: to ? `${to}T23:59:59` : undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `safedeal-statement-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notify(sdError(e), "error");
    }
  };

  const toggleAutoWithdraw = async (on: boolean) => {
    if (!w) return;
    const addr = w.profile.auto_withdraw_address_id || w.addresses[0]?.address_id;
    if (on && !addr) return notify("Save a payout address first.", "error");
    try {
      await safedealApi.updateProfile({ auto_withdraw: on, auto_withdraw_address_id: on ? addr : null });
      notify(on ? "Auto-cashout is on — future releases and refunds are sent straight to your saved address." : "Auto-cashout is off — released funds stay in your balance until you cash out.");
      await load();
    } catch (e) {
      notify(sdError(e), "error");
    }
  };

  const setAutoAddress = async (id: number) => {
    try {
      await safedealApi.updateProfile({ auto_withdraw: true, auto_withdraw_address_id: id });
      await load();
    } catch (e) {
      notify(sdError(e), "error");
    }
  };

  const open = useMemo(() => sortDeals((deals || []).filter((d) => !isClosedDeal(d))), [deals]);
  const moveCount = useMemo(() => open.filter(yourMove).length, [open]);
  const featured = useMemo(() => (moveCount > 0 ? open.filter(yourMove) : open).slice(0, 4), [open, moveCount]);
  const paidOut = useMemo(() => (w?.withdrawals || []).filter((x) => x.status === "sent").reduce((s, x) => s + Number(x.net_usd || 0), 0), [w]);
  const inEscrowDeals = useMemo(() => open.filter((d) => ["funded", "delivered", "disputed"].includes(d.status)).length, [open]);
  const openTopup = (w?.topups || []).find((t) => ["waiting", "pending", "underpaid"].includes(t.status)) || null;

  if (!ready) return null;

  const firstName = (user?.display_name || "").trim().split(/\s+/)[0];
  const panel = (key: HomeTab, children: React.ReactNode) => {
    const a11y = { id: `sd-home-panel-${key}`, role: "tabpanel", "data-testid": `sd-home-panel-${key}` };
    if (reduce) return <div key={key} {...a11y}>{children}</div>;
    return <motion.div key={key} {...a11y} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>{children}</motion.div>;
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4.5 } }} data-testid="sd-home" data-tab={tab}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "flex-end" }} spacing={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: SD_GOLD_DEEP }}>SafeDeal</Typography>
          <Typography component="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 900, letterSpacing: -1, lineHeight: 1.05 }} data-testid="sd-home-greeting">
            {firstName ? `Hi ${firstName}` : "Your deals & money"}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: SD_TEXT_MUTED, mt: 0.4 }} data-testid="sd-home-user">
            {user?.email && !isPlaceholderSdEmail(user.email) ? (
              <>
                {user.email}
                <Box component="button" type="button" onClick={() => setAddEmailOpen(true)} data-testid="sd-change-email"
                  sx={{ ml: 1, p: 0, border: 0, background: "none", cursor: "pointer", font: "inherit", fontWeight: 800, color: SD_GOLD_DEEP, textDecoration: "underline" }}>
                  Change
                </Box>
              </>
            ) : "Signed in with Telegram"}
            {" · shown in USD, held as USDT"}
          </Typography>
        </Box>
        <Link href={href("/deals/new")} data-testid="sd-new-deal" style={{ textDecoration: "none" }}>
          <Button variant="contained" startIcon={<Icon icon="mdi:plus" />} sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, px: 2.6, py: 1.1, color: SD_INK, backgroundColor: SD_GOLD, boxShadow: `0 10px 24px ${goldAlpha(0.3)}`, "&:hover": { backgroundColor: SD_GOLD_DARK } }}>
            New deal
          </Button>
        </Link>
      </Stack>

      <Box sx={{ mb: 3 }}><TabBar tab={tab} onChange={changeTab} badge={moveCount} /></Box>

      {user && isPlaceholderSdEmail(user.email) && (
        <Box sx={{ mb: 2.5, p: { xs: 1.8, sm: 2 }, borderRadius: 3, backgroundColor: SD_NOTE_BG, border: `1px solid ${SD_NOTE_BORDER}`, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }} data-testid="sd-add-email-banner">
          <Icon icon="mdi:email-plus-outline" width={26} color={SD_GOLD_DARK} aria-hidden />
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14.5 }}>Add an email to your account</Typography>
            <Typography sx={{ fontSize: 13, color: SD_NOTE_FG }}>You signed in with Telegram. Add an email so others can invite you to deals, and so you can sign in by email too.</Typography>
          </Box>
          <Button variant="contained" onClick={() => setAddEmailOpen(true)} data-testid="sd-banner-add-email" startIcon={<Icon icon="mdi:plus" />} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK }, flexShrink: 0 }}>Add email</Button>
        </Box>
      )}

      {tab === "overview" && panel("overview",
        <Stack spacing={3.5}>
          {!w ? <Skeleton variant="rounded" height={160} /> : (
            <BalanceStrip available={w.wallet.available} held={w.wallet.held} paidOut={paidOut} inEscrowDeals={inEscrowDeals} minWithdraw={w.limits.min_withdrawal_usd} minTopup={w.limits.min_topup_usd} approvalThreshold={w.limits.approval_threshold_usd} onTopUp={() => setDialog("topup")} onCashOut={() => setDialog("withdraw")} />
          )}
          {w && (openTopup || (w.profile.parked_payout_usd || 0) > 0 || (w.profile.deposit_reserved_usd || 0) > 0) && (
            <Stack spacing={1.2}>
              {openTopup && (
                <Alert severity="info" icon={<Icon icon="mdi:qrcode-scan" />} sx={{ borderRadius: 3 }} data-testid="sd-topup-open-banner"
                  action={<Button size="small" onClick={() => setDialog({ resume: openTopup })} data-testid="sd-topup-resume" sx={{ textTransform: "none", fontWeight: 800 }}>Show address</Button>}>
                  Top-up of <b>{money(Number(openTopup.amount_usd))}</b> in {openTopup.coin} is {openTopup.status === "pending" ? "confirming" : "waiting for your transfer"}.
                </Alert>
              )}
              {(w.profile.parked_payout_usd || 0) > 0 && (
                <Alert severity="info" icon={<Icon icon="mdi:clock-fast" />} sx={{ borderRadius: 3 }} data-testid="sd-parked-payout">
                  <b>{money(w.profile.parked_payout_usd || 0)}</b> from a closed deal is waiting to be paid out.{" "}
                  {w.addresses.length === 0 ? "Add a payout address and it's sent automatically — the network fee is already covered." : "It goes out automatically to your payout address — the network fee is already covered."}
                </Alert>
              )}
              {(w.profile.deposit_reserved_usd || 0) > 0 && (
                <Alert severity="success" icon={<Icon icon="mdi:shield-check-outline" />} sx={{ borderRadius: 3 }} data-testid="sd-deposit-reserved">
                  <b>{money(w.profile.deposit_reserved_usd || 0)}</b> of your balance is kept for funding deals — it won&apos;t be auto-cashed-out. Cash it out any time yourself.
                </Alert>
              )}
            </Stack>
          )}

          <Box data-testid="sd-home-deals">
            <SectionTitle
              title={moveCount > 0 ? `Your move · ${moveCount}` : open.length > 0 ? "Deals in progress" : "Deals"}
              sub={moveCount > 0 ? "These deals are waiting on you." : open.length > 0 ? "Waiting on the other side or on the clock." : undefined}
              action={deals && deals.length > 0 ? <Button size="small" onClick={() => changeTab("deals")} data-testid="sd-home-see-deals" endIcon={<Icon icon="mdi:arrow-right" width={16} />} sx={seeAllBtn}>All deals · {deals.length}</Button> : undefined}
            />
            {!deals && !dealsError ? (
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>{[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={150} />)}</Box>
            ) : dealsError ? (
              <Typography color="error" data-testid="sd-deals-error">{dealsError}</Typography>
            ) : featured.length === 0 ? (
              <Box data-testid="sd-home-deals-empty" sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, backgroundColor: SD_INK, color: "#fff", display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap", position: "relative", overflow: "hidden" }}>
                <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(420px 220px at 100% 0%, ${goldAlpha(0.22)}, transparent 70%)` }} />
                <Box sx={{ position: "relative", flex: 1, minWidth: 220 }}>
                  <Typography sx={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.4 }}>{deals && deals.length > 0 ? "Nothing open right now" : "Start your first deal"}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.72)", mt: 0.5 }}>Name it, set the price, invite the other side by email or link — they don&apos;t need an account.</Typography>
                </Box>
                <Link href={href("/deals/new")} style={{ textDecoration: "none", position: "relative" }} data-testid="sd-home-start-deal">
                  <Button variant="contained" endIcon={<Icon icon="mdi:arrow-right" />} sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, px: 2.6, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } }}>New deal</Button>
                </Link>
              </Box>
            ) : (
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
                {featured.map((d) => <DealProgressCard key={d.escrow_id} deal={d} href={href(`/deal/${d.deal_token}`)} now={now} />)}
              </Box>
            )}
          </Box>

          <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, alignItems: "start" }}>
            <ActivityFeed rows={rows} from={from} to={to} onRange={(f, t) => { setFrom(f); setTo(t); }} onCsv={() => void exportCsv()} compact={6} onSeeAll={() => changeTab("activity")} />
            <Stack spacing={2.5}>
              {w ? <PayoutSettings wallet={w} onAdd={() => setDialog("address")} onRemove={(a) => setDialog({ remove: a })} onToggleAuto={(on) => void toggleAutoWithdraw(on)} onAutoAddress={(id) => void setAutoAddress(id)} onVerified={() => void load()} /> : <Skeleton variant="rounded" height={200} />}
              <TelegramAlertsCard notify={notify} />
            </Stack>
          </Box>
        </Stack>
      )}

      {tab === "deals" && panel("deals", <DealsSection deals={deals} error={dealsError} href={href} now={now} />)}

      {tab === "activity" && panel("activity",
        <Stack spacing={2.5}>
          <ActivityFeed rows={rows} from={from} to={to} onRange={(f, t) => { setFrom(f); setTo(t); }} onCsv={() => void exportCsv()} />
          {w && <CashoutsList withdrawals={w.withdrawals} now={now} />}
        </Stack>
      )}

      {tab === "documents" && panel("documents", <DocumentsList now={now} dealHref={(t) => href(`/deal/${t}`)} notify={notify} />)}

      {w && dialog === "address" && <AddAddressDialog wallet={w} onClose={() => setDialog(null)} onDone={async (m) => { notify(m); setDialog(null); await load(); }} onError={(m) => notify(m, "error")} />}
      {w && dialog === "withdraw" && <WithdrawDialog wallet={w} onClose={() => setDialog(null)} onDone={async (m) => { notify(m); setDialog(null); await load(); }} onError={(m) => notify(m, "error")} />}
      {w && dialog === "topup" && <TopUpDialog wallet={w} onClose={async () => { setDialog(null); await load(); }} onCredited={async (m) => { notify(m); await load(); }} notify={notify} />}
      {w && dialog && typeof dialog === "object" && "resume" in dialog && (
        <TopUpDialog wallet={w} resume={dialog.resume} onClose={async () => { setDialog(null); await load(); }} onCredited={async (m) => { notify(m); await load(); }} notify={notify} />
      )}
      {dialog && typeof dialog === "object" && "remove" in dialog && (
        <StepUpDialog
          title="Remove this payout address?"
          body={`${dialog.remove.label || dialog.remove.coin} · ${shortAddr(dialog.remove.address)} will be removed. Confirm with a fresh email code.`}
          confirmLabel="Remove address"
          testid="sd-address-remove"
          action="address_remove"
          onClose={() => setDialog(null)}
          onConfirm={async (code) => { await safedealApi.removeAddress(dialog.remove.address_id, code); notify("Address removed."); setDialog(null); await load(); }}
          onError={(m) => notify(m, "error")}
        />
      )}
      <AddEmailDialog open={addEmailOpen} onClose={() => setAddEmailOpen(false)} onDone={() => void load()} />

      <Snackbar open={!!toast} autoHideDuration={4500} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast?.severity || "success"} onClose={() => setToast(null)} data-testid="sd-toast" sx={{ fontWeight: 600 }}>{toast?.msg}</Alert>
      </Snackbar>
    </Container>
  );
}
