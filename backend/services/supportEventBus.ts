/**
 * Support escalation event bus (leaf module — only Node 'events').
 *
 * A tiny in-process EventEmitter fan-out used to push a REAL-TIME alert to
 * connected admins the moment a visitor explicitly escalates a support chat
 * ("Talk to a human"). The public escalate endpoint publishes here; the admin
 * Support Inbox SSE stream (controller/supportInboxController.ts `stream`)
 * subscribes and forwards each event to every connected admin browser.
 *
 * Nothing is persisted here — escalation state already lives on the session row
 * (escalated flag + admin_unread). This bus only carries the live "ping".
 */
import { EventEmitter } from "events";

export interface SupportEscalationEvent {
  session_id: string;
  contact_email: string | null;
  note: string | null;
  user_id: number | null;
  at: string; // ISO timestamp
}

const CHANNEL = "escalation";
const bus = new EventEmitter();
// Many admins can watch the inbox at once; never warn about listener count.
bus.setMaxListeners(0);

/** Fan a new escalation out to every subscribed admin stream (never throws). */
export const publishSupportEscalation = (event: SupportEscalationEvent): void => {
  try {
    bus.emit(CHANNEL, event);
  } catch {
    /* non-fatal — a live alert must never break the escalate request */
  }
};

/** Subscribe to escalations. Returns an unsubscribe fn (call on stream close). */
export const subscribeSupportEscalations = (
  cb: (event: SupportEscalationEvent) => void,
): (() => void) => {
  bus.on(CHANNEL, cb);
  return () => {
    bus.off(CHANNEL, cb);
  };
};
