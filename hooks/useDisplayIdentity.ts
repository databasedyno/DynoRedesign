import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import useTokenData from "./useTokenData";
import { UserAction } from "@/Redux/Actions";
import { USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";

type ProfileLite = { user_id?: number | string; name?: string; photo?: string | null } | null | undefined;

let profileRequested = false;

/** Name + photo for avatars: the server profile (fresh, cross-device) wins over the JWT snapshot. */
export default function useDisplayIdentity() {
  const dispatch = useDispatch();
  const tokenData = useTokenData();
  const profile = useSelector((s: rootReducer) => s.userReducer.profile) as ProfileLite;

  useEffect(() => {
    if (!tokenData?.user_id || profile?.user_id || profileRequested) return;
    profileRequested = true;
    dispatch(UserAction(USER_PROFILE_FETCH));
  }, [dispatch, tokenData?.user_id, profile?.user_id]);

  const sameUser = Boolean(profile?.user_id && tokenData?.user_id && Number(profile.user_id) === Number(tokenData.user_id));
  return {
    name: (sameUser && profile?.name) || tokenData?.name || "",
    photo: sameUser ? profile?.photo ?? tokenData?.photo ?? "" : tokenData?.photo ?? "",
    tokenData,
  };
}
