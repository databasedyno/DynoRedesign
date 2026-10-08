import { brandFg } from "@/constants/theme";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { formatDisplayAmount } from "@/utils/currencyFormat";
import { formatWithSymbol } from "@/utils/locale";
import { formatDateI18n, formatDateTimeI18n } from "@/utils/formatDate";
import CustomButton from "@/Components/UI/Buttons";
import CustomSwitch from "@/Components/UI/CustomSwitch";
import PanelCard from "@/Components/UI/PanelCard";
import { StatusDot } from "@/Components/UI/StatusDot";
import { toTxStatusBucket } from "@/helpers/txStatus";
import { Box, CircularProgress, Divider, Grid, IconButton, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React, { useRef, useState, useEffect } from "react";

import BellIcon from "@/assets/Icons/bell-icon.svg";
import EnvelopeIcon from "@/assets/Icons/envelope-icon.svg";
import Toast from "@/Components/UI/Toast";
import useIsMobile from "@/hooks/useIsMobile";
import { useNotificationPreferences, isValidEmail } from "@/hooks/useNotificationPreferences";
import CompanyEmailRoutingCard from "@/Components/Page/Notification/CompanyEmailRoutingCard";
import { NotificationItemProps } from "@/utils/types/notification";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { tabPillHover } from "@/styles/tabPill";
import { useApiSWR } from "@/hooks/useApiSWR";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import axiosBaseApi from "@/axiosConfig";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  fetchUnreadCount,
  readLastCompanyId,
  setCachedUnreadCount,
  decrementUnreadCount,
} from "@/hooks/useUnreadNotificationsCount";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import TransactionDetailsModal from "@/Components/Page/Transactions/TransactionDetailsModal";
import { ExtendedTransaction, TransactionSource, TxNotificationEvent, TxNotificationEventKind, toAutoConvertInfo } from "@/utils/types/transaction";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useReportDirty } from "@/Components/Page/Settings/settingsDirty";
import { useRouter } from "next/router";
import NotificationInbox, { NotifTarget } from "./NotificationInbox";
import { useDashboardOverview } from "@/Components/Page/Dashboard/v2026/command/useDashboardOverview";
import { useAttentionItems } from "@/Components/Page/Dashboard/v2026/command/useAttentionItems";

const NotificationItem: React.FC<NotificationItemProps & { locked?: boolean; lockedLabel?: string }> = ({
  title,
  description,
  checked,
  onChange,
  showDivider = true,
  testId,
  locked = false,
  lockedLabel,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  return (
    <>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box sx={{ flex: 1, pr: 2 }}>
          <Typography
            sx={{
              fontSize: { xs: "13px", md: "15px" },
              fontWeight: 700,
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
              mb: isMobile ? "9px" : 1,
              lineHeight: 1.2,
              letterSpacing: 0,
            }}
          >
            {title}
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "13px", md: "15px" },
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
              lineHeight: 1.2,
            }}
          >
            {description}
          </Typography>
        </Box>
        {locked ? (
          <StatusDot tone="settled" data-testid={testId}>{lockedLabel}</StatusDot>
        ) : (
          <CustomSwitch
            checked={checked}
            onChange={(e, checked) => onChange(checked)}
            data-testid={testId}
            inputProps={{ "aria-label": title }}
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                backgroundColor: theme.palette.primary.main,
              },
            }}
          />
        )}
      </Box>
      {showDivider && (
        <Divider
          sx={{
            borderColor: theme.palette.border.main,
            my: 0,
          }}
        />
      )}
    </>
  );
};

const NotificationPage = ({ initialTab = "inbox" }: { initialTab?: "inbox" | "settings" }) => {
  const theme = useTheme();
  const router = useRouter();
  const namespaces = ["notifications"];
  const { t } = useTranslation(namespaces);
  const rel = useRelativeTime();
  const tNotifications = useCallback(
    (key: string, options?: Record<string, unknown>) => t(key, { ns: "notifications", ...(options || {}) }),
    [t],
  );
  const isMobile = useIsMobile("md");

  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const isMember = useCompanyStore().isMember;
  // Wave 3g — mirror the dashboard's "Needs attention" rows (incl. dismissed ones)
  // into the inbox so nothing is lost after a dismissal. 30-day overview, SWR-shared.
  const { data: overview } = useDashboardOverview({ range: "30d", custom: null });
  const { items: attentionItems, restore: restoreAttention } = useAttentionItems({ overview, onboarding: !isMember, includeDismissed: true });
  // Fall back to the persisted last_company_id before Redux hydrates so the
  // initial fetches are already company-scoped (avoids a duplicate un-scoped
  // request on every full page load).
  const effectiveCompanyId = selectedCompanyId ?? readLastCompanyId();

  const {
    preferences,
    routing,
    loading,
    saving,
    isDirty: prefsDirty,
    updatePreference,
    updateRouting,
    updateRoutingCategory,
    savePreferences,
  } = useNotificationPreferences();
  useReportDirty("notifications", prefsDirty);

  const {
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    loading: pushLoading,
    supported: pushSupported,
    browserSupported: pushBrowserSupported,
    serverEnabled: pushServerEnabled,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
  } = usePushNotifications();

  const handlePushToggle = useCallback(async () => {
    if (pushSubscribed) {
      const ok = await pushUnsubscribe();
      if (ok) {
        setToastMessage("Browser push notifications disabled");
        setToastSeverity("success");
        setOpenToast(true);
      }
    } else {
      const ok = await pushSubscribe();
      if (ok) {
        setToastMessage("Browser push notifications enabled!");
        setToastSeverity("success");
        setOpenToast(true);
      } else if (pushPermission === "denied") {
        setToastMessage("Notifications blocked. Please enable in browser settings.");
        setToastSeverity("error");
        setOpenToast(true);
      } else {
        setToastMessage(
          tNotifications("pushEnableFailed", {
            defaultValue: "Couldn't enable browser push right now. Email and in-app alerts still work.",
          })
        );
        setToastSeverity("error");
        setOpenToast(true);
      }
    }
  }, [pushSubscribed, pushSubscribe, pushUnsubscribe, pushPermission, tNotifications]);

  const [openToast, setOpenToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Settings updated successfully!");
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notification inbox state
  // ONE home for notification preferences (blueprint §8.9): Settings → Notifications renders
  // this component with initialTab="settings" (preferences only, no tabs); /notifications is the
  // inbox and links there. Old deep links (/notifications?tab=settings) are forwarded.
  const settingsOnly = initialTab === "settings";
  const activeTab: "inbox" | "settings" = settingsOnly ? "settings" : "inbox";
  useEffect(() => {
    if (!settingsOnly && router.isReady && router.query.tab === "settings") {
      router.replace("/settings?section=notifications");
    }
  }, [settingsOnly, router, router.isReady, router.query.tab]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Transaction detail modal state
  const [selectedTransaction, setSelectedTransaction] = useState<ExtendedTransaction | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  // The notification event the drawer is showing a snapshot of (null = live view).
  const [selectedEvent, setSelectedEvent] = useState<TxNotificationEvent | null>(null);

  const isTransactionNotification = (type: string) => {
    return type.includes("payment") || type.includes("transaction") || type.includes("received") || type.includes("confirmed") || type.includes("partial");
  };

  // Where a tap lands, per backend NOTIFICATION_TYPES family.
  const targetFor = (notif: any): NotifTarget => {
    const type = String(notif?.type || "");
    if (/conversion/.test(type)) return { kind: "route", href: "/payouts" };
    if (isTransactionNotification(type)) return { kind: "transaction" };
    if (/kyc/.test(type)) return { kind: "route", href: "/kyc" };
    if (/wallet/.test(type)) return { kind: "route", href: "/settings?section=security" };
    if (/security/.test(type)) return { kind: "route", href: "/settings?section=profile" };
    if (/team/.test(type)) return { kind: "route", href: "/settings?section=team" };
    if (/api_key/.test(type)) return { kind: "route", href: "/developer-keys" };
    if (/company/.test(type)) return { kind: "route", href: "/settings?section=company" };
    if (/payout_digest/.test(type)) return { kind: "route", href: "/transactions?range=7d" };
    if (/weekly|summary/.test(type)) return { kind: "route", href: "/transactions" };
    return null;
  };

  const fmtDateTime = (iso: string) =>
    formatDateTimeI18n(iso, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // Normalise a backend status (raw DB or deriveTxDisplayStatus output) onto
  // ExtendedTransaction.status — same buckets as the /transactions list.
  const normalizeTxStatus = (raw: unknown): ExtendedTransaction["status"] => toTxStatusBucket(raw);

  // Preferred path: the drawer shows the REAL ledger row (status, hashes, USD
  // value) looked up by the tx hash carried in the notification payload.
  const fetchTransactionForNotification = async (txRef: string): Promise<ExtendedTransaction | null> => {
    try {
      const url = effectiveCompanyId
        ? `${API_ENDPOINTS.transactions.detail(txRef)}?company_id=${encodeURIComponent(String(effectiveCompanyId))}`
        : API_ENDPOINTS.transactions.detail(txRef);
      const d = (await axiosBaseApi.get(url))?.data?.data;
      if (!d) return null;
      const crypto = String(d.cryptocurrency || d.base_currency || "");
      const amountRaw = Number(d.amount) || 0;
      const usdRaw = Number(d.usd_value) || 0;
      const feesTotal = Number(d.fees_breakdown?.total ?? d.fees) || 0;
      const rate = amountRaw > 0 ? usdRaw / amountRaw : 0;
      const status = normalizeTxStatus(d.status);
      const confReq = Number(d.confirmations_detail?.required) || 0;
      const confCur = Number(d.confirmations_detail?.current ?? d.confirmations) || 0;
      return {
        id: String(d.transaction_id || txRef),
        crypto,
        amount: `${formatDisplayAmount(amountRaw, crypto)} ${crypto}`,
        cryptoAmountRaw: amountRaw,
        usdValue: usdRaw > 0 ? formatWithSymbol(usdRaw, "$", 2) : "—",
        usdValueRaw: usdRaw,
        dateTime: fmtDateTime(d.date_time),
        createdAtTs: d.date_time ? new Date(d.date_time).getTime() || 0 : 0,
        status,
        fees: Math.round(feesTotal * rate * 100) / 100,
        confirmations: status === "settled" || status === "confirmed"
          ? (confReq > 0 ? `${confReq}/${confReq}` : "Confirmed")
          : (confReq > 0 ? `${confCur}/${confReq}` : ""),
        incomingTransactionId: d.incoming_transaction_id || "",
        outgoingTransactionId: d.outgoing_transaction_id || "",
        callbackUrl: d.callback_url || "",
        settlementAddress: d.auto_convert?.settlement_wallet_address || d.wallet_address || "",
        webhookResponse: d.webhook_response || null,
        autoConverted: d.auto_converted === true,
        autoConvertTarget: d.auto_convert?.target_currency || undefined,
        autoConvert: toAutoConvertInfo(d.auto_convert),
        source: d.source && typeof d.source === "object" ? (d.source as TransactionSource) : undefined,
      };
    } catch {
      return null;
    }
  };

  const handleNotificationClick = async (notif: any) => {
    // Mark as read
    if (!notif.is_read) {
      markOneAsRead(notif.notification_id);
    }

    // Non-payment families open their matching page (plan 3.9).
    const target = targetFor(notif);
    if (target?.kind === "route") {
      router.push(target.href);
      return;
    }

    // If it's a transaction-related notification, try to open transaction modal
    if (isTransactionNotification(notif.type)) {
      // The API exposes the notification payload as `data` (legacy code read `meta`).
      const meta = notif.data || notif.meta || {};
      const txRef: string = meta.transaction_id || meta.tx_id || meta.transaction_reference || meta.tx_ref || meta.txid || "";
      const txAmount = meta.amount || meta.base_amount;
      const txCurrency = meta.currency || meta.base_currency || meta.crypto || "";

      const fromLedger = txRef ? await fetchTransactionForNotification(txRef) : null;

      // Fallback: build from the notification payload. A "payment_received" /
      // "transaction_confirmed" notification is only emitted AFTER settlement,
      // so never present it as "awaiting payment".
      const settledType = notif.type === "payment_received" || notif.type === "transaction_confirmed";
      const fromPayload: ExtendedTransaction = {
        id: txRef || notif.notification_id?.toString() || "",
        crypto: txCurrency,
        amount: txAmount ? `${formatDisplayAmount(Number(txAmount) || 0, txCurrency)} ${txCurrency}` : "",
        cryptoAmountRaw: Number(txAmount) || 0,
        usdValue: meta.usd_value ? formatWithSymbol(Number(meta.usd_value), "$", 2) : "—",
        usdValueRaw: Number(meta.usd_value) || 0,
        dateTime: fmtDateTime(notif.created_at),
        createdAtTs: notif.created_at ? new Date(notif.created_at).getTime() || 0 : 0,
        status: settledType ? "settled" : normalizeTxStatus(meta.status),
        fees: meta.fees || "0",
        confirmations: meta.current_confirmations != null && meta.required_confirmations
          ? `${meta.current_confirmations}/${meta.required_confirmations}`
          : (meta.confirmations || ""),
        incomingTransactionId: meta.incoming_tx_hash || meta.txid || meta.tx_id || (settledType ? txRef : ""),
        outgoingTransactionId: meta.outgoing_tx_hash || "",
      };

      // Event snapshot: show what THIS notification reported (detected /
      // confirming / short / settled …), not the payment's latest state.
      const view = buildEventView(notif, fromLedger, fromPayload);
      setSelectedTransaction(view.tx);
      setSelectedEvent(view.event);
      setTxModalOpen(true);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Per-event snapshot (2026-10-01): "Payment pending" and "Payment   */
  /* received" used to open the SAME live ledger row (already settled), */
  /* so every payment notification showed identical details.           */
  /* ---------------------------------------------------------------- */
  const EVENT_KIND: Record<string, TxNotificationEventKind> = {
    payment_pending: "detected",
    payment_confirming: "confirming",
    payment_partial: "partial",
    payment_partial_expired: "partial_expired",
    payment_overpaid: "overpaid",
    transaction_confirmed: "confirmed",
    payment_received: "settled",
  };
  const DETECTION_KINDS: TxNotificationEventKind[] = ["detected", "confirming", "partial", "partial_expired"];

  const eventTitle = (kind: TxNotificationEventKind, notif: any): string => {
    switch (kind) {
      case "detected":
        return tNotifications("txEvent.detected", { defaultValue: "Payment detected" });
      case "confirming":
        return tNotifications("txEvent.confirming", { defaultValue: "Confirming on-chain" });
      case "partial":
        return tNotifications("txEvent.partial", { defaultValue: "Short payment received" });
      case "partial_expired":
        return String(notif?.title || tNotifications("txEvent.partialExpired", { defaultValue: "Partial payment processed" }));
      case "overpaid":
        return tNotifications("txEvent.overpaid", { defaultValue: "Customer overpaid" });
      case "confirmed":
        return tNotifications("txEvent.confirmed", { defaultValue: "Payment confirmed" });
      default:
        return tNotifications("txEvent.settled", { defaultValue: "Payment received" });
    }
  };

  const buildEventView = (
    notif: any,
    ledger: ExtendedTransaction | null,
    fromPayload: ExtendedTransaction,
  ): { tx: ExtendedTransaction; event: TxNotificationEvent | null } => {
    const base = ledger ?? fromPayload;
    const kind = EVENT_KIND[String(notif?.type || "")];
    if (!kind) return { tx: base, event: null };

    const meta = notif.data || notif.meta || {};
    const currency = String(meta.currency || base.crypto || "");
    const fmtAmt = (n: unknown) => `${formatDisplayAmount(Number(n) || 0, currency)} ${currency}`;
    // Ledger USD/crypto rate → value the snapshot amount consistently.
    const rate = base.cryptoAmountRaw > 0 && base.usdValueRaw > 0 ? base.usdValueRaw / base.cryptoAmountRaw : 0;
    const at: string = notif.created_at;

    const event: TxNotificationEvent = {
      kind,
      title: eventTitle(kind, notif),
      at,
      atLabel: fmtDateTime(at),
      checkoutOpenedAt: ledger?.createdAtTs ? new Date(ledger.createdAtTs).toISOString() : (meta.paid_at || null),
      currentStatus: ledger?.status ?? null,
    };
    event.checkoutOpenedLabel = event.checkoutOpenedAt ? fmtDateTime(event.checkoutOpenedAt) : null;

    let tx: ExtendedTransaction = {
      ...base,
      crypto: base.crypto || currency,
      dateTime: fmtDateTime(at),
      createdAtTs: at ? new Date(at).getTime() || base.createdAtTs : base.createdAtTs,
    };

    if (DETECTION_KINDS.includes(kind)) {
      // Nothing had settled yet at this moment → no fees / payout / settlement
      // wallet / outgoing hash / webhook result (those belong to later events).
      const stripped: ExtendedTransaction = {
        ...tx,
        fees: 0,
        feesBreakdown: undefined,
        referralCreditUsd: undefined,
        outgoingTransactionId: "",
        autoConvert: undefined,
        autoConverted: false,
        settlementAddress: "",
        callbackUrl: "",
        webhookResponse: undefined,
        incomingTransactionId: meta.tx_id || meta.txid || base.incomingTransactionId || "",
      };
      event.receivingAddress = meta.address || null;

      if (kind === "detected") {
        const detected = Number(meta.amount) || base.cryptoAmountRaw;
        const req = Number(meta.confirmations_required) || 0;
        tx = {
          ...stripped,
          status: "processing",
          amount: fmtAmt(detected),
          cryptoAmountRaw: detected,
          usdValueRaw: rate > 0 ? detected * rate : 0,
          usdValue: rate > 0 ? formatWithSymbol(detected * rate, "$", 2) : "—",
          confirmations: req > 0 ? `0/${req}` : "",
        };
        event.estimatedTime = meta.estimated_time || null;
        event.confirmationsRequired = req || null;
      } else if (kind === "confirming") {
        const cur = Number(meta.current_confirmations) || 0;
        const req = Number(meta.required_confirmations) || 0;
        tx = {
          ...stripped,
          status: req > 0 && cur >= req ? "confirmed" : "processing",
          confirmations: req > 0 ? `${cur}/${req}` : stripped.confirmations || "",
        };
        event.confirmationsRequired = req || null;
      } else {
        // Short payment (partial) / its grace-period outcome.
        const expected = Number(meta.expected_amount) || base.cryptoAmountRaw;
        const received = Number(meta.received_amount) || 0;
        tx = {
          ...stripped,
          status: "underpaid",
          amount: fmtAmt(expected),
          cryptoAmountRaw: expected,
          usdValueRaw: rate > 0 ? expected * rate : stripped.usdValueRaw,
          usdValue: rate > 0 ? formatWithSymbol(expected * rate, "$", 2) : stripped.usdValue,
          confirmations: "",
          ...({
            receivedAmountRaw: received,
            remainingAmountRaw: meta.remaining_amount != null ? Number(meta.remaining_amount) : Math.max(0, expected - received),
          } as Partial<ExtendedTransaction>),
        };
      }
    } else {
      // Settlement-family events: the full settled details are what happened.
      tx = { ...tx, status: kind === "confirmed" ? "confirmed" : "settled" };
      if (kind === "settled" && meta.amount != null) {
        event.netAmount = meta.auto_converting
          ? `≈ ${formatWithSymbol(Number(meta.amount) || 0, "$", 2)} → ${meta.currency}`
          : fmtAmt(meta.amount);
      }
      if (kind === "overpaid" && meta.excess_amount != null) {
        event.excessAmount = `${fmtAmt(meta.excess_amount)}${
          meta.excess_amount_usd ? ` (≈ ${formatWithSymbol(Number(meta.excess_amount_usd) || 0, "$", 2)})` : ""
        }`;
      }
    }

    return { tx, event };
  };

  // Notifications list on SWR → cached between visits + deduped, keyed per
  // company. The bell badge stays in sync via the shared unread-count cache
  // (fetchUnreadCount / decrementUnreadCount / setCachedUnreadCount below).
  const notifListKey = effectiveCompanyId
    ? `${API_ENDPOINTS.notifications.list}?company_id=${encodeURIComponent(String(effectiveCompanyId))}`
    : API_ENDPOINTS.notifications.list;
  const { data: notifData, isLoading: notifLoading, mutate: mutateNotifs } = useApiSWR<any[]>(
    [notifListKey, effectiveCompanyId],
    {
      select: (raw: any) => (raw?.data?.notifications || []) as any[],
      // Cross-device read-state sync. Bug: a notification read on one browser
      // stayed unread on another. The list is server-authoritative, but the
      // global SWRConfig sets revalidateOnFocus:false AND this list wasn't
      // polled — so a second browser kept rendering stale unread items until a
      // hard reload. Re-enable focus revalidation + a light 30s poll for JUST
      // this inbox list so switching to another browser/tab reconciles the read
      // state within seconds without touching the app-wide SWR defaults.
      revalidateOnFocus: true,
      refreshInterval: 30_000,
    }
  );
  const notifications = notifData ?? [];

  useEffect(() => {
    // Shared, TTL-cached fetch (same cache as the sidebar/mobile badges) —
    // no duplicate request when the badge already fetched recently.
    // Cross-device sync: also refresh the Inbox tab count when this tab regains
    // focus (e.g. after reading on another browser) and via a light 30s poll,
    // mirroring the list revalidation above so the "(N)" label stays honest.
    let cancelled = false;
    const refreshCount = () =>
      fetchUnreadCount(effectiveCompanyId)
        .then((n) => {
          if (!cancelled) setUnreadCount(n);
        })
        .catch(() => {});
    refreshCount();
    const onFocus = () => refreshCount();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(refreshCount, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [effectiveCompanyId]);

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      const body: Record<string, any> = {};
      if (effectiveCompanyId) body.company_id = effectiveCompanyId;
      await axiosBaseApi.put(API_ENDPOINTS.notifications.readAll, body);
      mutateNotifs(
        (prev) => (prev || []).map((n: any) => ({ ...n, is_read: true })),
        { revalidate: false }
      );
      setUnreadCount(0);
      // Badges elsewhere can trust 0 immediately — write through the cache.
      setCachedUnreadCount(effectiveCompanyId, 0);
    } catch {
      /* non-fatal — next poll will reconcile */
    }
    setMarkingAllRead(false);
  };

  const markOneAsRead = async (id: number) => {
    try {
      await axiosBaseApi.put(API_ENDPOINTS.notifications.markRead(id));
      mutateNotifs(
        (prev) =>
          (prev || []).map((n: any) =>
            n.notification_id === id ? { ...n, is_read: true } : n
          ),
        { revalidate: false }
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      // Optimistically drop the shared badge count so the sidebar/mobile red
      // dot updates IMMEDIATELY (emits to all mounted badges).
      decrementUnreadCount(effectiveCompanyId, 1);
    } catch {
      /* non-fatal — next poll will reconcile */
    }
  };

  const deleteOne = async (id: number, wasUnread: boolean) => {
    // Optimistic remove; the 30s poll reconciles on any failure.
    mutateNotifs((prev) => (prev || []).filter((n: any) => n.notification_id !== id), { revalidate: false });
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      decrementUnreadCount(effectiveCompanyId, 1);
    }
    try {
      await axiosBaseApi.delete(API_ENDPOINTS.notifications.remove(id));
    } catch {
      mutateNotifs();
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 7) return rel(dateStr);
    return formatDateI18n(dateStr);
  };

  const handleSaveChanges = async () => {
    setOpenToast(false);

    // Company routing email must be blank or a valid address (owners only).
    const routingActive = !isMember && !!selectedCompanyId;
    if (routingActive && routing.notificationEmail.trim() !== "" && !isValidEmail(routing.notificationEmail)) {
      setToastMessage("Please enter a valid company notification email.");
      setToastSeverity("error");
      setOpenToast(true);
      return;
    }

    const success = await savePreferences(preferences);

    setTimeout(() => {
      if (success) {
        setToastMessage("Settings updated successfully!");
        setToastSeverity("success");
      } else {
        setToastMessage("Failed to save settings. Please try again.");
        setToastSeverity("error");
      }
      setOpenToast(true);
    }, 0);

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    toastTimer.current = setTimeout(() => {
      setOpenToast(false);
    }, 2000);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Inbox header — preferences live in Settings → Notifications (one home, §8.9) */}
      {!settingsOnly && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 2.5 }}>
          <Typography component="h2" data-testid="notifications-inbox-heading" sx={{ m: 0, fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, color: theme.palette.text.primary }}>
            {t("inboxTab", { defaultValue: "Inbox" })}
            {unreadCount > 0 ? ` (${unreadCount})` : ""}
          </Typography>
          <Box
            component="a"
            href="/settings?section=notifications"
            data-testid="notifications-settings-link"
            data-touch-44=""
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push("/settings?section=notifications");
            }}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minHeight: 36, px: 1.25, borderRadius: "10px", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: brandFg(theme.palette.mode === "dark"), textDecoration: "none", "&:hover": { bgcolor: tabPillHover(theme) } }}
          >
            {t("notificationSettingsLink", { defaultValue: "Notification settings" })}
            <ArrowOutwardIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      )}

      {/* Inbox Tab — grouped by day (plan 3.9) */}
      {activeTab === "inbox" && (
        <NotificationInbox
          notifications={notifications}
          loading={notifLoading}
          unreadCount={unreadCount}
          markingAllRead={markingAllRead}
          onMarkAllRead={markAllAsRead}
          onOpen={handleNotificationClick}
          targetFor={targetFor}
          formatTimeAgo={formatTimeAgo}
          onDelete={deleteOne}
          attention={attentionItems}
          onRestoreAttention={restoreAttention}
        />
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
      <Grid container spacing={2.5}>
        {/* Company email routing (owner-only, company-scoped) — separates
            business/operational emails from personal account security emails. */}
        {!isMember && !!selectedCompanyId && (
          <Grid item xs={12} data-testid="company-email-routing-card">
            <CompanyEmailRoutingCard
              routing={routing}
              onEmailChange={(v) => updateRouting({ notificationEmail: v })}
              onFanoutChange={(v) => updateRouting({ teamFanout: v })}
              onCategoryChange={updateRoutingCategory}
            />
          </Grid>
        )}
        {/* Left Column — the per-user flags the backend actually enforces */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <PanelCard
              headerSx={{ fontSize: { xs: "15px", md: "20px" } }}
              subTitleSx={{
                fontSize: { xs: "13px", md: "15px" },
                color: theme.palette.text.primary,
              }}
              titleGap={{ gap: isMobile ? "12.41px" : "12px" }}
              title={tNotifications("accountEmailsTitle", { defaultValue: "Account emails" })}
              subTitle={tNotifications("accountEmailsSubtitle", {
                defaultValue: "Reports and sign-in alerts for your personal account. Payment, payout and order emails are set per brand above.",
              })}
              showHeaderBorder={false}
              headerPadding={
                isMobile
                  ? theme.spacing(2, 2, 0, 2)
                  : theme.spacing(2.5, 2.5, 0, 2.5)
              }
              bodyPadding={
                isMobile
                  ? theme.spacing(0, 2, 2, 2)
                  : theme.spacing(0, "18px", 2.5, 2.5)
              }
              headerAction={
                <IconButton
                  sx={{
                    height: isMobile ? "32px" : "40px",
                    width: isMobile ? "32px" : "40px",
                    padding: "8px",
                    "&:hover": { backgroundColor: "transparent" },
                  }}
                >
                  <Image
                    src={BellIcon.src}
                    alt="bell-icon"
                    width={isMobile ? 14 : 20}
                    height={isMobile ? 14 : 20}
                    draggable={false}
                  />
                </IconButton>
              }
              sx={{ height: "100%" }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "10px" : 2,
                  pt: { xs: 3, md: "46px" },
                }}
              >
                <NotificationItem
                  title={tNotifications("weeklySummaryTitle")}
                  testId="notification-pref-weeklySummary"
                  description={tNotifications("weeklySummaryDescription")}
                  checked={preferences.weeklySummary}
                  onChange={(val) => updatePreference("weeklySummary", val)}
                />
                <NotificationItem
                  title={tNotifications("newDeviceOnlyTitle", { defaultValue: "Sign-in alerts: new devices only" })}
                  testId="notification-pref-newDeviceOnly"
                  description={tNotifications("newDeviceOnlyDescription", {
                    defaultValue: "Email me only when a sign-in comes from a device or location I haven't used before, instead of every new session.",
                  })}
                  checked={preferences.newDeviceOnly}
                  onChange={(val) => updatePreference("newDeviceOnly", val)}
                />
                <NotificationItem
                  title={tNotifications("securityAlertsTitle")}
                  testId="notification-pref-securityAlerts"
                  description={tNotifications("securityAlertsAlwaysOn", {
                    defaultValue: "Password, 2FA, payout-address and new-device alerts are always sent — they protect your money and can't be switched off.",
                  })}
                  checked
                  locked
                  lockedLabel={tNotifications("alwaysOn", { defaultValue: "Always on" })}
                  onChange={() => undefined}
                  showDivider={false}
                />
              </Box>
            </PanelCard>
          </Box>
        </Grid>

        {/* Right Column — marketing opt-in + browser push */}
        <Grid item xs={12} md={6}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              justifyContent: "space-between",
              height: "100%",
            }}
          >
            <PanelCard
              headerSx={{ fontSize: { xs: "15px", md: "20px" } }}
              subTitleSx={{
                fontSize: { xs: "13px", md: "15px" },
                color: theme.palette.text.primary,
              }}
              titleGap={{ gap: isMobile ? "12.41px" : "12px" }}
              title={tNotifications("otherChannelsTitle", { defaultValue: "Product updates & push" })}
              subTitle={tNotifications("otherChannelsSubtitle", { defaultValue: "Optional emails and browser notifications" })}
              showHeaderBorder={false}
              bodyPadding={
                isMobile
                  ? theme.spacing(0, 2, 2, 2)
                  : theme.spacing(0, 2.5, 2.5, 2.5)
              }
              headerPadding={
                isMobile
                  ? theme.spacing(2, 2, 0, 2)
                  : theme.spacing(2.5, 2.5, 0, 2.5)
              }
              headerAction={
                <IconButton
                  sx={{
                    height: isMobile ? "32px" : "40px",
                    width: isMobile ? "32px" : "40px",
                    padding: "8px",
                    "&:hover": { backgroundColor: "transparent" },
                  }}
                >
                  <Image
                    src={EnvelopeIcon.src}
                    alt="envelope-icon"
                    width={isMobile ? 14 : 20}
                    height={isMobile ? 14 : 20}
                    draggable={false}
                  />
                </IconButton>
              }
              sx={{ height: "fit-content" }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "10px" : 2,
                  pt: { xs: 3, md: "46px" },
                }}
              >
                <NotificationItem
                  title={tNotifications("marketingEmailsTitle")}
                  testId="notification-pref-marketingEmails"
                  description={tNotifications("marketingEmailsDescription")}
                  checked={preferences.marketingEmails}
                  onChange={(val) => updatePreference("marketingEmails", val)}
                />
                {/* Browser Push Notifications - Web Push API */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Box sx={{ flex: 1, pr: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      {pushSubscribed ? (
                        <NotificationsActiveIcon sx={{ fontSize: 18, color: brandFg(theme.palette.mode === "dark") }} />
                      ) : (
                        <NotificationsOffIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                      )}
                      <Typography
                        sx={{
                          fontSize: { xs: "13px", md: "15px" },
                          fontWeight: 700,
                          fontFamily: "var(--font-sans)",
                          color: theme.palette.text.primary,
                          lineHeight: 1.2,
                          letterSpacing: 0,
                        }}
                      >
                        {tNotifications("browserNotificationsTitle")}
                      </Typography>
                      {pushSubscribed && (
                        <StatusDot tone="settled">{tNotifications("pushActive", { defaultValue: "Active" })}</StatusDot>
                      )}
                      {pushPermission === "denied" && pushSupported && (
                        <StatusDot tone="failed">{tNotifications("pushBlocked", { defaultValue: "Blocked" })}</StatusDot>
                      )}
                    </Box>
                    <Typography
                      sx={{
                        fontSize: { xs: "13px", md: "15px" },
                        fontFamily: "var(--font-sans)",
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                      }}
                    >
                      {pushSubscribed
                        ? tNotifications("pushSubscribedDesc", { defaultValue: "You'll receive instant push notifications even when this tab is in the background." })
                        : pushPermission === "denied" && pushSupported
                        ? tNotifications("pushBlockedDesc", { defaultValue: "Push notifications are blocked. Please enable them in your browser settings." })
                        : tNotifications("browserNotificationsDescription")}
                    </Typography>
                  </Box>
                  {pushSupported && (
                    <CustomButton
                      label={
                        pushLoading
                          ? "..."
                          : pushSubscribed
                          ? tNotifications("pushDisable", { defaultValue: "Disable" })
                          : pushPermission === "denied"
                          ? tNotifications("pushBlocked", { defaultValue: "Blocked" })
                          : tNotifications("activate")
                      }
                      variant={pushSubscribed ? "outlined" : "secondary"}
                      size={isMobile ? "small" : "medium"}
                      sx={{ padding: isMobile ? "8px 10px" : "15px 24px" }}
                      disabled={pushLoading || pushPermission === "denied"}
                      endIcon={
                        !pushSubscribed && pushPermission !== "denied" ? (
                          <Box>
                            <ArrowOutwardIcon
                              style={{
                                height: "16px",
                                width: "16px",
                                marginTop: "2px",
                              }}
                            />
                          </Box>
                        ) : undefined
                      }
                      onClick={handlePushToggle}
                    />
                  )}
                  {!pushSupported && (
                    <Typography
                      data-testid="push-unavailable-note"
                      sx={{
                        fontSize: "13px",
                        color: theme.palette.text.secondary,
                        fontStyle: "italic",
                        maxWidth: { xs: "45%", md: 260 },
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {pushBrowserSupported && pushServerEnabled === false
                        ? tNotifications("pushNotConfigured", {
                            defaultValue: "Browser push isn't enabled on this platform yet — email and in-app alerts still work.",
                          })
                        : pushServerEnabled === null && pushBrowserSupported
                        ? "…"
                        : t("notSupportedInBrowser")}
                    </Typography>
                  )}
                </Box>
              </Box>
            </PanelCard>

            <CustomButton
              data-testid="notifications-save-btn"
              label={saving ? "Saving..." : tNotifications("saveChanges")}
              variant="primary"
              size={isMobile ? "small" : "medium"}
              fullWidth
              onClick={handleSaveChanges}
              disabled={saving}
            />
          </Box>
        </Grid>
      </Grid>
      )}
      <Toast
        open={openToast}
        message={toastMessage}
        severity={toastSeverity}
      />
      <TransactionDetailsModal
        open={txModalOpen}
        onClose={() => { setTxModalOpen(false); setSelectedTransaction(null); setSelectedEvent(null); }}
        transaction={selectedTransaction}
        event={selectedEvent}
      />
    </Box>
  );
};

export default NotificationPage;
