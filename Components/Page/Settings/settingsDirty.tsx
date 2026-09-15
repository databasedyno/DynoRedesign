import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";

export type SettingsSectionKey = "profile" | "security" | "company" | "payments" | "tax" | "notifications" | "team" | "plan" | "language";

type Reporters = Partial<Record<SettingsSectionKey, Record<string, boolean>>>;

interface Ctx {
  /** true when at least one form inside the section has unsaved edits */
  dirty: Partial<Record<SettingsSectionKey, boolean>>;
  report: (section: SettingsSectionKey, id: string, dirty: boolean) => void;
}

const SettingsDirtyContext = createContext<Ctx | null>(null);

/** Tracks unsaved edits per Settings section (plan 3.7). Several forms may report into one section. */
export const SettingsDirtyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reporters, setReporters] = useState<Reporters>({});
  const report = useCallback((section: SettingsSectionKey, id: string, isDirty: boolean) => {
    setReporters((prev) => {
      const cur = prev[section] || {};
      if ((cur[id] ?? false) === isDirty) return prev;
      return { ...prev, [section]: { ...cur, [id]: isDirty } };
    });
  }, []);
  const dirty = useMemo(() => {
    const out: Partial<Record<SettingsSectionKey, boolean>> = {};
    (Object.keys(reporters) as SettingsSectionKey[]).forEach((k) => {
      out[k] = Object.values(reporters[k] || {}).some(Boolean);
    });
    return out;
  }, [reporters]);
  const value = useMemo(() => ({ dirty, report }), [dirty, report]);
  return <SettingsDirtyContext.Provider value={value}>{children}</SettingsDirtyContext.Provider>;
};

export const useSettingsDirty = () => useContext(SettingsDirtyContext);

/** Report this form's unsaved state into a Settings section. No-op outside /settings (ctx null) or without a section. */
export const useReportDirty = (section: SettingsSectionKey | undefined, isDirty: boolean) => {
  const ctx = useContext(SettingsDirtyContext);
  const id = useId();
  const report = ctx?.report;
  useEffect(() => {
    if (!report || !section) return;
    report(section, id, isDirty);
  }, [report, section, id, isDirty]);
  useEffect(() => {
    if (!report || !section) return;
    return () => report(section, id, false);
  }, [report, section, id]);
};

/** Render-prop friendly reporter (for forms whose values only exist inside a render callback). */
export const DirtyReporter: React.FC<{ section?: SettingsSectionKey; dirty: boolean }> = ({ section, dirty }) => {
  useReportDirty(section, dirty);
  return null;
};
