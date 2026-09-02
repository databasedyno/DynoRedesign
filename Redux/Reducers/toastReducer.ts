import { TOAST_HIDE, TOAST_SHOW } from "../Actions/ToastAction";

const ToastInitialState = {
  open: false,
  message: "",
  severity: "",
  loading: false,
  placement: "bottom-right",
};

const toastReducer = (state = ToastInitialState, action: any) => {
  const { payload } = action;

  switch (action.type) {
    case TOAST_SHOW:
      return {
        open: true,
        message: payload.message,
        // Preserve "error" severity explicitly, default to "success" only if not provided
        severity: payload.severity === "error" ? "error" : (payload.severity || "success"),
        loading: payload.loading ?? false,
        placement: payload.placement || "bottom-right",
      };

    case TOAST_HIDE:
      return { ...ToastInitialState };

    default:
      return state;
  }
};

export default toastReducer;
