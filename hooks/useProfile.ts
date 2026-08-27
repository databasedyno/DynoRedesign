import useSWR, { mutate } from "swr";

import axios from "@/axiosConfig";

/**
 * useProfile — SWR-backed replacement for the old Redux `userReducer.profile`
 * + the `USER_PROFILE_FETCH` saga path (data-layer consolidation, REFACTOR
 * Part D / Phase 2, Wave 5).
 *
 * The logged-in user's profile is global read-state consumed by ~20 components
 * (dashboard, sidebar, wallet, user menu, creator pages, settings…). A single
 * shared SWR key means every consumer reads ONE cached copy, and any mutation
 * that used to `dispatch(UserAction(USER_PROFILE_FETCH))` now calls
 * `revalidateProfile()` (or the hook's `refetchProfile`) to refresh them all.
 *
 * The fetch is token-gated: on public pages (no token) the key is null so SWR
 * never fires — mirroring the old behaviour where profile was only fetched for
 * authenticated surfaces.
 */

export const PROFILE_KEY = "user/profile";

const getToken = (): string | null =>
  (typeof window !== "undefined" ? localStorage.getItem("token") : null) || null;

/** Shared fetcher — GET user/profile, unwrapping the { data } envelope. */
export const profileFetcher = async (): Promise<any> => {
  const res = await axios.get(PROFILE_KEY);
  const responseData = res?.data;
  if (!responseData) {
    throw new Error("Invalid response from server");
  }
  if (responseData.success === false) {
    throw new Error(responseData.message || "Failed to fetch profile");
  }
  return responseData.data || responseData;
};

export interface UseProfileResult {
  profile: any;
  /** True only on the first load (no cached profile yet). */
  profileLoading: boolean;
  isValidating: boolean;
  error: unknown;
  /** Re-run the profile fetch (was dispatch(UserAction(USER_PROFILE_FETCH))). */
  refetchProfile: () => Promise<any>;
}

export function useProfile(): UseProfileResult {
  const token = getToken();
  const { data, error, isLoading, isValidating, mutate: revalidate } = useSWR(
    token ? PROFILE_KEY : null,
    profileFetcher,
  );

  return {
    profile: data ?? null,
    profileLoading: isLoading && data === undefined,
    isValidating,
    error,
    refetchProfile: revalidate,
  };
}

/**
 * Imperative profile refetch usable from anywhere (component or not) — the
 * drop-in for the old `dispatch(UserAction(USER_PROFILE_FETCH))`. Uses SWR's
 * global mutate against the shared PROFILE_KEY so every mounted `useProfile()`
 * consumer refreshes.
 */
export const revalidateProfile = (): Promise<any> => mutate(PROFILE_KEY);

export default useProfile;
