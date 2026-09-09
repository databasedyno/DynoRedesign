import { brandFg } from "@/constants/theme";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { formatWithSeparators, formatDisplayAmount } from "@/utils/currencyFormat";
import { formatDateI18n, formatDateTimeI18n } from "@/utils/formatDate";
import CustomButton from "@/Components/UI/Buttons";
import CustomSwitch from "@/Components/UI/CustomSwitch";
import PanelCard from "@/Components/UI/PanelCard";
import { StatusDot } from "@/Components/UI/StatusDot";
import { Box, Chip, CircularProgress, Divider, Grid, IconButton, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React, { useRef, useState, useEffect } from "react";

import BellIcon from "@/assets/Icons/bell-icon.svg";
import EnvelopeIcon from "@/assets/Icons/envelope-icon.svg";
import MobileIcon from "@/assets/Icons/mobile-icon.svg";
import Toast from "@/Components/UI/Toast";
import useIsMobile from "@/hooks/useIsMobile";
import { useNotificationPreferences, isValidEmail } from "@/hooks/useNotificationPreferences";
import CompanyEmailRoutingCard from "@/Components/Page/Notification/CompanyEmailRoutingCard";
import { NotificationItemProps } from "@/utils/types/notification";
import { roundLongDecimalsInText } from "@/utils/currencyFormat";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CircleIcon from "@mui/icons-material/Circle";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useApiSWR } from "@/hooks/useApiSWR";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import axiosBaseApi from "@/axiosConfig";
import SkeletonList from "@/Components/UI/SkeletonList";
import { useSelector } from "react-redux";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  fetchUnreadCount,
  readLastCompanyId,
  setCachedUnreadCount,
  decrementUnreadCount,
} from "@/hooks/useUnreadNotificationsCount";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import TransactionDetailsModal from "@/Components/Page/Transactions/TransactionDetailsModal";
import { ExtendedTransaction } from "@/utils/types/transaction";
import { API_ENDPOINTS } from "@/api/endpoints";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

const NotificationItem: React.FC<NotificationItemProps> = ({
  title,
  description,
  checked,
  onChange,
  showDivider = true,
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
        <CustomSwitch
          checked={checked}
          onChange={(e, checked) => onChange(checked)}
          sx={{
            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
              backgroundColor: theme.palette.primary.main,
            },
          }}
        />
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

const NotificationPage = () => {
  const theme = useTheme();
  const namespaces = ["notifications"];
  const { t } = useTranslation(namespaces);
  const rel = useRelativeTime();
  const tNotifications = useCallback(
    (key: string) => t(key, { ns: "notifications" }),
    [t],
  );
  const isMobile = useIsMobile("md");

  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const isMember = useCompanyStore().isMember;
  // Fall back to the persisted last_company_id before Redux hydrates so the
  // initial fetches are already company-scoped (avoids a duplicate un-scoped
  // request on every full page load).
  const effectiveCompanyId = selectedCompanyId ?? readLastCompanyId();

  const {
    preferences,
    routing,
    loading,
    saving,
    updatePreference,
    updateRouting,
    updateRoutingCategory,
    savePreferences,
  } = useNotificationPreferences();

  const {
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    loading: pushLoading,
    supported: pushSupported,
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
      }
    }
  }, [pushSubscribed, pushSubscribe, pushUnsubscribe, pushPermission]);

  const [openToast, setOpenToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Settings updated successfully!");
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notification inbox state
  const [activeTab, setActiveTab] = useState<"inbox" | "settings">("inbox");
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Transaction detail modal state
  const [selectedTransaction, setSelectedTransaction] = useState<ExtendedTransaction | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);

  const isTransactionNotification = (type: string) => {
    return type.includes("payment") || type.includes("transaction") || type.includes("received") || type.includes("confirmed") || type.includes("partial");
  };

  const fmtDateTime = (iso: string) =>
    formatDateTimeI18n(iso, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // Normalise a backend status (raw DB or deriveTxDisplayStatus output) onto
  // ExtendedTransaction.status — same buckets as the /transactions list.
  const normalizeTxStatus = (raw: unknown): ExtendedTransaction["status"] => {
    const s = String(raw || "").toLowerCase().trim();
    if (["success", "successful", "completed", "payout_complete", "converted", "recovered", "done", "settled"].includes(s)) return "settled";
    if (s === "confirmed") return "confirmed";
    if (s === "processing" || s === "confirming") return "processing";
    if (s === "unpaid") return "unpaid";
    if (s === "awaiting_payment" || s === "awaiting") return "awaiting_payment";
    if (["failed", "expired", "refunded", "settlement_failed"].includes(s)) return "failed";
    return "pending";
  };

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
        usdValue: usdRaw > 0 ? `$${formatWithSeparators(usdRaw, undefined, 2)}` : "—",
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
        settlementAddress: d.wallet_address || "",
        webhookResponse: d.webhook_response || null,
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

    // If it's a transaction-related notification, try to open transaction modal
    if (isTransactionNotification(notif.type)) {
      // The API exposes the notification payload as `data` (legacy code read `meta`).
      const meta = notif.data || notif.meta || {};
      const txRef: string = meta.transaction_id || meta.tx_id || meta.transaction_reference || meta.tx_ref || meta.txid || "";
      const txAmount = meta.amount || meta.base_amount;
      const txCurrency = meta.currency || meta.base_currency || meta.crypto || "";

      const fromLedger = txRef ? await fetchTransactionForNotification(txRef) : null;
      if (fromLedger) {
        setSelectedTransaction(fromLedger);
        setTxModalOpen(true);
        return;
      }

      // Fallback: build from the notification payload. A "payment_received" /
      // "transaction_confirmed" notification is only emitted AFTER settlement,
      // so never present it as "awaiting payment".
      const settledType = notif.type === "payment_received" || notif.type === "transaction_confirmed";
      const transaction: ExtendedTransaction = {
        id: txRef || notif.notification_id?.toString() || "",
        crypto: txCurrency,
        amount: txAmount ? `${formatDisplayAmount(Number(txAmount) || 0, txCurrency)} ${txCurrency}` : "",
        cryptoAmountRaw: Number(txAmount) || 0,
        usdValue: meta.usd_value ? `$${formatWithSeparators(Number(meta.usd_value), undefined, 2)}` : "—",
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

      setSelectedTransaction(transaction);
      setTxModalOpen(true);
    }
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

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 7) return rel(dateStr);
    return formatDateI18n(dateStr);
  };

  // Color-code notifications by type using the shared semantic palette:
  // paid/received/confirmed = green, failed/partial/security alert = red,
  // pending/confirming = amber, everything else (info/system/report) = blue.
  const getTypeColor = (type: string) => {
    const isDark = theme.palette.mode === "dark";
    const S = CB_TOKENS.semantic;
    const pick = (s: typeof S.positive) => (isDark ? s.dark : s.light);
    if (/received|confirmed|settled|paid|success|complete/.test(type)) return pick(S.positive);
    if (/failed|expired|declined|error|partial|reversed|security|suspicious/.test(type)) return pick(S.negative);
    if (/pending|confirming|processing/.test(type)) return pick(S.warning);
    return pick(S.info);
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
      {/* Tab Switcher */}
      <Box sx={{ display: "flex", gap: "12px", mb: 2.5 }}>
        <CustomButton
          data-testid="notifications-inbox-tab"
          label={`Inbox${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          variant={activeTab === "inbox" ? "primary" : "outlined"}
          size="small"
          onClick={() => setActiveTab("inbox")}
        />
        <CustomButton
          data-testid="notifications-settings-tab"
          label="Settings"
          variant={activeTab === "settings" ? "primary" : "outlined"}
          size="small"
          onClick={() => setActiveTab("settings")}
        />
      </Box>

      {/* Inbox Tab */}
      {activeTab === "inbox" && (
        <Box>
          {unreadCount > 0 && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
              <CustomButton
                data-testid="mark-all-read-btn"
                label={markingAllRead ? "Marking..." : "Mark All as Read"}
                variant="outlined"
                size="small"
                onClick={markAllAsRead}
                disabled={markingAllRead}
              />
            </Box>
          )}
          {notifLoading ? (
            <Box sx={{ py: 1 }}>
              <SkeletonList rows={5} rowHeight={72} testId="notifications-loading-skeleton" />
            </Box>
          ) : notifications.length === 0 ? (
            <Box
              sx={{
                textAlign: "center",
                py: 6,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1.25,
              }}
              data-testid="notifications-empty"
            >
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: theme.palette.action.hover,
                  color: brandFg(theme.palette.mode === "dark"),
                }}
              >
                <NotificationsNoneRounded sx={{ fontSize: 26 }} />
              </Box>
              <Typography sx={{ fontSize: "15px", fontWeight: 600, color: theme.palette.text.primary, fontFamily: "var(--font-sans)" }}>
                {t("noNotificationsYet")}
              </Typography>
              <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", maxWidth: 300 }}>
                {t("noNotificationsDesc", { defaultValue: "Payment confirmations, payouts and account updates will show up here." })}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {notifications.map((notif) => (
                <Box
                  key={notif.notification_id}
                  data-testid={`notification-item-${notif.notification_id}`}
                  onClick={() => handleNotificationClick(notif)}
                  sx={{
                    display: "flex",
                    gap: 2,
                    p: isMobile ? 1.5 : 2,
                    borderRadius: "12px",
                    border: `1px solid ${theme.palette.border.main}`,
                    borderLeft: notif.is_read
                      ? `1px solid ${theme.palette.border.main}`
                      : `3px solid ${brandFg(theme.palette.mode === "dark")}`,
                    backgroundColor: theme.palette.background.paper,
                    cursor: isTransactionNotification(notif.type) || !notif.is_read ? "pointer" : "default",
                    transition: "all 0.15s ease",
                    "&:hover": { borderColor: theme.palette.primary.main },
                  }}
                >
                  <Box sx={{ pt: "4px", width: 12, flexShrink: 0 }}>
                    {!notif.is_read && (
                      <CircleIcon sx={{ fontSize: 8, color: brandFg(theme.palette.mode === "dark") }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                      <Typography
                        sx={{
                          fontSize: { xs: "13px", md: "15px" },
                          fontWeight: notif.is_read ? 500 : 700,
                          fontFamily: notif.is_read ? "var(--font-sans)" : "var(--font-sans)",
                          color: theme.palette.text.primary,
                          lineHeight: 1.3,
                        }}
                      >
                        {notif.title}
                      </Typography>
                      <Typography
                        sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", whiteSpace: "nowrap", ml: 1 }}
                      >
                        {formatTimeAgo(notif.created_at)}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: { xs: "12px", md: "13px" },
                        color: theme.palette.text.secondary,
                        fontFamily: "var(--font-sans)",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {roundLongDecimalsInText(notif.message)}
                    </Typography>
                    {/* Category chip only when it ADDS info — most titles
                        already say "Payment Received" (UI/UX audit dedupe). */}
                    {notif.type.split("_").join(" ").toLowerCase() !==
                      String(notif.title || "").trim().toLowerCase() && (
                    <Box sx={{ mt: 0.75 }}>
                      <StatusDot
                        tone={
                          /(fail|error|declin|reject)/i.test(notif.type)
                            ? "failed"
                            : /(pending|process|await)/i.test(notif.type)
                              ? "pending"
                              : /(success|received|confirm|settle|paid|complete)/i.test(notif.type)
                                ? "settled"
                                : "info"
                        }
                      >
                        {notif.type.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                      </StatusDot>
                    </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
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
        {/* Left Column - Two Cards Stacked */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Transaction Alerts Card */}
            <PanelCard
              headerSx={{ fontSize: { xs: "15px", md: "20px" } }}
              subTitleSx={{
                fontSize: { xs: "13px", md: "15px" },
                color: theme.palette.text.primary,
              }}
              titleGap={{ gap: isMobile ? "12.41px" : "12px" }}
              title={tNotifications("transactionAlertsTitle")}
              subTitle={tNotifications("transactionAlertsSubtitle")}
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
                  title={tNotifications("transactionUpdatesTitle")}
                  description={tNotifications("transactionUpdatesDescription")}
                  checked={preferences.transactionUpdates}
                  onChange={(val) => updatePreference("transactionUpdates", val)}
                />
                <NotificationItem
                  title={tNotifications("paymentReceivedTitle")}
                  description={tNotifications("paymentReceivedDescription")}
                  checked={preferences.paymentReceived}
                  onChange={(val) => updatePreference("paymentReceived", val)}
                  showDivider={false}
                />
              </Box>
            </PanelCard>

            {/* Weekly Reports Card */}
            <PanelCard
              headerSx={{ fontSize: { xs: "15px", md: "20px" } }}
              subTitleSx={{
                fontSize: { xs: "13px", md: "15px" },
                color: theme.palette.text.primary,
              }}
              titleGap={{ gap: isMobile ? "12.41px" : "12px" }}
              title={tNotifications("weeklyReportsTitle")}
              subTitle={tNotifications("weeklyReportsSubtitle")}
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
                    src={MobileIcon.src}
                    alt="mobile-icon"
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
                  description={tNotifications("weeklySummaryDescription")}
                  checked={preferences.weeklySummary}
                  onChange={(val) => updatePreference("weeklySummary", val)}
                />
                <NotificationItem
                  title={tNotifications("securityAlertsTitle")}
                  description={tNotifications("securityAlertsDescription")}
                  checked={preferences.securityAlerts}
                  onChange={(val) => updatePreference("securityAlerts", val)}
                  showDivider={false}
                />
              </Box>
            </PanelCard>
          </Box>
        </Grid>

        {/* Right Column - Single Taller Card */}
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
              title={tNotifications("emailNotificationsCardTitle")}
              subTitle={tNotifications("emailNotificationsCardSubtitle")}
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
                  title={tNotifications("emailNotificationsTitle")}
                  description={tNotifications("emailNotificationsDescription")}
                  checked={preferences.emailNotifications}
                  onChange={(val) => updatePreference("emailNotifications", val)}
                />
                <NotificationItem
                  title={tNotifications("smsNotificationsTitle")}
                  description={tNotifications("smsNotificationsDescription")}
                  checked={preferences.smsNotifications}
                  onChange={(val) => updatePreference("smsNotifications", val)}
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
                        <StatusDot tone="settled">Active</StatusDot>
                      )}
                      {pushPermission === "denied" && (
                        <StatusDot tone="failed">Blocked</StatusDot>
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
                        ? "You'll receive instant push notifications even when this tab is in the background."
                        : pushPermission === "denied"
                        ? "Push notifications are blocked. Please enable them in your browser settings."
                        : tNotifications("browserNotificationsDescription")}
                    </Typography>
                  </Box>
                  {pushSupported && (
                    <CustomButton
                      label={
                        pushLoading
                          ? "..."
                          : pushSubscribed
                          ? "Disable"
                          : pushPermission === "denied"
                          ? "Blocked"
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
                      sx={{
                        fontSize: "13px",
                        color: theme.palette.text.secondary,
                        fontStyle: "italic",
                      }}
                    >
                      {t("notSupportedInBrowser")}
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
        onClose={() => { setTxModalOpen(false); setSelectedTransaction(null); }}
        transaction={selectedTransaction}
      />
    </Box>
  );
};

export default NotificationPage;
