import CustomButton from "@/Components/UI/Buttons";
import CustomSwitch from "@/Components/UI/CustomSwitch";
import PanelCard from "@/Components/UI/PanelCard";
import { Box, Chip, CircularProgress, Divider, Grid, IconButton, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React, { useRef, useState, useEffect } from "react";

import BellIcon from "@/assets/Icons/bell-icon.svg";
import EnvelopeIcon from "@/assets/Icons/envelope-icon.svg";
import MobileIcon from "@/assets/Icons/mobile-icon.svg";
import Toast from "@/Components/UI/Toast";
import useIsMobile from "@/hooks/useIsMobile";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { NotificationItemProps } from "@/utils/types/notification";
import { roundLongDecimalsInText } from "@/utils/currencyFormat";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CircleIcon from "@mui/icons-material/Circle";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { useSelector } from "react-redux";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  fetchUnreadCount,
  readLastCompanyId,
  setCachedUnreadCount,
  invalidateUnreadCountCache,
} from "@/hooks/useUnreadNotificationsCount";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import TransactionDetailsModal from "@/Components/Page/Transactions/TransactionDetailsModal";
import { ExtendedTransaction } from "@/utils/types/transaction";

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
  const tNotifications = useCallback(
    (key: string) => t(key, { ns: "notifications" }),
    [t],
  );
  const isMobile = useIsMobile("md");

  const selectedCompanyId = useSelector(
    (state: any) => state?.companyReducer?.selectedCompanyId
  );
  // Fall back to the persisted last_company_id before Redux hydrates so the
  // initial fetches are already company-scoped (avoids a duplicate un-scoped
  // request on every full page load).
  const effectiveCompanyId = selectedCompanyId ?? readLastCompanyId();

  const {
    preferences,
    loading,
    saving,
    updatePreference,
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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Transaction detail modal state
  const [selectedTransaction, setSelectedTransaction] = useState<ExtendedTransaction | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);

  const isTransactionNotification = (type: string) => {
    return type.includes("payment") || type.includes("transaction") || type.includes("received") || type.includes("confirmed") || type.includes("partial");
  };

  const handleNotificationClick = async (notif: any) => {
    // Mark as read
    if (!notif.is_read) {
      markOneAsRead(notif.notification_id);
    }

    // If it's a transaction-related notification, try to open transaction modal
    if (isTransactionNotification(notif.type)) {
      const txRef = notif.meta?.transaction_reference || notif.meta?.tx_ref || notif.meta?.transaction_id;
      const txAmount = notif.meta?.amount || notif.meta?.base_amount;
      const txCurrency = notif.meta?.currency || notif.meta?.base_currency || notif.meta?.crypto;
      const txStatus = notif.meta?.status;

      const mappedStatus: "done" | "pending" | "failed" =
        txStatus === "success" || txStatus === "successful" || txStatus === "confirmed" || txStatus === "Completed" || txStatus === "completed"
          ? "done"
          : txStatus === "failed" || txStatus === "expired"
            ? "failed"
            : "pending";

      // Build transaction from notification meta or notification itself
      const transaction: ExtendedTransaction = {
        id: txRef || notif.notification_id?.toString() || "",
        crypto: txCurrency || "",
        amount: txAmount ? `${txAmount} ${txCurrency || ""}` : "",
        usdValue: notif.meta?.usd_value ? `$${Number(notif.meta.usd_value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "",
        dateTime: new Date(notif.created_at).toLocaleString(),
        status: mappedStatus,
        fees: notif.meta?.fees || "0",
        confirmations: notif.meta?.confirmations || "",
        incomingTransactionId: notif.meta?.incoming_tx_hash || notif.meta?.txid || "",
        outgoingTransactionId: notif.meta?.outgoing_tx_hash || "",
      };

      setSelectedTransaction(transaction);
      setTxModalOpen(true);
    }
  };

  useEffect(() => {
    const params: Record<string, any> = {};
    if (effectiveCompanyId) params.company_id = effectiveCompanyId;
    axiosBaseApi.get("/notifications", { params })
      .then((res) => setNotifications(res?.data?.data?.notifications || []))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
    // Shared, TTL-cached fetch (same cache as the sidebar/mobile badges) —
    // no duplicate request when the badge already fetched recently.
    fetchUnreadCount(effectiveCompanyId)
      .then((n) => setUnreadCount(n))
      .catch(() => {});
  }, [effectiveCompanyId]);

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      const body: Record<string, any> = {};
      if (effectiveCompanyId) body.company_id = effectiveCompanyId;
      await axiosBaseApi.put("/notifications/read-all", body);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      // Badges elsewhere can trust 0 immediately — write through the cache.
      setCachedUnreadCount(effectiveCompanyId, 0);
    } catch {}
    setMarkingAllRead(false);
  };

  const markOneAsRead = async (id: number) => {
    try {
      await axiosBaseApi.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      // Cached badge count is now stale — let the next poll refetch it.
      invalidateUnreadCountCache(effectiveCompanyId);
    } catch {}
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const getTypeColor = (type: string) => {
    if (type.includes("received") || type.includes("confirmed")) return "#22C55E";
    if (type.includes("pending") || type.includes("confirming")) return "#F59E0B";
    if (type.includes("partial")) return "#EF4444";
    return "#6B7280";
  };

  const handleSaveChanges = async () => {
    setOpenToast(false);

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
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <Typography sx={{ fontSize: "15px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                {t("noNotificationsYet")}
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
                    backgroundColor: notif.is_read ? theme.palette.background.paper : (theme.palette.mode === 'dark' ? 'rgba(204,255,0,0.08)' : "#F0F7FF"),
                    cursor: isTransactionNotification(notif.type) || !notif.is_read ? "pointer" : "default",
                    transition: "all 0.15s ease",
                    "&:hover": { borderColor: theme.palette.primary.main },
                  }}
                >
                  <Box sx={{ pt: "4px", width: 12, flexShrink: 0 }}>
                    {!notif.is_read && (
                      <CircleIcon sx={{ fontSize: 8, color: theme.palette.primary.main }} />
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
                    <Chip
                      label={notif.type.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                      size="small"
                      sx={{
                        mt: 0.5,
                        height: 22,
                        fontSize: "11px",
                        fontFamily: "var(--font-sans)",
                        backgroundColor: `${getTypeColor(notif.type)}15`,
                        color: getTypeColor(notif.type),
                        border: `1px solid ${getTypeColor(notif.type)}30`,
                      }}
                    />
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
                        <NotificationsActiveIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
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
                        <Chip
                          label="Active"
                          size="small"
                          sx={{
                            bgcolor: theme.palette.primary.main,
                            color: "#fff",
                            fontSize: "11px",
                            height: 20,
                          }}
                        />
                      )}
                      {pushPermission === "denied" && (
                        <Chip
                          label="Blocked"
                          size="small"
                          color="error"
                          sx={{ fontSize: "11px", height: 20 }}
                        />
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
