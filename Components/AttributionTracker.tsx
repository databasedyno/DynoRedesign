import { useEffect } from "react";
import { useRouter } from "next/router";
import { captureFirstTouch, syncAttribution } from "@/utils/attribution";

/**
 * Invisible first-touch attribution tracker. Captures the referrer/UTM on the
 * first landing (once) and syncs it to the backend once the visitor is
 * authenticated. Rendered globally in _app; renders nothing.
 */
export default function AttributionTracker(): null {
  const router = useRouter();
  useEffect(() => {
    captureFirstTouch();
    syncAttribution();
  }, [router.asPath]);
  return null;
}
