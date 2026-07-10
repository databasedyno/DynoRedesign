// DynoPay Push Notification Service Worker
// This runs in the background and handles push events even when the app tab is closed

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "DynoPay",
      body: event.data.text(),
    };
  }

  const options = {
    body: payload.body || "You have a new notification",
    icon: payload.icon || "/dynopay-icon-192.png",
    badge: payload.badge || "/dynopay-badge-72.png",
    tag: payload.tag || "dynopay-notification",
    data: payload.data || {},
    vibrate: [100, 50, 100],
    actions: [
      { action: "open", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "DynoPay", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const urlToOpen = event.notification.data?.url || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a DynoPay tab is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Otherwise, open a new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Re-subscribe if the subscription changes
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: self.__VAPID_PUBLIC_KEY,
      })
      .then((subscription) => {
        // Send the new subscription to the server
        return fetch("/api/notifications/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
      })
  );
});
