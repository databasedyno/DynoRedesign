import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * Shared, translated relative-time formatter ("just now / 5m ago / 3h ago").
 *
 * All surfaces (dashboard feeds, donation walls, notifications, payouts,
 * profile activity, checkout rate freshness) should use THIS hook instead of
 * re-implementing a local hardcoded-English `timeAgo`, so relative timestamps
 * render in the merchant's / buyer's selected language everywhere.
 *
 * Strings live under the `relativeTime.*` keys in `common.json` (all 6 locales).
 */
export function useRelativeTime() {
  const { t } = useTranslation("common");

  const format = useCallback(
    (input: number | string | Date | null | undefined): string => {
      if (input === null || input === undefined || input === "") return "";
      const ms =
        input instanceof Date
          ? input.getTime()
          : typeof input === "number"
            ? input
            : new Date(input).getTime();
      if (!Number.isFinite(ms)) return "";

      const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
      if (s < 45) return t("relativeTime.justNow", { defaultValue: "just now" });
      if (s < 60) return t("relativeTime.secondsAgo", { count: s, defaultValue: `${s}s ago` });
      const m = Math.floor(s / 60);
      if (m < 60) return t("relativeTime.minutesAgo", { count: m, defaultValue: `${m}m ago` });
      const h = Math.floor(m / 60);
      if (h < 24) return t("relativeTime.hoursAgo", { count: h, defaultValue: `${h}h ago` });
      const d = Math.floor(h / 24);
      if (d < 30) return t("relativeTime.daysAgo", { count: d, defaultValue: `${d}d ago` });
      const mo = Math.floor(d / 30);
      return t("relativeTime.monthsAgo", { count: mo, defaultValue: `${mo}mo ago` });
    },
    [t]
  );

  return format;
}

export default useRelativeTime;
