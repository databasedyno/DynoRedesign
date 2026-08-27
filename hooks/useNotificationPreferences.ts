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

// Backend uses snake_case keys; the frontend hook exposes camelCase to consumers.
// These mappers are the single source of truth for the naming translation.
type BackendPreferences = {
  transaction_updates?: boolean;
  payment_received?: boolean;
  weekly_summary?: boolean;
  security_alerts?: boolean;
  email_notifications?: boolean;
  sms_notifications?: boolean;
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

export const useNotificationPreferences = () => {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
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
        setPreferences(fromBackend(raw));
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
      if (selectedCompanyId) body.company_id = selectedCompanyId;
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
        setPreferences(echoed ? fromBackend(echoed) : prefs);
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
  }, [selectedCompanyId]);

  const updatePreference = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return {
    preferences,
    loading,
    saving,
    error,
    updatePreference,
    savePreferences,
    fetchPreferences,
  };
};
