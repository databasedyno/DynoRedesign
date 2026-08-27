import { useSyncExternalStore } from "react";
import type { AlertColor } from "@mui/material";

/**
 * toastStore — module-store replacement for the old Redux `toastReducer` +
 * `ToastSaga` (REFACTOR Part D / Phase 2, Wave 6 — the LAST redux-saga slice).
 *
 * The global toast is a single, app-wide ephemeral notification. A tiny module
 * store + `useSyncExternalStore` gives the exact old redux semantics (one source
 * of truth, synchronous updates, stable snapshot identity) with no Provider.
 *
 * `showToast(payload)` is the drop-in for `dispatch({ type: TOAST_SHOW, payload })`
 * and `hideToast()` for `dispatch({ type: TOAST_HIDE })`. Both are plain functions
 * usable from anywhere (component or not). The renderer reads `useToast()`.
 */

export interface ToastState {
  open: boolean;
  message: string;
  severity: AlertColor | "";
  loading: boolean;
}

export interface ToastPayload {
  message?: string;
  severity?: string;
  loading?: boolean;
  /** Mirrors the old ToastSaga: `hide: true` clears the toast. */
  hide?: boolean;
}

const initialState: ToastState = {
  open: false,
  message: "",
  severity: "",
  loading: false,
};

let state: ToastState = { ...initialState };
const listeners = new Set<() => void>();
const emit = (): void => {
  listeners.forEach((l) => l());
};

/** Was dispatch({ type: TOAST_SHOW, payload }). */
export const showToast = (payload: ToastPayload = {}): void => {
  if (payload.hide) {
    hideToast();
    return;
  }
  state = {
    open: true,
    message: payload.message ?? "",
    // Preserve "error" explicitly; default to "success" when not provided
    // (identical to the old toastReducer).
    severity:
      payload.severity === "error"
        ? "error"
        : ((payload.severity as AlertColor) || "success"),
    loading: payload.loading ?? false,
  };
  emit();
};

/** Was dispatch({ type: TOAST_HIDE }). */
export const hideToast = (): void => {
  state = { ...initialState };
  emit();
};

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = (): ToastState => state;

/** Reactive read of the current toast (renderer). */
export const useToast = (): ToastState =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
