import { showToast } from "@/helpers/toastStore";
import axiosBaseApi from "@/axiosConfig";
import { generateStatusUrl } from "@/helpers";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { useTranslation } from "react-i18next";

const Verify = () => {
  const { t } = useTranslation("common");
  const router = useRouter();
  useEffect(() => {
    if (router.query && router.query.response) {
      const successRes = JSON.parse(router.query.response as string);

      console.log(successRes);
      getConfirmStatus();
    }
  }, [router.query]);

  const getConfirmStatus = async () => {
    try {
      const { response }: any = router.query;

      const { txRef } = JSON.parse(response);

      const {
        data: { data },
      } = await axiosBaseApi.post("wallet/confirmPayment", {
        uniqueRef: txRef,
      });

      const url = generateStatusUrl(data);
      window.location.replace(url);
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      showToast({
          message: message,
          severity: "error",
        });
    }
  };
  return <div>{t("verifyingPayment", { defaultValue: "Verifying payment..." })}</div>;
};

export default Verify;
