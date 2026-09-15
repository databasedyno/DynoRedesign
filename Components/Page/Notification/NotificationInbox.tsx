import React, { useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { differenceInCalendarDays } from "date-fns";
import CustomButton from "@/Components/UI/Buttons";
import SkeletonList from "@/Components/UI/SkeletonList";
import { CB_TOKENS, PillButton } from "@/Components/Page/Dashboard/coinbase/styled";
import { statusToneColors } from "@/Components/UI/StatusDot";
import { Icon } from "@/styles/uiKit";
import { roundLongDecimalsInText } from "@/utils/currencyFormat";
import type { AttentionItem } from "@/Components/Page/Dashboard/v2026/command/useAttentionItems";
import { KIND_ICON, NOTIF_KINDS, NotifKind, kindOf, kindOfAttention } from "./notificationKind";

export type NotifTarget = { kind: "transaction" } | { kind: "route"; href: string } | null;

interface Props {
  notifications: any[];
  loading: boolean;
  unreadCount: number;
  markingAllRead: boolean;
  onMarkAllRead: () => void;
  onOpen: (notif: any) => void;
  targetFor: (notif: any) => NotifTarget;
  formatTimeAgo: (iso: string) => string;
  /** Wave 3g — dashboard "Needs attention" rows mirrored here (incl. dismissed ones). */
  attention?: AttentionItem[];
  onRestoreAttention?: (key: string) => void;
}

type KindFilter = "all" | NotifKind;

type Bucket = "today" | "yesterday" | "thisWeek" | "earlier";

const bucketOf = (iso: string): Bucket => {
  const days = differenceInCalendarDays(new Date(), new Date(iso));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return "thisWeek";
  return "earlier";
};

/** Icon + semantic tone per notification family (types come from backend NOTIFICATION_TYPES). */
const familyOf = (type: string): { icon: string; tone: "positive" | "negative" | "warning" | "info" } => {
  if (/kyc/.test(type)) return { icon: "lucide:id-card", tone: /approved/.test(type) ? "positive" : /reject/.test(type) ? "negative" : "warning" };
  if (/wallet|security/.test(type)) return { icon: "lucide:shield-check", tone: /lock|alert/.test(type) ? "negative" : "info" };
  if (/team/.test(type)) return { icon: "lucide:users", tone: "info" };
  if (/api_key/.test(type)) return { icon: "lucide:key-round", tone: "info" };
  if (/company/.test(type)) return { icon: "lucide:briefcase", tone: "info" };
  if (/weekly|summary/.test(type)) return { icon: "lucide:chart-column", tone: "info" };
  if (/received|confirmed|settled|paid|success|complete/.test(type)) return { icon: "lucide:coins", tone: "positive" };
  if (/failed|expired|declined|error|partial|reversed|overpaid/.test(type)) return { icon: "lucide:coins", tone: "negative" };
  if (/pending|confirming|processing/.test(type)) return { icon: "lucide:coins", tone: "warning" };
  return { icon: "lucide:bell", tone: "info" };
};

/** Grouped inbox (plan 3.9): Today / Yesterday / This week / Earlier, unread emphasis, every row taps through. */
const NotificationInbox: React.FC<Props> = ({ notifications, loading, unreadCount, markingAllRead, onMarkAllRead, onOpen, targetFor, formatTimeAgo, attention = [], onRestoreAttention }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("notifications");
  const [kind, setKind] = useState<KindFilter>("all");
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const toneColor = (tone: ReturnType<typeof familyOf>["tone"]) => {
    const s = CB_TOKENS.semantic[tone];
    return { fg: isDark ? s.dark : s.light, bg: isDark ? s.glowDark : s.glowLight };
  };

  const kindCounts = useMemo(() => {
    const c: Record<NotifKind, number> = { payments: 0, security: 0, system: 0, growth: 0 };
    for (const n of notifications) c[kindOf(String(n.type || ""))] += 1;
    for (const a of attention) c[kindOfAttention(a.group)] += 1;
    return c;
  }, [notifications, attention]);

  const filtered = useMemo(
    () => (kind === "all" ? notifications : notifications.filter((n) => kindOf(String(n.type || "")) === kind)),
    [notifications, kind],
  );
  const attentionRows = useMemo(
    () => (kind === "all" ? attention : attention.filter((a) => kindOfAttention(a.group) === kind)),
    [attention, kind],
  );

  const groups = useMemo(() => {
    const order: Bucket[] = ["today", "yesterday", "thisWeek", "earlier"];
    const map: Record<Bucket, any[]> = { today: [], yesterday: [], thisWeek: [], earlier: [] };
    for (const n of filtered) map[bucketOf(n.created_at)].push(n);
    return order.filter((b) => map[b].length).map((b) => ({ bucket: b, items: map[b], unread: map[b].filter((n) => !n.is_read).length }));
  }, [filtered]);

  const kindLabel: Record<KindFilter, string> = {
    all: t("kind.all", { defaultValue: "All" }),
    payments: t("kind.payments", { defaultValue: "Payments" }),
    security: t("kind.security", { defaultValue: "Security" }),
    system: t("kind.system", { defaultValue: "System" }),
    growth: t("kind.growth", { defaultValue: "Growth" }),
  };

  const chips = (
    <Box data-testid="notifications-kind-filter" role="tablist" sx={{ display: "flex", alignItems: "center", gap: 0.5, p: 0.5, mb: 2, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)", overflowX: "auto", maxWidth: "100%", "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
      {(["all", ...NOTIF_KINDS] as KindFilter[]).map((k) => {
        const count = k === "all" ? notifications.length + attention.length : kindCounts[k];
        return (
          <PillButton key={k} active={kind === k} role="tab" aria-selected={kind === k} data-testid={`notifications-kind-${k}`} onClick={() => setKind(k)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, whiteSpace: "nowrap" }}>
            {k !== "all" && <Icon name={KIND_ICON[k]} size={13} />}
            {kindLabel[k]}
            <Box component="span" sx={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, opacity: 0.75 }}>{count}</Box>
          </PillButton>
        );
      })}
    </Box>
  );

  const attentionBlock = attentionRows.length > 0 && (
    <Box data-testid="notifications-attention" data-count={attentionRows.length}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1, px: 0.5 }}>
        <Typography component="h3" sx={{ m: 0, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: muted }}>
          {t("attention.title", { defaultValue: "Needs attention" })}
        </Typography>
        <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted }}>
          {t("attention.hint", { defaultValue: "Mirrored from your dashboard — nothing is lost when you hide a row there." })}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {attentionRows.map((item) => {
          const tone = item.severity === "critical" ? statusToneColors("failed", isDark) : item.severity === "warning" ? statusToneColors("pending", isDark) : statusToneColors("neutral", isDark);
          return (
            <Box
              key={item.id}
              data-testid={`notifications-attention-${item.testId}`}
              data-dismissed={item.dismissed ? "true" : "false"}
              sx={{ display: "flex", gap: 1.5, alignItems: "center", p: { xs: 1.5, md: 2 }, borderRadius: "14px", border: `1px solid ${border}`, backgroundColor: theme.palette.background.paper, opacity: item.dismissed ? 0.78 : 1, flexWrap: "wrap" }}
            >
              <Box sx={{ width: 40, height: 40, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: item.severity === "info" ? muted : tone.fg, backgroundColor: item.severity === "info" ? (isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)") : `${tone.dot}1F` }}>
                <Icon name={item.icon} size={18} />
              </Box>
              <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
                <Typography sx={{ fontSize: { xs: "13.5px", md: "14.5px" }, fontWeight: 600, fontFamily: "var(--font-sans)", color: theme.palette.text.primary, lineHeight: 1.35 }}>{item.text}</Typography>
                {item.dismissed && (
                  <Typography data-testid={`notifications-attention-${item.testId}-hidden`} sx={{ mt: 0.25, fontSize: 12, color: muted, fontFamily: "var(--font-sans)" }}>
                    {t("attention.hiddenOnDashboard", { defaultValue: "Hidden on the dashboard" })}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                {item.dismissed && item.dismissKey && onRestoreAttention && (
                  <Box component="button" type="button" data-testid={`notifications-attention-${item.testId}-restore`} onClick={() => onRestoreAttention(item.dismissKey as string)} sx={{ all: "unset", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: muted, "&:hover": { color: theme.palette.text.primary, textDecoration: "underline" } }}>
                    {t("attention.restore", { defaultValue: "Show on dashboard" })}
                  </Box>
                )}
                <CustomButton data-testid={`notifications-attention-${item.testId}-action`} label={item.actionLabel} variant="outlined" size="small" onClick={() => router.push(item.href)} />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  const bucketLabel: Record<Bucket, string> = {
    today: t("group.today", { defaultValue: "Today" }),
    yesterday: t("group.yesterday", { defaultValue: "Yesterday" }),
    thisWeek: t("group.thisWeek", { defaultValue: "This week" }),
    earlier: t("group.earlier", { defaultValue: "Earlier" }),
  };

  if (loading) {
    return (
      <Box sx={{ py: 1 }}>
        <SkeletonList rows={5} rowHeight={72} testId="notifications-loading-skeleton" />
      </Box>
    );
  }

  if (notifications.length === 0 && attention.length === 0) {
    return (
      <Box data-testid="notifications-empty" sx={{ textAlign: "center", py: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25 }}>
        <Box sx={{ width: 52, height: 52, borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.action.hover, color: indigo }}>
          <Icon name="bell" size={24} />
        </Box>
        <Typography sx={{ fontSize: "15px", fontWeight: 600, color: theme.palette.text.primary, fontFamily: "var(--font-sans)" }}>{t("noNotificationsYet")}</Typography>
        <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", maxWidth: 300 }}>
          {t("noNotificationsDesc", { defaultValue: "Payment confirmations, payouts and account updates will show up here." })}
        </Typography>
      </Box>
    );
  }

  return (
    <Box data-testid="notifications-inbox" data-kind={kind} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {chips}
      {attentionBlock}
      {groups.length === 0 && (
        <Typography data-testid="notifications-kind-empty" sx={{ py: 3, textAlign: "center", fontSize: 13.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
          {t("kind.empty", { defaultValue: "No {{kind}} notifications yet.", kind: kindLabel[kind].toLowerCase() })}
        </Typography>
      )}
      {groups.map((g, gi) => (
        <Box key={g.bucket} data-testid={`notifications-group-${g.bucket}`}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1, px: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <Typography component="h3" sx={{ m: 0, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: muted }}>
                {bucketLabel[g.bucket]}
              </Typography>
              {g.unread > 0 && (
                <Typography data-testid={`notifications-group-${g.bucket}-unread`} sx={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: indigo }}>
                  {t("group.unreadCount", { count: g.unread, defaultValue: "{{count}} unread" })}
                </Typography>
              )}
            </Box>
            {gi === 0 && unreadCount > 0 && (
              <CustomButton
                data-testid="mark-all-read-btn"
                label={markingAllRead ? t("markingAllRead", { defaultValue: "Marking…" }) : t("markAllRead", { defaultValue: "Mark all as read" })}
                variant="outlined"
                size="small"
                startIcon={<Icon name="check-check" size={15} />}
                onClick={onMarkAllRead}
                disabled={markingAllRead}
              />
            )}
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {g.items.map((notif) => {
              const fam = familyOf(String(notif.type || ""));
              const c = toneColor(fam.tone);
              const target = targetFor(notif);
              const unread = !notif.is_read;
              return (
                <Box
                  key={notif.notification_id}
                  role="button"
                  tabIndex={0}
                  aria-label={notif.title}
                  data-testid={`notification-item-${notif.notification_id}`}
                  data-unread={unread ? "true" : "false"}
                  onClick={() => onOpen(notif)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(notif);
                    }
                  }}
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    alignItems: "flex-start",
                    p: { xs: 1.5, md: 2 },
                    borderRadius: "14px",
                    border: `1px solid ${unread ? (isDark ? "rgba(129,140,248,0.35)" : "rgba(79,70,229,0.28)") : border}`,
                    backgroundColor: unread ? (isDark ? "rgba(129,140,248,0.06)" : "rgba(79,70,229,0.035)") : theme.palette.background.paper,
                    cursor: target || unread ? "pointer" : "default",
                    transition: "border-color 150ms ease, background-color 150ms ease, transform 150ms ease",
                    "&:hover": { borderColor: indigo },
                    "&:focus-visible": { outline: `2px solid ${indigo}`, outlineOffset: 2 },
                    "@media (prefers-reduced-motion: no-preference)": { "&:active": { transform: "scale(0.995)" } },
                  }}
                >
                  <Box sx={{ position: "relative", flexShrink: 0 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: c.fg, backgroundColor: c.bg }}>
                      <Icon name={fam.icon} size={18} />
                    </Box>
                    {unread && <Box data-testid="notification-unread-dot" sx={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%", backgroundColor: indigo, border: `2px solid ${theme.palette.background.paper}` }} />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                      <Typography sx={{ fontSize: { xs: "13.5px", md: "15px" }, fontWeight: unread ? 700 : 500, fontFamily: "var(--font-sans)", color: theme.palette.text.primary, lineHeight: 1.3 }}>
                        {notif.title}
                      </Typography>
                      <Typography sx={{ fontSize: "12px", color: muted, fontFamily: "var(--font-sans)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {formatTimeAgo(notif.created_at)}
                      </Typography>
                    </Box>
                    <Typography sx={{ mt: 0.35, fontSize: { xs: "12.5px", md: "13px" }, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}>
                      {roundLongDecimalsInText(notif.message)}
                    </Typography>
                    {target && (
                      <Box data-testid="notification-open-hint" sx={{ mt: 0.75, display: "inline-flex", alignItems: "center", gap: 0.4, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: indigo }}>
                        {target.kind === "transaction" ? t("openTransaction", { defaultValue: "View transaction" }) : t("openDetails", { defaultValue: "Open" })}
                        <Icon name="chevron-right" size={14} />
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default NotificationInbox;
