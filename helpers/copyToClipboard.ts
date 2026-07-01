/**
 * Robust clipboard copy helper.
 *
 * `navigator.clipboard.writeText` silently rejects (or is undefined) in several
 * real-world contexts: non-secure origins, iframes without the clipboard-write
 * permission, or when the document isn't focused. Previously copy buttons called
 * it fire-and-forget and always showed a "copied" toast even when nothing landed
 * on the clipboard.
 *
 * This helper tries the async Clipboard API first, then falls back to the legacy
 * execCommand("copy") technique, and returns whether the copy actually succeeded
 * so callers can show an accurate success/error toast.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || typeof text !== "string") return false;

  // 1) Modern async Clipboard API (requires a secure context + focus)
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function" &&
      (typeof window === "undefined" || window.isSecureContext)
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy fallback
  }

  // 2) Legacy fallback — hidden textarea + execCommand("copy")
  try {
    if (typeof document === "undefined") return false;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default copyToClipboard;
