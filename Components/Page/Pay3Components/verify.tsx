import { showToast } from "@/helpers/toastStore";
import axiosBaseApi from "@/axiosConfig";
import { generateStatusUrl } from "@/helpers";
import { useRouter } from "next/router";
import { useEffect } from "react";


const Verify = () => {
  const router = useRouter();
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
      showToast({
          message: message,
          severity: "error",
        });
    }
  };
  return <div>Verifying....</div>;
};

export default Verify;
