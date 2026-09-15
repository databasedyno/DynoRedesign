import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import useApiSWR from "@/hooks/useApiSWR";
import { useKycGate } from "@/hooks/useKycGate";
import { useMfaEnforcement } from "@/Components/UI/MfaGate/useMfaEnforcement";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { API_ENDPOINTS } from "@/api/endpoints";
import { rootReducer } from "@/utils/types";
import { money } from "./format";
import type { DashboardOverview } from "./useDashboardOverview";

export type AttentionGroup = "security" | "money" | "config" | "growth";
export type AttentionSeverity = "critical" | "warning" | "info";

export interface AttentionItem {
  id: string;
  group: AttentionGroup;
  severity: AttentionSeverity;
  icon: string;
  text: string;
  actionLabel: string;
  href: string;
  /** Present on non-blocking rows the merchant may hide (persisted in localStorage). */
  dismissKey?: string;
  /** Only with `includeDismissed`: the row is currently hidden on the dashboard. */
  dismissed?: boolean;
  testId: string;
}

const readDismissed = (keys: string[]): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  try {
    for (const k of keys) out[k] = window.localStorage.getItem(k) === "1";
  } catch {
    /* storage unavailable */
  }
  return out;
};

const PW_KEY = "dyno_pw_nudge_dismissed";
const HANDLE_KEY = "dynopay.claim-handle-banner.dismissed";
const FEE_FREE_KEY = "dyno_fee_free_row_dismissed";
const DISMISS_KEYS = [PW_KEY, HANDLE_KEY, FEE_FREE_KEY];

interface Params {
  overview: DashboardOverview | null | undefined;
  /** Team members see no onboarding / security rows they cannot act on. */
  onboarding: boolean;
  /** Wave 3g (Notifications inbox mirror): keep dismissed rows, flagged `dismissed`, and ALL growth nudges. */
  includeDismissed?: boolean;
}

/** Builds the ordered "Needs attention" list: security → money → configuration → one growth nudge. */
export const useAttentionItems = ({ overview, onboarding, includeDismissed = false }: Params) => {
  const { t, i18n } = useTranslation("dashboardLayout");
  const { selectedCompanyId } = useCompanyStore();
  const profile = useSelector((s: rootReducer) => (s as any).userReducer?.profile);
  const kyc = useKycGate();
  const { enforcement } = useMfaEnforcement();
  const { profile: storefront } = useStorefrontProfile();
  const { data: freeze } = useApiSWR<{ frozen: boolean; until: string | null } | null>(
    onboarding ? API_ENDPOINTS.wallet.securityStatus : null,
    { select: (raw) => raw?.data ?? null, dedupingInterval: 60_000 },
  );
  const { data: counts } = useApiSWR<{ products_out_of_stock: number; referrals_pending: number } | null>(
    selectedCompanyId != null ? `dashboard/action-counts?company_id=${selectedCompanyId}` : null,
    { select: (raw) => raw?.data ?? null, dedupingInterval: 60_000, refreshInterval: 120_000 },
  );

  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setDismissed(readDismissed(DISMISS_KEYS));
  }, []);
  const dismiss = useCallback((key: string) => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setDismissed((d) => ({ ...d, [key]: true }));
  }, []);
  const restore = useCallback((key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setDismissed((d) => ({ ...d, [key]: false }));
  }, []);
  const show = (key: string) => includeDismissed || !dismissed[key];

  const items = useMemo<AttentionItem[]>(() => {
    const list: AttentionItem[] = [];
    const sym = overview?.currency_symbol || "$";
    const cur = overview?.currency || "USD";

    // ── 1. Security & compliance ─────────────────────────────────────────
    if (onboarding && kyc.required) {
      list.push({
        id: "kyc",
        group: "security",
        severity: kyc.blocked ? "critical" : "warning",
        icon: "shield-check",
        text: kyc.blocked
          ? t("kyc.blockedTitle", { defaultValue: "Verification overdue — payments are paused" })
          : kyc.daysRemaining != null
            ? t("command.kycDays", { count: kyc.daysRemaining, defaultValue: "Verify your identity within {{count}} days to keep processing payments" })
            : t("kyc.graceGeneric", { defaultValue: "Verify your identity to keep processing payments" }),
        actionLabel: kyc.hasSession
          ? t("kyc.continueVerification", { defaultValue: "Continue verification" })
          : t("kyc.startVerification", { defaultValue: "Start verification" }),
        href: "/kyc",
        testId: "attention-kyc",
      });
    }
    if (onboarding && enforcement && !enforcement.enrolled) {
      list.push({
        id: "mfa",
        group: "security",
        severity: enforcement.hard_wall ? "critical" : "warning",
        icon: "shield",
        text: enforcement.hard_wall
          ? t("command.mfaRequired", { defaultValue: "Two-step verification is now required to keep using Dynopay" })
          : t("command.mfaDays", { count: enforcement.days_left ?? 0, defaultValue: "Two-step verification becomes required in {{count}} days" }),
        actionLabel: t("command.setUp", { defaultValue: "Set up" }),
        href: "/settings?section=profile",
        testId: "attention-mfa",
      });
    }
    if (onboarding && freeze?.frozen) {
      list.push({
        id: "freeze",
        group: "security",
        severity: "warning",
        icon: "lock",
        text: freeze.until
          ? t("command.walletFrozenUntil", { until: new Date(freeze.until).toLocaleString(i18n.language, { weekday: "short", hour: "2-digit", minute: "2-digit" }), defaultValue: "Payout address changes are frozen until {{until}} after a security reset" })
          : t("command.walletFrozen", { defaultValue: "Payout address changes are frozen after a security reset" }),
        actionLabel: t("command.viewSecurity", { defaultValue: "View security" }),
        href: "/settings?section=security",
        testId: "attention-wallet-frozen",
      });
    }
    if (onboarding && profile?.user_id && profile.has_password === false && show(PW_KEY)) {
      list.push({
        id: "password",
        group: "security",
        severity: "info",
        icon: "key-round",
        text: t("command.noPassword", { defaultValue: "You sign in with a one-time code — set a password to sign in instantly" }),
        actionLabel: t("pwNudge.cta", { defaultValue: "Set a password" }),
        href: "/settings?section=profile",
        dismissKey: PW_KEY,
        dismissed: !!dismissed[PW_KEY],
        testId: "attention-password",
      });
    }

    // ── 2. Money exceptions ──────────────────────────────────────────────
    const a = overview?.attention;
    if (a) {
      if (a.underpaid_open > 0) {
        list.push({
          id: "underpaid",
          group: "money",
          severity: "warning",
          icon: "circle-alert",
          text: t("command.underpaid", { count: a.underpaid_open, defaultValue: "{{count}} underpaid payments are waiting for your decision" }),
          actionLabel: t("command.review", { defaultValue: "Review" }),
          href: "/transactions?status=underpaid",
          testId: "attention-underpaid",
        });
      }
      if (a.confirming_stale > 0) {
        list.push({
          id: "stale",
          group: "money",
          severity: "warning",
          icon: "hourglass",
          text: t("command.confirmingStale", { count: a.confirming_stale, defaultValue: "{{count}} payments have been confirming for over an hour" }),
          actionLabel: t("command.view", { defaultValue: "View" }),
          href: "/transactions?status=needs_action",
          testId: "attention-confirming-stale",
        });
      }
      if (a.expired_today.count > 0) {
        list.push({
          id: "expired",
          group: "money",
          severity: "info",
          icon: "timer-off",
          text: t("command.expiredToday", {
            count: a.expired_today.count,
            amount: money(a.expired_today.amount, sym, cur),
            defaultValue: "{{count}} checkouts expired unpaid today (≈ {{amount}})",
          }),
          actionLabel: t("command.view", { defaultValue: "View" }),
          href: "/transactions?status=unpaid&range=today",
          testId: "attention-expired-today",
        });
      }

      // ── 3. Configuration gaps ──────────────────────────────────────────
      if (a.coins_without_wallet.length > 0) {
        list.push({
          id: "coins",
          group: "config",
          severity: "warning",
          icon: "wallet",
          text: t("command.coinsNoWallet", { coins: a.coins_without_wallet.join(", "), defaultValue: "Live links accept {{coins}} but you have no payout address for them" }),
          actionLabel: t("command.addWallet", { defaultValue: "Add payout address" }),
          href: "/wallet",
          testId: "attention-coins-no-wallet",
        });
      }
      if (a.webhook_failures_24h > 0) {
        list.push({
          id: "webhooks",
          group: "config",
          severity: "warning",
          icon: "webhook",
          text: t("command.webhookFailures", { count: a.webhook_failures_24h, defaultValue: "{{count}} webhook deliveries failed in the last 24 hours" }),
          actionLabel: t("command.inspect", { defaultValue: "Inspect" }),
          href: "/developer-keys",
          testId: "attention-webhooks",
        });
      }
      if (a.stale_api_keys.length > 0) {
        const k = a.stale_api_keys[0];
        list.push({
          id: "apikey",
          group: "config",
          severity: "info",
          icon: "key",
          text: t("command.staleApiKey", { hint: k.hint ? `…${k.hint}` : k.name || "", months: Math.floor(k.age_days / 30), defaultValue: "API key {{hint}} is {{months}} months old — rotate it" }),
          actionLabel: t("command.rotate", { defaultValue: "Rotate" }),
          href: "/developer-keys",
          testId: "attention-api-key",
        });
      }
      if ((counts?.products_out_of_stock ?? 0) > 0) {
        list.push({
          id: "stock",
          group: "config",
          severity: "info",
          icon: "package-x",
          text: t("command.outOfStock", { count: counts!.products_out_of_stock, defaultValue: "{{count}} live products are out of stock" }),
          actionLabel: t("command.restock", { defaultValue: "Restock" }),
          href: "/pay-links/products",
          testId: "attention-out-of-stock",
        });
      }
      if (a.paylinks_expiring_48h > 0) {
        list.push({
          id: "expiring",
          group: "config",
          severity: "info",
          icon: "link",
          text: t("command.linksExpiring", { count: a.paylinks_expiring_48h, defaultValue: "{{count}} payment links expire within 48 hours, still unpaid" }),
          actionLabel: t("command.view", { defaultValue: "View" }),
          href: "/pay-links",
          testId: "attention-links-expiring",
        });
      }
    }

    // ── 4. One growth nudge, always last ─────────────────────────────────
    const growth: AttentionItem[] = [];
    if (onboarding && storefront && !storefront.storefront_pending && !storefront.handle && show(HANDLE_KEY)) {
      growth.push({
        id: "handle",
        group: "growth",
        severity: "info",
        icon: "at-sign",
        text: t("command.claimHandle", { defaultValue: "Reserve your dynopay.com handle so your public page and checkout URL go live" }),
        actionLabel: t("command.claim", { defaultValue: "Claim" }),
        href: "/storefront",
        dismissKey: HANDLE_KEY,
        dismissed: !!dismissed[HANDLE_KEY],
        testId: "attention-claim-handle",
      });
    }
    if ((counts?.referrals_pending ?? 0) > 0) {
      growth.push({
        id: "referral",
        group: "growth",
        severity: "info",
        icon: "gift",
        text: t("command.referralPending", { count: counts!.referrals_pending, defaultValue: "{{count}} referral rewards are on their way to you" }),
        actionLabel: t("command.view", { defaultValue: "View" }),
        href: "/referrals",
        testId: "attention-referral",
      });
    }
    const feeFree = Number(profile?.fee_free_remaining_usd ?? profile?.feeFreeRemainingUsd ?? NaN);
    if (Number.isFinite(feeFree) && feeFree > 0 && show(FEE_FREE_KEY)) {
      growth.push({
        id: "feefree",
        group: "growth",
        severity: "info",
        icon: "sparkles",
        text: t("command.feeFree", { amount: money(feeFree, "$", "USD", 0), defaultValue: "{{amount}} of fee-free volume is still unused" }),
        actionLabel: t("command.createLink", { defaultValue: "Create a link" }),
        href: "/create-pay-link",
        dismissKey: FEE_FREE_KEY,
        dismissed: !!dismissed[FEE_FREE_KEY],
        testId: "attention-fee-free",
      });
    }
    if (includeDismissed) list.push(...growth);
    else if (growth[0]) list.push(growth[0]);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, onboarding, includeDismissed, kyc.required, kyc.blocked, kyc.daysRemaining, kyc.hasSession, enforcement, freeze, profile, dismissed, counts, storefront, t, i18n.language]);

  return { items, dismiss, restore };
};

export default useAttentionItems;
