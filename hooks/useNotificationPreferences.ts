import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useState, useEffect, useCallback } from "react";
import axiosBaseApi from "@/axiosConfig";

interface NotificationPreferences {
  transactionUpdates: boolean;
  paymentReceived: boolean;
  weeklySummary: boolean;
  securityAlerts: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

const defaultPreferences: NotificationPreferences = {
  transactionUpdates: true,
  paymentReceived: false,
  weeklySummary: true,
  securityAlerts: false,
  emailNotifications: true,
  smsNotifications: false,
};

// Company-scoped email ROUTING config (migration 0018). Governs where the
// business's operational emails (payments/payouts/orders/config/digests) go,
// separate from the per-user account (security) emails above.
export type NotificationCategoryKey =
  | "payments"
  | "payouts"
  | "orders"
  | "config"
  | "digests"
  | "confirming";

export interface CompanyRouting {
  notificationEmail: string;
  teamFanout: boolean;
  categories: Record<NotificationCategoryKey, boolean>;
}

const defaultRouting: CompanyRouting = {
  notificationEmail: "",
  teamFanout: true,
  categories: {
    payments: true,
    payouts: true,
    orders: true,
    config: true,
    digests: true,
    confirming: false,
  },
};

// Backend uses snake_case keys; the frontend hook exposes camelCase to consumers.
// These mappers are the single source of truth for the naming translation.
type BackendPreferences = {
  transaction_updates?: boolean;
  payment_received?: boolean;
  weekly_summary?: boolean;
  security_alerts?: boolean;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  company_notification_email?: string | null;
  company_notification_prefs?: {
    team_fanout?: boolean;
    categories?: Partial<Record<NotificationCategoryKey, boolean>>;
  } | null;
};

const fromBackend = (b: BackendPreferences | undefined | null): NotificationPreferences => ({
  transactionUpdates: b?.transaction_updates ?? defaultPreferences.transactionUpdates,
  paymentReceived: b?.payment_received ?? defaultPreferences.paymentReceived,
  weeklySummary: b?.weekly_summary ?? defaultPreferences.weeklySummary,
  securityAlerts: b?.security_alerts ?? defaultPreferences.securityAlerts,
  emailNotifications: b?.email_notifications ?? defaultPreferences.emailNotifications,
  smsNotifications: b?.sms_notifications ?? defaultPreferences.smsNotifications,
});

const toBackend = (p: NotificationPreferences): BackendPreferences => ({
  transaction_updates: p.transactionUpdates,
  payment_received: p.paymentReceived,
  weekly_summary: p.weeklySummary,
  security_alerts: p.securityAlerts,
  email_notifications: p.emailNotifications,
  sms_notifications: p.smsNotifications,
});

// Missing flags default to ENABLED (true) so a fresh company opts INTO every
// category + team fan-out, matching the backend resolver's "missing => on".
const routingFromBackend = (b: BackendPreferences | undefined | null): CompanyRouting => {
  const prefs = b?.company_notification_prefs || {};
  const cats = prefs.categories || {};
  return {
    notificationEmail: b?.company_notification_email ?? "",
    teamFanout: prefs.team_fanout !== false,
    categories: {
      payments: cats.payments !== false,
      payouts: cats.payouts !== false,
      orders: cats.orders !== false,
      config: cats.config !== false,
      digests: cats.digests !== false,
      // Opt-IN: per-confirmation progress emails are off unless explicitly enabled.
      confirming: cats.confirming === true,
    },
  };
};

const routingToBackend = (r: CompanyRouting) => ({
  company_notification_email:
    r.notificationEmail.trim() === "" ? null : r.notificationEmail.trim(),
  company_notification_prefs: {
    team_fanout: r.teamFanout,
    categories: { ...r.categories },
  },
});

export const isValidEmail = (e: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export const useNotificationPreferences = () => {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
  const [routing, setRouting] = useState<CompanyRouting>(defaultRouting);
  // Last persisted snapshot — drives the Settings "unsaved changes" indicator.
  const [saved, setSaved] = useState<{ preferences: NotificationPreferences; routing: CompanyRouting }>({
    preferences: defaultPreferences,
    routing: defaultRouting,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCompanyId = useCompanyStore().selectedCompanyId;

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (selectedCompanyId) params.company_id = selectedCompanyId;
      const response = await axiosBaseApi.get("/notifications/preferences", { params });
      // Backend response shape: { message, data: { transaction_updates, payment_received, ... } }
      // (successResponseHelper does NOT emit a `status` field — 2xx / presence of `data` = success.)
      const raw = response?.data?.data as BackendPreferences | undefined;
      if (raw) {
        const prefs = fromBackend(raw);
        const r = routingFromBackend(raw);
        setPreferences(prefs);
        setRouting(r);
        setSaved({ preferences: prefs, routing: r });
      }
    } catch (err) {
      console.error("Failed to fetch notification preferences:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences, selectedCompanyId]);

  const savePreferences = useCallback(async (prefs: NotificationPreferences) => {
    setSaving(true);
    setError(null);
    try {
      // Translate camelCase (UI) → snake_case (backend contract).
      const body: Record<string, any> = { ...toBackend(prefs) };
      if (selectedCompanyId) {
        body.company_id = selectedCompanyId;
        // Company-scoped routing (0018) travels with the same PUT.
        Object.assign(body, routingToBackend(routing));
      }
      const response = await axiosBaseApi.put("/notifications/preferences", body);
      // Axios only reaches this branch on a 2xx response. Treat any 2xx as success —
      // successResponseHelper returns { message, data } with no explicit `status` flag.
      const isSuccess =
        (response?.status !== undefined && response.status >= 200 && response.status < 300) ||
        !!response?.data?.data;
      if (isSuccess) {
        // Reflect saved state; prefer backend echo when present (defensive against server-side
        // coercion), otherwise trust the UI values we just POSTed.
        const echoed = response?.data?.data as BackendPreferences | undefined;
        const persisted = echoed ? fromBackend(echoed) : prefs;
        setPreferences(persisted);
        setSaved({ preferences: persisted, routing });
        return true;
      }
      setError(response?.data?.message || "Failed to save preferences");
      return false;
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to save preferences";
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [selectedCompanyId, routing]);

  const updatePreference = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateRouting = useCallback((partial: Partial<CompanyRouting>) => {
    setRouting((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateRoutingCategory = useCallback(
    (key: NotificationCategoryKey, value: boolean) => {
      setRouting((prev) => ({
        ...prev,
        categories: { ...prev.categories, [key]: value },
      }));
    },
    []
  );

  const isDirty =
    !loading &&
    (JSON.stringify(preferences) !== JSON.stringify(saved.preferences) ||
      JSON.stringify(routing) !== JSON.stringify(saved.routing));

  return {
    preferences,
    routing,
    loading,
    saving,
    error,
    isDirty,
    updatePreference,
    updateRouting,
    updateRoutingCategory,
    savePreferences,
    fetchPreferences,
  };
};
