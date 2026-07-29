import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { rootReducer } from "@/utils/types";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import { prettyCreatorDomain } from "@/helpers/creatorUrl";

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

/**
 * Invisible dashboard companion that finalizes a creator handle the visitor
 * reserved on the landing page (carried through signup via localStorage).
 *
 * The moment the profile loads after first login — if the user has NO handle
 * yet and a valid reserved handle is sitting in localStorage — it silently
 * submits PUT /user/creator/profile (assign only, page stays unpublished),
 * clears the carried handle/token, refreshes the profile, and toasts once.
 * On any failure it stays silent and leaves the reserved handle in place so
 * CreatorPageCard's inline claim can pre-fill it and let the user pick another.
 */
const AutoClaimHandle: React.FC = () => {
  const dispatch = useDispatch();
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    // Wait until the profile has loaded.
    if (!profile?.user_id) return;
    // Already has a handle — nothing to auto-apply.
    if (profile?.handle) {
      attemptedRef.current = true;
      return;
    }

    let handle = "";
    let token: string | undefined;
    try {
      handle = (localStorage.getItem("dynopay.claimedHandle") || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 30);
      token = localStorage.getItem("dynopay.claimedHandleToken") || undefined;
    } catch {
      return;
    }

    if (handle.length < 3 || !HANDLE_RE.test(handle)) return;

    attemptedRef.current = true;
    (async () => {
      try {
        await axiosBaseApi.put("/user/creator/profile", {
          handle,
          handle_reservation_token: token,
        });
        try {
          localStorage.removeItem("dynopay.claimedHandle");
          localStorage.removeItem("dynopay.claimedHandleToken");
        } catch {
          /* ignore storage errors */
        }
        const domain = prettyCreatorDomain() || "dynopay.me";
        dispatch({
          type: TOAST_SHOW,
          payload: { message: `Reserved! ${domain}/${handle} is yours 🎉` },
        });
        dispatch(UserAction(USER_PROFILE_FETCH));
      } catch {
        // Silent (user choice): keep the reserved handle so CreatorPageCard can
        // pre-fill it and the user can pick another name if it was just taken.
      }
    })();
  }, [profile?.user_id, profile?.handle, dispatch]);

  return null;
};

export default AutoClaimHandle;
