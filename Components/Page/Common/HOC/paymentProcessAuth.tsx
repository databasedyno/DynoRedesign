import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { rootReducer } from "@/utils/types";
import { useSelector } from "react-redux";
import useTokenData from "@/hooks/useTokenData";
const paymentProcessAuth = (WrappedComponent: any) => {
  const AuthChecker = (props: any) => {
    const Router = useRouter();
    const [hasAccess, setHasAccess] = useState(false);

    // const tokenData = useTokenData();
    // useEffect(() => {
    //   if (tokenData) {
    //     if (
    //       tokenData?.sz_role === "ADMIN" &&
    //       tokenData.sz_payment_type !== "APP_SUMO"
    //     ) {
    //       setHasAccess(true);
    //     } else {
    //       Router.replace("/profile");
    //     }
    //   }
    // }, [tokenData]);
    return hasAccess ? <WrappedComponent {...props} /> : <></>;
  };
  return AuthChecker;
};

export default paymentProcessAuth;
