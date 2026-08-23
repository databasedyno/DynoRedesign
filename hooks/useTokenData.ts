import { TokenData } from "@/utils/types";
import { useState, useEffect } from "react";
import { decodeJwt } from "@/utils/decodeJwt";

const useTokenData = () => {
  const [tokenData, setTokenData] = useState<TokenData>();
  useEffect(() => {
    const token = localStorage.getItem("token") ?? "";
    setTokenData(decodeJwt<TokenData>(token) ?? undefined);
  }, []);

  return tokenData;
};

export default useTokenData;
