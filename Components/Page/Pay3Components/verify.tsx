import axiosBaseApi from "@/axiosConfig";
import { generateStatusUrl } from "@/helpers";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";

const Verify = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation("landing");
  useEffect(() => {
    if (router.query && router.query.response) {
      try {
        const successRes = JSON.parse(router.query.response as string);
        console.log(successRes);
      } catch (_e) {
        /* malformed response param — ignore, getConfirmStatus handles its own parse */
      }
      getConfirmStatus();
    }
  }, [router.query]);

  const getConfirmStatus = async () => {
    try {
      const { response }: any = router.query;

      const { txRef } = JSON.parse(response);

      const {
        data: { data },
      } = await axiosBaseApi.post("pay/confirmPayment", {
        uniqueRef: txRef,
      });
      const { redirect_uri, redirect, ...rest } = data;
      const url = generateStatusUrl({ ...rest, redirect });
      if (redirect) {
        localStorage.setItem("redirect_uri", redirect_uri);
      }
      window.location.replace(url);
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };
  return <div>{t("verify.verifying", { defaultValue: "Verifying...." })}</div>;
};

export default Verify;
