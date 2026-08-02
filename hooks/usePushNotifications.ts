import { useState, useEffect, useCallback } from "react";
import axiosBaseApi from "@/axiosConfig";

type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(isSupported);

    if (!isSupported) {
      setPermission("unsupported");
      return;
    }

    // Check current permission state
    setPermission(Notification.permission as PushPermissionState);

    // Check if already subscribed
    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    setLoading(true);
    try {
      // 1. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermissionState);

      if (perm !== "granted") {
        setLoading(false);
        return false;
      }

      // 2. Register service worker
      const registration = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;

      // 3. Get VAPID public key from server
      const vapidRes = await axiosBaseApi.get("/notifications/push/vapid-key");
      const vapidPublicKey = vapidRes?.data?.data?.vapid_public_key;

      if (!vapidPublicKey) {
        console.error("[Push] No VAPID key from server");
        setLoading(false);
        return false;
      }

      // 4. Subscribe to push
      // The `applicationServerKey` type accepts BufferSource; TS lib.dom
      // narrowed it in newer TS/lib versions. Cast the Uint8Array to
      // BufferSource to satisfy both old and new type defs.
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      });

      // 5. Send subscription to backend
      const response = await axiosBaseApi.post("/notifications/push/subscribe", {
        subscription: subscription.toJSON(),
      });

      if (response?.data?.status) {
        setIsSubscribed(true);
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
      setLoading(false);
      return false;
    }
  }, [supported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from backend
        await axiosBaseApi.post("/notifications/push/unsubscribe", {
          endpoint: subscription.endpoint,
        });
      }

      setIsSubscribed(false);
      setLoading(false);
      return true;
    } catch (err) {
      console.error("[Push] Unsubscribe error:", err);
      setLoading(false);
      return false;
    }
  }, [supported]);

  return {
    permission,
    isSubscribed,
    loading,
    supported,
    subscribe,
    unsubscribe,
  };
};

/**
 * Convert a base64 VAPID key to Uint8Array for applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
