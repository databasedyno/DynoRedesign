import { TokenData } from "@/utils/types";
import { useState, useEffect } from "react";
import { decodeJwt } from "@/utils/decodeJwt";

export const TOKEN_UPDATED_EVENT = "dynopay:token-updated";

/** Call after writing a new access token so every mounted useTokenData re-decodes it (no reload). */
export const notifyTokenUpdated = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOKEN_UPDATED_EVENT));
};

const readToken = () => decodeJwt<TokenData>(localStorage.getItem("token") ?? "") ?? undefined;

const useTokenData = () => {
  const [tokenData, setTokenData] = useState<TokenData>();
  useEffect(() => {
    setTokenData(readToken());
    const refresh = () => setTokenData(readToken());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token" || e.key === null) refresh();
    };
    window.addEventListener(TOKEN_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TOKEN_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return tokenData;
};

export default useTokenData;
