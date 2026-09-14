import { useRouter } from "next/router";
import React, { useEffect } from "react";

const Failed = () => {
  const router = useRouter();
  useEffect(() => {
    if (router.query && router.query.response) {
      try {
        const successRes = JSON.parse(router.query.response as string);
        if (successRes.redirect) {
          const url: any = localStorage.getItem("redirect_uri");
          console.log(url);
          if (url) {
            localStorage.removeItem("redirect_uri");
            window.location.replace(url);
          }
        }
        console.log(successRes);
      } catch (_e) {
        /* malformed response param — ignore instead of crashing the page */
      }
    }
  }, [router.query]);
  return <div>Failed</div>;
};

export default Failed;
