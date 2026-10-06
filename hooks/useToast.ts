import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { TOAST_HIDE, TOAST_HIDE_ONE, TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { IToastItem } from "@/utils/types";

// Thin wrapper so new code stops importing Redux constants directly.
//   const { showToast } = useToast();
//   showToast({ message: "Saved", severity: "success" });
//   showToast({ message: "Link created", action: { label: "Open", onClick } });
// showToast/hideToast are memoized (dispatch is stable) so callers can safely
// list them in effect/useCallback deps without causing re-render fetch loops.
export default function useToast() {
  const dispatch = useDispatch();

  const showToast = useCallback((opts: IToastItem) => {
    dispatch({ type: TOAST_SHOW, payload: opts });
  }, [dispatch]);

  const hideToast = useCallback((id?: string) => {
    if (id) dispatch({ type: TOAST_HIDE_ONE, payload: { id } });
    else dispatch({ type: TOAST_HIDE });
  }, [dispatch]);

  return { showToast, hideToast };
}
