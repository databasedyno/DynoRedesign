import { IToastProps } from "@/utils/types";

export const TOAST_INIT: any = "TOAST_INIT";
export const TOAST_SHOW = "TOAST_SHOW";
export const TOAST_HIDE = "TOAST_HIDE";

export const ToastAction = ({ type, payload }: { type: string; payload?: any }) => ({
  type,
  payload
});
