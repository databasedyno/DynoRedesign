import Head from "next/head";
import { useEffect } from "react";
import GetStartedWizard from "@/Components/Page/GetStarted";
import { pageProps } from "@/utils/types";

/**
 * /get-started — guided first-run wizard (About you → Where payouts go →
 * First payment link → Share it). Owns its own header, so the shared page
 * header is cleared here.
 */
export default function GetStartedPage({ setPageName, setPageDescription, setPageAction }: pageProps) {
  useEffect(() => {
    setPageName?.("");
    setPageDescription?.("");
    setPageAction?.(null);
  }, [setPageName, setPageDescription, setPageAction]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <main>
        <GetStartedWizard />
      </main>
    </>
  );
}
