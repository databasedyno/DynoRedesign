import adminBaseApi from "@/axiosAdmin";

export type SettingSource = "override" | "env" | "default";
export type SettingType = "boolean" | "number" | "string" | "enum" | "csv";

export interface PlatformSetting {
  key: string;
  group: string;
  label: string;
  description?: string;
  type: SettingType;
  unit?: string;
  enumValues?: string[];
  min?: number;
  max?: number;
  editable: boolean;
  requiresStepUp: boolean;
  danger: boolean;
  secret: boolean;
  value: unknown;
  source: SettingSource;
  env_key: string | null;
  default: unknown;
  updated_by: string | null;
  updated_at: string | null;
  version: number | null;
}

export interface SettingGroup {
  id: string;
  label: string;
  description?: string;
  settings: PlatformSetting[];
}

export interface SettingHistoryRow {
  history_id: number;
  key: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  reason: string | null;
  changed_at: string;
}

/** Reason passed to the admin step-up grant for any settings write. */
export const SETTINGS_STEPUP_REASON = "platform-settings";

export const platformSettingsApi = {
  getAll: async (): Promise<SettingGroup[]> =>
    (await adminBaseApi.get("/admin/settings")).data.data.groups,

  /** Verify TOTP and mint a one-use step-up grant for settings writes. */
  stepUp: async (code: string): Promise<string> =>
    (await adminBaseApi.post("/admin/step-up", { reason: SETTINGS_STEPUP_REASON, code })).data.data.stepUpToken,

  update: async (key: string, value: unknown, reason: string, stepUpToken: string): Promise<PlatformSetting> =>
    (
      await adminBaseApi.put(`/admin/settings/${encodeURIComponent(key)}`, { value, reason }, { headers: { "x-admin-step-up": stepUpToken } })
    ).data.data,

  revert: async (key: string, reason: string, stepUpToken: string): Promise<PlatformSetting> =>
    (
      await adminBaseApi.post(`/admin/settings/${encodeURIComponent(key)}/revert`, { reason }, { headers: { "x-admin-step-up": stepUpToken } })
    ).data.data,

  history: async (key?: string, limit = 100): Promise<SettingHistoryRow[]> =>
    (await adminBaseApi.get("/admin/settings/history", { params: { key, limit } })).data.data.history,
};

export default platformSettingsApi;
