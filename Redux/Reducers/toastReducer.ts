import { TOAST_HIDE, TOAST_HIDE_ONE, TOAST_SHOW } from "../Actions/ToastAction";
import { IToastItem } from "@/utils/types";

// Queue-based toast state.
// - Keeps the SAME public API (dispatch {type: TOAST_SHOW, payload:{message, severity,...}}).
// - Stacks up to MAX_STACK toasts (newest at the bottom), drops the oldest.
// - De-duplicates an identical (message+severity) toast fired within DEDUPE_MS
//   (many sagas dispatch twice).
// - A non-loading toast REPLACES a still-showing loading toast (loading -> result),
//   instead of stacking on top of it.
interface ToastState {
  queue: IToastItem[];
}

const MAX_STACK = 3;
const DEDUPE_MS = 1000;

const ToastInitialState: ToastState = {
  queue: [],
};

let seq = 0;
const makeId = () => `toast-${Date.now()}-${seq++}`;

const toastReducer = (state: ToastState = ToastInitialState, action: any): ToastState => {
  const { payload } = action;

  switch (action.type) {
    case TOAST_SHOW: {
      if (!payload) return state;
      const now = Date.now();
      const severity = payload.severity === "error" ? "error" : payload.severity || "success";
      const loading = payload.loading ?? false;

      // De-dupe identical message+severity fired within DEDUPE_MS.
      const dup = state.queue.find(
        (t) =>
          t.message === payload.message &&
          t.severity === severity &&
          !!t.loading === !!loading &&
          now - (t.createdAt || 0) < DEDUPE_MS
      );
      if (dup) return state;

      const item: IToastItem = {
        id: makeId(),
        open: true,
        message: payload.message,
        severity,
        loading,
        placement: payload.placement || "bottom-right",
        durationMs: payload.durationMs,
        action: payload.action,
        createdAt: now,
      };

      // A result toast supersedes a still-visible loading toast.
      let next = state.queue;
      if (!loading) {
        next = next.filter((t) => !t.loading);
      }

      next = [...next, item];
      if (next.length > MAX_STACK) next = next.slice(next.length - MAX_STACK);
      return { queue: next };
    }

    case TOAST_HIDE_ONE: {
      const id = payload?.id;
      if (!id) return state;
      return { queue: state.queue.filter((t) => t.id !== id) };
    }

    case TOAST_HIDE:
      return { queue: [] };

    default:
      return state;
  }
};

export default toastReducer;
