
export const TOAST_INIT: any = "TOAST_INIT";
export const TOAST_SHOW = "TOAST_SHOW";
export const TOAST_HIDE = "TOAST_HIDE";
// Dismiss a single toast from the stack by id (used by the countdown/close UI).
export const TOAST_HIDE_ONE = "TOAST_HIDE_ONE";

export const ToastAction = ({ type, payload }: { type: string; payload?: any }) => ({
  type,
  payload
});
