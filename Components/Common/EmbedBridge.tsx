import { useEffect, useRef } from "react";

/**
 * EmbedBridge
 * -----------
 * Rendered by Pay3Layout when the checkout is running inside a cross-origin
 * iframe (Dynopay Embedded Checkout, mounted via /v1/embed.js). It posts
 * lightweight UI events to the parent window so the host page can auto-size
 * the iframe and react to lifecycle:
 *
 *   { source:'dynopay', v:1, type:'dynopay:ready' }
 *   { source:'dynopay', v:1, type:'dynopay:resize', height:<px> }
 *
 * Payment success / redirect events are posted from the checkout page itself
 * (pages/pay) because they depend on payment state. These messages carry NO
 * secrets — the webhook remains the source of truth for order fulfillment.
 */
export default function EmbedBridge() {
  const lastHeight = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only act when actually embedded inside a different frame.
    if (window.parent === window.self) return;

    const post = (msg: Record<string, unknown>) => {
      try {
        window.parent.postMessage({ source: "dynopay", v: 1, ...msg }, "*");
      } catch {
        /* ignore */
      }
    };

    post({ type: "dynopay:ready" });

    const measure = () => {
      const h = Math.ceil(
        document.documentElement.getBoundingClientRect().height
      );
      if (h && h !== lastHeight.current) {
        lastHeight.current = h;
        post({ type: "dynopay:resize", height: h });
      }
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => window.requestAnimationFrame(measure));
      ro.observe(document.documentElement);
    }
    window.addEventListener("load", measure);
    const interval = window.setInterval(measure, 1000);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("load", measure);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
