import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { rootReducer } from "@/utils/types";
import { useWalletStore } from "@/contexts/WalletDataContext";

const paymentAuth = (WrappedComponent: any) => {
  const AuthChecker = (props: any) => {
    const Router = useRouter();
    const [payment, setPayment] = useState(false);
    const paymentState = useWalletStore();

    useEffect(() => {
      // Allow checkout pages with `d` query parameter to load
      // The Payment component will fetch its own data from the encrypted token
      if (Router.query?.d) {
        setPayment(true);
        return;
      }

      if (paymentState.amount !== 0) {
        setPayment(true);
      } else {
        // Only redirect if no query param and no amount in state
        // Wait briefly for query params to be available (Next.js hydration)
        const timer = setTimeout(() => {
          if (!Router.query?.d && paymentState.amount === 0) {
            Router.replace("/");
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [Router.query, paymentState.amount]);

    return payment ? <WrappedComponent {...props} /> : <></>;
  };
  return AuthChecker;
};

export default paymentAuth;
