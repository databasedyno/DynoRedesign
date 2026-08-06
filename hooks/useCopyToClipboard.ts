import { useCallback, useEffect, useRef, useState } from "react";
import copyToClipboard from "@/helpers/copyToClipboard";

/**
 * Clipboard copy hook backed by the robust `copyToClipboard` helper (async
 * Clipboard API + legacy execCommand fallback). Unlike the fire-and-forget
 * `navigator.clipboard.writeText` calls sprinkled across the app, `copy`
 * resolves to whether the text actually landed on the clipboard, so callers
 * can show an accurate success/error toast. `copied` auto-resets after
 * `resetAfterMs` for the common "Copy → Copied ✓" button affordance.
 */
export function useCopyToClipboard(resetAfterMs = 1800) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const ok = await copyToClipboard(text);
      if (ok) {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), resetAfterMs);
      }
      return ok;
    },
    [resetAfterMs],
  );

  return { copied, copy };
}

export default useCopyToClipboard;
