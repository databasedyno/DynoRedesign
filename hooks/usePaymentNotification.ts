import { useCallback, useEffect, useState } from 'react'

/**
 * usePaymentNotification — thin wrapper around the browser Notifications API
 * used on the public checkout surfaces (crypto checkout, creator tip, store
 * checkout). It lets a buyer opt-in to a "Payment confirmed" browser alert so
 * they can switch tabs while the network confirms and still be pinged the
 * moment it settles.
 *
 * No service worker / VAPID / server push is involved — the checkout tab stays
 * open and fires a foreground Notification on the confirmed transition. That is
 * exactly the "switch tabs without worrying" use case the buyer needs.
 */
type Perm = 'default' | 'granted' | 'denied' | 'unsupported'

function readPerm(): Perm {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission as Perm
}

export function usePaymentNotification() {
  const [permission, setPermission] = useState<Perm>('unsupported')

  useEffect(() => {
    setPermission(readPerm())
  }, [])

  const supported = permission !== 'unsupported'

  /** Request permission — MUST be called from a user gesture (button click). */
  const requestPermission = useCallback(async (): Promise<Perm> => {
    if (typeof Notification === 'undefined') return 'unsupported'
    if (Notification.permission !== 'default') {
      setPermission(Notification.permission as Perm)
      return Notification.permission as Perm
    }
    try {
      const res = await Notification.requestPermission()
      setPermission(res as Perm)
      return res as Perm
    } catch {
      const p = readPerm()
      setPermission(p)
      return p
    }
  }, [])

  /** Fire a notification if (and only if) permission is granted. Safe no-op otherwise. */
  const notify = useCallback((title: string, body: string) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    try {
      const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'dynopay-payment-confirmed',
        // renotify isn't in the TS lib DOM types on all versions.
        renotify: true,
      } as NotificationOptions & { renotify?: boolean })
      n.onclick = () => {
        try {
          window.focus()
        } catch {
          /* ignore */
        }
        n.close()
      }
    } catch {
      /* some engines throw when constructing outside a SW — ignore, non-critical */
    }
  }, [])

  return { supported, permission, requestPermission, notify }
}

export default usePaymentNotification
