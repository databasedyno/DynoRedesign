import { useDispatch } from "react-redux";
import { TOAST_HIDE, TOAST_HIDE_ONE, TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { IToastItem } from "@/utils/types";

// Thin wrapper so new code stops importing Redux constants directly.
//   const { showToast } = useToast();
//   showToast({ message: "Saved", severity: "success" });
//   showToast({ message: "Link created", action: { label: "Open", onClick } });
export default function useToast() {
  const dispatch = useDispatch();

  const showToast = (opts: IToastItem) => {
    dispatch({ type: TOAST_SHOW, payload: opts });
  };

  const hideToast = (id?: string) => {
    if (id) dispatch({ type: TOAST_HIDE_ONE, payload: { id } });
    else dispatch({ type: TOAST_HIDE });
  };

  return { showToast, hideToast };
}
